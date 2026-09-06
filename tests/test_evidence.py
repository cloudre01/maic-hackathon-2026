from copy import deepcopy
import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend import evidence, evidence_demo, documents
from backend.demos import scenario


@pytest.fixture
def client(tmp_path,monkeypatch):
    monkeypatch.setenv('ARUS_DB',str(tmp_path/'evidence.sqlite3'))
    with TestClient(app) as c: yield c


def setup(client):
    batch=client.post('/api/documents/alternative-demo').json()
    selected=[d['id'] for d in batch['documents']]
    items=client.post(f"/api/documents/{batch['id']}/matches",json={'selected_document_ids':selected}).json()['items']
    payload={'applicant':scenario('worker').applicant.model_dump(),'selected_document_ids':selected,
        'acknowledged':True,'single_account_confirmed':True,'period_confirmed':True,'additional_obligations_confirmed':True,
        'confirmed_matches':{i['id']:next(c['transaction_id'] for c in i['candidates'] if c['reference_match']) for i in items if i['status']=='reference_match'},
        'confirmed_debt_ids':[i['id'] for i in items if i['kind']=='repayment']}
    return batch,items,payload


def test_coherent_pack_and_three_stage_comparison(client):
    batch,items,payload=setup(client)
    assert len(batch['documents'])==9
    assert len(items)==22
    assert sum(i['status']=='unmatched' for i in items)==4
    path=f"/api/documents/{batch['id']}/assess"
    response=client.post(path+'?preview=true',json=payload)
    assert response.status_code==200, response.text
    result=response.json(); comparison=result['evidence_comparison']
    assert [s['metrics']['monthly_capacity'] for s in comparison['stages']]==[0,1195,945]
    assert [s['metrics']['transaction_count'] for s in comparison['stages']]==[42,42,42]
    assert comparison['effective_monthly_obligations']==750
    assert result['default_probability'] is None
    assert all(m['debt_used']==750 for m in result['monthly'])
    assert client.get('/api/assessments').json()==[]  # Preview does not persist an assessment.
    saved=client.post(path,json=payload).json()
    assert saved['input_hash']==result['input_hash']
    assert client.get('/api/assessments/'+saved['id']).json()['evidence_comparison']==comparison


def test_unconfirmed_evidence_has_no_effect(client):
    batch,items,payload=setup(client)
    payload['confirmed_matches']={};payload['confirmed_debt_ids']=[]
    result=client.post(f"/api/documents/{batch['id']}/assess?preview=true",json=payload).json()
    assert len({s['input_hash'] for s in result['evidence_comparison']['stages']})==1


def test_declared_floor_is_not_added_to_schedule(client):
    batch,items,payload=setup(client)
    payload['applicant']['monthly_obligations']=900
    result=client.post(f"/api/documents/{batch['id']}/assess?preview=true",json=payload).json()
    assert result['evidence_comparison']['effective_monthly_obligations']==900
    assert all(m['debt_used']==900 for m in result['monthly'])


def test_stale_or_duplicate_evidence_is_rejected(client):
    batch,items,payload=setup(client)
    path=f"/api/documents/{batch['id']}/assess"
    bad=deepcopy(payload);bad['selected_document_ids']=bad['selected_document_ids'][:6]
    assert client.post(path,json=bad).status_code==422
    bad=deepcopy(payload);bad['confirmed_debt_ids']*=2
    assert client.post(path,json=bad).status_code==422
    bad=deepcopy(payload);bad['confirmed_matches']['not-real']='not-real'
    assert client.post(path,json=bad).status_code==422


def test_ambiguous_matches_and_bank_row_reuse():
    record={'kind':'payout','reference':'REF','date':'2026-01-01','amount':100,'due_date':None,'paid_date':None,'contract':'','balance':None,'page':1,'line':1}
    tx=[{'transaction_id':str(i),'date':'2026-01-02','amount':100,'description':'Credit','category':'unknown'} for i in range(2)]
    docs=[{'kind':'bank_statement','transactions':tx},{'kind':'structured_evidence','id':'support','filename':'fiction.pdf','records':[record,record]}]
    items=evidence.propose(docs)
    assert all(i['status']=='ambiguous' for i in items)
    with pytest.raises(ValueError,match='multiple evidence'):
        evidence.apply_matches(deepcopy(tx),items,{'support:0':'0','support:1':'0'})
    changed=deepcopy(tx);evidence.apply_matches(changed,items,{'support:0':'0'})
    assert changed[0]['category']=='income' and changed[1]['category']=='unknown'


def test_structured_parser_requires_all_rows_and_real_fields():
    text='ARUS EVIDENCE V1\nRECORD COUNT: 1\nrepayment|REF|2026-01-01|100.00|2026-01-20|2026-01-21|PLAN|200.00'
    parsed=evidence.parse_evidence(text)
    item=evidence.propose([{**parsed,'id':'s','filename':'fiction.pdf'}])[0]
    assert item['payment_timing']=='recorded_after_due'
    with pytest.raises(ValueError):evidence.parse_evidence(text.replace('RECORD COUNT: 1','RECORD COUNT: 2'))
    with pytest.raises(ValueError):evidence.parse_evidence(text.replace('100.00','nan'))


def test_zip_uses_real_parser(client):
    import io,zipfile
    raw=client.get('/api/documents/alternative-demo.zip').content
    z=zipfile.ZipFile(io.BytesIO(raw))
    response=client.post('/api/documents/upload',files=[('files',(name,z.read(name),'application/pdf')) for name in z.namelist()])
    batch=response.json()
    assert batch['simulated'] and len(batch['documents'])==9
    assert all(d['kind']!='unsupported' for d in batch['documents'])
