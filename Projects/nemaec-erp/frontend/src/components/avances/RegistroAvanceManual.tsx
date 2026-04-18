import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CalendarIcon, SaveIcon, PlusIcon, MinusIcon } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface PartidaConAvance {
  id: number;
  codigo: string;
  descripcion: string;
  unidad: string;
  metrado: number;
  precio_unitario: number;
  parcial: number;
  porcentaje_avance_actual: number;
  porcentaje_programado: number;
  monto_ejecutado: number;
  es_ejecutable: boolean;
  estado: string;
}

interface AvancePartida {
  codigo_partida: string;
  porcentaje_avance_adicional: number;
  observaciones?: string;
}

interface InformacionSemana {
  semana_actual: number;
  dia_actual: number;
  fecha_actual: string;
  fecha_inicio_proyecto: string;
  dias_transcurridos: number;
}

interface RegistroAvanceManualProps {
  comisariaId: number;
  onSave?: (response: any) => void;
}

export default function RegistroAvanceManual({ comisariaId, onSave }: RegistroAvanceManualProps) {
  const [partidas, setPartidas] = useState<PartidaConAvance[]>([]);
  const [informacionSemana, setInformacionSemana] = useState<InformacionSemana | null>(null);
  const [fechaReporte, setFechaReporte] = useState(new Date().toISOString().split('T')[0]);
  const [observacionesGenerales, setObservacionesGenerales] = useState('');
  const [monitorResponsable, setMonitorResponsable] = useState('');
  const [avancesPartidas, setAvancesPartidas] = useState<Map<string, AvancePartida>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtroPartida, setFiltroPartida] = useState('');

  useEffect(() => {
    cargarDatos();
  }, [comisariaId]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);

      // Cargar información de la semana
      const responseSemana = await fetch(`/api/v1/avances/semana-actual/${comisariaId}`);
      if (!responseSemana.ok) {
        throw new Error('Error al cargar información de semana');
      }
      const dataSemana = await responseSemana.json();
      setInformacionSemana(dataSemana);

      // Cargar partidas
      const responsePartidas = await fetch(`/api/v1/avances/partidas/${comisariaId}`);
      if (!responsePartidas.ok) {
        throw new Error('Error al cargar partidas');
      }
      const dataPartidas = await responsePartidas.json();
      setPartidas(dataPartidas);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const agregarAvancePartida = (partidaCodigo: string) => {
    setAvancesPartidas(prev => {
      const newMap = new Map(prev);
      newMap.set(partidaCodigo, {
        codigo_partida: partidaCodigo,
        porcentaje_avance_adicional: 0,
        observaciones: ''
      });
      return newMap;
    });
  };

  const removerAvancePartida = (partidaCodigo: string) => {
    setAvancesPartidas(prev => {
      const newMap = new Map(prev);
      newMap.delete(partidaCodigo);
      return newMap;
    });
  };

  const actualizarAvancePartida = (partidaCodigo: string, campo: keyof AvancePartida, valor: string | number) => {
    setAvancesPartidas(prev => {
      const newMap = new Map(prev);
      const avanceExistente = newMap.get(partidaCodigo);
      if (avanceExistente) {
        newMap.set(partidaCodigo, {
          ...avanceExistente,
          [campo]: valor
        });
      }
      return newMap;
    });
  };

  const registrarAvances = async () => {
    try {
      setLoading(true);
      setError(null);

      const avancesArray = Array.from(avancesPartidas.values()).filter(
        avance => avance.porcentaje_avance_adicional > 0
      );

      if (avancesArray.length === 0) {
        setError('Debe agregar al menos una partida con avance');
        return;
      }

      const payload = {
        comisaria_id: comisariaId,
        fecha_reporte: fechaReporte,
        partidas_avance: avancesArray,
        observaciones_generales: observacionesGenerales || undefined,
        monitor_responsable: monitorResponsable || undefined
      };

      const response = await fetch('/api/v1/avances/registrar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Error al registrar avances');
      }

      const result = await response.json();

      // Limpiar formulario
      setAvancesPartidas(new Map());
      setObservacionesGenerales('');
      setMonitorResponsable('');

      // Recargar datos para ver los nuevos avances
      await cargarDatos();

      if (onSave) {
        onSave(result);
      }

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error al registrar avances');
    } finally {
      setLoading(false);
    }
  };

  const partidasFiltradas = partidas.filter(partida =>
    partida.codigo.toLowerCase().includes(filtroPartida.toLowerCase()) ||
    partida.descripcion.toLowerCase().includes(filtroPartida.toLowerCase())
  );

  const calcularNuevoAvance = (partidaCodigo: string): number => {
    const partida = partidas.find(p => p.codigo === partidaCodigo);
    const avance = avancesPartidas.get(partidaCodigo);
    if (!partida || !avance) return 0;
    return Math.min(100, partida.porcentaje_avance_actual + avance.porcentaje_avance_adicional);
  };

  if (loading && !informacionSemana) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Cargando información...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5" />
            Registro Manual de Avances Físicos
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Registre los avances realizados en las partidas durante una fecha específica
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Información de contexto */}
          {informacionSemana && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-blue-50 rounded-lg">
              <div>
                <Label className="text-sm font-medium">Semana del Proyecto</Label>
                <p className="text-lg font-semibold text-blue-600">Semana {informacionSemana.semana_actual}</p>
              </div>
              <div>
                <Label className="text-sm font-medium">Día de la Semana</Label>
                <p className="text-lg font-semibold">{['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'][informacionSemana.dia_actual - 1]}</p>
              </div>
              <div>
                <Label className="text-sm font-medium">Días Transcurridos</Label>
                <p className="text-lg font-semibold">{informacionSemana.dias_transcurridos} días</p>
              </div>
              <div>
                <Label className="text-sm font-medium">Inicio Proyecto</Label>
                <p className="text-sm">{format(new Date(informacionSemana.fecha_inicio_proyecto), 'dd/MM/yyyy', { locale: es })}</p>
              </div>
            </div>
          )}

          {/* Formulario principal */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="fecha_reporte">Fecha del Reporte</Label>
              <Input
                id="fecha_reporte"
                type="date"
                value={fechaReporte}
                onChange={(e) => setFechaReporte(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div>
              <Label htmlFor="monitor_responsable">Monitor Responsable</Label>
              <Input
                id="monitor_responsable"
                placeholder="Nombre del monitor"
                value={monitorResponsable}
                onChange={(e) => setMonitorResponsable(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="filtro_partida">Buscar Partida</Label>
              <Input
                id="filtro_partida"
                placeholder="Código o descripción..."
                value={filtroPartida}
                onChange={(e) => setFiltroPartida(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="observaciones_generales">Observaciones Generales</Label>
            <Textarea
              id="observaciones_generales"
              placeholder="Observaciones sobre el avance del día..."
              value={observacionesGenerales}
              onChange={(e) => setObservacionesGenerales(e.target.value)}
              rows={3}
            />
          </div>

          {/* Tabla de partidas */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Partidas con Avance</h3>
              <span className="text-sm text-muted-foreground">
                {avancesPartidas.size} partidas seleccionadas
              </span>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left p-3 border-b text-gray-900 font-medium">Código</th>
                      <th className="text-left p-3 border-b text-gray-900 font-medium">Descripción</th>
                      <th className="text-right p-3 border-b text-gray-900 font-medium">Avance Actual</th>
                      <th className="text-right p-3 border-b text-gray-900 font-medium">Avance Programado</th>
                      <th className="text-right p-3 border-b text-gray-900 font-medium">Avance Adicional</th>
                      <th className="text-right p-3 border-b text-gray-900 font-medium">Nuevo Avance</th>
                      <th className="text-center p-3 border-b text-gray-900 font-medium">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partidasFiltradas.map((partida) => {
                      const tieneAvance = avancesPartidas.has(partida.codigo);
                      const avance = avancesPartidas.get(partida.codigo);
                      const nuevoAvance = calcularNuevoAvance(partida.codigo);

                      return (
                        <tr key={partida.id} className={tieneAvance ? 'bg-green-50' : 'hover:bg-gray-50'}>
                          <td className="p-3 border-b font-mono text-xs text-gray-900">{partida.codigo}</td>
                          <td className="p-3 border-b text-gray-900">
                            <div className="max-w-xs truncate" title={partida.descripcion}>
                              {partida.descripcion}
                            </div>
                          </td>
                          <td className="p-3 border-b text-right">
                            <span className={`px-2 py-1 rounded text-xs ${
                              partida.porcentaje_avance_actual > 0 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {partida.porcentaje_avance_actual.toFixed(1)}%
                            </span>
                          </td>
                          <td className="p-3 border-b text-right">
                            <span className="text-xs text-gray-800 bg-gray-100 px-2 py-1 rounded">
                              {partida.porcentaje_programado.toFixed(1)}%
                            </span>
                          </td>
                          <td className="p-3 border-b text-right">
                            {tieneAvance ? (
                              <div className="space-y-2">
                                <Input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.1"
                                  value={avance?.porcentaje_avance_adicional || 0}
                                  onChange={(e) => actualizarAvancePartida(
                                    partida.codigo,
                                    'porcentaje_avance_adicional',
                                    parseFloat(e.target.value) || 0
                                  )}
                                  className="w-20 h-8 text-center"
                                />
                                <Input
                                  placeholder="Observaciones..."
                                  value={avance?.observaciones || ''}
                                  onChange={(e) => actualizarAvancePartida(
                                    partida.codigo,
                                    'observaciones',
                                    e.target.value
                                  )}
                                  className="text-xs"
                                />
                              </div>
                            ) : (
                              <span className="text-gray-500 text-center">-</span>
                            )}
                          </td>
                          <td className="p-3 border-b text-right">
                            {tieneAvance ? (
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                nuevoAvance > partida.porcentaje_avance_actual
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-600'
                              }`}>
                                {nuevoAvance.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-gray-500 text-center">-</span>
                            )}
                          </td>
                          <td className="p-3 border-b text-center">
                            {tieneAvance ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => removerAvancePartida(partida.codigo)}
                                className="h-8 w-8 p-0"
                              >
                                <MinusIcon className="w-4 h-4" />
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => agregarAvancePartida(partida.codigo)}
                                className="h-8 w-8 p-0"
                              >
                                <PlusIcon className="w-4 h-4" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex justify-end space-x-4 pt-4 border-t">
            <Button
              onClick={registrarAvances}
              disabled={loading || avancesPartidas.size === 0}
              className="flex items-center gap-2"
            >
              <SaveIcon className="w-4 h-4" />
              {loading ? 'Guardando...' : 'Registrar Avances'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}