'use client'

import { useEffect, useRef } from 'react'

interface Stop {
  id: string
  lat: number
  lng: number
  label: string
  status?: string
}

interface MapComponentProps {
  stops: Stop[]
  onStopClick?: (id: string) => void
}

export default function MapComponent({ stops, onStopClick }: MapComponentProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<unknown>(null)
  const markersRef = useRef<unknown[]>([])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const initMap = async () => {
      const L = (await import('leaflet')).default

      // Fix leaflet default icon
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      })

      if (!mapInstanceRef.current && mapRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mapInstanceRef.current = L.map(mapRef.current).setView([-23.5505, -46.6333], 11) as any
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }).addTo(mapInstanceRef.current as any)
      }

      // Clear existing markers
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(markersRef.current as any[]).forEach((m: any) => m.remove())
      markersRef.current = []

      // Add markers
      stops.forEach((stop, idx) => {
        const marker = L.marker([stop.lat, stop.lng])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .addTo(mapInstanceRef.current as any)
          .bindPopup(`<b>${idx + 1}. ${stop.label}</b>`)

        if (onStopClick) {
          marker.on('click', () => onStopClick(stop.id))
        }

        markersRef.current.push(marker)
      })

      // Draw route line
      if (stops.length > 1) {
        const latlngs = stops.map((s) => [s.lat, s.lng] as [number, number])
        const polyline = L.polyline(latlngs, { color: '#2563EB', weight: 3, opacity: 0.7 })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .addTo(mapInstanceRef.current as any)
        markersRef.current.push(polyline)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(mapInstanceRef.current as any).fitBounds(polyline.getBounds(), { padding: [20, 20] })
      } else if (stops.length === 1) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(mapInstanceRef.current as any).setView([stops[0].lat, stops[0].lng], 13)
      }
    }

    initMap()
  }, [stops, onStopClick])

  return (
    <div className="relative">
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/leaflet.min.css"
      />
      <div
        ref={mapRef}
        style={{ height: '400px', width: '100%', borderRadius: '12px', zIndex: 0 }}
      />
    </div>
  )
}
