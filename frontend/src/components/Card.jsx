/**
 * Componente Card: tarjeta de resumen con título, valor e icono.
 */

export default function Card({ title, value, icon: Icon, bgColor = "bg-navy-500" }) {
  return (
    <div className={`${bgColor} rounded-lg shadow-lg p-6 text-white`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white/80 mb-1">{title}</p>
          <p className="text-3xl font-bold">{value}</p>
        </div>
        {Icon && (
          <div className="text-5xl opacity-30">
            <Icon />
          </div>
        )}
      </div>
    </div>
  )
}
