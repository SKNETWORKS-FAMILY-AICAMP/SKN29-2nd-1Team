# step1. 데이터 무결성 확인 + KR 트렌딩 데이터 기본 정제

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parents[1]))

import pandas as pd
from utils.config import RAW_PATH, CLEANED_PATH

# ── 로드 ──────────────────────────────────────────────────────────
df = pd.read_parquet(RAW_PATH)
print(f"원본 shape : {df.shape}")
print(f"중복 행    : {df.duplicated().sum()}")

# ── 0. 문자열 결측 보정 ───────────────────────────────────────────
df['title']         = df['title'].fillna('')
df['channel_title'] = df['channel_title'].fillna('')

# ── 1. datetime UTC → KST 변환 ───────────────────────────────────
df['collection_date'] = (
    pd.to_datetime(df['collection_date'], utc=True, errors='coerce')
    .dt.tz_convert('Asia/Seoul')
    .dt.tz_localize(None)
)
df['published_at'] = (
    pd.to_datetime(df['published_at'], utc=True, errors='coerce')
    .dt.tz_convert('Asia/Seoul')
    .dt.tz_localize(None)
)

# ── 2. 숫자형 변환 ───────────────────────────────────────────────
for col in ['view_count', 'comment_count', 'rank', 'category_id']:
    if col in df.columns:
        df[col] = pd.to_numeric(df[col], errors='coerce')

# ── 3. 필수값 결측 제거 ───────────────────────────────────────────
df = df.dropna(subset=[
    'video_id', 'channel_id', 'collection_date',
    'published_at', 'category_id', 'view_count', 'rank',
])
print(f"필수 결측 제거 후 : {df.shape}")

# ── 4. 비정상 수치 제거 ───────────────────────────────────────────
df = df[df['view_count'] > 0]
df = df[df['rank'].between(1, 200)]
print(f"비정상 수치 제거 후 : {df.shape}")

# ── 5. 중복 제거 (rank 오름차순 우선, view_count 내림차순) ──────────
df = (
    df.sort_values(
        ['video_id', 'collection_date', 'rank', 'view_count'],
        ascending=[True, True, True, False],
    )
    .drop_duplicates(subset=['video_id', 'collection_date'], keep='first')
)
print(f"중복 제거 후 : {df.shape}")

# ── 6. region_code 분포 확인 ─────────────────────────────────────
if 'region_code' in df.columns:
    print(f"\n[region_code 분포]\n{df['region_code'].value_counts(dropna=False)}")

# ── 7. 한국어 메타데이터 여부 (검사용) ─────────────────────────────
if 'default_language' in df.columns:
    df['has_korean_metadata'] = (
        df['title'].str.contains(r'[가-힣]', na=False)
        | df['channel_title'].str.contains(r'[가-힣]', na=False)
        | (df['default_language'].fillna('') == 'ko')
    ).astype(int)
else:
    df['has_korean_metadata'] = (
        df['title'].str.contains(r'[가-힣]', na=False)
        | df['channel_title'].str.contains(r'[가-힣]', na=False)
    ).astype(int)

print(f"\n[한국어 메타데이터 여부]\n{df['has_korean_metadata'].value_counts(dropna=False)}")

# ── 8. comment_count 결측 처리 + 음수 제거 ───────────────────────
df['comment_count_missing'] = df['comment_count'].isna().astype(int)
df['comment_count']         = df['comment_count'].fillna(0)
df = df[df['comment_count'] >= 0]
print(f"\ncomment_count 처리 후 : {df.shape}")

# ── 9. 불필요 컬럼 제거 ──────────────────────────────────────────
DROP_COLS = ['description', 'default_audio_language', 'live_broadcast_content']
df = df.drop(columns=[c for c in DROP_COLS if c in df.columns])

# ── 결과 ──────────────────────────────────────────────────────────
print(f"\n최종 shape : {df.shape}")
print(f"null 현황 :\n{df.isnull().sum().sort_values(ascending=False)}")

