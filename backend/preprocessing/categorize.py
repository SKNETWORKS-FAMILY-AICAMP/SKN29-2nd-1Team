# =========================
# Step 2. 카테고리 정규화 (5그룹)
# =========================

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parents[1]))

import pandas as pd
from utils.config import CLEANED_PATH, CATEGORIZED_PATH
from utils.constants import CATEGORY_MAP

# ── 로드 ──────────────────────────────────────────────────────────
df = pd.read_parquet(CLEANED_PATH)

# ── 1. category_id 정수형 변환 ────────────────────────────────────
df['category_id'] = df['category_id'].astype(int)

# ── 2. 카테고리 그룹 매핑 ─────────────────────────────────────────
df['category_group'] = df['category_id'].map(CATEGORY_MAP).fillna('Other')

# ── 3. 분포 확인 ──────────────────────────────────────────────────
print("[category_id 분포]")
print(df['category_id'].value_counts(dropna=False).sort_index())

print("\n[category_group 분포: row 기준]")
print(df['category_group'].value_counts(dropna=False))

print("\n[category_group 비율]")
print(df['category_group'].value_counts(normalize=True, dropna=False).round(4))

print("\n[Other에 포함된 category_id]")
print(df.loc[df['category_group'] == 'Other', 'category_id'].value_counts(dropna=False))

# ── 4. 스냅샷 단위 요약 ───────────────────────────────────────────
cat_summary = (
    df.groupby('category_group')
    .agg(
        n_rows     = ('video_id', 'size'),
        n_videos   = ('video_id', 'nunique'),
        n_channels = ('channel_id', 'nunique'),
    )
    .sort_values('n_rows', ascending=False)
)
cat_summary['row_ratio']   = (cat_summary['n_rows']   / len(df)).round(4)
cat_summary['video_ratio'] = (cat_summary['n_videos'] / df['video_id'].nunique()).round(4)

print(f"\n[category_group 요약: snapshot 기준]\n{cat_summary}")

