# Training data readiness

The implemented benchmark already trained on the original UCI Taiwan dataset. It was not fed blindly into a classifier. The cached source was inspected again on 6 September 2026, and its SHA-256 matches the frozen benchmark's source.

## Verified source checks

| Check | Result |
| --- | --- |
| Borrowers / unique IDs | 30,000 / 30,000 |
| Adverse outcomes | 6,636 |
| Missing model-feature cells | 0 |
| Nonfinite model-feature cells | 0 |
| Repeated permitted feature profiles | 817; grouped within the same partition rather than deleted |
| Negative bill-amount cells | 3,932; preserved as supplied, not automatically treated as errors |
| Observed repayment-status codes | -2, -1, 0, 1–8; preserved |
| Source hash agrees with fitted benchmark | Yes |

The source contains unusual education and marital-status codes too, but these columns are excluded from the current model. Recoding them would not affect the current benchmark.

## Preprocessing already implemented

- Read the correct spreadsheet header and normalize column-name whitespace.
- Validate IDs and the original binary target; explicitly select the allowed predictive columns.
- Exclude identifiers, age, sex, education and marital status from prediction.
- Group identical model-feature profiles so they cannot cross training, validation or test partitions. The validation tuning and calibration subsets are grouped separately too.
- Fit logistic regression's median imputer and standard scaler inside its training pipeline. Since the observed source has no missing feature cells, imputation does not replace any current source values.
- Feed source numeric features to XGBoost and CatBoost without unnecessary scaling. No synthetic augmentation, SMOTE, outcome recoding, outlier clipping or global preprocessing fit is used.
- Select model candidates and thresholds with validation data; fit calibration on a separate validation subset. The held-out test set is not used for tuning.

## What was strengthened now

`benchmark/audit.py` makes column, numeric, nonfinite, limit/payment sign and repayment-code validation repeatable. `benchmark/train.py` calls this before any future training. The audit reports unusual retained values explicitly. Existing model files and benchmark metrics were not overwritten or retrained.

Run `uv run python -m benchmark.audit` to check the cached source against the saved benchmark. Unexpected source drift fails validation rather than being silently cleaned away.

## Is more cleanup needed?

**The data is suitable for this disclosed baseline benchmark, with the existing preprocessing and the new validation checks.** No missing-value cleanup is needed for this source. However, benchmark-ready does not mean every modelling choice is optimal:

- UCI documents some repayment-status meanings but does not explain -2 and 0 in the linked variable description. We retain those codes without inventing a meaning. Treating all codes as numeric, especially in logistic regression, is an explicit baseline assumption. Alternative encodings should be tested in a predeclared validation experiment.
- Negative bill amounts are not automatically invalid. Their precise semantics need source support; we preserve them rather than asserting they are all refunds or clipping them to zero.
- Large monetary values are retained. Any transforms or outlier policy must be chosen using training/validation data, not adjusted to improve the already-viewed test score.
- Credit limit alone is a weak static comparator, not a complete traditional scorecard. A stronger comparator is a research improvement, not spreadsheet cleanup.
- The benchmark is not chronological validation and cannot establish Malaysian worker/microbusiness performance.

The new fictional evidence pack is only for product testing. It is not added to this training dataset. Personal statements also remain separate from the training benchmark.

Source and variable definitions: [UCI Default of Credit Card Clients](https://archive.ics.uci.edu/dataset/350/default+of+credit+card+clients). UCI identifies 30,000 records, no missing values, monthly repayment/bill/payment histories and a binary default target. The original dataset is licensed CC BY 4.0; attribution is retained in the benchmark report.
