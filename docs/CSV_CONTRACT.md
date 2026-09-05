# Transaction input contract

POST `/api/transactions/parse` accepts a multipart file named `file`. Parsing returns transactions; it **does not** run or save an assessment. POST `/api/assessments` accepts applicant, policy, transactions, period_start, period_end, simulated and optional previous_assessment_id. See the live FastAPI `/docs` for the complete schema.

## CSV

Exactly these six headers (any column order), UTF-8 with optional BOM:

```csv
transaction_id,date,amount,balance,description,category
TX001,2026-01-03,3200.00,8200.00,Client invoice payment,income
TX002,2026-01-07,-800.00,7400.00,Operating supplies,expense
```

Single MYR account only; no foreign-currency conversion or multiple-account consolidation. Maximum 5 MB, 20,000 rows, three years of coverage. Amounts are finite numbers: positive credits, negative debits. Balances may be blank, but otherwise must be finite. Thousands separators should not appear in numeric values.

Dates use ISO YYYY-MM-DD. Full statement period is explicitly supplied separately; it must include all rows and cannot end in the future. A partial first or last month is displayed but excluded from capacity. Zero-transaction months inside the declared coverage are retained with zero income and flagged for review. Coverage is user asserted; the CSV does not prove completeness.

Transaction IDs must be stable. Exact repeated records with the same ID are removed and counted. Conflicting records sharing an ID are rejected. Identical date/amount/description/balance records with different IDs are retained and flagged for manual review. Transactions sort by date then ID; use chronologically sortable IDs within a day. The last record's balance is the closing observation; missing final balance does not silently reuse a stale balance.

## Categories

| Category | Meaning | Treatment |
| --- | --- | --- |
| income | Earned/operating revenue, positive | Recognised income |
| expense | Operating costs or refunds, negative | Deducted costs |
| household | Household needs / business-owner household draw, negative | Monthly maximum of observed outflows and declared needs |
| debt | Existing loan/financing payments, negative | Monthly maximum of observed payments and declared obligations |
| transfer | Confirmed own-account movement, either sign | Excluded from income and expense; raw totals still include it |
| unknown | Unresolved category, either sign | Positive excluded, negative treated as operating expense; review flag |

Descriptions containing “own account”, “internal transfer” or “self transfer”, unless already categorised transfer, are flagged. Positive suspected transfers are excluded from revenue; negative suspected transfers remain conservative costs until resolved. This heuristic is not trained transaction classification or fraud detection. Financing proceeds are not earned income: classify appropriately before assessing. Inputs and categories are not independently verified.

## Capacity calculation

For each complete month:

1. Household use = max(recorded household outflows, declared monthly household needs).
2. Debt use = max(recorded debt outflows, declared monthly debt).
3. Surplus = recognised income − operating expense − household use − debt use.
4. Stressed surplus = income × (1 − income shock) − (operating expense + household use) × (1 + expense shock) − debt use.
5. Monthly new-debt capacity = max(0, median(monthly stressed surplus)) × capacity share.
6. Convert capacity to principal with the standard monthly reducing-balance annuity formula, using requested tenure and illustrative annual rate / 12. Zero rate uses principal / tenure.

Default demonstration settings: 20% income reduction, 10% expense increase, 50% allocation, 12% annual interest, six complete months. These are chosen research assumptions, not Malaysian regulatory requirements or lender-approved rates. Workers protect household living expenses; businesses protect owner household draw using the same transparent floor logic. Do not add declared costs again where recorded costs already cover them.

Liquidity buffer = non-negative latest observed balance / (median operating expense + median household use + median debt use), when denominator and balance are available. This is an observed-balance estimate, not daily liquidity analysis. Monthly income volatility is population standard deviation / mean over complete months. Greater than 50% prompts review; this threshold is a demonstration heuristic.

Outcomes are INSUFFICIENT_DATA, REFER, EXCEEDS_CAPACITY or WITHIN_CAPACITY. Short history takes priority, then review flags, then repayment comparison. Any displayed capacity for insufficient or disputed evidence is provisional. Default probability and credit-risk band always remain null. There is no fraud probability.
