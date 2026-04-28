/**
 * 📊 CRONOGRAMA DETALLE PAGE - NEMAEC ERP
 * Página para ver los detalles completos de un cronograma específico
 */

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Button from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Calendar,
  FileText,
  DollarSign,
  Clock,
  Search,
  Filter,
  Download,
  Eye,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { useCronogramaByComisaria } from '@/hooks/useCronograma';
import { useAvanceProgramado, useUltimoAvanceFisico, useDetallesAvanceFisico } from '@/hooks/useSeguimiento';
import Input from '@/components/ui/Input';

export default function CronogramaDetallePage() {
  const { comisariaId } = useParams<{ comisariaId: string }>();
  const navigate = useNavigate();
  const numericComisariaId = parseInt(comisariaId || '0');

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const itemsPerPage = 1000; // Mostrar todo en una página para el árbol

  const {
    data: cronograma,
    isLoading,
    error
  } = useCronogramaByComisaria(numericComisariaId);

  // Auto-expandir partidas de nivel 1 y 2 cuando se carga el cronograma
  React.useEffect(() => {
    console.log('📊 DEBUG Cronograma useEffect:', {
      hasPartidas: !!cronograma?.partidas,
      partidasLength: cronograma?.partidas?.length || 0,
      expandedItemsSize: expandedItems.size,
      firstPartida: cronograma?.partidas?.[0],
      allNivelesJerarquia: cronograma?.partidas?.map(p => p.nivel_jerarquia) || []
    });

    if (cronograma?.partidas && cronograma.partidas.length > 0 && expandedItems.size === 0) {
      const autoExpandItems = new Set<string>();

      cronograma.partidas.forEach(partida => {
        // Expandir partidas de nivel 1 y 2 automáticamente
        if (partida.nivel_jerarquia <= 2) {
          autoExpandItems.add(partida.codigo_partida);
        }
      });

      console.log('🔓 Auto-expandiendo partidas:', autoExpandItems);
      console.log('📊 Total partidas a expandir:', autoExpandItems.size);
      setExpandedItems(autoExpandItems);
    }
  }, [cronograma]);

  // Obtener datos de seguimiento
  const {
    data: avanceProgramado,
    isLoading: isLoadingProgramado,
    error: errorProgramado
  } = useAvanceProgramado(numericComisariaId);

  const {
    data: ultimoAvanceFisico,
    isLoading: isLoadingAvanceFisico,
    error: errorAvanceFisico
  } = useUltimoAvanceFisico(numericComisariaId);

  const {
    data: detallesAvanceFisico,
    isLoading: isLoadingDetalles,
    error: errorDetalles
  } = useDetallesAvanceFisico(numericComisariaId);

  // Función para calcular fecha de inicio del cronograma desde partidas
  const calcularFechaInicioCronograma = (): string | null => {
    if (!cronograma?.partidas) return null;

    const fechasInicio = cronograma.partidas
      .filter(p => p.fecha_inicio && p.fecha_inicio !== '')
      .map(p => new Date(p.fecha_inicio))
      .filter(fecha => !isNaN(fecha.getTime()));

    if (fechasInicio.length === 0) return null;

    const fechaMinima = new Date(Math.min(...fechasInicio.map(f => f.getTime())));
    return fechaMinima.toISOString().split('T')[0] + 'T00:00:00Z';
  };

  // Función para calcular fecha de fin del cronograma desde partidas
  const calcularFechaFinCronograma = (): string | null => {
    if (!cronograma?.partidas) return null;

    const fechasFin = cronograma.partidas
      .filter(p => p.fecha_fin && p.fecha_fin !== '')
      .map(p => new Date(p.fecha_fin))
      .filter(fecha => !isNaN(fecha.getTime()));

    if (fechasFin.length === 0) return null;

    const fechaMaxima = new Date(Math.max(...fechasFin.map(f => f.getTime())));
    return fechaMaxima.toISOString().split('T')[0] + 'T00:00:00Z';
  };

  // Función para calcular el presupuesto total real sumando todas las partidas
  const calcularPresupuestoTotal = (): number => {
    if (!cronograma?.partidas) return 0;

    return cronograma.partidas.reduce((total, partida) => {
      // Solo sumar partidas que no tienen hijos (partidas finales/hojas)
      const tieneHijos = cronograma.partidas.some(p =>
        p.codigo_partida.startsWith(partida.codigo_partida + '.') &&
        p.codigo_partida !== partida.codigo_partida
      );

      if (!tieneHijos) {
        // Usar precio_total si existe y es > 0, sino calcular metrado * precio_unitario
        const precio = partida.precio_total > 0
          ? partida.precio_total
          : (partida.metrado || 0) * (partida.precio_unitario || 0);
        return total + precio;
      }

      return total;
    }, 0);
  };

  // Debug logs temporales
  console.log('🔍 Debug CronogramaDetallePage:', {
    numericComisariaId,
    avanceProgramado,
    isLoadingProgramado,
    errorProgramado,
    ultimoAvanceFisico,
    isLoadingAvanceFisico,
    errorAvanceFisico,
    detallesAvanceFisico,
    isLoadingDetalles,
    errorDetalles
  });

  // Debug fechas y presupuesto calculado
  if (cronograma) {
    const fechaInicio = calcularFechaInicioCronograma();
    const fechaFin = calcularFechaFinCronograma();
    const presupuestoCalculado = calcularPresupuestoTotal();
    console.log('📅 Debug Fechas y Presupuesto:', {
      cronogramaFechaInicio: cronograma.fecha_inicio_obra,
      cronogramaFechaFin: cronograma.fecha_fin_obra,
      fechaInicioCalculada: fechaInicio,
      fechaFinCalculada: fechaFin,
      totalPartidas: cronograma.partidas?.length,
      presupuestoOriginal: cronograma.total_presupuesto,
      presupuestoCalculado: presupuestoCalculado
    });
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-PE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Función para alternar expansión de una partida
  const toggleExpansion = (codigoPartida: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(codigoPartida)) {
        newSet.delete(codigoPartida);
      } else {
        newSet.add(codigoPartida);
      }
      return newSet;
    });
  };

  // Función para expandir todo
  const expandAll = () => {
    const allParentCodes = new Set(
      cronograma?.partidas?.filter(p => p.nivel_jerarquia <= 2).map(p => p.codigo_partida) || []
    );
    setExpandedItems(allParentCodes);
  };

  // Función para colapsar todo
  const collapseAll = () => {
    setExpandedItems(new Set());
  };

  // Función para verificar si una partida debe ser visible
  const isPartidaVisible = (partida: any): boolean => {
    // Nivel 1 siempre visible
    if (partida.nivel_jerarquia === 1) return true;

    // Para otros niveles, verificar si algún ancestro está expandido
    const codigoParts = partida.codigo_partida.split('.');
    for (let i = 1; i < codigoParts.length; i++) {
      const ancestorCode = codigoParts.slice(0, i).join('.');
      if (!expandedItems.has(ancestorCode)) {
        return false;
      }
    }
    return true;
  };

  // Función para verificar si una partida tiene hijos
  const hasChildren = (codigoPartida: string, todasPartidas: any[]): boolean => {
    return todasPartidas.some(p =>
      p.codigo_partida.startsWith(codigoPartida + '.') &&
      p.codigo_partida.split('.').length === codigoPartida.split('.').length + 1
    );
  };

  // Precio efectivo de una partida hoja: usa precio_total si > 0, sino metrado × precio_unitario
  const getPrecioEfectivo = (partida: any): number => {
    if (partida.precio_total > 0) return partida.precio_total;
    if (partida.metrado > 0 && partida.precio_unitario > 0)
      return Math.round(partida.metrado * partida.precio_unitario * 100) / 100;
    return 0;
  };

  // Sumar precio de todas las hojas descendientes de un padre
  const calcularTotalPadre = (codigoPadre: string, todasLasPartidas: any[]) => {
    const descendientes = todasLasPartidas.filter(p =>
      p.codigo_partida.startsWith(codigoPadre + '.') && p.codigo_partida !== codigoPadre
    );
    return descendientes
      .filter(p => !descendientes.some(o => o.codigo_partida.startsWith(p.codigo_partida + '.')))
      .reduce((sum, p) => sum + getPrecioEfectivo(p), 0);
  };

  // Función para obtener avance programado de una partida específica
  const getAvanceProgramadoPartida = (codigoPartida: string): number | null => {
    if (!avanceProgramado?.partidas) return null;
    const partidaData = avanceProgramado.partidas.find(
      (p: any) => p.codigo_partida === codigoPartida
    );
    return partidaData ? partidaData.avance_programado : null;
  };

  // Función para obtener avance físico de una partida específica
  const getAvanceFisicoPartida = (codigoPartida: string): number | null => {
    if (!detallesAvanceFisico?.partidas) return null;
    const partidaData = detallesAvanceFisico.partidas.find(
      (p: any) => p.codigo_partida === codigoPartida
    );
    return partidaData ? partidaData.porcentaje_avance : null;
  };

  // Función para formatear porcentajes
  const formatPercentage = (value: number | null): string => {
    if (value === null || value === undefined) return '—';
    return `${(value * 100).toFixed(1)}%`;
  };

  // Función para calcular el avance programado total
  const calcularAvanceProgramadoTotal = (): number | null => {
    if (!avanceProgramado?.partidas) return null;
    return avanceProgramado.avance_programado; // El backend ya calcula el total
  };

  // Función para calcular el avance físico total
  const calcularAvanceFisicoTotal = (): number | null => {
    if (!ultimoAvanceFisico?.avance_ejecutado) return null;
    return ultimoAvanceFisico.avance_ejecutado; // El backend ya calcula el total
  };

  // Enriquecer partidas con totales calculados
  const enrichedPartidas = cronograma?.partidas?.map(partida => {
    const tieneHijos = cronograma.partidas.some((p: any) =>
      p.codigo_partida.startsWith(partida.codigo_partida + '.')
    );
    if (tieneHijos) {
      return { ...partida, precio_total: calcularTotalPadre(partida.codigo_partida, cronograma.partidas) };
    }
    return { ...partida, precio_total: getPrecioEfectivo(partida) };
  }) || [];

  // Filtrar partidas por búsqueda y visibilidad
  const filteredPartidas = enrichedPartidas.filter(partida => {
    // Filtro de búsqueda
    const matchesSearch = partida.codigo_partida.toLowerCase().includes(searchTerm.toLowerCase()) ||
      partida.descripcion.toLowerCase().includes(searchTerm.toLowerCase());

    // Filtro de visibilidad (solo aplicar si no hay búsqueda)
    const isVisible = searchTerm ? true : isPartidaVisible(partida);

    return matchesSearch && isVisible;
  });

  // Debug del filtrado
  console.log('🔍 DEBUG Filtrado:', {
    enrichedPartidasCount: enrichedPartidas.length,
    filteredPartidasCount: filteredPartidas.length,
    searchTerm,
    expandedItemsSize: expandedItems.size,
    expandedItems: Array.from(expandedItems),
    sampleEnrichedPartida: enrichedPartidas[0],
    sampleFilteredPartida: filteredPartidas[0]
  });

  // Paginación
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedPartidas = filteredPartidas.slice(startIndex, endIndex);
  const totalPages = Math.ceil(filteredPartidas.length / itemsPerPage);

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Cargando cronograma...</span>
        </div>
      </div>
    );
  }

  if (error || !cronograma) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="text-center py-8">
          <p className="text-red-600 mb-4">Error al cargar el cronograma</p>
          <p className="text-sm text-gray-500">{error?.message || 'Cronograma no encontrado'}</p>
          <Button variant="secondary" onClick={() => navigate(-1)} className="mt-4">
            Volver
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="secondary" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {cronograma.nombre_cronograma}
            </h1>
            <p className="text-gray-600 mt-1">
              Comisaría {cronograma.comisaria_id} - Detalles completos del cronograma
            </p>
          </div>
        </div>
        <div className="flex space-x-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/cronograma/historial/${cronograma.comisaria_id}`)}
          >
            <Eye className="h-4 w-4 mr-2" />
            Ver Historial
          </Button>
          <Button variant="primary" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Resumen del cronograma */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Resumen del Cronograma</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-xl font-bold text-blue-600">
                {cronograma.total_partidas}
              </div>
              <div className="text-xs text-gray-600">Total Partidas</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-lg font-bold text-green-600">
                {formatCurrency(calcularPresupuestoTotal())}
              </div>
              <div className="text-xs text-gray-600">Presupuesto Total</div>
            </div>

            {/* Avance Programado */}
            <div className="text-center p-4 bg-cyan-50 rounded-lg border-2 border-cyan-200">
              <div className="text-xl font-bold text-cyan-600">
                {(() => {
                  const avanceTotal = calcularAvanceProgramadoTotal();
                  return avanceTotal !== null ? formatPercentage(avanceTotal) : '—';
                })()}
              </div>
              <div className="text-xs text-gray-600 font-medium">📅 Avance Programado</div>
              {isLoadingProgramado && <div className="text-xs text-cyan-500 mt-1">Cargando...</div>}
              {errorProgramado && <div className="text-xs text-red-500 mt-1">Error</div>}
            </div>

            {/* Avance Físico */}
            <div className="text-center p-4 bg-orange-50 rounded-lg border-2 border-orange-200">
              <div className="text-xl font-bold text-orange-600">
                {(() => {
                  const avanceTotal = calcularAvanceFisicoTotal();
                  return avanceTotal !== null ? formatPercentage(avanceTotal) : '—';
                })()}
              </div>
              <div className="text-xs text-gray-600 font-medium">🏗️ Avance Físico</div>
              {(isLoadingAvanceFisico || isLoadingDetalles) && <div className="text-xs text-orange-500 mt-1">Cargando...</div>}
              {(errorAvanceFisico || errorDetalles) && <div className="text-xs text-red-500 mt-1">Error</div>}
            </div>

            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-sm font-semibold text-yellow-700">
                {(() => {
                  // Usar fecha del cronograma o calcular desde partidas
                  const fechaCronograma = cronograma.fecha_inicio_obra;
                  const fechaCalculada = calcularFechaInicioCronograma();
                  const fechaFinal = fechaCronograma || fechaCalculada;

                  if (!fechaFinal) return 'Sin fecha';
                  const fecha = new Date(fechaFinal);
                  if (isNaN(fecha.getTime())) return 'Sin fecha';
                  return fecha.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
                })()}
              </div>
              <div className="text-xs text-gray-600">Fecha Inicio</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-sm font-semibold text-purple-700">
                {(() => {
                  // Usar fecha del cronograma o calcular desde partidas
                  const fechaCronograma = cronograma.fecha_fin_obra;
                  const fechaCalculada = calcularFechaFinCronograma();
                  const fechaFinal = fechaCronograma || fechaCalculada;

                  if (!fechaFinal) return 'Sin fecha';
                  const fecha = new Date(fechaFinal);
                  if (isNaN(fecha.getTime())) return 'Sin fecha';
                  return fecha.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
                })()}
              </div>
              <div className="text-xs text-gray-600">Fecha Fin</div>
            </div>
          </div>

          {/* Información adicional */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4" />
              <span>Archivo: {cronograma.archivo_original}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4" />
              <span>Importado: {formatDate(cronograma.fecha_importacion)}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="font-medium">
                {(() => {
                  const avanceProg = calcularAvanceProgramadoTotal();
                  const avanceFis = calcularAvanceFisicoTotal();
                  if (avanceProg !== null && avanceFis !== null) {
                    const diferencia = avanceFis - avanceProg;
                    if (diferencia > 0.05) return '🟢 Adelantado';
                    if (diferencia < -0.05) return '🔴 Retrasado';
                    return '🟡 En tiempo';
                  }
                  return '⚪ Sin datos';
                })()}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Búsqueda y filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Partidas del Cronograma</span>
            <Badge variant="secondary">{filteredPartidas.length} de {cronograma.total_partidas}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Buscar por código o descripción..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1); // Reset to first page on search
                  }}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Controles de expansión */}
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={expandAll}>
                <ChevronDown className="h-4 w-4 mr-1" />
                Expandir Todo
              </Button>
              <Button variant="outline" size="sm" onClick={collapseAll}>
                <ChevronRight className="h-4 w-4 mr-1" />
                Colapsar Todo
              </Button>
            </div>

            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Filtros
            </Button>
          </div>

          {/* Tabla de partidas */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left p-3 font-medium text-gray-900">Código</th>
                  <th className="text-left p-3 font-medium text-gray-900">Descripción</th>
                  <th className="text-center p-3 font-medium text-gray-900">Unidad</th>
                  <th className="text-right p-3 font-medium text-gray-900">Metrado</th>
                  <th className="text-right p-3 font-medium text-gray-900">P.U.</th>
                  <th className="text-right p-3 font-medium text-gray-900">Total</th>
                  <th className="text-center p-3 font-medium text-gray-900 bg-blue-50">
                    📅 Avance Programado
                    {isLoadingProgramado && <div className="text-xs text-blue-500">Cargando...</div>}
                    {errorProgramado && <div className="text-xs text-red-500">Error</div>}
                  </th>
                  <th className="text-center p-3 font-medium text-gray-900 bg-green-50">
                    🏗️ Avance Físico
                    {(isLoadingAvanceFisico || isLoadingDetalles) && <div className="text-xs text-green-500">Cargando...</div>}
                    {(errorAvanceFisico || errorDetalles) && <div className="text-xs text-red-500">Error</div>}
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedPartidas.map((partida, index) => (
                  <tr
                    key={partida.codigo_partida}
                    className={`border-b border-gray-100 hover:bg-gray-50 ${
                      index % 2 === 0 ? 'bg-white' : 'bg-gray-25'
                    } ${
                      partida.nivel_jerarquia <= 2 ? 'bg-blue-25 font-medium' : ''
                    }`}
                  >
                    <td className="p-3">
                      <div className="flex items-center space-x-2">
                        {/* Indentación visual basada en nivel */}
                        <div
                          className="flex-shrink-0"
                          style={{ marginLeft: `${(partida.nivel_jerarquia - 1) * 16}px` }}
                        >
                          <div className="flex items-center space-x-2">
                            {/* Botón de expansión para partidas que tienen hijos */}
                            {hasChildren(partida.codigo_partida, enrichedPartidas) && (
                              <button
                                onClick={() => toggleExpansion(partida.codigo_partida)}
                                className="p-1 hover:bg-gray-200 rounded transition-colors"
                              >
                                {expandedItems.has(partida.codigo_partida) ? (
                                  <ChevronDown className="h-4 w-4 text-gray-600" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-gray-600" />
                                )}
                              </button>
                            )}

                            {/* Si no tiene hijos, espacio en blanco */}
                            {!hasChildren(partida.codigo_partida, enrichedPartidas) && (
                              <div className="w-6 h-6"></div>
                            )}

                            <code className={`text-sm font-mono px-2 py-1 rounded font-semibold ${
                              partida.nivel_jerarquia === 1
                                ? 'bg-purple-600 text-white'
                                : partida.nivel_jerarquia === 2
                                ? 'bg-blue-600 text-white'
                                : partida.nivel_jerarquia === 3
                                ? 'bg-green-600 text-white'
                                : 'bg-orange-600 text-white'
                            }`}>
                              {partida.codigo_partida}
                            </code>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="max-w-md">
                        <div className={`text-sm ${
                          partida.nivel_jerarquia <= 2
                            ? 'font-semibold text-gray-900 text-base'
                            : 'font-medium text-gray-900'
                        }`}>
                          {partida.descripcion}
                        </div>
                        <div className="text-xs text-gray-500 mt-1 flex items-center space-x-2">
                          <span>Nivel {partida.nivel_jerarquia}</span>
                          {partida.nivel_jerarquia <= 2 && (
                            <Badge variant="outline" className="text-xs bg-yellow-100">
                              📁 Agrupación
                            </Badge>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Unidad - Solo para partidas finales */}
                    <td className="p-3 text-center">
                      {partida.nivel_jerarquia >= 3 ? (
                        <Badge variant="outline" className="text-xs">
                          {partida.unidad || 'UND'}
                        </Badge>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>

                    {/* Metrado - Solo para partidas finales */}
                    <td className="p-3 text-right font-mono text-sm text-gray-800">
                      {partida.nivel_jerarquia >= 3 && partida.metrado > 0 ? (
                        partida.metrado.toLocaleString('es-PE', { minimumFractionDigits: 2 })
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>

                    {/* Precio Unitario - Solo para partidas finales */}
                    <td className="p-3 text-right font-mono text-sm text-gray-800">
                      {partida.nivel_jerarquia >= 3 && partida.precio_unitario > 0 ? (
                        formatCurrency(partida.precio_unitario)
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>

                    {/* Precio Total - Coordinado con el color del código */}
                    <td className="p-3 text-right font-mono text-sm font-semibold text-gray-800">
                      <div className={`${
                        partida.nivel_jerarquia === 1
                          ? 'text-lg font-bold text-purple-700 bg-purple-50 px-2 py-1 rounded border border-purple-200'
                          : partida.nivel_jerarquia === 2
                          ? 'text-base font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-200'
                          : partida.nivel_jerarquia === 3
                          ? 'text-sm font-semibold text-green-700 bg-green-50 px-1 py-0.5 rounded'
                          : 'text-sm font-medium text-orange-700'
                      }`}>
                        {formatCurrency(partida.precio_total)}
                      </div>
                    </td>

                    {/* Avance Programado */}
                    <td className="p-3 text-center bg-blue-25">
                      {(() => {
                        const avanceProg = getAvanceProgramadoPartida(partida.codigo_partida);
                        if (avanceProg === null) {
                          return <span className="text-gray-400 text-sm">—</span>;
                        }
                        return (
                          <div className="flex items-center justify-center">
                            <div className={`px-2 py-1 rounded text-sm font-medium ${
                              avanceProg >= 1.0
                                ? 'bg-blue-600 text-white'
                                : avanceProg >= 0.8
                                ? 'bg-blue-500 text-white'
                                : avanceProg >= 0.5
                                ? 'bg-blue-400 text-white'
                                : avanceProg >= 0.2
                                ? 'bg-blue-300 text-blue-900'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {formatPercentage(avanceProg)}
                            </div>
                          </div>
                        );
                      })()}
                    </td>

                    {/* Avance Físico */}
                    <td className="p-3 text-center bg-green-25">
                      {(() => {
                        const avanceFis = getAvanceFisicoPartida(partida.codigo_partida);
                        if (avanceFis === null) {
                          return <span className="text-gray-400 text-sm">—</span>;
                        }
                        return (
                          <div className="flex items-center justify-center">
                            <div className={`px-2 py-1 rounded text-sm font-medium ${
                              avanceFis >= 1.0
                                ? 'bg-green-600 text-white'
                                : avanceFis >= 0.8
                                ? 'bg-green-500 text-white'
                                : avanceFis >= 0.5
                                ? 'bg-green-400 text-white'
                                : avanceFis >= 0.2
                                ? 'bg-green-300 text-green-900'
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {formatPercentage(avanceFis)}
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                Mostrando {startIndex + 1}-{Math.min(endIndex, filteredPartidas.length)} de {filteredPartidas.length} partidas
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(currentPage - 1)}
                >
                  Anterior
                </Button>
                <span className="text-sm text-gray-600">
                  Página {currentPage} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(currentPage + 1)}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}