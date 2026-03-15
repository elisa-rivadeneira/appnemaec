/**
 * 📊 CRONOGRAMA VIEW - NEMAEC ERP
 * Componente para visualizar cronogramas valorizados con vista jerárquica mejorada
 */

import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { CronogramaValorizado, Partida } from '@/types/cronograma';
import { useUpdatePartidaFechas } from '@/hooks/useCronograma';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Badge } from '@/components/ui/badge';
import {
  ChevronDown,
  ChevronRight,
  Search,
  Filter,
  Download,
  Edit3,
  Check,
  X
} from 'lucide-react';

interface CronogramaViewProps {
  cronograma: CronogramaValorizado;
  onUploadNew?: () => void;
  onViewFullProgress?: () => void;
}

export const CronogramaView: React.FC<CronogramaViewProps> = ({
  cronograma,
  onUploadNew,
  onViewFullProgress
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [editingPartida, setEditingPartida] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<'fecha_inicio' | 'fecha_fin' | null>(null);
  const [editFechas, setEditFechas] = useState<{fecha_inicio: string; fecha_fin: string}>({ fecha_inicio: '', fecha_fin: '' });
  const itemsPerPage = 1000; // Mostrar todo en una página para el árbol

  const updateFechasMutation = useUpdatePartidaFechas();

  const handleExport = () => {
    // Fila 1: encabezados (el backend los ignora, empieza a leer desde fila 2)
    const headers = ['N°', 'COD_INTERNO', 'REFERENCIA', 'COD_PARTIDA', 'DESCRIPCION', 'REF2', 'METRADO', 'PRECIO_UNIT', 'PRECIO_TOTAL', 'UNIDAD', 'FECHA_INICIO', 'FECHA_FIN'];

    const rows = cronograma.partidas.map((p, i) => [
      i + 1,                          // A: N°
      p.codigo_partida || '',          // B: COD_INTERNO
      '',                              // C: ignorado
      p.codigo_partida || '',          // D: COD_PARTIDA (requerido)
      p.descripcion || '',             // E: DESCRIPCION (requerido)
      '',                              // F: ignorado
      p.metrado ?? '',                 // G: METRADO
      p.precio_unitario ?? '',         // H: PRECIO_UNIT
      p.precio_total ?? '',            // I: PRECIO_TOTAL
      p.unidad || '',                  // J: UNIDAD
      p.fecha_inicio ? p.fecha_inicio.slice(0, 10) : '',  // K: FECHA_INICIO
      p.fecha_fin    ? p.fecha_fin.slice(0, 10)    : '',  // L: FECHA_FIN
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    // Anchos de columna
    ws['!cols'] = [
      { wch: 5 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 50 },
      { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 8 },
      { wch: 14 }, { wch: 14 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'CRONOGRAMA');

    const nombreArchivo = `cronograma_${cronograma.nombre?.replace(/\s+/g, '_') || 'export'}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, nombreArchivo);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-PE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateShort = (dateString: string | null | undefined) => {
    // 🎯 MANEJO INTELIGENTE DE FECHAS
    if (!dateString) {
      return <span className="text-gray-400 italic text-xs">Sin programar</span>;
    }

    try {
      const date = new Date(dateString);
      // Verificar si es una fecha válida
      if (isNaN(date.getTime())) {
        return <span className="text-gray-400 italic text-xs">Sin programar</span>;
      }

      return date.toLocaleDateString('es-PE', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit'
      });
    } catch (error) {
      return <span className="text-gray-400 italic text-xs">Sin programar</span>;
    }
  };

  const calcularDuracion = (fechaInicio: string | null | undefined, fechaFin: string | null | undefined): string | React.ReactElement => {
    // 🎯 MANEJO INTELIGENTE DE DURACIÓN
    if (!fechaInicio || !fechaFin) {
      return <span className="text-gray-400 italic text-xs">Pendiente</span>;
    }

    try {
      const inicio = new Date(fechaInicio);
      const fin = new Date(fechaFin);

      // Verificar si son fechas válidas
      if (isNaN(inicio.getTime()) || isNaN(fin.getTime())) {
        return <span className="text-gray-400 italic text-xs">Pendiente</span>;
      }

      const diffTime = Math.abs(fin.getTime() - inicio.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return '1 día';
      if (diffDays < 30) return `${diffDays} días`;
      if (diffDays < 365) {
        const meses = Math.round(diffDays / 30);
        return `${meses} mes${meses > 1 ? 'es' : ''}`;
      }
      const años = Math.round(diffDays / 365);
      return `${años} año${años > 1 ? 's' : ''}`;
    } catch (error) {
      return <span className="text-gray-400 italic text-xs">Pendiente</span>;
    }
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

  // Funciones para edición de fechas
  const handleEditFechas = (partida: any, field: 'fecha_inicio' | 'fecha_fin') => {
    setEditingPartida(partida.id);
    setEditingField(field);
    setEditFechas({
      fecha_inicio: partida.fecha_inicio ? partida.fecha_inicio.split('T')[0] : '',
      fecha_fin: partida.fecha_fin ? partida.fecha_fin.split('T')[0] : ''
    });
  };

  const handleSaveFechas = async (partidaId: number) => {
    try {
      const fechasToUpdate: { fecha_inicio?: string; fecha_fin?: string } = {};

      if (editFechas.fecha_inicio) {
        fechasToUpdate.fecha_inicio = editFechas.fecha_inicio + 'T00:00:00Z';
      }
      if (editFechas.fecha_fin) {
        fechasToUpdate.fecha_fin = editFechas.fecha_fin + 'T00:00:00Z';
      }

      await updateFechasMutation.mutateAsync({
        partidaId,
        fechas: fechasToUpdate
      });

      setEditingPartida(null);
      setEditingField(null);
    } catch (error) {
      console.error('Error actualizando fechas:', error);
      alert('Error al actualizar las fechas');
    }
  };

  const handleCancelEdit = () => {
    setEditingPartida(null);
    setEditingField(null);
    setEditFechas({ fecha_inicio: '', fecha_fin: '' });
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
    // Solo hojas (sin hijos dentro del subárbol)
    return descendientes
      .filter(p => !descendientes.some(o => o.codigo_partida.startsWith(p.codigo_partida + '.')))
      .reduce((sum, p) => sum + getPrecioEfectivo(p), 0);
  };

  // Obtener fechas min/max de las hojas descendientes de un padre
  const calcularFechasPadre = (codigoPadre: string, todasLasPartidas: any[]) => {
    const descendientes = todasLasPartidas.filter(p =>
      p.codigo_partida.startsWith(codigoPadre + '.') && p.codigo_partida !== codigoPadre
    );
    const hojas = descendientes.filter(p =>
      !descendientes.some(o => o.codigo_partida.startsWith(p.codigo_partida + '.'))
    );
    const fechasIni = hojas.map(p => p.fecha_inicio).filter(Boolean);
    const fechasFin = hojas.map(p => p.fecha_fin).filter(Boolean);
    return {
      fecha_inicio: fechasIni.length > 0 ? fechasIni.reduce((a, b) => a < b ? a : b) : null,
      fecha_fin: fechasFin.length > 0 ? fechasFin.reduce((a, b) => a > b ? a : b) : null,
    };
  };

  // Enriquecer partidas con totales y fechas calculados
  const enrichedPartidas = cronograma?.partidas?.map(partida => {
    const tieneHijos = cronograma.partidas.some((p: any) =>
      p.codigo_partida.startsWith(partida.codigo_partida + '.')
    );
    if (tieneHijos) {
      const fechas = (!partida.fecha_inicio || !partida.fecha_fin)
        ? calcularFechasPadre(partida.codigo_partida, cronograma.partidas)
        : {};
      return {
        ...partida,
        precio_total: calcularTotalPadre(partida.codigo_partida, cronograma.partidas),
        ...fechas,
      };
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

  // Paginación
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedPartidas = filteredPartidas.slice(startIndex, endIndex);

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Header del cronograma */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              📊 {cronograma.nombre_cronograma}
            </h3>
            <div className="flex items-center gap-6 mt-2 text-sm text-gray-600">
              <span>
                <strong>{cronograma.total_partidas}</strong> partidas
              </span>
              <span>
                Presupuesto: <strong className="text-black">
                  {formatCurrency(cronograma.total_presupuesto)}
                </strong>
              </span>
              <span>
                {formatDate(cronograma.fecha_inicio_obra)} - {formatDate(cronograma.fecha_fin_obra)}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {onViewFullProgress && (
              <Button variant="outline" size="sm" onClick={onViewFullProgress}>
                📊 Ver Avances Completos
              </Button>
            )}
            {onUploadNew && (
              <Button variant="primary" size="sm" onClick={onUploadNew}>
                📤 Subir nuevo
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Controles de búsqueda y expansión */}
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Buscar por código o descripción..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
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

          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Tabla de partidas */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left p-3 font-medium text-gray-900">Código</th>
              <th className="text-left p-3 font-medium text-gray-900">Descripción</th>
              <th className="text-center p-3 font-medium text-gray-900">Unidad</th>
              <th className="text-right p-3 font-medium text-gray-900">Metrado</th>
              <th className="text-right p-3 font-medium text-gray-900">P.U.</th>
              <th className="text-right p-3 font-medium text-gray-900">Total</th>
              <th className="text-center p-3 font-medium text-gray-900">📅 Inicio</th>
              <th className="text-center p-3 font-medium text-gray-900">🏁 Fin</th>
              <th className="text-center p-3 font-medium text-gray-900">⏱️ Duración</th>
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
                  {!hasChildren(partida.codigo_partida, enrichedPartidas) ? (
                    <Badge variant="outline" className="text-xs">
                      {partida.unidad || 'UND'}
                    </Badge>
                  ) : (
                    <span className="text-gray-400 text-xs">—</span>
                  )}
                </td>

                {/* Metrado - Solo para partidas finales */}
                <td className="p-3 text-right font-mono text-sm text-gray-800">
                  {!hasChildren(partida.codigo_partida, enrichedPartidas) && partida.metrado > 0 ? (
                    partida.metrado.toLocaleString('es-PE', { minimumFractionDigits: 2 })
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>

                {/* Precio Unitario - Solo para partidas finales */}
                <td className="p-3 text-right font-mono text-sm text-gray-800">
                  {!hasChildren(partida.codigo_partida, enrichedPartidas) && partida.precio_unitario > 0 ? (
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

                {/* Fecha de Inicio */}
                <td className="p-3 text-center text-sm">
                  {editingPartida === partida.id && editingField === 'fecha_inicio' ? (
                    <div className="flex flex-col items-center space-y-1">
                      <label className="text-xs text-gray-600 font-medium">Inicio</label>
                      <input
                        type="date"
                        value={editFechas.fecha_inicio}
                        onChange={(e) => setEditFechas(prev => ({ ...prev, fecha_inicio: e.target.value }))}
                        className="text-xs border border-gray-300 rounded px-2 py-1 w-32"
                      />
                      <div className="flex items-center space-x-1 mt-1">
                        <button
                          onClick={() => handleSaveFechas(partida.id)}
                          className="p-1 rounded text-green-600 hover:text-green-700 hover:bg-green-50 transition-colors"
                          title="Guardar"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="p-1 rounded text-red-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Cancelar"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ) : editingPartida === partida.id && editingField === 'fecha_fin' ? (
                    <div className="flex flex-col items-center space-y-1">
                      <label className="text-xs text-gray-600 font-medium">Inicio</label>
                      <input
                        type="date"
                        value={editFechas.fecha_inicio}
                        onChange={(e) => setEditFechas(prev => ({ ...prev, fecha_inicio: e.target.value }))}
                        className="text-xs border border-gray-300 rounded px-2 py-1 w-32"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center space-x-1">
                      <div className="flex flex-col items-center">
                        {partida.fecha_inicio && partida.fecha_inicio !== '1970-01-01T00:00:00.000Z' ? (
                          <>
                            <span className="font-mono text-gray-700">
                              {formatDateShort(partida.fecha_inicio)}
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatDate(partida.fecha_inicio).split(' ')[1]} {formatDate(partida.fecha_inicio).split(' ')[2]}
                            </span>
                          </>
                        ) : (
                          <span className="text-gray-400 text-xs">Sin fecha</span>
                        )}
                      </div>
                      {!hasChildren(partida.codigo_partida, enrichedPartidas) && (
                        <button
                          onClick={() => handleEditFechas(partida, 'fecha_inicio')}
                          className="p-1 rounded text-gray-400 hover:text-blue-600 transition-colors"
                          title="Editar fecha inicio"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                </td>

                {/* Fecha de Fin */}
                <td className="p-3 text-center text-sm">
                  {editingPartida === partida.id && editingField === 'fecha_fin' ? (
                    <div className="flex flex-col items-center space-y-1">
                      <label className="text-xs text-gray-600 font-medium">Fin</label>
                      <input
                        type="date"
                        value={editFechas.fecha_fin}
                        onChange={(e) => setEditFechas(prev => ({ ...prev, fecha_fin: e.target.value }))}
                        className="text-xs border border-gray-300 rounded px-2 py-1 w-32"
                      />
                      <div className="flex items-center space-x-1 mt-1">
                        <button
                          onClick={() => handleSaveFechas(partida.id)}
                          className="p-1 rounded text-green-600 hover:text-green-700 hover:bg-green-50 transition-colors"
                          title="Guardar"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="p-1 rounded text-red-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Cancelar"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ) : editingPartida === partida.id && editingField === 'fecha_inicio' ? (
                    <div className="flex flex-col items-center space-y-1">
                      <label className="text-xs text-gray-600 font-medium">Fin</label>
                      <input
                        type="date"
                        value={editFechas.fecha_fin}
                        onChange={(e) => setEditFechas(prev => ({ ...prev, fecha_fin: e.target.value }))}
                        className="text-xs border border-gray-300 rounded px-2 py-1 w-32"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center space-x-1">
                      <div className="flex flex-col items-center">
                        {partida.fecha_fin && partida.fecha_fin !== '1970-01-01T00:00:00.000Z' ? (
                          <>
                            <span className="font-mono text-gray-700">
                              {formatDateShort(partida.fecha_fin)}
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatDate(partida.fecha_fin).split(' ')[1]} {formatDate(partida.fecha_fin).split(' ')[2]}
                            </span>
                          </>
                        ) : (
                          <span className="text-gray-400 text-xs">Sin fecha</span>
                        )}
                      </div>
                      {!hasChildren(partida.codigo_partida, enrichedPartidas) && (
                        <button
                          onClick={() => handleEditFechas(partida, 'fecha_fin')}
                          className="p-1 rounded text-gray-400 hover:text-blue-600 transition-colors"
                          title="Editar fecha fin"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                </td>

                {/* Duración */}
                <td className="p-3 text-center text-sm">
                  {editingPartida === partida.id ? (
                    <span className="text-gray-400 text-xs italic">Editando...</span>
                  ) : (
                    partida.fecha_inicio && partida.fecha_fin &&
                    partida.fecha_inicio !== '1970-01-01T00:00:00.000Z' &&
                    partida.fecha_fin !== '1970-01-01T00:00:00.000Z' ? (
                      <div className="flex flex-col items-center">
                        <span className="font-semibold text-blue-600">
                          {calcularDuracion(partida.fecha_inicio, partida.fecha_fin)}
                        </span>
                        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                          <div
                            className="bg-blue-500 h-1.5 rounded-full"
                            style={{
                              width: `${Math.min(100, Math.max(10,
                                (new Date(partida.fecha_fin).getTime() - new Date(partida.fecha_inicio).getTime()) /
                                (1000 * 60 * 60 * 24 * 30) * 20
                              ))}%`
                            }}
                          ></div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredPartidas.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No hay partidas que coincidan
          </h3>
          <p className="text-gray-500">
            Intenta ajustar los filtros de búsqueda
          </p>
        </div>
      )}

      {/* Footer con resumen */}
      {filteredPartidas.length > 0 && (
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <div className="flex justify-between items-center text-sm">
            <div className="text-gray-600">
              Mostrando {filteredPartidas.length} de {cronograma.total_partidas} partidas
            </div>
            <div className="font-semibold text-black">
              Total filtrado: {formatCurrency(
                filteredPartidas.reduce((sum, p) => sum + p.precio_total, 0)
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};