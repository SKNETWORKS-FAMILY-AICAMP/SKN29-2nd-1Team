# =========================
# Step 3. 재진입 이벤트 분리
# =========================
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parents[1]))

import pandas as pd
from utils.config import CATEGORIZED_PATH, EVENT_SPLIT_PATH

# ── 로드 & 정렬 ───────────────────────────────────────────────────
df = pd.read_parquet(CATEGORIZED_PATH)
df = df.sort_values(['video_id', 'collection_date']).reset_index(drop=True)

# ── 1. 스냅샷 간 시간 간격 계산 ──────────────────────────────────
df['time_gap_h'] = (
    df.groupby('video_id')['collection_date']
    .diff()
    .dt.total_seconds() / 3600
).round(3)

# ── 2. 새 이벤트 여부 ─────────────────────────────────────────────
# 첫 관측치(NaN) 또는 6시간 초과 공백
df['new_event'] = df['time_gap_h'].isna() | (df['time_gap_h'] > 6)

# ── 3. video_id별 event_id 생성 ───────────────────────────────────
df['event_id'] = df.groupby('video_id')['new_event'].cumsum().astype(int)

# ── 4. 결과 확인 ──────────────────────────────────────────────────
total_events   = df.groupby(['video_id', 'event_id']).ngroups
reentry_videos = (df.groupby('video_id')['event_id'].max() > 1).sum()

print(f"전체 행 수      : {df.shape[0]:,}")
print(f"고유 video 수   : {df['video_id'].nunique():,}")
print(f"고유 event 수   : {total_events:,}")
print(f"재진입 영상 수  : {reentry_videos:,}")

print(f"\n[time_gap_h 요약]\n{df['time_gap_h'].describe()}")
print(f"\n[6시간 초과 공백 수] {(df['time_gap_h'] > 6).sum()}")

print("\n[video_id별 이벤트 수 분포]")
print(df.groupby('video_id')['event_id'].max().value_counts().sort_index())

event_size = (
    df.groupby(['video_id', 'event_id'])
    .size()
    .reset_index(name='n_snapshots')
)
print(f"\n[이벤트별 스냅샷 수 요약]\n{event_size['n_snapshots'].describe()}")
