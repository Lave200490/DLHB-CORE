# Implementation Plan: Motor Financiero DLHB-CORE

## Visión general

Implementar el Motor Financiero como capa de servicios que centraliza la lógica de créditos en DLHB-CORE. La migración es no destructiva: los endpoints legacy (`/loans/`, `/payments/`, `/pagos/registrar`) se mantienen durante la transición y los nuevos endpoints se sirven bajo `/creditos/`. El módulo `app/ml/` no se toca en ninguna tarea.

---

## Tareas

### FASE 1 — Base de datos

- [x] 1. Crear script de migración de base de datos
  - [x] 1.1 Crear `migrate_db.py` en la raíz del proyecto
    - Conectar a `dlhb_core.db` mediante SQLite3 (sin ORM, para independencia de estado del modelo)
    - Renombrar todos los valores `INACTIVO` → `CANCELADO` en la columna `status` de la tabla `loans`
    - Añadir columnas nuevas en `loans`: `interest_period_unit TEXT NOT NULL DEFAULT 'por_periodo'`, `modality_days INTEGER NOT NULL DEFAULT 30`
    - Añadir columnas nuevas en `payments`: `monto_a_mora REAL NOT NULL DEFAULT 0.0`, `monto_a_interes REAL NOT NULL DEFAULT 0.0`, `monto_a_capital REAL NOT NULL DEFAULT 0.0`, `capital_previo REAL`, `capital_posterior REAL`, `mora_previa REAL`, `mora_posterior REAL`, `observacion TEXT`, `asesor TEXT NOT NULL DEFAULT ''`
    - Hacer las columnas de snapshot (`capital_previo`, `capital_posterior`, etc.) nullable solo en la migración para filas históricas; nuevas filas deben ser NOT NULL (se gestiona en la capa ORM/Pydantic)
    - Poblar `monto_a_capital` con el valor de `principal_payment` y `monto_a_interes` con `interest_payment` para filas existentes
    - Crear las tablas nuevas `interest_records` y `mora_records` si no existen
    - Incluir verificación al inicio: si las columnas ya existen, omitir el paso con mensaje informativo (idempotente)
    - Imprimir resumen de cambios aplicados al finalizar
    - _Requisitos: Backward compatibility (design.md — Estrategia de migración de columnas), Req. 8.4_
  - [x] 1.2 Verificar idempotencia del script
    - Ejecutar `migrate_db.py` dos veces seguidas y confirmar que la segunda ejecución no produce errores ni altera datos
    - _Requisitos: Principio de migración no destructiva_

- [ ] 2. Actualizar `app/models.py` con nuevos modelos y enums
  - [x] 2.1 Añadir enum `InterestPeriodUnit` y actualizar `LoanStatus`
    - Añadir `InterestPeriodUnit(str, PyEnum)` con valores `MENSUAL`, `ANUAL`, `POR_PERIODO`
    - Renombrar `LoanStatus.INACTIVO` → `LoanStatus.CANCELADO` (mantener compatibilidad con datos ya migrados)
    - _Requisitos: design.md — Enum InterestPeriodUnit, Enum LoanStatus_
  - [-] 2.2 Modificar el modelo `Loan`
    - Añadir columnas: `interest_period_unit` (Enum `InterestPeriodUnit`, default `POR_PERIODO`), `modality_days` (Integer)
    - Añadir relaciones: `interest_records` (→ `InterestRecord`), `mora_records` (→ `MoraRecord`)
    - Conservar todos los campos existentes sin eliminarlos
    - _Requisitos: design.md — Modelo Loan modificado_
  - [-] 2.3 Crear modelo `InterestRecord`
    - Tabla `interest_records` con todos los campos del diseño: `id`, `loan_id`, `monto_interes`, `capital_base`, `tasa_aplicada`, `interest_period_unit`, `fecha_generacion`, `asesor`, `observacion`, `created_at`
    - FK a `loans` con `ondelete="CASCADE"`
    - _Requisitos: design.md — Modelo InterestRecord, Req. 12.4_
  - [-] 2.4 Crear modelo `MoraRecord`
    - Tabla `mora_records` con todos los campos del diseño: `id`, `loan_id`, `monto`, `fecha_evento`, `motivo`, `observacion`, `asesor`, `created_at`
    - FK a `loans` con `ondelete="CASCADE"`
    - _Requisitos: design.md — Modelo MoraRecord, Req. 4.5_
  - [-] 2.5 Modificar el modelo `Payment`
    - Añadir columnas: `monto_a_mora`, `monto_a_interes`, `monto_a_capital`, `capital_previo`, `capital_posterior`, `mora_previa`, `mora_posterior`, `observacion`, `asesor`
    - Mantener columnas legacy `principal_payment` e `interest_payment` sin eliminarlas (lectura de datos históricos)
    - _Requisitos: design.md — Modelo Payment modificado, Req. 8.6_

---

### FASE 2 — Servicios financieros (core)

- [ ] 3. Crear módulo `app/services/`
  - [~] 3.1 Crear `app/services/__init__.py` vacío
    - Crear el directorio `app/services/` y el archivo `__init__.py`
    - _Requisitos: design.md — Architecture_

- [ ] 4. Implementar `InterestCalculator` en `app/services/financial_engine.py`
  - [~] 4.1 Crear `app/services/financial_engine.py` e implementar dataclasses de soporte
    - Definir `LoanState` y `PaymentResult` como `@dataclass`
    - Importar modelos SQLAlchemy, tipos y Session
    - _Requisitos: design.md — Tipos de datos de soporte_
  - [~] 4.2 Implementar `InterestCalculator.convert_rate_to_period`
    - Reglas de conversión: `POR_PERIODO` → devuelve `rate` directo; `MENSUAL` → `rate × (days/30)`; `ANUAL` → `rate × (days/365)`
    - Lanzar `ValueError` si `rate <= 0` o `periodicidad_dias <= 0`
    - _Requisitos: design.md — Property 1, Req. 2.1, 2.7_
  - [~] 4.3 Implementar `InterestCalculator.calculate_interest`
    - Resultado = `capital_pendiente × convert_rate_to_period(rate, unit, periodicidad_dias)`
    - Resultado siempre `>= 0`
    - _Requisitos: design.md — Property 1, Req. 2.1_
  - [~] 4.4 Implementar `InterestCalculator.calculate_interes_pendiente`
    - Consultar suma de `InterestRecord.monto_interes` y suma de `Payment.monto_a_interes` para el `loan_id`
    - Fórmula: `Σ(InterestRecord.monto_interes) − Σ(Payment.monto_a_interes)`
    - Lanzar `ValueError` si el resultado sería negativo (indica corrupción de datos)
    - _Requisitos: design.md — Property 4, Req. 12.4_
  - [ ]* 4.5 Escribir tests unitarios para `InterestCalculator`
    - Verificar conversión de tasa para los tres modos (`POR_PERIODO`, `MENSUAL`, `ANUAL`)
    - Verificar `calculate_interest(1_000_000, 0.20, POR_PERIODO, 30) == 200_000`
    - Verificar que `calculate_interes_pendiente` retorna 450_000 con 3 registros de 200_000 c/u y 2 pagos con `monto_a_interes` sumando 150_000
    - _Requisitos: design.md — Property 1, Property 4_

- [ ] 5. Implementar `MoraService` en `app/services/financial_engine.py`
  - [~] 5.1 Implementar `MoraService.calculate_mora_vigente`
    - Fórmula: `Σ(MoraRecord.monto) − Σ(Payment.monto_a_mora)` para el `loan_id`
    - Resultado siempre `>= 0`
    - _Requisitos: design.md — Property 5, Req. 4.5, 8.5_
  - [~] 5.2 Implementar `MoraService.register_mora`
    - Validaciones: Loan existe y está ACTIVO; `monto > 0`; `fecha >= loan.delivery_date`
    - Persistir nuevo `MoraRecord` (append-only, sin update/delete)
    - Lanzar `ValueError` descriptivo en cada validación fallida
    - _Requisitos: design.md — Principio append-only D9, Req. 4_
  - [~] 5.3 Implementar `MoraService.get_mora_records_fifo`
    - Retornar `MoraRecord` del loan ordenados por `fecha_evento ASC`
    - _Requisitos: design.md — Property 12, Req. 5.6_
  - [ ]* 5.4 Escribir tests unitarios para `MoraService`
    - Verificar `calculate_mora_vigente` con registros y pagos de mora variados
    - Verificar que `register_mora` rechaza crédito CANCELADO con `ValueError`
    - Verificar que `register_mora` rechaza `monto <= 0`
    - Verificar orden FIFO de `get_mora_records_fifo`
    - _Requisitos: design.md — Property 5, Property 12_

- [ ] 6. Implementar `PaymentEngine` en `app/services/financial_engine.py`
  - [~] 6.1 Implementar `PaymentEngine.apply_payment` — distribución sin mora
    - Política: `mora = 0` → Interés primero → Capital
    - `monto_a_mora = 0`, `monto_a_interes = min(amount, interes_pend)`, `monto_a_capital = max(0, amount - interes_pend)`
    - _Requisitos: design.md — Property 6, Req. 3.1, 3.2, 3.3, 3.4_
  - [~] 6.2 Implementar `PaymentEngine.apply_payment` — distribución con mora y hot-transition
    - Política: `mora > 0` → Mora primero (FIFO), sobrante sigue política Interés → Capital en el mismo pago
    - `monto_a_mora = min(amount, mora_vig)`, sobrante distribuido bajo política sin mora
    - _Requisitos: design.md — Property 7, Property 8, Req. 5.1–5.5_
  - [~] 6.3 Implementar validaciones y condición de cancelación en `apply_payment`
    - Validar: Loan ACTIVO, `amount > 0`, `amount <= capital + interes_pend + mora_vig`
    - Snapshot: `capital_previo`, `capital_posterior`, `mora_previa`, `mora_posterior`
    - Cancelación estricta: `loan.status = CANCELADO` si `capital_posterior == 0 AND interes_nuevo == 0 AND mora_posterior == 0`
    - Todo en una única transacción ACID con rollback explícito ante excepciones
    - _Requisitos: design.md — Property 2, Property 10, Property 11, Req. 6.2, 6.3, 6.9, 7.1_
  - [ ]* 6.4 Escribir tests unitarios para `PaymentEngine`
    - `test_payment_priority_no_mora`: mora=0, capital=1_000_000, interes=200_000; verificar tres sub-casos del diseño
    - `test_payment_priority_with_mora`: mora=50_000, capital=1_000_000, interes=200_000; verificar que pago parcial no toca capital/interés
    - `test_hot_transition`: mora=50_000, interes=200_000, capital=1_000_000; pago=400_000 → mora=0, interes=0, capital=850_000
    - `test_fifo_mora_application`: dos MoraRecords con fechas distintas; verificar agotamiento FIFO
    - `test_cancellation_strict`: verificar transición ACTIVO→CANCELADO y rechazo de pago posterior
    - _Requisitos: design.md — Property 2, 6, 7, 8, 11, 12_

- [ ] 7. Implementar `LoanStateService` en `app/services/financial_engine.py`
  - [~] 7.1 Implementar `LoanStateService.get_loan_state`
    - Calcular en tiempo real: `interes_pendiente`, `mora_vigente`, `interes_periodo_siguiente`
    - Construir y retornar `LoanState` completo
    - Lanzar `ValueError` si `loan_id` no existe
    - _Requisitos: design.md — Principio D1+D10 (estado derivado), Req. 12_

- [~] 8. Checkpoint — verificar servicios financieros
  - Ejecutar todos los tests del módulo `app/services/` con `pytest tests/ -v`
  - Asegurarse de que `migrate_db.py` se puede ejecutar sin errores sobre la BD existente
  - Pedir confirmación al usuario antes de continuar si algún test falla

---

### FASE 3 — Schemas

- [ ] 9. Actualizar `app/schemas.py` con schemas del motor financiero
  - [~] 9.1 Añadir enums Pydantic: `InterestPeriodUnitSchema`, `LoanStatusSchema`
    - _Requisitos: design.md — Schemas compartidos_
  - [~] 9.2 Añadir schemas de crédito: `LoanCreate`, `LoanStateRead`
    - `LoanCreate`: validaciones `gt=0` en `interest_rate`, `initial_capital`, `modality_days`
    - `LoanStateRead`: incluir campos calculados `interes_pendiente`, `mora_vigente`, `interes_periodo_siguiente`
    - _Requisitos: design.md — Schemas de Crédito, Req. 1, 2_
  - [~] 9.3 Añadir schemas de interés: `InterestRecordCreate`, `InterestRecordRead`
    - _Requisitos: design.md — Schemas de InterestRecord, Req. 2_
  - [~] 9.4 Añadir schemas de mora: `MoraRecordCreate`, `MoraRecordRead`
    - _Requisitos: design.md — Schemas de MoraRecord, Req. 4_
  - [~] 9.5 Añadir schemas de pago: `PaymentCreate`, `PaymentRead`, `PaymentResultRead`
    - `PaymentResultRead` incluye `nuevo_estado: LoanStatusSchema`
    - _Requisitos: design.md — Schemas de Payment, Req. 3, 5, 6_
  - [~] 9.6 Añadir schema `HistorialEntry`
    - Union discriminada: `tipo: Literal["pago", "mora", "interes"]` + `fecha` + `data`
    - _Requisitos: design.md — Schema de historial unificado_

---

### FASE 4 — API Routers

- [ ] 10. Crear módulo `app/routers/`
  - [~] 10.1 Crear `app/routers/__init__.py` vacío
    - _Requisitos: design.md — Architecture_

- [ ] 11. Implementar `app/routers/creditos.py`
  - [~] 11.1 Implementar `GET /creditos/` — listar todos los créditos con estado calculado
    - Iterar sobre todos los Loans, llamar `LoanStateService.get_loan_state` para cada uno
    - Retornar `list[LoanStateRead]`
    - _Requisitos: design.md — Router /creditos, Req. 1_
  - [~] 11.2 Implementar `POST /creditos/` — crear crédito nuevo
    - Validar que `client_id` existe (404 si no)
    - Crear Loan, persistir, retornar `LoanStateRead` con HTTP 201
    - _Requisitos: Req. 1.1–1.8_
  - [~] 11.3 Implementar `GET /creditos/{id}` — detalle con estado financiero completo
    - Llamar `LoanStateService.get_loan_state(id, db)`, retornar `LoanStateRead`
    - 404 si no existe
    - _Requisitos: Req. 12_
  - [~] 11.4 Implementar `GET /creditos/{id}/historial` — historial cronológico unificado
    - Consultar `InterestRecord`, `MoraRecord` y `Payment` del crédito
    - Combinar, ordenar por fecha ASC, retornar `list[HistorialEntry]`
    - _Requisitos: design.md — Router /creditos historial, Req. 8_

- [ ] 12. Implementar `app/routers/intereses.py`
  - [~] 12.1 Implementar `POST /creditos/{id}/intereses`
    - Llamar `InterestCalculator.calculate_interest` para verificar que `monto_interes` coincide con el cálculo (tolerancia float)
    - Si no coincide, retornar HTTP 400 con mensaje estructurado del diseño
    - Persistir `InterestRecord` (append-only)
    - Retornar `InterestRecordRead` con HTTP 201
    - _Requisitos: design.md — Router intereses, Req. 2.1–2.7_

- [ ] 13. Implementar `app/routers/moras.py`
  - [~] 13.1 Implementar `POST /creditos/{id}/moras`
    - Llamar `MoraService.register_mora`; manejar `ValueError` → HTTP 400
    - Retornar `MoraRecordRead` con HTTP 201
    - _Requisitos: design.md — Router moras, Req. 4_
  - [~] 13.2 Implementar `GET /creditos/{id}/moras`
    - Retornar lista de `MoraRecord` del crédito con `list[MoraRecordRead]`
    - _Requisitos: design.md — Router moras GET, Req. 4_

- [ ] 14. Implementar `app/routers/pagos_credito.py`
  - [~] 14.1 Implementar `POST /creditos/{id}/pagos`
    - Llamar `PaymentEngine.apply_payment`; manejar `ValueError` → HTTP 400, `SQLAlchemyError` → HTTP 500 con rollback
    - Retornar `PaymentResultRead` con HTTP 201
    - _Requisitos: design.md — Router pagos, Req. 3, 5, 6, 7_
  - [~] 14.2 Implementar `GET /creditos/{id}/pagos`
    - Retornar `list[PaymentRead]` del crédito
    - _Requisitos: design.md — Router pagos GET, Req. 8_

- [ ] 15. Registrar los nuevos routers en `app/main.py`
  - [~] 15.1 Importar y registrar routers con `app.include_router`
    - Prefijos: `/creditos` para cada router
    - Mantener intactos todos los endpoints legacy (`/loans/`, `/payments/`, `/pagos/registrar`, `/riesgo/evaluar`)
    - _Requisitos: design.md — Architecture, restricción de compatibilidad hacia atrás_

- [~] 16. Checkpoint — verificar API
  - Iniciar el servidor y confirmar que `GET /creditos/` responde 200
  - Confirmar que `GET /loans/` (legacy) sigue respondiendo correctamente
  - Pedir confirmación al usuario antes de continuar

---

### FASE 5 — Tests

- [ ] 17. Crear estructura base de tests
  - [~] 17.1 Crear `tests/__init__.py` vacío
    - _Requisitos: design.md — Testing Strategy_
  - [~] 17.2 Crear `tests/conftest.py` con fixtures
    - Fixture `db`: sesión SQLite en memoria (`:memory:`), crea todas las tablas del ORM al inicio
    - Fixture `client_factory`: función de fábrica que crea un `Client` con valores por defecto
    - Fixture `loan_factory`: función de fábrica que crea un `Loan` ACTIVO con `initial_capital`, `interest_rate`, `interest_period_unit`, `modality_days` configurables
    - Fixture `test_client`: `TestClient` de FastAPI con BD en memoria como override de `get_db`
    - _Requisitos: design.md — Testing Strategy_

- [ ] 18. Implementar `tests/test_interest_calculator.py`
  - [~] 18.1 Escribir `test_convert_rate_to_period`
    - `POR_PERIODO, rate=0.20, days=cualquiera` → devuelve `0.20`
    - `MENSUAL, rate=0.20, days=30` → devuelve `0.20`
    - `MENSUAL, rate=0.20, days=15` → devuelve `0.10`
    - `ANUAL, rate=0.24, days=30` → devuelve `approx(0.02)`
    - _Requisitos: design.md — Property 1, Req. 2.1, 2.7_
  - [~] 18.2 Escribir `test_interest_by_full_period`
    - `calculate_interest(1_000_000, 0.20, POR_PERIODO, 30) == 200_000`
    - Verificar que `POR_PERIODO` no varía con `periodicidad_dias`
    - _Requisitos: design.md — Property 1, Req. 2.1_
  - [~] 18.3 Escribir `test_calculate_interes_pendiente`
    - Crear 3 `InterestRecord` con `monto_interes` sumando 600_000
    - Crear 2 `Payment` con `monto_a_interes` sumando 150_000
    - Verificar que `calculate_interes_pendiente()` retorna exactamente 450_000
    - _Requisitos: design.md — Property 4, Req. 12.4_

- [ ] 19. Implementar `tests/test_mora_service.py`
  - [~] 19.1 Escribir `test_calculate_mora_vigente`
    - Crear `MoraRecord` y `Payment.monto_a_mora`, verificar fórmula `Σ(mora) − Σ(pagos_mora)`
    - _Requisitos: design.md — Property 5, Req. 4.5_
  - [~] 19.2 Escribir `test_register_mora_validations`
    - Crédito CANCELADO → `ValueError`
    - `monto <= 0` → `ValueError`
    - `fecha < delivery_date` → `ValueError`
    - _Requisitos: Req. 4, design.md — Error handling_
  - [~] 19.3 Escribir `test_get_mora_records_fifo`
    - Insertar moras con fechas en orden aleatorio; verificar que se retornan por `fecha_evento ASC`
    - _Requisitos: design.md — Property 12, Req. 5.6_

- [ ] 20. Implementar `tests/test_payment_engine.py`
  - [~] 20.1 Escribir `test_payment_priority_no_mora`
    - `mora=0, capital=1_000_000, interes=200_000`
    - Sub-caso pago=500_000: `monto_a_interes=200_000`, `monto_a_capital=300_000`, capital_posterior=700_000
    - Sub-caso pago=200_000: `monto_a_interes=200_000`, `monto_a_capital=0`
    - Sub-caso pago=80_000: `monto_a_interes=80_000`, `monto_a_capital=0`, interes_pendiente_posterior=120_000
    - _Requisitos: design.md — Property 6, Req. 3.1–3.4_
  - [~] 20.2 Escribir `test_payment_priority_with_mora`
    - `mora=50_000, capital=1_000_000, interes=200_000`
    - Pago=30_000: `monto_a_mora=30_000`, capital y interés sin cambio
    - Pago=50_000: `monto_a_mora=50_000`, mora_posterior=0, capital sin cambio
    - _Requisitos: design.md — Property 7, Req. 5.1, 5.2, 5.4_
  - [~] 20.3 Escribir `test_hot_transition`
    - `mora=50_000, interes=200_000, capital=1_000_000`, pago=400_000
    - Resultado esperado: `monto_a_mora=50_000`, `monto_a_interes=200_000`, `monto_a_capital=150_000`
    - _Requisitos: design.md — Property 8, Req. 5.3, 5.5_
  - [~] 20.4 Escribir `test_cancellation_strict`
    - Pagos que llevan capital=0 e interes_pendiente>0 → estado ACTIVO
    - Pago final que deja los tres en cero → estado CANCELADO
    - Pago posterior sobre crédito CANCELADO → `ValueError`
    - _Requisitos: design.md — Property 11, Req. 6.3, 6.9_
  - [~] 20.5 Escribir `test_payment_snapshot_consistency`
    - Para cualquier pago válido: `capital_posterior == capital_previo − monto_a_capital`; `mora_posterior == mora_previa − monto_a_mora`
    - Verificar `capital_posterior >= 0` y `mora_posterior >= 0`
    - _Requisitos: design.md — Property 10, Req. 8.6_

- [ ] 21. Implementar `tests/test_financial_engine.py` (property-based con Hypothesis)
  - [~] 21.1 Escribir property test para Property 2 — Conservación del pago
    - `@given` con `mora_vigente`, `interes_pend`, `capital`, `amount` como floats en rangos válidos
    - Forzar `amount <= total_owed`, ejecutar algoritmo de distribución, verificar `monto_mora + monto_interes + monto_capital == amount` (tolerancia `1e-9`)
    - `@settings(max_examples=200)`
    - **Property 2: conservacion_del_pago** — **Validates: Req. 3, 5, 7.1**
  - [~] 21.2 Escribir property test para Property 3 — Reconstructibilidad del capital pendiente
    - `@given` con `initial_capital` y lista de `pagos_capital`
    - Verificar `initial_capital − Σ(monto_a_capital_acumulados_válidos) >= 0`
    - `@settings(max_examples=100)`
    - **Property 3: reconstructibilidad_capital_pendiente** — **Validates: Req. 7, 8.4**
  - [~] 21.3 Escribir property test para Property 4 — Reconstructibilidad del interés pendiente
    - `@given` con lista de montos de `InterestRecord` y lista de montos de pagos de interés
    - Verificar `Σ(registros) − min(Σ(pagos), Σ(registros)) >= 0`
    - `@settings(max_examples=100)`
    - **Property 4: interes_pendiente_reconstructibilidad** — **Validates: Req. 12.4**
  - [~] 21.4 Escribir property test para Property 5 — Reconstructibilidad de la mora vigente
    - `@given` con lista de `MoraRecord.monto` y lista de `Payment.monto_a_mora`
    - Verificar `mora_vigente >= 0`
    - `@settings(max_examples=100)`
    - **Property 5: reconstructibilidad_mora_vigente** — **Validates: Req. 4.5, 8.5**

- [ ] 22. Implementar `tests/test_api_creditos.py` (integration tests)
  - [~] 22.1 Escribir `test_create_loan`
    - `POST /creditos/` con payload válido → HTTP 201, response incluye `id`, `capital_pendiente`, `interes_pendiente=0`, `mora_vigente=0`
    - _Requisitos: Req. 1.1–1.8_
  - [~] 22.2 Escribir `test_register_interest`
    - `POST /creditos/{id}/intereses` con monto coincidente con el cálculo → HTTP 201, `InterestRecordRead` retornado
    - _Requisitos: Req. 2_
  - [~] 22.3 Escribir `test_register_mora`
    - `POST /creditos/{id}/moras` → HTTP 201, `MoraRecordRead` retornado
    - _Requisitos: Req. 4_
  - [~] 22.4 Escribir `test_apply_payment`
    - `POST /creditos/{id}/pagos` → HTTP 201, `PaymentResultRead` con distribución correcta
    - _Requisitos: Req. 3, 5, 7_
  - [~] 22.5 Escribir `test_get_loan_state`
    - `GET /creditos/{id}` después de registrar interés y mora → valores calculados correctos
    - _Requisitos: Req. 12_
  - [~] 22.6 Escribir `test_historial_order`
    - Registrar interés, mora y pago en ese orden; `GET /creditos/{id}/historial` retorna los tres en orden cronológico ASC
    - _Requisitos: Req. 8_
  - [~] 22.7 Escribir tests de error
    - Pago sobre crédito CANCELADO → HTTP 400
    - Pago con monto mayor que total adeudado → HTTP 400
    - `GET /creditos/9999` → HTTP 404
    - Registro de mora con `fecha < delivery_date` → HTTP 400
    - _Requisitos: design.md — Error Handling_

- [~] 23. Checkpoint — verificar todos los tests
  - Ejecutar `pytest tests/ -v` y confirmar que todos los tests pasan
  - Pedir confirmación al usuario si algún test falla antes de continuar

---

### FASE 6 — Frontend

- [ ] 24. Actualizar `frontend/src/services/api.js`
  - [~] 24.1 Añadir `creditosApi`, `interesesApi`, `morasApi` al archivo existente
    - Implementar exactamente las funciones definidas en el diseño: `creditosApi.listar`, `creditosApi.crear`, `creditosApi.obtenerEstado`, `creditosApi.historial`, `creditosApi.registrarPago`
    - Implementar `interesesApi.registrar`
    - Implementar `morasApi.registrar`, `morasApi.listar`
    - No eliminar ni modificar las funciones legacy existentes (`clientesApi`, `prestamosApi`, `pagosApi`, `riesgoApi`, `exportApi`)
    - _Requisitos: design.md — Actualización a api.js_

- [ ] 25. Crear `frontend/src/components/HistorialCreditoTable.jsx`
  - [~] 25.1 Implementar componente de tabla unificada de historial
    - Props: `historial` (array de `HistorialEntry`)
    - Columnas: Fecha | Tipo (badge) | Descripción | Monto Total | A Mora | A Interés | A Capital | Asesor
    - Badge "pago" → azul, "mora" → rojo, "interes" → amarillo (usar clases Tailwind consistentes con el proyecto)
    - Ordenar por fecha ASC en el render (por si el prop llega sin orden)
    - _Requisitos: design.md — HistorialCreditoTable_

- [ ] 26. Crear `frontend/src/components/RegistrarInteresPanel.jsx`
  - [~] 26.1 Implementar slide-over siguiendo el patrón `ClientSlideOver.jsx`
    - Props: `loanId`, `creditoEstado` (para pre-rellenar campos), `isOpen`, `onClose`, `onSuccess`
    - Campos: `monto_interes`, `capital_base` (pre-rellenado con `capital_pendiente`), `tasa_aplicada` (pre-rellenado con `interest_rate`), `fecha_generacion`, `asesor`, `observacion`
    - Al submit: llamar `interesesApi.registrar(loanId, data)`, invocar `onSuccess()` en éxito, mostrar error en caso de respuesta no-2xx
    - _Requisitos: design.md — RegistrarInteresPanel, Req. 2_

- [ ] 27. Crear `frontend/src/components/RegistrarMoraPanel.jsx`
  - [~] 27.1 Implementar slide-over siguiendo el patrón `ClientSlideOver.jsx`
    - Props: `loanId`, `isOpen`, `onClose`, `onSuccess`
    - Campos: `monto`, `fecha_evento`, `motivo`, `observacion`, `asesor`
    - Al submit: llamar `morasApi.registrar(loanId, data)`, invocar `onSuccess()` en éxito
    - _Requisitos: design.md — RegistrarMoraPanel, Req. 4_

- [ ] 28. Crear `frontend/src/pages/CreditoDetallePage.jsx`
  - [~] 28.1 Implementar página de detalle de crédito
    - Obtener `loanId` con `useParams()`
    - Llamar `creditosApi.obtenerEstado(loanId)` y `creditosApi.historial(loanId)` al montar
    - Header con: Capital Inicial, Capital Pendiente, badge amarillo para Interés Pendiente (si > 0), badge rojo para Mora Vigente (si > 0), badge de Estado (verde ACTIVO / gris CANCELADO)
    - Botones "Registrar Interés", "Registrar Mora", "Registrar Pago" que abren los paneles correspondientes
    - Refrescar estado del crédito e historial al cerrar cualquier panel con éxito
    - Embeber `HistorialCreditoTable` con el historial cargado
    - _Requisitos: design.md — CreditoDetallePage, Req. 8, 12_

- [ ] 29. Actualizar `frontend/src/pages/PrestamosPage.jsx`
  - [~] 29.1 Añadir columna "Estado Financiero" y enlace a detalle
    - Cargar datos de `GET /creditos/` en paralelo o secuencial con los datos existentes para obtener `interes_pendiente` y `mora_vigente` por crédito
    - Añadir columna en `LoansTable` con los valores calculados
    - Añadir botón/enlace "Ver detalle" que navega a `/creditos/:id` usando `react-router-dom`
    - No eliminar ni modificar la funcionalidad legacy existente de la página
    - _Requisitos: design.md — Actualizaciones PrestamosPage_

- [ ] 30. Actualizar `frontend/src/App.jsx`
  - [~] 30.1 Añadir ruta `/creditos/:id` → `CreditoDetallePage`
    - Importar `CreditoDetallePage` y registrar la nueva ruta en el router existente
    - Mantener todas las rutas existentes sin modificaciones
    - _Requisitos: design.md — Frontend Architecture_

---

### FASE 7 — MCP

- [ ] 31. Actualizar dependencias en `requirements.txt`
  - [~] 31.1 Añadir `mcp>=1.0.0` y `httpx>=0.27.0` al archivo existente
    - Verificar que no haya conflictos con las dependencias actuales del proyecto
    - _Requisitos: design.md — MCP Dependencias_

- [ ] 32. Crear `app/mcp_server.py`
  - [~] 32.1 Implementar servidor MCP con las seis tools del diseño
    - `get_loan_status(loan_id)` — wrapper de `GET /creditos/{loan_id}`
    - `get_loan_history(loan_id)` — wrapper de `GET /creditos/{loan_id}/historial`
    - `register_interest(loan_id, ...)` — wrapper de `POST /creditos/{loan_id}/intereses`
    - `register_mora(loan_id, ...)` — wrapper de `POST /creditos/{loan_id}/moras`
    - `apply_payment(loan_id, ...)` — wrapper de `POST /creditos/{loan_id}/pagos`
    - `list_loans(status_filter)` — wrapper de `GET /creditos/` con query param opcional
    - Cada tool es un wrapper HTTP puro con `httpx.AsyncClient`; no implementar lógica financiera propia
    - Punto de entrada `if __name__ == "__main__": asyncio.run(server.run_stdio())`
    - _Requisitos: design.md — MCP Principio arquitectónico, app/mcp_server.py_

- [ ] 33. Crear `.kiro/settings/mcp.json`
  - [~] 33.1 Crear archivo de configuración MCP con el contenido exacto del diseño
    - Server name: `dlhb-core-financial`
    - `command: python`, `args: ["-m", "app.mcp_server"]`
    - `cwd` apuntando a la raíz del workspace
    - `PYTHONPATH` configurado al workspace
    - Lista de tools: `get_loan_status`, `get_loan_history`, `register_interest`, `register_mora`, `apply_payment`, `list_loans`
    - _Requisitos: design.md — .kiro/settings/mcp.json_

- [~] 34. Checkpoint final — verificar MCP
  - Ejecutar `python -c "from app.mcp_server import server; print('MCP OK')"` para confirmar que el módulo importa sin errores
  - Confirmar que `requirements.txt` tiene las dependencias MCP añadidas
  - Pedir confirmación al usuario para dar el Motor Financiero por completo

---

## Notas

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido. Se recomienda ejecutarlas para validar correctitud del motor financiero.
- Las tareas de tests (fases 5 completa) requieren `pytest>=7.0` e `hypothesis>=6.0`. Si no están instalados, ejecutar primero `pip install pytest hypothesis` antes de correr cualquier test.
- Los checkpoints en las tareas 8, 16, 23 y 34 son puntos de sincronización; el agente de implementación debe esperar confirmación del usuario antes de avanzar a la siguiente fase.
- El módulo `app/ml/` no debe ser tocado por ninguna tarea de esta lista.
- Los endpoints legacy (`/loans/`, `/payments/`, `/pagos/registrar`, `/riesgo/evaluar`) deben seguir funcionando durante y después de toda la implementación.
- Toda la lógica financiera reside exclusivamente en `app/services/financial_engine.py`; los routers y el frontend son consumidores puros.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "2.5"] },
    { "id": 3, "tasks": ["3.1"] },
    { "id": 4, "tasks": ["4.1"] },
    { "id": 5, "tasks": ["4.2", "4.3"] },
    { "id": 6, "tasks": ["4.4", "5.1", "5.3"] },
    { "id": 7, "tasks": ["4.5", "5.2", "6.1"] },
    { "id": 8, "tasks": ["5.4", "6.2"] },
    { "id": 9, "tasks": ["6.3"] },
    { "id": 10, "tasks": ["6.4", "7.1"] },
    { "id": 11, "tasks": ["9.1"] },
    { "id": 12, "tasks": ["9.2", "9.3", "9.4", "9.5"] },
    { "id": 13, "tasks": ["9.6", "10.1"] },
    { "id": 14, "tasks": ["11.1", "11.2", "12.1", "13.1", "14.1"] },
    { "id": 15, "tasks": ["11.3", "11.4", "13.2", "14.2"] },
    { "id": 16, "tasks": ["15.1"] },
    { "id": 17, "tasks": ["17.1", "17.2"] },
    { "id": 18, "tasks": ["18.1", "18.2", "19.1", "19.3", "20.1", "20.2", "20.3"] },
    { "id": 19, "tasks": ["18.3", "19.2", "20.4", "20.5"] },
    { "id": 20, "tasks": ["21.1", "21.2", "21.3", "21.4"] },
    { "id": 21, "tasks": ["22.1", "22.2", "22.3"] },
    { "id": 22, "tasks": ["22.4", "22.5"] },
    { "id": 23, "tasks": ["22.6", "22.7"] },
    { "id": 24, "tasks": ["24.1"] },
    { "id": 25, "tasks": ["25.1", "26.1", "27.1"] },
    { "id": 26, "tasks": ["28.1"] },
    { "id": 27, "tasks": ["29.1"] },
    { "id": 28, "tasks": ["30.1"] },
    { "id": 29, "tasks": ["31.1"] },
    { "id": 30, "tasks": ["32.1"] },
    { "id": 31, "tasks": ["33.1"] }
  ]
}
```
