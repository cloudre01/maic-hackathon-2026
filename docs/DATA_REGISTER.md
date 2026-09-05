# Data register and evidence boundaries

## Implemented — UCI Taiwan Default of Credit Card Clients

- Publisher: UCI Machine Learning Repository; I-Cheng Yeh.
- Source: https://archive.ics.uci.edu/dataset/350/default+of+credit+card+clients
- Archive: https://archive.ics.uci.edu/static/public/350/default+of+credit+card+clients.zip
- Licence: CC BY 4.0, as stated on the UCI source page checked during project planning.
- Attribution included in README and benchmark JSON/UI. SHA-256 is recorded for the actual downloaded archive.
- Expected observations: 30,000 unique client IDs. Binary target: default payment next month. Six months of card histories, April–September 2005.
- Source audit fails if row count, ID uniqueness or target coding changes. Missing counts and duplicate feature profiles are reported. Exact feature profiles are grouped across splits rather than discarded or allowed to leak between partitions.
- Repayment/bill/payment variables precede the supplied next-month label. No application timestamp is provided; do not claim an out-of-time evaluation.
- Dataset is not representative of Malaysian microbusinesses or thin-file applicants. No source borrower is joined to Malaysian demonstration data.

## Deferred — Home Credit Default Risk

- Source and rules: https://www.kaggle.com/competitions/home-credit-default-risk/data and https://www.kaggle.com/competitions/home-credit-default-risk/rules
- The public rules page did not expose readable reuse terms during investigation. Account/rule acceptance and permission for reuse outside that competition remain unverified.
- No download, training, copying from mirrors or terms acceptance performed. This is the plan's access/permission fallback, not a claim that Home Credit is prohibited.
- Before adding: confirm permitted use; verify target definition and observation windows; audit joined histories for post-application records; keep customers disjoint; establish whether reliable application timestamps exist.

## Implemented — Malaysian fictional demonstration scenarios

- Authored in `backend/demos.py`; explicitly simulated, deterministic, no real personal identities or outcomes intended.
- Covers January–June 2026 (seven months on extension), or two/three months for limited history.
- No default labels; never used for supervised model training, validation or testing.
- Purpose: demonstrate CSV processing, affordability, evidence flags, explanations and monthly reassessment.
- DuitNow/platform descriptions are fictional labels, not live integrations or payment verification.

## Malaysian follow-up lead, not an available dependency

*Cash Flow Underwriting with Bank Transaction Data: Advancing MSME Financial Inclusion in Malaysia*: https://arxiv.org/html/2510.16066v1

The paper reports 611 MSME applicants and intends to release data. No public download was verified. Labels, timing, permissions and representativeness would need review before use. No author outreach has been sent.

## Claims that the prototype does not support

- A Malaysian 12-month PD, validated Malaysian pricing or safe automatic approval.
- Proven extra approvals for historically rejected borrowers.
- Fairness merely from omitting demographic variables.
- Cash-flow value inferred from credit-card repayment features as if the inputs were interchangeable.
- Privacy guarantees for synthetic data, real fraud detection or statement authenticity.
- A statistically decisive winner based on a small point-estimate difference between XGBoost and CatBoost.
