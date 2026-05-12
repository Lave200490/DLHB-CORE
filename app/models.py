from __future__ import annotations

from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Column, Date, Enum, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from .database import Base


class Client(Base):
    """Entidad Cliente: un cliente puede tener muchos préstamos."""

    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(length=255), nullable=False, index=True)
    phone = Column(String(length=50), nullable=False, unique=True)

    loans = relationship("Loan", back_populates="client", cascade="all, delete-orphan")


class LoanStatus(str, Enum):
    ACTIVO = "ACTIVO"
    INACTIVO = "INACTIVO"


class Loan(Base):
    """Entidad Préstamo: un préstamo pertenece a un cliente y puede tener muchos pagos."""

    __tablename__ = "loans"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True)
    initial_capital = Column(Float, nullable=False)
    interest_rate = Column(Float, nullable=False)
    modality_days = Column(Integer, nullable=False)
    outstanding_balance = Column(Float, nullable=False)
    status = Column(Enum(LoanStatus), nullable=False, default=LoanStatus.ACTIVO)
    advisor = Column(String(length=1), nullable=False)
    delivery_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=False)

    client = relationship("Client", back_populates="loans")
    payments = relationship("Payment", back_populates="loan", cascade="all, delete-orphan")


class Payment(Base):
    """Entidad Registro_Pago: un pago pertenece a un préstamo."""

    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    loan_id = Column(Integer, ForeignKey("loans.id", ondelete="CASCADE"), nullable=False, index=True)
    payment_date = Column(Date, nullable=False)
    amount_received = Column(Float, nullable=False)
    principal_payment = Column(Float, nullable=False)
    interest_payment = Column(Float, nullable=False)

    loan = relationship("Loan", back_populates="payments")
