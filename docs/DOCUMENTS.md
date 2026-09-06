# Local document demo

Open http://127.0.0.1:3000 and choose **Document intake**.

For the complete alternative-data pitch, choose **Try Aina’s alternative-data story**. See [the matching, obligation and comparison walkthrough](ALTERNATIVE_EVIDENCE_DEMO.md). The older synthetic bank-only pack remains available as a simpler parser example.

## Rehearsal

1. Choose **Try synthetic document pack** for six fictional monthly bank PDFs. These fixtures contain no personal source data. Downloadable PDFs also exercise manual file upload.
2. Check each document's month, reconciliation and source references. Reveal values only when appropriate for your audience.
3. Review categories. Mark self-transfers as transfers; recognise earned income only with supporting knowledge. Unknown credits are excluded from income; unknown debits remain costs.
4. Enter applicant type, financing, household needs and all monthly debt commitments, including PayLater. Review demonstration stress assumptions.
5. Confirm the four review checks and calculate. Results expose cash flow, assumptions and reasons. Malaysian default probability remains unavailable.
6. Inspect assessment history and export the audit record. Exports include transaction details; use fictional records when sharing.

## Supported evidence

Upload the complete set together: up to 16 PDF/PNG/JPG files, 10 MB each, 50 MB total. The bank parser supports the tested date/description/signed-amount/balance layout with opening, closing, credit and debit totals. All six supplied bank months passed ledger reconciliation and consecutive balance continuity locally. This checks extraction arithmetic, not authenticity or creditworthiness.

One bank account is supported per assessment. Overlapping periods, different detected accounts, mismatched consecutive balances and failed reconciliation block calculation. Complete statement coverage requires human confirmation. Unsupported layouts are rejected. Text PDFs are limited to 30 pages, scanned PDFs to eight. Supply unlocked local copies; passwords are not collected.

TNB bills, Grab passenger activity and PayLater screenshots remain supporting records. They never add duplicate cash transactions. Passenger activity is not driver earnings. A generic screenshot transaction is not verified repayment; absent due dates mean punctuality is unavailable. Compare OCR results against originals. Bank page/text-row references, category edits and review confirmations are retained in the saved audit.

## Privacy

- Poppler and Tesseract run locally; no external OCR, LLM or font service is used.
- Upload temporary files are deleted after extraction. Original files already in the workspace remain untouched.
- Extracted descriptions, evidence and assessments persist in ignored `data/arus.sqlite3` with owner-only file permissions. This is not encryption at rest.
- **Discard review batch** removes that batch only. Saved assessments retain evidence. Exports and backups also contain sensitive data.
- Values are masked initially in document review. Calculated results and exports display financial values. Use the synthetic pack for public screen sharing.
- There is no authentication. Both services bind to loopback. Do not publish a tunnel or deploy this build with personal records.
- Root PDFs/images and local data directories are ignored by Git. Do not force-add private files or copy their contents into source or fixtures.

This is a document-to-affordability demonstration with human review. The Taiwan benchmark remains separate. More statements improve evidence coverage but do not create labelled Malaysian lending outcomes or validate a Malaysian default probability.
