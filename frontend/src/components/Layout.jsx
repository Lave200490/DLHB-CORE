/**
 * Componente Layout: Envuelve todas las páginas con navegación y estructura principal.
 * Incluye Sidebar con navegación y contenido principal responsivo.
 */

import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const location = useLocation()

  const navItems = [
    { path: '/dashboard', label: '📊 Dashboard', icon: '📊' },
    { path: '/clientes', label: '👥 Clientes', icon: '👥' },
    { path: '/prestamos', label: '💰 Préstamos', icon: '💰' },
    { path: '/pagos', label: '💳 Pagos', icon: '💳' },
  ]

  const isActive = (path) => location.pathname === path

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside
        className={`bg-navy-900 text-white transition-all duration-300 ${
          sidebarOpen ? 'w-64' : 'w-20'
        } fixed h-screen flex flex-col shadow-xl z-40`}
      >
        {/* Logo/Header */}
        <div className="bg-navy-800 px-6 py-6 border-b border-navy-700">
          <div className="flex items-center justify-between">
            {sidebarOpen && (
              <div>
                <h1 className="text-xl font-bold text-white">DLHB</h1>
                <p className="text-xs text-navy-200">Core v0.1.0</p>
              </div>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-navy-300 hover:text-white transition-colors p-1 rounded hover:bg-navy-700"
              title={sidebarOpen ? 'Ocultar' : 'Mostrar'}
            >
              {sidebarOpen ? '◀' : '▶'}
            </button>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-6 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                isActive(item.path)
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-navy-200 hover:bg-navy-700 hover:text-white'
              }`}
              title={!sidebarOpen ? item.label : ''}
            >
              <span className="text-xl">{item.icon}</span>
              {sidebarOpen && (
                <span className="font-medium">{item.label.split(' ').pop()}</span>
              )}
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-navy-700 px-3 py-4">
          <div className="text-navy-400 text-xs text-center">
            {sidebarOpen && (
              <>
                <p>© 2026</p>
                <p>DLHB Core</p>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-20'}`}>
        {/* Top Navigation Bar */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="text-navy-700 hover:bg-gray-100 p-2 rounded transition-colors md:hidden"
              >
                ☰
              </button>
              <h2 className="text-xl font-bold text-navy-900">
                {navItems.find((item) => isActive(item.path))?.label || 'DLHB Core'}
              </h2>
            </div>
            <div className="flex items-center gap-4">
              <button className="text-navy-600 hover:text-navy-900 text-lg">
                🔔
              </button>
              <button className="text-navy-600 hover:text-navy-900 text-lg">
                👤
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
