"""
Funciones de predicción y cálculo del Score de Riesgo.
Interfaz simplificada para utilizar el modelo de clasificación de mora.
"""

from __future__ import annotations

import numpy as np

from .model import DefaultRiskModel


class RiskScoreCalculator:
    """Calcula el Score de Riesgo de un préstamo."""

    def __init__(self, model: DefaultRiskModel | None = None):
        """
        Inicializa el calculador.

        Args:
            model: Instancia de DefaultRiskModel. Si es None, carga el modelo
                   entrenado por defecto.
        """
        self.model = model or DefaultRiskModel()
        if self.model.model is None:
            self.model.load(self.model.model_path)

    def calculate_risk_score(
        self,
        modality_days: int,
        interest_rate: float,
        client_payment_history_score: float,
    ) -> dict:
        """
        Calcula el Score de Riesgo para un préstamo propuesto.

        Args:
            modality_days: Duración del préstamo en días (10, 15, 25, 31)
            interest_rate: Tasa de interés (0.15 a 0.25)
            client_payment_history_score: Historial de pagos a tiempo del cliente (0.0 a 1.0)
                                         * 1.0 = siempre paga a tiempo
                                         * 0.0 = nunca ha pagado a tiempo

        Returns:
            Diccionario con:
            - probability: Probabilidad de mora (0.0 a 1.0)
            - risk_level: Clasificación ("BAJO", "MEDIO", "ALTO")
            - risk_score: Score numérico para ranking (0 a 100)
            - recommendation: Texto con recomendación
        """
        # Validación de inputs
        if modality_days not in [10, 15, 25, 31]:
            raise ValueError(f"Modalidad inválida: {modality_days}. Debe ser 10, 15, 25 o 31.")

        if not 0.0 <= interest_rate <= 1.0:
            raise ValueError(f"Tasa de interés inválida: {interest_rate}. Debe estar entre 0 y 1.")

        if not 0.0 <= client_payment_history_score <= 1.0:
            raise ValueError(
                f"Historial de pagos inválido: {client_payment_history_score}. Debe estar entre 0 y 1."
            )

        # Preparar features para predicción
        features = np.array(
            [[modality_days, interest_rate, client_payment_history_score]],
            dtype=np.float32,
        )

        # Obtener probabilidad de mora del modelo
        default_probability = self.model.predict_default_probability(features)[0]

        # Convertir probabilidad a Score (0-100)
        risk_score = int(default_probability * 100)

        # Clasificar en niveles
        if default_probability <= 0.33:
            risk_level = "BAJO"
            recommendation = "✓ Préstamo con bajo riesgo. Puede ser aprobado."
        elif default_probability <= 0.66:
            risk_level = "MEDIO"
            recommendation = "⚠️ Préstamo con riesgo moderado. Requiere supervisión."
        else:
            risk_level = "ALTO"
            recommendation = "✗ Préstamo con alto riesgo. Se recomienda rechazar o exigir garantías."

        return {
            "probability": round(float(default_probability), 4),
            "risk_level": risk_level,
            "risk_score": risk_score,
            "recommendation": recommendation,
            "details": {
                "modality_days": modality_days,
                "interest_rate": interest_rate,
                "client_payment_history_score": client_payment_history_score,
            },
        }

    def batch_calculate_risk_scores(
        self,
        loan_proposals: list[dict],
    ) -> list[dict]:
        """
        Calcula el Score de Riesgo para múltiples préstamos propuestos.

        Args:
            loan_proposals: Lista de diccionarios con claves:
                           'modality_days', 'interest_rate', 'client_payment_history_score'

        Returns:
            Lista de diccionarios con resultados de riesgo
        """
        results = []
        for proposal in loan_proposals:
            result = self.calculate_risk_score(
                modality_days=proposal["modality_days"],
                interest_rate=proposal["interest_rate"],
                client_payment_history_score=proposal["client_payment_history_score"],
            )
            results.append(result)

        return results


# Instancia global del calculador (lazy-loaded)
_risk_calculator = None


def get_risk_calculator() -> RiskScoreCalculator:
    """Obtiene la instancia global del calculador de riesgo."""
    global _risk_calculator
    if _risk_calculator is None:
        _risk_calculator = RiskScoreCalculator()
    return _risk_calculator


def calculate_loan_risk(
    modality_days: int,
    interest_rate: float,
    client_payment_history_score: float,
) -> dict:
    """
    Función de conveniencia para calcular riesgo de un préstamo.

    Args:
        modality_days: Duración del préstamo en días
        interest_rate: Tasa de interés
        client_payment_history_score: Historial de pagos del cliente

    Returns:
        Diccionario con resultado de riesgo
    """
    calculator = get_risk_calculator()
    return calculator.calculate_risk_score(
        modality_days=modality_days,
        interest_rate=interest_rate,
        client_payment_history_score=client_payment_history_score,
    )


if __name__ == "__main__":
    print("🚀 DEMOSTRACIÓN DEL CALCULADOR DE RIESGO")
    print("=" * 70)

    calculator = RiskScoreCalculator()

    # Test cases
    test_cases = [
        {
            "name": "Préstamo Seguro",
            "modality_days": 31,
            "interest_rate": 0.15,
            "client_payment_history_score": 0.9,
        },
        {
            "name": "Préstamo de Riesgo Moderado",
            "modality_days": 25,
            "interest_rate": 0.20,
            "client_payment_history_score": 0.5,
        },
        {
            "name": "Préstamo de Alto Riesgo",
            "modality_days": 10,
            "interest_rate": 0.25,
            "client_payment_history_score": 0.2,
        },
        {
            "name": "Préstamo con Buen Cliente",
            "modality_days": 15,
            "interest_rate": 0.22,
            "client_payment_history_score": 0.95,
        },
        {
            "name": "Préstamo Corto de Cliente Nuevo",
            "modality_days": 10,
            "interest_rate": 0.20,
            "client_payment_history_score": 0.5,
        },
    ]

    for i, test_case in enumerate(test_cases, 1):
        print(f"\n{i}. {test_case['name']}")
        print("-" * 70)

        result = calculator.calculate_risk_score(
            modality_days=test_case["modality_days"],
            interest_rate=test_case["interest_rate"],
            client_payment_history_score=test_case["client_payment_history_score"],
        )

        print(f"   Modalidad: {test_case['modality_days']} días")
        print(f"   Tasa de interés: {test_case['interest_rate'] * 100:.0f}%")
        print(f"   Historial de pagos: {test_case['client_payment_history_score']:.1%}")
        print(f"\n   📊 RESULTADO:")
        print(f"   Probabilidad de mora: {result['probability']:.2%}")
        print(f"   Score de Riesgo: {result['risk_score']}/100")
        print(f"   Nivel de Riesgo: {result['risk_level']}")
        print(f"   {result['recommendation']}")

    print("\n" + "=" * 70)
