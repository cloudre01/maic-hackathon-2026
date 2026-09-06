"""Read-only source validation; preserve original codes and frozen benchmark semantics."""
import hashlib
import io
import json
import zipfile
from pathlib import Path
import numpy as np
import pandas as pd

STATUS = ['PAY_0', 'PAY_2', 'PAY_3', 'PAY_4', 'PAY_5', 'PAY_6']
BILLS = [f'BILL_AMT{i}' for i in range(1, 7)]
PAYMENTS = [f'PAY_AMT{i}' for i in range(1, 7)]
FEATURES = ['LIMIT_BAL'] + STATUS + BILLS + PAYMENTS
TARGET = 'default payment next month'


def audit_frame(df):
    required = ['ID', TARGET] + FEATURES
    if not set(required).issubset(df.columns):
        raise ValueError('Required benchmark columns are missing.')
    if len(df) != 30000 or not df.ID.is_unique or df.ID.isna().any():
        raise ValueError('Expected 30,000 uniquely identified clients.')
    if set(df[TARGET].unique()) != {0, 1}:
        raise ValueError('Invalid or missing outcome label.')
    X = df[FEATURES]
    if not all(pd.api.types.is_numeric_dtype(X[c]) for c in FEATURES):
        raise ValueError('Predictive features must be numeric.')
    if not np.isfinite(X.to_numpy()).all():
        raise ValueError('Unexpected missing or nonfinite cells; investigate source drift.')
    if (df.LIMIT_BAL <= 0).any() or (df[PAYMENTS] < 0).any().any():
        raise ValueError('Unexpected credit limit or payment amount; investigate.')
    codes = sorted(set(df[STATUS].to_numpy().ravel().tolist()))
    if any(v != int(v) or v < -2 or v > 9 for v in codes):
        raise ValueError('Unexpected repayment status code; investigate source drift.')
    return {
        'rows': len(df), 'missing_feature_cells': int(X.isna().sum().sum()),
        'duplicate_feature_profiles': int(X.duplicated().sum()),
        'negative_bill_cells_retained': int((df[BILLS] < 0).sum().sum()),
        'repayment_codes_retained': codes,
        'adverse_outcomes': int(df[TARGET].sum()),
        'policy': 'No row deletion, winsorization, synthetic augmentation or target recoding. Preserve source bill amounts and repayment codes; do not assign undocumented meanings to -2 or 0. Demographics excluded. Group identical predictive profiles across all splits. Fit LR imputer/scaler on training rows only; trees use source numeric values.',
        'limitation': 'The numeric treatment of repayment codes is a baseline assumption, especially for LR. Encoding alternatives need a predeclared validation experiment; do not optimize against the frozen test set.',
    }


def source_audit():
    root = Path(__file__).resolve().parents[1]
    raw = (root/'data/taiwan-default.zip').read_bytes()
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        df = pd.read_excel(io.BytesIO(z.read(next(n for n in z.namelist() if n.endswith('.xls')))), header=1)
    df.columns = [str(c).strip() for c in df.columns]
    result = audit_frame(df)
    result['source_sha256'] = hashlib.sha256(raw).hexdigest()
    previous = json.loads((root/'artifacts/benchmark.json').read_text())
    result['matches_frozen_benchmark_source'] = result['source_sha256'] == previous['source_sha256']
    return result


if __name__ == '__main__':
    print(json.dumps(source_audit(), indent=2))
