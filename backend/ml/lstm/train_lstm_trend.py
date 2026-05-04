"""
Optional LSTM training scaffold for TrendIt.

Use this only when you have time-series snapshots per video, e.g. rows ordered by
video_id + snapshot_time with view_count/comment_count/rank/category/time features.
Output model path suggestion: backend/models/lstm_trend_predictor.pt
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import numpy as np
import pandas as pd

try:
    import torch
    import torch.nn as nn
    from torch.utils.data import DataLoader, TensorDataset
except ImportError as exc:  # pragma: no cover
    raise SystemExit("Install torch first: pip install torch") from exc


ROOT = Path(__file__).resolve().parents[2]
DATA_PATH = ROOT / "data" / "youtube_trends_KR.parquet"
MODEL_PATH = ROOT / "models" / "lstm_trend_predictor.pt"


@dataclass
class LSTMConfig:
    seq_len: int = 12
    hidden_size: int = 64
    num_layers: int = 2
    dropout: float = 0.15
    batch_size: int = 128
    epochs: int = 20
    lr: float = 1e-3


FEATURE_COLUMNS = [
    "view_log",
    "comment_log",
    "rank_log",
    "hour_sin",
    "hour_cos",
    "weekday",
]


def add_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    view_col = "view_count" if "view_count" in df.columns else "views"
    comment_col = "comment_count" if "comment_count" in df.columns else "comments"
    rank_col = "rank" if "rank" in df.columns else "entry_rank"
    time_col = "snapshot_time" if "snapshot_time" in df.columns else "publishedAt"

    df["view_log"] = np.log1p(pd.to_numeric(df.get(view_col, 0), errors="coerce").fillna(0))
    df["comment_log"] = np.log1p(pd.to_numeric(df.get(comment_col, 0), errors="coerce").fillna(0))
    df["rank_log"] = np.log1p(pd.to_numeric(df.get(rank_col, 100), errors="coerce").fillna(100))

    dt = pd.to_datetime(df.get(time_col), errors="coerce", utc=True)
    hour = dt.dt.hour.fillna(12).astype(float)
    df["hour_sin"] = np.sin(2 * np.pi * hour / 24)
    df["hour_cos"] = np.cos(2 * np.pi * hour / 24)
    df["weekday"] = dt.dt.weekday.fillna(3).astype(float) / 6.0

    if "is_long_trending" not in df.columns:
        # 예시 target: 실제 프로젝트에서는 event duration 기준으로 label 생성 권장
        duration_col = "duration_hours" if "duration_hours" in df.columns else None
        if duration_col:
            df["is_long_trending"] = (pd.to_numeric(df[duration_col], errors="coerce").fillna(0) >= 72).astype(int)
        else:
            raise ValueError("Need target column: is_long_trending or duration_hours")
    return df


def make_sequences(df: pd.DataFrame, cfg: LSTMConfig):
    id_col = "video_id" if "video_id" in df.columns else "id"
    time_col = "snapshot_time" if "snapshot_time" in df.columns else "publishedAt"
    df = df.sort_values([id_col, time_col])

    xs, ys = [], []
    for _, g in df.groupby(id_col):
        arr = g[FEATURE_COLUMNS].to_numpy(dtype=np.float32)
        target = int(g["is_long_trending"].iloc[-1])
        if len(arr) < cfg.seq_len:
            pad = np.repeat(arr[:1], cfg.seq_len - len(arr), axis=0)
            arr = np.vstack([pad, arr])
        xs.append(arr[-cfg.seq_len:])
        ys.append(target)
    return np.stack(xs), np.array(ys, dtype=np.float32)


class TrendLSTM(nn.Module):
    def __init__(self, input_size: int, hidden_size: int, num_layers: int, dropout: float):
        super().__init__()
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            dropout=dropout if num_layers > 1 else 0.0,
            batch_first=True,
        )
        self.head = nn.Sequential(
            nn.LayerNorm(hidden_size),
            nn.Linear(hidden_size, 32),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(32, 1),
        )

    def forward(self, x):
        out, _ = self.lstm(x)
        last = out[:, -1, :]
        return self.head(last).squeeze(-1)


def train():
    cfg = LSTMConfig()
    df = pd.read_parquet(DATA_PATH)
    df = add_features(df)
    x, y = make_sequences(df, cfg)

    split = int(len(x) * 0.8)
    x_train, y_train = x[:split], y[:split]
    x_val, y_val = x[split:], y[split:]

    train_loader = DataLoader(
        TensorDataset(torch.tensor(x_train), torch.tensor(y_train)),
        batch_size=cfg.batch_size,
        shuffle=True,
    )

    model = TrendLSTM(len(FEATURE_COLUMNS), cfg.hidden_size, cfg.num_layers, cfg.dropout)
    opt = torch.optim.AdamW(model.parameters(), lr=cfg.lr)
    loss_fn = nn.BCEWithLogitsLoss()

    for epoch in range(1, cfg.epochs + 1):
        model.train()
        total = 0.0
        for xb, yb in train_loader:
            opt.zero_grad()
            loss = loss_fn(model(xb), yb)
            loss.backward()
            opt.step()
            total += float(loss.item()) * len(xb)

        model.eval()
        with torch.no_grad():
            logits = model(torch.tensor(x_val))
            val_loss = loss_fn(logits, torch.tensor(y_val)).item()
            prob = torch.sigmoid(logits).numpy()
            acc = ((prob >= 0.5) == y_val).mean() if len(y_val) else 0
        print(f"epoch={epoch:02d} train_loss={total/len(x_train):.4f} val_loss={val_loss:.4f} val_acc={acc:.4f}")

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    torch.save({
        "model_state": model.state_dict(),
        "feature_columns": FEATURE_COLUMNS,
        "config": cfg.__dict__,
    }, MODEL_PATH)
    print(f"saved: {MODEL_PATH}")


if __name__ == "__main__":
    train()
