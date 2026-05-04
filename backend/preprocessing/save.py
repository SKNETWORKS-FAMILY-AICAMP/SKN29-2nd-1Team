# =========================
# Step 9. 최종 데이터 저장
# =========================
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parents[1]))

import pandas as pd
from utils.config import (
    SATURATION_PATH, EVENT_SPLIT_PATH, CATEGORY_SATURATION_PATH,
    ANALYSIS_PATH, T0_MODEL_PATH, MODEL_24H_PATH,
    TRENDING_SNAPSHOTS_PATH,
)

# ── 로드 ──────────────────────────────────────────────────────────
events = pd.read_parquet(SATURATION_PATH)
df     = pd.read_parquet(EVENT_SPLIT_PATH)

# ── 피처 / 타깃 / ID 리스트 ──────────────────────────────────────
ID_COLS = [
    'video_id', 'event_id',
    'channel_id', 'channel_title', 'title',
    'T0', 'published_at', 'category_id',
]

TARGET_COLS = [
    'trending_duration_h',
    'trending_duration_log',
    'long_label_global_q75',
    'long_label_cat_q75',
    'long_label_48h',
    'tdi_label',
]

FEATURES_T0 = [
    'category_group',
    'entry_rank_log',
    'T0_view_log',
    'T0_comment_log',
    'T0_engagement_ratio_log',
    'latency_to_trend_log',
    'pretrend_view_velocity_log',
    'published_weekday',
    'hour_sin',
    'hour_cos',
    'saturation_index_30d_mean_prev',   # 예측용 안정형 포화도
]

FEATURES_24H = FEATURES_T0 + ['view_growth_24h_log']

FORBIDDEN = [
    'saturation_index_same_day_eda',
    'same_day_category_event_count',
]

# ── 1. 분석용 테이블 ──────────────────────────────────────────────
ANALYSIS_COLS = [
    # 키
    'video_id', 'event_id', 'channel_id', 'channel_title', 'title',
    # 시간
    'T0', 'T_end', 'published_at', 'T0_date',
    'n_snapshots', 'is_single_snapshot',
    # 카테고리
    'category_id', 'category_group',
    # 타깃 / label
    'trending_duration_h', 'trending_duration_log', 'trending_duration_h_raw',
    'long_label_global_q75', 'long_label_cat_q75', 'long_label_48h',
    # TDI
    'cat_q75_duration', 'cat_q95_duration',
    'duration_score_cat', 'rank_score', 'TDI', 'tdi_label',
    # T0 피처
    'entry_rank', 'entry_rank_log',
    'T0_view', 'T0_view_log',
    'T0_comment', 'T0_comment_log',
    'T0_engagement_ratio', 'T0_engagement_ratio_log',
    'latency_to_trend_h', 'latency_to_trend_log',
    'pretrend_view_velocity', 'pretrend_view_velocity_log',
    'published_weekday', 'published_hour', 'hour_sin', 'hour_cos',
    # 보조
    'has_korean_title',
    # 24h 피처
    'has_24h_observation', 'has_exact_24h_snapshot',
    'actual_time_at_24h', 'actual_gap_to_24h',
    'view_at_24h', 'view_growth_24h', 'view_growth_24h_log',
    # saturation
    'saturation_index_prev',
    'saturation_index_30d_mean_prev',
    'saturation_index_same_day_eda',
    'same_day_category_event_count',
    'rolling_30d_mean_prev',
    # 사후 분석용
    'best_rank', 'peak_view', 'T_end_view', 'T_end_comment',
    'observed_view_velocity', 'observed_comment_growth',
    # EDA winsorized
    'trending_duration_h_wins_eda',
    'T0_engagement_ratio_wins_eda',
    'pretrend_view_velocity_wins_eda',
    'view_growth_24h_wins_eda',
]

analysis_cols = [c for c in ANALYSIS_COLS if c in events.columns]
missing_analysis = [c for c in ANALYSIS_COLS if c not in events.columns]
print(f"[분석용 누락 컬럼] {missing_analysis}")

video_trending_events_analysis = events[analysis_cols].copy()

# ── 2. T0 모델용 테이블 ───────────────────────────────────────────
t0_cols = [c for c in ID_COLS + TARGET_COLS + FEATURES_T0 if c in events.columns]
missing_T0 = [c for c in ID_COLS + TARGET_COLS + FEATURES_T0 if c not in events.columns]
print(f"[T0 모델 누락 컬럼] {missing_T0}")

video_trending_events_T0_model = events[t0_cols].copy()

# ── 3. 24h 모델용 테이블 ──────────────────────────────────────────
if 'has_24h_observation' not in events.columns:
    raise ValueError("has_24h_observation 컬럼이 없습니다. Step 4/5를 먼저 실행하세요.")

events_24h = events[events['has_24h_observation'] == True].copy()
cols_24h = [c for c in ID_COLS + TARGET_COLS + FEATURES_24H if c in events_24h.columns]
missing_24h = [c for c in ID_COLS + TARGET_COLS + FEATURES_24H if c not in events_24h.columns]
print(f"[24h 모델 누락 컬럼] {missing_24h}")

video_trending_events_24h_model = events_24h[cols_24h].copy()

# ── 4. trending_snapshots ─────────────────────────────────────────
SNAP_COLS = [
    'video_id', 'event_id', 'collection_date', 'rank',
    'view_count', 'comment_count', 'category_id', 'category_group',
    'channel_id', 'published_at', 'title',
]
trending_snapshots = df[[c for c in SNAP_COLS if c in df.columns]].copy()

# ── 5. category_saturation 불러오기 ──────────────────────────────
category_saturation = pd.read_parquet(CATEGORY_SATURATION_PATH)

# ── 6. 저장 ──────────────────────────────────────────────────────
video_trending_events_analysis.to_parquet(ANALYSIS_PATH,          index=False)
video_trending_events_T0_model.to_parquet(T0_MODEL_PATH,          index=False)
video_trending_events_24h_model.to_parquet(MODEL_24H_PATH,         index=False)
trending_snapshots.to_parquet(TRENDING_SNAPSHOTS_PATH,             index=False)
category_saturation.to_parquet(CATEGORY_SATURATION_PATH,           index=False)

# ── 7. 결과 확인 ─────────────────────────────────────────────────
print("\n[저장 완료]")
print(f"  analysis events  : {video_trending_events_analysis.shape}  → {ANALYSIS_PATH.name}")
print(f"  T0 model events  : {video_trending_events_T0_model.shape}  → {T0_MODEL_PATH.name}")
print(f"  24h model events : {video_trending_events_24h_model.shape}  → {MODEL_24H_PATH.name}")
print(f"  snapshots        : {trending_snapshots.shape}  → {TRENDING_SNAPSHOTS_PATH.name}")
print(f"  saturation       : {category_saturation.shape}  → {CATEGORY_SATURATION_PATH.name}")

print("\n[T0 모델 결측 확인]")
print(video_trending_events_T0_model.isnull().sum().sort_values(ascending=False).head(10))

print("\n[24h 모델 결측 확인]")
print(video_trending_events_24h_model.isnull().sum().sort_values(ascending=False).head(10))
