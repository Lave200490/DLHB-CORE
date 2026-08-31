/**
 * Dashboard principal para la administración de préstamos.
 * Incluye resumen de métricas y tabla de préstamos activos.
 */

import { useState, useEffect } from 'react'
import Card from '../components/Card'
import LoansTable from '../components/LoansTable'
import { mockLoans, mockMetrics } from '../data/mockData'
import { formatCurrency } from '../utils/helpers'

// Iconos simples como componentes
function DollarIcon() {
  return '💰'
}

function TrendingUpIcon() {
  return '📈'
}

function LoanIcon() {
  return '📊'
}

export default function Dashboard() {
  const [loans, setLoans] = useState([])
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)

  // Simulación de carga de datos desde la API
  useEffect(() => {
    const loadData = async () => {
      try {
        // Simular delay de red
        await new Promise((resolve) => setTimeout(resolve, 500))

        // Filtrar solo préstamos activos para la tabla principal
        const activeLoans = mockLoans.filter((loan) => loan.status === 'ACTIVO')
        setLoans(activeLoans)
        setMetrics(mockMetrics)
      } catch (error) {
        console.error('Error al cargar datos:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-navy-50">
        <div className="text-navy-700 text-lg font-medium">
          Cargando dashboard...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-navy-50">
      {/* Encabezado */}
      <header className="bg-navy-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">DLHB Core</h1>
            <span className="text-sm bg-navy-600 px-3 py-1 rounded-full">
              v0.1.0
            </span>
          </div>
          <p className="text-navy-100 mt-2">
            Sistema de Gestión de Préstamos de Capital
          </p>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Sección de resumen */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-navy-900 mb-6">
            Resumen del Mes
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card
              title="Ganancias del Mes"
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

        {/* Sección de préstamos activos */}
        <section>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-navy-900 mb-2">
              Préstamos Activos
            </h2>
            <p className="text-gray-600">
              Total de préstamos en cartera: <span className="font-semibold text-navy-700">{loans.length}</span>
            </p>
          </div>

          {loans.length > 0 ? (
            <LoansTable loans={loans} />
          ) : (
            <div className="bg-white rounded-lg shadow-lg p-12 text-center">
              <p className="text-gray-500 text-lg">
                No hay préstamos activos en este momento.
              </p>
            </div>
          )}
        </section>

        {/* Leyenda */}
        <section className="mt-8 p-4 bg-blue-50 border-l-4 border-blue-400 rounded">
          <p className="text-sm text-blue-800">
            <span className="font-semibold">💡 Nota:</span> Las filas resaltadas
            en rojo claro indican préstamos que han excedido su fecha de
            vencimiento y aún se encuentran en estado ACTIVO.
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-navy-900 text-navy-100 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-sm">
          <p>© 2026 DLHB Core. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  )
}
