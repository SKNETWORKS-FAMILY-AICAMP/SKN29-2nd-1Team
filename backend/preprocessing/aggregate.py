# =========================
# Step 5. 이벤트 단위 집계 + 기본 파생변수 생성 + 누수 점검
# =========================
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parents[1]))

import numpy as np
import pandas as pd
from utils.config import EVENT_SPLIT_PATH, VIEW_GROWTH_PATH, AGGREGATED_PATH

EVENT_KEY = ['video_id', 'event_id']

# ── 로드 & 정렬 ───────────────────────────────────────────────────
df = pd.read_parquet(EVENT_SPLIT_PATH)
df = df.sort_values(EVENT_KEY + ['collection_date']).reset_index(drop=True)

# ── 숫자형 변환 & 결측 제거 ──────────────────────────────────────
for col in ['view_count', 'comment_count', 'rank', 'category_id']:
    if col in df.columns:
        df[col] = pd.to_numeric(df[col], errors='coerce')

df = df.dropna(subset=['view_count', 'comment_count', 'rank', 'category_id'])
df['view_count']    = df['view_count'].astype(float)
df['comment_count'] = df['comment_count'].astype(float)
df['rank']          = df['rank'].astype(float)
df['category_id']   = df['category_id'].astype(int)

# ── 이벤트 내부 메타데이터 일관성 점검 ───────────────────────────
cat_consistency = df.groupby(EVENT_KEY)['category_group'].nunique()
pub_consistency = df.groupby(EVENT_KEY)['published_at'].nunique()
print(f"[이벤트 내 category_group 2개 이상] {(cat_consistency > 1).sum()}")
print(f"[이벤트 내 published_at 2개 이상]   {(pub_consistency > 1).sum()}")

# ── 이벤트 단위 집계 ──────────────────────────────────────────────
events = (
    df.groupby(EVENT_KEY)
    .agg(
        # 시간
        T0            = ('collection_date', 'min'),
        T_end         = ('collection_date', 'max'),
        n_snapshots   = ('collection_date', 'count'),
        # 영상/채널
        channel_id    = ('channel_id',    'first'),
        channel_title = ('channel_title', 'first'),
        title         = ('title',         'first'),
        published_at  = ('published_at',  'first'),
        # 카테고리
        category_id   = ('category_id',   'first'),
        category_group= ('category_group','first'),
        # T0 예측 가능 변수 ← 모델 입력 가능
        entry_rank    = ('rank',          'first'),
        T0_view       = ('view_count',    'first'),
        T0_comment    = ('comment_count', 'first'),
        # 사후 정보 ← 분석용만, 예측 피처 사용 금지
        best_rank     = ('rank',          'min'),
        peak_view     = ('view_count',    'max'),
        T_end_view    = ('view_count',    'last'),
        T_end_comment = ('comment_count', 'last'),
    )
    .reset_index()
)

# ── 지속 시간 타깃 생성 ───────────────────────────────────────────
events['trending_duration_h_raw'] = (
    events['T_end'] - events['T0']
).dt.total_seconds() / 3600

events['is_single_snapshot']  = (events['trending_duration_h_raw'] == 0).astype(int)
events['trending_duration_h'] = events['trending_duration_h_raw'].clip(lower=6)
events['trending_duration_log'] = np.log1p(events['trending_duration_h'])

# ── 사후 정보 이상값 확인 ──────────────────────────────────────────
print(f"\n[T_end_view < T0_view 이벤트 수]      {(events['T_end_view'] < events['T0_view']).sum()}")
print(f"[T_end_comment < T0_comment 이벤트 수] {(events['T_end_comment'] < events['T0_comment']).sum()}")
print(f"[best_rank > entry_rank 이벤트 수]     {(events['best_rank'] > events['entry_rank']).sum()}")

# ── Step 4 view_growth_24h 병합 ───────────────────────────────────
view_growth = pd.read_parquet(VIEW_GROWTH_PATH)
vg_cols = [
    c for c in [
        'video_id', 'event_id',
        'view_at_24h', 'view_growth_24h', 'view_growth_24h_log',
        'has_24h_observation', 'has_exact_24h_snapshot',
        'actual_time_at_24h', 'actual_gap_to_24h',
    ] if c in view_growth.columns
]
events = events.merge(view_growth[vg_cols], on=EVENT_KEY, how='left')
print("\n[view_growth 병합 완료]")

# ── 결과 확인 ─────────────────────────────────────────────────────
print(f"\n[events shape] {events.shape}")
print(f"\n[trending_duration_h 요약]\n{events['trending_duration_h'].describe().round(1)}")
print(f"\n[n_snapshots 요약]\n{events['n_snapshots'].describe().round(1)}")
print(f"\n[단일 스냅샷 이벤트 수]\n{events['is_single_snapshot'].value_counts()}")
print(f"\n[카테고리별 이벤트 수]\n{events['category_group'].value_counts()}")
print(f"\n[결측치 상위]\n{events.isnull().sum().sort_values(ascending=False).head(10)}")

