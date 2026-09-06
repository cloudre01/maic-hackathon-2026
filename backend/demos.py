"""Explicitly fictional Malaysian transactions for exercising product functionality."""

import calendar
from .schemas import AssessmentRequest

SCENARIOS = [
    {
        "id": "worker",
        "name": "Aina Rahman",
        "kind": "worker",
        "subtitle": "Freelance designer · equipment financing",
        "purpose": "Laptop and work equipment",
        "requested_amount": 8000,
        "tenure_months": 12,
        "household_expenses": 1600,
        "monthly_obligations": 250,
    },
    {
        "id": "business",
        "name": "Dapur Nuri",
        "kind": "business",
        "subtitle": "Home-based food business · working capital",
        "purpose": "Ingredients and packaging inventory",
        "requested_amount": 20000,
        "tenure_months": 18,
        "household_expenses": 2000,
        "monthly_obligations": 400,
    },
    {
        "id": "limited",
        "name": "Ravi Kumar",
        "kind": "worker",
        "subtitle": "Delivery partner · motorcycle repairs",
        "purpose": "Motorcycle repairs",
        "requested_amount": 5000,
        "tenure_months": 12,
        "household_expenses": 1400,
        "monthly_obligations": 200,
    },
]


def scenario(scenario_id: str, extended: bool = False) -> AssessmentRequest:
    info = next((s for s in SCENARIOS if s["id"] == scenario_id), None)
    if not info:
        raise KeyError(scenario_id)
    n = (3 if extended else 2) if scenario_id == "limited" else (7 if extended else 6)
    incomes = {
        "worker": [5800, 6700, 5900, 7100, 6500, 6800, 7600],
        "business": [14000, 18000, 32000, 12000, 13500, 15500, 19000],
        "limited": [3200, 3900, 4100],
    }[scenario_id]
    balance = (
        4200 if scenario_id == "worker" else 6500 if scenario_id == "business" else 500
    )
    rows = []
    for month in range(1, n + 1):
        income = incomes[month - 1]
        expense = (
            800
            if scenario_id == "worker"
            else income * 0.55
            if scenario_id == "business"
            else 700
        )
        values = [
            (
                3,
                income * 0.55,
                "income",
                "Client invoice settlement"
                if scenario_id == "worker"
                else "DuitNow merchant settlement"
                if scenario_id == "business"
                else "Delivery platform payout",
            ),
            (7, -expense, "expense", "Operating costs"),
            (
                12,
                income * 0.45,
                "income",
                "Client payment" if scenario_id == "worker" else "Sales settlement",
            ),
            (18, -info["household_expenses"], "household", "Household budget"),
            (22, -info["monthly_obligations"], "debt", "Existing financing instalment"),
            (26, 500, "transfer", "Own account transfer"),
            (28, -500, "transfer", "Own account transfer"),
        ]
        for i, (day, amount, category, description) in enumerate(values):
            balance += amount
            rows.append(
                {
                    "transaction_id": f"{scenario_id}-{month:02}-{i}",
                    "date": f"2026-{month:02}-{day:02}",
                    "amount": round(amount, 2),
                    "balance": round(balance, 2),
                    "category": category,
                    "description": description,
                }
            )
    applicant = {k: v for k, v in info.items() if k not in ("id", "subtitle")}
    return AssessmentRequest(
        applicant=applicant,
        transactions=rows,
        simulated=True,
        period_start="2026-01-01",
        period_end=f"2026-{n:02}-{calendar.monthrange(2026, n)[1]}",
    )
