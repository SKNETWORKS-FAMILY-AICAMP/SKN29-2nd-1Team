# 별첨 B. 머신러닝 구간 분류(Duration Bucket Classification) 상세 분석

> 문서 목적: 머신러닝 기반 Duration Bucket 분류 모델의 세부 실험 결과 및 해석 제공

---

## B-1. 구간 분류 모델 개요

### B-1-1. 설계 배경

본 모델은 트렌딩 영상의 지속 시간을 직접 예측하는 회귀 접근 대신,  
**구간 기반 분류(Duration Bucket Classification)** 문제로 재정의하여 해결하였다.

두 가지 시점에서 모델을 운영한다:

- **T0 모델**: 트렌딩 진입 직후 → "이 영상이 단기/중기/장기 중 어디에 속할 것인가?"
- **24h 모델**: 트렌딩 진입 후 24시간 경과 → "초기 반응을 반영했을 때 어느 구간으로 갈 것인가?"

또한, 기존의 이진 분류(`tdi_label`)와 함께  
**3구간 분류(`duration_label`)를 동시에 운영하는 구조**를 사용한다.

---

## B-2. 구간 정의

구간 분할은 클래스 불균형을 최소화하는 것을 목표로 설정하였다.

| Bucket ID | 명칭 | 지속시간 범위 |
|---|---|---|
| 0 | 단기 | 0 ~ 96h |
| 1 | 중기 | 96 ~ 240h |
| 2 | 장기 | 240h 이상 |

---

## B-3. T0 모델 성능 분석

### B-3-1. Baseline 성능

#### Binary Classification

| Model | AUC | F1 | Precision | Recall | Accuracy |
|---|---:|---:|---:|---:|---:|
| RandomForest | 0.8879 | 0.7473 | 0.6425 | 0.8929 | 0.7879 |
| XGBoost | 0.8986 | 0.7523 | 0.6488 | 0.8950 | 0.7930 |
| CatBoost | 0.8641 | 0.7150 | 0.6075 | 0.8687 | 0.7569 |
| LightGBM | 0.8839 | 0.7362 | 0.6287 | 0.8880 | 0.7765 |

#### Multi-class Classification

| Model | AUC-OvR | Macro F1 | Weighted F1 | Accuracy | F1(단기) | F1(중기) | F1(장기) |
|---|---:|---:|---:|---:|---:|---:|---:|
| RandomForest | 0.9048 | 0.7113 | 0.7337 | 0.7287 | 0.8065 | 0.7076 | 0.6197 |
| XGBoost | 0.9127 | 0.7285 | 0.7544 | 0.7581 | 0.8374 | 0.7332 | 0.6150 |
| CatBoost | 0.8640 | 0.6749 | 0.6980 | 0.6901 | 0.7729 | 0.6694 | 0.5825 |
| LightGBM | 0.9029 | 0.7242 | 0.7436 | 0.7384 | 0.8064 | 0.7209 | 0.6453 |

---

### B-3-2. 튜닝 결과

#### Binary

| 모델 | Accuracy | F1 | Precision | Recall | AUC-ROC |
|---|---:|---:|---:|---:|---:|
| XGBoost | 0.7656 | 0.7226 | 0.6182 | 0.8694 | 0.8692 |
| LightGBM | 0.7673 | 0.7256 | 0.6191 | 0.8763 | 0.8719 |

#### Multi-class

| 모델 | Accuracy | Macro F1 | Weighted F1 | AUC-OvR |
|---|---:|---:|---:|---:|
| XGBoost | 0.7362 | 0.7038 | 0.7322 | 0.8891 |
| LightGBM | 0.6969 | 0.6806 | 0.7036 | 0.8713 |

---

### B-3-3. 앙상블 결과

#### Soft Voting

Binary: AUC 0.8713 / F1 0.7240  
Multi:  AUC 0.8819 / Macro F1 0.6966  

#### Weighted Soft Voting

Binary: AUC 0.8713 / F1 0.7240  
Multi:  AUC 0.8820 / Macro F1 0.6969  

---

### B-3-4. 최종 결과

#### 앙상블

Binary: AUC 0.8218 / F1 0.6330  
Multi:  AUC 0.8475 / Macro F1 0.6567  

#### LightGBM 단일

Binary: AUC 0.8206 / F1 0.6676  
Multi:  AUC 0.8449 / Macro F1 0.6600  

#### XGBoost 단일

Binary: AUC 0.8214 / F1 0.6703  
Multi:  AUC 0.8481 / Macro F1 0.6517  

---

## B-4. 24h 모델 성능 분석

### B-4-1. Baseline 성능

#### Binary

| Model | AUC | F1 | Precision | Recall | Accuracy |
|---|---:|---:|---:|---:|---:|
| LightGBM | 0.8924 | 0.7936 | 0.7418 | 0.8532 | 0.8006 |
| RandomForest | 0.8959 | 0.7934 | 0.7363 | 0.8601 | 0.7988 |
| XGBoost | 0.9089 | 0.8133 | 0.7617 | 0.8724 | 0.8200 |
| CatBoost | 0.8695 | 0.7732 | 0.7192 | 0.8361 | 0.7797 |

#### Multi-class

| Model | AUC-OvR | Macro F1 | Weighted F1 | Accuracy |
|---|---:|---:|---:|---:|
| LightGBM | 0.9131 | 0.7664 | 0.7680 | 0.7683 |
| RandomForest | 0.9163 | 0.7437 | 0.7462 | 0.7495 |
| XGBoost | 0.9223 | 0.7729 | 0.7747 | 0.7760 |
| CatBoost | 0.8577 | 0.6803 | 0.6821 | 0.6807 |

---

### B-4-2. 튜닝 결과

#### Binary

| 모델 | Accuracy | F1 | Precision | Recall | AUC-ROC |
|---|---:|---:|---:|---:|---:|
| XGBoost | 0.7901 | 0.7831 | 0.7311 | 0.8429 | 0.8816 |
| LightGBM | 0.8120 | 0.8050 | 0.7539 | 0.8635 | 0.9050 |

#### Multi-class

| 모델 | Accuracy | Macro F1 | Weighted F1 | AUC-OvR |
|---|---:|---:|---:|---:|
| XGBoost | 0.7488 | 0.7453 | 0.7473 | 0.9030 |
| LightGBM | 0.7384 | 0.7357 | 0.7377 | 0.8947 |

---

### B-4-3. 앙상블

Binary: XGBoost : LightGBM = 3 : 7  
Multi: XGBoost : LightGBM = 6 : 4  

Binary: AUC 0.8951 / F1 0.7960  
Multi:  AUC 0.8999 / Macro F1 0.7435  

---

### B-4-4. 최종 결과

#### 앙상블

Binary: AUC 0.8199 / F1 0.7289  
Multi:  AUC 0.8372 / Macro F1 0.6625  

#### LightGBM

Binary: AUC 0.8193 / F1 0.7295  
Multi:  AUC 0.8365 / Macro F1 0.6593  

#### XGBoost

Binary: AUC 0.8181 / F1 0.7286  
Multi:  AUC 0.8363 / Macro F1 0.6643  

---

## B-5. 종합 결론

1. T0 대비 24h 모델에서 성능이 전반적으로 상승  
2. Binary Classification은 안정적인 성능 유지  
3. Multi-class는 장기 구간에서 난이도가 높음  
4. 앙상블은 안정성 측면에서 유효  
