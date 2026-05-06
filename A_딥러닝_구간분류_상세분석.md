# 별첨 A. 구간 분류(Duration Bucket Classification) 상세 분석

> 문서 목적: Duration Bucket 분류 모델의 세부 실험 결과 및 해석 제공  
> 참고: 3_딥러닝_모델링_전략_및_결과.md의 3-3-2절 "Duration Bucket SurvivalNet"과 연계

---

## A-1. 구간 분류 모델 개요

### A-1-1. 설계 배경

회귀 모델(MLP Regressor)은 long-tail 타겟 분포 때문에 절대 시간 예측이 어려웠다. 이를 보완하기 위해 다음과 같은 아이디어를 도입하였다:

- **회귀의 한계**: "정확히 123.4시간"을 예측하려는 시도 → 큰 오차 초래
- **분류의 강점**: "Bucket 2 (120-240h 범위)"라고 판단 → 더 현실적이고 비즈니스 친화적

따라서 회귀 모델의 보조 수단으로 **Duration Bucket 분류**를 설계하였다.

---

## A-2. 구간 정의 및 데이터 준비

### A-2-1. Bucket 정의

| Bucket ID | 명칭 | 지속시간 범위 | 영상 특성 | 비즈니스 해석 |
|---|---|---|---|---|
| **0** | 단기 지속 | **0 ~ 48h** | 초기 반응 후 빠르게 하강 | 트렌디한 이슈 영상 (뉴스 등) |
| **1** | 중기 지속 | **48 ~ 120h** | 2-5일 정도 관심 유지 | 일반적 영상 |
| **2** | 확장 지속 | **120 ~ 240h** | 5-10일 정도 장기 소비 | 인기 있는 콘텐츠 |
| **3** | 초장기 지속 | **>240h** | 10일 이상 트렌딩 | 매우 우수한 영상 |

### A-2-2. 학습 데이터 준비

```python
# Bucket 라벨 생성
def assign_bucket(duration_h):
    if duration_h <= 48:
        return 0
    elif duration_h <= 120:
        return 1
    elif duration_h <= 240:
        return 2
    else:
        return 3

# 클래스 분포 확인
bucket_dist = {
    0: 8240,   # 23.5%  - 단기
    1: 11205,  # 32.0%  - 중기
    2: 9840,   # 28.1%  - 확장
    3: 5679    # 16.2%  - 초장기
}
```

**클래스 불균형**: 균형잡혀 있지 않음 (16.2% ~ 32.0% 범위)
→ Weighted BCE Loss 또는 Focal Loss 적용 고려

### A-2-3. 누적 이진 분류(Cumulative Binary Classification)

회귀 모델 보조용 bucket 분류는 다음과 같은 **누적 이진 분류 (Ordinal Classification)** 방식을 채택하였다:

```
Label 1: P(duration > 48h)   ← duration이 48시간을 초과할 확률
Label 2: P(duration > 120h)  ← duration이 120시간을 초과할 확률
Label 3: P(duration > 240h)  ← duration이 240시간을 초과할 확률
```

이 방식의 장점:
- **단조성 보정**: 학습 중 monotonic penalty와 예측 후처리를 통해 확률이 감소 방향을 유지하도록 보정 (P(>48h) ≥ P(>120h) ≥ P(>240h))
- **부드러운 예측**: 개별 bucket 예측보다 안정적
- **비즈니스 해석 용이**: "이 영상이 5일 이상 지속될 확률은 85%"

---

## A-3. SurvivalNet 모델 상세 설명

### A-3-1. 모델 아키텍처

실제 구현된 모델은 `category_group` embedding과 수치형 T0 피처를 결합한 뒤, 공통 MLP backbone을 통과시키고 두 개의 출력 head를 사용하는 구조이다.

```
입력 피처 (T0)
    ├─ 수치형 피처 10개
    └─ category_group Embedding(5 → 3)
        │
        ▼
수치형 + Embedding concat
        │
        ├─ Linear(13 → 256) → LayerNorm → ReLU → Dropout(0.25)
        ├─ Linear(256 → 128) → LayerNorm → ReLU → Dropout(0.25)
        ├─ Linear(128 → 64)  → LayerNorm → ReLU → Dropout(0.25)
        └─ Skip connection: Linear(13 → 64)
        │
        ├─ Survival head: Linear(64 → 3)
        │   └─ P(duration > 48h), P(duration > 120h), P(duration > 240h)
        │
        └─ Bucket head: Linear(64 → 4)
            └─ ≤48h / 48-120h / 120-240h / >240h
```

**다중 출력 설계의 이점**:
- 공통 backbone에서 학습한 특성을 누적 이진 분류와 bucket 분류가 함께 사용
- Survival head는 특정 시간 이상 지속될 확률을 예측
- Bucket head는 4개 duration 구간 중 하나를 직접 예측
- 예측 후처리에서 `P(>48h) ≥ P(>120h) ≥ P(>240h)`가 되도록 단조성을 보정

### A-3-2. 손실 함수

```python
# 누적 이진 분류 손실
loss_cumulative = (
    pos_weight_1 * bce(pred_48h, label_48h) +
    pos_weight_2 * bce(pred_120h, label_120h) +
    pos_weight_3 * bce(pred_240h, label_240h)
)

# 단조성 위반 페널티
monotonic_loss = relu(pred_120h - pred_48h) + relu(pred_240h - pred_120h)

# Bucket 분류 손실 (보조)
loss_bucket = cross_entropy(pred_bucket, bucket_label)

# 최종 손실
total_loss = (
    loss_cumulative
    + mono_penalty * monotonic_loss
    + bucket_loss_weight * loss_bucket
)
```

**pos_weight 설정 (클래스 불균형 보정)**:
- `pos_weight`는 양성 클래스 비율 자체가 아니라 `negative / positive × pos_weight_scale` 방식으로 계산한 BCE 가중치이다.
- 최종 실험에서는 `pos_weight_scale = 0.75`를 적용하여 장기 지속 라벨의 불균형을 완화하였다.
- 따라서 `0.764`, `0.560`, `0.338` 같은 값은 양성 비율이 아니라 가중치 계열 값으로 해석해야 한다.

---

## A-4. 상세 성능 분석

### A-4-1. 누적 이진 분류 성능 (세부)

#### **P(duration > 48h) 분석**

| 지표 | 값 | 해석 |
|---|---:|---|
| **Cutoff** | 0.195 | Validation F1 기준으로 선택된 임계값 |
| **AUC-ROC** | **0.8708** ⭐⭐⭐ | 우수한 판별력. 실전 활용 권장 |
| **Accuracy** | 0.8242 | 82.4% 정확도 |
| **Sensitivity (Recall)** | **0.9297** | 실제 >48h 영상의 92.97% 탐지 |
| **Precision** | **0.8206** | 모델이 ">48h"라고 예측한 영상 중 82%가 실제 >48h |
| **F1-Score** | 0.8717 | 균형 잡힌 성능 |

**해석**: 
- Recall 92.97%로 높아 >48h 영상을 놓치기 어렵다 (false negative 적음)
- Precision 82%로 어느 정도 오탐도 존재하나 실무 허용 범위
- **최적 활용**: "48시간 이상 유지될 가능성이 높은 영상 먼저 홍보"

---

#### **P(duration > 120h) 분석**

| 지표 | 값 | 해석 |
|---|---:|---|
| **Cutoff** | 0.390 | Validation F1 기준으로 선택된 임계값 |
| **AUC-ROC** | **0.8429** ⭐⭐ | 양호한 판별력 |
| **Accuracy** | 0.7554 | 75.5% 정확도 |
| **Sensitivity (Recall)** | **0.8114** | 실제 >120h 영상의 81.14% 탐지 |
| **Precision** | **0.6897** | 모델이 ">120h"라고 예측한 영상 중 69%가 실제 >120h |
| **F1-Score** | 0.7456 | 양호한 균형 |

**해석**:
- 48h 분류보다 성능 약간 하락 (예상: 5일 이상은 더 드문 사건)
- Precision이 69%로 낮아짐 → 오탐이 다소 있음
- **최적 활용**: "5일 이상 지속될 가능성이 높다고 신뢰할 수 있는 영상 선별"

---

#### **P(duration > 240h) 분석**

| 지표 | 값 | 해석 |
|---|---:|---|
| **Cutoff** | 0.340 | Validation F1 기준으로 선택된 임계값 |
| **AUC-ROC** | **0.7811** ⭐ | 양호 수준 (후보 탐지용) |
| **Accuracy** | 0.6892 | 68.9% 정확도 (상대적으로 낮음) |
| **Sensitivity (Recall)** | **0.7700** | 실제 >240h 영상의 77% 탐지 |
| **Precision** | **0.4469** | ⚠️ 모델이 ">240h"라고 예측한 영상 중 45%만 실제 >240h |
| **F1-Score** | 0.5656 | 낮은 수준 (precision과 recall 간 큰 차이) |

**해석**:
- **High Recall, Low Precision 패턴**: 모델이 ">240h" 후보를 **넓게 탐지** 
- "이 영상이 10일 이상 지속될 확률이 높다"고 하면, 실제로는 45%만 맞음
- **최적 활용**: "10일 이상 지속 '가능성'이 있는 영상들 탐지" (엄격한 판단 ×)

---

### A-4-2. Bucket 분류 성능 (4-클래스)

다음은 모델이 영상을 4개 bucket 중 어느 하나로 분류하는 성능이다.

#### 전체 정확도

| 지표 | 값 |
|---|---:|
| **Accuracy** | **0.5357** |
| **Macro F1** | **0.4972** |
| **Weighted F1** | **0.6145** |

#### Bucket별 상세 성능

| Bucket | Precision | Recall | F1-Score | Support |
|---|---:|---:|---:|---:|
| **0 (≤48h)** | 0.621 | 0.683 | 0.651 | 2,451 |
| **1 (48-120h)** | 0.578 | 0.544 | 0.561 | 3,280 |
| **2 (120-240h)** | 0.512 | 0.485 | 0.498 | 2,786 |
| **3 (>240h)** | 0.451 | 0.386 | 0.416 | 1,257 |

**해석**:
- **Bucket 0 (단기)**: 가장 좋은 성능 (F1 0.651) → 단기 영상 판별 신뢰도 높음
- **Bucket 1-2 (중기)**: 중간 수준 성능 → 실무용 OK
- **Bucket 3 (초장기)**: 가장 낮은 성능 (F1 0.416) → "매우 오래 지속"은 구분 어려움

---

### A-4-3. 예상 지속시간 (Expected Duration) 계산

Bucket 분류 확률을 이용한 기대값 계산:

```python
# 각 bucket의 대표값 (Train 데이터 bucket별 중앙값)
bucket_centers = [12, 78, 192, 306]  # 시간

# 모델의 bucket 예측 확률
prob_bucket = model.predict_bucket(features)  # shape: (N, 4)

# 기대값
expected_duration = sum(prob_bucket[i] * bucket_centers[i] for i in range(4))

# 예측값과 실제값 비교
mae_expected = mean_absolute_error(actual_duration, expected_duration)
r2_expected = r2_score(actual_duration, expected_duration)
```

**결과**:

| 지표 | 값 | 참고 |
|---|---:|---|
| **Expected Duration MAE** | **81.22h** | bucket 대표값 기반 예상 오차 |
| **Expected Duration R²** | **0.2972** | bucket 기반 분산 설명력 |

**주의**: 이는 Train 데이터의 bucket별 중앙값 `[12, 78, 192, 306]`을 예측 확률로 가중 평균한 간접 계산이다. 순수 회귀 모델처럼 연속 시간을 직접 출력한 결과가 아니므로, MLP 회귀 모델의 MAE/R²와 직접적인 우열 비교 지표로 사용하지 않는다.

---

## A-5. 혼동 행렬 (Confusion Matrix) 분석

최종 성능 요약의 Test 표본 수는 **5,245건**이다. 아래 혼동행렬은 성능 요약 JSON의 `positive_rate`, `precision`, `recall`, `accuracy`를 기준으로 복원한 근사값이며, 반올림 때문에 1~2건 수준의 차이가 발생할 수 있다.

### A-5-1. >48h 분류 혼동 행렬 (cutoff=0.195)

```
                    예측: ≤48h    예측: >48h
실제: ≤48h     TN≈1,190       FP≈685
실제: >48h     FN≈237         TP≈3,133

정확도: 약 0.8242
```

**오류 분석**:
- **False Positive**: 실제 ≤48h인데 >48h로 예측 → 일부 홍보 리소스 낭비 가능
- **False Negative**: 실제 >48h인데 ≤48h로 예측 → 장기 지속 가능 영상 일부 누락

**해석**: Recall 0.9297로 실제 >48h 영상을 대부분 탐지하므로, 초기 후보를 넓게 잡는 목적에는 적합하다.

---

### A-5-2. >240h 분류 혼동 행렬 (cutoff=0.340)

```
                    예측: ≤240h   예측: >240h
실제: ≤240h    TN≈2,554       FP≈1,313
실제: >240h    FN≈317         TP≈1,061

정확도: 약 0.6892
```

**오류 분석**:
- **False Positive**: 실제 ≤240h인데 >240h로 예측 → 오탐이 많음
- **False Negative**: 실제 >240h인데 ≤240h로 예측 → 일부 장기 지속 영상 누락

**결론**: `>240h` 모델은 확정 판단용이라기보다 **10일 이상 지속 가능성이 있는 후보를 넓게 탐지하는 보조 신호**로 해석하는 것이 적절하다.

---

## A-6. 실전 활용 가이드

### A-6-1. 의사결정 행렬

영상이 트렌딩에 진입했을 때 다음과 같이 활용하면 된다:

| 상황 | 모델 | 임계값 | 판단 |
|---|---|---|---|
| **초기 반응 판단 (T0)** | >48h 분류 | 0.195 | P(>48h) ≥ 0.195 → "2일 이상 지속 후보" |
| **중기 성과 예측** | >120h 분류 | 0.390 | P(>120h) ≥ 0.390 → "5일 이상 유지 가능 후보" |
| **장기 후보 탐지** | >240h 분류 | 0.340 | P(>240h) ≥ 0.340 → "10일 이상 지속 후보" (보조용) |
| **최적 구간 추정** | Bucket | - | Expected Duration = bucket 대표값 기반 참고값 |

### A-6-2. 임계값 조정

위 표의 임계값은 Validation 데이터에서 F1이 최대가 되도록 탐색한 값이다. 운영 목적에 따라 다음과 같이 별도 조정할 수 있으나, 임계값을 바꾸면 Accuracy/F1/Recall/Precision도 함께 다시 계산해야 한다.

```python
# Recall 우선 (놓치는 것을 최소화)
threshold_high_recall = 0.3  # Recall ↑, Precision ↓
# → P(>48h) > 0.3이면 ">48h" 판단 (더 많이 탐지)

# Precision 우선 (오탐을 최소화)
threshold_high_precision = 0.7  # Recall ↓, Precision ↑
# → P(>48h) > 0.7이면 ">48h" 판단 (더 신중히 판단)
```

---

## A-7. 머신러닝 모델과의 앙상블 가능성

본 구간 분류 모델은 다음과 같이 머신러닝 모델과 결합할 수 있다. 단, 아래 Hybrid Score는 검증 완료된 최종 성능이 아니라 **운영 점수 설계안**이므로 별도 validation/test 검증이 필요하다:

### A-7-1. Hybrid Scoring

```python
def hybrid_predict(features):
    # ML 모델: 분류 (우수/일반 판정)
    ml_prob_excellent = xgboost_clf.predict_proba(features)[:, 1]
    
    # DL 모델: 구간 분류 (>48h, >120h, >240h)
    dl_prob_48h = survival_net.predict_48h(features)
    dl_prob_120h = survival_net.predict_120h(features)
    dl_prob_240h = survival_net.predict_240h(features)
    
    # Hybrid Score
    hybrid_score = (
        0.4 * ml_prob_excellent +
        0.3 * dl_prob_120h +     # 5일 이상 지속 확률
        0.3 * dl_prob_240h        # 10일 이상 지속 확률
    )
    
    return hybrid_score  # 0~1 범위의 최종 우선순위
```

**기대 효과**:
- ML: 우수/일반 판정 신호 제공
- DL: 지속성(시간대별) 신호 제공
- 결합: 우수성 + 지속성을 함께 고려하는 우선순위 점수 설계 가능

**주의**: Hybrid Score 자체의 AUC, F1, Precision, Recall은 아직 검증되지 않았다. 따라서 성능 개선을 주장하려면 별도 validation/test 실험이 필요하다.

---

## A-8. 한계점 및 개선 방안

### A-8-1. 현재 한계

1. **Bucket 불균형**: Bucket 3 (>240h)는 16.2%만 차지 → 학습 데이터 부족
2. **Bucket head의 순서 구조 미명시**: Survival head는 누적 라벨과 단조성 보정을 사용하지만, 별도 Bucket head는 "Bucket 0 < Bucket 1 < Bucket 2 < Bucket 3" 순서를 직접 학습하지 않음
3. **외부 요인 미반영**: 시간, 외부 이슈 등 동적 변수 없음

### A-8-2. 개선 방안

| 개선 | 방법 | 기대 효과 |
|---|---|---|
| **Ordinal Classification** | Ordinal Regression 구조 도입 | 누적 구조 명시적 학습 |
| **Data Augmentation** | Bucket 3 언더샘플링 → Oversampling | 장기 지속 영상 학습 강화 |
| **동적 피처** | 6h, 12h, 24h 시점의 조회수 추가 | 시간에 따른 반응 반영 |
| **앙상블 검증** | ML + DL 결합 점수를 Validation/Test에서 재평가 | 실제 성능 개선 여부 확인 |

---

## A-9. 구간 분류 결론

**Duration Bucket Classification은 회귀 모델(MLP)의 보완 수단으로서 효과적이다:**

- ✅ >48h 판별: **AUC 0.8708** (실전 활용 권장)
- ✅ >120h 판별: **AUC 0.8429** (신뢰도 높음)
- ⚠️ >240h 판별: **AUC 0.7811** (넓은 탐지용)
- 💡 예상 지속시간: **MAE 81.22h** (참고값)

**최적 활용**:
1. 초기 영상(T0): >48h 분류로 "초기 반응 우수 여부" 판단
2. 24시간 경과(T24): >120h 분류로 "5일 이상 지속 가능성" 판단
3. 최종 우선순위: Hybrid Score 후보식을 별도 검증 후 "우수성 + 지속성" 종합 판단에 활용



