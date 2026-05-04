export const DL_CLASSIFICATION_RESULTS = [
  { model: 'MLP + Embedding', accuracy: 0.781, f1: 0.742, auc: 0.817, note: '범주형 Embedding과 수치형 피처를 함께 학습' },
  { model: 'TabNet', accuracy: 0.764, f1: 0.721, auc: 0.803, note: 'Attention 기반 tabular deep learning 비교 모델' },
]

export const DL_REGRESSION_SUMMARY = {
  model: 'MLP + Embedding',
  target: 'trending_duration_h',
  featureSet: '24h',
  train: 19063,
  val: 4085,
  test: 4086,
  bestEpoch: 42,
  mae: 85.19,
  rmse: 121.46,
  r2: 0.1431,
  goalMet: false,
}

export const DL_CATEGORY_MAE = [
  { category: 'News', mae: 49.72, level: '가장 안정적' },
  { category: 'Music', mae: 62.64, level: '안정적' },
  { category: 'Entertainment', mae: 80.91, level: '보통' },
  { category: 'Lifestyle', mae: 102.11, level: '어려움' },
  { category: 'Education', mae: 116.27, level: '가장 어려움' },
]

export const DL_TAKEAWAYS = [
  'MLP + Embedding은 category_id 같은 범주형 변수의 패턴을 임베딩으로 학습해 기존 ML 모델과 다른 관점의 비교가 가능합니다.',
  '24h feature set은 트렌딩 진입 후 하루 동안의 성장 신호를 반영해 지속 시간 예측에 사용했습니다.',
  '회귀 성능은 MAE 85.19h, RMSE 121.46h로 목표 기준에는 도달하지 못했지만 카테고리별 난이도 차이를 확인했습니다.',
  'News와 Music은 상대적으로 예측 오차가 낮고, Education과 Lifestyle은 콘텐츠별 편차가 커 예측 난이도가 높았습니다.',
]
