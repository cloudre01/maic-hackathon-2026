import json
from pathlib import Path
import numpy as np
import pytest

ROOT=Path(__file__).resolve().parents[1]


def report():
    path=ROOT/'artifacts/benchmark.json'
    if not path.exists():pytest.skip('Run the real-data benchmark first')
    return json.loads(path.read_text())


def test_report_has_all_measured_models_and_valid_intervals():
    r=report()
    assert r['audit']['rows']==30000
    assert r['audit']['group_overlap']==0
    assert len(r['results'])==6
    assert {(m['model'],m['feature_set']) for m in r['results']}=={(m,f) for m in ('Logistic regression','XGBoost','CatBoost') for f in ('static','behavioural')}
    assert r['selected_model']==max(r['results'],key=lambda m:m['validation_auc'])['id']
    for model in r['results']:
        for metric,value in model['metrics'].items():
            assert 0<=value<=1
            lo,hi=model['confidence_intervals'][metric]
            assert 0<=lo<=hi<=1
        assert len(model['samples'])==12
        assert set(model['features']).isdisjoint({'ID','SEX','EDUCATION','MARRIAGE','AGE','default payment next month'})


def test_saved_splits_and_fitted_predictions_are_reproducible():
    report()
    path=ROOT/'data/benchmark-splits.json'
    if not path.exists():pytest.skip('Local training artifacts unavailable')
    import io,zipfile,joblib,pandas as pd
    from benchmark.train import raw_logit
    splits=json.loads(path.read_text())
    values=list(splits.values())
    assert sum(map(len,values))==30000
    for i,ids in enumerate(values):
        for other in values[i+1:]: assert not set(ids)&set(other)
    archive=zipfile.ZipFile(ROOT/'data/taiwan-default.zip')
    df=pd.read_excel(io.BytesIO(archive.read(next(n for n in archive.namelist() if n.endswith('.xls')))),header=1).set_index('ID')
    r=report()
    for model in r['results']:
        bundle=joblib.load(ROOT/'artifacts/models'/(model['id'].replace(' ','-')+'.joblib'))
        sample=model['samples'][0]
        X=df.loc[[int(float(sample['borrower_id']))],bundle['features']]
        p=bundle['calibrator'].predict_proba(raw_logit(bundle['model'].predict_proba(X)[:,1]))[0,1]
        assert p==pytest.approx(sample['probability'],abs=1e-7)
        assert bundle['source_sha256']==r['source_sha256']
