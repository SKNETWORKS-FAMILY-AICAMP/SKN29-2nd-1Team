export const MODEL_RESULTS = {
  voting: { auc:0.8269, f1:0.6751, recall:0.8624, precision:0.6907, rmse:0.9202, r2:0.5265 },
  models: [
    { name:'XGBoost',          auc:0.8277, f1:0.6787, recall:0.7805, precision:0.6004, overfit:'MODERATE', cm:{ tn:3264, fp:1276, fn:539,  tp:1917 } },
    { name:'LightGBM',         auc:0.8240, f1:0.6758, recall:0.7907, precision:0.5901, overfit:'MODERATE', cm:{ tn:3191, fp:1349, fn:514,  tp:1942 } },
    { name:'RandomForest',     auc:0.8178, f1:0.6681, recall:0.7728, precision:0.5883, overfit:'MODERATE', cm:{ tn:3212, fp:1328, fn:558,  tp:1898 } },
    { name:'ExtraTrees',       auc:0.8009, f1:0.6543, recall:0.7700, precision:0.5689, overfit:'MILD',     cm:{ tn:3107, fp:1433, fn:565,  tp:1891 } },
    { name:'GradientBoosting', auc:0.7993, f1:0.5537, recall:0.4857, precision:0.6438, overfit:'OK',       cm:{ tn:3880, fp:660,  fn:1263, tp:1193 } },
    { name:'KNN',              auc:0.7626, f1:0.5945, recall:0.5749, precision:0.6155, overfit:'SEVERE',   cm:{ tn:3658, fp:882,  fn:1044, tp:1412 } },
    { name:'SVM',              auc:0.7703, f1:0.4949, recall:0.3978, precision:0.6548, overfit:'OK',       cm:{ tn:4025, fp:515,  fn:1479, tp:977  } },
    { name:'LogisticReg',      auc:0.6253, f1:0.4671, recall:0.5273, precision:0.4192, overfit:'OK',       cm:{ tn:2746, fp:1794, fn:1161, tp:1295 } },
  ],
}

export const DEEP_LEARNING_RESULTS = {
  model: 'MLP + Embedding',
  target: 'trending_duration_h',
  featureSet: '24h',
  nTrain: 19063,
  nVal: 4085,
  nTest: 4086,
  bestEpoch: 42,
  maeH: 85.19,
  rmseH: 121.46,
  r2: 0.1431,
  goalMet: false,
  catMae: [
    { category: 'News', mae: 49.72 },
    { category: 'Music', mae: 62.64 },
    { category: 'Entertainment', mae: 80.91 },
    { category: 'Lifestyle', mae: 102.11 },
    { category: 'Education', mae: 116.27 },
  ],
}
