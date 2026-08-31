/**
 * ClientesPage: Gestión completa de clientes — crear, editar, eliminar.
 */

import { useState, useEffect } from 'react'
import ClientsTable from '../components/ClientsTable'
import ClientSlideOver from '../components/ClientSlideOver'
import { clientesApi } from '../services/api'

export default function ClientesPage() {
  const [clients, setClients] = useState([])
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const data = await clientesApi.listar()
        setClients(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filteredClients = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm)
  )

  const handleOpenSlideOver = (client = null) => {
    setSelectedClient(client)
    setIsSlideOverOpen(true)
  }

  const handleCloseSlideOver = () => {
    setSelectedClient(null)
    setIsSlideOverOpen(false)
  }

  const handleSaveClient = async (formData) => {
    setSaving(true)
    try {
      if (selectedClient) {
        // Editar cliente existente
        const updated = await clientesApi.actualizar(selectedClient.id, formData)
        setClients((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      } else {
        // Crear nuevo cliente
        const nuevo = await clientesApi.crear(formData)
        setClients((prev) => [nuevo, ...prev])
      }
      handleCloseSlideOver()
    } catch (err) {
      alert(`No se pudo guardar el cliente: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteClient = async (id) => {
    const client = clients.find((c) => c.id === id)
    const name = client ? client.name : `#${id}`
    if (!window.confirm(`¿Eliminar a ${name}? Esta acción eliminará también sus préstamos y pagos.`)) return
    try {
      await clientesApi.eliminar(id)
      setClients((prev) => prev.filter((c) => c.id !== id))
    } catch (err) {
      alert(`No se pudo eliminar el cliente: ${err.message}`)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-navy-700 text-lg font-medium">Cargando clientes...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="bg-red-50 border border-red-300 rounded-lg p-6 max-w-md text-center">
          <p className="text-red-700 font-semibold mb-1">No se pudo conectar con el servidor</p>
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-navy-900">Gestión de Clientes</h1>
          <p className="text-gray-600 mt-1">
            Total:{' '}
            <span className="font-semibold text-navy-700">{clients.length}</span> clientes
          </p>
        </div>
        <button
          onClick={() => handleOpenSlideOver()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-md"
        >
          + Nuevo Cliente
        </button>
      </div>

      {/* Búsqueda */}
      <div className="bg-white rounded-lg shadow p-4">
        <input
          type="text"
          placeholder="Buscar por nombre o teléfono..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Tabla */}
      {filteredClients.length === 0 && clients.length > 0 ? (
        <div className="bg-white rounded-lg shadow-lg p-12 text-center">
          <p className="text-gray-500 text-lg">No se encontraron clientes con &quot;{searchTerm}&quot;</p>
        </div>
      ) : (
        <ClientsTable
          clients={filteredClients}
          onEdit={handleOpenSlideOver}
          onDelete={handleDeleteClient}
        />
      )}

      {/* Panel lateral */}
      <ClientSlideOver
        isOpen={isSlideOverOpen}
        client={selectedClient}
        onClose={handleCloseSlideOver}
        onSubmit={handleSaveClient}
        saving={saving}
      />
    </div>
  )
}
