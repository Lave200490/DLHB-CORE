/**
 * Componente LoanPreview: Tarjeta de previsualización de préstamo.
 * Calcula en tiempo real: intereses, total a pagar y fecha de vencimiento.
 */

import { formatCurrency } from '../utils/helpers'

export default function LoanPreview({ formData, clients }) {
  // Obtener cliente seleccionado
  const selectedClient = clients.find((c) => c.id === parseInt(formData.client_id))

  // Conversión de modalidad a días
  const getModalityInDays = () => {
    const value = parseInt(formData.modality_days) || 0
    if (formData.modality_type === 'meses') {
      return Math.round(value * 30.44) // Promedio de días por mes
    }
    return value
  }

  // Calcular intereses
  const capital = parseFloat(formData.capital) || 0
  const interestRate = (parseFloat(formData.interest_rate) || 0) / 100
  const interestAmount = capital * interestRate

  // Calcular total a pagar
  const totalToPay = capital + interestAmount

  // Calcular fecha de vencimiento
  const getMaturityDate = () => {
    if (!formData.start_date || !formData.modality_days) {
      return null
    }

    const startDate = new Date(formData.start_date)
    const daysToAdd = getModalityInDays()
    const maturityDate = new Date(startDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000)

    return maturityDate.toISOString().split('T')[0]
  }

  const maturityDate = getMaturityDate()

  // Calcular días pendientes
  const getDaysRemaining = () => {
    if (!maturityDate) return null
    const today = new Date()
    const maturity = new Date(maturityDate)
    const diffTime = maturity.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const daysRemaining = getDaysRemaining()

  // Validar si el formulario está completo
  const isComplete =
    selectedClient &&
    capital > 0 &&
    formData.interest_rate &&
    formData.modality_days &&
    formData.start_date

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    const date = new Date(dateString + 'T00:00:00Z')
    return new Intl.DateTimeFormat('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date)
  }

  return (
    <div
      className={`rounded-lg shadow-lg overflow-hidden transition-all duration-300 sticky top-6 ${
        isComplete ? 'bg-gradient-to-br from-blue-50 to-blue-100' : 'bg-gray-50'
      }`}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-navy-700 to-navy-800 text-white px-8 py-6">
        <h3 className="text-2xl font-bold">📊 Resumen del Préstamo</h3>
        <p className="text-blue-100 text-sm mt-1">Vista previa en tiempo real</p>
      </div>

      {/* Contenido */}
      <div className="p-8 space-y-6">
        {!isComplete ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">
              ℹ️ Completa el formulario para ver el resumen
            </p>
          </div>
        ) : (
          <>
            {/* Cliente */}
            <div className="border-b border-gray-200 pb-4">
              <p className="text-gray-600 text-sm mb-1">Cliente Seleccionado</p>
              <p className="text-xl font-bold text-navy-900">{selectedClient.name}</p>
              <p className="text-gray-600 text-sm">{selectedClient.identity_document}</p>
            </div>

            {/* Detalles del Préstamo */}
            <div className="space-y-4">
              {/* Capital */}
              <div className="flex items-center justify-between p-3 bg-white rounded border border-gray-200">
                <span className="text-gray-700 font-medium">💰 Capital Inicial</span>
                <span className="text-2xl font-bold text-navy-900">
                  {formatCurrency(capital)}
                </span>
              </div>

              {/* Intereses */}
              <div className="flex items-center justify-between p-3 bg-blue-100 rounded border border-blue-300">
                <span className="text-blue-900 font-medium">📈 Intereses ({formData.interest_rate}%)</span>
                <span className="text-2xl font-bold text-blue-900">
                  +{formatCurrency(interestAmount)}
                </span>
              </div>

              {/* Total a Pagar */}
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg shadow-md">
                <span className="text-white font-bold text-lg">Total a Pagar</span>
                <span className="text-3xl font-bold text-white">
                  {formatCurrency(totalToPay)}
                </span>
              </div>
            </div>

            {/* Cronograma */}
            <div className="border-t border-gray-200 pt-4 space-y-3">
              {/* Fecha de Inicio */}
              <div className="flex items-start gap-3">
                <span className="text-xl">📅</span>
                <div className="flex-1">
                  <p className="text-gray-600 text-sm">Fecha de Inicio</p>
                  <p className="font-semibold text-navy-900">
                    {formatDate(formData.start_date)}
                  </p>
                </div>
              </div>

              {/* Modalidad */}
              <div className="flex items-start gap-3">
                <span className="text-xl">⏱️</span>
                <div className="flex-1">
                  <p className="text-gray-600 text-sm">Plazo</p>
                  <p className="font-semibold text-navy-900">
                    {formData.modality_days} {formData.modality_type === 'meses' ? 'meses' : 'días'}
                    <span className="text-gray-600 text-sm ml-2">
                      ({getModalityInDays()} días aprox.)
                    </span>
                  </p>
                </div>
              </div>

              {/* Fecha de Vencimiento */}
              <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded border border-yellow-200">
                <span className="text-xl">🎯</span>
                <div className="flex-1">
                  <p className="text-gray-600 text-sm">Fecha de Vencimiento</p>
                  <p className="font-bold text-yellow-900">
                    {formatDate(maturityDate)}
                  </p>
                  {daysRemaining && (
                    <p className="text-sm text-yellow-700 mt-1">
                      {daysRemaining > 0
                        ? `${daysRemaining} días desde hoy`
                        : `Vencido hace ${Math.abs(daysRemaining)} días`}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Footer con advertencias */}
            {totalToPay > 0 && (
              <div className="border-t border-gray-200 pt-4 text-center text-sm">
                <div className="bg-green-50 border border-green-200 rounded p-3">
                  <p className="text-green-900">
                    ✓ Todos los datos son válidos y listos para registrar
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
