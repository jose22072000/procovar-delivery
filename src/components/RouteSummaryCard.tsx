interface RouteSummaryCardProps {
  name: string
  status: string
  totalDistance: number
  totalWeight: number
  totalPrice: number
  orderCount: number
  onClick?: () => void
}

const statusColors: Record<string, string> = {
  planned: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
}

export default function RouteSummaryCard({
  name, status, totalDistance, totalWeight, totalPrice, orderCount, onClick
}: RouteSummaryCardProps) {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow border border-gray-100"
    >
      <div className="flex justify-between items-start mb-4">
        <h3 className="font-bold text-gray-800">{name}</h3>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[status] || 'bg-gray-100 text-gray-800'}`}>
          {status.replace('_', ' ')}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-500">Stops</p>
          <p className="font-semibold text-gray-800">{orderCount}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Distance</p>
          <p className="font-semibold text-gray-800">{totalDistance.toFixed(1)} km</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Weight</p>
          <p className="font-semibold text-gray-800">{totalWeight.toFixed(1)} kg</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Revenue</p>
          <p className="font-semibold text-secondary">${totalPrice.toFixed(2)}</p>
        </div>
      </div>
    </div>
  )
}
