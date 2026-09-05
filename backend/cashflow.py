"""Deterministic, conservative demonstration affordability. No credit-risk estimator."""
import calendar
import hashlib
import json
import statistics
from datetime import date
from .schemas import AssessmentRequest

ENGINE_VERSION = "cashflow-1.0.0"


def payment(principal: float, months: int, annual_rate: float) -> float:
    rate = annual_rate / 12
    return principal / months if rate == 0 else principal * rate / (1 - (1 + rate) ** -months)


def assess(request: AssessmentRequest) -> dict:
    start, end = request.period_start, request.period_end
    if start > end or (end - start).days > 1096:
        raise ValueError("Statement period must be ordered and no longer than three years.")
    if end > date.today():
        raise ValueError("Statement period cannot end in the future.")
    seen, rows, duplicate_count = {}, [], 0
    flags = []
    for tx in request.transactions:
        if not start <= tx.date <= end:
            raise ValueError(f"Transaction {tx.transaction_id} falls outside the declared statement period.")
        payload = tx.model_dump(mode="json")
        if tx.transaction_id in seen:
            if seen[tx.transaction_id] != payload:
                raise ValueError(f"Transaction ID {tx.transaction_id} has conflicting records.")
            duplicate_count += 1
            continue
        seen[tx.transaction_id] = payload
        if tx.category == "income" and tx.amount < 0:
            raise ValueError(f"Income {tx.transaction_id} must be positive; use expense for refunds.")
        if tx.category in ("expense", "household", "debt") and tx.amount > 0:
            raise ValueError(f"Outflow {tx.transaction_id} must be negative.")
        rows.append(tx)
    rows.sort(key=lambda t: (t.date, t.transaction_id))
    if duplicate_count:
        flags.append({"code": "DUPLICATES_REMOVED", "severity": "info", "message": f"Removed {duplicate_count} repeated transaction IDs."})
    months = {}
    cursor = date(start.year, start.month, 1)
    while cursor <= end:
        last = date(cursor.year, cursor.month, calendar.monthrange(cursor.year, cursor.month)[1])
        months[cursor.strftime("%Y-%m")] = {"month": cursor.strftime("%Y-%m"), "complete": start <= cursor and end >= last, "inflows": 0., "outflows": 0., "income": 0., "operating_expenses": 0., "household": 0., "debt": 0., "transfers": 0., "count": 0, "balances": []}
        cursor = date(cursor.year + (cursor.month == 12), cursor.month % 12 + 1, 1)
    uncertain, suspected, fingerprints, possible_duplicates = [], [], set(), 0
    for tx in rows:
        m = months[tx.date.strftime("%Y-%m")]
        m["count"] += 1
        m["inflows"] += max(tx.amount, 0)
        m["outflows"] += max(-tx.amount, 0)
        if tx.balance is not None:
            m["balances"].append(tx.balance)
        fp = (tx.date, tx.amount, tx.description, tx.balance)
        if fp in fingerprints:
            possible_duplicates += 1
        fingerprints.add(fp)
        possible_transfer = any(term in tx.description.lower() for term in ("own account", "internal transfer", "self transfer"))
        if tx.category == "transfer":
            m["transfers"] += abs(tx.amount)
        elif possible_transfer:
            suspected.append(tx.transaction_id)
            # Positive suspected transfers cannot inflate income. Outflows remain conservative.
            m["operating_expenses"] += max(-tx.amount, 0)
        elif tx.category == "income":
            m["income"] += tx.amount
        elif tx.category in ("household", "debt"):
            m[tx.category] += -tx.amount
        else:
            m["operating_expenses"] += max(-tx.amount, 0)
            if tx.category == "unknown":
                uncertain.append(tx.transaction_id)
    if uncertain:
        flags.append({"code": "UNKNOWN_CATEGORY", "severity": "review", "message": f"Review {len(uncertain)} uncategorised transactions. Unknown inflows are excluded; outflows are retained.", "transaction_ids": uncertain})
    if suspected:
        flags.append({"code": "POSSIBLE_TRANSFER", "severity": "review", "message": f"Review {len(suspected)} possible own-account transfers before relying on capacity.", "transaction_ids": suspected})
    if possible_duplicates:
        flags.append({"code": "POSSIBLE_DUPLICATES", "severity": "review", "message": f"{possible_duplicates} records share date, amount, description and balance but have different IDs. Retained pending review."})
    complete = [m for m in months.values() if m["complete"]]
    if not complete:
        flags.append({"code": "NO_COMPLETE_MONTHS", "severity": "review", "message": "No complete calendar months are covered by the declared statement period."})
    if len(complete) < request.policy.minimum_months:
        flags.append({"code": "SHORT_HISTORY", "severity": "review", "message": f"{len(complete)} complete months; demonstration policy requires {request.policy.minimum_months}."})
    empty_months = [m["month"] for m in complete if not m["count"]]
    if empty_months:
        flags.append({"code": "EMPTY_MONTHS", "severity": "review", "message": "No transactions in: " + ", ".join(empty_months) + ". Confirm these are genuine inactive months."})
    if any(not m["complete"] for m in months.values()):
        flags.append({"code": "PARTIAL_MONTH", "severity": "info", "message": "Partial calendar months are shown but excluded from capacity calculations."})
    med = lambda key: statistics.median([m[key] for m in complete]) if complete else 0.
    a, p = request.applicant, request.policy
    # Match each month's inflows to its outflows BEFORE taking the median.
    for m in months.values():
        m["household_used"] = max(m["household"], a.household_expenses)
        m["debt_used"] = max(m["debt"], a.monthly_obligations)
        m["surplus"] = m["income"] - m["operating_expenses"] - m["household_used"] - m["debt_used"]
        m["stressed_surplus"] = m["income"] * (1 - p.revenue_shock) - (m["operating_expenses"] + m["household_used"]) * (1 + p.expense_shock) - m["debt_used"]
    sustainable = max(0., med("stressed_surplus"))
    capacity = sustainable * p.capacity_share
    instalment = payment(a.requested_amount, a.tenure_months, p.annual_rate)
    maximum = capacity / payment(1, a.tenure_months, p.annual_rate)
    incomes = [m["income"] for m in complete]
    average = statistics.mean(incomes) if incomes else 0.
    volatility = statistics.pstdev(incomes) / average if average > 0 else None
    balances = [t.balance for t in rows if t.balance is not None]
    closing = rows[-1].balance if rows else None
    if closing is None:
        flags.append({"code": "NO_CLOSING_BALANCE", "severity": "info", "message": "Latest transaction has no balance; liquidity buffer is unavailable."})
    if volatility is not None and volatility > .5:
        flags.append({"code": "VOLATILE_INCOME", "severity": "review", "message": "Monthly recognised income varies substantially; review seasonality and low-income months."})
    if any(m["surplus"] < 0 for m in complete):
        flags.append({"code": "NEGATIVE_SURPLUS", "severity": "review", "message": "At least one complete month has negative surplus after household needs and debt."})
    status = "INSUFFICIENT_DATA" if len(complete) < p.minimum_months else "REFER" if any(f["severity"] == "review" for f in flags) else "EXCEEDS_CAPACITY" if instalment > capacity else "WITHIN_CAPACITY"
    expense_base = med("operating_expenses") + med("household_used") + med("debt_used")
    digest_payload = request.model_dump(mode="json", exclude={"previous_assessment_id"})
    digest_payload["transactions"] = sorted(digest_payload["transactions"], key=lambda t: (t["date"], t["transaction_id"]))
    digest = hashlib.sha256(json.dumps(digest_payload, sort_keys=True).encode()).hexdigest()
    for m in months.values():
        observed = m.pop("balances")
        m["minimum_observed_balance"] = min(observed) if observed else None
        for key, value in m.items():
            if isinstance(value, float):
                m[key] = round(value, 2)
    return {
        "engine_version": ENGINE_VERSION, "input_hash": digest, "simulated": request.simulated,
        "applicant": a.model_dump(), "policy": p.model_dump(), "status": status,
        "default_probability": None, "risk_band": None, "risk_note": "No Malaysian default model has been validated. This is a demonstration affordability assessment, not a lending approval.",
        "period_start": str(start), "period_end": str(end), "monthly": list(months.values()), "flags": flags,
        "metrics": {"complete_months": len(complete), "transaction_count": len(rows), "duplicates_removed": duplicate_count,
            "total_inflows": round(sum(max(t.amount, 0) for t in rows), 2), "total_outflows": round(sum(max(-t.amount, 0) for t in rows), 2),
            "median_income": round(med("income"), 2), "median_surplus": round(med("surplus"), 2), "stressed_surplus": round(med("stressed_surplus"), 2),
            "income_volatility": volatility, "minimum_observed_balance": min(balances) if balances else None,
            "closing_balance": closing, "buffer_months": max(0, closing) / expense_base if closing is not None and expense_base > 0 else None,
            "monthly_capacity": round(capacity, 2), "requested_instalment": round(instalment, 2), "maximum_affordable_principal": round(maximum, 2)},
        "reasons": [
            {"code": "HISTORY", "text": f"Capacity uses {len(complete)} complete calendar months, including inactive months."},
            {"code": "HOUSEHOLD", "text": ("Worker living costs" if a.kind == "worker" else "Owner household draw") + " use the greater of declared household needs and recorded household outflows each month."},
            {"code": "OBLIGATIONS", "text": "Debt uses the greater of declared obligations and recorded debt payments each month; confirm completeness."},
            {"code": "STRESS", "text": f"Income falls {p.revenue_shock:.0%}; operating and household costs rise {p.expense_shock:.0%}."},
            {"code": "CAPACITY", "text": f"{p.capacity_share:.0%} of non-negative median stressed surplus supports a new repayment. Requested instalment is RM {instalment:,.2f} at illustrative {p.annual_rate:.1%} annual reducing-balance interest."},
            {"code": "EVIDENCE", "text": "Statement coverage and categories are user supplied. Balances are transaction-time observations, not daily balances. No identity, authenticity or fraud verification is performed."}
        ]
    }
