from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="YouTube Trend Analyzer API",
    version="1.0.0",
    description="YouTube trend, EDA, feature, video, sustain, campaign, dashboard API",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "ok": True,
        "message": "YouTube Trend Analyzer API is running",
        "docs": "/docs",
        "status": "/api/status",
    }


@app.get("/healthz")
def healthz():
    return {"ok": True}


LOADED_ROUTERS = {}


def safe_include(module_path: str, attr: str = "router"):
    try:
        module = __import__(module_path, fromlist=[attr])
        router = getattr(module, attr)
        app.include_router(router)
        LOADED_ROUTERS[module_path] = {"loaded": True, "error": None}
    except Exception as e:
        LOADED_ROUTERS[module_path] = {"loaded": False, "error": repr(e)}


# 프론트에서 호출하는 주요 라우터 전체 등록
for module_path in [
    "api.routes.eda",
    "api.routes.youtube",
    "api.routes.video",
    "api.routes.feature",
    "api.routes.dashboard",
    "api.routes.sustain",
    "api.routes.campaign",
    "api.routes.strategy",
    "api.routes.insight",
    "api.routes.problem",
    "api.routes.predict",
    "api.routes.predict_lstm",
    "api.routes.model",
]:
    safe_include(module_path)


@app.get("/api/status")
def api_status():
    return {
        "ok": True,
        "message": "API server is running",
        "loaded_routers": LOADED_ROUTERS,
        "important_endpoints": [
            "/eda/summary",
            "/feature/summary",
            "/youtube/live/bulk",
            "/youtube/trending",
            "/youtube/categories",
            "/video/list",
            "/video/summary",
            "/dashboard/summary",
            "/sustain/summary",
            "/campaign/plan",
            "/problem/summary",
            "/insight/summary",
            "/strategy/summary",
            "/predict/status",
        ],
    }


@app.get("/api/routes")
def api_routes():
    return LOADED_ROUTERS
