import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import DashboardPage from './pages/DashboardPage'
import ClientesPage from './pages/ClientesPage'
import PrestamosPage from './pages/PrestamosPage'
import PagosPage from './pages/PagosPage'

function App() {
  return (
    <Router>
      <Routes>
        {/* Ruta raíz redirige a dashboard */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* Rutas con Layout */}
        <Route
          path="/dashboard"
          element={
            <Layout>
              <DashboardPage />
            </Layout>
          }
        />
        <Route
          path="/clientes"
          element={
            <Layout>
              <ClientesPage />
            </Layout>
          }
        />
        <Route
          path="/prestamos"
          element={
            <Layout>
              <PrestamosPage />
            </Layout>
          }
        />
        <Route
          path="/pagos"
          element={
            <Layout>
              <PagosPage />
            </Layout>
          }
        />

        {/* Ruta 404 */}
        <Route
          path="*"
          element={
            <Layout>
              <div className="text-center py-12">
                <h1 className="text-4xl font-bold text-navy-900 mb-4">404</h1>
                <p className="text-gray-600">Página no encontrada</p>
              </div>
            </Layout>
          }
        />
      </Routes>
    </Router>
  )
}

export default App
