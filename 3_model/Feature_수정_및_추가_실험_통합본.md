# Feature 수정 및 추가 실험

## 1. 실험 설계 원칙
- **비교 기준**: 모든 실험 결과는 **XGBoost 튜닝 결과** 를 기준으로 비교한다.
- **변수 통제**: 한 실험에는 **한 그룹(피처 세트)만 추가 또는 삭제** 하여 독립적 변인 통제를 실시한다.
- **일관성**: 분류와 회귀 태스크는 **동일한 Split, Seed, 모델** 환경에서 수행한다.
- **평가 지표**: 분류(AUC, F1), 회귀($R^2$, RMSE)를 통합적으로 분석한다.
- **판단 기준**: 성능이 향상되더라도 **Final(Test) 데이터에서 결과가 흔들리면 제외** 하며, Validation 성능보다 **Test Gap이 줄어드는 방향(일반화)** 으로 평가한다.

---

## 2. 실험 설계 테이블

| 실험 ID | 피처 세트 | 유지 피처 | 삭제 피처 | 추가 피처 | 목적 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **T0-B0** | 기준점 | `T0_view_log`, `T0_engagement_ratio_log`, `entry_rank_log`, `latency_to_trend_log`, `pretrend_view_velocity_log`, `weekday_sin/cos`, `hour_sin/cos`, `category_group` | 없음 | 없음 | Baseline 설정 |
| **T0-A1** | 시간 제거 | 핵심셋 | `weekday_sin/cos`, `hour_sin/cos` | 없음 | 시간 정보 기여도 확인 |
| **T0-A2** | 카테고리 제거 | 핵심셋 | `category_group` | 없음 | 범주형 일반화 효과 확인 |
| **T0-A3** | 포화도 제거 | 핵심셋 | `saturation_index_30d_mean_prev` | 없음 | 경쟁 강도 피처의 효용성 확인 |
| **T0-A4** | 모멘텀 제거 | 핵심셋 | `pretrend_view_velocity_log` | 없음 | 사전 반응 신호의 중요성 확인 |
| **T0-A5** | 진입속도 제거 | 핵심셋 | `latency_to_trend_log` | 없음 | 빠른 트렌딩 속도의 영향 확인 |
| **T0-A8** | 상호작용 추가 | 핵심셋 | 없음 | Interaction 3종 (view×engagement 등) | 피처 결합 노이즈 확인 |
| **T0-A9** | 비율형 추가 | 핵심셋 | 없음 | Ratio 3종 (comment_per_view 등) | 파생 지표 효과 확인 |
| **T0-A11** | 상위권 진입 | 핵심셋 | 없음 | `entry_rank_top10` | 상위 10위권 진입 신호 확인 |
| **T0-A12** | **상호작용 결합** | 핵심셋 | 없음 | 아래 4종 파생 피처 | 결합 신호를 통한 성능 극대화 확인 |

---

## 3. 제거 실험 결과 및 분석

### [T0-A1] 시간 피처 제거
- **결과**: clf AUC=0.8080 / reg $R^2$=0.5079
- **해석**: 성능 하락 확인됨 → 시간 피처 **유지** 결정.

### [T0-A2] 카테고리 제거 (실험 오류 재검증)
- **결과**: reg $R^2$= -8.2165 (수치 급락)
- **해석**: `category_group`은 모델의 필수 핵심 피처임.

### [T0-A3] 포화도 제거
- **결과**: clf AUC=0.8224 / reg $R^2$=0.5218
- **해석**: 기존(0.8284) 대비 소폭 하락 → 포화도는 약하게나마 기여함.

### [T0-A4] 모멘텀 제거
- **결과**: clf AUC=0.8281 / reg $R^2$=0.5274
- **해석**: 기존과 성능 거의 동일 → 기여도 미미함.

### [T0-A5] 진입 속도 제거
- **결과**: clf AUC=0.8271 / reg $R^2$=0.5219
- **해석**: 기존과 성능 거의 동일 → 기여도 미미함.

---

## 4. 추가 및 결합 실험 상세

### [T0-A11] Rank 기반 피처 분석
- **Entry Rank Threshold 실험**:
  - Top 10: Corr 0.1356 (유의미)
  - Top 50: Corr -0.0034 (무의미, p=0.82)
  - Top 100: Corr 0.4756 (방향 왜곡)
- **결론**: **Top 10**이 가장 희소하고 의미 있는 신호로 판단됨.

### [T0-A8 & A9] Interaction 및 Ratio 피처
- **추가 내역**: `view_engagement_interaction`, `view_per_latency_log`, `momentum_score_log` 등
- **결과**: 성능 개선 없음. 명시적 Interaction은 노이즈로 작용할 가능성이 큼.

### [T0-A12] 파생 피처 4종 추가

**추가된 파생 피처 상세**
- **view_engagement_interaction**: `T0_view_log` × `T0_engagement_ratio_log` (조회수 + 반응성 결합)
- **view_per_latency_log**: `log(T0_view / latency_to_trend)` (진입 속도 대비 초기 인기도)
- **momentum_score_log**: `pretrend_view_velocity` × `(1/latency)` (빠른 진입 + 강한 모멘텀)
- **rank_saturation_interaction**: `entry_rank_log` × `saturation_index_30d_mean_prev` (경쟁 강도 내 진입 난이도)

---

## 5. 최종 피처 조합 및 일반화 성능 (Val vs Test Gap)

| 실험 조합 | 피처 수 | Val AUC | Test AUC | **Gap** | Val $R^2$ | Test $R^2$ | **Gap** |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 기존 전체 | 10개 | 0.9132 | 0.8284 | 0.085 | 0.6653 | 0.5322 | 0.133 |
| 핵심만 | 4개 | 0.8815 | 0.7935 | 0.088 | 0.6130 | 0.4922 | 0.121 |
| **핵심+시간** | **8개** | 0.8815 | 0.8171 | **0.064** | 0.6130 | 0.5160 | **0.097** |
| 핵심+시간+View | 9개 | 0.8866 | 0.8173 | 0.069 | 0.6252 | 0.5166 | 0.109 |

> **Feature 실험 결론**: 핵심+시간(8개) 조합이 Test Gap을 가장 많이 줄여(0.085 → 0.064) **일반화 성능이 가장 안정적임.** 단, 최종 운영 모델 메타데이터는 별도 저장된 운영 모델 기준을 따른다.

---

## 6. 하이퍼파라미터 튜닝 및 앙상블 설정

### 모델별 튜닝 범위 (Optuna)
- **XGBoost**: `n_estimators`(150~600), `max_depth`(3~5), `learning_rate`(0.03~0.08)
- **LightGBM**: `num_leaves`(15~45), `max_depth`(3~6), `reg_alpha`(0.1~10.0)
- **CatBoost**: `depth`(4~6), `l2_leaf_reg`(3.0~15.0), `random_strength`(1.0~3.0)

### 앙상블(Ensemble) 전략
- **분류 (Weighted Soft Voting, 실험)**: XGB(0.20), LGBM(0.45), Cat(0.35)
- **회귀 (Weighted Soft Voting)**: LGBM(0.65), XGB(0.35)
- **Stacking**: 분류(XGB, LGBM 기반), 회귀(XGB 기반) 메타 러너 학습.

---

## 7. Feature 실험 결과 요약 (핵심+시간 조합)

- **단일 모델 최상**:
  - 분류: CatBoost (AUC 0.8174 / F1 0.6684)
  - 회귀: XGBoost ($R^2$ 0.5155 / RMSE 0.9309)
- **앙상블 최종**:
  - 분류 AUC: **0.8162** / 회귀 $R^2$: **0.5155**

---

## 8. 딥러닝 Feature 수정 및 추가 실험

머신러닝 실험에서는 피처를 직접 추가·삭제하며 일반화 성능 변화를 확인하였다. 딥러닝 실험에서는 같은 관점에서 **입력 피처 구성**, **카테고리 처리 방식**, **타겟 변환**, **구간 라벨 재정의**가 성능과 해석에 어떤 영향을 주는지 확인하였다.

### 8-1. 딥러닝 실험 설계 테이블

| 실험 ID | 실험 세트 | 유지 피처 | 변경 사항 | 목적 |
| :--- | :--- | :--- | :--- | :--- |
| **DL-C0** | MLP 분류 | T0 수치형 10개 + `category_group` | Category Embedding + Residual MLP | 딥러닝 분류 기준점 설정 |
| **DL-C1** | TabNet 분류 | T0 수치형 10개 + `category_group` | Attention 기반 TabNet 적용 | 주요 피처 활용 방식 교차 검증 |
| **DL-R0** | 초기 MLP 회귀 | T0 피처셋 | MLP + Embedding | 초기 회귀 baseline 확인 |
| **DL-R1** | 최종 MLP 회귀 | T0 핵심 피처 + `category_group` | `log1p` 타겟 변환 + Isotonic 보정 | long-tail 타겟 보정 효과 확인 |
| **DL-S1** | 구간 라벨 모델 | T0 수치형 10개 + `category_group` | `>48h`, `>120h`, `>240h` 누적 이진 라벨 | 지속시간 구간 재정의 효과 확인 |
| **DL-W1** | Wide & Deep | 최종 MLP 회귀 피처 | `category_group × numeric_feature` 교차항 45개 | 카테고리 상호작용 효과 검증 |

---

### 8-2. 딥러닝 분류 실험: MLP vs TabNet

| 모델 | AUC | Accuracy | F1 | Recall | Precision | 학습 시간 |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **MLP + Embedding** | **0.7985** | **0.7159** | **0.6361** | **0.7632** | **0.5452** | **176.4s** |
| TabNet | 0.7812 | 0.6988 | 0.6222 | 0.7626 | 0.5254 | 1093.2s |

**해석**
- 두 모델 모두 목표 기준인 AUC 0.78은 달성하였다.
- MLP가 TabNet보다 모든 주요 지표와 학습 시간에서 우수하였다.
- 다만 이 절의 핵심은 모델 우열 정리가 아니라, **두 딥러닝 구조가 어떤 피처를 중요하게 보는지 확인하는 것**이다.
- Permutation Importance 기준 Top10 피처 중 7개가 일치하였다.
  - 공통 피처: `entry_rank_log`, `T0_view_log`, `latency_to_trend_log`, `pretrend_view_velocity_log`, `hour_sin`, `hour_cos`, `weekday_cos`
- 이는 머신러닝 실험에서 중요하게 확인된 초기 순위, 초기 조회수, 진입 속도, 시간 피처가 딥러닝에서도 반복적으로 사용된다는 근거가 된다.

---

### 8-3. 딥러닝 회귀 실험: 타겟 변환 및 보정

초기 MLP 회귀 모델은 `trending_duration_h`를 직접 예측했으나, 지속시간 타겟이 long-tail 구조를 보여 큰 오차가 발생하였다. 이에 따라 최종 MLP 회귀에서는 `log1p(trending_duration_h)`를 학습 대상으로 사용하고, Validation 기반 Isotonic 보정을 적용하였다.

| 항목 | 보정 전 | 보정 후 | 변화 |
| :--- | :---: | :---: | :---: |
| Validation MAE | 84.26h | 80.86h | -3.40h |
| Test MAE | 92.94h | 90.16h | -2.78h |
| Test RMSE | 140.44h | 134.06h | -6.38h |
| Test $R^2$ | 0.0595 | 0.1431 | +0.0836 |

**해석**
- 피처를 무작정 늘리는 것보다, 타겟 분포를 완화하는 변환과 보정이 더 직접적인 개선을 만들었다.
- MAE가 여전히 약 90시간 수준이므로, 개별 영상의 정확한 종료 시점 예측에는 한계가 있다.
- Spearman 0.6067로 상대 순위 예측력은 확보되어, 오래 지속될 가능성이 높은 영상을 정렬하는 참고 지표로는 활용 가능하다.

---

### 8-4. 구간 라벨 재정의 실험: Duration Bucket SurvivalNet

정확한 지속시간을 직접 예측하는 방식의 한계를 보완하기 위해, 지속시간을 다음과 같은 누적 이진 라벨로 재정의하였다.

| 라벨 | 의미 | AUC | F1 | Precision | Recall | 해석 |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| `>48h` | 2일 이상 지속 | 0.8708 | 0.8717 | 0.8206 | 0.9297 | 안정적 |
| `>120h` | 5일 이상 지속 | 0.8429 | 0.7456 | 0.6897 | 0.8114 | 활용 가능 |
| `>240h` | 10일 이상 지속 | 0.7811 | 0.5656 | 0.4469 | 0.7700 | 후보 탐지용 |

**해석**
- `>48h`, `>120h`는 AUC 기준으로 비교적 안정적인 구간 판별 성능을 보였다.
- `>240h`는 Recall은 높지만 Precision이 낮아, 확정 판단보다는 장기 지속 후보를 넓게 잡는 용도에 적합하다.
- 이 실험은 피처 추가보다 **타겟을 구간형으로 재정의하는 target engineering**이 효과적일 수 있음을 보여준다.

---

### 8-5. 카테고리 상호작용 실험: Wide & Deep

`category_group`에 따라 수치형 피처의 영향이 달라지는지 확인하기 위해 `category_group × numeric_feature` 교차항 45개를 Wide branch에 추가하였다.

| 모델 | Test MAE | Test RMSE | Test $R^2$ | Spearman |
| :--- | :---: | :---: | :---: | :---: |
| Baseline MLP | **90.22h** | 133.70h | 0.1476 | **0.6091** |
| Wide & Deep | 91.11h | **133.57h** | **0.1493** | 0.6067 |

**해석**
- Wide & Deep은 $R^2$와 RMSE를 아주 소폭 개선했지만, MAE가 90.22h → 91.11h로 증가하였다.
- 따라서 카테고리 상호작용은 존재 가능성은 있으나, 최종 피처 조합에 반영할 만큼의 안정적 개선은 확인되지 않았다.
- 해당 실험은 최종 반영보다는 카테고리 효과 검증용 ablation으로 보는 것이 적절하다.

---

## 9. 딥러닝 실험 반영 여부

| 실험 | 반영 여부 | 판단 근거 |
| :--- | :--- | :--- |
| **MLP + Embedding 분류** | 참고 유지 | 머신러닝 주요 피처와 딥러닝 중요 피처가 상당 부분 일치함 |
| **TabNet 분류** | 최종 반영 제외 | MLP보다 성능이 낮고 학습 시간이 길지만, 피처 중요도 교차 검증용으로 활용 |
| **`log1p` 타겟 변환** | 반영 | Test MAE, RMSE, $R^2$ 모두 개선 |
| **Isotonic 보정** | 반영 | Test MAE가 92.94h → 90.16h로 개선 |
| **Duration Bucket 라벨** | 보조 반영 | 정확한 시간 회귀의 한계를 보완하는 구간형 타겟으로 유효 |
| **Wide & Deep 교차항** | 최종 반영 제외 | MAE 개선이 없어 최종 feature set에는 포함하지 않음 |

---

## 10. 통합 결론

머신러닝 feature 실험에서는 **핵심+시간(8개) 조합**이 Test Gap을 가장 크게 줄이며 일반화 성능이 가장 안정적인 조합으로 확인되었다. 추가 interaction, ratio, 상호작용 결합 피처는 해석 가능성은 있었지만 최종 일반화 성능 개선으로 이어지지는 않았다.

딥러닝 실험에서도 비슷한 흐름이 확인되었다. MLP와 TabNet의 중요 피처가 상당 부분 겹쳤고, Wide & Deep 교차항 역시 MAE를 개선하지 못했다. 즉, 단순히 피처를 더 많이 추가하는 것보다 **누수 없는 핵심 피처를 유지하고, 시간 정보와 타겟 변환을 적절히 반영하는 것**이 더 안정적이었다.

따라서 최종 feature 실험 관점의 정리는 다음과 같다.

- **유지**: 핵심+시간 피처 조합, `category_group`, 시간 피처
- **조건부 활용**: `entry_rank_top10`, `pretrend_view_velocity_log`, `latency_to_trend_log`, `saturation_index_30d_mean_prev`
- **제외**: interaction/ratio 파생 피처, Wide & Deep 교차항
- **추가로 유효한 방향**: `log1p` 타겟 변환, Isotonic 보정, Duration Bucket 라벨 재정의
