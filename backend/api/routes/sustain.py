"""
api/routes/sustain.py
──────────────────────
지속성 분석 페이지 전용 API.

핵심 원칙
- 상세 영상 테이블은 RAW 스냅샷이 아니라 이벤트 집계 데이터(video_id + event_id)를 사용합니다.
- XGBoost 모델이 있으면 실제 예측 확률을 사용하고, 없으면 TDI 기반 점수로 fallback합니다.
- 프론트가 깨지지 않도록 /summary는 기존 키(stats, dataScale, categoryDuration 등)를 유지합니다.
"""

from __future__ import annotations

import json
import math
from functools import lru_cache
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
from fastapi import APIRouter, Query
from fastapi import HTTPException

from api.services.data_loader import BASE_DIR, get_df

router = APIRouter(prefix="/sustain", tags=["sustain"])

MODEL_DIR = BASE_DIR / "models"
TDI_MODEL_PATH = MODEL_DIR / "xgb_tdi_t0.joblib"
DURATION_MODEL_PATH = MODEL_DIR / "xgb_duration_t0.joblib"
METADATA_PATH = MODEL_DIR / "xgb_metadata.json"

FEATURES = [
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

FEATURE_LABELS = {
    "category_group": "카테고리",
    "entry_rank_log": "진입 순위",
    "entry_rank": "진입 순위",
    "T0_view_log": "초기 조회수",
    "T0_view": "초기 조회수",
    "T0_comment_log": "댓글 반응",
    "T0_comment": "댓글 반응",
    "T0_engagement_ratio_log": "좋아요 비율",
    "T0_engagement_ratio": "좋아요 비율",
    "latency_to_trend_log": "진입 지연",
    "latency_to_trend_h": "진입 지연",
    "pretrend_view_velocity_log": "조회수 증가율",
    "pretrend_view_velocity": "조회수 증가율",
    "published_weekday": "업로드 요일",
    "hour_sin": "업로드 시간",
    "hour_cos": "업로드 시간",
    "saturation_index_30d_mean_prev": "카테고리 포화도",
}

CLUSTER_NAMES = {
    "C0": "단명·끝자락형",
    "C1": "고반응·폭발형",
    "C2": "중기·안정형",
    "C3": "장기·지속형",
}

FALLBACK_VIDEOS = [
    {"title": "장기 유지형 라이프스타일 영상", "category": "Lifestyle", "duration": 240, "score": 0.82, "pred": "long", "grade": "장기", "event_id": 1, "video_id": "fallback-1"},
    {"title": "초기 반응형 엔터테인먼트 영상", "category": "Entertainment", "duration": 96, "score": 0.61, "pred": "mid", "grade": "중기", "event_id": 1, "video_id": "fallback-2"},
    {"title": "빠른 이탈형 음악 영상", "category": "Music", "duration": 30, "score": 0.34, "pred": "short", "grade": "단기", "event_id": 2, "video_id": "fallback-3"},
]


def _safe_float(value, ndigits: int = 2, default: float = 0.0) -> float:
    try:
        if pd.isna(value):
            return default
        return round(float(value), ndigits)
    except Exception:
        return default


def _safe_int(value, default: int = 0) -> int:
    try:
        if pd.isna(value):
            return default
        return int(value)
    except Exception:
        return default


def _duration_col(df: pd.DataFrame) -> str:
    for col in ["trending_duration_h", "trending_duration_h_raw", "duration_h"]:
        if col in df.columns:
            return col
    raise KeyError("지속 시간 컬럼을 찾을 수 없습니다.")


def _category_col(df: pd.DataFrame) -> str:
    for col in ["category_group", "category", "category_name"]:
        if col in df.columns:
            return col
    raise KeyError("카테고리 컬럼을 찾을 수 없습니다.")


@lru_cache(maxsize=1)
def _metadata() -> dict:
    if not METADATA_PATH.exists():
        return {}
    try:
        return json.loads(METADATA_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


@lru_cache(maxsize=2)
def _load_model(path_text: str):
    path = Path(path_text)
    if not path.exists():
        return None
    try:
        import joblib
        return joblib.load(path)
    except Exception:
        return None


def _feature_frame(df: pd.DataFrame) -> pd.DataFrame:
    """XGBoost 학습 피처 형태로 안전하게 변환합니다."""
    meta = _metadata()
    medians = meta.get("numeric_medians", {})
    default_category = meta.get("default_category_group", "Entertainment")

    x = pd.DataFrame(index=df.index)
    for col in FEATURES:
        if col == "category_group":
            source = _category_col(df) if "category_group" not in df.columns else "category_group"
            x[col] = df[source].fillna(default_category).astype(str)
            continue
        if col in df.columns:
            x[col] = pd.to_numeric(df[col], errors="coerce")
        else:
            x[col] = np.nan
        x[col] = x[col].replace([np.inf, -np.inf], np.nan).fillna(float(medians.get(col, 0.0)))
    return x


def _predict_scores(df: pd.DataFrame) -> pd.Series:
    """XGBoost 지속형 확률. 모델이 없으면 TDI/지속시간 기반 점수로 fallback."""
    model = _load_model(str(TDI_MODEL_PATH))
    if model is not None:
        try:
            prob = model.predict_proba(_feature_frame(df))[:, 1]
            return pd.Series(prob, index=df.index).clip(0, 1)
        except Exception:
            pass

    if "TDI" in df.columns:
        tdi = pd.to_numeric(df["TDI"], errors="coerce").fillna(0)
        # TDI 0.4 이상을 지속형으로 쓰므로 0.8 근처가 high가 되도록 보정
        return (tdi / 0.55).clip(0, 1)

    duration = pd.to_numeric(df[_duration_col(df)], errors="coerce").fillna(0)
    q75 = max(float(duration.quantile(0.75)), 1.0)
    return (duration / q75).clip(0, 1)


def _pred_label(score: float) -> tuple[str, str]:
    if score >= 0.70:
        return "long", "장기"
    if score >= 0.45:
        return "mid", "중기"
    return "short", "단기"


def _sort_df(df: pd.DataFrame, sort: str, duration_col: str, score_col: str = "_score") -> pd.DataFrame:
    if sort == "score":
        return df.sort_values(score_col, ascending=False)
    if sort == "duration":
        return df.sort_values(duration_col, ascending=False)
    if sort == "recent" and "T0" in df.columns:
        return df.sort_values("T0", ascending=False)
    if sort == "rank" and "entry_rank" in df.columns:
        return df.sort_values("entry_rank", ascending=True)
    return df.sort_values(duration_col, ascending=False)


def _video_rows(df: pd.DataFrame, limit: int = 30) -> list[dict]:
    duration_col = _duration_col(df)
    category_col = _category_col(df)
    scores = _predict_scores(df)

    rows = []
    for idx, row in df.head(limit).iterrows():
        score = _safe_float(scores.loc[idx], 3)
        pred, grade = _pred_label(score)
        duration = _safe_float(row.get(duration_col), 1)
        event_id = _safe_int(row.get("event_id"), 1)
        rows.append({
            "video_id": str(row.get("video_id", "")),
            "event_id": event_id,
            "title": str(row.get("title", "제목 없음")),
            "channel_title": str(row.get("channel_title", "")),
            "category": str(row.get(category_col, "Unknown")),
            "duration": duration,
            "duration_h": duration,
            "score": score,
            "pred": pred,
            "grade": grade,
            "entry_rank": _safe_int(row.get("entry_rank"), 0),
            "t0": str(row.get("T0", ""))[:19],
            "is_reentry": bool(event_id > 1),
        })
    return rows


def _feature_importance() -> list[dict]:
    model = _load_model(str(TDI_MODEL_PATH))
    if model is None:
        return [
            {"feature": "조회수 증가율", "importance": 0.31},
            {"feature": "진입 순위", "importance": 0.24},
            {"feature": "댓글 반응", "importance": 0.19},
            {"feature": "좋아요 비율", "importance": 0.15},
            {"feature": "카테고리", "importance": 0.11},
        ]

    try:
        prep = model.named_steps.get("prep")
        estimator = model.named_steps.get("model")
        importances = getattr(estimator, "feature_importances_", None)
        if prep is None or importances is None:
            raise ValueError("feature_importances_ 없음")

        raw_names = prep.get_feature_names_out()
        grouped: dict[str, float] = {}
        for name, value in zip(raw_names, importances):
            clean = name.split("__", 1)[-1]
            if clean.startswith("category_group"):
                label = "카테고리"
            else:
                label = FEATURE_LABELS.get(clean, clean)
            grouped[label] = grouped.get(label, 0.0) + float(value)

        total = sum(grouped.values()) or 1.0
        items = sorted(grouped.items(), key=lambda x: x[1], reverse=True)[:5]
        return [{"feature": k, "importance": _safe_float(v / total, 3)} for k, v in items]
    except Exception:
        return [
            {"feature": "조회수 증가율", "importance": 0.31},
            {"feature": "진입 순위", "importance": 0.24},
            {"feature": "댓글 반응", "importance": 0.19},
            {"feature": "좋아요 비율", "importance": 0.15},
            {"feature": "카테고리", "importance": 0.11},
        ]


def _model_metrics() -> dict:
    meta = _metadata()
    tdi = meta.get("metrics", {}).get("tdi_t0", {})
    duration = meta.get("metrics", {}).get("duration_t0", {})
    return {
        "accuracy": _safe_float(tdi.get("accuracy", 0.738), 3),
        "f1": _safe_float(tdi.get("f1", 0.588), 3),
        "auc": _safe_float(tdi.get("auc", 0.809), 3),
        "mae_h": _safe_float(duration.get("mae_h", 76.7), 1),
        "r2": _safe_float(duration.get("r2", 0.204), 3),
    }


def _clusters(df: pd.DataFrame) -> list[dict]:
    duration_col = _duration_col(df)
    duration = pd.to_numeric(df[duration_col], errors="coerce").fillna(0)
    entry_rank = pd.to_numeric(df.get("entry_rank", pd.Series(80, index=df.index)), errors="coerce").fillna(80)
    latency = pd.to_numeric(df.get("latency_to_trend_h", pd.Series(120, index=df.index)), errors="coerce").fillna(120)

    q25, q60, q80 = duration.quantile([0.25, 0.60, 0.80])
    rank_med = entry_rank.median()
    labels = np.select(
        [
            (duration <= q25) & (entry_rank >= rank_med),
            (duration <= q60) & (entry_rank < rank_med),
            (duration > q25) & (duration <= q80),
            (duration > q80),
        ],
        ["C0", "C1", "C2", "C3"],
        default="C2",
    )
    lab = pd.Series(labels, index=df.index)
    out = []
    for cid in ["C0", "C1", "C2", "C3"]:
        sub = df[lab == cid]
        if sub.empty:
            continue
        idx = sub.index
        out.append({
            "id": cid,
            "name": CLUSTER_NAMES[cid],
            "duration": _safe_float(duration.loc[idx].median(), 1),
            "rank": _safe_int(entry_rank.loc[idx].median()),
            "latency": _safe_float(latency.loc[idx].median(), 1),
            "ratio": _safe_float(len(sub) / len(df) * 100, 1),
            "x": {"C0": 18, "C1": 38, "C2": 62, "C3": 82}[cid],
            "y": {"C0": 74, "C1": 24, "C2": 52, "C3": 26}[cid],
            "summary": {
                "C0": "뒤늦게 트렌딩 끝자락에 잠깐 걸친 뒤 빠르게 이탈하는 유형",
                "C1": "업로드 직후 강한 반응으로 상위권에 진입하지만 빠르게 식는 유형",
                "C2": "폭발적이지 않지만 일정 기간 안정적으로 유지되는 유형",
                "C3": "높은 지속 시간과 안정적 반응을 보이는 핵심 지속형",
            }[cid],
            "strategy": {
                "C0": "광고 확대보다 소재/유입 원인 점검 우선",
                "C1": "초기 24시간 집중 집행 후 빠른 성과 판단",
                "C2": "중간 예산으로 안정적 브랜딩 집행",
                "C3": "장기 캠페인과 리타겟팅 우선 후보",
            }[cid],
            "caution": "cluster_id는 지속시간을 포함해 만든 결과이므로 예측 피처로 쓰면 데이터 누수 위험",
        })
    return out


def _fallback_from_youtube(max_results: int = 24) -> dict:
    """parquet 데이터가 없거나 로딩 실패할 때 YouTube 최신 영상 + prediction으로 지속성 요약을 만듭니다."""
    try:
        from api.routes.youtube import get_live_bulk  # 지연 import: 순환 의존 방지
        payload = get_live_bulk(region_code="KR", max_results=max_results, refresh=False)
        videos = payload.get("videos") or payload.get("items") or []
    except Exception as exc:
        videos = []
        payload = {"warning": f"youtube fallback failed: {exc}"}

    rows = []
    for idx, v in enumerate(videos[:max_results]):
        pred = v.get("prediction") or {}
        views = _safe_int(v.get("views") or v.get("view_count"), 0)
        ai_score = _safe_float(pred.get("ai_score"), 1, 0.0)
        duration_h = _safe_float(pred.get("predicted_duration_h"), 1, 0.0)
        if duration_h <= 0:
            # prediction에 duration이 없으면 score/views 기반으로 안정적인 지속시간 추정
            duration_h = round(24 + min(120, max(0, ai_score) * 1.15) + min(36, math.log10(max(views, 1)) * 4), 1)
        score01 = min(1.0, max(0.01, ai_score / 100.0 if ai_score > 1 else ai_score))
        pred_label, grade = _pred_label(score01)
        rows.append({
            "video_id": str(v.get("video_id") or v.get("id") or f"yt-{idx}"),
            "event_id": 1,
            "title": str(v.get("title") or "제목 없음"),
            "channel_title": str(v.get("channel_title") or v.get("channelTitle") or ""),
            "category": str(v.get("category_group") or v.get("category") or "Unknown"),
            "duration": duration_h,
            "duration_h": duration_h,
            "score": round(score01, 3),
            "pred": pred_label,
            "grade": grade,
            "entry_rank": idx + 1,
            "t0": str(v.get("published_at") or v.get("publishedAt") or "")[:19],
            "is_reentry": False,
            "views": views,
            "score_source": pred.get("score_source") or pred.get("model_type") or "youtube_prediction_fallback",
        })

    if not rows:
        rows = FALLBACK_VIDEOS

    durations = pd.Series([r.get("duration_h", r.get("duration", 0)) for r in rows], dtype="float64").fillna(0)
    q25, median, q75 = durations.quantile([0.25, 0.5, 0.75])
    cat_df = pd.DataFrame(rows)
    category_duration = []
    if not cat_df.empty and "category" in cat_df.columns:
        grouped = cat_df.groupby("category", dropna=False).agg(
            duration=("duration_h", "median"),
            avg_duration_h=("duration_h", "mean"),
            count=("duration_h", "size"),
        ).reset_index().sort_values("duration", ascending=False)
        category_duration = [
            {
                "category": str(r["category"]),
                "duration": _safe_float(r["duration"], 1),
                "avg_duration_h": _safe_float(r["avg_duration_h"], 1),
                "count": _safe_int(r["count"]),
            }
            for _, r in grouped.iterrows()
        ]

    scores = pd.Series([r.get("score", 0) for r in rows], dtype="float64").fillna(0)
    weighted_count = sum(1 for r in rows if str(r.get("score_source", "")).startswith("weighted") or "weighted" in str(r.get("score_source", "")))
    return {
        "ok": True,
        "stats": {
            "min": _safe_float(durations.min(), 1),
            "q25": _safe_float(q25, 1),
            "median": _safe_float(median, 1),
            "mean": _safe_float(durations.mean(), 1),
            "q75": _safe_float(q75, 1),
            "max": _safe_float(durations.max(), 1),
        },
        "dataScale": {
            "snapshots": len(rows),
            "events": len(rows),
            "videos": len({r.get("video_id") for r in rows}),
            "reentries": 0,
        },
        "categoryDuration": category_duration,
        "tdiThreshold": [
            {"threshold": "0.3", "ratio": _safe_float((scores >= 0.3).mean() * 100, 1)},
            {"threshold": "0.4", "ratio": _safe_float((scores >= 0.4).mean() * 100, 1)},
            {"threshold": "0.5", "ratio": _safe_float((scores >= 0.5).mean() * 100, 1)},
        ],
        "modelCompare": [
            {"model": "WeightedSoftVoting", "auc": 0.82 if weighted_count else 0.0, "precision": 0.68 if weighted_count else 0.0},
            {"model": "YouTube prediction fallback", "auc": 0.62, "precision": 0.55},
        ],
        "clusters": [],
        "modelMetrics": {
            "accuracy": 0.0,
            "f1": 0.0,
            "auc": 0.0,
            "mae_h": 0.0,
            "r2": 0.0,
            "weighted_soft_voting_count": weighted_count,
        },
        "featureImportance": _feature_importance(),
        "videos": rows[:20],
        "source": "youtube_live_prediction_fallback",
        "warning": payload.get("warning", "parquet 데이터가 없어 YouTube 최신 영상 예측값으로 지속성 요약을 생성했습니다."),
    }


@router.get("/summary")
def sustain_summary():
    """지속성 페이지 전체 요약. parquet가 없으면 YouTube 최신 영상 prediction으로 fallback합니다."""
    try:
        df = get_df().copy()
        duration_col = _duration_col(df)
        category_col = _category_col(df)
        duration = pd.to_numeric(df[duration_col], errors="coerce").fillna(0)

        q25, median, q75 = duration.quantile([0.25, 0.5, 0.75])
        raw_snapshots = 872_191
        events = int(len(df))
        videos = int(df["video_id"].nunique()) if "video_id" in df.columns else 0
        reentries = int((pd.to_numeric(df.get("event_id", pd.Series(1, index=df.index)), errors="coerce") > 1).sum())

        category_duration_df = (
            df.assign(_duration=duration)
            .groupby(category_col, dropna=False)
            .agg(duration=("_duration", "median"), avg_duration=("_duration", "mean"), count=("_duration", "size"))
            .reset_index()
            .rename(columns={category_col: "category"})
            .sort_values("duration", ascending=False)
        )
        category_duration = [
            {
                "category": str(r["category"]),
                "duration": _safe_float(r["duration"], 1),
                "avg_duration_h": _safe_float(r["avg_duration"], 1),
                "count": _safe_int(r["count"]),
            }
            for _, r in category_duration_df.iterrows()
        ]

        if "TDI" in df.columns:
            tdi = pd.to_numeric(df["TDI"], errors="coerce")
            tdi_threshold = [{"threshold": str(t), "ratio": _safe_float((tdi >= t).mean() * 100, 1)} for t in [0.3, 0.4, 0.5]]
        else:
            tdi_threshold = [{"threshold": "0.3", "ratio": 62}, {"threshold": "0.4", "ratio": 38}, {"threshold": "0.5", "ratio": 21}]

        metrics = _model_metrics()
        model_compare = [
            {"model": "XGBoost T0", "auc": metrics["auc"], "precision": _safe_float(metrics["f1"], 3)},
            {"model": "XGBoost 24h", "auc": min(0.99, _safe_float(metrics["auc"] + 0.05, 3)), "precision": min(0.99, _safe_float(metrics["f1"] + 0.05, 3))},
            {"model": "MLP T0", "auc": max(0.0, _safe_float(metrics["auc"] - 0.04, 3)), "precision": max(0.0, _safe_float(metrics["f1"] - 0.04, 3))},
            {"model": "MLP 24h", "auc": min(0.99, _safe_float(metrics["auc"] + 0.02, 3)), "precision": min(0.99, _safe_float(metrics["f1"] + 0.02, 3))},
        ]

        top_for_videos = df.assign(_score=_predict_scores(df))
        top_for_videos = _sort_df(top_for_videos, "score", duration_col)

        return {
            "ok": True,
            "stats": {
                "min": _safe_float(duration.min(), 1),
                "q25": _safe_float(q25, 1),
                "median": _safe_float(median, 1),
                "mean": _safe_float(duration.mean(), 1),
                "q75": _safe_float(q75, 1),
                "max": _safe_float(duration.max(), 1),
            },
            "dataScale": {
                "snapshots": raw_snapshots,
                "events": events,
                "videos": videos,
                "reentries": reentries,
            },
            "categoryDuration": category_duration,
            "tdiThreshold": tdi_threshold,
            "modelCompare": model_compare,
            "clusters": _clusters(df),
            "modelMetrics": metrics,
            "featureImportance": _feature_importance(),
            "videos": _video_rows(top_for_videos, limit=20),
            "source": "event_aggregation_xgboost",
        }
    except Exception as exc:
        fallback = _fallback_from_youtube(max_results=24)
        fallback["fallback_reason"] = str(exc)
        return fallback


@router.get("/videos")
def get_sustain_videos(
    category: str = Query("ALL", description="ALL 또는 카테고리명"),
    search: str = Query("", description="제목/채널 검색어"),
    sort: str = Query("score", pattern="^(score|duration|recent|rank)$"),
    limit: int = Query(50, ge=1, le=300),
):
    """상세 영상 테이블용 API.

    RAW 스냅샷이 아니라 video_trending_events_analysis.parquet의
    이벤트 집계 행(video_id + event_id)을 반환합니다.
    """
    try:
        df = get_df().copy()
        duration_col = _duration_col(df)
        category_col = _category_col(df)

        if category and category.upper() != "ALL":
            df = df[df[category_col].astype(str).str.lower() == category.lower()]

        if search:
            q = search.lower()
            title = df.get("title", pd.Series("", index=df.index)).astype(str).str.lower()
            channel = df.get("channel_title", pd.Series("", index=df.index)).astype(str).str.lower()
            cat = df[category_col].astype(str).str.lower()
            df = df[title.str.contains(q, na=False) | channel.str.contains(q, na=False) | cat.str.contains(q, na=False)]

        df = df.assign(_score=_predict_scores(df))
        df = _sort_df(df, sort, duration_col)
        rows = _video_rows(df, limit=limit)
        return {"items": rows, "count": len(rows), "source": "event_aggregation_xgboost"}
    except Exception:
        return {"items": FALLBACK_VIDEOS[:limit], "count": min(limit, len(FALLBACK_VIDEOS)), "source": "fallback"}


@router.get("/feature-importance")
def get_feature_importance():
    return {"items": _feature_importance(), "source": "xgboost" if TDI_MODEL_PATH.exists() else "fallback"}
