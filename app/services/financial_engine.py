"""
Motor Financiero DLHB-CORE — app/services/financial_engine.py

Capa de servicios que centraliza toda la lógica de créditos.
No importa FastAPI; es puro Python + SQLAlchemy para máxima testeabilidad.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Optional

from sqlalchemy.orm import Session

from ..models import InterestPeriodUnit, InterestRecord, Loan, LoanStatus, MoraRecord, Payment


# ---------------------------------------------------------------------------
# Tipos de datos de soporte
# ---------------------------------------------------------------------------

@dataclass
class LoanState:
    """Estado financiero completo y calculado de un crédito."""

    loan_id: int
    capital_inicial: float
    capital_pendiente: float
    interes_pendiente: float          # calculado desde historial (nunca persistido)
    mora_vigente: float               # calculada desde historial (nunca persistida)
    interes_periodo_siguiente: float  # capital_pendiente × tasa_del_periodo
    estado: str                       # ACTIVO | CANCELADO


@dataclass
class PaymentResult:
    """Resultado de la aplicación de un pago, incluyendo distribución y snapshot."""

    payment_id: int
    monto_total: float
    monto_a_mora: float
    monto_a_interes: float
    monto_a_capital: float
    capital_previo: float
    capital_posterior: float
    mora_previa: float
    mora_posterior: float
    nuevo_estado: str


# ---------------------------------------------------------------------------
# Stub de servicios — las implementaciones se añaden en tareas posteriores
# ---------------------------------------------------------------------------

class InterestCalculator:
    """Calcula tasas e intereses del crédito."""

    @staticmethod
    def convert_rate_to_period(rate: float, unit: InterestPeriodUnit, periodicidad_dias: int) -> float:
        """
        Convierte la tasa almacenada al equivalente para el período pactado.

        Reglas:
        - POR_PERIODO: rate ya es la tasa del período → devuelve rate directamente.
        - MENSUAL:     rate es mensual → rate × (periodicidad_dias / 30)
        - ANUAL:       rate es anual  → rate × (periodicidad_dias / 365)

        Raises:
            ValueError: Si rate <= 0 o periodicidad_dias <= 0
        """
        if rate <= 0:
            raise ValueError(f"La tasa debe ser mayor que cero, recibido: {rate}")
        if periodicidad_dias <= 0:
            raise ValueError(f"periodicidad_dias debe ser mayor que cero, recibido: {periodicidad_dias}")

        if unit == InterestPeriodUnit.POR_PERIODO:
            return rate
        elif unit == InterestPeriodUnit.MENSUAL:
            return rate * (periodicidad_dias / 30)
        elif unit == InterestPeriodUnit.ANUAL:
            return rate * (periodicidad_dias / 365)
        else:
            raise ValueError(f"Unidad de tasa no reconocida: {unit}")

    @staticmethod
    def calculate_interest(
        capital_pendiente: float,
        rate: float,
        unit: InterestPeriodUnit,
        periodicidad_dias: int,
    ) -> float:
        """
        Calcula el monto de interés del período completo.

        Resultado = capital_pendiente × convert_rate_to_period(rate, unit, periodicidad_dias)
        El interés es siempre el monto completo del período; sin prorrateo por días.
        El resultado es siempre >= 0.

        Returns:
            Monto de interés (>= 0).
        """
        tasa_periodo = InterestCalculator.convert_rate_to_period(rate, unit, periodicidad_dias)
        return capital_pendiente * tasa_periodo

    @staticmethod
    def calculate_interes_pendiente(loan_id: int, db: Session) -> float:
        """
        Calcula el Interes_Pendiente vigente desde el historial.

        Fórmula: Σ(InterestRecord.monto_interes) − Σ(Payment.monto_a_interes)

        Returns:
            Interes_Pendiente >= 0. Nunca negativo.

        Raises:
            ValueError: Si el resultado calculado sería negativo (indica corrupción de datos).
        """
        from sqlalchemy import func as sqlfunc

        suma_registros = (
            db.query(sqlfunc.coalesce(sqlfunc.sum(InterestRecord.monto_interes), 0.0))
            .filter(InterestRecord.loan_id == loan_id)
            .scalar() or 0.0
        )

        suma_pagos = (
            db.query(sqlfunc.coalesce(sqlfunc.sum(Payment.monto_a_interes), 0.0))
            .filter(Payment.loan_id == loan_id)
            .scalar() or 0.0
        )

        resultado = suma_registros - suma_pagos

        if resultado < -1e-9:  # tolerancia para errores de punto flotante
            raise ValueError(
                f"Interes_Pendiente calculado es negativo ({resultado:.2f}) para loan_id={loan_id}. "
                "Esto indica corrupción de datos."
            )

        return max(0.0, resultado)


class MoraService:
    """Registra y calcula moras del crédito."""

    @staticmethod
    def calculate_mora_vigente(loan_id: int, db: Session) -> float:
        """
        Calcula la Mora vigente total desde el historial.

        Fórmula: Σ(MoraRecord.monto) − Σ(Payment.monto_a_mora)

        Returns:
            Mora_vigente >= 0.
        """
        from sqlalchemy import func as sqlfunc

        suma_mora = db.query(sqlfunc.coalesce(sqlfunc.sum(MoraRecord.monto), 0.0))\
            .filter(MoraRecord.loan_id == loan_id).scalar() or 0.0

        suma_pagos_mora = db.query(sqlfunc.coalesce(sqlfunc.sum(Payment.monto_a_mora), 0.0))\
            .filter(Payment.loan_id == loan_id).scalar() or 0.0

        resultado = suma_mora - suma_pagos_mora
        return max(0.0, resultado)

    @staticmethod
    def get_mora_records_fifo(loan_id: int, db: Session) -> list[MoraRecord]:
        """
        Retorna los MoraRecord del crédito ordenados por fecha_evento ASC (FIFO).
        El registro más antiguo es el primero de la lista.
        """
        return (
            db.query(MoraRecord)
            .filter(MoraRecord.loan_id == loan_id)
            .order_by(MoraRecord.fecha_evento.asc())
            .all()
        )


class PaymentEngine:
    """Motor central de aplicación de pagos (transacción ACID)."""

    pass


class LoanStateService:
    """Construye el estado financiero calculado de un crédito."""

    pass
