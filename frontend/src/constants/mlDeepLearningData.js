export const CLASSIFICATION_EXPERIMENT = {
  title: 'MLP vs TabNet — TDI Label Classification',
  target: 'tdi_label',
  featureSet: 'T0 피처셋 10개 + category_group',
  split: '시간 기준 70 / 15 / 15',
  imbalance: '65.5 : 34.5',
  goal: 'AUC > 0.78',
  data: {
    total: 34964,
    train: 24474,
    val: 5245,
    test: 5245,
    short: 22902,
    long: 12062,
  },
  models: [
    { name: 'MLP + Embedding', auc: 0.7985, accuracy: 0.7159, f1: 0.6361, recall: 0.7632, precision: 0.5452, time: 176.4, winner: true },
    { name: 'TabNet', auc: 0.7812, accuracy: 0.6988, f1: 0.6222, recall: 0.7626, precision: 0.5254, time: 1093.2, winner: false },
  ],
  mlp: {
    bestEpoch: 48,
    bestValAuc: 0.8206,
    params: 46608,
    architecture: ['Embedding(5,3)', 'Numeric 10 Features', '256 → 128 → 64', 'Residual Skip', 'BCEWithLogitsLoss'],
  },
  tabnet: {
    bestEpoch: 50,
    bestValAuc: 0.79662,
    architecture: ['n_d=32 / n_a=32', 'n_steps=4', 'sparsemax mask', 'Permutation Importance', 'RAdam + CosineAnnealingLR'],
  },
}

export const REGRESSION_EXPERIMENT = {
  model: 'MLP + Embedding',
  target: 'trending_duration_h',
  featureSet: '24h',
  nTrain: 19063,
  nVal: 4085,
  nTest: 4086,
  bestEpoch: 42,
  mae: 85.19,
  rmse: 121.46,
  r2: 0.1431,
  goalMet: false,
  categoryMae: [
    { category: 'News', mae: 49.72 },
    { category: 'Music', mae: 62.64 },
    { category: 'Entertainment', mae: 80.91 },
    { category: 'Lifestyle', mae: 102.11 },
    { category: 'Education', mae: 116.27 },
  ],
}

export const FEATURE_IMPORTANCE_CROSSCHECK = {
  overlap: 7,
  total: 10,
  mlpTop5: ['entry_rank_log', 'T0_view_log', 'pretrend_view_velocity_log', 'hour_sin', 'latency_to_trend_log'],
  tabnetTop5: ['entry_rank_log', 'latency_to_trend_log', 'cat_Lifestyle', 'hour_sin', 'pretrend_view_velocity_log'],
  common: ['entry_rank_log', 'T0_view_log', 'pretrend_view_velocity_log', 'latency_to_trend_log', 'hour_sin', 'hour_cos', 'weekday_cos'],
}
