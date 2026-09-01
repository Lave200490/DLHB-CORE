from __future__ import annotations

from datetime import date
from enum import Enum as PyEnum
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Column, Date, DateTime, Enum, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship

from .database import Base


class InterestPeriodUnit(str, PyEnum):
    MENSUAL = "mensual"
    ANUAL = "anual"
    POR_PERIODO = "por_periodo"


class Client(Base):
    """Entidad Cliente: un cliente puede tener muchos préstamos."""

    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(length=255), nullable=False, index=True)
    phone = Column(String(length=50), nullable=False, unique=True)

    loans = relationship("Loan", back_populates="client", cascade="all, delete-orphan")


class LoanStatus(str, PyEnum):
    ACTIVO = "ACTIVO"
    INACTIVO = "INACTIVO"    # legacy — mantenido para datos históricos
    CANCELADO = "CANCELADO"  # nuevo — estado final del motor financiero


class Loan(Base):
    """Entidad Préstamo: un préstamo pertenece a un cliente y puede tener muchos pagos."""

    __tablename__ = "loans"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True)
    initial_capital = Column(Float, nullable=False)
    interest_rate = Column(Float, nullable=False)
    interest_period_unit = Column(Enum(InterestPeriodUnit), nullable=False, default=InterestPeriodUnit.POR_PERIODO)
    modality_days = Column(Integer, nullable=False)
    outstanding_balance = Column(Float, nullable=False)
    status = Column(Enum(LoanStatus), nullable=False, default=LoanStatus.ACTIVO)
    advisor = Column(String(length=50), nullable=False)
    delivery_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=False)

    client = relationship("Client", back_populates="loans")
    payments = relationship("Payment", back_populates="loan", cascade="all, delete-orphan")
    interest_records = relationship("InterestRecord", back_populates="loan", cascade="all, delete-orphan")
    mora_records = relationship("MoraRecord", back_populates="loan", cascade="all, delete-orphan")


class Payment(Base):
    """Entidad Registro_Pago: un pago pertenece a un préstamo."""

    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    loan_id = Column(Integer, ForeignKey("loans.id", ondelete="CASCADE"), nullable=False, index=True)
    payment_date = Column(Date, nullable=False)
    amount_received = Column(Float, nullable=False)
    principal_payment = Column(Float, nullable=False)
    interest_payment = Column(Float, nullable=False)
    # Distribución del motor financiero
    monto_a_mora      = Column(Float, nullable=False, default=0.0)
    monto_a_interes   = Column(Float, nullable=False, default=0.0)
    monto_a_capital   = Column(Float, nullable=False, default=0.0)
    # Snapshot de estado (D11)
    capital_previo    = Column(Float, nullable=True)
    capital_posterior = Column(Float, nullable=True)
    mora_previa       = Column(Float, nullable=True)
    mora_posterior    = Column(Float, nullable=True)
    # Metadatos
    observacion       = Column(String(length=500), nullable=True)
    asesor            = Column(String(length=50), nullable=True)

    loan = relationship("Loan", back_populates="payments")


class InterestRecord(Base):
    """Registro de interés generado (append-only)."""

    __tablename__ = "interest_records"

    id                   = Column(Integer, primary_key=True, index=True)
    loan_id              = Column(Integer, ForeignKey("loans.id", ondelete="CASCADE"), nullable=False, index=True)
    monto_interes        = Column(Float, nullable=False)
    capital_base         = Column(Float, nullable=False)
    tasa_aplicada        = Column(Float, nullable=False)
    interest_period_unit = Column(Enum(InterestPeriodUnit), nullable=False)
    fecha_generacion     = Column(Date, nullable=False)
    asesor               = Column(String(length=50), nullable=False)
    observacion          = Column(String(length=500), nullable=True)
    created_at           = Column(DateTime, server_default=func.now(), nullable=False)

    loan = relationship("Loan", back_populates="interest_records")


class MoraRecord(Base):
    """Registro de mora manual (append-only)."""

    __tablename__ = "mora_records"

    id           = Column(Integer, primary_key=True, index=True)
    loan_id      = Column(Integer, ForeignKey("loans.id", ondelete="CASCADE"), nullable=False, index=True)
    monto        = Column(Float, nullable=False)
    fecha_evento = Column(Date, nullable=False)
    motivo       = Column(String(length=255), nullable=False)
    observacion  = Column(String(length=500), nullable=True)
    asesor       = Column(String(length=50), nullable=False)
    created_at   = Column(DateTime, server_default=func.now(), nullable=False)

    loan = relationship("Loan", back_populates="mora_records")
