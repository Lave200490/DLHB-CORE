/**
 * Pagina de Dashboard: Resumen de metricas y prestamos activos.
 * Datos obtenidos desde la API real.
 */

import { useState, useEffect } from 'react'
import Card from '../components/Card'
import LoansTable from '../components/LoansTable'
import { prestamosApi } from '../services/api'
import { formatCurrency } from '../utils/helpers'

function DollarIcon() { return (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
) }

function TrendingUpIcon() { return (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
) }

function LoanIcon() { return (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
) }

/**
 * Calcula las metricas del dashboard a partir de la lista de prestamos.
 */
function calcularMetricas(loans) {
  const activos = loans.filter((l) => l.status === 'ACTIVO')

  // Capital en la calle: suma de saldos pendientes de prestamos activos
  const capitalOutstanding = activos.reduce((sum, l) => sum + l.outstanding_balance, 0)

  // Capital recuperado: suma de (capital_inicial - saldo_pendiente) de todos
  const capitalRecovered = loans.reduce(
    (sum, l) => sum + (l.initial_capital - l.outstanding_balance),
    0
  )

  // Ganancias estimadas: suma de intereses generados (capital_inicial * tasa)
  const monthlyEarnings = loans.reduce(
    (sum, l) => sum + l.initial_capital * l.interest_rate,
    0
  )

  return { capitalOutstanding, capitalRecovered, monthlyEarnings }
}

export default function DashboardPage() {
  const [loans, setLoans] = useState([])
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const load = async () => {
      try {
        const allLoans = await prestamosApi.listar()
        const activeLoans = allLoans.filter((l) => l.status === 'ACTIVO')
        setLoans(activeLoans)
        setMetrics(calcularMetricas(allLoans))
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-navy-700 text-lg font-medium">Cargando datos...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="bg-red-50 border border-red-300 rounded-lg p-6 max-w-md text-center">
          <p className="text-red-700 font-semibold mb-1">No se pudo conectar con el servidor</p>
          <p className="text-red-600 text-sm">{error}</p>
          <p className="text-gray-500 text-xs mt-3">
            Asegurate de que el backend este corriendo en http://localhost:8000
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Metricas */}
      <section>
        <h2 className="text-2xl font-bold text-navy-900 mb-6">Resumen General</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card
            title="Ganancias Estimadas"
            value={formatCurrency(metrics.monthlyEarnings)}
            icon={DollarIcon}
            bgColor="bg-navy-600"
          />
          <Card
            title="Capital Recuperado"
            value={formatCurrency(metrics.capitalRecovered)}
            icon={TrendingUpIcon}
            bgColor="bg-navy-500"
          />
          <Card
            title="Capital en la Calle"
            value={formatCurrency(metrics.capitalOutstanding)}
            icon={LoanIcon}
            bgColor="bg-navy-700"
          />
        </div>
      </section>

      {/* Prestamos activos */}
      <section>
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-navy-900 mb-2">Prestamos Activos</h2>
          <p className="text-gray-600">
            Total en cartera:{' '}
            <span className="font-semibold text-navy-700">{loans.length}</span>
          </p>
        </div>

        {loans.length > 0 ? (
          <LoansTable loans={loans} />
        ) : (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <p className="text-gray-500 text-lg">No hay prestamos activos en este momento.</p>
            <p className="text-gray-400 text-sm mt-2">
              Registra clientes y prestamos desde las secciones correspondientes.
            </p>
          </div>
        )}
      </section>

      <section className="p-4 bg-blue-50 border-l-4 border-blue-400 rounded">
        <p className="text-sm text-blue-800">
          <span className="font-semibold">Nota:</span>{' '}
          Las filas resaltadas en rojo indican prestamos que han excedido su fecha de vencimiento.
        </p>
      </section>
    </div>
  )
}