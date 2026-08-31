/**
 * LoansTable: tabla de prestamos.
 * Compatible con datos reales de la API (usa client_id, no client_name).
 */

import { formatDate, isLoanOverdue } from '../utils/helpers'

export default function LoansTable({ loans }) {
  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-navy-700 text-white text-sm font-semibold">
              <th className="px-6 py-4 text-left">Cliente</th>
              <th className="px-6 py-4 text-right">Capital</th>
              <th className="px-6 py-4 text-center">Tasa</th>
              <th className="px-6 py-4 text-center">Modalidad</th>
              <th className="px-6 py-4 text-right">Saldo Pendiente</th>
              <th className="px-6 py-4 text-center">Vencimiento</th>
              <th className="px-6 py-4 text-center">Estado</th>
            </tr>
          </thead>
          <tbody>
            {loans.map((loan) => {
              const isOverdue = isLoanOverdue(loan.due_date, loan.status)
              const rowClasses = isOverdue ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-navy-50'
              const clientLabel = loan.client_name || `Cliente #${loan.client_id}`

              return (
                <tr
                  key={loan.id}
                  className={`border-b border-gray-200 transition-colors ${rowClasses}`}
                >
                  <td className="px-6 py-4 font-medium text-navy-900">{clientLabel}</td>
                  <td className="px-6 py-4 text-right text-navy-700">
                    ${loan.initial_capital.toLocaleString('es-CO', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-6 py-4 text-center text-navy-700">
                    {(loan.interest_rate * 100).toFixed(0)}%
                  </td>
                  <td className="px-6 py-4 text-center text-navy-700">
                    {loan.modality_days} dias
                  </td>
                  <td className="px-6 py-4 text-right font-semibold text-navy-900">
                    ${loan.outstanding_balance.toLocaleString('es-CO', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-6 py-4 text-center text-sm">
                    <span className={isOverdue ? 'text-red-700 font-semibold' : 'text-gray-600'}>
                      {formatDate(loan.due_date)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        loan.status === 'ACTIVO'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {loan.status}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}