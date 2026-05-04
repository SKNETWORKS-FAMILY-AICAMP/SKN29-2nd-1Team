# =========================
# Step 6. 추가 파생 피처 정리 + 누수 방지 피처 리스트 확정
# =========================

import re
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parents[1]))

import numpy as np
import pandas as pd
from utils.config import AGGREGATED_PATH, FEATURES_PATH


def winsorize_for_eda(series: pd.Series, lower: float = 0.01, upper: float = 0.99) -> pd.Series:
    return series.clip(series.quantile(lower), series.quantile(upper))


# ── 로드 ──────────────────────────────────────────────────────────
events = pd.read_parquet(AGGREGATED_PATH).copy()

# ── 필수 컬럼 확인 ───────────────────────────────────────────────
REQUIRED = [
    'video_id', 'event_id', 'T0', 'T_end', 'published_at',
    'category_group', 'entry_rank', 'T0_view', 'T0_comment',
    'T_end_view', 'T_end_comment', 'trending_duration_h',
]
missing = [c for c in REQUIRED if c not in events.columns]
if missing:
    raise ValueError(f"필수 컬럼 누락: {missing}")
print("[OK] 필수 컬럼 확인 완료")

# ── 1. T0 조회수/댓글 로그 변환 ──────────────────────────────────
events['T0_view_log']    = np.log1p(events['T0_view'])
events['T0_comment_log'] = np.log1p(events['T0_comment'])

# ── 2. T0 engagement_ratio (T0 기준 → 누수 아님) ─────────────────
events['T0_engagement_ratio']     = events['T0_comment'] / events['T0_view'].replace(0, np.nan)
events['T0_engagement_ratio_log'] = np.log1p(events['T0_engagement_ratio'])

print(f"\n[T0_engagement_ratio 분위수]\n{events['T0_engagement_ratio'].quantile([0,.5,.75,.9,.95,.99,.999,1])}")

# ── 3. latency_to_trend_h ─────────────────────────────────────────
events['latency_to_trend_h'] = (
    events['T0'] - events['published_at']
).dt.total_seconds() / 3600

neg_count = (events['latency_to_trend_h'] < 0).sum()
print(f"\n[latency 음수 개수] {neg_count} → 0으로 보정")
events['latency_to_trend_h']   = events['latency_to_trend_h'].clip(lower=0)
events['latency_to_trend_log'] = np.log1p(events['latency_to_trend_h'])

# ── 4. entry_rank_log ─────────────────────────────────────────────
events['entry_rank']     = pd.to_numeric(events['entry_rank'], errors='coerce')
events['entry_rank_log'] = np.log1p(events['entry_rank'])

# ── 5. pretrend_view_velocity ─────────────────────────────────────
# T0_view / latency_to_trend_h  (latency=0 방지를 위해 최소 1h 사용)
events['latency_to_trend_h_safe']    = events['latency_to_trend_h'].clip(lower=1)
events['pretrend_view_velocity']     = events['T0_view'] / events['latency_to_trend_h_safe']
events['pretrend_view_velocity_log'] = np.log1p(events['pretrend_view_velocity'])

# ── 6. 업로드 시간 변수 ───────────────────────────────────────────
events['published_weekday'] = events['published_at'].dt.dayofweek
events['published_hour']    = events['published_at'].dt.hour

hour = events['published_hour']
events['hour_sin'] = np.sin(2 * np.pi * hour / 24)
events['hour_cos'] = np.cos(2 * np.pi * hour / 24)

# ── 7. has_korean_title ───────────────────────────────────────────
events['has_korean_title'] = events['title'].apply(
    lambda x: int(bool(re.search(r'[가-힣]', str(x)))) if pd.notna(x) else 0
)

# ── 8. 사후 분석용 변수 (예측 피처 사용 금지) ──────────────────────
events['observed_view_velocity'] = (
    (events['T_end_view'] - events['T0_view'])
    / events['trending_duration_h'].replace(0, np.nan)
).clip(lower=0)

events['observed_comment_growth'] = (
    events['T_end_comment'] - events['T0_comment']
).clip(lower=0)

# ── 9. EDA용 Winsorization (모델링 시 별도 처리 필요) ────────────
events['trending_duration_h_wins_eda']     = winsorize_for_eda(events['trending_duration_h'])
events['T0_engagement_ratio_wins_eda']     = winsorize_for_eda(events['T0_engagement_ratio'])
events['pretrend_view_velocity_wins_eda']  = winsorize_for_eda(events['pretrend_view_velocity'])

events['view_growth_24h_wins_eda'] = np.nan
if 'view_growth_24h' in events.columns:
    mask = events['view_growth_24h'].notna()
    events.loc[mask, 'view_growth_24h_wins_eda'] = winsorize_for_eda(
        events.loc[mask, 'view_growth_24h']
    )

# ── 10. 피처 리스트 확정 & 누수 점검 ──────────────────────────────
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
]

FEATURES_24H = FEATURES_T0 + ['view_growth_24h_log']

FORBIDDEN = [
    'video_id', 'event_id', 'T0', 'T_end',
    'trending_duration_h', 'trending_duration_h_raw', 'trending_duration_log',
    'trending_duration_h_wins_eda',
    'n_snapshots', 'is_single_snapshot',
    'has_24h_observation', 'has_exact_24h_snapshot',
    'actual_time_at_24h', 'actual_gap_to_24h',
    'best_rank', 'peak_view', 'T_end_view', 'T_end_comment',
    'observed_view_velocity', 'observed_comment_growth',
    'view_at_24h', 'view_growth_24h', 'view_growth_24h_log',
]

leak_T0  = [c for c in FEATURES_T0  if c in FORBIDDEN]
leak_24h = [c for c in FEATURES_24H if c in FORBIDDEN and c != 'view_growth_24h_log']

print(f"\n[누수 점검]")
print(f"T0  피처 내 금지 변수: {leak_T0}")
print(f"24h 피처 내 금지 변수: {leak_24h}")

print(f"\n[T0 모델 피처]\n{FEATURES_T0}")
print(f"\n[24h 모델 피처]\n{FEATURES_24H}")

# ── 결과 확인 ─────────────────────────────────────────────────────
CHECK = [
    'entry_rank_log', 'T0_view_log', 'T0_comment_log',
    'T0_engagement_ratio_log', 'latency_to_trend_log',
    'pretrend_view_velocity_log',
]
if 'view_growth_24h_log' in events.columns:
    CHECK.append('view_growth_24h_log')

print(f"\n[주요 파생 피처 요약]\n{events[CHECK].describe().round(2)}")
print(f"\n[결측치 상위]\n{events.isnull().sum().sort_values(ascending=False).head(15)}")

