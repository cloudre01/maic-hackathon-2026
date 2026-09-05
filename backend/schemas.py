from datetime import date
from typing import Literal
from pydantic import BaseModel, Field, ConfigDict


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class Applicant(StrictModel):
    name: str = Field(min_length=1, max_length=100)
    kind: Literal["worker", "business"]
    purpose: str = Field(min_length=1, max_length=250)
    requested_amount: float = Field(gt=0, le=1000000)
    tenure_months: int = Field(ge=1, le=120)
    household_expenses: float = Field(ge=0, le=1000000)
    monthly_obligations: float = Field(ge=0, le=1000000)


class Policy(StrictModel):
    revenue_shock: float = Field(default=0.2, ge=0, le=0.9)
    expense_shock: float = Field(default=0.1, ge=0, le=1)
    capacity_share: float = Field(default=0.5, gt=0, le=1)
    annual_rate: float = Field(default=0.12, ge=0, le=1)
    minimum_months: int = Field(default=6, ge=3, le=24)


class Transaction(StrictModel):
    transaction_id: str = Field(min_length=1, max_length=100)
    date: date
    amount: float = Field(ge=-1e9, le=1e9)
    balance: float | None = Field(default=None, ge=-1e9, le=1e9)
    description: str = Field(default="", max_length=500)
    category: Literal["income", "expense", "household", "debt", "transfer", "unknown"]


class AssessmentRequest(StrictModel):
    applicant: Applicant
    policy: Policy = Field(default_factory=Policy)
    transactions: list[Transaction] = Field(min_length=1, max_length=20000)
    period_start: date
    period_end: date
    simulated: bool = False
    previous_assessment_id: str | None = None
