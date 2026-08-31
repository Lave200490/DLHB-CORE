/**
 * Componente LoanForm: Formulario para registrar un nuevo préstamo.
 * Incluye campos numéricos, selector de cliente y validaciones.
 */

import { useState } from 'react'

export default function LoanForm({ clients, onFormChange }) {
  const [formData, setFormData] = useState({
    client_id: '',
    capital: '',
    interest_rate: '',
    modality_days: '',
    modality_type: 'dias', // 'dias' o 'meses'
    start_date: new Date().toISOString().split('T')[0],
  })

  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})

  const validateField = (name, value) => {
    const newErrors = { ...errors }

    switch (name) {
      case 'client_id':
        if (!value) {
          newErrors.client_id = 'Selecciona un cliente'
        } else {
          delete newErrors.client_id
        }
        break

      case 'capital':
        const capitalNum = parseFloat(value)
        if (!value) {
          newErrors.capital = 'El capital es requerido'
        } else if (capitalNum <= 0) {
          newErrors.capital = 'El capital debe ser mayor a 0'
        } else if (capitalNum > 10000000) {
          newErrors.capital = 'El capital no puede exceder $10.000.000'
        } else {
          delete newErrors.capital
        }
        break

      case 'interest_rate':
        const rateNum = parseFloat(value)
        if (!value) {
          newErrors.interest_rate = 'La tasa es requerida'
        } else if (rateNum <= 0 || rateNum > 100) {
          newErrors.interest_rate = 'La tasa debe estar entre 0.1% y 100%'
        } else {
          delete newErrors.interest_rate
        }
        break

      case 'modality_days':
        const daysNum = parseInt(value)
        if (!value) {
          newErrors.modality_days = 'La modalidad es requerida'
        } else if (daysNum <= 0) {
          newErrors.modality_days = 'Debe ser un valor positivo'
        } else if (daysNum > 365) {
          newErrors.modality_days = 'Máximo 365 días'
        } else {
          delete newErrors.modality_days
        }
        break

      case 'start_date':
        if (!value) {
          newErrors.start_date = 'La fecha es requerida'
        } else {
          delete newErrors.start_date
        }
        break

      default:
        break
    }

    return newErrors
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))

    // Validar mientras se escribe si el campo fue tocado
    if (touched[name]) {
      setErrors(validateField(name, value))
    }

    // Notificar al padre para actualizar preview
    onFormChange({
      ...formData,
      [name]: value,
    })
  }

  const handleBlur = (e) => {
    const { name, value } = e.target
    setTouched((prev) => ({ ...prev, [name]: true }))
    setErrors(validateField(name, value))
  }

  const activeClients = clients.filter((c) => c.status === 'ACTIVO')

  return (
    <form className="bg-white rounded-lg shadow-lg p-8">
      <h2 className="text-2xl font-bold text-navy-900 mb-8">Crear Nuevo Préstamo</h2>

      {/* Cliente */}
      <div className="mb-6">
        <label htmlFor="client_id" className="block text-sm font-medium text-navy-900 mb-2">
          Seleccionar Cliente *
        </label>
        <select
          id="client_id"
          name="client_id"
          value={formData.client_id}
          onChange={handleChange}
          onBlur={handleBlur}
          className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
            touched.client_id && errors.client_id
              ? 'border-red-500 focus:ring-red-500 bg-red-50'
              : 'border-gray-300 focus:ring-blue-500'
          }`}
        >
          <option value="">-- Elige un cliente --</option>
          {activeClients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name} ({client.identity_document})
            </option>
          ))}
        </select>
        {touched.client_id && errors.client_id && (
          <p className="text-red-600 text-sm mt-1">✗ {errors.client_id}</p>
        )}
      </div>

      {/* Capital */}
      <div className="mb-6">
        <label htmlFor="capital" className="block text-sm font-medium text-navy-900 mb-2">
          Capital a Prestar ($) *
        </label>
        <input
          type="number"
          id="capital"
          name="capital"
          value={formData.capital}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="Ej: 50000"
          min="1"
          step="1000"
          className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
            touched.capital && errors.capital
              ? 'border-red-500 focus:ring-red-500 bg-red-50'
              : 'border-gray-300 focus:ring-blue-500'
          }`}
        />
        {touched.capital && errors.capital && (
          <p className="text-red-600 text-sm mt-1">✗ {errors.capital}</p>
        )}
      </div>

      {/* Tasa de Interés */}
      <div className="mb-6">
        <label htmlFor="interest_rate" className="block text-sm font-medium text-navy-900 mb-2">
          Tasa de Interés (%) *
        </label>
        <div className="flex gap-2 items-center">
          <input
            type="number"
            id="interest_rate"
            name="interest_rate"
            value={formData.interest_rate}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Ej: 20"
            min="0.1"
            max="100"
            step="0.1"
            className={`flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
              touched.interest_rate && errors.interest_rate
                ? 'border-red-500 focus:ring-red-500 bg-red-50'
                : 'border-gray-300 focus:ring-blue-500'
            }`}
          />
          <span className="text-xl font-bold text-navy-700">%</span>
        </div>
        {touched.interest_rate && errors.interest_rate && (
          <p className="text-red-600 text-sm mt-1">✗ {errors.interest_rate}</p>
        )}
      </div>

      {/* Modalidad */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-navy-900 mb-2">
          Modalidad (Plazo) *
        </label>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <input
              type="number"
              name="modality_days"
              value={formData.modality_days}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="Ej: 31"
              min="1"
              max="365"
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                touched.modality_days && errors.modality_days
                  ? 'border-red-500 focus:ring-red-500 bg-red-50'
                  : 'border-gray-300 focus:ring-blue-500'
              }`}
            />
          </div>
          <select
            name="modality_type"
            value={formData.modality_type}
            onChange={handleChange}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="dias">Días</option>
            <option value="meses">Meses</option>
          </select>
        </div>
        {touched.modality_days && errors.modality_days && (
          <p className="text-red-600 text-sm mt-1">✗ {errors.modality_days}</p>
        )}
      </div>

      {/* Fecha de Inicio */}
      <div className="mb-8">
        <label htmlFor="start_date" className="block text-sm font-medium text-navy-900 mb-2">
          Fecha de Inicio *
        </label>
        <input
          type="date"
          id="start_date"
          name="start_date"
          value={formData.start_date}
          onChange={handleChange}
          onBlur={handleBlur}
          className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
            touched.start_date && errors.start_date
              ? 'border-red-500 focus:ring-red-500 bg-red-50'
              : 'border-gray-300 focus:ring-blue-500'
          }`}
        />
        {touched.start_date && errors.start_date && (
          <p className="text-red-600 text-sm mt-1">✗ {errors.start_date}</p>
        )}
      </div>

      {/* Botones */}
      <div className="flex gap-3 pt-6 border-t border-gray-200">
        <button
          type="button"
          className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          ✓ Registrar Préstamo
        </button>
      </div>
    </form>
  )
}
