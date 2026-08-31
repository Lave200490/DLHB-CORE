/**
 * ClientForm: Formulario para crear un cliente.
 * Campos: name y phone (campos reales de la API).
 */

import { useState, useEffect } from 'react'

export default function ClientForm({ client = null, onSubmit, onCancel, saving = false }) {
  const [formData, setFormData] = useState({ name: '', phone: '' })
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})

  useEffect(() => {
    if (client) {
      setFormData({ name: client.name || '', phone: client.phone || '' })
    }
  }, [client])

  const validate = (data) => {
    const e = {}
    if (!data.name.trim()) e.name = 'El nombre es requerido'
    else if (data.name.trim().length < 3) e.name = 'Minimo 3 caracteres'
    if (!data.phone.trim()) e.phone = 'El telefono es requerido'
    else if (data.phone.trim().length < 5) e.phone = 'Minimo 5 caracteres'
    return e
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    const updated = { ...formData, [name]: value }
    setFormData(updated)
    if (touched[name]) {
      setErrors(validate(updated))
    }
  }

  const handleBlur = (e) => {
    const { name } = e.target
    setTouched((prev) => ({ ...prev, [name]: true }))
    setErrors(validate(formData))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setTouched({ name: true, phone: true })
    const errs = validate(formData)
    setErrors(errs)
    if (Object.keys(errs).length === 0) {
      onSubmit({ name: formData.name.trim(), phone: formData.phone.trim() })
    }
  }

  const field = (name, label, type = 'text', placeholder = '') => (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-navy-900 mb-2">
        {label} *
      </label>
      <input
        type={type}
        id={name}
        name={name}
        value={formData[name]}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
          touched[name] && errors[name]
            ? 'border-red-500 focus:ring-red-500 bg-red-50'
            : 'border-gray-300 focus:ring-blue-500'
        }`}
      />
      {touched[name] && errors[name] && (
        <p className="text-red-600 text-sm mt-1">{errors[name]}</p>
      )}
    </div>
  )

  const hasErrors = Object.keys(errors).length > 0

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {field('name', 'Nombre Completo', 'text', 'Ej: Juan Garcia Lopez')}
      {field('phone', 'Telefono', 'tel', 'Ej: +57-300-1234567')}

      <div className="flex gap-3 pt-6 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={hasErrors || saving}
          className={`flex-1 px-4 py-2 rounded-lg font-medium text-white transition-all ${
            hasErrors || saving
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {saving ? 'Guardando...' : 'Guardar Cliente'}
        </button>
      </div>
    </form>
  )
}