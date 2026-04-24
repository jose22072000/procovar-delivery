'use client'

import { useEffect, useRef } from 'react'
import type { Map, Marker, Polyline } from 'leaflet'

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

type MapLayer = Marker | Polyline

export default function MapComponent({ stops, onStopClick }: MapComponentProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<Map | null>(null)
  const markersRef = useRef<MapLayer[]>([])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const initMap = async () => {
      const L = (await import('leaflet')).default

      // Fix leaflet default icon issue with webpack
      const iconPrototype = L.Icon.Default.prototype as L.Icon.Default & { _getIconUrl?: unknown }
      delete iconPrototype._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      })

      if (!mapInstanceRef.current && mapRef.current) {
        mapInstanceRef.current = L.map(mapRef.current).setView([-23.5505, -46.6333], 11)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
        }).addTo(mapInstanceRef.current)
      }

      // Clear existing markers
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []

      if (!mapInstanceRef.current) return

      // Add markers
      stops.forEach((stop, idx) => {
        const marker = L.marker([stop.lat, stop.lng])
          .addTo(mapInstanceRef.current!)
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
          .addTo(mapInstanceRef.current)
        markersRef.current.push(polyline)
        mapInstanceRef.current.fitBounds(polyline.getBounds(), { padding: [20, 20] })
      } else if (stops.length === 1) {
        mapInstanceRef.current.setView([stops[0].lat, stops[0].lng], 13)
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
