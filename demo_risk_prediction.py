#!/usr/bin/env python
"""
Script de demostración: Prueba el predictor de riesgo con múltiples casos de uso.
Ejecutar:

    python demo_risk_prediction.py
"""

import sys
from pathlib import Path

# Agregar el directorio raíz al path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from app.ml import RiskScoreCalculator


def main():
    """Demostración del predictor de riesgo."""
    print("\n" + "=" * 80)
    print("🎯 DEMOSTRACIÓN: PREDICTOR DE RIESGO DE MORA")
    print("=" * 80)

    try:
        calculator = RiskScoreCalculator()
        print("✓ Modelo cargado exitosamente\n")

    except FileNotFoundError:
        print(
            "\n❌ Modelo no encontrado. Por favor, ejecuta primero:\n"
            "   python train_default_risk_model.py\n"
        )
        return 1

    # Casos de prueba
    test_cases = [
        {
            "name": "📍 Caso 1: Préstamo Seguro",
            "description": "Modalidad larga + tasa baja + excelente historial",
            "modality_days": 31,
            "interest_rate": 0.15,
            "client_payment_history_score": 0.95,
        },
        {
            "name": "📍 Caso 2: Riesgo Moderado",
            "description": "Modalidad media + tasa media + historial regular",
            "modality_days": 25,
            "interest_rate": 0.20,
            "client_payment_history_score": 0.50,
        },
        {
            "name": "📍 Caso 3: Riesgo Alto",
            "description": "Modalidad corta + tasa alta + mal historial",
            "modality_days": 10,
            "interest_rate": 0.25,
            "client_payment_history_score": 0.20,
        },
        {
            "name": "📍 Caso 4: Cliente Excelente + Modalidad Corta",
            "description": "Modalidad corta pero cliente con perfecto historial",
            "modality_days": 15,
            "interest_rate": 0.22,
            "client_payment_history_score": 0.98,
        },
        {
            "name": "📍 Caso 5: Cliente Nuevo + Condiciones Normales",
            "description": "Cliente sin historial + términos estándar",
            "modality_days": 25,
            "interest_rate": 0.20,
            "client_payment_history_score": 0.50,
        },
        {
            "name": "📍 Caso 6: Plazo Muy Corto + Tasa Estándar",
            "description": "Modalidad mínima + tasa media + historial promedio",
            "modality_days": 10,
            "interest_rate": 0.20,
            "client_payment_history_score": 0.60,
        },
    ]

    for test_case in test_cases:
        print(test_case["name"])
        print("-" * 80)
        print(f"  {test_case['description']}")
        print(f"  Parámetros:")
        print(f"    • Modalidad: {test_case['modality_days']} días")
        print(f"    • Tasa de interés: {test_case['interest_rate'] * 100:.0f}%")
        print(f"    • Historial de pagos: {test_case['client_payment_history_score']:.0%}")

        result = calculator.calculate_risk_score(
            modality_days=test_case["modality_days"],
            interest_rate=test_case["interest_rate"],
            client_payment_history_score=test_case["client_payment_history_score"],
        )

        # Mostrar resultados con código de color
        color_by_risk = {
            "BAJO": "🟢",
            "MEDIO": "🟡",
            "ALTO": "🔴",
        }

        print(f"\n  📊 RESULTADO:")
        print(f"    Probabilidad de mora: {result['probability']:.2%}")
        print(
            f"    {color_by_risk[result['risk_level']]} Nivel de Riesgo: {result['risk_level']}"
        )
        print(f"    Score de Riesgo: {result['risk_score']}/100")
        print(f"    {result['recommendation']}\n")

    print("=" * 80)
    print("✅ Demostración completada")
    print("=" * 80 + "\n")

    return 0


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
