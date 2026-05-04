from pathlib import Path
import shutil

ROOT = Path.cwd()
SRC = Path(__file__).resolve().parent

# youtube.py는 완성본으로 교체
src_youtube = SRC / "backend/api/routes/youtube.py"
dst_youtube = ROOT / "backend/api/routes/youtube.py"
dst_youtube.parent.mkdir(parents=True, exist_ok=True)
shutil.copy2(src_youtube, dst_youtube)
print("updated", dst_youtube)

# predict.py에는 /bulk 라우트가 없을 때만 append
append_text = (SRC / "backend/api/routes/predict.py.append").read_text(encoding="utf-8")
dst_predict = ROOT / "backend/api/routes/predict.py"
if dst_predict.exists():
    text = dst_predict.read_text(encoding="utf-8")
    if '@router.post("/bulk")' not in text and "@router.post('/bulk')" not in text:
        dst_predict.write_text(text.rstrip() + "\n" + append_text, encoding="utf-8")
        print("appended /predict/bulk to", dst_predict)
    else:
        print("/predict/bulk already exists; skipped append")
else:
    raise FileNotFoundError("backend/api/routes/predict.py not found")

print("\nFrontend patch is in frontend/src/pages/VideoPage.jsx.patch.txt. Apply its logic to your current VideoPage.jsx because JSX structure may differ.")
