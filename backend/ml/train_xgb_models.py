"""
XGBoost training script for YouTube KR trending prediction.

Run from backend folder:
  pip install pandas pyarrow scikit-learn xgboost joblib
  python ml/train_xgb_models.py

Outputs:
  backend/models/xgb_duration_t0.joblib
  backend/models/xgb_tdi_t0.joblib
  backend/models/xgb_view24_t0.joblib
  backend/models/xgb_metadata.json
"""
from __future__ import annotations

import json
import math
from datetime import datetime
from pathlib import Path
from typing import Dict, Iterable, Optional

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score, f1_score, mean_absolute_error, r2_score, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

try:
    from xgboost import XGBClassifier, XGBRegressor
except Exception as exc:  # pragma: no cover
    raise RuntimeError(
        "xgboost가 설치되어 있지 않습니다. `pip install xgboost` 실행 후 다시 학습하세요."
    ) from exc

ROOT = Path(__file__).resolve().parents[1]
MODELS_DIR = ROOT / "models"
DATA_DIR = ROOT / "data"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

T0_CANDIDATES = [
    DATA_DIR / "video_trending_events_T0_model.parquet",
    DATA_DIR / "video_trending_events_T0_model(3).parquet",
    ROOT / "video_trending_events_T0_model.parquet",
    ROOT / "video_trending_events_T0_model(3).parquet",
    ROOT.parent / "video_trending_events_T0_model(3).parquet",
]

ANALYSIS_CANDIDATES = [
    DATA_DIR / "video_trending_events_analysis.parquet",
    DATA_DIR / "video_trending_events_analysis(3).parquet",
    ROOT / "video_trending_events_analysis.parquet",
    ROOT / "video_trending_events_analysis(3).parquet",
    ROOT.parent / "video_trending_events_analysis(3).parquet",
]

FEATURES = [
    "category_group",
    "entry_rank_log",
    "T0_view_log",
    "T0_comment_log",
    "T0_engagement_ratio_log",
    "latency_to_trend_log",
    "pretrend_view_velocity_log",
    "published_weekday",
    "hour_sin",
    "hour_cos",
    "saturation_index_30d_mean_prev",
]

CATEGORICAL = ["category_group"]
NUMERIC = [c for c in FEATURES if c not in CATEGORICAL]


def find_existing(candidates: Iterable[Path]) -> Optional[Path]:
    for p in candidates:
        if p.exists():
            return p
    return None


def make_preprocessor() -> ColumnTransformer:
    try:
        onehot = OneHotEncoder(handle_unknown="ignore", sparse_output=False)
    except TypeError:  # older sklearn
        onehot = OneHotEncoder(handle_unknown="ignore", sparse=False)
    return ColumnTransformer(
        transformers=[
            ("cat", Pipeline([("imputer", SimpleImputer(strategy="most_frequent")), ("onehot", onehot)]), CATEGORICAL),
            ("num", Pipeline([("imputer", SimpleImputer(strategy="median"))]), NUMERIC),
        ],
        remainder="drop",
    )


def make_regressor(seed: int = 42) -> XGBRegressor:
    return XGBRegressor(
        n_estimators=350,
        max_depth=4,
        learning_rate=0.045,
        subsample=0.9,
        colsample_bytree=0.9,
        objective="reg:squarederror",
        random_state=seed,
        n_jobs=-1,
    )


def make_classifier(seed: int = 42) -> XGBClassifier:
    return XGBClassifier(
        n_estimators=300,
        max_depth=4,
        learning_rate=0.045,
        subsample=0.9,
        colsample_bytree=0.9,
        objective="binary:logistic",
        eval_metric="logloss",
        random_state=seed,
        n_jobs=-1,
    )


def clean_df(df: pd.DataFrame, target: str) -> pd.DataFrame:
    required = FEATURES + [target]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"학습 데이터에 필요한 컬럼이 없습니다: {missing}")
    out = df[required].copy()
    out = out.dropna(subset=[target])
    out = out.replace([np.inf, -np.inf], np.nan)
    return out


def train_duration(df: pd.DataFrame) -> Dict[str, float]:
    train_df = clean_df(df, "trending_duration_h")
    X = train_df[FEATURES]
    y = train_df["trending_duration_h"].clip(lower=6)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = Pipeline([("prep", make_preprocessor()), ("model", make_regressor())])
    model.fit(X_train, np.log1p(y_train))
    pred = np.expm1(model.predict(X_test))

    joblib.dump(model, MODELS_DIR / "xgb_duration_t0.joblib")
    return {
        "mae_h": float(mean_absolute_error(y_test, pred)),
        "r2": float(r2_score(y_test, pred)),
        "rows": int(len(train_df)),
    }


def train_tdi(df: pd.DataFrame) -> Dict[str, float]:
    train_df = clean_df(df, "tdi_label")
    X = train_df[FEATURES]
    y = train_df["tdi_label"].astype(int)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    model = Pipeline([("prep", make_preprocessor()), ("model", make_classifier())])
    model.fit(X_train, y_train)
    prob = model.predict_proba(X_test)[:, 1]
    pred = (prob >= 0.5).astype(int)

    joblib.dump(model, MODELS_DIR / "xgb_tdi_t0.joblib")
    return {
        "auc": float(roc_auc_score(y_test, prob)),
        "f1": float(f1_score(y_test, pred)),
        "accuracy": float(accuracy_score(y_test, pred)),
        "rows": int(len(train_df)),
    }


def train_view24(df: pd.DataFrame) -> Dict[str, float]:
    train_df = clean_df(df, "view_at_24h")
    train_df = train_df[train_df["view_at_24h"] > 0].copy()
    X = train_df[FEATURES]
    y = train_df["view_at_24h"].astype(float)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = Pipeline([("prep", make_preprocessor()), ("model", make_regressor(seed=43))])
    model.fit(X_train, np.log1p(y_train))
    pred = np.expm1(model.predict(X_test))

    joblib.dump(model, MODELS_DIR / "xgb_view24_t0.joblib")
    return {
        "mae_views": float(mean_absolute_error(y_test, pred)),
        "r2": float(r2_score(y_test, pred)),
        "rows": int(len(train_df)),
    }


def metadata_defaults(df: pd.DataFrame) -> Dict[str, float]:
    defaults = {}
    for c in NUMERIC:
        defaults[c] = float(pd.to_numeric(df[c], errors="coerce").median()) if c in df.columns else 0.0
    common_category = "Entertainment"
    if "category_group" in df.columns and not df["category_group"].dropna().empty:
        common_category = str(df["category_group"].mode().iloc[0])
    return {"numeric_medians": defaults, "default_category_group": common_category}


def main() -> None:
    t0_path = find_existing(T0_CANDIDATES)
    analysis_path = find_existing(ANALYSIS_CANDIDATES)
    if t0_path is None:
        raise FileNotFoundError("video_trending_events_T0_model.parquet 파일을 backend/data 또는 backend 폴더에 넣어주세요.")

    print(f"T0 학습 데이터: {t0_path}")
    t0_df = pd.read_parquet(t0_path)
    metrics = {
        "duration_t0": train_duration(t0_df),
        "tdi_t0": train_tdi(t0_df),
    }

    if analysis_path is not None:
        print(f"24h 조회수 학습 데이터: {analysis_path}")
        analysis_df = pd.read_parquet(analysis_path)
        if "view_at_24h" in analysis_df.columns:
            metrics["view24_t0"] = train_view24(analysis_df)
        else:
            metrics["view24_t0"] = {"skipped": "view_at_24h 컬럼 없음"}
        meta_base = analysis_df if set(NUMERIC).issubset(analysis_df.columns) else t0_df
    else:
        metrics["view24_t0"] = {"skipped": "analysis parquet 없음"}
        meta_base = t0_df

    meta = {
        "trained_at": datetime.now().isoformat(timespec="seconds"),
        "features": FEATURES,
        "categorical": CATEGORICAL,
        "numeric": NUMERIC,
        "metrics": metrics,
        **metadata_defaults(meta_base),
    }
    (MODELS_DIR / "xgb_metadata.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    print("\n저장 완료:")
    for p in ["xgb_duration_t0.joblib", "xgb_tdi_t0.joblib", "xgb_view24_t0.joblib", "xgb_metadata.json"]:
        print(" -", MODELS_DIR / p)
    print("\n성능 요약:")
    print(json.dumps(metrics, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
