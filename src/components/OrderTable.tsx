'use client'

interface Order {
  id: string
  customerName: string
  address: string
  weight: number
  status: string
  price?: number | null
  createdAt: string
}

interface OrderTableProps {
  orders: Order[]
  onEdit?: (order: Order) => void
  onDelete?: (id: string) => void
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_transit: 'bg-blue-100 text-blue-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
}

export default function OrderTable({ orders, onEdit, onDelete }: OrderTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-3 px-4 font-semibold text-gray-600">Customer</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-600">Address</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-600">Weight</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-600">Status</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-600">Price</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-600">Actions</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="border-b hover:bg-gray-50 transition-colors">
              <td className="py-3 px-4 font-medium">{order.customerName}</td>
              <td className="py-3 px-4 text-gray-600 max-w-xs truncate">{order.address}</td>
              <td className="py-3 px-4 text-gray-600">{order.weight} kg</td>
              <td className="py-3 px-4">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[order.status] || 'bg-gray-100 text-gray-800'}`}>
                  {order.status.replace('_', ' ')}
                </span>
              </td>
              <td className="py-3 px-4 text-gray-600">
                {order.price ? `$${order.price.toFixed(2)}` : '-'}
              </td>
              <td className="py-3 px-4">
                <div className="flex gap-2">
                  {onEdit && (
                    <button
                      onClick={() => onEdit(order)}
                      className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                    >
                      Edit
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => onDelete(order.id)}
                      className="text-red-600 hover:text-red-800 text-xs font-medium"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {orders.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No orders found. Create your first order!
        </div>
      )}
    </div>
  )
}
