# =========================
# Step 7. 타겟 변수 생성: 지속 시간 label + TDI 보조 지표
# =========================
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parents[1]))

import numpy as np
import pandas as pd
from utils.config import FEATURES_PATH, TARGET_PATH, TDI_THRESHOLD

# ── 로드 ──────────────────────────────────────────────────────────
events = pd.read_parquet(FEATURES_PATH).copy()

# ── 1. 전체 기준 q75 label ────────────────────────────────────────
global_q75 = events['trending_duration_h'].quantile(0.75)
events['long_label_global_q75'] = (events['trending_duration_h'] >= global_q75).astype(int)

print(f"[전체 기준 q75 지속 시간] {global_q75:.1f}h")
print(f"[long_label_global_q75]\n{events['long_label_global_q75'].value_counts()}")
print(events['long_label_global_q75'].value_counts(normalize=True).round(4))

# ── 2. 카테고리 내 q75 label ──────────────────────────────────────
cat_q75 = events.groupby('category_group')['trending_duration_h'].transform(
    lambda x: x.quantile(0.75)
)
events['cat_q75_duration']   = cat_q75
events['long_label_cat_q75'] = (events['trending_duration_h'] >= cat_q75).astype(int)

print("\n[카테고리별 q75 지속 시간]")
print(events.groupby('category_group')['cat_q75_duration'].first().sort_values(ascending=False))
print(f"\n[long_label_cat_q75]\n{events['long_label_cat_q75'].value_counts()}")

# ── 3. 고정 기준 label 후보 ───────────────────────────────────────
print("\n[고정 threshold별 장기 지속 비율]")
for h in [24, 48, 72, 96, 120, 168]:
    print(f"  {h:>3}h 이상: {(events['trending_duration_h'] >= h).mean():.2%}")

events['long_label_48h'] = (events['trending_duration_h'] >= 48).astype(int)
print(f"\n[long_label_48h]\n{events['long_label_48h'].value_counts()}")

# ── 4. TDI 산출 ──────────────────────────────────────────────────
cat_q95 = events.groupby('category_group')['trending_duration_h'].quantile(0.95)
events['cat_q95_duration']    = events['category_group'].map(cat_q95)
events['duration_score_cat']  = (events['trending_duration_h'] / events['cat_q95_duration']).clip(0, 1)
events['rank_score']          = (1 - (events['best_rank'] - 1) / 200).clip(0, 1)
events['TDI']                 = (events['duration_score_cat'] * events['rank_score']).clip(0, 1)

print(f"\n[TDI 요약]\n{events['TDI'].describe().round(3)}")

# ── 5. TDI threshold별 분포 확인 ─────────────────────────────────
print("\n[TDI threshold별 positive 비율]")
for th in [0.3, 0.4, 0.5]:
    pos = (events['TDI'] >= th).mean()
    print(f"  threshold {th} → 1(지속): {pos:.1%}  /  0(단명): {1-pos:.1%}")

# ── 6. 대표 TDI label 생성 ────────────────────────────────────────
events['tdi_label'] = (events['TDI'] >= TDI_THRESHOLD).astype(int)

print(f"\n[대표 tdi_label: threshold={TDI_THRESHOLD}]")
print(events['tdi_label'].value_counts())
print(events['tdi_label'].value_counts(normalize=True).round(4))

# ── 7. 타깃 후보 정리 ────────────────────────────────────────────
print("\n[타깃 후보]")
print("  회귀 타깃              : trending_duration_h")
print("  로그 회귀 타깃         : trending_duration_log")
print("  분류 메인 타깃         : long_label_global_q75")
print("  카테고리 보정 분류 타깃: long_label_cat_q75")
print("  고정 기준 분류 타깃    : long_label_48h")
print("  보조 TDI 분류 타깃     : tdi_label")

