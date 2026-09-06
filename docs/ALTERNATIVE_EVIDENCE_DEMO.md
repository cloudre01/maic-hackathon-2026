# Demo: what alternative evidence changes

Priorities 1–4 are implemented together in **Document intake → Try Aina’s alternative-data story**.

## Rehearse this sequence

1. Load the story. It contains nine independently fictional PDFs: six bank months, an earnings record, utility payment records and a PayLater schedule, all for fictional Aina. The downloadable ZIP can also be extracted and uploaded through **Choose documents**.
2. Reveal values and check the six reconciled bank months. The credits labelled CLIENT CREDIT remain unknown until reviewed. Own-account transfers are excluded from earned income.
3. In **Connect income and commitments**, inspect the amount/date/reference candidates and their source page/row. Choose **Confirm 18 reference matches after review**. This confirms six earnings, six utility and six historic debt-payment matches.
4. Inspect the four unmatched items: a RM99 payout absent from the bank account, plus three future scheduled installments with no payment evidence. No cash rows are added for these items. Missing payment dates are not labelled defaults.
5. Review the schedule and choose **Confirm displayed schedule after review**. Historic installments are RM250/month; the separately identified new plan schedules RM750/month in July–September. Repeated remaining-balance snapshots are displayed, not summed. The fictional evidence snapshot is 30 June 2026.
6. Confirm application inputs: RM8,000 over 12 months, household needs RM1,600/month, declared debt RM250/month. Confirm the four final review checks.
7. Choose **Compare evidence impact**. It calculates without creating a saved assessment:

| Stage | Recognized monthly income (median) | Monthly capacity | Explanation |
| --- | ---: | ---: | --- |
| Bank categories + declared obligations | RM0 | RM0 | Unconfirmed incoming credits are not assumed to be earnings; result requests analyst review. |
| Confirmed bank matches | RM6,600 | RM1,195 | Confirmed payouts become earned income. Utility payments become household costs, preventing duplication against the household floor. |
| Confirmed matches + schedule floor | RM6,600 | RM945 | Confirmed scheduled debt raises the floor from RM250 to RM750. This reduces capacity by RM250 at the 50% capacity-share policy. |

8. Choose **Calculate reviewed assessment** to save. Requested repayment is about RM711/month, still within the fictional final capacity. The comparison, original baseline inputs, category actions, schedule choices and source evidence persist in the audit and reappear when opened from history.

The three stages use the same 42 bank rows and the same financing/stress policy. The earnings record changes recognition of existing money, not total bank inflows. The RM99 unmatched payout never increases income. The debt floor uses the greater of declared debt and the peak confirmed monthly schedule, and each month's cash-flow calculation uses the greater of this floor and observed bank debt. It does not add the same debt twice.

## Suggested narration

“A bank credit alone may not explain where the money came from. Here the earnings record helps the analyst confirm the source. Utility and repayment records connect to the same bank ledger, so we avoid counting the payment twice. More evidence can also lower capacity: the schedule reveals a larger commitment. Every change is traceable. This is a policy-based affordability comparison, not a newly validated credit score.”

## Supported matching format and limits

The new structured PDFs use the documented **ARUS EVIDENCE V1** template. They demonstrate extraction and matching across sources; they are not replicas of a provider's proprietary statement format or evidence of a live provider integration.

Each document includes `RECORD COUNT: N`, followed by pipe-separated rows:

```
kind|reference|date|amount|due_date|paid_date|contract|balance
payout|PAY01|2026-01-03|5800.00|-|-|-|-
utility|UTIL01|2026-01-01|120.00|2026-01-25|2026-01-19|-|-
repayment|OLD01|2026-01-01|250.00|2026-01-25|2026-01-22|OLDPLAN|1250.00
```

Amounts are positive MYR values. Payout dates are settlement dates; utility/repayment matching uses the paid date. `-` means unavailable. Repayment records require contract and due date. Balances are source-reported snapshots. Row-count mismatch, invalid dates and nonfinite amounts fail parsing.

Candidate matching requires the correct direction, amount agreement and dates within three days. A unique matching reference is labelled as such; amount/date-only and multiple candidates remain explicit. Nothing is applied without analyst confirmation. A bank transaction cannot be used twice, and duplicate contract/due-date schedule rows are rejected. Document selection changes clear confirmations. Inputs changing after preview make the comparison stale until recalculated.

The original TNB/Grab/PayLater personal formats retain their existing conservative extraction. They are not silently upgraded into structured schedules when fields are absent. Arbitrary earnings statements and other provider layouts still need adapters or a reviewed export into the documented template. Source authenticity and complete liabilities remain unverified.

Worker and business cases still share the demonstration affordability engine. This feature adds evidence provenance and sensitivity analysis, not a trained Malaysian default model. No private statements or fictional demo rows were added to model training.

## Validation

Tests cover upload/ZIP extraction, all three numerical stages, unchanged bank totals/row counts, no effect from unconfirmed evidence, schedule floors without double counting, stale selections, duplicate evidence, ambiguous matches, invalid amounts, missing source rows, preview without persistence, and saved comparison history. See the latest test run and `docs/VALIDATION.md`.
