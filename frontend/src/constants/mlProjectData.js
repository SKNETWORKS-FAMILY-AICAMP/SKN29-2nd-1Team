export const ML_PROJECT_OVERVIEW = {
  dataset: {
    rawSamples: 34964,
    finalSamples: 34964,
    rawFeatures: 63,
    selectedFeatures: 25,
    missingBefore: 23426,
    missingAfter: 0,
    train: 23847,
    val: 4121,
    test: 6996,
    positiveRate: 34.5,
  },
  splitRows: [
    { name: 'Train', samples: 23847, positive: 8159, negative: 15688, positiveRate: 34.21 },
    { name: 'Val', samples: 4121, positive: 1447, negative: 2674, positiveRate: 35.11 },
    { name: 'Test', samples: 6996, positive: 2456, negative: 4540, positiveRate: 35.11 },
  ],
  preprocessingSteps: [
    'snapshot 데이터를 video_id 기준 event 단위로 집계',
    'target 및 주요 feature 기준 결측값 제거',
    'view/comment/rank/growth 계열 log1p 변환',
    'engagement_ratio, latency, pretrend_velocity 생성',
    'weekday/hour는 sin/cos 원형 인코딩 적용',
    'category_id를 category_group으로 그룹화',
    '미래 정보와 누수 feature 제거 후 T0/24h 데이터 분리',
    'video_id 기준 GroupShuffleSplit으로 Train/Val/Test 분리',
  ],
  t0Features: [
    { feature: 'entry_rank_log', desc: '트렌딩 진입 시점의 순위 규모' },
    { feature: 'T0_view_log', desc: '진입 순간 조회수 규모' },
    { feature: 'T0_engagement_ratio_log', desc: '조회수 대비 댓글 반응 강도' },
    { feature: 'latency_to_trend_log', desc: '업로드 후 트렌딩 진입까지 걸린 시간' },
    { feature: 'pretrend_view_velocity_log', desc: '트렌딩 진입 전 조회수 상승 속도' },
    { feature: 'weekday_sin / weekday_cos', desc: '요일 주기성' },
    { feature: 'hour_sin / hour_cos', desc: '업로드 시간대 주기성' },
    { feature: 'saturation_index_30d_mean_prev', desc: '최근 30일 카테고리 경쟁 강도' },
    { feature: 'category_group', desc: '카테고리별 콘텐츠 성격 차이' },
  ],
  h24Feature: { feature: 'view_growth_24h_log', desc: '트렌딩 진입 후 24시간 조회수 증가량' },
}

export const ML_MODEL_RESULTS = [
  { model: 'XGBoost', auc: 0.9111, f1: 0.7654, recall: 0.9039, precision: 0.6636, r2: 0.6550, rmse: 0.7770, rankClf: 1, rankReg: 1 },
  { model: 'RandomForest', auc: 0.8928, f1: 0.7499, recall: 0.8991, precision: 0.6431, r2: 0.5792, rmse: 0.8581, rankClf: 2, rankReg: 4 },
  { model: 'LightGBM', auc: 0.8916, f1: 0.7441, recall: 0.8901, precision: 0.6392, r2: 0.6028, rmse: 0.8337, rankClf: 3, rankReg: 3 },
  { model: 'CatBoost', auc: 0.8683, f1: 0.7235, recall: 0.8742, precision: 0.6171, r2: 0.5506, rmse: 0.8868, rankClf: 4, rankReg: 5 },
  { model: 'ExtraTrees', auc: 0.8433, f1: 0.6945, recall: 0.8348, precision: 0.5945, r2: 0.4377, rmse: 0.9919, rankClf: 5, rankReg: 6 },
  { model: 'GradientBoosting', auc: 0.8153, f1: 0.5703, recall: 0.4990, precision: 0.6654, r2: 0.6399, rmse: 0.7938, rankClf: 6, rankReg: 2 },
  { model: 'SVM', auc: 0.8056, f1: 0.6636, recall: 0.8604, precision: 0.5401, r2: null, rmse: null, rankClf: 7, rankReg: null },
  { model: 'LogisticReg', auc: 0.6308, f1: 0.4772, recall: 0.5432, precision: 0.4256, r2: null, rmse: null, rankClf: 8, rankReg: null },
]

export const ML_PIPELINE_STEPS = [
  { step: '1. Baseline', detail: '전체 후보 모델을 기본 파라미터로 학습하고 Val 기준 성능 비교', output: 'XGBoost, LightGBM, RandomForest, CatBoost 등 상위 모델 선별' },
  { step: '2. Model Compression', detail: '하위 성능 모델을 제거해 실험 비용 절감', output: '분류/회귀별 상위 후보군 유지' },
  { step: '3. Optuna Tuning', detail: 'TPE Sampler + GroupKFold CV로 하이퍼파라미터 탐색', output: 'AUC 최대화 / RMSE 최소화' },
  { step: '4. Ensemble', detail: 'SoftVoting, WeightedSoftVoting, Stacking 실험', output: '검증 성능 기반 모델 조합 검토' },
  { step: '5. Final Evaluation', detail: '최종 1개 모델만 Test set 평가', output: '데이터 누수 없이 일반화 성능 확인' },
]

export const FINAL_MODEL_POINTS = [
  { title: '최종 후보', value: 'XGBoost', desc: '분류 AUC 0.9111, 회귀 RMSE 0.7770으로 양쪽 모두 1위' },
  { title: '분리 방식', value: 'GroupSplit', desc: '동일 video_id가 Train/Val/Test에 중복되지 않도록 분리' },
  { title: '핵심 피처', value: 'T0 + 24h', desc: '진입 순간 정보와 24시간 성장량을 별도 모델로 구성' },
  { title: '최적화', value: 'Optuna', desc: 'GroupKFold 기반 CV로 과적합 위험을 낮춤' },
]

export const FEATURE_IMPORTANCE_EXPLAIN = [
  { feature: 'view_growth_24h_log', impact: 96, desc: '진입 후 24시간 증가량은 장기 지속성 예측의 가장 강한 신호입니다.' },
  { feature: 'T0_view_log', impact: 84, desc: '초기 조회수 규모는 기본적인 확산력을 설명합니다.' },
  { feature: 'pretrend_view_velocity_log', impact: 76, desc: '트렌딩 진입 전 상승 속도는 바이럴 가능성을 반영합니다.' },
  { feature: 'latency_to_trend_log', impact: 65, desc: '업로드 후 빠르게 트렌딩에 진입할수록 초기 반응이 강하다고 해석합니다.' },
  { feature: 'category_group', impact: 54, desc: '카테고리별 소비 패턴과 경쟁 환경 차이를 반영합니다.' },
]
