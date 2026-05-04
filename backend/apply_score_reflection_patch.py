from pathlib import Path

ROOT = Path.cwd()
frontend_candidates = [
    ROOT / 'frontend' / 'src' / 'pages' / 'VideoPage.jsx',
    ROOT / 'src' / 'pages' / 'VideoPage.jsx',
]
backend_predict_candidates = [
    ROOT / 'backend' / 'api' / 'routes' / 'predict.py',
    ROOT / 'api' / 'routes' / 'predict.py',
]

# 1) Frontend replacement if run from project root or frontend root
source_vp = Path(__file__).resolve().parent / 'frontend' / 'src' / 'pages' / 'VideoPage.jsx'
for target in frontend_candidates:
    if target.exists():
        target.write_text(source_vp.read_text(encoding='utf-8'), encoding='utf-8')
        print(f'Updated frontend: {target}')
        break
else:
    print('VideoPage.jsx target not found. Manually copy frontend/src/pages/VideoPage.jsx to your frontend/src/pages/VideoPage.jsx')

# 2) Backend /predict/bulk endpoint append if missing
bulk_code = r'''

# --- added by score reflection patch: async bulk prediction endpoint ---
class BulkPredictRequest(BaseModel):
    videos: list[Dict[str, Any]] = []


@router.post("/bulk")
def predict_bulk(payload: BulkPredictRequest) -> Dict[str, Any]:
    """Return predictions for many videos so VideoPage can merge scores after the latest videos render."""
    _load_models()
    items = []
    for idx, raw in enumerate((payload.videos or [])[:100]):
        vid = raw.get("video_id") or raw.get("id") or raw.get("videoId")
        normalized = {
            **raw,
            "video_id": vid,
            "views": raw.get("views") or raw.get("view_count") or raw.get("viewCount") or 0,
            "likes": raw.get("likes") or raw.get("like_count") or raw.get("likeCount") or 0,
            "comments": raw.get("comments") or raw.get("comment_count") or raw.get("commentCount") or 0,
            "category_id": raw.get("category_id") or raw.get("categoryId") or "24",
            "category_group": raw.get("category_group") or raw.get("category") or "Entertainment",
            "publishedAt": raw.get("publishedAt") or raw.get("published_at"),
            "entry_rank": raw.get("entry_rank") or raw.get("rank") or idx + 1,
        }
        try:
            pred = predict_video_dict(normalized)
        except Exception as exc:
            views = _safe_float(normalized.get("views"))
            likes = _safe_float(normalized.get("likes"))
            comments = _safe_float(normalized.get("comments"))
            engagement = (likes + comments) / max(views, 1.0)
            prob = min(0.92, max(0.08, (math.log10(max(views, 1)) / 8) + min(0.22, engagement * 2.5)))
            pred = {
                "model_type": "rule_fallback",
                "score_source": f"bulk_error:{exc.__class__.__name__}",
                "ai_score": int(round(prob * 100)),
                "tdi_probability": round(prob, 4),
                "predicted_24h_views": int(round(views * (1.12 + min(0.7, engagement * 3)))),
                "predicted_growth": int(round(max(0, views * min(0.7, 0.12 + engagement * 3)))),
                "label": "초기 반응 확인 필요",
                "message": "예측 실패로 빠른 fallback 점수를 사용했습니다.",
                "used_models": [],
            }
        items.append({"video_id": vid, "prediction": pred})
    return {"ok": True, "count": len(items), "items": items, "predictions": {i["video_id"]: i["prediction"] for i in items if i.get("video_id")}, "source": "predict_bulk"}
# --- end score reflection patch ---
'''

for predict_path in backend_predict_candidates:
    if predict_path.exists():
        text = predict_path.read_text(encoding='utf-8')
        if '@router.post("/bulk")' not in text and "@router.post('/bulk')" not in text:
            insert_at = text.find('@router.get("/status")')
            if insert_at == -1:
                insert_at = text.find("@router.get('/status')")
            if insert_at == -1:
                text = text.rstrip() + bulk_code + '\n'
            else:
                text = text[:insert_at] + bulk_code + '\n\n' + text[insert_at:]
            predict_path.write_text(text, encoding='utf-8')
            print(f'Added /predict/bulk to: {predict_path}')
        else:
            print(f'/predict/bulk already exists: {predict_path}')
        break
else:
    print('predict.py target not found. If /predict/bulk is 404, add the endpoint from README manually.')
