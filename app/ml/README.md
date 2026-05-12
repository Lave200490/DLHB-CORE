# Módulo de Inteligencia Financiera (ML)

Sistema de predicción de mora basado en Random Forest para evaluar el riesgo de defaulting (mora) en préstamos.

## Descripción General

El módulo ML utiliza un modelo de clasificación entrenado con **Random Forest** para predecir la probabilidad de que un préstamo propuesto entre en mora. Los predictores se basan en características del préstamo y el historial del cliente.

## Variables Predictivas

1. **Modalidad en Días** (`modality_days`): 10, 15, 25 o 31 días
   - Modalidades cortas (≤15 días) tienen mayor riesgo
   - Modalidades largas (25-31 días) tienen menor riesgo

2. **Tasa de Interés** (`interest_rate`): 0.15 a 0.25 (15% a 25%)
   - Tasas altas (≥0.22) están correlacionadas con mayor riesgo
   - Tasas bajas (≤0.15) están correlacionadas con menor riesgo

3. **Historial de Pagos a Tiempo** (`client_payment_history_score`): 0.0 a 1.0
   - 1.0 = Cliente siempre ha pagado a tiempo
   - 0.0 = Cliente nunca ha pagado a tiempo
   - Clientes con excelente historial tienen menor riesgo

## Niveles de Riesgo

| Nivel | Rango | Acción |
|-------|-------|--------|
| **BAJO** | 0% - 33% | ✓ Préstamo aprobado sin restricciones |
| **MEDIO** | 34% - 66% | ⚠️ Aprobado con supervisión o garantías |
| **ALTO** | 67% - 100% | ✗ Rechazo o garantías significativas |

## Archivos del Módulo

```
app/ml/
├── __init__.py              # Exporta funciones principales
├── data_generator.py        # Generador de datos sintéticos
├── model.py                 # Clase DefaultRiskModel y entrenamiento
├── predictor.py             # Calculador de scores de riesgo
├── models/                  # Directorio para modelos guardados
│   └── default_risk_model.pkl  # Modelo entrenado (generado al ejecutar train)
└── README.md                # Este archivo
```

## Uso

### 1. Entrenamiento Inicial

Ejecutar UNA SOLA VEZ al inicio del proyecto:

```bash
python train_default_risk_model.py
```

Esto:
- Genera 1000 muestras sintéticas con correlaciones realistas
- Entrena un Random Forest con 100 estimadores
- Evalúa el modelo en un conjunto de prueba (20%)
- Guarda el modelo y el scaler en `app/ml/models/default_risk_model.pkl`

**Output esperado:**
```
📊 Generando datos sintéticos...
✓ Dataset generado: 1000 muestras, 3 features
  Distribución: 600 sin mora, 400 en mora

🔄 Dividiendo datos en train/test (80/20)...
✓ Train: 800, Test: 200

🤖 Entrenando modelo Random Forest...
✓ Modelo entrenado:
  - Estimadores: 100
  - Profundidad máxima: 10
  - Importancia de features:
    • modality_days: 0.3245
    • interest_rate: 0.4123
    • payment_history_score: 0.2632

📈 Evaluando modelo en conjunto de prueba...
✓ Accuracy: 0.8750
✓ Probabilidad promedio de mora (casos positivos): 0.7234

💾 Guardando modelo...
✓ Modelo guardado en: app/ml/models/default_risk_model.pkl
```

### 2. Demostración

Para ver ejemplos de predicción:

```bash
python demo_risk_prediction.py
```

Prueba 6 casos de uso con diferentes combinaciones de parámetros.

### 3. Uso en la API

Una vez entrenado, utiliza el endpoint REST:

```bash
curl -X POST "http://localhost:8000/riesgo/evaluar" \
  -H "Content-Type: application/json" \
  -d '{
    "modality_days": 25,
    "interest_rate": 0.20,
    "client_payment_history_score": 0.75
  }'
```

**Response:**
```json
{
  "probability": 0.3847,
  "risk_level": "MEDIO",
  "risk_score": 38,
  "recommendation": "⚠️ Préstamo con riesgo moderado. Requiere supervisión.",
  "details": {
    "modality_days": 25,
    "interest_rate": 0.2,
    "client_payment_history_score": 0.75
  }
}
```

### 4. Uso Programático

```python
from app.ml import calculate_loan_risk

# Evaluar un préstamo propuesto
result = calculate_loan_risk(
    modality_days=25,
    interest_rate=0.20,
    client_payment_history_score=0.75
)

print(f"Riesgo: {result['risk_level']}")
print(f"Score: {result['risk_score']}/100")
print(f"Recomendación: {result['recommendation']}")
```

O usar el calculador batch:

```python
from app.ml import RiskScoreCalculator

calculator = RiskScoreCalculator()

proposals = [
    {"modality_days": 10, "interest_rate": 0.25, "client_payment_history_score": 0.2},
    {"modality_days": 31, "interest_rate": 0.15, "client_payment_history_score": 0.9},
    {"modality_days": 25, "interest_rate": 0.20, "client_payment_history_score": 0.5},
]

results = calculator.batch_calculate_risk_scores(proposals)
for i, result in enumerate(results, 1):
    print(f"Préstamo {i}: {result['risk_level']} ({result['risk_score']}/100)")
```

## Estructura de Datos Sintéticos

El generador crea datos correlacionados realistas:

### Lógica de Mora (Simplificada)

```
risk_score = 0

# Factor 1: Modalidad (40%)
if modality_days <= 15:
    risk_score += 0.4
elif modality_days == 25:
    risk_score += 0.2
else:
    risk_score += 0.1

# Factor 2: Tasa de Interés (30%)
if interest_rate >= 0.22:
    risk_score += 0.3
elif interest_rate >= 0.20:
    risk_score += 0.2
else:
    risk_score += 0.1

# Factor 3: Historial de Pagos (40%)
risk_score += (1.0 - client_payment_history_score) * 0.4

# Ruido: ±5%
risk_score += random_noise

# Umbral
is_in_default = 1 if risk_score > 0.5 else 0
```

## Integración con Base de Datos

Para entrenar con datos reales en el futuro:

```python
from app.database import SessionLocal
from app import models
import numpy as np

db = SessionLocal()

# Obtener préstamos con información de pagos
loans = db.query(models.Loan).all()

X = []
y = []

for loan in loans:
    # Calcular si hubo mora
    is_in_default = loan.status == "INACTIVO" or loan.outstanding_balance > 0
    
    # Obtener score de historial
    on_time_payments = sum(
        1 for payment in loan.payments 
        if payment.payment_date <= loan.due_date
    )
    payment_history = on_time_payments / len(loan.payments) if loan.payments else 0.5
    
    X.append([
        loan.modality_days,
        loan.interest_rate,
        payment_history
    ])
    y.append(is_in_default)

# Entrenar con datos reales
from app.ml import DefaultRiskModel
model = DefaultRiskModel()
model.train(np.array(X), np.array(y))
model.save()
```

## Consideraciones de Producción

1. **Reentrenamiento Periódico**: Entrenar nuevamente cada mes con datos reales
2. **Validación Continua**: Monitorear accuracy del modelo vs resultados reales
3. **Feature Scaling**: El modelo utiliza StandardScaler internamente
4. **Desbalance de Clases**: Si el dataset es muy desbalanceado, usar `class_weight='balanced'`
5. **Threshold Ajustable**: El umbral 0.5 puede ajustarse según política de riesgo

## Parámetros del Modelo

```python
RandomForestClassifier(
    n_estimators=100,        # Número de árboles
    max_depth=10,            # Profundidad máxima
    min_samples_split=5,     # Muestras mínimas para dividir
    min_samples_leaf=2,      # Muestras mínimas en hoja
    random_state=42,         # Reproducibilidad
    n_jobs=-1                # Usar todos los cores
)
```

Ajustar estos parámetros si necesitas:
- Mejor accuracy: aumentar `n_estimators`, reducir `max_depth`
- Prevenir overfitting: aumentar `min_samples_split`, `min_samples_leaf`
- Interpretabilidad: reducir `n_estimators`, `max_depth`

## Troubleshooting

### Error: "Modelo no encontrado"
```bash
python train_default_risk_model.py
```

### Error: "Modalidad inválida"
Asegúrate que `modality_days` sea uno de: 10, 15, 25, 31

### Error: "Tasa de interés inválida"
Asegúrate que `interest_rate` esté entre 0.0 y 1.0 (no 0-100)

### Accuracy muy baja
- Aumentar tamaño del dataset (n_samples)
- Ajustar parámetros del RandomForest
- Entrenar con datos reales en lugar de sintéticos

## Próximos Pasos

- [ ] Implementar validación cruzada (cross-validation)
- [ ] Agregar más features (edad del cliente, sector económico, etc.)
- [ ] Implementar explicabilidad (SHAP values)
- [ ] Dashboard con análisis del modelo
- [ ] API de reentrenamiento automático
- [ ] Monitoreo de drift del modelo
