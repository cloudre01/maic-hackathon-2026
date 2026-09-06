# Arus — Malaysia alternative-credit prototype

A local lender workspace for workers with irregular income and microbusinesses. **Affordability is a policy calculation, not a loan approval.** Malaysian demonstration assessments never inherit probabilities from the public-data benchmark.

## Run locally

Prerequisites: Python 3.12, Node.js 20.9+, `uv`, Poppler and Tesseract (`brew install poppler tesseract` on macOS).

```sh
uv sync --frozen
npm ci
```

In one terminal:

```sh
uv run uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

In another:

```sh
npm run dev
```

Open http://127.0.0.1:3000. API documentation: http://127.0.0.1:8000/docs. The frontend proxies `/api` to the local Python service. Override `ARUS_API_URL` if needed. `ARUS_DB` selects a different SQLite file. Defaults live in `data/arus.sqlite3`.

This is a local demonstration with no authentication, encryption-at-rest, lender integration or identity verification. Use fictional data for public demos; do not expose this service publicly. Document extraction and OCR run locally. Fonts are bundled locally. Extracted evidence persists in the ignored local database. See [Document demo guide](docs/DOCUMENTS.md).

## Demonstration walkthrough

1. Select **Irregular-income worker** and run an assessment. Six complete months produce RM1,195 monthly repayment capacity under the initial demonstration policy, versus approximately RM711 requested repayment. Malaysian default probability remains unavailable.
2. Inspect the income/cost chart, review points, reason codes and monthly calculations. Open **Policy** to see every stress assumption.
3. Choose **Add next demo month**. The history expands to seven months and a new record links to the previous assessment.
4. Select **Seasonal microbusiness**. Its requested financing exceeds calculated capacity. Business-owner household draw remains protected.
5. Select **Limited history**. Two complete months trigger insufficient evidence rather than an invented score.
6. Choose **New application**, enter the applicant details, upload a documented CSV, confirm full statement coverage and mark simulated records appropriately.
7. Open **Model benchmark** for actual six-experiment results. Explore calibration, matched approval volumes, frozen validation thresholds and held-out borrower explanations.
8. Open **Assessment history** and export an assessment JSON. Results retain engine version, policy, inputs fingerprint, reasons and creation time. Exact original inputs are stored in SQLite.

## Public-data benchmark

```sh
uv run python -m benchmark.train
```

Downloads the original UCI Taiwan XLS archive, audits it and runs logistic regression, XGBoost and CatBoost against two evidence sets. Each experiment gets two candidates and the same grouped splits. The completed result is `artifacts/benchmark.json`; raw data and split IDs remain under ignored `data/`. Fitted models, calibration objects, feature order and source fingerprint are saved under ignored `artifacts/models/`. Load only these locally generated joblib files, never untrusted model files. The included report contains real results, not placeholder metrics.

- Static comparison: credit limit only. This is a deliberately limited comparator, **not a conventional lender scorecard**.
- Behavioural comparison: credit limit and six months of payment status, bill amounts and payment amounts.
- Target: UCI's **default payment next month**. Do not relabel as 12-month default.
- Roughly 60/20/20 splits, grouped so identical permitted feature profiles cannot cross train/validation/test. Validation is further divided into tuning/threshold and calibration partitions. Application dates are unavailable; this is not a temporal holdout.
- Excluded from prediction: IDs, sex, education, marital status and age. This does not demonstrate fairness.
- Choose candidates on validation AUC, fit Platt calibration on a distinct validation subset, freeze validation thresholds, then evaluate test data. Final selection uses validation AUC only.
- ROC-AUC, PR-AUC, Brier, eight quantile calibration bins and 95% percentile bootstrap intervals (200 rounds). The bootstrap conditions on fitted models; it does not quantify training or country-shift uncertainty.
- Matched-volume rankings select equal counts without using test labels. Separate frozen-threshold results show realised test approval/adverse rates and Wilson intervals. Ties can affect the actual approval rate; no extra Malaysian approvals are claimed.
- LR contributions are standardised-input coefficient products. XGBoost and CatBoost contributions use their native TreeSHAP implementations. All contributions explain **base-model log odds**, not causal effects or additive calibrated probability changes.

Home Credit remains the preferred follow-up after confirming its permitted use for this prototype/competition. Taiwan is the implemented fallback because UCI explicitly licenses it under CC BY 4.0. No Home Credit model or Malaysian PD model is claimed. Berka, TabPFN, sequence models and synthetic augmentation are optional future experiments, not hidden dependencies.

Dataset attribution: Yeh, I. (2009). *Default of Credit Card Clients*. UCI Machine Learning Repository. DOI: https://doi.org/10.24432/C55S3H. Source: https://archive.ics.uci.edu/dataset/350/default+of+credit+card+clients. License: https://creativecommons.org/licenses/by/4.0/.

## Validation

```sh
uv run pytest -q
npm run typecheck
npm run build
```

Browser regression cases are in `e2e/workflow.spec.ts`. With both services running, use `npx playwright install chromium` and `npx playwright test`. They cover assessment, policy changes, extended history, scenario distinctions, measured benchmark results, CSV upload and mobile overflow. Browser testing creates only simulated local assessment records.

## Structure

- `backend/`: validated API, deterministic cash-flow engine, fictional scenarios and SQLite audit storage.
- `benchmark/`: source audit, common splits, model selection, calibration and evaluation.
- `app/`: responsive Next.js dashboard and charts.
- `tests/`, `e2e/`: financial calculation/API checks and browser regression scenarios.
- `docs/`: input contract, methodology and limitations.

No real approvals, lending, pricing offers, fraud classification, arbitrary PDF layouts, live connectors or synthetic model-training data are included.
