# Alternative-evidence implementation plan

Completed 6 September 2026. Priorities 1–4 are available in Document intake → Try Aina’s alternative-data story. Validation: 43 Python tests, eight browser scenarios, production build, visual comparison inspection and no overflow at 390px. The frozen training report/models were preserved. See ALTERNATIVE_EVIDENCE_DEMO.md and TRAINING_DATA_AUDIT.md for results and boundaries.

1. Audit the cached Taiwan source and existing preprocessing. Add repeatable input validation and document retained unusual values without changing the frozen benchmark's feature semantics.
2. Create an independently fictional applicant pack with six bank PDFs, earnings, utility payment evidence and a PayLater schedule. Exercise the real extraction path, not pre-populated parsed results.
3. Match supporting records to bank rows using amount, date and reference. Surface unmatched and ambiguous candidates. Require analyst confirmation; never add supporting payments as new cash transactions.
4. Review scheduled debt with explicit due/payment dates and balances. Confirm a conservative monthly debt floor, preserve provenance and avoid duplicating observed payments.
5. Compare bank-only, confirmed matches and confirmed obligations using the same applicant/policy. Save the comparison and show changes with their reasons.
6. Test parser failures, ambiguity, conflicting evidence, duplicate use, obligation treatment, reproducibility and the complete browser demo. Update the rehearsal guide.

All fictional files must be labelled. Private originals stay local and out of test fixtures. Generic personal screenshots remain supporting evidence when they lack the fields needed for structured matching. This work does not retrain a Malaysian credit model.
