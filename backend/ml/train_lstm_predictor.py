from __future__ import annotations

"""
TrendIT LSTM trainer

사용법:
1) pip install -r backend/requirements_lstm.txt
2) python backend/ml/train_lstm_predictor.py

주의:
- LSTM은 시간 순서가 있는 데이터(예: 0h, 6h, 12h, 24h 조회수 스냅샷)에 강합니다.
- 현재 데이터에 시간별 스냅샷이 부족하면 XGBoost가 더 안정적일 수 있습니다.
"""

from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import joblib
import json
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, roc_auc_score

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "video_trending_events_24h_model.parquet"
MODEL_PATH = ROOT / "models" / "lstm_trend_sequence.keras"
SCALER_PATH = ROOT / "models" / "lstm_scaler.joblib"
METRICS_PATH = ROOT / "models" / "lstm_metrics.json"


def build_dataset(df: pd.DataFrame):
    views = np.log1p(df.get("T0_view", df.get("view_count", 0)).fillna(0).to_numpy(dtype="float32"))
    comments = np.log1p(df.get("T0_comment", df.get("comment_count", 0)).fillna(0).to_numpy(dtype="float32"))
    growth = np.log1p(df.get("view_growth_24h", df.get("view24", 0)).fillna(0).to_numpy(dtype="float32"))
    weekday = df.get("published_weekday", pd.Series([3] * len(df))).fillna(3).to_numpy(dtype="float32") / 6
    hour_sin = df.get("hour_sin", pd.Series([0] * len(df))).fillna(0).to_numpy(dtype="float32")
    hour_cos = df.get("hour_cos", pd.Series([1] * len(df))).fillna(1).to_numpy(dtype="float32")

    base = np.stack([views, comments, growth, hour_sin, hour_cos, weekday], axis=1)

    # 실제 시간별 feature가 없을 경우 최소 3-step sequence로 변환합니다.
    x0 = base * np.array([0.70, 0.85, 0.00, 1, 1, 1], dtype="float32")
    x1 = base * np.array([0.88, 0.93, 0.50, 1, 1, 1], dtype="float32")
    x2 = base
    X = np.stack([x0, x1, x2], axis=1)

    target_candidates = ["target", "is_long_trending", "long_trending", "tdi_label"]
    y = None
    for col in target_candidates:
        if col in df.columns:
            y = df[col].fillna(0).astype("float32").to_numpy()
            break
    if y is None:
        # 지속 시간이 중앙값 이상이면 장기 지속으로 간주하는 fallback label
        duration = df.get("duration_hours", df.get("trend_duration", pd.Series([0] * len(df)))).fillna(0)
        y = (duration >= duration.median()).astype("float32").to_numpy()

    return X.astype("float32"), y.astype("float32")


def main():
    if not DATA_PATH.exists():
        raise FileNotFoundError(f"Data not found: {DATA_PATH}")

    df = pd.read_parquet(DATA_PATH)
    X, y = build_dataset(df)

    n, steps, feats = X.shape
    scaler = StandardScaler()
    X2 = scaler.fit_transform(X.reshape(n * steps, feats)).reshape(n, steps, feats)

    X_train, X_val, y_train, y_val = train_test_split(X2, y, test_size=0.2, random_state=42, stratify=y if len(set(y)) > 1 else None)

    from tensorflow.keras import Sequential
    from tensorflow.keras.layers import LSTM, Dense, Dropout
    from tensorflow.keras.callbacks import EarlyStopping

    model = Sequential([
        LSTM(48, input_shape=(steps, feats), return_sequences=False),
        Dropout(0.25),
        Dense(24, activation="relu"),
        Dropout(0.15),
        Dense(1, activation="sigmoid"),
    ])
    model.compile(optimizer="adam", loss="binary_crossentropy", metrics=["accuracy", "AUC"])
    history = model.fit(
        X_train,
        y_train,
        validation_data=(X_val, y_val),
        epochs=40,
        batch_size=64,
        callbacks=[EarlyStopping(patience=5, restore_best_weights=True)],
        verbose=1,
    )

    val_prob = model.predict(X_val, verbose=0).reshape(-1)
    val_pred = (val_prob >= 0.5).astype("int32")
    metrics = {
        "accuracy": float(accuracy_score(y_val, val_pred)),
        "f1": float(f1_score(y_val, val_pred, zero_division=0)),
        "precision": float(precision_score(y_val, val_pred, zero_division=0)),
        "recall": float(recall_score(y_val, val_pred, zero_division=0)),
        "auc": float(roc_auc_score(y_val, val_prob)) if len(set(y_val)) > 1 else None,
        "best_epoch": int(len(history.history.get("loss", []))),
        "note": "Pseudo 3-step sequence metrics from train_lstm_predictor.py validation split."
    }

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    model.save(MODEL_PATH)
    joblib.dump(scaler, SCALER_PATH)
    METRICS_PATH.write_text(json.dumps(metrics, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"saved: {MODEL_PATH}")
    print(f"saved: {SCALER_PATH}")
    print(f"saved: {METRICS_PATH}")
    print(metrics)


if __name__ == "__main__":
    main()
