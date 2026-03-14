/**
 * 🗺️ SAFE GOOGLE MAPS - NEMAEC ERP
 * Componente con contenedor inmutable para evitar conflictos de DOM.
 */
import React, { useState, useRef, useEffect, memo } from 'react';
import {
  MapPinIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { MapPinIcon as MapPinIconSolid } from '@heroicons/react/24/solid';
import { mockLocations, type MapLocation } from '@/data/mockLocations';

interface SafeGoogleMapProps {
  onLocationSelect: (location: MapLocation) => void;
  onConfirmLocation?: () => void;
  onRejectLocation?: () => void;
  initialQuery?: string;
  selectedLocation?: MapLocation | null;
  googleMapsResults?: MapLocation[];
  className?: string;
}

// Componente de mapa separado que se actualiza cuando cambian las locations
const GoogleMapContainer = memo(({
  locations,
  onLocationSelect,
  selectedLocation
}: {
  locations: MapLocation[];
  onLocationSelect: (location: MapLocation) => void;
  selectedLocation?: MapLocation | null;
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const isInitialized = useRef(false);
  const markersRef = useRef<any[]>([]);

  // Inicializar el mapa (solo una vez)
  useEffect(() => {
    if (isInitialized.current) return;

    const initializeMap = async () => {
      try {
        // Esperar a que Google Maps esté disponible
        while (!window.google?.maps) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (!mapRef.current || isInitialized.current) return;

        const map = new window.google.maps.Map(mapRef.current, {
          center: { lat: -12.0464, lng: -77.0428 },
          zoom: 14,
          mapTypeControl: true,
          streetViewControl: true,
          fullscreenControl: false,
        });

        mapInstanceRef.current = map;
        isInitialized.current = true;
        console.log('🗺️ Mapa inicializado correctamente');

        // ✨ HACK: Ocultar overlay gris de Google Maps cuando no hay API key válida
        setTimeout(() => {
          const style = document.createElement('style');
          style.innerHTML = `
            /* Ocultar capa gris "For development purposes only" */
            .gm-style div[style*="z-index: 1000000"] {
              display: none !important;
            }

            /* Ocultar overlay de desarrollo */
            .gm-style div[style*="opacity: 0.3"] {
              display: none !important;
            }

            /* Ocultar texto de watermark */
            .gm-style div:has(span:contains("For development purposes only")) {
              display: none !important;
            }

            /* Ocultar cualquier overlay con texto de desarrollo */
            .gm-style [style*="position: absolute"][style*="z-index"] {
              background: transparent !important;
            }

            /* Limpiar cualquier overlay que tenga contenido de desarrollo */
            .gm-style div[style*="color: rgb(255, 255, 255)"] {
              display: none !important;
            }
          `;
          document.head.appendChild(style);
          console.log('🧹 CSS aplicado para limpiar overlays de Google Maps');
        }, 1000);

      } catch (error) {
        console.error('Error initializing map:', error);
      }
    };

    initializeMap();
  }, []);

  // Actualizar marcadores cuando cambien las locations
  useEffect(() => {
    if (!mapInstanceRef.current || !isInitialized.current) {
      console.log('⏳ Esperando inicialización del mapa...');
      return;
    }

    const map = mapInstanceRef.current;

    // Limpiar marcadores existentes
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    // Agregar marcadores básicos de Google Maps con debugging
    console.log('📍 Total locations to add:', locations.length);
    locations.forEach((location, index) => {
      console.log(`🔴 Agregando marcador ${index + 1}:`, location.name, location.coordinates);

      const marker = new window.google.maps.Marker({
        position: {
          lat: parseFloat(location.coordinates.lat),
          lng: parseFloat(location.coordinates.lng)
        },
        map: map,
        title: location.name,
        // Usar el pin elegante predeterminado de Google Maps (rojo)
        zIndex: 9999,
        animation: window.google.maps.Animation.DROP,
        visible: true
      });

      console.log(`✅ Marcador ${index + 1} creado:`, marker.getPosition()?.toString());

      // Guardar referencia del marcador
      markersRef.current.push(marker);

      const infoWindow = new window.google.maps.InfoWindow({
        content: `<div style="padding:8px;"><strong>${location.name}</strong><br/>${location.address}</div>`
      });

      marker.addListener('click', () => {
        infoWindow.open(map, marker);
        map.setCenter(location.coordinates);
        map.setZoom(17); // Zoom más detallado
        onLocationSelect(location);
      });
    });

    // Centrar en los marcadores
    if (locations.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      locations.forEach(location => {
        bounds.extend(location.coordinates);
      });

      if (locations.length === 1) {
        map.setCenter(locations[0].coordinates);
        map.setZoom(16);
      } else if (locations.length <= 3) {
        map.fitBounds(bounds);
        // Ajustar zoom después del fitBounds para mejor visibilidad
        const listener = window.google.maps.event.addListenerOnce(map, 'idle', function() {
          if (map.getZoom() > 15) map.setZoom(15);
          if (map.getZoom() < 12) map.setZoom(12);
        });
      } else {
        map.fitBounds(bounds);
      }
    }
  }, [locations, onLocationSelect]);

  // Efecto para enfocar cuando se selecciona una ubicación desde la lista
  useEffect(() => {
    if (selectedLocation && mapInstanceRef.current) {
      const map = mapInstanceRef.current;
      map.setCenter(selectedLocation.coordinates);
      map.setZoom(17); // Zoom detallado para ver la comisaría claramente
    }
  }, [selectedLocation]);

  return <div ref={mapRef} className="h-96 w-full bg-gray-100" />;
});

const SafeGoogleMap: React.FC<SafeGoogleMapProps> = ({
  onLocationSelect,
  onConfirmLocation,
  onRejectLocation,
  initialQuery = '',
  selectedLocation,
  googleMapsResults = [],
  className = ''
}) => {
  const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(!!window.google?.maps);
  const [error, setError] = useState<string | null>(null);

  const displayedLocations = googleMapsResults.length > 0 ? googleMapsResults : mockLocations;

  // Cargar Google Maps script una sola vez
  useEffect(() => {
    if (window.google?.maps) {
      setIsGoogleMapsLoaded(true);
      return;
    }

    const loadGoogleMaps = () => {
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        setError('API key no configurada');
        return;
      }

      // Verificar si ya existe el script
      if (document.querySelector('script[src*="maps.googleapis.com"]')) {
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;

      script.onload = () => {
        setIsGoogleMapsLoaded(true);
        setError(null);
      };

      script.onerror = () => {
        setError('Error al cargar Google Maps');
      };

      document.head.appendChild(script);
    };

    loadGoogleMaps();
  }, []);

  const handleLocationClick = (location: MapLocation) => {
    onLocationSelect(location);
  };

  const getBadgeColor = (type: string) => {
    switch (type) {
      case 'cpnp': return 'bg-green-100 text-green-700';
      case 'comisaria': return 'bg-blue-100 text-blue-700';
      case 'sectorial': return 'bg-purple-100 text-purple-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getMarkerColor = (type: string, isSelected: boolean) => {
    if (isSelected) return '#EF4444';
    switch (type) {
      case 'cpnp': return '#10B981';
      case 'comisaria': return '#3B82F6';
      case 'sectorial': return '#8B5CF6';
      default: return '#6B7280';
    }
  };

  if (error) {
    return (
      <div className={`bg-white rounded-lg border border-red-200 ${className}`}>
        <div className="p-6 text-center">
          <div className="text-red-600 mb-2">⚠️</div>
          <h3 className="text-sm font-medium text-gray-900 mb-2">Error del Mapa</h3>
          <p className="text-xs text-gray-600 mb-3">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
          >
            Recargar página
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center space-x-2 mb-3">
          <MapPinIcon className="w-5 h-5 text-nemaec-green-600" />
          <span className="font-medium text-gray-800">Seleccionar Ubicación</span>
        </div>

        {initialQuery && (
          <div className="text-sm text-gray-600 bg-blue-50 px-3 py-2 rounded-lg">
            🔍 Mostrando resultados para: <span className="font-medium">"{initialQuery}"</span>
          </div>
        )}
      </div>

      <div className="flex">
        {/* Results List */}
        <div className="w-80 border-r border-gray-200 bg-gray-50">
          <div className="p-3 border-b border-gray-200">
            <div className="text-sm font-medium text-gray-700">
              {displayedLocations.length} ubicaciones encontradas
            </div>
          </div>

          <div className="h-96 overflow-y-auto">
            {displayedLocations.map((location) => {
              const isSelected = selectedLocation?.id === location.id;
              return (
                <div
                  key={location.id}
                  onClick={() => handleLocationClick(location)}
                  className={`p-3 border-b border-gray-200 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-nemaec-green-50 border-l-4 border-l-nemaec-green-500'
                      : 'hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <div className="font-medium text-gray-900 text-sm truncate">
                          {location.name}
                        </div>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${getBadgeColor(location.type)}`}>
                          {location.type.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 mb-1">
                        {location.address}
                      </div>
                      <div className="text-xs text-gray-500">
                        {location.distrito}, {location.provincia}
                      </div>
                    </div>
                    <div className="flex items-center ml-2">
                      {isSelected ? (
                        <CheckIcon className="w-4 h-4 text-nemaec-green-600" />
                      ) : (
                        <MapPinIconSolid
                          className="w-4 h-4"
                          style={{ color: getMarkerColor(location.type, false) }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Map Container */}
        <div className="flex-1 relative">
          {isGoogleMapsLoaded ? (
            <GoogleMapContainer
              locations={displayedLocations}
              onLocationSelect={onLocationSelect}
              selectedLocation={selectedLocation}
            />
          ) : (
            <div className="h-96 w-full bg-gray-100 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-nemaec-green-600 mx-auto mb-2"></div>
                <div className="text-gray-600 text-xs">Cargando Google Maps...</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Selected Location */}
      {selectedLocation && (
        <div className="p-4 bg-nemaec-green-50 border-t border-nemaec-green-200">
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-6 h-6 rounded-full bg-nemaec-green-600 flex items-center justify-center">
              <CheckIcon className="w-3 h-3 text-white" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-nemaec-green-800">
                Ubicación Seleccionada
              </div>
              <div className="text-xs text-nemaec-green-700">
                {selectedLocation.name} - {selectedLocation.address} • {selectedLocation.distrito}, {selectedLocation.provincia}
              </div>
            </div>
          </div>

          {/* Botones de confirmación */}
          {onConfirmLocation && onRejectLocation && (
            <div className="flex items-center space-x-3 mt-3 pt-3 border-t border-nemaec-green-200">
              <button
                onClick={onConfirmLocation}
                className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-nemaec-green-600 text-white text-sm font-medium rounded-lg hover:bg-nemaec-green-700 transition-colors"
              >
                <CheckIcon className="w-4 h-4" />
                <span>Usar Esta Ubicación</span>
              </button>
              <button
                onClick={onRejectLocation}
                className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                <XMarkIcon className="w-4 h-4" />
                <span>Escribir Manualmente</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SafeGoogleMap;