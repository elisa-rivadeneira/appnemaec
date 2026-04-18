/**
 * 🏛️ COMISARÍAS LIST - NEMAEC ERP
 * Vista principal del CRUD de comisarías con integración Google Maps.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  BuildingOfficeIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  FunnelIcon,
  ArrowPathIcon,
  ClockIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  PlusCircleIcon,
  ChartPieIcon
} from '@heroicons/react/24/outline';
import {
  BuildingOfficeIcon as BuildingOfficeIconSolid
} from '@heroicons/react/24/solid';

import { useComisarias, useDeleteComisaria, useComisariasStats } from '@/hooks/useComisarias';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ComisariaModal from '@/components/comisarias/ComisariaModal';
import type { Comisaria } from '@/types/comisarias';

const ComisariasList: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState<string>('all');
  const [selectedComisaria, setSelectedComisaria] = useState<Comisaria | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view' | null>(null);
  const [showMap, setShowMap] = useState(false);

  const { data, isLoading, error, refetch } = useComisarias();
  const deleteComisaria = useDeleteComisaria();
  const stats = useComisariasStats();

  // Asegurar que comisarias sea siempre un array válido
  const comisarias = Array.isArray(data) ? data : [];

  // Filtrar comisarías
  const filteredComisarias = comisarias.filter(comisaria => {
    const matchesSearch = comisaria.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         comisaria.codigo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         comisaria.ubicacion.distrito.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         comisaria.ubicacion.departamento.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter = filterEstado === 'all' || comisaria.estado === filterEstado;

    return matchesSearch && matchesFilter;
  });

  const handleCreate = () => {
    setSelectedComisaria(null);
    setModalMode('create');
  };

  const handleEdit = (comisaria: Comisaria) => {
    setSelectedComisaria(comisaria);
    setModalMode('edit');
  };

  const handleView = (comisaria: Comisaria) => {
    setSelectedComisaria(comisaria);
    setModalMode('view');
  };

  const handleDelete = async (comisaria: Comisaria) => {
    if (window.confirm(`¿Está seguro de eliminar la comisaría "${comisaria.nombre}"?`)) {
      deleteComisaria.mutate(comisaria.id);
    }
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

  const getTipoBadge = (tipo: string) => {
    const styles = {
      comisaria: 'bg-gray-100 text-gray-700',
      sectorial: 'bg-purple-100 text-purple-700',
      especializada: 'bg-indigo-100 text-indigo-700',
    };
    return styles[tipo as keyof typeof styles] || styles.comisaria;
  };

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🚨</div>
          <h3 className="text-xl font-bold text-red-600 mb-2">Error al cargar comisarías</h3>
          <p className="text-gray-600 mb-4">Ha ocurrido un error al obtener los datos.</p>
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
              <div className="w-10 h-10 bg-nemaec-green-100 rounded-lg flex items-center justify-center">
                <BuildingOfficeIconSolid className="w-6 h-6 text-nemaec-green-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Gestión de Comisarías</h1>
                <p className="text-sm text-gray-600">
                  Administrar las {stats.total} comisarías del proyecto NEMAEC
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMap(!showMap)}
                leftIcon={<MapPinIcon className="w-4 h-4" />}
              >
                {showMap ? 'Ocultar' : 'Ver'} Mapa
              </Button>
              <Button
                variant="primary"
                onClick={handleCreate}
                leftIcon={<PlusIcon className="w-4 h-4" />}
              >
                Nueva Comisaría
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Estadísticas Rápidas */}
      <div className="px-6 py-4 bg-white border-b border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-gray-800">{stats.total}</div>
            <div className="text-sm text-gray-600">Total</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-700">{stats.completadas}</div>
            <div className="text-sm text-green-600">Completadas</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-700">{stats.en_proceso}</div>
            <div className="text-sm text-blue-600">En Proceso</div>
          </div>
          <div className="bg-red-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-red-700">{stats.retrasadas}</div>
            <div className="text-sm text-red-600">Retrasadas</div>
          </div>
        </div>
      </div>

      {/* Controles de Búsqueda y Filtros */}
      <div className="px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Búsqueda */}
          <div className="flex-1">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nombre, código, distrito o departamento..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nemaec-green-500 focus:border-transparent"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Filtro por Estado */}
          <div className="sm:w-48">
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nemaec-green-500 focus:border-transparent"
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value)}
            >
              <option value="all">Todos los estados</option>
              <option value="pendiente">Pendientes</option>
              <option value="en_proceso">En Proceso</option>
              <option value="completada">Completadas</option>
            </select>
          </div>

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

      {/* Lista de Comisarías */}
      <div className="p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : filteredComisarias.length === 0 ? (
          <div className="text-center py-12">
            <BuildingOfficeIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm || filterEstado !== 'all' ? 'No se encontraron comisarías' : 'No hay comisarías registradas'}
            </h3>
            <p className="text-gray-600 mb-6">
              {searchTerm || filterEstado !== 'all'
                ? 'Intenta modificar los filtros de búsqueda'
                : 'Comienza agregando la primera comisaría al sistema'
              }
            </p>
            {!searchTerm && filterEstado === 'all' && (
              <Button variant="primary" onClick={handleCreate} leftIcon={<PlusIcon className="w-4 h-4" />}>
                Agregar Primera Comisaría
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredComisarias.map((comisaria) => (
              <div
                key={comisaria.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
              >
                <div className="p-6">
                  {/* Header de la tarjeta */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h3 className="text-lg font-semibold text-gray-900 truncate">
                          {comisaria.nombre}
                        </h3>
                        <span className={`px-2 py-1 text-xs rounded-full ${getTipoBadge(comisaria.tipo)}`}>
                          {comisaria.tipo}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <span className="font-mono">{comisaria.codigo}</span>
                        <span className={`px-2 py-1 text-xs rounded-full border ${getEstadoBadge(comisaria.estado)}`}>
                          {comisaria.estado.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                    {comisaria.esta_retrasada && (
                      <div className="text-red-500 text-xs bg-red-50 px-2 py-1 rounded">
                        Retrasada
                      </div>
                    )}
                  </div>

                  {/* Ubicación */}
                  <div className="mb-4">
                    <div className="flex items-start space-x-2">
                      <MapPinIcon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-gray-600">
                        <div>{comisaria.ubicacion.direccion}</div>
                        <div>
                          {comisaria.ubicacion.distrito}, {comisaria.ubicacion.provincia}
                        </div>
                        <div className="font-medium">{comisaria.ubicacion.departamento}</div>
                      </div>
                    </div>
                  </div>

                  {/* Presupuesto */}
                  {comisaria.presupuesto_total && (
                    <div className="mb-4">
                      <div className="text-sm text-gray-600">
                        Presupuesto: <span className="font-semibold text-gray-900">
                          S/ {comisaria.presupuesto_total.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Acciones - Solo iconos */}
                  <div className="flex items-center justify-center pt-4 border-t border-gray-100">
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleView(comisaria)}
                        className="p-2 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        title="Ver detalles"
                      >
                        <EyeIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => navigate(`/cronograma/comisaria/${comisaria.id}`)}
                        className="p-2 rounded-lg text-gray-500 hover:text-green-600 hover:bg-green-50 transition-colors"
                        title="Ver avances"
                      >
                        <ChartBarIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => navigate(`/cronograma/historial/${comisaria.id}`)}
                        className="p-2 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        title="Ver historial"
                      >
                        <ClockIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => navigate(`/seguimiento/evolucion/${comisaria.id}`)}
                        className="p-2 rounded-lg text-gray-500 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                        title="Ver evolución"
                      >
                        <ArrowTrendingUpIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => navigate(`/avances/registro/${comisaria.id}`)}
                        className="p-2 rounded-lg text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                        title="Registrar avance manual"
                      >
                        <PlusCircleIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => navigate(`/avances/graficos/${comisaria.id}`)}
                        className="p-2 rounded-lg text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        title="Ver gráficos de avance"
                      >
                        <ChartPieIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(comisaria)}
                        className="p-2 rounded-lg text-gray-500 hover:text-orange-600 hover:bg-orange-50 transition-colors"
                        title="Editar"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(comisaria)}
                        className="p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Eliminar"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal para CRUD */}
      {modalMode && (
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

export default ComisariasList;