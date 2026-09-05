import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.demos import scenario


@pytest.fixture
def client(tmp_path,monkeypatch):
    monkeypatch.setenv('ARUS_DB',str(tmp_path/'test.sqlite3'))
    with TestClient(app) as c:yield c


def test_save_read_reassess(client):
    data=scenario('worker').model_dump(mode='json')
    response=client.post('/api/assessments',json=data)
    assert response.status_code==200
    first=response.json()
    assert client.get('/api/assessments/'+first['id']).json()==first
    extended=scenario('worker',True).model_dump(mode='json')
    extended['previous_assessment_id']=first['id']
    second=client.post('/api/assessments',json=extended).json()
    assert second['previous_assessment_id']==first['id']
    assert len(client.get('/api/assessments').json())==2


def test_link_to_other_applicant_rejected(client):
    first=client.post('/api/assessments',json=scenario('worker').model_dump(mode='json')).json()
    other=scenario('business').model_dump(mode='json');other['previous_assessment_id']=first['id']
    assert client.post('/api/assessments',json=other).status_code==422


def test_csv_round_trip(client):
    csv=client.get('/api/scenarios/worker/csv').content
    parsed=client.post('/api/transactions/parse',files={'file':('demo.csv',csv,'text/csv')})
    assert parsed.status_code==200
    assert parsed.json()['count']==42
    assert parsed.json()['transactions'][0]['category']=='income'


def test_bad_csv_and_missing_assessment(client):
    assert client.get('/api/assessments/missing').status_code==404
    for raw in [b'a,b\n1,2',b'transaction_id,date,amount,balance,description,category\nx,2026-01-01,nan,,a,income', b'transaction_id,date,amount,balance,description,category\nx,2026-01-01,3,,a,income,extra']:
        assert client.post('/api/transactions/parse',files={'file':('bad.csv',raw,'text/csv')}).status_code==422


def test_out_of_range_policy(client):
    data=scenario('worker').model_dump(mode='json');data['policy']['revenue_shock']=2
    assert client.post('/api/assessments',json=data).status_code==422
