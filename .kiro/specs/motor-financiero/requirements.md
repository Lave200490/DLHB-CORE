# Requirements Document

## Introduction

El Motor Financiero de DLHB-CORE es el conjunto de servicios del backend responsable de toda la lógica de créditos: cálculo de interés sobre saldo insoluto, aplicación de pagos con prioridad configurable, registro manual de mora, trazabilidad completa de operaciones y flexibilidad total en la forma de pago. El motor vive exclusivamente en la capa de servicios del backend (FastAPI/SQLAlchemy) y es consumido tanto por el frontend React como, en el futuro, por el servidor MCP. Ningún cliente externo implementa lógica financiera propia.

## Glossary

- **Crédito**: Operación financiera que registra el capital prestado a un cliente, junto con la tasa de interés pactada, la periodicidad, las fechas relevantes y el historial completo de operaciones.
- **Capital_Inicial**: Monto original desembolsado al cliente al momento de crear el crédito. No cambia durante la vida del crédito.
- **Capital_Pendiente**: Saldo de capital que el cliente aún debe en un momento dado. Disminuye conforme se realizan abonos a capital. Sinónimo de `outstanding_balance` en el modelo de datos actual.
- **Tasa_Interes**: Porcentaje almacenado junto con su unidad (`interest_period_unit`). Unidades válidas: `mensual`, `anual`, `por_periodo`. El motor convierte la unidad al período pactado antes de aplicar el cálculo. Expresada como decimal (ej. 0.20 = 20%).
- **Periodicidad**: Número de días que define cada período de interés (ej. 10, 15, 25 ó 31 días).
- **Interes_Periodo**: Monto de interés que corresponde al período actual, calculado como `Capital_Pendiente × Tasa_Interes`.
- **Interes_Pendiente**: Valor calculado: `Σ(Registro_Interes.monto) − Σ(Registro_Pago.monto_a_interes)`. No es un campo estático del crédito; se recalcula siempre desde el historial de Registros_Interes y Registros_Pago.
- **Mora**: Monto adicional acordado manualmente con el cliente como consecuencia de un atraso. No se calcula con fórmula; es registrado de forma explícita por un usuario autorizado.
- **Registro_Mora**: Entidad que documenta un evento de mora: monto, fecha, motivo, observación y usuario que la registró.
- **Pago**: Transacción que aplica un monto recibido del cliente contra las obligaciones del crédito (mora, interés y/o capital) siguiendo la política de prioridad vigente.
- **Registro_Pago**: Entidad inmutable que persiste todos los campos de un pago aplicado: monto total recibido, fecha, monto aplicado a mora, monto aplicado a intereses, monto aplicado a capital, observación y usuario.
- **Politica_Prioridad**: Orden en que el Motor_Financiero distribuye un pago entre mora, interés y capital.
  - Sin mora activa: **Interés → Capital**.
  - Con mora activa: **Mora → Capital** (el interés pendiente se conserva sin modificar).
- **Motor_Financiero**: Capa de servicios del backend que encapsula toda la lógica financiera. No expone lógica al frontend ni al MCP directamente; estos consumen sus operaciones a través de la API.
- **Estado_Credito**: Valor enumerado que indica la situación actual del crédito: `ACTIVO` o `CANCELADO`. Un crédito pasa a `CANCELADO` únicamente cuando Capital_Pendiente = 0 AND Interes_Pendiente_calculado = 0 AND Mora_vigente = 0, de forma simultánea.
- **Asesor**: Identificador del usuario del sistema que gestiona el crédito o registra la operación.
- **Auditoria**: Capacidad del sistema de reconstruir el estado de cualquier crédito en cualquier momento a partir de su historial de operaciones.
- **Saldo_Insoluto**: Técnica de cálculo de interés en la que la base del cálculo es el Capital_Pendiente de cada período, no el Capital_Inicial.
- **Abono_Capital**: Pago o fracción de pago que reduce directamente el Capital_Pendiente.
- **Acuerdo_Pago**: Arreglo entre el asesor y el cliente que puede incluir pagos parciales, diferimientos o montos especiales, registrado como observación en el Registro_Pago o Registro_Mora correspondiente.
- **Cancelacion_Total**: Pago o secuencia de pagos que deja Capital_Pendiente, Interes_Pendiente_calculado y Mora_vigente todos en cero, activando la transición a estado `CANCELADO`.
- **Registro_Interes**: Entidad inmutable (append-only) que documenta cuándo y por qué monto se generó un período de interés. Campos: loan_id, monto_interes, capital_base, tasa_aplicada, fecha_generacion, asesor_que_lo_registró, observación.
- **Snapshot_Pago**: Campos adicionales del Registro_Pago que registran el estado financiero del crédito inmediatamente antes y después de aplicar el pago. Incluye: `capital_previo`, `capital_posterior`, `mora_previa`, `mora_posterior`.

## Requirements

### Requirement 1: Estructura del Crédito

**User Story:** As a asesor, I want crear un crédito con todos los parámetros financieros del cliente, so that el Motor_Financiero pueda calcular correctamente el interés y aplicar pagos durante toda la vida del crédito.

#### Acceptance Criteria

1. THE Motor_Financiero SHALL asociar cada Crédito a exactamente un Cliente mediante un identificador único.
2. THE Motor_Financiero SHALL registrar para cada Crédito: Capital_Inicial, Capital_Pendiente, Tasa_Interes, `interest_period_unit`, Periodicidad, fecha de desembolso, fecha de vencimiento, Estado_Credito y Asesor responsable.
3. THE Motor_Financiero SHALL establecer el Capital_Pendiente igual al Capital_Inicial en el momento de la creación del crédito.
4. THE Motor_Financiero SHALL establecer el Estado_Credito en `ACTIVO` en el momento de la creación del crédito.
5. WHEN se crea un Crédito con Capital_Inicial menor o igual a cero, THEN THE Motor_Financiero SHALL rechazar la operación y retornar un error descriptivo.
6. WHEN se crea un Crédito con Tasa_Interes menor o igual a cero, THEN THE Motor_Financiero SHALL rechazar la operación y retornar un error descriptivo. La tasa mínima válida es cualquier valor estrictamente mayor que cero.
7. WHEN se crea un Crédito con Periodicidad no positiva, THEN THE Motor_Financiero SHALL rechazar la operación y retornar un error descriptivo.
8. THE Motor_Financiero SHALL mantener el Capital_Inicial inalterado durante toda la vida del crédito, independientemente de los pagos realizados.
9. WHEN se crea un Crédito, THE Motor_Financiero SHALL almacenar la `Tasa_Interes` junto con su unidad (`mensual`, `anual` o `por_periodo`) para garantizar la interpretación correcta del cálculo.

### Requirement 2: Cálculo de Interés sobre Saldo Insoluto

**User Story:** As a asesor, I want que el interés de cada período se calcule sobre el Capital_Pendiente actual y no sobre el Capital_Inicial, so that el cliente pague menos interés conforme amortiza capital.

#### Acceptance Criteria

1. WHEN se solicita el Interes_Periodo de un crédito, THE Motor_Financiero SHALL calcularlo como `Capital_Pendiente × Tasa_Interes`.
2. THE Motor_Financiero SHALL recalcular el Interes_Periodo usando el Capital_Pendiente vigente en el momento de la consulta, no el Capital_Inicial.
3. WHEN el Capital_Pendiente es 1.000.000 y la Tasa_Interes es 0.20, THE Motor_Financiero SHALL retornar un Interes_Periodo de 200.000.
4. WHEN el Capital_Pendiente ha sido reducido a 700.000 y la Tasa_Interes es 0.20, THE Motor_Financiero SHALL retornar un Interes_Periodo de 140.000.
5. WHEN el Capital_Pendiente es cero, THE Motor_Financiero SHALL retornar un Interes_Periodo de cero.
6. THE Motor_Financiero SHALL aplicar la Tasa_Interes específica de cada crédito, sin asumir una tasa global del sistema.
7. THE Motor_Financiero SHALL calcular el Interes_Periodo como el monto completo del período pactado, sin ajuste proporcional por los días transcurridos. El interés se cobra por el período completo al momento de generarse el Registro_Interes.

**Propiedad de corrección (para property-based testing):**
- Para cualquier par `(capital_pendiente ≥ 0, tasa_interes ≥ 0)`: `interes_periodo = capital_pendiente × tasa_interes`. El resultado es siempre mayor o igual a cero.
- Invariante de monotonía: si `capital_A < capital_B` con la misma tasa, entonces `interes(capital_A) < interes(capital_B)`.
- Invariante de proporcionalidad: reducir el Capital_Pendiente en un porcentaje `p` reduce el Interes_Periodo en el mismo porcentaje `p`.

### Requirement 3: Aplicación de Pagos sin Mora (Prioridad: Interés → Capital)

**User Story:** As a asesor, I want que cuando no hay mora activa un pago se aplique primero a intereses y luego al capital pendiente, so that el crédito no genere interés sobre interés.

#### Acceptance Criteria

1. WHILE un crédito no tiene Mora activa, WHEN se registra un Pago, THE Motor_Financiero SHALL aplicar el monto primero al Interes_Pendiente y el remanente al Capital_Pendiente.
2. WHEN el Pago es igual al Interes_Pendiente, THE Motor_Financiero SHALL cancelar el Interes_Pendiente a cero y no modificar el Capital_Pendiente.
3. WHEN el Pago es mayor que el Interes_Pendiente, THE Motor_Financiero SHALL cancelar el Interes_Pendiente a cero y reducir el Capital_Pendiente en `Pago − Interes_Pendiente`.
4. WHEN el Pago es menor que el Interes_Pendiente, THE Motor_Financiero SHALL reducir el Interes_Pendiente en el monto del Pago y no modificar el Capital_Pendiente.

**Ejemplo numérico (caso base):**
- Capital_Pendiente = 1.000.000 · Interes_Pendiente = 200.000 · Pago = 500.000
- Resultado esperado: Interes_Pendiente = 0 · Abono_Capital = 300.000 · Capital_Pendiente nuevo = 700.000.

**Ejemplo numérico (solo intereses):**
- Capital_Pendiente = 1.000.000 · Interes_Pendiente = 200.000 · Pago = 200.000
- Resultado esperado: Interes_Pendiente = 0 · Abono_Capital = 0 · Capital_Pendiente nuevo = 1.000.000.

**Ejemplo numérico (pago parcial menor al interés):**
- Capital_Pendiente = 1.000.000 · Interes_Pendiente = 200.000 · Pago = 80.000
- Resultado esperado: Interes_Pendiente = 120.000 · Abono_Capital = 0 · Capital_Pendiente nuevo = 1.000.000.

**Propiedades de corrección:**
- Invariante de conservación: `monto_a_interes + monto_a_capital = monto_pago_recibido` para todo pago sin mora.
- Invariante de no negatividad: `Capital_Pendiente ≥ 0` e `Interes_Pendiente ≥ 0` después de cualquier pago.
- Invariante de no exceso: el Abono_Capital nunca puede ser mayor que el Capital_Pendiente previo al pago.

### Requirement 4: Registro Manual de Mora

**User Story:** As a asesor, I want registrar manualmente el monto de mora acordado con el cliente, so that se refleje fielmente el acuerdo sin que el sistema invente valores automáticos.

#### Acceptance Criteria

1. WHEN un asesor registra un evento de mora, THE Motor_Financiero SHALL persistir un Registro_Mora con: monto de mora, fecha del evento, motivo, observación libre y Asesor que lo registró.
2. THE Motor_Financiero SHALL aceptar únicamente moras con monto mayor a cero.
3. WHEN se intenta registrar una mora con monto menor o igual a cero, THEN THE Motor_Financiero SHALL rechazar la operación y retornar un error descriptivo.
4. THE Motor_Financiero SHALL permitir múltiples Registros_Mora sobre el mismo crédito en diferentes fechas.
5. THE Motor_Financiero SHALL calcular la Mora total vigente de un crédito como `Σ(Registro_Mora.monto) − Σ(Registro_Pago.monto_a_mora)`. Los Registro_Mora son append-only y nunca se modifican.
6. THE Motor_Financiero SHALL conservar cada Registro_Mora de forma permanente, sin eliminación ni modificación posterior.
7. THE Motor_Financiero SHALL exponer la Mora total vigente de un crédito como parte del estado del crédito en consultas.

**Restricción explícita:**
- THE Motor_Financiero SHALL NOT calcular mora de forma automática mediante fórmula, temporización o regla de negocio interna. Todo monto de mora debe originarse en un Registro_Mora creado por un asesor.

### Requirement 5: Aplicación de Pagos con Mora (Prioridad: Mora → Capital)

**User Story:** As a asesor, I want que cuando hay mora activa un pago se aplique primero a la mora y luego al capital (omitiendo temporalmente el interés), so that se maximice la recuperación del capital prestado.

#### Acceptance Criteria

1. WHILE un crédito tiene Mora activa mayor a cero, WHEN se registra un Pago, THE Motor_Financiero SHALL aplicar el monto primero a la Mora y el remanente al Capital_Pendiente, preservando el Interes_Pendiente sin cambios.
2. WHEN el Pago es igual a la Mora activa, THE Motor_Financiero SHALL cancelar la Mora a cero y no modificar el Capital_Pendiente ni el Interes_Pendiente.
3. WHEN el Pago es mayor que la Mora activa, THE Motor_Financiero SHALL cancelar la Mora a cero y reducir el Capital_Pendiente en `Pago − Mora`.
4. WHEN el Pago es menor que la Mora activa, THE Motor_Financiero SHALL reducir la Mora en el monto del Pago y no modificar el Capital_Pendiente ni el Interes_Pendiente.
5. WHEN un pago con mora activa cubre el 100% de la mora vigente y tiene sobrante, THE Motor_Financiero SHALL aplicar el sobrante bajo la política estándar (Interés → Capital) dentro del mismo pago, sin esperar al siguiente pago.
6. WHEN se aplica un pago a la mora, THE Motor_Financiero SHALL descontar los Registro_Mora en orden cronológico ascendente (FIFO): primero el más antiguo hasta agotarlo, luego el siguiente.

**Ejemplo numérico (caso base con mora):**
- Capital_Pendiente = 1.000.000 · Interes_Pendiente = 200.000 · Mora = 50.000 · Pago = 300.000
- Resultado esperado: Mora = 0 · Abono_Capital = 250.000 · Capital_Pendiente nuevo = 750.000 · Interes_Pendiente = 200.000 (sin cambio).

**Ejemplo numérico (pago cubre solo mora parcial):**
- Capital_Pendiente = 1.000.000 · Interes_Pendiente = 200.000 · Mora = 50.000 · Pago = 30.000
- Resultado esperado: Mora = 20.000 · Abono_Capital = 0 · Capital_Pendiente nuevo = 1.000.000 · Interes_Pendiente = 200.000 (sin cambio).

**Ejemplo numérico (pago cubre mora exacta sin sobrante):**
- Capital_Pendiente = 1.000.000 · Interes_Pendiente = 200.000 · Mora = 50.000 · Pago = 50.000
- Resultado esperado: Mora = 0 · Abono_Capital = 0 · Capital_Pendiente nuevo = 1.000.000 · Interes_Pendiente = 200.000 (sin cambio).

**Ejemplo numérico (pago cubre mora y sobrante se aplica en el mismo pago — D4+D5):**
- Capital_Pendiente = 1.000.000 · Interes_Pendiente = 200.000 · Mora = 50.000 · Pago = 400.000
- Resultado esperado: Mora = 0 (−50.000) · Interés = 0 (−200.000) · Capital = 850.000 (−150.000).

**Propiedades de corrección:**
- Invariante de conservación: `monto_a_mora + monto_a_capital = monto_pago_recibido` cuando hay mora activa.
- Invariante de interes estable: el Interes_Pendiente no cambia durante pagos con mora activa.
- Invariante de no negatividad: `Capital_Pendiente ≥ 0` y `Mora ≥ 0` después de cualquier pago.

### Requirement 6: Flexibilidad de Pago

**User Story:** As a asesor, I want poder registrar cualquier tipo de pago (solo intereses, abono parcial, abono total, acuerdo especial), so that se refleje la realidad de los acuerdos con cada cliente sin restricciones de amortización fija.

#### Acceptance Criteria

1. THE Motor_Financiero SHALL aceptar pagos de cualquier monto positivo, sin exigir que el monto sea igual a una cuota predefinida.
2. WHEN el monto del Pago es mayor que la suma de todas las obligaciones vigentes del crédito (Mora + Interes_Pendiente + Capital_Pendiente), THEN THE Motor_Financiero SHALL rechazar el pago y retornar un error descriptivo que indique el exceso.
3. WHEN `Capital_Pendiente = 0` AND `Interes_Pendiente_calculado = 0` AND `Mora_vigente = 0`, THE Motor_Financiero SHALL cambiar el Estado_Credito a `CANCELADO`.
4. WHEN se registra una Cancelacion_Total, THE Motor_Financiero SHALL establecer el Capital_Pendiente en cero, el Interes_Pendiente en cero y la Mora en cero.
5. THE Motor_Financiero SHALL aceptar un pago destinado únicamente a cubrir el Interes_Pendiente (Abono solo intereses), sin modificar el Capital_Pendiente.
6. THE Motor_Financiero SHALL aceptar un pago que incluya un monto a Capital_Pendiente superior al Interes_Pendiente del período.
7. THE Motor_Financiero SHALL permitir registrar una observación libre en cada Pago para documentar acuerdos especiales.
8. WHEN el monto del Pago es menor o igual a cero, THEN THE Motor_Financiero SHALL rechazar la operación y retornar un error descriptivo.
9. IF el Capital_Pendiente es cero pero el Interes_Pendiente_calculado o la Mora_vigente son mayores que cero, THEN el crédito permanece en estado `ACTIVO` y continúa aceptando pagos para saldar las obligaciones restantes.

**Casos límite:**
- Pago = Interes_Pendiente exacto: capital sin cambio, interés cancelado.
- Pago = Capital_Pendiente + Interes_Pendiente (sin mora): cancelación total del crédito.
- Pago = 1 (mínimo positivo): aplicado completamente a la primera obligación según política de prioridad.

### Requirement 7: Registro de Pago Inmutable

**User Story:** As a asesor o auditor, I want que cada pago quede registrado de forma permanente con todos sus detalles, so that el historial nunca se altere y sea fuente de verdad para cualquier auditoría.

#### Acceptance Criteria

1. WHEN el Motor_Financiero aplica un Pago, THE Motor_Financiero SHALL persistir un Registro_Pago con: monto total recibido, fecha del pago, monto aplicado a mora, monto aplicado a intereses, monto aplicado a capital, observación y Asesor que registró el pago.
2. THE Motor_Financiero SHALL conservar cada Registro_Pago de forma permanente sin permitir su eliminación.
3. THE Motor_Financiero SHALL conservar cada Registro_Pago de forma permanente sin permitir su modificación posterior.
4. THE Motor_Financiero SHALL exponer el historial completo de Registros_Pago de un crédito en orden cronológico ascendente.
5. THE Motor_Financiero SHALL retornar cero como valor predeterminado para los campos `monto_a_mora`, `monto_a_interes` o `monto_a_capital` cuando el pago no aplique a esa categoría.
6. WHEN se consulta el historial de pagos de un crédito, THE Motor_Financiero SHALL retornar todos los Registros_Pago sin omisiones.

**Propiedad de corrección (round-trip):**
- La suma de todos los `monto_a_capital` en el historial de Registros_Pago de un crédito debe ser igual a `Capital_Inicial − Capital_Pendiente_actual` en cualquier momento de la vida del crédito.
- La suma de todos los `monto_total_recibido` en el historial debe ser igual a `Σ monto_a_mora + Σ monto_a_interes + Σ monto_a_capital`.

### Requirement 8: Auditoría y Reconstrucción del Estado

**User Story:** As a auditor o asesor senior, I want poder reconstruir el estado de cualquier crédito en cualquier momento a partir de su historial, so that se garantice la trazabilidad total de las operaciones financieras.

#### Acceptance Criteria

1. THE Motor_Financiero SHALL registrar en el historial de operaciones toda operación que modifique Capital_Pendiente, Interes_Pendiente, Mora, o Estado_Credito.
2. THE Motor_Financiero SHALL incluir en cada registro de operación: tipo de operación, fecha, valores previos y valores posteriores de los campos afectados, y el Asesor que ejecutó la operación.
3. WHEN se consulta el historial completo de un crédito (pagos + moras), THE Motor_Financiero SHALL retornar las operaciones en orden cronológico ascendente.
4. THE Motor_Financiero SHALL garantizar que el Capital_Pendiente actual de un crédito sea reconstructible aplicando secuencialmente todos sus Registros_Pago sobre el Capital_Inicial.
5. THE Motor_Financiero SHALL garantizar que la Mora vigente sea reconstructible a partir de la suma de Registros_Mora menos los montos de mora aplicados en los Registros_Pago.
6. THE Motor_Financiero SHALL almacenar en cada Registro_Pago los valores previos y posteriores de los campos financieros modificados: `capital_previo`, `capital_posterior`, `mora_previa`, `mora_posterior`. El Interes_Pendiente no requiere snapshot porque es un campo calculado desde el historial.

**Propiedad de corrección (reconstructibilidad):**
- Invariante de reconstructibilidad: `Capital_Pendiente_actual = Capital_Inicial − Σ monto_a_capital` sobre todos los Registros_Pago del crédito.
- Esta propiedad debe mantenerse para cualquier secuencia válida de pagos, independientemente del orden de registro.

### Requirement 9: Independencia del Motor Financiero

**User Story:** As a arquitecto del sistema, I want que toda la lógica financiera resida en servicios del backend, so that el frontend y el futuro MCP no repliquen lógica y cualquier cambio de regla se aplique en un único lugar.

#### Acceptance Criteria

1. THE Motor_Financiero SHALL encapsular todo el cálculo de Interes_Periodo, la distribución de pagos y el cálculo de Mora vigente en servicios de la capa de backend, sin delegar esa lógica al cliente (frontend o MCP).
2. THE Motor_Financiero SHALL exponer sus operaciones financieras a través de endpoints de la API del backend, de forma que el frontend solo envíe solicitudes y reciba resultados ya calculados.
3. THE Motor_Financiero SHALL retornar en cada respuesta de consulta de crédito: Capital_Pendiente actualizado, Interes_Periodo del período vigente, Mora total vigente y Estado_Credito.
4. THE Motor_Financiero SHALL operar de forma independiente de la capa de presentación; un cambio en el frontend no debe requerir cambios en la lógica financiera del backend.
5. WHERE el servidor MCP se integre en el futuro, THE Motor_Financiero SHALL proveer los mismos servicios del backend al MCP sin duplicar lógica financiera.

### Requirement 10: Validaciones de Integridad Financiera

**User Story:** As a sistema, I want rechazar operaciones financieramente inconsistentes antes de persistirlas, so that se mantenga la integridad de los datos del crédito en todo momento.

#### Acceptance Criteria

1. IF se intenta registrar un Pago sobre un crédito con Estado_Credito `CANCELADO`, THEN THE Motor_Financiero SHALL rechazar la operación y retornar un error descriptivo.
2. IF se intenta registrar una Mora sobre un crédito con Estado_Credito `CANCELADO`, THEN THE Motor_Financiero SHALL rechazar la operación y retornar un error descriptivo.
3. IF se intenta crear un Crédito cuyo Capital_Inicial sea inconsistente con el Capital_Pendiente inicial (distinto de Capital_Inicial), THEN THE Motor_Financiero SHALL rechazar la operación.
4. WHEN el Capital_Pendiente resultante de un Pago sería negativo, THEN THE Motor_Financiero SHALL rechazar el pago y retornar un error descriptivo.
5. WHEN la Mora vigente resultante de un Pago sería negativa, THEN THE Motor_Financiero SHALL rechazar el pago y retornar un error descriptivo.
6. THE Motor_Financiero SHALL validar que la fecha de un Pago o Registro_Mora no sea anterior a la fecha de desembolso del crédito.
7. THE Motor_Financiero SHALL retornar mensajes de error en formato estructurado que identifiquen el campo inválido y el motivo del rechazo.

### Requirement 11: Consulta del Estado Financiero del Crédito

**User Story:** As a asesor, I want consultar en cualquier momento el estado financiero completo de un crédito, so that pueda tomar decisiones informadas sobre pagos, acuerdos o cierre.

#### Acceptance Criteria

1. WHEN se consulta el estado de un crédito, THE Motor_Financiero SHALL retornar: Capital_Inicial, Capital_Pendiente, Tasa_Interes, Periodicidad, Interes_Periodo del período vigente, Mora total vigente, Estado_Credito, fecha de desembolso, fecha de vencimiento y Asesor.
2. THE Motor_Financiero SHALL calcular el Interes_Periodo en el momento de la consulta usando el Capital_Pendiente vigente.
3. THE Motor_Financiero SHALL calcular la Mora vigente en el momento de la consulta sumando los Registros_Mora no cubiertos.
4. THE Motor_Financiero SHALL incluir en la respuesta el historial de Registros_Pago y Registros_Mora del crédito cuando sea solicitado explícitamente.
5. WHEN se consulta un crédito inexistente, THEN THE Motor_Financiero SHALL retornar un error 404 con mensaje descriptivo.

### Requirement 12: Generación del Registro de Interés

**User Story:** As a asesor, I want registrar manualmente el período de interés correspondiente a un crédito, so that quede documentado de forma inmutable cuándo y por qué monto se generó cada cobro de interés, con trazabilidad completa.

#### Acceptance Criteria

1. WHEN un asesor registra un Registro_Interes, THE Motor_Financiero SHALL persistir la entidad con los campos: loan_id, monto_interes, capital_base, tasa_aplicada, fecha_generacion, asesor_que_lo_registró y observación.
2. WHEN se crea un Registro_Interes, THE Motor_Financiero SHALL validar que el monto_interes sea igual a `Capital_Pendiente_en_esa_fecha × Tasa_del_período`; si el monto no coincide, THE Motor_Financiero SHALL rechazar la operación y retornar un error descriptivo.
3. THE Motor_Financiero SHALL conservar cada Registro_Interes de forma permanente sin permitir su modificación ni eliminación posterior (append-only).
4. THE Motor_Financiero SHALL calcular el Interes_Pendiente vigente en cualquier momento como `Σ(Registro_Interes.monto_interes) − Σ(Registro_Pago.monto_a_interes)`, recalculando siempre desde el historial completo de ambas entidades.

**Restricción explícita:**
- THE Motor_Financiero SHALL NOT mantener un campo estático `interes_pendiente` en el modelo del crédito. El valor siempre se deriva del historial de Registros_Interes y Registros_Pago.
