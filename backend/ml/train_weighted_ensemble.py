"""
WeightedSoftVoting 최종 모델 학습 스크립트
────────────────────────────────────
XGBoost + LightGBM + MLP를 Soft Voting으로 결합해
트렌딩 지속성(long-lived) 확률을 예측하는 최종 모델을 저장합니다.

실행 위치:
  cd backend
  python ml/train_weighted_ensemble.py

저장 결과:
  backend/models/weighted_soft_voting.joblib
  backend/models/weighted_soft_voting_metadata.json
"""
from __future__ import annotations

import json
import math
import warnings
from pathlib import Path
from typing import Iterable

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingClassifier, HistGradientBoostingClassifier, VotingClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

warnings.filterwarnings("ignore")

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
MODELS_DIR = ROOT / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

DATA_CANDIDATES = [
    DATA_DIR / "video_trending_events_T0_model.parquet",
    DATA_DIR / "video_trending_events_24h_model.parquet",
    DATA_DIR / "video_trending_events_analysis.parquet",
]

TARGET_CANDIDATES = [
    "is_long_lived",
    "long_lived",
    "tdi_label",
    "target",
    "label",
    "is_sustained",
]

ID_OR_LEAKAGE_KEYWORDS = [
    "video_id", "event_id", "channel_id", "title", "description", "thumbnail",
    "url", "publishedat", "published_at", "start_time", "end_time",
]

# 지속성 예측에서 타깃 누수 가능성이 큰 컬럼은 기본 제외합니다.
LEAKAGE_EXACT = {
    "duration_h", "duration_hour", "duration_hours", "duration", "stay_hours",
    "target_duration_h", "final_duration_h", "is_long_lived", "long_lived",
    "tdi_label", "target", "label", "is_sustained",
}


def _find_data_path() -> Path:
    for path in DATA_CANDIDATES:
        if path.exists():
            return path
    raise FileNotFoundError(
        "학습용 parquet 파일을 찾지 못했습니다. backend/data 안에 "
        "video_trending_events_T0_model.parquet 또는 analysis parquet이 필요합니다."
    )


def _safe_auc(y_true: Iterable[int], y_proba: Iterable[float]) -> float:
    try:
        return float(roc_auc_score(y_true, y_proba))
    except Exception:
        return 0.0


def _make_target(df: pd.DataFrame) -> tuple[pd.Series, str]:
    for col in TARGET_CANDIDATES:
        if col in df.columns:
            y = df[col].fillna(0).astype(int)
            if y.nunique() >= 2:
                return y, col

    duration_cols = [
        "duration_h", "duration_hour", "duration_hours", "duration",
        "stay_hours", "target_duration_h", "final_duration_h",
    ]
    for col in duration_cols:
        if col in df.columns:
            s = pd.to_numeric(df[col], errors="coerce")
            # 중앙값 기준보다 포트폴리오 설명이 쉬운 72h 기준을 우선 사용합니다.
            threshold = 72.0 if s.max(skipna=True) > 72 else float(s.median(skipna=True))
            y = (s >= threshold).fillna(False).astype(int)
            if y.nunique() >= 2:
                return y, f"{col} >= {threshold:.1f}h"

    raise ValueError("long-lived 타깃을 만들 수 없습니다. target 또는 duration 계열 컬럼이 필요합니다.")


def _select_columns(df: pd.DataFrame, target_source: str) -> tuple[list[str], list[str]]:
    exclude = set()
    for c in df.columns:
        c_lower = c.lower()
        if c_lower in LEAKAGE_EXACT:
            exclude.add(c)
        if any(k in c_lower for k in ID_OR_LEAKAGE_KEYWORDS):
            exclude.add(c)
    # target_source가 "col >= ..." 형태일 수 있으므로 앞 컬럼명만 추가 제외
    exclude.add(target_source.split()[0])

    usable = [c for c in df.columns if c not in exclude]
    numeric_cols = []
    categorical_cols = []

    for c in usable:
        if pd.api.types.is_numeric_dtype(df[c]):
            # 거의 모두 결측이면 제외
            if df[c].notna().mean() >= 0.2:
                numeric_cols.append(c)
        else:
            nunique = df[c].nunique(dropna=True)
            if 1 < nunique <= 40:
                categorical_cols.append(c)

    # 프론트/예측 API에서 자주 쓰는 컬럼이 있으면 우선 포함되도록 보장
    preferred_cats = ["category_group", "category", "category_name"]
    for c in preferred_cats:
        if c in df.columns and c not in categorical_cols and c not in exclude:
            categorical_cols.append(c)

    if not numeric_cols and not categorical_cols:
        raise ValueError("학습에 사용할 수 있는 피처가 없습니다.")
    return numeric_cols, categorical_cols


def _get_xgb():
    try:
        from xgboost import XGBClassifier
        return XGBClassifier(
            n_estimators=250,
            max_depth=4,
            learning_rate=0.045,
            subsample=0.9,
            colsample_bytree=0.9,
            eval_metric="logloss",
            random_state=42,
            n_jobs=-1,
        ), "XGBoost"
    except Exception:
        return HistGradientBoostingClassifier(max_iter=220, learning_rate=0.055, random_state=42), "HistGradientBoosting(XGB fallback)"


def _get_lgbm():
    try:
        from lightgbm import LGBMClassifier
        return LGBMClassifier(
            n_estimators=280,
            learning_rate=0.04,
            num_leaves=31,
            subsample=0.9,
            colsample_bytree=0.9,
            random_state=42,
            n_jobs=-1,
            verbose=-1,
        ), "LightGBM"
    except Exception:
        return GradientBoostingClassifier(n_estimators=180, learning_rate=0.045, random_state=42), "GradientBoosting(LGBM fallback)"


def train() -> dict:
    data_path = _find_data_path()
    df = pd.read_parquet(data_path)
    df = df.replace([np.inf, -np.inf], np.nan)

    y, target_source = _make_target(df)
    numeric_cols, categorical_cols = _select_columns(df, target_source)
    X = df[numeric_cols + categorical_cols].copy()

    # 샘플이 너무 크면 학습 시간을 줄이되 stratify는 유지합니다.
    if len(X) > 120_000:
        sample_idx = y.groupby(y).sample(frac=min(1, 120_000 / len(X)), random_state=42).index
        X = X.loc[sample_idx]
        y = y.loc[sample_idx]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    numeric_pipe = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
    ])
    categorical_pipe = Pipeline([
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("onehot", OneHotEncoder(handle_unknown="ignore")),
    ])
    preprocessor = ColumnTransformer([
        ("num", numeric_pipe, numeric_cols),
        ("cat", categorical_pipe, categorical_cols),
    ])

    xgb_model, xgb_name = _get_xgb()
    lgbm_model, lgbm_name = _get_lgbm()
    mlp_model = MLPClassifier(
        hidden_layer_sizes=(96, 48),
        activation="relu",
        alpha=0.0005,
        learning_rate_init=0.001,
        max_iter=350,
        random_state=42,
        early_stopping=True,
    )

    ensemble = VotingClassifier(
        estimators=[
            ("xgb", xgb_model),
            ("lgbm", lgbm_model),
            ("mlp", mlp_model),
        ],
        voting="soft",
        weights=[0.4, 0.35, 0.25],
        n_jobs=1,
        flatten_transform=True,
    )

    pipeline = Pipeline([
        ("preprocess", preprocessor),
        ("ensemble", ensemble),
    ])

    pipeline.fit(X_train, y_train)
    proba = pipeline.predict_proba(X_test)[:, 1]
    pred = (proba >= 0.5).astype(int)

    metrics = {
        "accuracy": round(float(accuracy_score(y_test, pred)), 4),
        "auc": round(_safe_auc(y_test, proba), 4),
        "f1": round(float(f1_score(y_test, pred, zero_division=0)), 4),
        "precision": round(float(precision_score(y_test, pred, zero_division=0)), 4),
        "recall": round(float(recall_score(y_test, pred, zero_division=0)), 4),
    }

    model_path = MODELS_DIR / "weighted_soft_voting.joblib"
    metadata_path = MODELS_DIR / "weighted_soft_voting_metadata.json"
    joblib.dump(pipeline, model_path)

    medians = {c: float(pd.to_numeric(df[c], errors="coerce").median()) for c in numeric_cols}
    modes = {}
    for c in categorical_cols:
        mode = df[c].dropna().astype(str).mode()
        modes[c] = str(mode.iloc[0]) if len(mode) else "Unknown"

    metadata = {
        "model_type": "WeightedSoftVoting",
        "description": "XGBoost + LightGBM + MLP soft voting ensemble for long-lived trending prediction",
        "data_path": str(data_path),
        "target_source": target_source,
        "feature_columns": numeric_cols + categorical_cols,
        "numeric_columns": numeric_cols,
        "categorical_columns": categorical_cols,
        "numeric_medians": medians,
        "categorical_modes": modes,
        "estimators": [xgb_name, lgbm_name, "MLP"],
        "weights": {"xgb": 0.4, "lgbm": 0.35, "mlp": 0.25},
        "metrics": metrics,
        "threshold": 0.5,
    }
    metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")

    print("Saved:", model_path)
    print("Saved:", metadata_path)
    print(json.dumps(metadata, ensure_ascii=False, indent=2))
    return metadata


if __name__ == "__main__":
    train()
