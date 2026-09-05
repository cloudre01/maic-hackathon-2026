import copy
import pytest
from backend.cashflow import assess, payment
from backend.demos import scenario
from backend.schemas import AssessmentRequest, Transaction


def modified(**kwargs):
    data=scenario('worker').model_dump(mode='json')
    data.update(kwargs)
    return AssessmentRequest.model_validate(data)


def test_worker_capacity_and_no_invented_pd():
    result=assess(scenario('worker'))
    assert result['status']=='WITHIN_CAPACITY'
    assert result['default_probability'] is None
    assert result['risk_band'] is None
    assert result['metrics']['complete_months']==6
    assert result['metrics']['median_income']==6600
    assert result['metrics']['monthly_capacity']==1195
    assert result['metrics']['requested_instalment']==pytest.approx(payment(8000,12,.12),abs=.01)


def test_duplicate_id_dedup_and_conflict():
    req=scenario('worker')
    original=assess(req)
    req.transactions.append(req.transactions[0].model_copy())
    result=assess(req)
    assert result['metrics']['duplicates_removed']==1
    assert result['metrics']['total_inflows']==original['metrics']['total_inflows']
    req.transactions[-1]=req.transactions[-1].model_copy(update={'amount':42})
    with pytest.raises(ValueError,match='conflicting'): assess(req)


def test_different_ids_identical_records_flagged_not_silently_removed():
    req=scenario('worker')
    req.transactions.append(req.transactions[0].model_copy(update={'transaction_id':'other-id'}))
    result=assess(req)
    assert result['status']=='REFER'
    assert 'POSSIBLE_DUPLICATES' in [f['code'] for f in result['flags']]


def test_transfers_do_not_inflate_income():
    req=scenario('worker')
    original=assess(req)
    req.transactions.append(Transaction(transaction_id='transfer-extra',date='2026-06-15',amount=100000,balance=None,category='transfer',description='Transfer'))
    result=assess(req)
    assert result['metrics']['median_income']==original['metrics']['median_income']
    assert result['metrics']['monthly_capacity']==original['metrics']['monthly_capacity']
    assert result['metrics']['total_inflows']==original['metrics']['total_inflows']+100000


def test_suspected_transfer_and_unknown_income_require_review():
    req=scenario('worker')
    for i,cat,desc in [(1,'income','Own account transfer'),(2,'unknown','Unclassified deposit')]:
        req.transactions.append(Transaction(transaction_id=f'unknown-{i}',date='2026-06-16',amount=100000,balance=None,category=cat,description=desc))
    result=assess(req)
    assert result['status']=='REFER'
    assert result['metrics']['median_income']==6600
    assert {'UNKNOWN_CATEGORY','POSSIBLE_TRANSFER'} <= {f['code'] for f in result['flags']}


def test_household_and_debt_are_floors_not_additional_costs():
    req=scenario('worker')
    result=assess(req)
    assert result['monthly'][0]['household_used']==1600
    assert result['monthly'][0]['debt_used']==250
    req.applicant.household_expenses=2000
    result=assess(req)
    assert result['monthly'][0]['household_used']==2000
    assert result['monthly'][0]['surplus']==2750


def test_partial_month_excluded_and_inactive_month_included():
    req=scenario('worker')
    req.period_start=req.period_start.replace(day=2)
    result=assess(req)
    assert result['metrics']['complete_months']==5
    assert result['status']=='INSUFFICIENT_DATA'
    req=scenario('worker')
    req.transactions=[t for t in req.transactions if t.date.month!=3]
    result=assess(req)
    assert result['metrics']['complete_months']==6
    assert result['monthly'][2]['income']==0
    assert result['status']=='REFER'


def test_no_complete_month_has_no_capacity():
    req=scenario('limited')
    req.transactions=[req.transactions[0]]
    req.period_start=req.transactions[0].date
    req.period_end=req.transactions[0].date
    result=assess(req)
    assert result['metrics']['monthly_capacity']==0
    assert result['status']=='INSUFFICIENT_DATA'


def test_missing_latest_balance_is_not_replaced_by_stale_balance():
    req=scenario('worker')
    req.transactions[-1].balance=None
    result=assess(req)
    assert result['metrics']['closing_balance'] is None
    assert result['metrics']['buffer_months'] is None


def test_reassessment_and_determinism():
    before=assess(scenario('worker'))
    after=assess(scenario('worker',True))
    assert after['metrics']['complete_months']==7
    assert after['metrics']['monthly_capacity']!=before['metrics']['monthly_capacity']
    req=scenario('worker');req.transactions.reverse()
    assert assess(req)==before


def test_outside_period_and_invalid_amount():
    req=scenario('worker')
    req.period_end=req.period_end.replace(month=5,day=31)
    with pytest.raises(ValueError,match='outside'):assess(req)
    with pytest.raises(ValueError):Transaction(transaction_id='bad',date='2026-01-03',amount=float('nan'),category='income')


def test_scenario_expected_statuses():
    assert assess(scenario('business'))['status']=='EXCEEDS_CAPACITY'
    assert assess(scenario('limited'))['status']=='INSUFFICIENT_DATA'


def test_monotonic_stress_and_zero_interest():
    req=scenario('worker');first=assess(req)
    req.policy.revenue_shock=.4
    assert assess(req)['metrics']['monthly_capacity']<first['metrics']['monthly_capacity']
    assert payment(1200,12,0)==100


def test_business_owner_draw_is_protected():
    req=scenario('business')
    result=assess(req)
    assert all(m['household_used']>=2000 for m in result['monthly'])
    assert 'Owner household draw' in result['reasons'][1]['text']
