# =========================
# Step 8. Saturation Index 계산 + EDA
# =========================
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parents[1]))

import numpy as np
import pandas as pd
from utils.config import TARGET_PATH, SATURATION_PATH, CATEGORY_SATURATION_PATH

# ── 로드 ──────────────────────────────────────────────────────────
events = pd.read_parquet(TARGET_PATH).copy()

# ── 0. 재실행 대비: 기존 saturation 컬럼 제거 ────────────────────
SAT_DROP = [
    'T0_date', 'same_day_category_event_count',
    'saturation_index_prev', 'saturation_index_same_day_eda',
    'saturation_index_30d_mean_prev', 'rolling_30d_mean_prev',
]
events = events.drop(columns=[c for c in SAT_DROP if c in events.columns])

# ── 1. 날짜 변수 생성 ─────────────────────────────────────────────
events['T0_date'] = events['T0'].dt.normalize()

# ── 2. 일자-카테고리별 이벤트 수 계산 ────────────────────────────
daily_cat = (
    events.groupby(['T0_date', 'category_group'])
    .size()
    .reset_index(name='event_count')
)

# ── 3. 모든 날짜 × 카테고리 조합 생성 (0 이벤트 날짜 포함) ────────
all_dates = pd.date_range(
    start=events['T0_date'].min(),
    end=events['T0_date'].max(),
    freq='D',
)
all_categories = sorted(events['category_group'].dropna().unique())

full_index = pd.MultiIndex.from_product(
    [all_dates, all_categories],
    names=['T0_date', 'category_group'],
)
daily_cat_full = (
    daily_cat.set_index(['T0_date', 'category_group'])
    .reindex(full_index, fill_value=0)
    .reset_index()
    .sort_values(['category_group', 'T0_date'])
)

# ── 4. EDA용 same-day saturation index ───────────────────────────
daily_cat_full['rolling_30d_max_incl'] = (
    daily_cat_full.groupby('category_group')['event_count']
    .transform(lambda x: x.rolling(30, min_periods=1).max())
)
daily_cat_full['saturation_index_same_day_eda'] = (
    daily_cat_full['event_count']
    / daily_cat_full['rolling_30d_max_incl'].replace(0, np.nan)
).clip(0, 1).fillna(0)

# ── 5. 예측용 saturation index (전날까지 정보만 사용) ────────────
# 전날 이벤트 수
daily_cat_full['prev_event_count'] = (
    daily_cat_full.groupby('category_group')['event_count'].shift(1)
)
# 전날까지 최근 30일 최대
daily_cat_full['rolling_30d_max_prev'] = (
    daily_cat_full.groupby('category_group')['event_count']
    .transform(lambda x: x.shift(1).rolling(30, min_periods=1).max())
)
# 전날까지 최근 30일 평균
daily_cat_full['rolling_30d_mean_prev'] = (
    daily_cat_full.groupby('category_group')['event_count']
    .transform(lambda x: x.shift(1).rolling(30, min_periods=1).mean())
)
# 단기 포화도 (전날 기준)
daily_cat_full['saturation_index_prev'] = (
    daily_cat_full['prev_event_count']
    / daily_cat_full['rolling_30d_max_prev'].replace(0, np.nan)
).clip(0, 1).fillna(0)
# 안정형 포화도 (30일 평균 기준 — T0 모델 권장)
daily_cat_full['saturation_index_30d_mean_prev'] = (
    daily_cat_full['rolling_30d_mean_prev']
    / daily_cat_full['rolling_30d_max_prev'].replace(0, np.nan)
).clip(0, 1).fillna(0)

# ── 6. events에 병합 ──────────────────────────────────────────────
events = events.merge(
    daily_cat_full[[
        'T0_date', 'category_group',
        'event_count',
        'saturation_index_same_day_eda',
        'saturation_index_prev',
        'saturation_index_30d_mean_prev',
        'rolling_30d_mean_prev',
    ]],
    on=['T0_date', 'category_group'],
    how='left',
)
events = events.rename(columns={'event_count': 'same_day_category_event_count'})

# ── 결과 확인 ─────────────────────────────────────────────────────
print("[saturation_index_prev (예측용, 전날 기준)]")
print(events['saturation_index_prev'].describe().round(3))

print("\n[saturation_index_30d_mean_prev (예측용, 30일 평균 기준)]")
print(events['saturation_index_30d_mean_prev'].describe().round(3))

print("\n[saturation_index_same_day_eda (EDA용, 예측 피처 금지)]")
print(events['saturation_index_same_day_eda'].describe().round(3))

print("\n[결측치 확인]")
print(events[[
    'same_day_category_event_count',
    'saturation_index_prev',
    'saturation_index_30d_mean_prev',
    'saturation_index_same_day_eda',
]].isnull().sum())

print("\n[카테고리별 saturation_index_prev 평균]")
print(
    events.groupby('category_group')['saturation_index_prev']
    .agg(['mean', 'median'])
    .sort_values('mean', ascending=False)
    .round(3)
)

