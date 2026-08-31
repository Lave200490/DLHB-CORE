/**
 * Componente ClientSlideOver: Panel lateral (Slide-over) para crear/editar clientes.
 * Se abre desde la derecha y se cierra al hacer clic fuera o presionar escape.
 */

import { useEffect } from 'react'
import ClientForm from './ClientForm'

export default function ClientSlideOver({ isOpen, client, onClose, onSubmit }) {
  // Cerrar al presionar ESC
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <>
      {/* Overlay de fondo */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel lateral */}
      <div
        className={`fixed right-0 top-0 h-screen w-full max-w-md bg-white shadow-xl z-50 overflow-y-auto transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="sticky top-0 bg-navy-700 text-white px-6 py-4 border-b border-navy-600 flex items-center justify-between">
          <h2 className="text-xl font-bold">
            {client ? '✏️ Editar Cliente' : '➕ Nuevo Cliente'}
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-navy-600 p-2 rounded transition-colors"
            title="Cerrar (ESC)"
          >
            ✕
          </button>
        </div>

        {/* Contenido */}
        <div className="p-6">
          <ClientForm
            client={client}
            onSubmit={(formData) => {
              onSubmit(formData)
              onClose()
            }}
            onCancel={onClose}
          />
        </div>

        {/* Footer con tip */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 text-xs text-gray-600 sticky bottom-0">
          💡 Presiona <kbd className="bg-white px-2 py-1 rounded border">ESC</kbd> para cerrar
        </div>
      </div>
    </>
  )
}
