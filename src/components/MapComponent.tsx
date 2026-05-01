'use client'

import { useEffect, useRef } from 'react'
import type { Map, Marker, Polyline } from 'leaflet'

interface Stop {
  id: string
  lat: number
  lng: number
  label: string
  status?: string
  stopType?: 'start' | 'end' | 'waypoint'
}

interface MapComponentProps {
  stops: Stop[]
  onStopClick?: (id: string) => void
  selectable?: boolean
  selectedPoint?: { lat: number; lng: number } | null
  onMapClick?: (point: { lat: number; lng: number }) => void
}

type MapLayer = Marker | Polyline

export default function MapComponent({ stops, onStopClick, selectable = false, selectedPoint = null, onMapClick }: MapComponentProps) {
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
        mapInstanceRef.current = L.map(mapRef.current, { attributionControl: false }).setView([-23.5505, -46.6333], 11)
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
        const isStart = stop.stopType === 'start'
        const isEnd = stop.stopType === 'end'
        const color = isStart ? '#16a34a' : isEnd ? '#dc2626' : '#2563eb'
        const letter = isStart ? 'A' : isEnd ? 'B' : String(idx + 1)
        const pinIcon = L.divIcon({
          html: `<div style="background:${color};color:white;width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2.5px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;"><span style="transform:rotate(45deg);font-size:12px;font-weight:bold;line-height:1;">${letter}</span></div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 30],
          popupAnchor: [0, -32],
          className: '',
        })

        const marker = L.marker([stop.lat, stop.lng], { icon: pinIcon })
          .addTo(mapInstanceRef.current!)
          .bindPopup(`<b>${stop.label}</b>`)

        if (onStopClick) {
          marker.on('click', () => onStopClick(stop.id))
        }

        markersRef.current.push(marker)
      })

      if (selectable && selectedPoint) {
        const selIcon = L.divIcon({
          html: `<div style="background:#f59e0b;color:white;width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2.5px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;"><span style="transform:rotate(45deg);font-size:14px;line-height:1;">★</span></div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 30],
          popupAnchor: [0, -32],
          className: '',
        })
        const selectedMarker = L.marker([selectedPoint.lat, selectedPoint.lng], { icon: selIcon })
          .addTo(mapInstanceRef.current)
          .bindPopup('<b>Ubicación seleccionada</b>')
        markersRef.current.push(selectedMarker)
      }

      // Draw route line using OSRM for road-following routes
      if (stops.length > 1) {
        const coords = stops.map((s) => `${s.lng},${s.lat}`).join(';')
        try {
          const res = await fetch(
            `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`
          )
          const json = await res.json()
          if (json.routes && json.routes[0]) {
            const geojsonCoords: [number, number][] = json.routes[0].geometry.coordinates.map(
              ([lng, lat]: [number, number]) => [lat, lng]
            )
            const polyline = L.polyline(geojsonCoords, { color: '#2563EB', weight: 4, opacity: 0.85 })
              .addTo(mapInstanceRef.current!)
            markersRef.current.push(polyline)
            mapInstanceRef.current!.fitBounds(polyline.getBounds(), { padding: [40, 40] })
          } else {
            // fallback straight line
            const latlngs = stops.map((s) => [s.lat, s.lng] as [number, number])
            const polyline = L.polyline(latlngs, { color: '#2563EB', weight: 3, opacity: 0.7 })
              .addTo(mapInstanceRef.current!)
            markersRef.current.push(polyline)
            mapInstanceRef.current!.fitBounds(polyline.getBounds(), { padding: [20, 20] })
          }
        } catch {
          // fallback straight line
          const latlngs = stops.map((s) => [s.lat, s.lng] as [number, number])
          const polyline = L.polyline(latlngs, { color: '#2563EB', weight: 3, opacity: 0.7 })
            .addTo(mapInstanceRef.current!)
          markersRef.current.push(polyline)
          mapInstanceRef.current!.fitBounds(polyline.getBounds(), { padding: [20, 20] })
        }
      } else if (stops.length === 1) {
        mapInstanceRef.current.setView([stops[0].lat, stops[0].lng], 13)
      } else if (selectedPoint) {
        mapInstanceRef.current.setView([selectedPoint.lat, selectedPoint.lng], 13)
      }

      mapInstanceRef.current.off('click')
      if (selectable && onMapClick) {
        mapInstanceRef.current.on('click', (event: { latlng: { lat: number; lng: number } }) => {
          onMapClick({ lat: event.latlng.lat, lng: event.latlng.lng })
        })
      }
    }

    initMap()
  }, [stops, onStopClick, selectable, selectedPoint, onMapClick])

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
