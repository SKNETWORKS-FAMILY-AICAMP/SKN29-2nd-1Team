from __future__ import annotations

import math
import time
from collections import defaultdict
from typing import Any, Dict, List, Tuple

_CACHE: dict[str, tuple[float, Any]] = {}
CACHE_TTL = 180

def _now() -> float:
    return time.time()

def cached_get(key: str):
    item = _CACHE.get(key)
    if not item:
        return None
    ts, data = item
    if _now() - ts > CACHE_TTL:
        _CACHE.pop(key, None)
        return None
    return data

def cached_set(key: str, data):
    _CACHE[key] = (_now(), data)
    return data

def safe_num(v: Any, default: float = 0.0) -> float:
    try:
        if v is None:
            return default
        x = float(v)
        if math.isnan(x) or math.isinf(x):
            return default
        return x
    except Exception:
        return default

def get_prediction(v: dict) -> dict:
    return v.get("prediction") or {}

def get_views(v: dict) -> float:
    return safe_num(v.get("views") or v.get("view_count") or v.get("viewCount"))

def get_ai_score(v: dict) -> float:
    p = get_prediction(v)
    return safe_num(p.get("ai_score") or v.get("ai_score"))

def get_pred24(v: dict) -> float:
    p = get_prediction(v)
    return safe_num(p.get("predicted_24h_views") or p.get("view24") or get_views(v))

def get_growth(v: dict) -> float:
    p = get_prediction(v)
    g = safe_num(p.get("predicted_growth"), -1)
    if g >= 0:
        return g
    return max(0.0, get_pred24(v) - get_views(v))

_CAT_ID_TO_LABEL = {
    "0": "전체", "1": "Entertainment", "2": "Lifestyle", "10": "Music",
    "15": "Lifestyle", "17": "Sports", "18": "Entertainment", "19": "Lifestyle",
    "20": "Gaming", "22": "Lifestyle", "23": "Entertainment", "24": "Entertainment",
    "25": "News", "26": "Lifestyle", "27": "Education", "28": "Education", "29": "Lifestyle",
}

def get_category(v: dict) -> str:
    cat = v.get("category_group") or v.get("category")
    if cat:
        # 숫자 ID면 label로 변환
        return _CAT_ID_TO_LABEL.get(str(cat).strip(), str(cat))
    cat_id = str(v.get("category_id") or v.get("categoryId") or "")
    if cat_id:
        return _CAT_ID_TO_LABEL.get(cat_id, cat_id)
    return "Unknown"

def get_source(v: dict) -> str:
    p = get_prediction(v)
    return str(p.get("score_source") or p.get("model_type") or "unknown")

def fetch_live_videos(max_results: int = 50) -> list[dict]:
    """
    내부 라우터 간 네트워크 호출 대신 youtube 라우트 함수를 직접 재사용합니다.
    실패 시 빈 리스트를 반환해 summary API가 503으로 죽지 않게 합니다.
    """
    try:
        from .youtube import get_live_bulk
        payload = get_live_bulk(region_code="KR", max_results=max_results, refresh=False)
        videos = payload.get("videos") or payload.get("items") or []
        return videos if isinstance(videos, list) else []
    except Exception:
        return []

def summarize_videos(videos: list[dict]) -> dict:
    if not videos:
        return {
            "total": 0,
            "category_count": 0,
            "avg_views": 0,
            "avg_ai_score": 0,
            "avg_predicted_24h_views": 0,
            "avg_growth": 0,
            "weighted_soft_voting_count": 0,
            "xgboost_count": 0,
            "fallback_count": 0,
        }

    total = len(videos)
    cats = {get_category(v) for v in videos}
    views = [get_views(v) for v in videos]
    scores = [get_ai_score(v) for v in videos]
    pred24 = [get_pred24(v) for v in videos]
    growth = [get_growth(v) for v in videos]
    sources = [get_source(v) for v in videos]
    return {
        "total": total,
        "category_count": len(cats),
        "avg_views": int(sum(views) / max(total, 1)),
        "avg_ai_score": round(sum(scores) / max(total, 1), 1),
        "avg_predicted_24h_views": int(sum(pred24) / max(total, 1)),
        "avg_growth": int(sum(growth) / max(total, 1)),
        "weighted_soft_voting_count": sum("weighted_soft_voting" in s or "weighted_soft_voting_joblib" in s for s in sources),
        "xgboost_count": sum("xgboost" in s for s in sources),
        "fallback_count": sum("fallback" in s or s == "unknown" for s in sources),
    }

def category_growth(videos: list[dict]) -> list[dict]:
    buckets: dict[str, list[dict]] = defaultdict(list)
    for v in videos:
        buckets[get_category(v)].append(v)

    rows = []
    for cat, arr in buckets.items():
        n = len(arr)
        if not n:
            continue
        avg_views = sum(get_views(v) for v in arr) / n
        avg_ai = sum(get_ai_score(v) for v in arr) / n
        avg_growth = sum(get_growth(v) for v in arr) / n
        avg_pred24 = sum(get_pred24(v) for v in arr) / n
        weighted = sum("weighted_soft_voting" in get_source(v) or "weighted_soft_voting_joblib" in get_source(v) for v in arr)

        # 추천 우선순위: AI 점수 + 성장량 + 모델 신뢰도
        growth_rate = avg_growth / max(avg_views, 1)
        strategy_score = min(100, max(0, avg_ai * 0.55 + min(35, growth_rate * 100) + min(10, weighted / n * 10)))

        rows.append({
            "category": cat,
            "count": n,
            "avg_views": int(avg_views),
            "avg_ai_score": round(avg_ai, 1),
            "avg_predicted_24h_views": int(avg_pred24),
            "avg_growth": int(avg_growth),
            "growth_rate": round(growth_rate, 4),
            "weighted_soft_voting_count": weighted,
            "strategy_score": round(strategy_score, 1),
        })

    return sorted(rows, key=lambda r: (r["strategy_score"], r["avg_growth"], r["avg_ai_score"]), reverse=True)

def top_video_candidates(videos: list[dict], limit: int = 8) -> list[dict]:
    rows = []
    for v in videos:
        views = get_views(v)
        ai = get_ai_score(v)
        growth = get_growth(v)
        growth_rate = growth / max(views, 1)
        source = get_source(v)
        trust_bonus = 8 if ("weighted_soft_voting" in source or "weighted_soft_voting_joblib" in source) else (4 if "xgboost" in source else 0)
        recommend_score = min(100, max(0, ai * 0.62 + min(25, growth_rate * 90) + trust_bonus))
        rows.append({
            "video_id": v.get("video_id") or v.get("id"),
            "title": v.get("title") or "제목 없음",
            "channel_title": v.get("channel_title") or v.get("channelTitle") or "",
            "category": get_category(v),
            "views": int(views),
            "ai_score": round(ai, 1),
            "predicted_24h_views": int(get_pred24(v)),
            "predicted_growth": int(growth),
            "growth_rate": round(growth_rate, 4),
            "score_source": source,
            "recommend_score": round(recommend_score, 1),
            "thumbnail": v.get("thumbnail"),
        })

    return sorted(rows, key=lambda r: (r["recommend_score"], r["predicted_growth"]), reverse=True)[:limit]
