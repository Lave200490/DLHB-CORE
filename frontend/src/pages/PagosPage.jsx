/**
 * PagosPage: Gestión de pagos conectada a la API real.
 * - Lista todos los pagos con filtro por préstamo
 * - Formulario para registrar un pago (usa endpoint transaccional /pagos/registrar)
 */

import { useState, useEffect } from 'react'
import { pagosApi, prestamosApi, exportApi } from '../services/api'
import { formatDate, formatCurrency } from '../utils/helpers'

// ---------------------------------------------------------------------------
// Sub-componente: formulario de registro de pago
// ---------------------------------------------------------------------------
function RegistrarPago({ loans, onSubmit, onCancel, saving }) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({ loan_id: '', amount_received: '', payment_date: today })
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [selectedLoan, setSelectedLoan] = useState(null)

  const activeLoans = loans.filter((l) => l.status === 'ACTIVO')

  useEffect(() => {
    if (form.loan_id) {
      const loan = loans.find((l) => l.id === parseInt(form.loan_id))
      setSelectedLoan(loan || null)
    } else {
      setSelectedLoan(null)
    }
  }, [form.loan_id, loans])

  const validate = (f) => {
    const e = {}
    if (!f.loan_id) e.loan_id = 'Selecciona un préstamo'
    const amount = parseFloat(f.amount_received)
    if (!f.amount_received || isNaN(amount) || amount <= 0) {
      e.amount_received = 'El monto debe ser mayor a 0'
    } else if (selectedLoan) {
      const interest = selectedLoan.outstanding_balance * selectedLoan.interest_rate
      const maxPayment = selectedLoan.outstanding_balance + interest
      if (amount > maxPayment) {
        e.amount_received = `No puede superar el total adeudado: ${formatCurrency(maxPayment)} (saldo + interés)`
      }
    }
    if (!f.payment_date) e.payment_date = 'La fecha es requerida'
    return e
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    const updated = { ...form, [name]: value }
    setForm(updated)
    if (touched[name]) setErrors(validate(updated))
  }

  const handleBlur = (e) => {
    setTouched((p) => ({ ...p, [e.target.name]: true }))
    setErrors(validate(form))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const allTouched = { loan_id: true, amount_received: true, payment_date: true }
    setTouched(allTouched)
    const errs = validate(form)
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    onSubmit({
      loan_id: parseInt(form.loan_id),
      amount_received: parseFloat(form.amount_received),
      payment_date: form.payment_date,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Préstamo */}
      <div>
        <label className="block text-sm font-medium text-navy-900 mb-1">Préstamo *</label>
        <select
          name="loan_id"
          value={form.loan_id}
          onChange={handleChange}
          onBlur={handleBlur}
          className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
            touched.loan_id && errors.loan_id
              ? 'border-red-400 focus:ring-red-400 bg-red-50'
              : 'border-gray-300 focus:ring-blue-500'
          }`}
        >
          <option value="">-- Seleccionar préstamo activo --</option>
          {activeLoans.map((l) => (
            <option key={l.id} value={l.id}>
              #{l.id} · Saldo: {formatCurrency(l.outstanding_balance)}
            </option>
          ))}
        </select>
        {touched.loan_id && errors.loan_id && (
          <p className="text-red-600 text-xs mt-1">{errors.loan_id}</p>
        )}
      </div>

      {/* Detalle del préstamo seleccionado */}
      {selectedLoan && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm space-y-1">
          <div className="flex justify-between text-blue-800">
            <span>Saldo pendiente:</span>
            <span className="font-semibold font-mono">{formatCurrency(selectedLoan.outstanding_balance)}</span>
          </div>
          <div className="flex justify-between text-blue-700">
            <span>Tasa de interés:</span>
            <span>{(selectedLoan.interest_rate * 100).toFixed(0)}%</span>
          </div>
          <div className="flex justify-between text-blue-700">
            <span>Interés del período:</span>
            <span className="font-mono">{formatCurrency(selectedLoan.outstanding_balance * selectedLoan.interest_rate)}</span>
          </div>
        </div>
      )}

      {/* Monto */}
      <div>
        <label className="block text-sm font-medium text-navy-900 mb-1">Monto recibido ($) *</label>
        <input
          type="number"
          name="amount_received"
          value={form.amount_received}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="Ej: 50000"
          min="1"
          step="any"
          className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
            touched.amount_received && errors.amount_received
              ? 'border-red-400 focus:ring-red-400 bg-red-50'
              : 'border-gray-300 focus:ring-blue-500'
          }`}
        />
        {touched.amount_received && errors.amount_received && (
          <p className="text-red-600 text-xs mt-1">{errors.amount_received}</p>
        )}
      </div>

      {/* Fecha */}
      <div>
        <label className="block text-sm font-medium text-navy-900 mb-1">Fecha de pago *</label>
        <input
          type="date"
          name="payment_date"
          value={form.payment_date}
          onChange={handleChange}
          onBlur={handleBlur}
          className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
            touched.payment_date && errors.payment_date
              ? 'border-red-400 focus:ring-red-400 bg-red-50'
              : 'border-gray-300 focus:ring-blue-500'
          }`}
        />
        {touched.payment_date && errors.payment_date && (
          <p className="text-red-600 text-xs mt-1">{errors.payment_date}</p>
        )}
      </div>

      {/* Preview de distribución */}
      {selectedLoan && form.amount_received && parseFloat(form.amount_received) > 0 && (
        (() => {
          const amount = parseFloat(form.amount_received)
          const saldo = selectedLoan.outstanding_balance
          const interest = saldo * selectedLoan.interest_rate
          const maxPayment = saldo + interest

          // Primero se cubre el interés, luego el excedente va a capital
          const interestPay = Math.min(amount, interest)
          const principalPay = Math.max(0, amount - interest)
          const newBalance = Math.max(0, saldo - principalPay)

          const isOverpay = amount > maxPayment

          return (
            <div className={`rounded-lg p-3 text-sm space-y-2 border ${isOverpay ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
              <p className="font-semibold text-gray-800">Distribución del pago</p>

              {/* Interés generado este período */}
              <div className="bg-white rounded p-2 space-y-1 border border-gray-200">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Interés del período</p>
                <div className="flex justify-between text-gray-700">
                  <span>Saldo × tasa ({(selectedLoan.interest_rate * 100).toFixed(0)}%)</span>
                  <span className="font-mono font-semibold">{formatCurrency(interest)}</span>
                </div>
              </div>

              {/* Distribución */}
              <div className="flex justify-between text-yellow-800">
                <span>① Abono a interés:</span>
                <span className="font-mono font-semibold">{formatCurrency(interestPay)}</span>
              </div>
              <div className="flex justify-between text-green-800">
                <span>② Abono a capital:</span>
                <span className="font-mono font-semibold">{formatCurrency(principalPay)}</span>
              </div>

              {/* Nuevo saldo */}
              <div className="flex justify-between font-bold text-navy-900 border-t border-gray-300 pt-2">
                <span>Nuevo saldo capital:</span>
                <span className="font-mono">{formatCurrency(newBalance)}</span>
              </div>

              {/* Próximo interés */}
              {newBalance > 0 && (
                <p className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1">
                  Próximo interés sobre {formatCurrency(newBalance)}: <strong>{formatCurrency(newBalance * selectedLoan.interest_rate)}</strong>
                </p>
              )}

              {isOverpay && (
                <p className="text-red-700 text-xs">El pago supera el total adeudado ({formatCurrency(maxPayment)})</p>
              )}
            </div>
          )
        })()
      )}

      <div className="flex gap-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all ${
            saving ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {saving ? 'Registrando...' : 'Registrar Pago'}
        </button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------
export default function PagosPage() {
  const [payments, setPayments] = useState([])
  const [loans, setLoans] = useState([])
  const [panelOpen, setPanelOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [filterLoanId, setFilterLoanId] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const [paymentsData, loansData] = await Promise.all([
          pagosApi.listar(),
          prestamosApi.listar(),
        ])
        setPayments(paymentsData)
        setLoans(loansData)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleRegistrar = async (payload) => {
    setSaving(true)
    try {
      const nuevo = await pagosApi.registrar(payload)
      setPayments((prev) => [nuevo, ...prev])
      // Actualizar saldo del préstamo en memoria
      setLoans((prev) =>
        prev.map((l) => {
          if (l.id !== payload.loan_id) return l
          const newBalance = Math.max(0, l.outstanding_balance - nuevo.principal_payment)
          return {
            ...l,
            outstanding_balance: newBalance,
            status: newBalance <= 0 ? 'INACTIVO' : l.status,
          }
        })
      )
      setPanelOpen(false)
    } catch (err) {
      alert(`No se pudo registrar el pago: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const getLoanInfo = (loanId) => {
    const l = loans.find((l) => l.id === loanId)
    return l ? `Préstamo #${l.id}` : `#${loanId}`
  }

  const filteredPayments = filterLoanId
    ? payments.filter((p) => p.loan_id === parseInt(filterLoanId))
    : payments

  const totalRecibido = filteredPayments.reduce((s, p) => s + p.amount_received, 0)
  const totalCapital = filteredPayments.reduce((s, p) => s + p.principal_payment, 0)
  const totalInteres = filteredPayments.reduce((s, p) => s + p.interest_payment, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-navy-700 text-lg">Cargando pagos...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="bg-red-50 border border-red-300 rounded-lg p-6 max-w-md text-center">
          <p className="text-red-700 font-semibold">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-navy-900">Gestión de Pagos</h1>
          <p className="text-gray-600 mt-1">
            <span className="font-semibold text-navy-700">{filteredPayments.length}</span> registros ·{' '}
            <span className="font-semibold text-navy-700">{formatCurrency(totalRecibido)}</span> recibido
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => exportApi.pagos()}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-gray-300"
            title="Exportar a CSV"
          >
            ↓ CSV
          </button>
          <button
            onClick={() => setPanelOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-md"
          >
            + Registrar Pago
          </button>
        </div>
      </div>

      {/* Resumen de totales */}
      {filteredPayments.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
            <p className="text-sm text-gray-600">Total recibido</p>
            <p className="text-xl font-bold text-navy-900 font-mono">{formatCurrency(totalRecibido)}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
            <p className="text-sm text-gray-600">Abono a capital</p>
            <p className="text-xl font-bold text-navy-900 font-mono">{formatCurrency(totalCapital)}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
            <p className="text-sm text-gray-600">Abono a interés</p>
            <p className="text-xl font-bold text-navy-900 font-mono">{formatCurrency(totalInteres)}</p>
          </div>
        </div>
      )}

      {/* Filtro por préstamo */}
      <div className="bg-white rounded-lg shadow p-4">
        <select
          value={filterLoanId}
          onChange={(e) => setFilterLoanId(e.target.value)}
          className="w-full md:w-72 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos los préstamos</option>
          {loans.map((l) => (
            <option key={l.id} value={l.id}>
              Préstamo #{l.id} · {l.status}
            </option>
          ))}
        </select>
      </div>

      {/* Tabla */}
      {filteredPayments.length === 0 ? (
        <div className="bg-white rounded-lg shadow-lg p-12 text-center">
          <p className="text-gray-500 text-lg mb-2">No hay pagos registrados</p>
          <p className="text-gray-400 text-sm">
            Registra el primer pago con el botón &ldquo;+ Registrar Pago&rdquo;
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-navy-700 text-white text-sm font-semibold">
                  <th className="px-4 py-4 text-left">Préstamo</th>
                  <th className="px-4 py-4 text-center">Fecha</th>
                  <th className="px-4 py-4 text-right">Recibido</th>
                  <th className="px-4 py-4 text-right">A Capital</th>
                  <th className="px-4 py-4 text-right">A Interés</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((payment) => (
                  <tr
                    key={payment.id}
                    className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-navy-900">
                      {getLoanInfo(payment.loan_id)}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600 text-sm">
                      {formatDate(payment.payment_date)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-navy-900 font-mono text-sm">
                      {formatCurrency(payment.amount_received)}
                    </td>
                    <td className="px-4 py-3 text-right text-green-700 font-mono text-sm">
                      {formatCurrency(payment.principal_payment)}
                    </td>
                    <td className="px-4 py-3 text-right text-yellow-700 font-mono text-sm">
                      {formatCurrency(payment.interest_payment)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Panel lateral */}
      {panelOpen && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-40 z-40"
            onClick={() => setPanelOpen(false)}
          />
          <div className="fixed right-0 top-0 h-screen w-full max-w-md bg-white shadow-xl z-50 overflow-y-auto">
            <div className="sticky top-0 bg-navy-700 text-white px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Registrar Pago</h2>
              <button
                onClick={() => setPanelOpen(false)}
                className="text-white hover:bg-navy-600 p-2 rounded transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <RegistrarPago
                loans={loans}
                onSubmit={handleRegistrar}
                onCancel={() => setPanelOpen(false)}
                saving={saving}
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
