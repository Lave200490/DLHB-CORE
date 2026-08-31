/**
 * Funciones auxiliares para el componente Dashboard.
 */

/**
 * Formatea una fecha en formato colombiano (DD/MM/YYYY).
 * @param {string} dateString - Fecha en formato ISO (YYYY-MM-DD)
 * @returns {string} Fecha formateada
 */
export function formatDate(dateString) {
  const date = new Date(dateString + 'T00:00:00Z')
  return new Intl.DateTimeFormat('es-CO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/**
 * Determina si un préstamo está vencido.
 * @param {string} dueDate - Fecha de vencimiento en formato ISO (YYYY-MM-DD)
 * @param {string} status - Estado del préstamo (ACTIVO/INACTIVO)
 * @returns {boolean} true si está vencido y activo
 */
export function isLoanOverdue(dueDate, status) {
  if (status === 'INACTIVO') return false
  
  const due = new Date(dueDate + 'T00:00:00Z')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  return due < today
}

/**
 * Formatea un número como moneda colombiana.
 * @param {number} amount - Cantidad a formatear
 * @returns {string} Cantidad formateada como COP
 */
export function formatCurrency(amount) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}
