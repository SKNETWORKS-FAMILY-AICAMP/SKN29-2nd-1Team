from __future__ import annotations

import json
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Optional
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen

from fastapi import APIRouter, Query

router = APIRouter(prefix="/youtube", tags=["youtube"])

BASE_DIR = Path(__file__).resolve().parents[2]
ENV_PATH = BASE_DIR / ".env"

# 영상 캐시는 짧게만 사용합니다. 최신 영상이 중요하므로 오래된 캐시를 고집하지 않습니다.
_VIDEO_CACHE: dict[str, tuple[float, dict]] = {}
VIDEO_CACHE_TTL = 300  # seconds
VIDEO_STALE_CACHE_TTL = 24 * 60 * 60  # seconds

CATEGORY_MAP = {
    "0":  {"key": "all",           "label": "전체"},
    "1":  {"key": "film",          "label": "Entertainment"},
    "2":  {"key": "autos",         "label": "Lifestyle"},
    "10": {"key": "music",         "label": "Music"},
    "15": {"key": "pets",          "label": "Lifestyle"},
    "17": {"key": "sports",        "label": "Sports"},
    "18": {"key": "shorts",        "label": "Entertainment"},
    "19": {"key": "travel",        "label": "Lifestyle"},
    "20": {"key": "gaming",        "label": "Gaming"},
    "22": {"key": "people",        "label": "Lifestyle"},
    "23": {"key": "comedy",        "label": "Entertainment"},
    "24": {"key": "entertainment", "label": "Entertainment"},
    "25": {"key": "news",          "label": "News"},
    "26": {"key": "lifestyle",     "label": "Lifestyle"},
    "27": {"key": "education",     "label": "Education"},
    "28": {"key": "tech",          "label": "Education"},
    "29": {"key": "nonprofit",     "label": "Lifestyle"},
}
FEED_IDS = ["0", "10", "17", "20", "24", "26"]


def _env_value(name: str) -> str:
    value = os.getenv(name, "").strip()
    if value:
        return value
    if ENV_PATH.exists():
        for line in ENV_PATH.read_text(encoding="utf-8", errors="ignore").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            if k.strip() == name:
                return v.strip().strip('"').strip("'")
    return ""


def _duration_to_seconds(value: str) -> int:
    if not value or not value.startswith("PT"):
        return 0
    n = ""
    total = 0
    for ch in value[2:]:
        if ch.isdigit():
            n += ch
            continue
        amount = int(n or 0)
        n = ""
        if ch == "H":
            total += amount * 3600
        elif ch == "M":
            total += amount * 60
        elif ch == "S":
            total += amount
    return total


def _yt_get(endpoint: str, params: dict, timeout: int = 8) -> dict:
    key = _env_value("YOUTUBE_API_KEY")
    if not key:
        raise RuntimeError("YOUTUBE_API_KEY가 설정되지 않았습니다.")
    url = f"https://www.googleapis.com/youtube/v3/{endpoint}?{urlencode({**params, 'key': key})}"
    with urlopen(url, timeout=timeout) as res:
        return json.loads(res.read().decode("utf-8"))


def _normalize_video(item: dict, category_label: str | None = None, rank: int | None = None) -> dict:
    snippet = item.get("snippet", {}) or {}
    stats = item.get("statistics", {}) or {}
    content = item.get("contentDetails", {}) or {}
    video_id = item.get("id") if isinstance(item.get("id"), str) else item.get("id", {}).get("videoId", "")
    category_id = str(snippet.get("categoryId") or "0")
    label = category_label or CATEGORY_MAP.get(category_id, {}).get("label", category_id)
    thumbs = snippet.get("thumbnails", {}) or {}
    high = thumbs.get("maxres") or thumbs.get("standard") or thumbs.get("high") or thumbs.get("medium") or thumbs.get("default") or {}

    views = int(stats.get("viewCount") or 0)
    likes = int(stats.get("likeCount") or 0)
    comments = int(stats.get("commentCount") or 0)

    return {
        "video_id": video_id,
        "id": video_id,
        "title": snippet.get("title", "제목 없음"),
        "channel_title": snippet.get("channelTitle", ""),
        "channelTitle": snippet.get("channelTitle", ""),
        "category": label,
        "category_group": label,
        "category_id": category_id,
        "categoryId": category_id,
        "view_count": views,
        "views": views,
        "like_count": likes,
        "likes": likes,
        "comment_count": comments,
        "comments": comments,
        "published_at": snippet.get("publishedAt", ""),
        "publishedAt": snippet.get("publishedAt", ""),
        "thumbnail": f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg" if video_id else high.get("url", ""),
        "thumbnail_fallback": high.get("url", f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"),
        "thumbnails": thumbs,
        "duration_seconds": _duration_to_seconds(content.get("duration", "")),
        "rank": rank,
        "entry_rank": rank,
        "source": "youtube_api",
        # 프론트가 즉시 표시할 수 있는 임시 상태. 실제 점수는 /predict/bulk에서 병합됩니다.
        "prediction": None,
        "prediction_status": "pending",
    }


def _cache_get(key: str, refresh: bool, latest_only: bool, allow_stale: bool = False) -> Optional[dict]:
    # latest_only=true여도 5분 이내 캐시는 즉시 사용해서 API 재호출과 첫 로딩을 줄입니다.
    if refresh:
        return None
    cached = _VIDEO_CACHE.get(key)
    if not cached:
        return None
    ts, data = cached
    ttl = VIDEO_CACHE_TTL if latest_only else 300
    if time.time() - ts <= ttl:
        return data
    if allow_stale and time.time() - ts <= VIDEO_STALE_CACHE_TTL:
        stale = dict(data)
        stale["source"] = "youtube_api_stale_cache"
        stale["source_label"] = "이전 캐시 데이터"
        stale["warning"] = stale.get("warning") or "YouTube API 실패로 이전 캐시를 표시합니다."
        return stale
    return None


def _cache_get_stale(key: str) -> Optional[dict]:
    cached = _VIDEO_CACHE.get(key)
    if not cached:
        return None
    ts, data = cached
    if time.time() - ts <= VIDEO_STALE_CACHE_TTL:
        stale = dict(data)
        stale["source"] = "youtube_api_stale_cache"
        stale["source_label"] = "이전 캐시 데이터"
        stale["warning"] = stale.get("warning") or "YouTube API 실패로 이전 캐시를 표시합니다."
        return stale
    return None


def _cache_set(key: str, data: dict) -> dict:
    _VIDEO_CACHE[key] = (time.time(), data)
    return data


def _fetch_popular_raw(region_code: str, max_results: int, category_id: str = "0") -> list[dict]:
    params = {
        "part": "snippet,statistics,contentDetails",
        "chart": "mostPopular",
        "regionCode": region_code,
        "maxResults": max_results,
    }
    if category_id and str(category_id) != "0":
        params["videoCategoryId"] = str(category_id)
    data = _yt_get("videos", params)
    label = CATEGORY_MAP.get(str(category_id), {}).get("label")
    return [
        _normalize_video(item, label if str(category_id) != "0" else None, rank=i + 1)
        for i, item in enumerate(data.get("items", []))
    ]


def _fetch_popular(region_code: str, max_results: int, category_id: str = "0", refresh: bool = False, latest_only: bool = True) -> dict:
    cache_key = f"popular:v_latest:{region_code}:{category_id}:{max_results}"
    cached = _cache_get(cache_key, refresh, latest_only)
    if cached:
        return cached

    items = _fetch_popular_raw(region_code, max_results, category_id)
    items = list({(item.get("video_id") or item.get("id")): item for item in items if (item.get("video_id") or item.get("id"))}.values())
    items.sort(key=lambda x: x.get("published_at") or "", reverse=True)
    payload = {
        "ok": True,
        "source": "youtube_api",
        "source_label": "YouTube API 최신 영상",
        "region_code": region_code,
        "category_id": category_id,
        "latest_only": latest_only,
        "include_predictions": False,
        "prediction_mode": "async_bulk",
        "refreshed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "items": items,
        "videos": items,
        "count": len(items),
    }
    return _cache_set(cache_key, payload)


def _fallback(max_results: int, region_code: str, category_id: str = "0", reason: str = "") -> dict:
    return {
        "ok": False,
        "source": "youtube_api_error",
        "source_label": "YouTube API 연결 실패",
        "warning": reason or "YouTube API 호출에 실패했습니다.",
        "region_code": region_code,
        "category_id": category_id,
        "refreshed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "items": [],
        "videos": [],
        "count": 0,
    }


@router.get("/trending")
def get_trending(
    region_code: str = Query("KR"),
    max_results: int = Query(24, ge=1, le=50),
    category_id: str = Query("0"),
    refresh: Optional[bool] = Query(False),
    latest_only: Optional[bool] = Query(True),
    include_predictions: Optional[bool] = Query(False),
    _: Optional[str] = Query(None),
):
    cache_key = f"popular:v_latest:{region_code}:{category_id}:{max_results}"
    try:
        # include_predictions는 호환용 파라미터입니다. 영상 최신화 속도 때문에 여기서는 예측을 붙이지 않습니다.
        return _fetch_popular(region_code, max_results, str(category_id), bool(refresh), bool(latest_only))
    except (HTTPError, URLError, TimeoutError, RuntimeError) as e:
        stale = _cache_get_stale(cache_key)
        if stale:
            return stale
        return _fallback(max_results, region_code, category_id, str(e))


@router.get("/live/bulk")
def get_live_bulk(
    region_code: str = Query("KR"),
    max_results: int = Query(24, ge=1, le=50),
    order: str = Query("relevance"),
    refresh: Optional[bool] = Query(False),
    latest_only: Optional[bool] = Query(True),
    include_predictions: Optional[bool] = Query(False),
    prefer_warm_cache: Optional[bool] = Query(False),
    _: Optional[str] = Query(None),
):
    # 핵심: 최신 영상 API는 AI 예측 계산을 기다리지 않습니다.
    bulk_cache_key = f"live_bulk:v3:{region_code}:{max_results}:{order}"
    cached = _cache_get(bulk_cache_key, bool(refresh), bool(latest_only))
    if cached:
        return cached

    groups: dict[str, list[dict]] = {}
    warnings: list[str] = []
    per_category = max(6, min(50, max_results))

    def _fetch_category(cid: str):
        return cid, _fetch_popular(region_code, per_category, cid, bool(refresh), bool(latest_only))

    with ThreadPoolExecutor(max_workers=len(FEED_IDS)) as executor:
        futures = {executor.submit(_fetch_category, cid): cid for cid in FEED_IDS}
        for future in as_completed(futures):
            cid = futures[future]
            try:
                cid_result, payload = future.result()
                key = CATEGORY_MAP[cid_result]["key"]
                groups[key] = payload.get("items", [])[:max_results]
            except Exception as e:
                warnings.append(f"category {cid}: {e}")
                groups[CATEGORY_MAP[cid]["key"]] = []

    all_items = []
    seen = set()
    for key in ["all", "music", "sports", "gaming", "entertainment", "lifestyle"]:
        for item in groups.get(key, []):
            vid = item.get("video_id") or item.get("id")
            if vid and vid not in seen:
                seen.add(vid)
                all_items.append(item)
    def _sort_items(items: list[dict]) -> list[dict]:
        if order == "date":
            return sorted(items, key=lambda x: x.get("published_at") or x.get("publishedAt") or "", reverse=True)
        if order == "viewCount":
            return sorted(items, key=lambda x: int(x.get("views") or x.get("view_count") or 0), reverse=True)
        return items

    all_items = _sort_items(all_items)
    if not groups.get("all"):
        groups["all"] = all_items[:max_results]
    groups = {key: _sort_items(value)[:max_results] for key, value in groups.items()}

    payload = {
        "ok": not bool(warnings),
        "source": "youtube_api" if not warnings else "youtube_api_partial",
        "source_label": "YouTube API 최신 호출" if not warnings else "YouTube API 일부 연결",
        "region_code": region_code,
        "refresh": refresh,
        "latest_only": latest_only,
        "include_predictions": False,
        "prediction_mode": "async_bulk",
        "refreshed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "groups": groups,
        "items": groups.get("all", [])[:max_results],
        "videos": groups.get("all", [])[:max_results],
        "count": len(groups.get("all", [])),
        "warning": " / ".join(warnings) if warnings else "",
    }
    if warnings:
        stale = _cache_get_stale(bulk_cache_key)
        if stale:
            return stale
    return _cache_set(bulk_cache_key, payload)


@router.get("/cache/clear")
def clear_youtube_cache():
    _VIDEO_CACHE.clear()
    return {"ok": True, "message": "youtube video cache cleared"}


@router.get("/categories")
def get_categories(region_code: str = Query("KR")):
    return {
        "ok": True,
        "region_code": region_code,
        "items": [{"id": cid, "title": v["label"]} for cid, v in CATEGORY_MAP.items()],
    }