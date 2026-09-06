# Validation record

## Completed checks

- 31 Python tests passed: existing financial/model tests plus document upload, exact-file deduplication, ledger reconciliation, mixed accounts, gaps, overlapping statements, review confirmations, evidence provenance and supporting-record separation.
- Browser scenarios cover policy edits and reassessment/history, business and short-history outcomes, six benchmark experiments, mobile overflow, CSV upload, document review-to-assessment and mobile PDF upload/discard.
- TypeScript type checking passed. Next.js optimized production build passed.
- Desktop layout and 390px mobile layout inspected. Mobile document width equals viewport width; CSV and assessment controls remain accessible.
- Source archive downloaded from UCI, audited, and fingerprinted. Six fitted model/calibration bundles reproduce their recorded held-out predictions.

## Measured benchmark results

30,000 real Taiwan credit-card clients; 6,636 adverse outcomes. Split: 18,002 training, 2,999 validation tuning/threshold, 2,999 validation calibration, 6,000 held-out test. Test set has 1,327 adverse outcomes. The 817 repeated feature profiles are kept in the same partition. No feature-profile overlap crosses partitions.

| Evidence | Model | ROC-AUC | PR-AUC | Brier |
| --- | --- | ---: | ---: | ---: |
| Credit limit only | Logistic regression | 0.609 | 0.297 | 0.169 |
| Credit limit only | XGBoost | 0.609 | 0.297 | 0.168 |
| Credit limit only | CatBoost | 0.609 | 0.297 | 0.168 |
| Credit limit + payment history | Logistic regression | 0.714 | 0.500 | 0.146 |
| Credit limit + payment history | XGBoost | 0.784 | 0.553 | 0.134 |
| Credit limit + payment history | CatBoost | 0.786 | 0.555 | 0.134 |

CatBoost with payment history was selected using validation AUC. Its held-out ROC-AUC 95% bootstrap interval is approximately 0.772–0.799; XGBoost's is 0.769–0.797. The point estimates are close; no statistically decisive superiority claim is made.

At 50% matched retrospective approval volume (3,000 test borrowers), adverse-outcome rates were approximately 12.9% for behavioural logistic regression, 9.3% for behavioural XGBoost and 8.6% for behavioural CatBoost. These are descriptive public-data comparisons. They are not observed Malaysian lending results, and selecting a matched volume is distinct from deploying a frozen probability threshold.

The machine-readable report contains unrounded metrics, confidence intervals, frozen validation thresholds, calibration bins, source hash, dependency versions, seed, limitations and sample explanations: `artifacts/benchmark.json`.

## Demonstration assessment outcomes

- Aina Rahman: six months; RM6,600 median recognised income; RM1,195 monthly capacity versus RM710.79 requested repayment. Within demonstration capacity.
- Add seventh month: monthly capacity becomes RM1,235 and a linked assessment is saved.
- Increasing income reduction to 40% after that extension yields RM565 monthly capacity and exceeds-capacity outcome.
- Dapur Nuri: seasonal business request exceeds demonstration capacity.
- Ravi Kumar: two complete months, insufficient evidence.
- Malaysian default probability and credit-risk band stay unavailable in all cases.

## Remaining boundaries

The included benchmark uses Taiwan, not Home Credit, because Home Credit reuse permissions remain unconfirmed. It is not chronological validation, a Malaysian model, a real conventional-scorecard comparison, a fairness certification or reject inference. Local document ingestion supports tested layouts with human review; it is not a production document-security service. The prototype has no authentication, fraud model, live connector or automatic lending action. Demonstration policies are editable research assumptions. See DOCUMENTS.md for privacy boundaries.
