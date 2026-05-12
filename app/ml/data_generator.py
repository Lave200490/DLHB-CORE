"""
Generador de datos sintéticos para entrenamiento del modelo de clasificación de mora.
Simula un historial de préstamos con información de pagos a tiempo o retrasos.
"""

from __future__ import annotations

import random
from dataclasses import dataclass

import numpy as np


@dataclass
class SyntheticLoanRecord:
    """Representa un registro sintético de préstamo para entrenamiento."""

    modality_days: int
    interest_rate: float
    client_payment_history_score: float
    is_in_default: bool


def generate_synthetic_data(n_samples: int = 500, random_state: int = 42) -> tuple:
    """
    Genera datos sintéticos para entrenar el modelo de clasificación de mora.

    Variables predictivas:
    - modality_days: 10, 15, 25, 31 (días del préstamo)
    - interest_rate: 0.15 a 0.25 (15% a 25%)
    - client_payment_history_score: 0.0 a 1.0 (historial de pagos a tiempo)
      * 1.0 = siempre paga a tiempo
      * 0.0 = nunca ha pagado a tiempo

    Target (is_in_default):
    - 0: Préstamo sin mora
    - 1: Préstamo en mora

    La mora está correlacionada con:
    - Modalidades cortas + tasa alta + mal historial = mayor probabilidad de mora
    - Modalidades largas + tasa baja + buen historial = menor probabilidad de mora

    Args:
        n_samples: Cantidad de registros sintéticos a generar
        random_state: Seed para reproducibilidad

    Returns:
        Tupla (X, y) donde:
        - X: array de shape (n_samples, 3) con variables predictivas
        - y: array de shape (n_samples,) con labels (0: sin mora, 1: en mora)
    """
    random.seed(random_state)
    np.random.seed(random_state)

    modality_options = [10, 15, 25, 31]
    records = []

    for _ in range(n_samples):
        # Variables predictivas
        modality_days = random.choice(modality_options)
        interest_rate = round(random.uniform(0.15, 0.25), 2)
        client_payment_history_score = round(random.uniform(0.0, 1.0), 2)

        # Lógica para determinar mora (correlacionada con variables)
        # Factores de riesgo:
        # - Modalidad corta (10, 15 días) = mayor riesgo
        # - Tasa de interés alta = mayor riesgo
        # - Mal historial de pagos = mayor riesgo

        risk_score = 0.0

        # Factor 1: Modalidad
        if modality_days <= 15:
            risk_score += 0.4  # Modalidades cortas son más riesgosas
        elif modality_days == 25:
            risk_score += 0.2
        else:
            risk_score += 0.1

        # Factor 2: Tasa de interés
        if interest_rate >= 0.22:
            risk_score += 0.3
        elif interest_rate >= 0.20:
            risk_score += 0.2
        else:
            risk_score += 0.1

        # Factor 3: Historial de pagos (inverso: bajo historial = alto riesgo)
        risk_score += (1.0 - client_payment_history_score) * 0.4

        # Agregar ruido estocástico para variabilidad
        risk_score += np.random.normal(0, 0.05)
        risk_score = np.clip(risk_score, 0, 1)

        # Umbral: si risk_score > 0.5, hay mora
        is_in_default = 1 if risk_score > 0.5 else 0

        records.append(
            SyntheticLoanRecord(
                modality_days=modality_days,
                interest_rate=interest_rate,
                client_payment_history_score=client_payment_history_score,
                is_in_default=is_in_default,
            )
        )

    # Convertir a arrays de numpy
    X = np.array(
        [
            [r.modality_days, r.interest_rate, r.client_payment_history_score]
            for r in records
        ],
        dtype=np.float32,
    )
    y = np.array([r.is_in_default for r in records], dtype=np.int32)

    return X, y


if __name__ == "__main__":
    # Ejemplo de uso
    X, y = generate_synthetic_data(n_samples=500)
    print(f"Dataset generado: X.shape={X.shape}, y.shape={y.shape}")
    print(f"Distribución de clases: {np.bincount(y)}")
    print(f"\nPrimeros 5 registros de X:\n{X[:5]}")
    print(f"\nPrimeros 5 labels de y:\n{y[:5]}")
