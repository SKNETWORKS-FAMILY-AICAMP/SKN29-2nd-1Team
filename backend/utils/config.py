"""
config.py
─────────
경로 및 하이퍼파라미터 상수 관리
팀원마다 경로가 다를 경우 환경변수 BACKEND_DATA_DIR 로 덮어씀.
"""

import os
from pathlib import Path

# ── 루트 경로 ─────────────────────────────────────────────────────
# 환경변수로 override 가능: BACKEND_DATA_DIR=/absolute/path/to/data
BASE_DIR = Path(__file__).resolve().parents[1]  # backend/
DATA_DIR = Path(os.getenv("BACKEND_DATA_DIR", str(BASE_DIR / "data")))

# ── 입출력 경로 ───────────────────────────────────────────────────
RAW_PATH                  = DATA_DIR / "youtube_trends_KR.parquet"

CLEANED_PATH              = DATA_DIR / "cleaned_KR.parquet"
CATEGORIZED_PATH          = DATA_DIR / "categorized_KR.parquet"
EVENT_SPLIT_PATH          = DATA_DIR / "event_split_KR.parquet"
VIEW_GROWTH_PATH          = DATA_DIR / "view_growth_KR.parquet"
AGGREGATED_PATH           = DATA_DIR / "aggregated_KR.parquet"
FEATURES_PATH             = DATA_DIR / "features_KR.parquet"
TARGET_PATH               = DATA_DIR / "target_KR.parquet"
SATURATION_PATH           = DATA_DIR / "saturation_KR.parquet"

ANALYSIS_PATH             = DATA_DIR / "video_trending_events_analysis.parquet"
T0_MODEL_PATH             = DATA_DIR / "video_trending_events_T0_model.parquet"
MODEL_24H_PATH            = DATA_DIR / "video_trending_events_24h_model.parquet"
TRENDING_SNAPSHOTS_PATH   = DATA_DIR / "trending_snapshots.parquet"
CATEGORY_SATURATION_PATH  = DATA_DIR / "category_saturation.parquet"

# ── 전처리 하이퍼파라미터 ─────────────────────────────────────────
EVENT_GAP_HOURS    = 6      # 재진입 이벤트 분리 기준 (시간)
MIN_DURATION_H     = 6      # 최소 트렌딩 지속 시간 (시간)
TDI_THRESHOLD      = 0.4    # tdi_label 분류 임계값
