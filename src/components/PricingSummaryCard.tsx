interface PricingSummaryCardProps {
  baseFee: number
  costPerKm: number
  costPerKg: number
  distanceKm?: number
  weightKg?: number
}

export default function PricingSummaryCard({
  baseFee, costPerKm, costPerKg, distanceKm = 0, weightKg = 0
}: PricingSummaryCardProps) {
  const total = baseFee + distanceKm * costPerKm + weightKg * costPerKg

  return (
    <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
      <h3 className="font-bold text-gray-800 mb-4">💰 Pricing Breakdown</h3>
      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Base Fee</span>
          <span className="font-medium">${baseFee.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Distance ({distanceKm.toFixed(1)} km × ${costPerKm}/km)</span>
          <span className="font-medium">${(distanceKm * costPerKm).toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Weight ({weightKg.toFixed(1)} kg × ${costPerKg}/kg)</span>
          <span className="font-medium">${(weightKg * costPerKg).toFixed(2)}</span>
        </div>
        <div className="border-t pt-3 flex justify-between">
          <span className="font-bold text-gray-800">Total</span>
          <span className="font-bold text-primary text-lg">${total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  )
}
