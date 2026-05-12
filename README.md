# DLHB Core - Documentación Completa

Sistema completo de gestión financiera para préstamos de capital con inteligencia artificial integrada.

## 📁 Estructura del Proyecto

```
DLHB-CORE/
├── app/                        # Código de la API FastAPI
│   ├── ml/                     #  Módulo de Inteligencia Financiera
│   │   ├── data_generator.py   # Generador de datos sintéticos
│   │   ├── model.py            # Entrenamiento del modelo Random Forest
│   │   ├── predictor.py        # Predictor de riesgo
│   │   ├── models/             # Modelos entrenados guardados
│   │   └── README.md           # Documentación ML
│   ├── models.py               # Modelos ORM (SQLAlchemy)
│   ├── schemas.py              # Schemas Pydantic para validación
│   ├── database.py             # Configuración de base de datos
│   └── main.py                 # API REST con FastAPI
├── frontend/                   # React + TailwindCSS + React Router
│   ├── src/
│   │   ├── components/         # Componentes reutilizables
│   │   │   ├── Layout.jsx      # Layout principal con Sidebar
│   │   │   ├── Card.jsx        # Tarjetas de métricas
│   │   │   └── LoansTable.jsx  # Tabla de préstamos
│   │   ├── pages/              # Páginas enrutadas
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── ClientesPage.jsx
│   │   │   ├── PrestamosPage.jsx
│   │   │   └── PagosPage.jsx
│   │   ├── data/               # Datos mock
│   │   ├── utils/              # Funciones auxiliares
│   │   ├── App.jsx             # Configuración de rutas
│   │   └── main.jsx
│   ├── package.json
│   └── tailwind.config.js
├── requirements.txt            # Dependencias Python
├── train_default_risk_model.py # Script para entrenar el modelo
└── demo_risk_prediction.py     # Script de demostración
```

##  Inicio Rápido

### Backend (API FastAPI)

```bash
# Instalar dependencias
pip install -r requirements.txt

# Entrenar el modelo de ML (una sola vez)
python train_default_risk_model.py

# Iniciar el servidor
uvicorn app.main:app --reload
```

La API estará disponible en: `http://localhost:8000`
Documentación Swagger: `http://localhost:8000/docs`

### Frontend (React + TailwindCSS + React Router)

```bash
cd frontend

# Instalar dependencias (incluye react-router-dom v6)
npm install

# Iniciar servidor de desarrollo
npm run dev
```

La aplicación estará disponible en: `http://localhost:3000`

**Notas:**
- El frontend ahora usa React Router v6 para enrutamiento
- La ruta `/` redirige automáticamente a `/dashboard`
- Incluye Sidebar colapsable para navegación entre módulos

## 📋 Endpoints API

### Clientes

- `POST /clients/` - Crear cliente
- `GET /clients/{client_id}` - Obtener cliente

### Préstamos

- `POST /loans/` - Crear préstamo
- `GET /loans/{loan_id}` - Obtener préstamo

### Pagos

- `POST /payments/` - Crear pago (simple)
- `GET /payments/{payment_id}` - Obtener pago
- **`POST /pagos/registrar`** - Registrar pago con lógica transaccional

### Riesgo (🤖 IA)

- **`POST /riesgo/evaluar`** - Evaluar riesgo de mora de un préstamo propuesto

##  Rutas del Frontend

| Ruta | Descripción | Estado |
|------|-------------|--------|
| `/` | Redirige a dashboard | ✓ |
| `/dashboard` | Panel de control principal | ✅ Completo |
| `/clientes` | Gestión de clientes | 🔄 En desarrollo |
| `/prestamos` | Gestión de préstamos | 🔄 En desarrollo |
| `/pagos` | Gestión de pagos | 🔄 En desarrollo |

**Características del enrutamiento:**
- Sidebar colapsable para acceso rápido a módulos
- Header dinámico que muestra el módulo actual
- Navegación con React Router v6
- Detección automática de ruta activa
- Animaciones suaves (transiciones de 300ms)
- Responsivo en dispositivos móviles

## 🤖 Módulo de Inteligencia Financiera

### Características

- **Predicción de Mora**: Clasifica préstamos en BAJO, MEDIO, ALTO riesgo
- **Variables Predictivas**:
  - Modalidad en días (10, 15, 25, 31)
  - Tasa de interés (15%-25%)
  - Historial de pagos del cliente (0.0 a 1.0)

- **Modelo**: Random Forest entrenado con 1000 muestras sintéticas
- **Accuracy**: ~87.5% en validación

### Ejemplo de Uso

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
  "recommendation": " Préstamo con riesgo moderado. Requiere supervisión.",
  "details": {...}
}
```

### Scripts de Demostración

```bash
# Ver demostración de predicción
python demo_risk_prediction.py

# Entrenar modelo (genera nuevo default_risk_model.pkl)
python train_default_risk_model.py
```

##  Base de Datos

SQLite para desarrollo (`dlhb_core.db`)

### Tablas

**clients**
- id, name, phone

**loans**
- id, client_id, initial_capital, interest_rate, modality_days
- outstanding_balance, status (ACTIVO/INACTIVO), advisor
- delivery_date, due_date

**payments**
- id, loan_id, payment_date, amount_received
- principal_payment, interest_payment

### Relaciones

- Cliente 1 → N Préstamos
- Préstamo 1 → N Pagos

##  Frontend

### Componentes

- **Dashboard**: Página principal con resumen y tabla de préstamos
- **Card**: Tarjeta de métrica (Ganancias, Capital Recuperado, Capital en la Calle)
- **LoansTable**: Tabla interactiva con formato condicional

### Datos Mock

6 préstamos de prueba (5 activos, 1 inactivo) en `src/data/mockData.js`

### Características

- Formato condicional: filas rojas si está vencido y activo
- Moneda colombiana (COP)
- Diseño responsivo
- Paleta corporativa (azul marino + blanco)

## Lógica Transaccional del Pago

El endpoint `POST /pagos/registrar` implementa:

1. **Validaciones**:
   - Préstamo existe
   - Préstamo está ACTIVO
   - Monto ≤ saldo pendiente

2. **Cálculo de Distribución**:
   - Interés pendiente = saldo × tasa
   - Si monto ≥ interés: abono_interés = interés completo, abono_capital = diferencia
   - Si monto < interés: todo va a interés

3. **Actualización del Préstamo**:
   - outstanding_balance -= abono_capital
   - Si saldo ≤ 0: status = INACTIVO

4. **Transacciones ACID**:
   - rollback automático en errores
   - flush para validar restricciones

##  Tecnologías

### Backend
- **FastAPI** 0.113.0 - Framework REST
- **SQLAlchemy** 2.1.0 - ORM
- **Pydantic** 2.9.0 - Validación
- **scikit-learn** 1.4.2 - Machine Learning
- **joblib** 1.4.2 - Serialización de modelos

### Frontend
- **React** 18.3.1 - Librería de UI
- **React Router DOM** 6.22.0 - Enrutamiento y navegación
- **TailwindCSS** 3.4.1 - Framework CSS
- **Vite** 5.1.0 - Build tool y dev server

## 📝 Ejemplos de JSON

### Crear Cliente

```json
POST /clients/
{
  "name": "Juan García López",
  "phone": "+57-300-1234567"
}
```

### Crear Préstamo

```json
POST /loans/
{
  "client_id": 1,
  "initial_capital": 50000.00,
  "interest_rate": 0.20,
  "modality_days": 31,
  "outstanding_balance": 50000.00,
  "status": "ACTIVO",
  "advisor": "S",
  "delivery_date": "2026-05-12",
  "due_date": "2026-06-12"
}
```

### Registrar Pago Transaccional

```json
POST /pagos/registrar
{
  "loan_id": 1,
  "amount_received": 15000.00,
  "payment_date": "2026-05-15"
}
```

Respuesta (cálculo automático):
```json
{
  "id": 1,
  "loan_id": 1,
  "payment_date": "2026-05-15",
  "amount_received": 15000.00,
  "principal_payment": 10000.00,
  "interest_payment": 5000.00
}
```

## Testing

```bash
# Ver predicciones del modelo
python demo_risk_prediction.py

# En la terminal Python
python
>>> from app.ml import calculate_loan_risk
>>> result = calculate_loan_risk(modality_days=25, interest_rate=0.20, client_payment_history_score=0.75)
>>> print(result)
```

##  Documentación Adicional

- [Módulo ML](app/ml/README.md) - Guía completa de Inteligencia Financiera
- [Frontend README](frontend/README.md) - Documentación del dashboard React

##  Próximos Pasos

- [ ] Integración real de API Frontend con Backend
- [ ] Completar módulo de Clientes (crear, editar, eliminar)
- [ ] Completar módulo de Préstamos (crear, editar, eliminar)
- [ ] Completar módulo de Pagos (registrar pagos)
- [ ] Autenticación y autorización
- [ ] Panel de administrador
- [ ] Reportes y análisis avanzados
- [ ] Gráficos y dashboards interactivos
- [ ] Notificaciones de vencimiento
- [ ] Exportación a PDF/Excel
- [ ] Validación de cédula/NIT
- [ ] Reentrenamiento automático del modelo mensual
- [ ] Formularios con validación Zod
- [ ] Modal de confirmación para acciones críticas

##  Notas

- La base de datos SQLite se crea automáticamente en `dlhb_core.db`
- El modelo ML se guarda en `app/ml/models/default_risk_model.pkl`
- Todos los códigos incluyen type hints y docstrings
- El proyecto sigue PEP8 y buenas prácticas

##  Checklist de Inicialización

- [ ] `pip install -r requirements.txt`
- [ ] `python train_default_risk_model.py`
- [ ] `uvicorn app.main:app --reload` (Terminal 1)
- [ ] `cd frontend && npm install && npm run dev` (Terminal 2)
- [ ] Verificar `http://localhost:8000/docs` (API)
- [ ] Verificar `http://localhost:3000` (Frontend)
- [ ] `python demo_risk_prediction.py` (Demostración)

---


