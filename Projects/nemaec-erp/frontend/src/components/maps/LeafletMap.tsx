/**
 * 🗺️ LEAFLET MAP - NEMAEC ERP
 * Mapa gratuito usando OpenStreetMap con Leaflet como dependencia npm
 */
import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// CSS personalizado para tooltips
const customTooltipStyles = `
  .custom-tooltip {
    background: none !important;
    border: none !important;
    box-shadow: none !important;
  }
  .custom-tooltip .leaflet-tooltip-content {
    margin: 0 !important;
    padding: 0 !important;
  }
  .leaflet-tooltip-top:before {
    border-top-color: rgba(31, 41, 55, 0.95) !important;
  }
`;

interface MapLocation {
  id: string;
  name: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  address: string;
  tipo?: string;
  estado?: string;
  foto_url?: string;
  comisaria?: any; // Para acceder a datos completos de la comisaría
}

interface LeafletMapProps {
  locations: MapLocation[];
  onLocationClick?: (location: MapLocation) => void;
  center?: { lat: number; lng: number };
  zoom?: number;
  className?: string;
}

// Fix for default markers in Leaflet - using only custom icons
delete (L.Icon.Default.prototype as any)._getIconUrl;

const LeafletMap: React.FC<LeafletMapProps> = ({
  locations,
  onLocationClick,
  center = { lat: -12.0464, lng: -77.0428 }, // Lima, Perú
  zoom = 11,
  className = "w-full h-96"
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  // Inicializar el mapa
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Inyectar estilos CSS personalizados
    if (!document.getElementById('custom-leaflet-styles')) {
      const styleElement = document.createElement('style');
      styleElement.id = 'custom-leaflet-styles';
      styleElement.textContent = customTooltipStyles;
      document.head.appendChild(styleElement);
    }

    try {
      // Crear el mapa
      const map = L.map(mapRef.current, {
        center: [center.lat, center.lng],
        zoom: zoom,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        boxZoom: true,
        touchZoom: true,
        zoomControl: true
      });

      // Agregar capa de OpenStreetMap
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
        crossOrigin: true
      }).addTo(map);

      mapInstanceRef.current = map;
      console.log('🗺️ Leaflet Map inicializado correctamente');

    } catch (error) {
      console.error('Error inicializando Leaflet map:', error);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [center.lat, center.lng, zoom]);

  // Actualizar marcadores cuando cambien las locations
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    // Limpiar marcadores existentes
    markersRef.current.forEach(marker => {
      map.removeLayer(marker);
    });
    markersRef.current = [];

    // Agregar nuevos marcadores
    locations.forEach(location => {
      // Crear icono personalizado basado en el estado
      const getMarkerColor = (estado?: string) => {
        switch (estado) {
          case 'completada': return '#10B981'; // Verde
          case 'en_proceso': return '#3B82F6'; // Azul
          case 'pendiente': return '#F59E0B'; // Amarillo
          default: return '#2563eb'; // Azul por defecto
        }
      };

      const customIcon = L.divIcon({
        html: `<div style="
          background: ${getMarkerColor(location.estado)};
          width: 24px;
          height: 24px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="
            color: white;
            font-size: 12px;
            font-weight: bold;
            transform: rotate(45deg);
          ">🏛️</div>
        </div>`,
        className: 'custom-marker',
        iconSize: [24, 24],
        iconAnchor: [12, 24],
      });

      const marker = L.marker([
        location.coordinates.lat,
        location.coordinates.lng
      ], { icon: customIcon });

      // Popup con información de la comisaría incluyendo imagen
      const foto_url = location.comisaria?.foto_url || location.foto_url;
      const popupContent = `
        <div style="min-width: 220px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
          ${foto_url ? `
            <div style="margin: -8px -8px 12px -8px;">
              <img
                src="${foto_url}"
                alt="${location.name}"
                style="
                  width: 100%;
                  height: 120px;
                  object-fit: cover;
                  border-radius: 6px 6px 0 0;
                  display: block;
                "
                onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"
              />
              <div style="
                display: none;
                height: 120px;
                background: linear-gradient(135deg, #1f2937 0%, #374151 100%);
                color: white;
                font-size: 24px;
                align-items: center;
                justify-content: center;
                border-radius: 6px 6px 0 0;
              ">🏛️</div>
            </div>
          ` : ''}
          <div style="padding: ${foto_url ? '0 8px 8px 8px' : '8px'};">
            <h3 style="margin: 0 0 8px 0; color: #1f2937; font-size: 16px; font-weight: 700;">
              🏛️ ${location.name}
            </h3>
            <p style="margin: 0 0 12px 0; color: #6b7280; font-size: 13px; line-height: 1.4;">
              📍 ${location.address || location.comisaria?.ubicacion?.distrito || 'Ubicación no disponible'}
            </p>
            <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;">
              ${location.tipo ? `
                <span style="
                  background: #dbeafe;
                  color: #1e40af;
                  padding: 3px 10px;
                  border-radius: 14px;
                  font-size: 11px;
                  font-weight: 600;
                  text-transform: capitalize;
                ">
                  ${location.tipo}
                </span>
              ` : ''}
              ${location.estado ? `
                <span style="
                  background: ${location.estado === 'completada' ? '#dcfce7' : location.estado === 'en_proceso' ? '#dbeafe' : '#fef3c7'};
                  color: ${location.estado === 'completada' ? '#166534' : location.estado === 'en_proceso' ? '#1e40af' : '#92400e'};
                  padding: 3px 10px;
                  border-radius: 14px;
                  font-size: 11px;
                  font-weight: 600;
                ">
                  ${location.estado.replace('_', ' ').toUpperCase()}
                </span>
              ` : ''}
            </div>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);

      // Tooltip para hover (nombre e imagen pequeña)
      const tooltipContent = `
        <div style="
          min-width: 180px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          text-align: center;
          background: rgba(31, 41, 55, 0.95);
          color: white;
          border-radius: 8px;
          padding: 8px;
          backdrop-filter: blur(8px);
        ">
          ${foto_url ? `
            <img
              src="${foto_url}"
              alt="${location.name}"
              style="
                width: 60px;
                height: 40px;
                object-fit: cover;
                border-radius: 4px;
                margin: 0 auto 6px auto;
                display: block;
                border: 2px solid rgba(255,255,255,0.2);
              "
              onerror="this.style.display='none';"
            />
          ` : ''}
          <div style="
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 2px;
          ">
            🏛️ ${location.name}
          </div>
          <div style="
            font-size: 11px;
            color: rgba(255,255,255,0.8);
          ">
            ${location.comisaria?.ubicacion?.distrito || 'Lima'}
          </div>
        </div>
      `;

      marker.bindTooltip(tooltipContent, {
        permanent: false,
        direction: 'top',
        offset: [0, -20],
        className: 'custom-tooltip'
      });

      // Event listener para click
      if (onLocationClick) {
        marker.on('click', () => {
          onLocationClick(location);
        });
      }

      // Agregar al mapa y guardar referencia
      marker.addTo(map);
      markersRef.current.push(marker);
    });

    // Ajustar vista para mostrar todos los marcadores
    if (locations.length > 0) {
      const group = new L.FeatureGroup(markersRef.current);
      map.fitBounds(group.getBounds(), {
        padding: [20, 20],
        maxZoom: 13
      });
    }
  }, [locations, onLocationClick]);

  return (
    <div
      ref={mapRef}
      className={className}
      style={{
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
        overflow: 'hidden'
      }}
    />
  );
};

export default LeafletMap;