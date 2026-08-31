/**
 * PrestamosPage: Gestión de préstamos.
 * - Lista con filtros y tabla interactiva
 * - Formulario de nuevo préstamo con score de riesgo IA en tiempo real
 * - Panel de historial de pagos por préstamo
 * - Exportación a CSV
 */

import { useState, useEffect, useCallback } from 'react'
import { prestamosApi, clientesApi, pagosApi, riesgoApi, exportApi } from '../services/api'
import { formatDate, isLoanOverdue, formatCurrency } from '../utils/helpers'

// ---------------------------------------------------------------------------
// Badge de riesgo
// ---------------------------------------------------------------------------
function RiskBadge({ level, score }) {
  if (!level) return null
  const colors = {
    BAJO: 'bg-green-100 text-green-800 border-green-300',
    MEDIO: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    ALTO: 'bg-red-100 text-red-800 border-red-300',
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-semibold ${colors[level] || 'bg-gray-100 text-gray-700'}`}>
      {level === 'BAJO' ? '🟢' : level === 'MEDIO' ? '🟡' : '🔴'} {level} ({score}/100)
    </span>
  )
}

// ---------------------------------------------------------------------------
// Panel de historial de pagos de un préstamo
// ---------------------------------------------------------------------------
function HistorialPanel({ loan, clients, onClose }) {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)

  const clientName = clients.find((c) => c.id === loan.client_id)?.name || `Cliente #${loan.client_id}`
  const progreso = loan.initial_capital > 0
    ? Math.round(((loan.initial_capital - loan.outstanding_balance) / loan.initial_capital) * 100)
    : 0

  useEffect(() => {
    pagosApi.listar(loan.id)
      .then(setPayments)
      .catch(() => setPayments([]))
      .finally(() => setLoading(false))
  }, [loan.id])

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-40 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-screen w-full max-w-lg bg-white shadow-xl z-50 overflow-y-auto">
        <div className="sticky top-0 bg-navy-700 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Historial de Pagos</h2>
            <p className="text-blue-200 text-sm">{clientName}</p>
          </div>
          <button onClick={onClose} className="text-white hover:bg-navy-600 p-2 rounded">✕</button>
        </div>

        <div className="p-6 space-y-6">
          {/* Resumen del préstamo */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3 border border-gray-200">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Capital inicial</span>
              <span className="font-semibold font-mono">{formatCurrency(loan.initial_capital)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Saldo pendiente</span>
              <span className="font-semibold font-mono text-orange-700">{formatCurrency(loan.outstanding_balance)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Recuperado</span>
              <span className="font-semibold font-mono text-green-700">{formatCurrency(loan.initial_capital - loan.outstanding_balance)}</span>
            </div>
            {/* Barra de progreso */}
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Progreso de amortización</span>
                <span>{progreso}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all"
                  style={{ width: `${progreso}%` }}
                />
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Vencimiento</span>
              <span className={`font-semibold ${isLoanOverdue(loan.due_date, loan.status) ? 'text-red-700' : 'text-gray-700'}`}>
                {formatDate(loan.due_date)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Estado</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${loan.status === 'ACTIVO' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                {loan.status}
              </span>
            </div>
          </div>

          {/* Tabla de pagos */}
          <div>
            <h3 className="font-semibold text-navy-900 mb-3">
              Pagos registrados ({payments.length})
            </h3>
            {loading ? (
              <p className="text-gray-500 text-sm text-center py-4">Cargando...</p>
            ) : payments.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8 bg-gray-50 rounded-lg">
                Sin pagos registrados aún
              </p>
            ) : (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100 text-gray-700">
                      <th className="px-3 py-2 text-left">Fecha</th>
                      <th className="px-3 py-2 text-right">Recibido</th>
                      <th className="px-3 py-2 text-right">Capital</th>
                      <th className="px-3 py-2 text-right">Interés</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id} className="border-t border-gray-200 hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-600">{formatDate(p.payment_date)}</td>
                        <td className="px-3 py-2 text-right font-mono font-semibold">{formatCurrency(p.amount_received)}</td>
                        <td className="px-3 py-2 text-right font-mono text-green-700">{formatCurrency(p.principal_payment)}</td>
                        <td className="px-3 py-2 text-right font-mono text-yellow-700">{formatCurrency(p.interest_payment)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 border-t-2 border-gray-300 font-semibold">
                      <td className="px-3 py-2 text-gray-700">Total</td>
                      <td className="px-3 py-2 text-right font-mono">{formatCurrency(payments.reduce((s, p) => s + p.amount_received, 0))}</td>
                      <td className="px-3 py-2 text-right font-mono text-green-700">{formatCurrency(payments.reduce((s, p) => s + p.principal_payment, 0))}</td>
                      <td className="px-3 py-2 text-right font-mono text-yellow-700">{formatCurrency(payments.reduce((s, p) => s + p.interest_payment, 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Formulario de nuevo préstamo con score de riesgo
// ---------------------------------------------------------------------------
function NuevoPrestamo({ clients, onSubmit, onCancel, saving }) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    client_id: '',
    initial_capital: '',
    monthly_rate: '',      // lo que el usuario escribe siempre
    rate_mode: 'monthly',  // 'monthly' | 'annual'
    modality_days: '',
    advisor: '',
    delivery_date: today,
  })
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [preview, setPreview] = useState(null)
  const [risk, setRisk] = useState(null)
  const [riskLoading, setRiskLoading] = useState(false)

  // Calcula la tasa anual a partir de lo que el usuario escribió
  const getAnnualRate = () => {
    const r = parseFloat(form.monthly_rate)
    if (isNaN(r) || r <= 0) return null
    if (form.rate_mode === 'monthly') {
      // tasa anual efectiva = (1 + mensual)^12 - 1
      return (Math.pow(1 + r / 100, 12) - 1) * 100
    }
    return r // ya es anual
  }

  // La tasa que se usa para calcular interés del préstamo (la que escribe el usuario, siempre)
  const getEffectiveRate = () => {
    const r = parseFloat(form.monthly_rate)
    if (isNaN(r) || r <= 0) return null
    return r / 100
  }

  // Vista previa financiera
  useEffect(() => {
    const capital = parseFloat(form.initial_capital) || 0
    const rate = getEffectiveRate()
    const days = parseInt(form.modality_days) || 0
    if (capital > 0 && rate && rate > 0 && days > 0 && form.delivery_date) {
      const due = new Date(form.delivery_date)
      due.setDate(due.getDate() + days)
      setPreview({
        capital,
        interest: capital * rate,
        total: capital + capital * rate,
        due_date: due.toISOString().split('T')[0],
        days,
        annual: getAnnualRate(),
      })
    } else {
      setPreview(null)
    }
  }, [form])

  // Score de riesgo IA
  const evaluateRisk = useCallback(async () => {
    const days = parseInt(form.modality_days)
    const rate = getEffectiveRate()
    if (!days || !rate || ![10, 15, 25, 31].includes(days)) {
      setRisk(null)
      return
    }
    setRiskLoading(true)
    try {
      const result = await riesgoApi.evaluar({
        modality_days: days,
        interest_rate: rate,
        client_payment_history_score: 0.5,
      })
      setRisk(result)
    } catch {
      setRisk(null)
    } finally {
      setRiskLoading(false)
    }
  }, [form.modality_days, form.monthly_rate, form.rate_mode])

  useEffect(() => {
    const timer = setTimeout(evaluateRisk, 600)
    return () => clearTimeout(timer)
  }, [evaluateRisk])

  const validate = (f) => {
    const e = {}
    if (!f.client_id) e.client_id = 'Selecciona un cliente'

    const cap = parseFloat(f.initial_capital)
    if (!f.initial_capital || f.initial_capital.toString().trim() === '') {
      e.initial_capital = 'El capital es requerido'
    } else if (isNaN(cap) || cap <= 0) {
      e.initial_capital = 'Capital debe ser mayor a 0'
    }

    const rate = parseFloat(f.monthly_rate)
    if (!f.monthly_rate || f.monthly_rate.toString().trim() === '') {
      e.monthly_rate = 'La tasa es requerida'
    } else if (isNaN(rate) || rate <= 0 || rate > 100) {
      e.monthly_rate = 'Tasa entre 0.1% y 100%'
    }

    const days = parseInt(f.modality_days)
    if (!f.modality_days || isNaN(days) || days <= 0) e.modality_days = 'Días debe ser mayor a 0'
    if (!f.advisor.trim()) e.advisor = 'Requerido'
    if (!f.delivery_date) e.delivery_date = 'Requerido'
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
    setTouched(Object.fromEntries(Object.keys(form).map((k) => [k, true])))
    const errs = validate(form)
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    const capital = parseFloat(form.initial_capital)
    const rate = getEffectiveRate()
    const days = parseInt(form.modality_days)
    const due = new Date(form.delivery_date)
    due.setDate(due.getDate() + days)

    onSubmit({
      client_id: parseInt(form.client_id),
      initial_capital: capital,
      interest_rate: rate,
      modality_days: days,
      outstanding_balance: capital,
      status: 'ACTIVO',
      advisor: form.advisor.trim().charAt(0).toUpperCase(),
      delivery_date: form.delivery_date,
      due_date: due.toISOString().split('T')[0],
    })
  }

  const annualRate = getAnnualRate()
  const fieldCls = (name) =>
    `w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
      touched[name] && errors[name]
        ? 'border-red-400 focus:ring-red-400 bg-red-50'
        : 'border-gray-300 focus:ring-blue-500'
    }`

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* Cliente */}
      <div>
        <label className="block text-sm font-medium text-navy-900 mb-1">Cliente *</label>
        <select name="client_id" value={form.client_id} onChange={handleChange} onBlur={handleBlur} className={fieldCls('client_id')}>
          <option value="">-- Seleccionar --</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {touched.client_id && errors.client_id && <p className="text-red-600 text-xs mt-1">{errors.client_id}</p>}
      </div>

      {/* Capital — step="any" para aceptar cualquier número */}
      <div>
        <label className="block text-sm font-medium text-navy-900 mb-1">Capital a prestar ($) *</label>
        <input
          type="number"
          name="initial_capital"
          value={form.initial_capital}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="Ej: 500000"
          min="1"
          step="any"
          className={fieldCls('initial_capital')}
        />
        {touched.initial_capital && errors.initial_capital && <p className="text-red-600 text-xs mt-1">{errors.initial_capital}</p>}
      </div>

      {/* Tasa de interés con toggle mensual / anual */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-navy-900">
            Tasa de interés * &nbsp;
            <span className="text-gray-400 font-normal text-xs">
              ({form.rate_mode === 'monthly' ? 'mensual' : 'anual'})
            </span>
          </label>
          {/* Toggle */}
          <div className="flex rounded-lg overflow-hidden border border-gray-300 text-xs">
            <button
              type="button"
              onClick={() => setForm((p) => ({ ...p, rate_mode: 'monthly' }))}
              className={`px-3 py-1 transition-colors ${
                form.rate_mode === 'monthly'
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Mensual
            </button>
            <button
              type="button"
              onClick={() => setForm((p) => ({ ...p, rate_mode: 'annual' }))}
              className={`px-3 py-1 transition-colors ${
                form.rate_mode === 'annual'
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Anual
            </button>
          </div>
        </div>

        <div className="flex gap-2 items-center">
          <input
            type="number"
            name="monthly_rate"
            value={form.monthly_rate}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder={form.rate_mode === 'monthly' ? 'Ej: 20' : 'Ej: 240'}
            min="0.01"
            max="100"
            step="any"
            className={`flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
              touched.monthly_rate && errors.monthly_rate
                ? 'border-red-400 focus:ring-red-400 bg-red-50'
                : 'border-gray-300 focus:ring-blue-500'
            }`}
          />
          <span className="text-gray-500 text-sm font-medium">%</span>
        </div>

        {/* Conversión automática */}
        {form.rate_mode === 'monthly' && annualRate && (
          <p className="text-blue-700 text-xs mt-1 bg-blue-50 rounded px-2 py-1">
            Equivale a <strong>{annualRate.toFixed(2)}% anual efectivo</strong> ((1 + {form.monthly_rate}%)¹² − 1)
          </p>
        )}
        {form.rate_mode === 'annual' && annualRate && (
          <p className="text-blue-700 text-xs mt-1 bg-blue-50 rounded px-2 py-1">
            Equivale a <strong>{((Math.pow(1 + annualRate / 100, 1/12) - 1) * 100).toFixed(3)}% mensual efectivo</strong>
          </p>
        )}

        {touched.monthly_rate && errors.monthly_rate && <p className="text-red-600 text-xs mt-1">{errors.monthly_rate}</p>}
      </div>

      {/* Días y fecha */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-sm font-medium text-navy-900 mb-1">Días del préstamo *</label>
          <input
            type="number"
            name="modality_days"
            value={form.modality_days}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Ej: 31"
            min="1"
            step="1"
            className={fieldCls('modality_days')}
          />
          {touched.modality_days && errors.modality_days && <p className="text-red-600 text-xs mt-1">{errors.modality_days}</p>}
        </div>
        <div className="w-24">
          <label className="block text-sm font-medium text-navy-900 mb-1">Asesor *</label>
          <input
            type="text"
            name="advisor"
            value={form.advisor}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="S"
            maxLength={1}
            className={fieldCls('advisor')}
          />
          {touched.advisor && errors.advisor && <p className="text-red-600 text-xs mt-1">{errors.advisor}</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-navy-900 mb-1">Fecha de entrega *</label>
        <input
          type="date"
          name="delivery_date"
          value={form.delivery_date}
          onChange={handleChange}
          onBlur={handleBlur}
          className={fieldCls('delivery_date')}
        />
        {touched.delivery_date && errors.delivery_date && <p className="text-red-600 text-xs mt-1">{errors.delivery_date}</p>}
      </div>

      {/* Score de riesgo IA */}
      {riskLoading && <div className="text-center text-sm text-gray-500 py-2">Evaluando riesgo...</div>}
      {risk && !riskLoading && (
        <div className={`rounded-lg p-3 border text-sm space-y-1 ${
          risk.risk_level === 'BAJO' ? 'bg-green-50 border-green-200' :
          risk.risk_level === 'MEDIO' ? 'bg-yellow-50 border-yellow-200' :
          'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center justify-between">
            <span className="font-semibold text-gray-800">Score de riesgo IA</span>
            <RiskBadge level={risk.risk_level} score={risk.risk_score} />
          </div>
          <p className="text-gray-600 text-xs">{risk.recommendation}</p>
          <p className="text-gray-400 text-xs">Probabilidad de mora: {(risk.probability * 100).toFixed(1)}%</p>
        </div>
      )}
      {!risk && !riskLoading && form.modality_days && ![10, 15, 25, 31].includes(parseInt(form.modality_days)) && (
        <p className="text-yellow-700 text-xs bg-yellow-50 border border-yellow-200 rounded p-2">
          El score de riesgo IA solo aplica para modalidades de 10, 15, 25 o 31 días exactos.
        </p>
      )}

      {/* Vista previa financiera */}
      {preview && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2 text-sm">
          <p className="font-semibold text-blue-900">Vista previa</p>
          <div className="flex justify-between text-blue-800">
            <span>Capital:</span>
            <span className="font-mono">{formatCurrency(preview.capital)}</span>
          </div>
          <div className="flex justify-between text-blue-800">
            <span>Interés ({form.monthly_rate}% {form.rate_mode === 'monthly' ? 'mensual' : 'anual'}):</span>
            <span className="font-mono">+{formatCurrency(preview.interest)}</span>
          </div>
          <div className="flex justify-between font-bold text-blue-900 border-t border-blue-300 pt-2">
            <span>Total a pagar:</span>
            <span className="font-mono">{formatCurrency(preview.total)}</span>
          </div>
          <div className="flex justify-between text-blue-700">
            <span>Vence:</span>
            <span>{formatDate(preview.due_date)} ({preview.days} días)</span>
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-4 border-t border-gray-200">
        <button type="button" onClick={onCancel} disabled={saving}
          className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
          Cancelar
        </button>
        <button type="submit" disabled={saving}
          className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white ${saving ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
          {saving ? 'Guardando...' : 'Registrar Préstamo'}
        </button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------
export default function PrestamosPage() {
  const [loans, setLoans] = useState([])
  const [clients, setClients] = useState([])
  const [panelOpen, setPanelOpen] = useState(false)
  const [historialLoan, setHistorialLoan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [filterStatus, setFilterStatus] = useState('TODOS')

  useEffect(() => {
    const load = async () => {
      try {
        const [loansData, clientsData] = await Promise.all([
          prestamosApi.listar(),
          clientesApi.listar(),
        ])
        setLoans(loansData)
        setClients(clientsData)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleCrear = async (payload) => {
    setSaving(true)
    try {
      const nuevo = await prestamosApi.crear(payload)
      setLoans((prev) => [nuevo, ...prev])
      setPanelOpen(false)
    } catch (err) {
      alert(`No se pudo registrar el préstamo: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const getClientName = (clientId) => {
    const c = clients.find((c) => c.id === clientId)
    return c ? c.name : `Cliente #${clientId}`
  }

  const filteredLoans = filterStatus === 'TODOS' ? loans : loans.filter((l) => l.status === filterStatus)

  const totals = {
    activos: loans.filter((l) => l.status === 'ACTIVO').length,
    cartera: loans.filter((l) => l.status === 'ACTIVO').reduce((s, l) => s + l.outstanding_balance, 0),
  }

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="text-navy-700 text-lg">Cargando préstamos...</div></div>
  }
  if (error) {
    return <div className="flex items-center justify-center h-96"><div className="bg-red-50 border border-red-300 rounded-lg p-6 text-center"><p className="text-red-700 font-semibold">{error}</p></div></div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-navy-900">Gestión de Préstamos</h1>
          <p className="text-gray-600 mt-1">
            <span className="font-semibold text-navy-700">{totals.activos}</span> activos ·{' '}
            <span className="font-semibold text-navy-700">{formatCurrency(totals.cartera)}</span> en cartera
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => exportApi.prestamos()}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-gray-300"
            title="Exportar a CSV"
          >
            ↓ CSV
          </button>
          <button
            onClick={() => setPanelOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-md"
          >
            + Nuevo Préstamo
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        {['TODOS', 'ACTIVO', 'INACTIVO'].map((s) => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterStatus === s ? 'bg-navy-700 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Tabla */}
      {filteredLoans.length === 0 ? (
        <div className="bg-white rounded-lg shadow-lg p-12 text-center">
          <p className="text-gray-500 text-lg mb-2">No hay préstamos registrados</p>
          <p className="text-gray-400 text-sm">Crea el primero con &ldquo;+ Nuevo Préstamo&rdquo;</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-navy-700 text-white text-sm font-semibold">
                  <th className="px-4 py-4 text-left">Cliente</th>
                  <th className="px-4 py-4 text-right">Capital</th>
                  <th className="px-4 py-4 text-center">Tasa</th>
                  <th className="px-4 py-4 text-center">Días</th>
                  <th className="px-4 py-4 text-right">Saldo</th>
                  <th className="px-4 py-4 text-center">Vence</th>
                  <th className="px-4 py-4 text-center">Estado</th>
                  <th className="px-4 py-4 text-center">Pagos</th>
                </tr>
              </thead>
              <tbody>
                {filteredLoans.map((loan) => {
                  const overdue = isLoanOverdue(loan.due_date, loan.status)
                  return (
                    <tr key={loan.id}
                      className={`border-b border-gray-200 transition-colors ${overdue ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}`}
                    >
                      <td className="px-4 py-3 font-medium text-navy-900">{getClientName(loan.client_id)}</td>
                      <td className="px-4 py-3 text-right text-navy-700 font-mono text-sm">{formatCurrency(loan.initial_capital)}</td>
                      <td className="px-4 py-3 text-center text-navy-700">{(loan.interest_rate * 100).toFixed(0)}%</td>
                      <td className="px-4 py-3 text-center text-navy-700">{loan.modality_days}</td>
                      <td className="px-4 py-3 text-right font-semibold text-navy-900 font-mono text-sm">{formatCurrency(loan.outstanding_balance)}</td>
                      <td className="px-4 py-3 text-center text-sm">
                        <span className={overdue ? 'text-red-700 font-semibold' : 'text-gray-600'}>{formatDate(loan.due_date)}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${loan.status === 'ACTIVO' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                          {loan.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setHistorialLoan(loan)}
                          className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                        >
                          Ver
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Panel nuevo préstamo */}
      {panelOpen && (
        <>
          <div className="fixed inset-0 bg-black bg-opacity-40 z-40" onClick={() => setPanelOpen(false)} />
          <div className="fixed right-0 top-0 h-screen w-full max-w-md bg-white shadow-xl z-50 overflow-y-auto">
            <div className="sticky top-0 bg-navy-700 text-white px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Nuevo Préstamo</h2>
              <button onClick={() => setPanelOpen(false)} className="text-white hover:bg-navy-600 p-2 rounded">✕</button>
            </div>
            <div className="p-6">
              <NuevoPrestamo clients={clients} onSubmit={handleCrear} onCancel={() => setPanelOpen(false)} saving={saving} />
            </div>
          </div>
        </>
      )}

      {/* Panel historial de pagos */}
      {historialLoan && (
        <HistorialPanel
          loan={historialLoan}
          clients={clients}
          onClose={() => setHistorialLoan(null)}
        />
      )}
    </div>
  )
}
