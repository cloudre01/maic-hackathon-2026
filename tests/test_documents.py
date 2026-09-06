import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend import documents
from backend.demos import scenario


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv('ARUS_DB', str(tmp_path/'documents.sqlite3'))
    with TestClient(app) as c:
        yield c


def review(batch):
    return dict(applicant=scenario('worker').applicant.model_dump(),
                selected_document_ids=[d['id'] for d in batch['documents']],
                acknowledged=True, single_account_confirmed=True,
                period_confirmed=True, additional_obligations_confirmed=True)


def test_upload_deduplicates_and_assesses(client):
    pack=documents.demo_pack()
    files=[('files',(name,raw,'application/pdf')) for name,raw in pack+[pack[0]]]
    response=client.post('/api/documents/upload',files=files)
    assert response.status_code==200
    batch=response.json()
    assert len(batch['documents'])==6
    assert all(d['reconciled'] for d in batch['documents'])
    payload=review(batch)
    payload['acknowledged']=False
    assert client.post(f"/api/documents/{batch['id']}/assess",json=payload).status_code==422
    payload['acknowledged']=True
    result=client.post(f"/api/documents/{batch['id']}/assess",json=payload)
    assert result.status_code==200
    body=result.json()
    assert len(body['inputs']['transactions'])==18
    assert body['document_evidence']['supporting_documents_added_to_cashflow'] is False
    assert client.get('/api/assessments/'+body['id']).json()==body


def test_supporting_not_double_counted_and_edits_traced(client):
    batch=client.post('/api/documents/demo').json()
    support={'id':'support','kind':'utility_bill',**documents.supporting('TNB TARIKH BIL\n01.01.2026\nAmaun : RM 100.00')}
    batch=documents.persist_batch(batch['documents']+[support],simulated=True)
    payload=review(batch)
    tx=batch['documents'][0]['transactions'][0]
    payload['categories']={tx['transaction_id']:'transfer'}
    body=client.post(f"/api/documents/{batch['id']}/assess",json=payload).json()
    assert body['simulated'] is True
    assert len(body['inputs']['transactions'])==18
    assert body['inputs']['transactions'][0]['category']=='transfer'
    assert len(body['document_evidence']['category_edits'])==1


@pytest.mark.parametrize('problem',['overlap','account','continuity','reconciliation','gap'])
def test_invalid_statement_sets_blocked(client,problem):
    docs=client.post('/api/documents/demo').json()['documents']
    if problem=='overlap': docs[1]['period_start']=docs[0]['period_start']
    if problem=='account': docs[1]['account_key']='different'
    if problem=='continuity': docs[1]['opening']+=1
    if problem=='reconciliation': docs[1]['reconciled']=False
    if problem=='gap': docs.pop(1)
    batch=documents.persist_batch(docs,simulated=True)
    assert client.post(f"/api/documents/{batch['id']}/assess",json=review(batch)).status_code==422


def test_tampered_totals_fail():
    name,raw=documents.demo_pack()[0]
    text,_=documents.extract(raw,'.pdf')
    assert documents.bank(text,'test')['reconciled']
    assert not documents.bank(text.replace('TOTAL CREDIT : 6000.00','TOTAL CREDIT : 7000.00'),'test')['reconciled']


def test_unreadable_file_and_cross_origin(client):
    response=client.post('/api/documents/upload',files={'files':('bad.pdf',b'%PDF invalid','application/pdf')})
    assert response.json()['documents'][0]['kind']=='unsupported'
    assert response.headers['cache-control']=='no-store'
    assert client.post('/api/documents/demo',headers={'Origin':'https://untrusted.example'}).status_code==403


def test_paylater_does_not_infer_punctuality():
    d=documents.supporting('Postpaid June Bill\nTransaction\nRM 123.00\n2 July 2026')
    assert d['kind']=='paylater_history'
    assert len(d['facts'])==3
    assert d['transactions']==[]
    assert 'Due dates and on-time status are unavailable' in d['warnings'][0]
