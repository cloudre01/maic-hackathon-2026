import io
import zipfile
from pathlib import Path
import pandas as pd
import pytest
from benchmark.audit import audit_frame, source_audit


@pytest.fixture(scope='module')
def frame():
    path=Path(__file__).resolve().parents[1]/'data/taiwan-default.zip'
    if not path.exists(): pytest.skip('Cached public source unavailable')
    with zipfile.ZipFile(path) as z:
        return pd.read_excel(io.BytesIO(z.read(next(n for n in z.namelist() if n.endswith('.xls')))),header=1)


def test_current_source_ready_and_unchanged(frame):
    audit=audit_frame(frame)
    assert audit['negative_bill_cells_retained']==3932
    assert audit['duplicate_feature_profiles']==817
    assert source_audit()['matches_frozen_benchmark_source']


@pytest.mark.parametrize('column,value',[('PAY_0',20),('PAY_AMT1',-1),('LIMIT_BAL',float('nan')),('default payment next month',2)])
def test_bad_source_rejected(frame,column,value):
    broken=frame.copy();broken.loc[0,column]=value
    with pytest.raises(ValueError):audit_frame(broken)
