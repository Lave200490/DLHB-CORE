"""
Módulo de entrenamiento y persistencia del modelo de clasificación de mora.
Utiliza Random Forest para predecir la probabilidad de que un préstamo entre en mora.
"""

from __future__ import annotations

import os
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

from .data_generator import generate_synthetic_data


class DefaultRiskModel:
    """
    Modelo de clasificación para predecir probabilidad de mora en préstamos.
    Utiliza Random Forest entrenado con datos sintéticos.
    """

    def __init__(self, model_path: str | None = None):
        """
        Inicializa el modelo.

        Args:
            model_path: Ruta a un modelo entrenado guardado. Si es None,
                       se crea un nuevo modelo sin entrenar.
        """
        self.model = None
        self.scaler = None
        self.model_path = model_path or self._get_default_model_path()

        if model_path and os.path.exists(model_path):
            self.load(model_path)

    @staticmethod
    def _get_default_model_path() -> str:
        """Retorna la ruta por defecto donde guardar/cargar el modelo."""
        models_dir = Path(__file__).parent / "models"
        models_dir.mkdir(exist_ok=True)
        return str(models_dir / "default_risk_model.pkl")

    def train(self, X_train: np.ndarray, y_train: np.ndarray) -> dict:
        """
        Entrena el modelo de Random Forest.

        Args:
            X_train: Features de entrenamiento (n_samples, 3)
            y_train: Labels de entrenamiento (n_samples,)

        Returns:
            Diccionario con métricas de entrenamiento
        """
        # Normalizar los datos
        self.scaler = StandardScaler()
        X_train_scaled = self.scaler.fit_transform(X_train)

        # Entrenar Random Forest
        self.model = RandomForestClassifier(
            n_estimators=100,
            max_depth=10,
            min_samples_split=5,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=-1,
        )
        self.model.fit(X_train_scaled, y_train)

        # Retornar información de entrenamiento
        return {
            "n_estimators": self.model.n_estimators,
            "max_depth": self.model.max_depth,
            "training_samples": len(X_train),
            "feature_importances": dict(
                zip(
                    ["modality_days", "interest_rate", "payment_history_score"],
                    self.model.feature_importances_,
                )
            ),
        }

    def evaluate(self, X_test: np.ndarray, y_test: np.ndarray) -> dict:
        """
        Evalúa el modelo en un conjunto de prueba.

        Args:
            X_test: Features de prueba
            y_test: Labels de prueba

        Returns:
            Diccionario con métricas de evaluación
        """
        if self.model is None or self.scaler is None:
            raise ValueError("El modelo no ha sido entrenado. Llama a train() primero.")

        X_test_scaled = self.scaler.transform(X_test)
        y_pred = self.model.predict(X_test_scaled)
        y_pred_proba = self.model.predict_proba(X_test_scaled)

        return {
            "accuracy": self.model.score(X_test_scaled, y_test),
            "confusion_matrix": confusion_matrix(y_test, y_pred).tolist(),
            "classification_report": classification_report(
                y_test, y_pred, output_dict=True
            ),
            "default_probability": float(y_pred_proba[y_pred == 1].mean()),
        }

    def predict_default_probability(self, X: np.ndarray) -> np.ndarray:
        """
        Predice la probabilidad de mora para muestras nuevas.

        Args:
            X: Array de features de shape (n_samples, 3) o (3,) para una muestra

        Returns:
            Array de probabilidades de mora (valores entre 0 y 1)
        """
        if self.model is None or self.scaler is None:
            raise ValueError("El modelo no ha sido entrenado. Llama a train() primero.")

        # Manejo de una única muestra
        if X.ndim == 1:
            X = X.reshape(1, -1)

        X_scaled = self.scaler.transform(X)
        # Retornar probabilidad de la clase positiva (mora)
        return self.model.predict_proba(X_scaled)[:, 1]

    def save(self, path: str | None = None) -> str:
        """
        Guarda el modelo entrenado y el scaler a disco.

        Args:
            path: Ruta donde guardar. Si es None, usa la ruta por defecto.

        Returns:
            Ruta donde se guardó el modelo
        """
        if self.model is None or self.scaler is None:
            raise ValueError("No hay modelo entrenado para guardar.")

        path = path or self.model_path
        os.makedirs(os.path.dirname(path), exist_ok=True)

        joblib.dump({"model": self.model, "scaler": self.scaler}, path)
        print(f"✓ Modelo guardado en: {path}")
        return path

    def load(self, path: str) -> None:
        """
        Carga un modelo entrenado desde disco.

        Args:
            path: Ruta del archivo del modelo
        """
        if not os.path.exists(path):
            raise FileNotFoundError(f"Modelo no encontrado en: {path}")

        loaded = joblib.load(path)
        self.model = loaded["model"]
        self.scaler = loaded["scaler"]
        print(f"✓ Modelo cargado desde: {path}")


def train_and_save_model(n_samples: int = 1000) -> DefaultRiskModel:
    """
    Entrena un nuevo modelo con datos sintéticos y lo guarda.

    Args:
        n_samples: Cantidad de muestras sintéticas a generar

    Returns:
        Instancia de DefaultRiskModel entrenada
    """
    print("📊 Generando datos sintéticos...")
    X, y = generate_synthetic_data(n_samples=n_samples)

    print(f"✓ Dataset generado: {X.shape[0]} muestras, {X.shape[1]} features")
    print(f"  Distribución: {np.bincount(y)[0]} sin mora, {np.bincount(y)[1]} en mora")

    print("\n🔄 Dividiendo datos en train/test (80/20)...")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    print(f"✓ Train: {X_train.shape[0]}, Test: {X_test.shape[0]}")

    print("\n🤖 Entrenando modelo Random Forest...")
    model = DefaultRiskModel()
    train_info = model.train(X_train, y_train)
    print(f"✓ Modelo entrenado:")
    print(f"  - Estimadores: {train_info['n_estimators']}")
    print(f"  - Profundidad máxima: {train_info['max_depth']}")
    print(f"  - Importancia de features:")
    for feature, importance in train_info["feature_importances"].items():
        print(f"    • {feature}: {importance:.4f}")

    print("\n📈 Evaluando modelo en conjunto de prueba...")
    eval_info = model.evaluate(X_test, y_test)
    print(f"✓ Accuracy: {eval_info['accuracy']:.4f}")
    print(f"✓ Probabilidad promedio de mora (casos positivos): {eval_info['default_probability']:.4f}")

    print("\n💾 Guardando modelo...")
    model.save()

    return model


if __name__ == "__main__":
    # Entrenar y guardar el modelo
    model = train_and_save_model(n_samples=1000)

    # Ejemplo de predicción
    print("\n" + "=" * 60)
    print("EJEMPLO DE PREDICCIÓN")
    print("=" * 60)

    # Caso 1: Modalidad corta, tasa alta, mal historial -> Riesgo Alto
    test_case_1 = np.array([[10, 0.25, 0.2]])
    prob_1 = model.predict_default_probability(test_case_1)[0]
    print(f"\nCaso 1 - Modalidad 10 días, Tasa 25%, Historial 0.2:")
    print(f"  Probabilidad de mora: {prob_1:.4f} -> {'RIESGO ALTO' if prob_1 > 0.7 else 'RIESGO MEDIO' if prob_1 > 0.4 else 'RIESGO BAJO'}")

    # Caso 2: Modalidad larga, tasa baja, buen historial -> Riesgo Bajo
    test_case_2 = np.array([[31, 0.15, 0.9]])
    prob_2 = model.predict_default_probability(test_case_2)[0]
    print(f"\nCaso 2 - Modalidad 31 días, Tasa 15%, Historial 0.9:")
    print(f"  Probabilidad de mora: {prob_2:.4f} -> {'RIESGO ALTO' if prob_2 > 0.7 else 'RIESGO MEDIO' if prob_2 > 0.4 else 'RIESGO BAJO'}")

    # Caso 3: Modalidad media, tasa media, historial medio -> Riesgo Medio
    test_case_3 = np.array([[25, 0.20, 0.5]])
    prob_3 = model.predict_default_probability(test_case_3)[0]
    print(f"\nCaso 3 - Modalidad 25 días, Tasa 20%, Historial 0.5:")
    print(f"  Probabilidad de mora: {prob_3:.4f} -> {'RIESGO ALTO' if prob_3 > 0.7 else 'RIESGO MEDIO' if prob_3 > 0.4 else 'RIESGO BAJO'}")
