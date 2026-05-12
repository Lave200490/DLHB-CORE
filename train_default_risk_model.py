#!/usr/bin/env python
"""
Script de inicialización: Entrena y guarda el modelo de clasificación de mora.
Ejecutar una sola vez al iniciar el proyecto:

    python train_default_risk_model.py

Esto generará datos sintéticos y entrenará un Random Forest que será
utilizado por la API en el endpoint /riesgo/evaluar
"""

import sys
from pathlib import Path

# Agregar el directorio raíz al path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from app.ml import train_and_save_model


def main():
    """Entrenar y guardar el modelo."""
    print("\n" + "=" * 70)
    print("🚀 ENTRENAMIENTO DEL MODELO DE CLASIFICACIÓN DE MORA")
    print("=" * 70)

    try:
        model = train_and_save_model(n_samples=1000)

        print("\n" + "=" * 70)
        print("✅ MODELO ENTRENADO Y GUARDADO EXITOSAMENTE")
        print("=" * 70)
        print(f"\n📍 Ubicación: {model.model_path}")
        print("\n✓ El modelo está listo para ser utilizado por la API.")
        print("✓ Inicia el servidor con: uvicorn app.main:app --reload")
        print("✓ Prueba el endpoint: POST /riesgo/evaluar")

        return 0

    except Exception as e:
        print(f"\n❌ Error al entrenar el modelo: {e}")
        import traceback

        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
