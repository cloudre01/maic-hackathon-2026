"""Reproducible Taiwan public-data benchmark. No synthetic observations.

Run with: uv run python -m benchmark.train
Uses UCI's original XLS download; never reuses the test set for tuning/calibration.
"""

import argparse
import hashlib
import io
import json
import os
import platform
import time
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path
import numpy as np
import pandas as pd
import sklearn
import xgboost
import catboost
import joblib
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedGroupKFold, train_test_split
from sklearn.metrics import roc_auc_score, average_precision_score, brier_score_loss
from sklearn.calibration import calibration_curve
from xgboost import XGBClassifier
from catboost import CatBoostClassifier

ROOT = Path(__file__).resolve().parents[1]
SEED = 2026
SOURCE = (
    "https://archive.ics.uci.edu/static/public/350/default+of+credit+card+clients.zip"
)


def metrics(y, p):
    return {
        "roc_auc": float(roc_auc_score(y, p)),
        "pr_auc": float(average_precision_score(y, p)),
        "brier": float(brier_score_loss(y, p)),
    }


def intervals(y, p, rounds):
    rng = np.random.default_rng(SEED)
    samples = []
    for _ in range(rounds):
        idx = rng.integers(0, len(y), len(y))
        if len(np.unique(y[idx])) == 2:
            samples.append(list(metrics(y[idx], p[idx]).values()))
    bounds = np.quantile(samples, [0.025, 0.975], axis=0)
    return {
        k: [float(bounds[0, i]), float(bounds[1, i])]
        for i, k in enumerate(metrics(y, p))
    }


def raw_logit(p):
    p = np.clip(p, 1e-6, 1 - 1e-6)
    return np.log(p / (1 - p)).reshape(-1, 1)


def train(rounds=200):
    data_dir = ROOT / "data"
    data_dir.mkdir(exist_ok=True)
    path = data_dir / "taiwan-default.zip"
    if not path.exists():
        with urllib.request.urlopen(SOURCE, timeout=90) as response:
            path.write_bytes(response.read())
    raw = path.read_bytes()
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        xls = next(n for n in archive.namelist() if n.endswith(".xls"))
        df = pd.read_excel(io.BytesIO(archive.read(xls)), header=1)
    df.columns = [str(c).strip() for c in df.columns]
    target = "default payment next month"
    if len(df) != 30000 or not df["ID"].is_unique or set(df[target].unique()) != {0, 1}:
        raise ValueError(
            "Source audit failed: expected 30,000 unique client IDs and binary target."
        )
    feature_sets = {
        "static": ["LIMIT_BAL"],
        "behavioural": [
            "LIMIT_BAL",
            "PAY_0",
            "PAY_2",
            "PAY_3",
            "PAY_4",
            "PAY_5",
            "PAY_6",
        ]
        + [f"BILL_AMT{i}" for i in range(1, 7)]
        + [f"PAY_AMT{i}" for i in range(1, 7)],
    }
    Xall = df[feature_sets["behavioural"]]
    y = df[target].to_numpy(dtype=int)
    groups = pd.util.hash_pandas_object(Xall, index=False).to_numpy()
    # Identical feature profiles cannot appear across train/validation/test.
    splitter = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=SEED)
    folds = list(splitter.split(Xall, y, groups))
    test_idx, valid_idx = folds[0][1], folds[1][1]
    train_idx = np.setdiff1d(np.arange(len(df)), np.concatenate([test_idx, valid_idx]))
    # Split validation by grouped profiles too, so calibration and policy selection are independent.
    subfold = StratifiedGroupKFold(n_splits=2, shuffle=True, random_state=SEED + 1)
    tune_pos, cal_pos = next(
        subfold.split(Xall.iloc[valid_idx], y[valid_idx], groups[valid_idx])
    )
    tune_idx, cal_idx = valid_idx[tune_pos], valid_idx[cal_pos]
    for a, b in [
        (train_idx, valid_idx),
        (train_idx, test_idx),
        (valid_idx, test_idx),
        (tune_idx, cal_idx),
    ]:
        assert not set(groups[a]) & set(groups[b])
    candidates = {
        "Logistic regression": lambda k: make_pipeline(
            SimpleImputer(strategy="median"),
            StandardScaler(),
            LogisticRegression(C=[0.1, 1][k], max_iter=1500, random_state=SEED),
        ),
        "XGBoost": lambda k: XGBClassifier(
            n_estimators=220,
            max_depth=[3, 5][k],
            learning_rate=0.05,
            subsample=0.9,
            colsample_bytree=0.9,
            reg_lambda=5,
            n_jobs=4,
            random_state=SEED,
            eval_metric="logloss",
        ),
        "CatBoost": lambda k: CatBoostClassifier(
            iterations=220,
            depth=[4, 6][k],
            learning_rate=0.05,
            l2_leaf_reg=5,
            random_seed=SEED,
            verbose=False,
            thread_count=4,
            allow_writing_files=False,
        ),
    }
    results = []
    predictions = {}
    for group_name, columns in feature_sets.items():
        X = df[columns]
        for model_name, factory in candidates.items():
            started = time.time()
            options = []
            for k in range(2):
                model = factory(k)
                model.fit(X.iloc[train_idx], y[train_idx])
                score = roc_auc_score(
                    y[tune_idx], model.predict_proba(X.iloc[tune_idx])[:, 1]
                )
                options.append((score, k, model))
            _, chosen, model = max(options, key=lambda t: t[0])
            # Platt scaling fitted to a distinct calibration partition inside validation.
            calibrator = LogisticRegression(C=1e6, random_state=SEED).fit(
                raw_logit(model.predict_proba(X.iloc[cal_idx])[:, 1]), y[cal_idx]
            )
            predict = lambda idx: calibrator.predict_proba(
                raw_logit(model.predict_proba(X.iloc[idx])[:, 1])
            )[:, 1]
            vp, tp = predict(tune_idx), predict(test_idx)
            key = f"{group_name}-{model_name}"
            model_dir = ROOT / "artifacts/models"
            model_dir.mkdir(parents=True, exist_ok=True)
            joblib.dump(
                {
                    "model": model,
                    "calibrator": calibrator,
                    "features": columns,
                    "source_sha256": hashlib.sha256(raw).hexdigest(),
                    "target": target,
                },
                model_dir / (key.replace(" ", "-") + ".joblib"),
            )
            predictions[key] = tp
            calibration_y, calibration_p = calibration_curve(
                y[test_idx], tp, n_bins=8, strategy="quantile"
            )
            policy_points = []
            for approval in (0.3, 0.5, 0.7):
                threshold = float(np.quantile(vp, approval))
                accepted = tp <= threshold
                # Matched-volume retrospective ranking uses no outcome labels to select borrowers.
                count = int(len(tp) * approval)
                ranked = np.argsort(tp, kind="stable")[:count]
                actual_y = y[test_idx][accepted]
                rate = float(np.mean(actual_y)) if len(actual_y) else None
                n = len(actual_y)
                if n:
                    z = 1.96
                    center = (rate + z * z / (2 * n)) / (1 + z * z / n)
                    half = (
                        z
                        * np.sqrt(rate * (1 - rate) / n + z * z / (4 * n * n))
                        / (1 + z * z / n)
                    )
                    ci = [float(center - half), float(center + half)]
                else:
                    ci = None
                policy_points.append(
                    {
                        "target_approval": approval,
                        "validation_threshold": threshold,
                        "test_approval": float(accepted.mean()),
                        "test_adverse_rate": rate,
                        "adverse_rate_ci": ci,
                        "approved_count": int(n),
                        "matched_volume_adverse_rate": float(
                            y[test_idx][ranked].mean()
                        ),
                        "matched_volume_count": count,
                    }
                )
            # Feature contributions explain the base model's log odds, NOT calibrated PD.
            sample_indices = test_idx[:12]
            sample_X = X.iloc[sample_indices]
            if model_name == "CatBoost":
                values = model.get_feature_importance(
                    catboost.Pool(sample_X, label=y[sample_indices]), type="ShapValues"
                )[:, :-1]
            elif model_name == "XGBoost":
                values = model.get_booster().predict(
                    xgboost.DMatrix(sample_X), pred_contribs=True
                )[:, :-1]
            else:
                values = model[:-1].transform(sample_X) * model[-1].coef_[0]
            samples = []
            for j, idx in enumerate(sample_indices):
                contributions = [
                    {
                        "feature": c,
                        "value": float(X.iloc[idx][c]),
                        "contribution": float(values[j, k]),
                    }
                    for k, c in enumerate(columns)
                ]
                contributions.sort(key=lambda t: abs(t["contribution"]), reverse=True)
                samples.append(
                    {
                        "borrower_id": str(df.iloc[idx]["ID"]),
                        "actual_outcome": int(y[idx]),
                        "probability": float(tp[j]),
                        "contributions": contributions[:6],
                    }
                )
            result = {
                "id": key,
                "model": model_name,
                "feature_set": group_name,
                "features": columns,
                "chosen_candidate": chosen,
                "validation_auc": float(max(options, key=lambda t: t[0])[0]),
                "metrics": metrics(y[test_idx], tp),
                "confidence_intervals": intervals(y[test_idx], tp, rounds),
                "calibration": [
                    {"predicted": float(a), "observed": float(b)}
                    for a, b in zip(calibration_p, calibration_y)
                ],
                "policy_points": policy_points,
                "samples": samples,
                "seconds": round(time.time() - started, 2),
            }
            results.append(result)
            print(
                json.dumps(
                    {
                        "finished": key,
                        "metrics": result["metrics"],
                        "seconds": result["seconds"],
                    }
                ),
                flush=True,
            )
    # Choice is made on validation AUC, never test metrics.
    selected = max(results, key=lambda r: r["validation_auc"])["id"]
    report = {
        "status": "complete",
        "dataset": "UCI Taiwan Default of Credit Card Clients",
        "source": SOURCE,
        "source_page": "https://archive.ics.uci.edu/dataset/350/default+of+credit+card+clients",
        "license": "CC BY 4.0",
        "attribution": "Yeh, I. (2009). Default of Credit Card Clients. UCI Machine Learning Repository. DOI: 10.24432/C55S3H.",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "source_sha256": hashlib.sha256(raw).hexdigest(),
        "target": "Default payment next month, as supplied by UCI; not a Malaysian or 12-month default estimate.",
        "selection": "Two candidates per model and feature set; tune on validation AUC, Platt-calibrate on separate validation subset; select final model by validation AUC.",
        "split_method": "60/20/20 approximately stratified, grouped by identical permitted feature profiles. No reliable borrower application dates; this is not temporal validation.",
        "audit": {
            "rows": len(df),
            "unique_ids": int(df.ID.nunique()),
            "adverse_outcomes": int(y.sum()),
            "missing_feature_cells": int(Xall.isna().sum().sum()),
            "duplicate_feature_profiles": int(pd.Series(groups).duplicated().sum()),
            "train": len(train_idx),
            "validation_tuning": len(tune_idx),
            "validation_calibration": len(cal_idx),
            "test": len(test_idx),
            "test_adverse_outcomes": int(y[test_idx].sum()),
            "train_adverse_outcomes": int(y[train_idx].sum()),
            "validation_adverse_outcomes": int(y[valid_idx].sum()),
            "group_overlap": 0,
        },
        "limitations": [
            "Taiwan credit-card customers in 2005; no evidence of Malaysian worker or microbusiness performance.",
            "Static comparator contains credit limit only. It is a deliberately limited comparator, not a lender's conventional scorecard.",
            "Behavioural variables are monthly card repayment/bill/payment histories, not bank-account cash flow.",
            "Sex, education, marriage, age and identifiers are excluded from predictive features; exclusion does not establish fairness.",
            "Approved borrowers only: this cannot validate outcomes for historically rejected applicants.",
            "95% bootstrap intervals measure test-sample uncertainty conditional on fitted models, not training or country-shift uncertainty.",
            "Matched-volume results are retrospective ranking comparisons. Frozen validation thresholds are reported separately; ties can change achieved approval rates.",
            "Feature contributions explain base-model log odds, not causal effects or additive changes in calibrated probabilities.",
        ],
        "selected_model": selected,
        "bootstrap_rounds": rounds,
        "seed": SEED,
        "versions": {
            "python": platform.python_version(),
            "sklearn": sklearn.__version__,
            "xgboost": xgboost.__version__,
            "catboost": catboost.__version__,
        },
        "results": results,
    }
    out = ROOT / "artifacts"
    out.mkdir(exist_ok=True)
    (out / "benchmark.json").write_text(json.dumps(report, indent=2, allow_nan=False))
    split = {
        "train": df.iloc[train_idx].ID.tolist(),
        "validation_tuning": df.iloc[tune_idx].ID.tolist(),
        "validation_calibration": df.iloc[cal_idx].ID.tolist(),
        "test": df.iloc[test_idx].ID.tolist(),
    }
    (data_dir / "benchmark-splits.json").write_text(json.dumps(split))
    print("Report saved to artifacts/benchmark.json", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--bootstrap", type=int, default=200)
    args = parser.parse_args()
    if args.bootstrap < 20:
        parser.error("Use at least 20 bootstrap rounds.")
    train(args.bootstrap)
