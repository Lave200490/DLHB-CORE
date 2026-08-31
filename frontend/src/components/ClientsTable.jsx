/**
 * ClientsTable: tabla de clientes con acciones editar y eliminar.
 */

export default function ClientsTable({ clients, onEdit, onDelete }) {
  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-navy-700 text-white text-sm font-semibold">
              <th className="px-6 py-4 text-left">ID</th>
              <th className="px-6 py-4 text-left">Nombre</th>
              <th className="px-6 py-4 text-left">Teléfono</th>
              <th className="px-6 py-4 text-center">Préstamos</th>
              <th className="px-6 py-4 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                  No hay clientes registrados
                </td>
              </tr>
            ) : (
              clients.map((client) => (
                <tr
                  key={client.id}
                  className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4 text-gray-400 text-sm font-mono">#{client.id}</td>
                  <td className="px-6 py-4 font-medium text-navy-900">{client.name}</td>
                  <td className="px-6 py-4 text-navy-700">{client.phone}</td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-800 text-sm font-semibold">
                      {client.loans ? client.loans.length : 0}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center space-x-3">
                    <button
                      onClick={() => onEdit(client)}
                      className="text-blue-600 hover:text-blue-900 font-medium text-sm"
                    >
                      Editar
                    </button>
                    {onDelete && (
                      <button
                        onClick={() => onDelete(client.id)}
                        className="text-red-500 hover:text-red-800 font-medium text-sm"
                      >
                        Eliminar
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
