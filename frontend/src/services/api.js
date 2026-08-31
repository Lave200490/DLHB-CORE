/**
 * Capa de servicios HTTP centralizada.
 * El proxy de Vite reescribe /api → http://localhost:8000
 */

const BASE_URL = '/api'

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })

  if (!response.ok) {
    let detail = `Error ${response.status}`
    try {
      const body = await response.json()
      detail = body.detail || detail
    } catch (_) {}
    throw new Error(detail)
  }

  if (response.status === 204) return null
  return response.json()
}

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------

export const clientesApi = {
  listar: () => request('/clients/'),
  obtener: (id) => request(`/clients/${id}`),
  crear: (data) => request('/clients/', { method: 'POST', body: JSON.stringify(data) }),
  actualizar: (id, data) => request(`/clients/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  eliminar: (id) => request(`/clients/${id}`, { method: 'DELETE' }),
}

// ---------------------------------------------------------------------------
// Préstamos
// ---------------------------------------------------------------------------

export const prestamosApi = {
  listar: () => request('/loans/'),
  obtener: (id) => request(`/loans/${id}`),
  crear: (data) => request('/loans/', { method: 'POST', body: JSON.stringify(data) }),
  actualizar: (id, data) => request(`/loans/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  eliminar: (id) => request(`/loans/${id}`, { method: 'DELETE' }),
}

// ---------------------------------------------------------------------------
// Pagos
// ---------------------------------------------------------------------------

export const pagosApi = {
  listar: (loanId = null) => {
    const qs = loanId != null ? `?loan_id=${loanId}` : ''
    return request(`/payments/${qs}`)
  },
  registrar: (data) => request('/pagos/registrar', { method: 'POST', body: JSON.stringify(data) }),
}

// ---------------------------------------------------------------------------
// Riesgo IA
// ---------------------------------------------------------------------------

export const riesgoApi = {
  evaluar: (data) => request('/riesgo/evaluar', { method: 'POST', body: JSON.stringify(data) }),
}

// ---------------------------------------------------------------------------
// Exportación CSV (descarga directa — no usa fetch, usa window.location)
// ---------------------------------------------------------------------------

export const exportApi = {
  prestamos: () => {
    window.open(`${BASE_URL}/export/loans`, '_blank')
  },
  pagos: () => {
    window.open(`${BASE_URL}/export/payments`, '_blank')
  },
}
