/**
 * 🗺️ CSP-FRIENDLY MAP - NEMAEC ERP
 * Mapa simple sin dependencias externas que cumple con CSP estrictas
 */
import React, { useRef, useEffect, useState } from 'react';

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
}

interface CSPFriendlyMapProps {
  locations: MapLocation[];
  onLocationClick?: (location: MapLocation) => void;
  center?: { lat: number; lng: number };
  zoom?: number;
  className?: string;
}

const CSPFriendlyMap: React.FC<CSPFriendlyMapProps> = ({
  locations,
  onLocationClick,
  center = { lat: -12.0464, lng: -77.0428 }, // Lima, Perú
  zoom = 10,
  className = "w-full h-96"
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedLocation, setSelectedLocation] = useState<MapLocation | null>(null);
  const [hoveredLocation, setHoveredLocation] = useState<MapLocation | null>(null);

  // Convertir coordenadas geográficas a coordenadas del canvas
  const projectCoordinates = (lat: number, lng: number, canvasWidth: number, canvasHeight: number) => {
    // Bounding box aproximado para Lima y alrededores
    const bounds = {
      north: -11.5,    // Límite norte
      south: -12.5,    // Límite sur
      west: -77.3,     // Límite oeste
      east: -76.7      // Límite este
    };

    const x = ((lng - bounds.west) / (bounds.east - bounds.west)) * canvasWidth;
    const y = ((bounds.north - lat) / (bounds.north - bounds.south)) * canvasHeight;

    return { x: Math.max(0, Math.min(canvasWidth, x)), y: Math.max(0, Math.min(canvasHeight, y)) };
  };

  // Dibujar el mapa
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Limpiar canvas
    ctx.clearRect(0, 0, width, height);

    // Fondo del mapa (color tierra/océano)
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#e0f2fe'); // Azul claro (océano)
    gradient.addColorStop(1, '#f0f9ff'); // Azul muy claro
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Dibujar "costa" simple
    ctx.fillStyle = '#fef3c7'; // Color tierra
    ctx.fillRect(width * 0.1, height * 0.2, width * 0.8, height * 0.6);

    // Dibujar grid de referencia
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    for (let i = 1; i < 10; i++) {
      // Líneas verticales
      ctx.beginPath();
      ctx.moveTo((width / 10) * i, 0);
      ctx.lineTo((width / 10) * i, height);
      ctx.stroke();

      // Líneas horizontales
      ctx.beginPath();
      ctx.moveTo(0, (height / 10) * i);
      ctx.lineTo(width, (height / 10) * i);
      ctx.stroke();
    }

    // Dibujar marcadores
    locations.forEach(location => {
      const { x, y } = projectCoordinates(location.coordinates.lat, location.coordinates.lng, width, height);

      const isSelected = selectedLocation?.id === location.id;
      const isHovered = hoveredLocation?.id === location.id;

      // Color del marcador según estado
      let color = '#2563eb'; // Azul por defecto
      if (location.estado === 'completada') color = '#10B981'; // Verde
      else if (location.estado === 'en_proceso') color = '#3B82F6'; // Azul
      else if (location.estado === 'pendiente') color = '#F59E0B'; // Amarillo

      // Aumentar tamaño si está seleccionado o hover
      const size = isSelected || isHovered ? 12 : 8;

      // Sombra
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 2;

      // Marcador principal
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, 2 * Math.PI);
      ctx.fill();

      // Borde blanco
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Punto central
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, size / 3, 0, 2 * Math.PI);
      ctx.fill();
    });

    // Dibujar etiquetas de coordenadas
    ctx.fillStyle = '#6b7280';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';

    // Etiquetas en los bordes
    ctx.fillText('Lima Centro', width / 2, height - 10);
    ctx.fillText('Norte', width / 2, 15);
    ctx.textAlign = 'left';
    ctx.fillText('Oeste', 5, height / 2);
    ctx.textAlign = 'right';
    ctx.fillText('Este', width - 5, height / 2);

  }, [locations, selectedLocation, hoveredLocation]);

  // Manejar clics en el canvas
  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Encontrar el marcador más cercano
    let closestLocation: MapLocation | null = null;
    let minDistance = Infinity;

    locations.forEach(location => {
      const projected = projectCoordinates(location.coordinates.lat, location.coordinates.lng, rect.width, rect.height);
      const distance = Math.sqrt(Math.pow(x - projected.x, 2) + Math.pow(y - projected.y, 2));

      if (distance < 15 && distance < minDistance) { // Radio de 15px para clics
        minDistance = distance;
        closestLocation = location;
      }
    });

    if (closestLocation) {
      setSelectedLocation(closestLocation);
      if (onLocationClick) {
        onLocationClick(closestLocation);
      }
    } else {
      setSelectedLocation(null);
    }
  };

  // Manejar hover
  const handleCanvasMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Encontrar el marcador más cercano para hover
    let closestLocation: MapLocation | null = null;
    let minDistance = Infinity;

    locations.forEach(location => {
      const projected = projectCoordinates(location.coordinates.lat, location.coordinates.lng, rect.width, rect.height);
      const distance = Math.sqrt(Math.pow(x - projected.x, 2) + Math.pow(y - projected.y, 2));

      if (distance < 15 && distance < minDistance) {
        minDistance = distance;
        closestLocation = location;
      }
    });

    setHoveredLocation(closestLocation);
    canvas.style.cursor = closestLocation ? 'pointer' : 'default';
  };

  const getEstadoBadge = (estado?: string) => {
    const styles = {
      pendiente: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      en_proceso: 'bg-blue-100 text-blue-700 border-blue-200',
      completada: 'bg-green-100 text-green-700 border-green-200',
    };
    return styles[estado as keyof typeof styles] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  return (
    <div className={`relative ${className} bg-gray-50 rounded-lg border border-gray-200 overflow-hidden`}>
      {/* Canvas del mapa */}
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        onClick={handleCanvasClick}
        onMouseMove={handleCanvasMouseMove}
        onMouseLeave={() => setHoveredLocation(null)}
      />

      {/* Leyenda */}
      <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg border border-gray-200 p-3 text-xs">
        <div className="font-medium text-gray-800 mb-2">Leyenda</div>
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-gray-600">Completadas</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="text-gray-600">En Proceso</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span className="text-gray-600">Pendientes</span>
          </div>
        </div>
      </div>

      {/* Información del marcador seleccionado */}
      {selectedLocation && (
        <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg border border-gray-200 p-4 max-w-sm">
          <h3 className="font-semibold text-gray-900 mb-2">{selectedLocation.name}</h3>
          <p className="text-sm text-gray-600 mb-2">{selectedLocation.address}</p>
          {selectedLocation.estado && (
            <span className={`inline-block px-2 py-1 text-xs rounded-full border ${getEstadoBadge(selectedLocation.estado)}`}>
              {selectedLocation.estado.replace('_', ' ').toUpperCase()}
            </span>
          )}
          <div className="mt-2 text-xs text-gray-500">
            Coordenadas: {selectedLocation.coordinates.lat.toFixed(4)}, {selectedLocation.coordinates.lng.toFixed(4)}
          </div>
        </div>
      )}

      {/* Tooltip para hover */}
      {hoveredLocation && hoveredLocation.id !== selectedLocation?.id && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs py-1 px-2 rounded shadow-lg">
          {hoveredLocation.name}
        </div>
      )}

      {/* Contador de comisarías */}
      <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-lg border border-gray-200 px-3 py-2 text-sm">
        <span className="text-gray-600">{locations.length} comisarías</span>
      </div>
    </div>
  );
};

export default CSPFriendlyMap;