"""
constants.py
────────────
카테고리 매핑 및 피처 리스트 상수 관리
"""

# ── YouTube category_id → 5그룹 매핑 ─────────────────────────────
CATEGORY_MAP: dict[int, str] = {
    # Entertainment
    24: "Entertainment",   # Entertainment
    17: "Entertainment",   # Sports
    20: "Entertainment",   # Gaming
     1: "Entertainment",   # Film & Animation
    23: "Entertainment",   # Comedy
    # Music
    10: "Music",
    # Lifestyle
    19: "Lifestyle",       # Travel & Events
    15: "Lifestyle",       # Pets & Animals
     2: "Lifestyle",       # Autos & Vehicles
    22: "Lifestyle",       # People & Blogs
    26: "Lifestyle",       # Howto & Style
    # Education
    27: "Education",       # Education
    28: "Education",       # Science & Technology
    # News
    25: "News",            # News & Politics
    29: "News",            # Nonprofits & Activism
}

# ── YouTube category_id → 전체 이름 ──────────────────────────────
CATEGORY_NAME_MAP: dict[int, str] = {
     1: "Film & Animation",
     2: "Autos & Vehicles",
    10: "Music",
    15: "Pets & Animals",
    17: "Sports",
    19: "Travel & Events",
    20: "Gaming",
    22: "People & Blogs",
    23: "Comedy",
    24: "Entertainment",
    25: "News & Politics",
    26: "Howto & Style",
    27: "Education",
    28: "Science & Technology",
    29: "Nonprofits & Activism",
}

# ── T0 모델 피처 (트렌딩 진입 시점에 알 수 있는 변수만) ──────────
FEATURES_T0: list[str] = [
    "category_group",
    "entry_rank_log",
    "T0_view_log",
    "T0_comment_log",
    "T0_engagement_ratio_log",
    "latency_to_trend_log",
    "pretrend_view_velocity_log",
    "published_weekday",
    "hour_sin",
    "hour_cos",
    "saturation_index_30d_mean_prev",
]

# ── 24h 모델 피처 (has_24h_observation == True 이벤트만) ──────────
FEATURES_24H: list[str] = FEATURES_T0 + ["view_growth_24h_log"]

# ── 타깃 변수 ────────────────────────────────────────────────────
TARGET_REG          = "trending_duration_h"       # 회귀
TARGET_REG_LOG      = "trending_duration_log"     # 로그 회귀
TARGET_CLF_GLOBAL   = "long_label_global_q75"     # 분류 메인
TARGET_CLF_CAT      = "long_label_cat_q75"        # 카테고리 보정 분류
TARGET_CLF_48H      = "long_label_48h"            # 고정 기준 분류
TARGET_CLF_TDI      = "tdi_label"                 # TDI 보조 분류

# ── 예측 피처 사용 금지 목록 ─────────────────────────────────────
FORBIDDEN_FEATURES: list[str] = [
    "video_id", "event_id",
    "T0", "T_end",
    "trending_duration_h", "trending_duration_h_raw", "trending_duration_log",
    "trending_duration_h_wins_eda",
    "n_snapshots", "is_single_snapshot",
    "has_24h_observation", "has_exact_24h_snapshot",
    "actual_time_at_24h", "actual_gap_to_24h",
    "best_rank", "peak_view", "T_end_view", "T_end_comment",
    "observed_view_velocity", "observed_comment_growth",
    "view_at_24h", "view_growth_24h", "view_growth_24h_log",
    "saturation_index_same_day_eda",
    "same_day_category_event_count",
]
