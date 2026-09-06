"""Conservative, analyst-confirmed evidence matching. No new cash entries."""
import re
from datetime import date
from pydantic import Field, model_validator
from .schemas import StrictModel


class EvidenceRecord(StrictModel):
    kind: str
    reference: str = Field(min_length=1, max_length=60, pattern=r'^[A-Za-z0-9-]+$')
    date: date
    amount: float = Field(gt=0, le=1e9)
    due_date: date | None = None
    paid_date: date | None = None
    contract: str = Field(default='', max_length=60)
    balance: float | None = Field(default=None, ge=0, le=1e9)

    @model_validator(mode='after')
    def valid(self):
        if self.kind not in ('payout', 'utility', 'repayment'):
            raise ValueError('Unsupported evidence kind.')
        if self.kind == 'repayment' and (not self.due_date or not self.contract):
            raise ValueError('Repayment records require a contract and due date.')
        return self


def parse_evidence(text):
    if 'ARUS EVIDENCE V1' not in text:
        return None
    count = re.search(r'RECORD COUNT: (\d+)', text)
    records = []
    for page, section in enumerate(text.split('\f'), 1):
        for line, raw in enumerate(section.splitlines(), 1):
            if not raw.strip().startswith(('payout|', 'utility|', 'repayment|')):
                continue
            fields = [v.strip() for v in raw.strip().split('|')]
            if len(fields) != 8:
                raise ValueError('Incomplete evidence row.')
            kind, reference, when, amount, due, paid, contract, balance = fields
            record = EvidenceRecord(kind=kind, reference=reference, date=when, amount=amount,
                due_date=None if due=='-' else due, paid_date=None if paid=='-' else paid,
                contract='' if contract=='-' else contract, balance=None if balance=='-' else balance)
            records.append({**record.model_dump(mode='json'), 'page':page, 'line':line})
    if not count or not records or len(records) != int(count[1]):
        raise ValueError('Evidence row count failed; review the source.')
    return {'kind':'structured_evidence', 'transactions':[], 'records':records,
        'facts':[{'label':'Structured evidence records','value':str(len(records)), 'page':1}],
        'warnings':['Documented Arus evidence template, not a live provider integration. Confirm source ownership and each proposed match. Payment dates describe this document only; authenticity is unverified.']}


def propose(docs):
    bank = [t for d in docs if d['kind']=='bank_statement' for t in d['transactions']]
    items = []
    for d in docs:
        for i, record in enumerate(d.get('records', [])):
            when = record['date'] if record['kind']=='payout' else record['paid_date']
            candidates=[]
            if when:
                for tx in bank:
                    sign_ok = tx['amount']>0 if record['kind']=='payout' else tx['amount']<0
                    if sign_ok and abs(abs(tx['amount'])-record['amount'])<=.005 and abs((date.fromisoformat(tx['date'])-date.fromisoformat(when)).days)<=3:
                        reference_match = bool(re.search(r'(?<![A-Za-z0-9])'+re.escape(record['reference'])+r'(?![A-Za-z0-9])',tx['description'], re.I))
                        candidates.append({'transaction_id':tx['transaction_id'], 'date':tx['date'], 'amount':tx['amount'], 'description':tx['description'], 'reference_match':reference_match})
            exact=[c for c in candidates if c['reference_match']]
            status='reference_match' if len(exact)==1 else 'ambiguous' if len(candidates)>1 else 'amount_date_only' if candidates else 'unmatched'
            items.append({**record, 'id':f"{d['id']}:{i}", 'document_id':d['id'], 'filename':d['filename'], 'candidates':candidates, 'status':status,
                'payment_timing': ('recorded_on_or_before_due' if record['paid_date']<=record['due_date'] else 'recorded_after_due') if record['paid_date'] and record['due_date'] else 'unavailable'})
    return items


def apply_matches(tx, items, confirmations):
    indexed={i['id']:i for i in items}; ledger={t['transaction_id']:t for t in tx}
    used=set(); changes=[]
    for eid, tid in confirmations.items():
        item=indexed.get(eid)
        if not item or tid not in {c['transaction_id'] for c in item['candidates']}:
            raise ValueError('A confirmed match is not a current candidate.')
        if tid in used:
            raise ValueError('One bank row cannot confirm multiple evidence records.')
        used.add(tid)
        row=ledger[tid]; before=row['category']
        after={'payout':'income','utility':'household','repayment':'debt'}[item['kind']]
        if before=='transfer':
            raise ValueError('Resolve the transfer category before confirming this match.')
        row['category']=after
        changes.append({'evidence_id':eid,'transaction_id':tid,'before':before,'after':after,'reason':'Analyst confirmed amount/date/source match; bank row reclassified, no cash row added.'})
    return changes


def debt_summary(items, confirmed_ids):
    indexed={i['id']:i for i in items}
    monthly={}; seen=set(); selected=[]
    for eid in confirmed_ids:
        item=indexed.get(eid)
        if not item or item['kind']!='repayment':
            raise ValueError('Unknown repayment schedule selection.')
        key=(item['contract'],item['due_date'])
        if key in seen:
            raise ValueError('Duplicate contract/due-date records: select one authoritative record.')
        seen.add(key)
        month=item['due_date'][:7]
        monthly[month]=monthly.get(month,0)+item['amount']
        selected.append(item)
    return {'confirmed_records':selected,'monthly_schedule':monthly,
        'suggested_monthly_floor':round(max(monthly.values(),default=0),2),
        'assumption':'Peak monthly scheduled total across confirmed rows, used as a conservative constant debt floor. Greater of this and declared total; never add it to the same recorded debt payment. Partial schedules do not establish complete liabilities. Balances are displayed, not summed across repeated snapshots.'}
