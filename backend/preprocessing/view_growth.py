# =========================
# Step 4. view_growth_24h 생성 + EDA + 시각화
# =========================
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parents[1]))

import numpy as np
import pandas as pd
from utils.config import EVENT_SPLIT_PATH, VIEW_GROWTH_PATH

# ── 로드 & 정렬 ───────────────────────────────────────────────────
df = pd.read_parquet(EVENT_SPLIT_PATH)
EVENT_KEY = ['video_id', 'event_id']
df = df.sort_values(EVENT_KEY + ['collection_date'])

# ── 1. 이벤트별 기본 시간 정보 ────────────────────────────────────
event_time = (
    df.groupby(EVENT_KEY)
    .agg(
        T0_time    = ('collection_date', 'min'),
        T_end_time = ('collection_date', 'max'),
        T0_view    = ('view_count',      'first'),
        n_snapshots= ('collection_date', 'count'),
    )
    .reset_index()
)

event_time['target_time_24h']    = event_time['T0_time'] + pd.Timedelta(hours=24)
event_time['has_24h_observation'] = event_time['T_end_time'] >= event_time['target_time_24h']

print("[24시간 이상 관측 이벤트 여부]")
print(event_time['has_24h_observation'].value_counts(dropna=False))
print(event_time['has_24h_observation'].value_counts(normalize=True, dropna=False).round(4))

# ── 2. T0 ~ T0+24h 구간 스냅샷 추출 ──────────────────────────────
df_tmp = df.merge(
    event_time[EVENT_KEY + ['T0_time', 'target_time_24h', 'has_24h_observation']],
    on=EVENT_KEY, how='left',
)

df_24h = df_tmp[
    (df_tmp['collection_date'] >= df_tmp['T0_time']) &
    (df_tmp['collection_date'] <= df_tmp['target_time_24h'])
].sort_values(EVENT_KEY + ['collection_date'])

# ── 3. 24시간 시점 조회수 추출 ────────────────────────────────────
view_at_24h = (
    df_24h.groupby(EVENT_KEY)
    .agg(
        view_at_24h        = ('view_count',      'last'),
        actual_time_at_24h = ('collection_date', 'last'),
    )
    .reset_index()
)

# ── 4. view_growth_24h 계산 ───────────────────────────────────────
view_growth = event_time.merge(view_at_24h, on=EVENT_KEY, how='left')

view_growth['raw_view_growth_24h'] = view_growth['view_at_24h'] - view_growth['T0_view']

print(f"\n[raw growth 음수 개수] {(view_growth['raw_view_growth_24h'] < 0).sum()}")

# 24시간 이상 관측 이벤트만 인정, 음수 성장량 0 보정
view_growth['view_growth_24h'] = np.where(
    view_growth['has_24h_observation'],
    view_growth['raw_view_growth_24h'].clip(lower=0),
    np.nan,
)
view_growth['view_growth_24h_log'] = np.log1p(view_growth['view_growth_24h'])

# 실제 사용 스냅샷 vs T0+24h 시간 차이
view_growth['actual_gap_to_24h'] = (
    view_growth['target_time_24h'] - view_growth['actual_time_at_24h']
).dt.total_seconds() / 3600

view_growth['has_exact_24h_snapshot'] = view_growth['actual_gap_to_24h'].abs() < 1e-9

# ── 5. 요약 확인 ──────────────────────────────────────────────────
print("\n[전체 이벤트 수]", len(view_growth))

print("\n[정확히 T0+24h 스냅샷 존재 여부 - 24h 관측 이벤트만]")
mask = view_growth['has_24h_observation']
print(view_growth.loc[mask, 'has_exact_24h_snapshot'].value_counts(normalize=True).round(4))

print("\n[view_growth_24h 요약: 24h 관측 이벤트만]")
print(view_growth.loc[mask, 'view_growth_24h'].describe())

print("\n[음수 growth 이벤트 수]", (view_growth['raw_view_growth_24h'] < 0).sum())
