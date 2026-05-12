from __future__ import annotations

from datetime import date
from typing import List

from pydantic import BaseModel, Field, PositiveFloat, PositiveInt


class PaymentBase(BaseModel):
    loan_id: int = Field(..., gt=0)
    payment_date: date
    amount_received: PositiveFloat
    principal_payment: PositiveFloat
    interest_payment: PositiveFloat


class PaymentCreate(PaymentBase):
    pass


class PaymentRegister(BaseModel):
    """Schema para el endpoint transaccional de registro de pagos."""

    loan_id: int = Field(..., gt=0)
    amount_received: PositiveFloat
    payment_date: date


class PaymentRead(PaymentBase):
    id: int

    class Config:
        orm_mode = True


class LoanBase(BaseModel):
    client_id: int = Field(..., gt=0)
    initial_capital: PositiveFloat
    interest_rate: float = Field(..., ge=0.0)
    modality_days: PositiveInt
    outstanding_balance: PositiveFloat
    status: str = Field(...)
    advisor: str = Field(..., min_length=1, max_length=1)
    delivery_date: date
    due_date: date


class LoanCreate(LoanBase):
    pass


class LoanRead(LoanBase):
    id: int
    payments: List[PaymentRead] = []

    class Config:
        orm_mode = True


class ClientBase(BaseModel):
    name: str = Field(..., min_length=1)
    phone: str = Field(..., min_length=5)


class ClientCreate(ClientBase):
    pass


class ClientRead(ClientBase):
    id: int
    loans: List[LoanRead] = []

    class Config:
        orm_mode = True


class RiskAssessmentRequest(BaseModel):
    """Request para evaluación de riesgo de un préstamo propuesto."""

    modality_days: PositiveInt = Field(..., description="Duración en días: 10, 15, 25 o 31")
    interest_rate: float = Field(..., ge=0.0, le=1.0, description="Tasa de interés (ej. 0.20)")
    client_payment_history_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Historial de pagos a tiempo (0.0=nunca paga, 1.0=siempre paga)",
    )


class RiskAssessmentResponse(BaseModel):
    """Response con evaluación de riesgo de mora."""

    probability: float = Field(..., description="Probabilidad de mora (0.0 a 1.0)")
    risk_level: str = Field(..., description="Nivel de riesgo: BAJO, MEDIO, ALTO")
    risk_score: int = Field(..., description="Score numérico de riesgo (0-100)")
    recommendation: str = Field(..., description="Recomendación de aprobación")
    details: dict = Field(..., description="Detalles de entrada utilizados")
