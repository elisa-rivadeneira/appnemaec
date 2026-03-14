/**
 * 🗺️ MAPA NACIONAL - NEMAEC ERP
 * Vista de mapa nacional mostrando todas las comisarías con OpenStreetMap/Leaflet.
 */
import React, { useState, useMemo } from 'react';
import {
  MapPinIcon,
  FunnelIcon,
  ArrowPathIcon,
  EyeIcon,
  PencilIcon,
  BuildingOfficeIcon
} from '@heroicons/react/24/outline';
import {
  MapPinIcon as MapPinIconSolid,
  BuildingOfficeIcon as BuildingOfficeIconSolid
} from '@heroicons/react/24/solid';

import { useComisarias } from '@/hooks/useComisarias';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ComisariaModal from '@/components/comisarias/ComisariaModal';
import CSPFriendlyMap from '@/components/maps/CSPFriendlyMap';
import type { Comisaria } from '@/types/comisarias';
import type { MapLocation } from '@/data/mockLocations';

const MapaNacional: React.FC = () => {
  const [selectedComisaria, setSelectedComisaria] = useState<Comisaria | null>(null);
  const [modalMode, setModalMode] = useState<'view' | 'edit' | null>(null);
  const [filterDepartamento, setFilterDepartamento] = useState<string>('all');
  const [filterEstado, setFilterEstado] = useState<string>('all');
  const [selectedMapLocation, setSelectedMapLocation] = useState<MapLocation | null>(null);

  const { data: comisarias = [], isLoading, error, refetch } = useComisarias();

  // Convertir comisarías a formato de mapa usando useMemo para evitar recálculos
  const comisariasMapFormat: MapLocation[] = useMemo(() => {
    return comisarias
      .filter(comisaria => !!comisaria.ubicacion?.coordenadas) // Solo las que tienen coordenadas
    .map(comisaria => ({
      id: comisaria.id.toString(),
      name: comisaria.nombre,
      address: comisaria.ubicacion.direccion,
      coordinates: {
        lat: comisaria.ubicacion.coordenadas!.lat,
        lng: comisaria.ubicacion.coordenadas!.lng
      },
      type: comisaria.tipo as any,
      distrito: comisaria.ubicacion.distrito,
      provincia: comisaria.ubicacion.provincia,
      departamento: comisaria.ubicacion.departamento,
      estado: comisaria.estado,
      comisaria: comisaria // Referencia a la comisaría original
    }));
  }, [comisarias]);

  // Filtrar comisarías según los filtros seleccionados
  const filteredMapLocations = comisariasMapFormat.filter(location => {
    const matchesDepartamento = filterDepartamento === 'all' ||
                               location.departamento === filterDepartamento;
    const matchesEstado = filterEstado === 'all' ||
                         (location.comisaria as Comisaria).estado === filterEstado;

    return matchesDepartamento && matchesEstado;
  });

  // Obtener departamentos únicos para el filtro
  const departamentosUnicos = Array.from(
    new Set(comisarias.map(c => c.ubicacion.departamento))
  ).sort();

  // Funciones para manejar clicks del mapa
  const handleLocationClick = (location: MapLocation) => {
    setSelectedMapLocation(location);
  };

  const handleView = (comisaria: Comisaria) => {
    setSelectedComisaria(comisaria);
    setModalMode('view');
  };

  const handleEdit = (comisaria: Comisaria) => {
    setSelectedComisaria(comisaria);
    setModalMode('edit');
  };

  const closeModal = () => {
    setSelectedComisaria(null);
    setModalMode(null);
  };

  const getEstadoBadge = (estado: string) => {
    const styles = {
      pendiente: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      en_proceso: 'bg-blue-100 text-blue-700 border-blue-200',
      completada: 'bg-green-100 text-green-700 border-green-200',
    };
    return styles[estado as keyof typeof styles] || styles.pendiente;
  };

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🗺️</div>
          <h3 className="text-xl font-bold text-red-600 mb-2">Error al cargar el mapa</h3>
          <p className="text-gray-600 mb-4">Ha ocurrido un error al obtener los datos de comisarías.</p>
          <Button onClick={() => refetch()} variant="primary">
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <MapPinIconSolid className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Mapa Nacional NEMAEC</h1>
                <p className="text-sm text-gray-600">
                  Vista geográfica de las {comisarias.length} comisarías del proyecto
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <span className="text-sm text-gray-600">
                Mostrando {filteredMapLocations.length} comisarías
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                leftIcon={<ArrowPathIcon className="w-4 h-4" />}
                loading={isLoading}
              >
                Actualizar
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Filtros */}
      <div className="px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex items-center space-x-2">
            <FunnelIcon className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Filtros:</span>
          </div>

          {/* Filtro por Departamento */}
          <div className="sm:w-48">
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              value={filterDepartamento}
              onChange={(e) => setFilterDepartamento(e.target.value)}
            >
              <option value="all">Todos los departamentos</option>
              {departamentosUnicos.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          {/* Filtro por Estado */}
          <div className="sm:w-48">
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value)}
            >
              <option value="all">Todos los estados</option>
              <option value="pendiente">Pendientes</option>
              <option value="en_proceso">En Proceso</option>
              <option value="completada">Completadas</option>
            </select>
          </div>

          {/* Leyenda de colores */}
          <div className="flex items-center space-x-4 ml-auto">
            <div className="text-xs text-gray-600">Leyenda:</div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-xs text-gray-600">Completadas</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span className="text-xs text-gray-600">En Proceso</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <span className="text-xs text-gray-600">Pendientes</span>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido Principal */}
      <div className="flex h-[calc(100vh-200px)]">
        {/* Panel Lateral de Comisarías */}
        <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-800 flex items-center space-x-2">
              <BuildingOfficeIconSolid className="w-5 h-5 text-blue-600" />
              <span>Comisarías ({filteredMapLocations.length})</span>
            </h2>
          </div>

          <div className="divide-y divide-gray-200">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner />
              </div>
            ) : filteredMapLocations.length === 0 ? (
              <div className="text-center py-12">
                <BuildingOfficeIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">
                  No hay comisarías con los filtros seleccionados
                </p>
              </div>
            ) : (
              filteredMapLocations.map((location) => {
                const comisaria = location.comisaria as Comisaria;
                const isSelected = selectedMapLocation?.id === location.id;

                return (
                  <div
                    key={location.id}
                    onClick={() => {
                      setSelectedMapLocation(location);
                    }}
                    className={`p-4 cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="font-medium text-gray-900 text-sm truncate">
                            {location.name}
                          </h3>
                          <span className={`px-2 py-0.5 text-xs rounded-full border ${getEstadoBadge(comisaria.estado)}`}>
                            {comisaria.estado.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="text-xs text-gray-600 mb-1">
                          {location.distrito}, {location.provincia}
                        </div>
                        <div className="text-xs text-gray-500 mb-2">
                          {location.departamento}
                        </div>
                        <div className="text-xs font-medium text-gray-700">
                          S/ {comisaria.presupuesto_total.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                      <div className="flex flex-col space-y-1">
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleView(comisaria);
                          }}
                          leftIcon={<EyeIcon className="w-3 h-3" />}
                        >
                          Ver
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(comisaria);
                          }}
                          leftIcon={<PencilIcon className="w-3 h-3" />}
                        >
                          Editar
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Mapa */}
        <div className="flex-1 relative">
          <CSPFriendlyMap
            locations={filteredMapLocations}
            onLocationClick={handleLocationClick}
            center={{ lat: -12.0464, lng: -77.0428 }}
            zoom={6}
            className="w-full h-full"
          />

          {isLoading && (
            <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
              <div className="text-center">
                <LoadingSpinner size="lg" />
                <div className="mt-2 text-gray-600">Cargando mapa nacional...</div>
              </div>
            </div>
          )}

          {/* Info de comisaría seleccionada */}
          {selectedMapLocation && (
            <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg border border-gray-200 p-4 max-w-sm">
              <div className="flex items-center space-x-2 mb-2">
                <MapPinIconSolid className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-gray-900">{selectedMapLocation.name}</h3>
              </div>
              <div className="space-y-1 text-sm text-gray-600 mb-3">
                <div>{selectedMapLocation.address}</div>
                <div>{selectedMapLocation.distrito}, {selectedMapLocation.provincia}</div>
                <div className="font-medium">{selectedMapLocation.departamento}</div>
                <div className={`inline-block px-2 py-1 text-xs rounded-full ${getEstadoBadge(selectedMapLocation.estado)}`}>
                  {selectedMapLocation.estado?.replace('_', ' ').toUpperCase()}
                </div>
              </div>
              <div className="flex space-x-2">
                <Button
                  size="xs"
                  variant="primary"
                  onClick={() => handleView(selectedMapLocation.comisaria as Comisaria)}
                  leftIcon={<EyeIcon className="w-3 h-3" />}
                >
                  Ver
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => handleEdit(selectedMapLocation.comisaria as Comisaria)}
                  leftIcon={<PencilIcon className="w-3 h-3" />}
                >
                  Editar
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {modalMode && selectedComisaria && (
        <ComisariaModal
          isOpen={true}
          onClose={closeModal}
          mode={modalMode}
          comisaria={selectedComisaria}
        />
      )}
    </div>
  );
};

export default MapaNacional;