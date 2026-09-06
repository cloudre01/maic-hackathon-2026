# Arus: live pitch and demo kit

Prepared 6 September 2026. This kit describes the implemented local prototype. Personas and demonstration transactions are fictional. Customer demand, time savings and lending uplift remain hypotheses to validate.

## The positioning

**Arus helps lending teams turn fragmented financial records into a reviewable cash-flow assessment for workers and microbusinesses with irregular income.**

Lead with the evidence workflow: documents → reviewed transactions and obligations → stressed repayment capacity → an explanation a lender can inspect. Keep the Taiwan model benchmark as supporting research, not the headline or a score applied to uploaded Malaysian documents.

The strongest honest selling point today is that the product makes economic activity legible: separating earned income from transfers, protecting household needs, checking evidence completeness and exposing assumptions. Uploading many document types is not itself a predictive breakthrough. The next research question is which additional sources improve decisions, and by how much.

Do not claim conventional lenders ignore cash flow or that Arus invented cash-flow underwriting. Our proposed advantage is a focused, accessible workflow for fragmented Malaysian evidence. Faster review, improved consistency and better access to suitable financing are outcomes to test, not results already measured.

## Who buys it, who uses it, who benefits?

**Initial customer hypothesis:** a Malaysian microfinance provider, cooperative or financing platform with analysts manually reviewing small productive-financing applications. Prioritize a team that already receives bank statements and has a clear pain point reconciling irregular income. This is a partner-search hypothesis, not a claim of existing customers.

**Daily user:** a credit analyst preparing a case for an authorized lending decision-maker. The analyst reviews extraction, categories, obligations and policy assumptions. Arus does not lend money or issue approvals.

**Beneficiary:** an applicant with observable economic activity whose income documentation does not neatly fit a fixed monthly payslip. Thin credit history and irregular income are different issues; an applicant may have either or both.

**Initial scope:** one-account cases with enough transaction history, seeking financing for work equipment, repairs or working capital. The prototype cannot recover cash income that was never recorded or establish the full financial position from one account alone.

| Fictional persona | Need and difficulty | What the demo shows |
| --- | --- | --- |
| Aina Rahman, freelance designer | RM8,000 laptop/equipment financing over 12 months. Client payments vary by month; a payslip alone cannot describe her income. | Six months of income, business costs, household needs, existing obligations and excluded self-transfers. RM1,195 policy-based monthly capacity versus about RM711 requested repayment. |
| Dapur Nuri, home-based food business | RM20,000 inventory financing over 18 months. Revenue has a seasonal spike and must cover ingredients, packaging and the owner's household draw. | High sales are not the same as free cash. Requested repayment exceeds capacity under the demo assumptions. |
| Ravi Kumar, delivery partner | RM5,000 motorcycle repairs, but only two months of records. | Insufficient evidence. The system requests a stronger evidence base rather than manufacturing confidence. |

Choose **Aina as the main story**, Dapur Nuri as a short second case, and Ravi only if time permits. These personas already exist in the dashboard. They are not real approved borrowers and their outcomes do not prove that a lender previously rejected them incorrectly.

## Alternative data: what actually works today?

| Evidence source | Current implementation | What it contributes today | What it does not establish |
| --- | --- | --- | --- |
| Bank statement PDFs in the tested layout | Local extraction; opening/closing and debit/credit reconciliation; account and period checks; row/page references; category review | Recognized income, costs, volatility, observed balances, completeness and stressed capacity | Authenticity, all-account obligations or default probability. Arbitrary bank layouts are unsupported. |
| Documented transaction CSV | Upload and validation; reviewed transaction categories | Same cash-flow calculation; can represent properly prepared platform or merchant records | A live platform integration or automatic verification of the source |
| TNB bills | Selected bill and prior-payment facts extracted locally | Supporting evidence an analyst can inspect | A validated payment-reliability score; one recorded payment does not establish timeliness |
| Grab passenger transaction history | Activity summary and currencies extracted | Supporting activity evidence, with explicit interpretation limits | Driver earnings or PayLater repayment performance |
| PayLater screenshots | Local OCR of selected headings/transaction facts, with review warnings | Supporting evidence for reviewing commitments; analyst declares total monthly debt | Complete outstanding debt, verified repayment purpose or on-time payment without due-date evidence |
| Household needs and existing debt declared by applicant/analyst | Editable inputs, retained in the assessment | Protects household needs and accounts for commitments outside the observed account | Independently verified liabilities |

**Critical distinction:** bank ledger rows drive the document-based cash-flow calculation. Bills and screenshots are retained separately and do not create extra expenses that would duplicate bank payments. The app does not currently reconcile every supporting bill to its matching bank transaction automatically.

The business scenario includes fictional DuitNow merchant-settlement descriptions. That demonstrates the intended normalized transaction representation; it is not an implemented DuitNow connector. Similarly, a fictional platform payout is not evidence that we have integrated with Grab's driver platform.

### Best sources to add next

1. **Gig earnings and merchant settlement statements:** net payouts after fees/refunds, dates, reversals and source identifiers. These could corroborate bank credits and separate sales from transfers. Prioritize driver earnings rather than passenger spending.
2. **Complete repayment schedules and payment histories:** installment amount, due date, payment date, remaining balance and arrears. These are more useful for repayment behaviour than purchase screenshots alone.
3. **Microbusiness operating records:** invoices, supplier payments, recurring overheads and settlement records. These could improve margin and working-capital interpretation, with duplicate and authenticity checks.
4. **Longer utility/rent payment histories:** only where account responsibility, billed amount, due date and actual payment can be established. Treat incremental predictive value as an experiment.

Avoid building the pitch around contacts, location trails, phone type or shopping preferences. They have no demonstrated incremental value in this prototype. Do not infer character or willingness to repay from merchants someone visits.

## What is implemented versus next?

**Working today:** local document upload and OCR; supported bank parsing; arithmetic reconciliation; rejection of mixed detected accounts, missing/overlapping months and mismatched balances; explicit category and obligation review; separate worker/business labels and household treatment; editable stress policy; cash-flow metrics and reasons; saved assessment inputs/history/export; fictional scenarios; scenario reassessment after one additional month; a separate real-data benchmark.

Worker and business cases currently share the same underlying affordability formula. The household input is presented as living costs or owner draw. We have not trained separate Malaysian worker and business models or implemented a specialized business working-capital model.

The built-in **Add next demo month** flow links assessments. The document intake flow currently creates a new assessment for an uploaded set; it does not automatically append a new statement to a previous document batch. Do not present that as implemented continuity.

**Measured research:** Taiwan data, 30,000 clients, 6,000 held-out test cases. Behavioural CatBoost ROC-AUC is approximately 0.786 (95% bootstrap interval approximately 0.772–0.799). This is ranking performance, not “78.6% accurate.” XGBoost is close at approximately 0.784. The target is the dataset's default-payment-next-month outcome.

The comparison uses credit limit alone versus credit limit plus repayment/bill/payment history. Credit limit alone is a deliberately limited comparator, not a complete conventional credit scorecard. These results do not validate Malaysian bank cash flow, utility bills, screenshots or additional approvals for rejected applicants.

**Not implemented:** validated Malaysian default scores, automatic bill-to-bank matching, live financial connectors, general bank-PDF parsing, identity/authenticity/fraud checks, production authentication or encryption at rest, automatic lending, and proven predictive uplift from local alternative data. Home Credit has not been trained; reuse permissions remain unconfirmed.

## A 90-second pitch you can say aloud

“Meet Aina, a freelance designer who needs a laptop to take on more work. Her clients pay at different times. A single month's income or a payslip requirement does not tell the full story of what she can afford.

Arus is a lender workspace that turns financial records into a reviewable cash-flow assessment. The analyst uploads bank statements and supporting records such as utility bills or PayLater histories. Arus extracts the supported evidence locally, checks the bank arithmetic and makes uncertainty visible.

We then separate earned income from transfers, account for operating costs, protect household needs and include existing debt. The lender can stress income and expenses and see the resulting repayment capacity, together with the inputs and reasons.

In our fictional Aina example, the requested installment fits within the demonstration capacity. A seasonal business and a short-history applicant produce different outcomes. We are showing an evidence-based review process, not promising everyone a loan.

Today the document workflow works end to end. Our separate public-data benchmark reaches about 0.786 ROC-AUC, but we do not apply that score to Malaysian applicants. Next, we want to validate the workflow with a lending team and test which local evidence actually improves decisions using historical outcomes.

We are looking for a design partner to help us make irregular income easier to assess, with every recommendation traceable.”

## Five-minute live walkthrough

The organizer has not yet specified duration. Rehearse this version, with a two-minute fallback below. Do not spend the opening minute explaining machine-learning algorithms.

| Time | Click/action | Say/show |
| --- | --- | --- |
| 0:00–0:35 | Open Assessments, select **Irregular-income worker** | Introduce Aina and the equipment request. All records are fictional. Explain the analyst's question: after needs and obligations, what repayment is supportable? |
| 0:35–1:20 | **Run assessment**; show the cash-flow chart and capacity | Point out variable income, about RM711 requested repayment and RM1,195 demo capacity. Explain that assumptions, not a hidden score, produce this result. |
| 1:20–2:30 | **Document intake** → **Try synthetic document pack** → **Reveal local values** | Show six parsed/reconciled bank PDFs, source references, categories and review confirmations. This is a separate fictional intake sample, not Aina's exact ledger. Explain where bills/screenshots appear and that they remain supporting evidence. |
| 2:30–3:10 | Enter or retain the document sample's application; confirm the four checks after reviewing; **Calculate reviewed assessment** | Show that uploading produces an actual saved assessment. Do not quote Aina's figures for this different document sample. Unknown credits require review and are excluded from income. |
| 3:10–3:50 | Return to **Irregular-income worker**, assess; open **Policy**, increase income reduction to 40%, **Save & assess** | Show sensitivity to reduced earnings. The requested installment now exceeds capacity in this scenario. Stress assumptions are visible and editable demo policies. |
| 3:50–4:20 | Select **Limited history**, run assessment | Insufficient evidence is a valid answer. Missing evidence does not become an invented credit score. |
| 4:20–5:00 | Optional quick benchmark glance; close with next step | “The benchmark is research evidence, separate from Malaysian assessments. Our next milestone is validating the workflow and local evidence with a lender.” Ask for a design partner. |

For a business-focused audience, replace the short-history segment with **Seasonal microbusiness** and explain owner draw, costs and seasonal revenue. If showing reassessment, use **Add next demo month** in the worker scenario and state it is the built-in simulated extension.

### Important presentational gap

The included public-safe document pack currently contains bank PDFs only. TNB, Grab and PayLater ingestion was checked locally against supplied private examples, but those files should not be shown to judges. Do not claim the synthetic pack demonstrates every supported input.

Before a broad multi-document stage demo, prepare independently fictional supporting bills/screenshots, clearly labelled as such, and rehearse their upload. Do not create them by changing a few names on the private originals: identifiers, balances, dates and merchant details can still disclose personal information. Until that public-safe pack is ready, show the supported-evidence matrix and demonstrate bank intake live.

### Two-minute version

- 20 seconds: Aina's financing need and irregular income.
- 45 seconds: run her scenario; show capacity and the household/debt assumptions.
- 35 seconds: open the synthetic document pack; show reconciliation and category review.
- 20 seconds: state the current boundary and request a lending-team design partner.

Skip benchmark charts, history export and policy editing in this version. A clear story beats rushing through every feature.

## Six-slide outline (usable as submission copy)

1. **Irregular income needs a fuller picture.** Introduce fictional Aina and the productive-financing request. Avoid unsupported market-size or exclusion statistics.
2. **Our customer is the lending team.** Show analyst, applicant and decision-maker. State the customer hypothesis and document-review problem.
3. **From documents to a reviewable assessment.** Bank PDFs/CSV → extracted evidence and supporting bills → analyst review → stressed capacity and reasons. Label supporting evidence separately from calculation inputs.
4. **Working product, three outcomes.** Aina: within demo capacity. Dapur Nuri: exceeds capacity. Ravi: insufficient evidence. Include one screenshot with a prominent simulated-data label.
5. **What we measured, what we have not.** Taiwan benchmark: 0.786 ROC-AUC, 6,000 held-out borrowers. Separate panel: local PDF/OCR workflow tested, Malaysian PD unavailable. Never draw an arrow implying the Taiwan model scores the uploaded records.
6. **Next milestone and ask.** Recruit a design partner; measure extraction quality and review time; evaluate local outcome-labelled cases separately for workers and businesses. Ask for workflow feedback and a scoped evaluation, without requiring raw PII transfer as the first step.

## Questions judges are likely to ask

**“Is this just a bank-statement parser?”**

“Parsing is the entry point. The implemented workflow checks arithmetic and coverage, distinguishes transfers and unknown income, incorporates household and debt needs, stress-tests capacity and preserves the reasoning. We still need to show that this integrated workflow saves analysts time or improves decisions compared with their current process.”

**“Where is the AI?”**

“We have a measured machine-learning benchmark and local OCR. The current document affordability engine uses explicit policies and reviewable rules; it is not an LLM deciding who gets credit. Learning from Malaysian outcome-labelled evidence is the next research stage.”

**“Why not use an existing credit score?”**

“We can complement existing credit information with a clearer view of current income and obligations. This prototype demonstrates that evidence workflow. It does not replace bureau information or establish that the combined approach outperforms a lender's current process.”

**“How do alternative sources change the answer today?”**

“Reviewed bank transactions change recognized income, costs and capacity. Supporting bills and screenshots inform analyst review and declared commitments, but do not yet supply trained predictive features. We avoid counting the same payment twice.”

**“Can a borrower upload fake statements?”**

“Arithmetic reconciliation can detect some inconsistencies but cannot prove authenticity. Production would need source verification, provenance controls and operational fraud review. We have not built a fraud detector.”

**“Why should I trust 0.786?”**

“It is a held-out Taiwan benchmark with disclosed splits, target, uncertainty and calibration. It is not 78.6% accuracy, Malaysian validation or proof of lending uplift. Its role is to demonstrate a reproducible evaluation process.”

**“Can you approve more borrowers at the same risk?”**

“That is a future evaluation objective, not a result we have established. We need relevant outcomes and a meaningful lender baseline. Historical booked loans alone cannot prove outcomes for applicants who were rejected.”

**“What about privacy?”**

“The current demo extracts locally, uses no external OCR service and excludes private files from Git. Extracted data persists locally. This is not production security: authentication, retention controls and encryption still need implementation. We use fictional records on stage.”

**“What if the applicant has multiple accounts or cash earnings?”**

“Current document assessment supports one account. The analyst must account for other obligations. Multi-account matching and documenting cash income are future work; unobserved income cannot be assumed.”

**“How will you get Malaysian training data without collecting everyone's PII?”**

“Start with a workflow pilot using fictional or appropriately de-identified examples. A later outcome evaluation could run in the lender's environment with pseudonymous borrower keys and export aggregate results. Privacy, consent, access and permitted use need agreement with that partner. Pseudonymization alone does not eliminate privacy risk.”

**“How do you make money?”**

“Our initial commercial hypothesis is a paid lender workflow product, potentially priced per analyst team or assessment volume. We have not validated pricing or willingness to pay, so the first milestone is customer discovery and measurable workflow value.”

## Prioritized next work

| Priority | Deliverable | Acceptance evidence |
| --- | --- | --- |
| Before a multi-source stage demo | Public-safe fictional bank, utility and PayLater evidence for one coherent applicant; rehearse exact upload and result | Every file is independently fictional; all shown facts parse; totals and declared commitments agree; no private records on screen |
| Before claiming a workflow advantage | Observe a lending team's present review process; agree a comparison task | Measured extraction corrections, processing time, analyst review time and missing-evidence rates; report sample size |
| Next product increment | Match supporting payments to bank rows with explicit uncertainty; improve debt schedule capture | Unmatched/ambiguous records visible; no double counting; changes traceable |
| Next coverage increment | More tested statement layouts and multi-account reconciliation | Document-level regression fixtures; self-transfers handled; ownership/source uncertainty remains visible |
| Next research milestone | Permitted local application-time evidence linked to later repayment outcomes | Defined outcome/horizon, dates, borrower-disjoint evaluation and worker/business subgroup reporting; no promised uplift |
| Before deployment with customers | Authentication, access controls, encryption, retention/deletion, consent/provenance and operational review | Security and data-handling review appropriate to the deployment; not merely a successful local demo |

Home Credit can be a larger behavioural-credit research benchmark after permitted use is confirmed. It does not solve Malaysian bank-document validation. Prioritize demo evidence and customer-workflow validation ahead of another dataset solely to obtain a more impressive metric.

## Rehearsal and submission checklist

- Use the local app at http://127.0.0.1:3000. Confirm both services are running before the session.
- Use synthetic scenarios and the synthetic bank pack. Avoid opening private files, personal assessment history, downloads or exports while sharing the screen. Start from a separate demo database if personal assessments have been saved.
- Rehearse exact screen labels and figures. Keep the Aina scenario and generic document sample clearly distinguished.
- Have a short screen recording and screenshots of the fictional flow available as fallback. They are preparation items, not assets already included in this kit.
- Do not depend on an on-stage download, new model training or access to a third-party account.
- Put the problem, ICP, supported-data matrix, workflow evidence, benchmark limitations and roadmap in submitted materials. The organizer says live participation does not affect preliminary judging; the submission must stand on its own.
- Confirm the assigned duration when received. Use the 90-second pitch, two-minute cut or five-minute walkthrough accordingly.

## References and verification

- Draft reference: `MAIC_T3_Alternative_Credit_Project_Plan.pdf`, supplied by the user. Its additional-safe-approvals objective is retained as future research, not promoted to an achieved claim.
- Product behaviour: `backend/documents.py`, `backend/document_routes.py`, `backend/cashflow.py`, `backend/demos.py`, `app/documents.tsx` and `app/page.tsx`.
- Measured results and validation: `docs/VALIDATION.md` and `artifacts/benchmark.json`.
- Document support/privacy: `docs/DOCUMENTS.md`.
- Organizer's session description: supplied in the user's request; exact slot duration is still unspecified.
