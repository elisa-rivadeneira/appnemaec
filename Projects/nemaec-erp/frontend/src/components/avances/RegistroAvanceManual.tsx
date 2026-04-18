import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import DateInputPeru from '@/components/ui/DateInputPeru';
import { CalendarIcon, SaveIcon, PlusIcon, MinusIcon, Play, X, Edit3 } from 'lucide-react';
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

interface InformacionProyecto {
  fecha_inicio_programada: string;
  fecha_inicio_real: string | null;
  fecha_fin_programada: string | null;
  porcentaje_programado: number;
  porcentaje_real: number;
  diferencia: number;
}

interface DetalleAvance {
  id: number;
  codigo_partida: string;
  porcentaje_avance: number;
  monto_ejecutado: number | null;
  observaciones_partida: string | null;
  created_at: string;
}

interface RegistroHistorial {
  id: number;
  comisaria_id: number;
  fecha_reporte: string;
  dias_transcurridos: number | null;
  avance_programado_acum: number | null;
  avance_ejecutado_acum: number;
  observaciones: string | null;
  created_at: string;
  updated_at: string;
  detalles_avances: DetalleAvance[];
}

interface FechaRegistroDetalle {
  fecha: string;
  semana: number;
  numeroRegistros: number;
  registro: RegistroHistorial;
  usuario?: string;
}

interface RegistroAvanceManualProps {
  comisariaId: number;
  onSave?: (response: any) => void;
}

interface PartidaInfo {
  id: number;
  codigo: string;
  descripcion: string;
  unidad: string;
  metrado: number;
  precio_unitario: number;
  parcial: number;
}

export default function RegistroAvanceManual({ comisariaId, onSave }: RegistroAvanceManualProps) {
  const [partidas, setPartidas] = useState<PartidaConAvance[]>([]);
  const [informacionSemana, setInformacionSemana] = useState<InformacionSemana | null>(null);
  const [informacionProyecto, setInformacionProyecto] = useState<InformacionProyecto | null>(null);
  const [fechaReporte, setFechaReporte] = useState(new Date().toISOString().split('T')[0]);
  const [observacionesGenerales, setObservacionesGenerales] = useState('');
  const [monitorResponsable, setMonitorResponsable] = useState('');
  const [avancesPartidas, setAvancesPartidas] = useState<Map<string, AvancePartida>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtroPartida, setFiltroPartida] = useState('');
  const [modoRegistroAvances, setModoRegistroAvances] = useState(false);
  const [mostrarModalFecha, setMostrarModalFecha] = useState(false);
  const [fechaSeleccionada, setFechaSeleccionada] = useState(new Date().toISOString().split('T')[0]);
  const [historialFechas, setHistorialFechas] = useState<FechaRegistroDetalle[]>([]);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const [registroSeleccionado, setRegistroSeleccionado] = useState<RegistroHistorial | null>(null);
  const [mostrarDetalleModal, setMostrarDetalleModal] = useState(false);
  const [avancesEditando, setAvancesEditando] = useState<Map<string, DetalleAvance>>(new Map());
  const [modoEdicion, setModoEdicion] = useState(false);
  const [guardandoAvances, setGuardandoAvances] = useState(false);
  const [partidasInfo, setPartidasInfo] = useState<Map<string, any>>(new Map());
  const [filtroPartidaNueva, setFiltroPartidaNueva] = useState('');
  const [mostrarPartidasDisponibles, setMostrarPartidasDisponibles] = useState(false);

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

      // Crear mapa de información de partidas para usar en el historial
      const mapaPartidas = new Map();
      dataPartidas.forEach((partida: any) => {
        mapaPartidas.set(partida.codigo, partida);
      });
      setPartidasInfo(mapaPartidas);

      // Cargar información adicional del proyecto
      const [responseGraficos, responseHistorial] = await Promise.all([
        fetch(`/api/v1/avances/graficos/${comisariaId}`),
        fetch(`/api/v1/avances/historial/${comisariaId}?limit=50`)
      ]);

      let fechaInicioReal = null;
      let fechaFinProgramada = null;
      let porcentajeProgramado = 0;
      let porcentajeReal = 0;

      // Obtener información de gráficos (fecha fin y porcentajes)
      if (responseGraficos.ok) {
        const dataGraficos = await responseGraficos.json();
        fechaFinProgramada = dataGraficos.proyecto?.fecha_fin_proyecto || null;
        porcentajeProgramado = dataGraficos.avance_actual?.programado || 0;
        porcentajeReal = dataGraficos.avance_actual?.ejecutado || 0;
      }

      // Obtener fecha de inicio real y historial de fechas
      if (responseHistorial.ok) {
        const dataHistorial = await responseHistorial.json();
        const avances = dataHistorial.avances || [];
        if (avances.length > 0) {
          // Los avances vienen ordenados desc, el último es el más antiguo
          fechaInicioReal = avances[avances.length - 1]?.fecha_reporte || null;

          // Procesar historial detallado
          const fechasDetalle: FechaRegistroDetalle[] = avances.map((registro: any) => {
            const fecha = registro.fecha_reporte.split('T')[0];
            const semana = registro.dias_transcurridos ? Math.ceil(registro.dias_transcurridos / 7) : 0;

            return {
              fecha,
              semana,
              numeroRegistros: registro.detalles_avances?.length || 0,
              registro,
              usuario: 'Sistema' // TODO: Obtener del backend cuando esté disponible
            };
          });

          setHistorialFechas(fechasDetalle);
        }
      }

      // Establecer información del proyecto
      setInformacionProyecto({
        fecha_inicio_programada: dataSemana.fecha_inicio_proyecto,
        fecha_inicio_real: fechaInicioReal,
        fecha_fin_programada: fechaFinProgramada,
        porcentaje_programado: porcentajeProgramado,
        porcentaje_real: porcentajeReal,
        diferencia: porcentajeReal - porcentajeProgramado
      });

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  // Función para formatear fechas en formato peruano
  const formatearFecha = (fechaString: string | null) => {
    if (!fechaString) return 'Sin fecha';
    try {
      const fecha = new Date(fechaString);
      return fecha.toLocaleDateString('es-PE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return 'Fecha inválida';
    }
  };

  const agregarAvancePartida = (partidaCodigo: string) => {
    setAvancesPartidas(prev => {
      const newMap = new Map(prev);
      if (!newMap.has(partidaCodigo)) {
        newMap.set(partidaCodigo, {
          codigo_partida: partidaCodigo,
          porcentaje_avance_adicional: 0,
          observaciones: ''
        });
      }
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
      let avanceExistente = newMap.get(partidaCodigo);

      // Si no existe el avance y se está editando, crear uno nuevo
      if (!avanceExistente) {
        avanceExistente = {
          codigo_partida: partidaCodigo,
          porcentaje_avance_adicional: 0,
          observaciones: ''
        };
      }

      const nuevoAvance = {
        ...avanceExistente,
        [campo]: valor
      };

      // Si el porcentaje es 0 y no hay observaciones, remover la entrada
      if (nuevoAvance.porcentaje_avance_adicional === 0 && !nuevoAvance.observaciones) {
        newMap.delete(partidaCodigo);
      } else {
        newMap.set(partidaCodigo, nuevoAvance);
      }

      return newMap;
    });
  };

  const iniciarModoRegistroAvances = () => {
    setMostrarModalFecha(true);
  };

  const confirmarFechaYActivarModo = () => {
    setFechaReporte(fechaSeleccionada);
    setModoRegistroAvances(true);
    setMostrarModalFecha(false);
  };

  const cancelarModoRegistro = () => {
    setModoRegistroAvances(false);
    setAvancesPartidas(new Map());
    setObservacionesGenerales('');
    setMonitorResponsable('');
  };

  const actualizarAvanceHistorico = async (detalleId: number, nuevoAvance: number, observaciones?: string) => {
    try {
      const response = await fetch(`/api/v1/avances/detalle/${detalleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          porcentaje_avance: nuevoAvance,
          observaciones_partida: observaciones || null
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Error al actualizar avance');
      }

      return await response.json();
    } catch (error) {
      console.error('Error actualizando avance histórico:', error);
      throw error;
    }
  };

  const guardarCambiosHistoricos = async () => {
    if (!registroSeleccionado || avancesEditando.size === 0) return;

    try {
      setGuardandoAvances(true);
      setError(null);

      // Separar avances existentes de los nuevos
      const avancesExistentes = Array.from(avancesEditando.entries()).filter(([key]) => !key.startsWith('nuevo_'));
      const avancesNuevos = Array.from(avancesEditando.entries()).filter(([key]) => key.startsWith('nuevo_'));

      const promesasActualizacion = [];

      // Actualizar avances existentes
      for (const [key, avance] of avancesExistentes) {
        promesasActualizacion.push(
          actualizarAvanceHistorico(avance.id, avance.porcentaje_avance, avance.observaciones_partida || undefined)
        );
      }

      // Crear nuevos avances (agregar al registro existente)
      for (const [key, avance] of avancesNuevos) {
        promesasActualizacion.push(
          crearNuevoAvanceEnRegistro(registroSeleccionado.id, avance.codigo_partida, avance.porcentaje_avance, avance.observaciones_partida || undefined)
        );
      }

      await Promise.all(promesasActualizacion);

      // Recargar datos para reflejar cambios
      await cargarDatos();

      // Actualizar el registro seleccionado para mostrar cambios inmediatamente
      if (registroSeleccionado) {
        // Buscar el registro actualizado en el historial recién cargado
        const registroActualizado = historialFechas.find(f => f.registro.id === registroSeleccionado.id);
        if (registroActualizado) {
          setRegistroSeleccionado(registroActualizado.registro);
        }
      }

      // Limpiar estado de edición
      setAvancesEditando(new Map());
      setModoEdicion(false);
      setMostrarPartidasDisponibles(false);

      const totalCambios = avancesExistentes.length + avancesNuevos.length;
      alert(`✅ Se ${avancesExistentes.length > 0 ? 'actualizaron' : ''} ${avancesExistentes.length > 0 && avancesNuevos.length > 0 ? 'y' : ''} ${avancesNuevos.length > 0 ? 'agregaron' : ''} ${totalCambios} avances históricos exitosamente`);

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error al guardar cambios históricos');
    } finally {
      setGuardandoAvances(false);
    }
  };

  const crearNuevoAvanceEnRegistro = async (avanceFisicoId: number, codigoPartida: string, porcentajeAvance: number, observaciones?: string) => {
    try {
      const response = await fetch(`/api/v1/avances/detalle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          avance_fisico_id: avanceFisicoId,
          codigo_partida: codigoPartida,
          porcentaje_avance: porcentajeAvance,
          observaciones_partida: observaciones || null
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Error al crear nuevo avance');
      }

      return await response.json();
    } catch (error) {
      console.error('Error creando nuevo avance:', error);
      throw error;
    }
  };

  const iniciarEdicionHistorica = () => {
    if (!registroSeleccionado) return;

    // Inicializar el mapa de edición con los valores actuales
    const mapaInicial = new Map<string, DetalleAvance>();
    registroSeleccionado.detalles_avances.forEach(detalle => {
      mapaInicial.set(detalle.id.toString(), { ...detalle });
    });

    setAvancesEditando(mapaInicial);
    setModoEdicion(true);
    setMostrarPartidasDisponibles(false);
    setFiltroPartidaNueva('');
  };

  const cancelarEdicionHistorica = () => {
    setAvancesEditando(new Map());
    setModoEdicion(false);
    setMostrarPartidasDisponibles(false);
    setFiltroPartidaNueva('');
  };

  const agregarPartidaAHistorial = (partidaCodigo: string) => {
    if (!registroSeleccionado) return;

    // Crear un nuevo detalle para la partida
    const nuevoDetalle: DetalleAvance = {
      id: Date.now(), // ID temporal para identificación
      codigo_partida: partidaCodigo,
      porcentaje_avance: 0,
      monto_ejecutado: null,
      observaciones_partida: '',
      created_at: new Date().toISOString()
    };

    setAvancesEditando(prev => {
      const nuevoMapa = new Map(prev);
      nuevoMapa.set(`nuevo_${partidaCodigo}`, nuevoDetalle);
      return nuevoMapa;
    });
  };

  const removerPartidaDeHistorial = (key: string) => {
    setAvancesEditando(prev => {
      const nuevoMapa = new Map(prev);
      nuevoMapa.delete(key);
      return nuevoMapa;
    });
  };

  const actualizarAvanceEnEdicion = (detalleId: string, campo: keyof DetalleAvance, valor: any) => {
    setAvancesEditando(prev => {
      const nuevoMapa = new Map(prev);
      const avanceExistente = nuevoMapa.get(detalleId);

      if (avanceExistente) {
        nuevoMapa.set(detalleId, {
          ...avanceExistente,
          [campo]: valor
        });
      }

      return nuevoMapa;
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

      // Limpiar formulario y salir del modo de registro
      setAvancesPartidas(new Map());
      setObservacionesGenerales('');
      setMonitorResponsable('');
      setModoRegistroAvances(false);

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
    <div className="w-full min-h-screen bg-gray-50">
      {/* Header expandido con información del proyecto */}
      <div className="bg-white border-b px-6 py-4">
        <div className="space-y-4">
          {/* Título principal */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold flex items-center gap-2 text-gray-900">
                <CalendarIcon className="w-5 h-5 text-blue-600" />
                Registro Manual de Avances Físicos
              </h1>
              <p className="text-sm text-gray-600">
                Registre los avances realizados en las partidas durante una fecha específica
              </p>
            </div>
            <div className="flex items-center gap-4">
              {/* Botón de historial de fechas */}
              {historialFechas.length > 0 && (
                <div className="relative">
                  <Button
                    onClick={() => setMostrarHistorial(!mostrarHistorial)}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <CalendarIcon className="w-4 h-4" />
                    Fechas Registradas ({historialFechas.length})
                  </Button>

                  {mostrarHistorial && (
                    <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[250px]">
                      <div className="p-3 border-b border-gray-200">
                        <h4 className="font-medium text-gray-900">Historial de Registros</h4>
                        <p className="text-xs text-gray-500">Fechas en que se han subido avances</p>
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        {historialFechas.map((detalle, index) => (
                          <div
                            key={detalle.fecha}
                            className="px-3 py-3 hover:bg-blue-50 border-b border-gray-100 last:border-b-0 cursor-pointer transition-colors"
                            onClick={() => {
                              setRegistroSeleccionado(detalle.registro);
                              setMostrarDetalleModal(true);
                              setMostrarHistorial(false);
                            }}
                          >
                            <div className="space-y-2">
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="font-semibold text-sm text-gray-900">
                                    {formatearFecha(detalle.fecha)}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    Semana {detalle.semana} • {detalle.usuario || 'Sistema'}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium">
                                    {detalle.numeroRegistros} partidas
                                  </div>
                                </div>
                              </div>
                              <div className="text-xs text-gray-600">
                                Avance: {detalle.registro.avance_ejecutado_acum?.toFixed(1) || '0.0'}%
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="p-3 bg-gray-50 border-t border-gray-200">
                        <div className="text-xs text-gray-600 text-center">
                          Total: {historialFechas.length} día{historialFechas.length !== 1 ? 's' : ''} con registros
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Botón principal */}
              {!modoRegistroAvances && (
                <Button
                  onClick={iniciarModoRegistroAvances}
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-2"
                  size="sm"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Registrar Avances
                </Button>
              )}

              {/* Info de semana */}
              {informacionSemana && (
                <div className="flex items-center gap-6 text-sm">
                  <div className="text-center">
                    <div className="text-xs text-gray-500">Semana</div>
                    <div className="font-semibold text-blue-600">#{informacionSemana.semana_actual}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500">Días</div>
                    <div className="font-semibold">{informacionSemana.dias_transcurridos}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Información del proyecto */}
          {informacionProyecto && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-3 border-t border-gray-200">
              {/* Fechas de Inicio */}
              <div className="text-center">
                <div className="text-xs font-medium text-gray-500 mb-1">Fecha Inicio Programada</div>
                <div className="text-sm font-semibold text-green-600">
                  {formatearFecha(informacionProyecto.fecha_inicio_programada)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs font-medium text-gray-500 mb-1">Fecha Inicio Real</div>
                <div className="text-sm font-semibold text-blue-600">
                  {informacionProyecto.fecha_inicio_real
                    ? formatearFecha(informacionProyecto.fecha_inicio_real)
                    : <span className="text-gray-400 italic">Sin registrar</span>
                  }
                </div>
              </div>

              {/* Fecha Fin Programada */}
              <div className="text-center">
                <div className="text-xs font-medium text-gray-500 mb-1">Fecha Fin Programada</div>
                <div className="text-sm font-semibold text-purple-600">
                  {informacionProyecto.fecha_fin_programada
                    ? formatearFecha(informacionProyecto.fecha_fin_programada)
                    : <span className="text-gray-400 italic">Sin definir</span>
                  }
                </div>
              </div>

              {/* Porcentajes */}
              <div className="text-center">
                <div className="text-xs font-medium text-gray-500 mb-1">Avance Programado</div>
                <div className="text-sm font-semibold text-orange-600">
                  {informacionProyecto.porcentaje_programado.toFixed(1)}%
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs font-medium text-gray-500 mb-1">Avance Físico Real</div>
                <div className={`text-sm font-semibold ${
                  informacionProyecto.diferencia >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {informacionProyecto.porcentaje_real.toFixed(1)}%
                  <span className="text-xs ml-1">
                    ({informacionProyecto.diferencia >= 0 ? '+' : ''}{informacionProyecto.diferencia.toFixed(1)}%)
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="p-3 md:p-6">
        <Card className="h-[calc(100vh-140px)] md:h-[calc(100vh-180px)]">
          <CardContent className="p-3 md:p-6 h-full flex flex-col space-y-3 md:space-y-4">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Formulario compacto - solo cuando está en modo registro */}
          {modoRegistroAvances && (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="font-medium text-green-800">Modo registro de avances activo</span>
                  <span className="text-sm text-green-600">Fecha: {formatearFecha(fechaReporte)}</span>
                </div>
                <Button
                  onClick={cancelarModoRegistro}
                  variant="outline"
                  size="sm"
                  className="border-red-300 hover:bg-red-50 hover:border-red-400"
                >
                  <X className="w-4 h-4 mr-1" />
                  Cancelar
                </Button>
              </div>

              <div className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]">
                  <Label htmlFor="monitor_responsable" className="text-xs font-medium text-gray-600">Monitor Responsable</Label>
                  <Input
                    id="monitor_responsable"
                    placeholder="Nombre del monitor"
                    value={monitorResponsable}
                    onChange={(e) => setMonitorResponsable(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="flex-1 min-w-[250px]">
                  <Label htmlFor="filtro_partida" className="text-xs font-medium text-gray-600">Buscar Partida</Label>
                  <Input
                    id="filtro_partida"
                    placeholder="Código o descripción..."
                    value={filtroPartida}
                    onChange={(e) => setFiltroPartida(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="flex-1 min-w-[300px]">
                  <Label htmlFor="observaciones_generales" className="text-xs font-medium text-gray-600">Observaciones Generales</Label>
                  <Input
                    id="observaciones_generales"
                    placeholder="Observaciones sobre el avance del día..."
                    value={observacionesGenerales}
                    onChange={(e) => setObservacionesGenerales(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tabla de partidas - Ocupa todo el espacio restante */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-medium">Partidas del Proyecto</h3>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">
                  {partidasFiltradas.length} partidas disponibles
                </span>
                <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full font-medium">
                  {avancesPartidas.size} seleccionadas
                </span>
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden flex-1 bg-white">
              <div className="h-full overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="text-left p-2 border-b text-gray-900 font-semibold whitespace-nowrap w-[100px]">Código</th>
                      <th className="text-left p-2 border-b text-gray-900 font-semibold min-w-[250px]">Descripción</th>
                      <th className="text-center p-2 border-b text-gray-900 font-semibold whitespace-nowrap w-[90px]">Actual</th>
                      <th className="text-center p-2 border-b text-gray-900 font-semibold whitespace-nowrap w-[90px]">Programado</th>
                      <th className="text-center p-2 border-b text-gray-900 font-semibold whitespace-nowrap w-[250px]">Avance Adicional</th>
                      <th className="text-center p-2 border-b text-gray-900 font-semibold whitespace-nowrap w-[90px]">Nuevo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partidasFiltradas.map((partida) => {
                      const tieneAvance = avancesPartidas.has(partida.codigo);
                      const avance = avancesPartidas.get(partida.codigo);
                      const nuevoAvance = calcularNuevoAvance(partida.codigo);

                      return (
                        <tr key={partida.id} className={tieneAvance ? 'bg-green-50 border-l-4 border-green-400' : 'hover:bg-gray-50'}>
                          <td className="p-2 border-b font-mono text-xs text-gray-900 font-medium">{partida.codigo}</td>
                          <td className="p-2 border-b text-gray-900">
                            <div className="truncate" title={partida.descripcion}>
                              {partida.descripcion}
                            </div>
                          </td>
                          <td className="p-2 border-b text-center">
                            <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                              partida.porcentaje_avance_actual > 0 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {partida.porcentaje_avance_actual.toFixed(1)}%
                            </span>
                          </td>
                          <td className="p-2 border-b text-center">
                            <span className="inline-block text-xs text-gray-800 bg-gray-100 px-2 py-1 rounded-full font-medium">
                              {partida.porcentaje_programado.toFixed(1)}%
                            </span>
                          </td>
                          <td className="p-2 border-b">
                            {modoRegistroAvances ? (
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
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
                                    placeholder="0"
                                    className="w-16 h-7 text-center text-xs font-medium"
                                  />
                                  <span className="text-xs text-gray-500">%</span>
                                </div>
                                <Input
                                  placeholder="Observaciones..."
                                  value={avance?.observaciones || ''}
                                  onChange={(e) => actualizarAvancePartida(
                                    partida.codigo,
                                    'observaciones',
                                    e.target.value
                                  )}
                                  className="text-xs h-7"
                                />
                              </div>
                            ) : (
                              <div className="text-center text-gray-400">-</div>
                            )}
                          </td>
                          <td className="p-2 border-b text-center">
                            {modoRegistroAvances ? (
                              <span className={`inline-block px-2 py-1 rounded-full text-xs font-bold ${
                                nuevoAvance > partida.porcentaje_avance_actual
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-600'
                              }`}>
                                {nuevoAvance.toFixed(1)}%
                              </span>
                            ) : (
                              <div className="text-center text-gray-400">-</div>
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

          {/* Botón de acción fijo en la parte inferior - solo cuando está en modo registro */}
          {modoRegistroAvances && (
            <div className="border-t bg-gray-50 -mx-3 md:-mx-6 -mb-3 md:-mb-6 px-3 md:px-6 py-3 md:py-4">
              <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 md:gap-0">
                <div className="text-xs md:text-sm text-gray-600 text-center md:text-left">
                  {avancesPartidas.size > 0 ? (
                    <span>✅ {avancesPartidas.size} partida{avancesPartidas.size > 1 ? 's' : ''} lista{avancesPartidas.size > 1 ? 's' : ''} para registrar</span>
                  ) : (
                    <span>Seleccione partidas para registrar avances</span>
                  )}
                </div>
                <Button
                  onClick={registrarAvances}
                  disabled={loading || avancesPartidas.size === 0}
                  className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium px-4 md:px-6 w-full md:w-auto"
                  size="lg"
                >
                  <SaveIcon className="w-4 h-4" />
                  {loading ? 'Guardando...' : 'Registrar Avances'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      </div>

      {/* Modal de confirmación de fecha */}
      {mostrarModalFecha && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Seleccionar Fecha de Registro</h3>
              <p className="text-sm text-gray-600">¿De qué día registrará los avances?</p>
            </div>

            <div className="mb-6">
              <Label htmlFor="fecha_modal" className="text-sm font-medium text-gray-700 mb-2 block">Fecha del registro</Label>
              <DateInputPeru
                id="fecha_modal"
                value={fechaSeleccionada}
                onChange={setFechaSeleccionada}
                className="w-full"
                placeholder="DD/MM/AAAA"
              />
              <p className="text-xs text-gray-500 mt-1">Por defecto se selecciona el día de hoy</p>
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                onClick={() => setMostrarModalFecha(false)}
                variant="outline"
              >
                Cancelar
              </Button>
              <Button
                onClick={confirmarFechaYActivarModo}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                Aceptar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de detalle de registro histórico */}
      {mostrarDetalleModal && registroSeleccionado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Registro del {formatearFecha(registroSeleccionado.fecha_reporte)}
                  </h3>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                    <span>Semana {registroSeleccionado.dias_transcurridos ? Math.ceil(registroSeleccionado.dias_transcurridos / 7) : 0}</span>
                    <span>•</span>
                    <span>{registroSeleccionado.detalles_avances.length} partidas actualizadas</span>
                    <span>•</span>
                    <span>Avance total: {registroSeleccionado.avance_ejecutado_acum?.toFixed(1)}%</span>
                  </div>
                </div>
                <Button
                  onClick={() => {
                    setMostrarDetalleModal(false);
                    setRegistroSeleccionado(null);
                    setAvancesEditando(new Map());
                  }}
                  variant="outline"
                  size="sm"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium text-gray-900">Partidas Actualizadas</h4>
                  {modoEdicion && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-orange-600 font-medium">✏️ Modo Edición Activo</span>
                      <Button
                        onClick={cancelarEdicionHistorica}
                        variant="outline"
                        size="sm"
                        className="border-red-300 hover:bg-red-50"
                      >
                        Cancelar
                      </Button>
                    </div>
                  )}
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left p-3 font-medium text-gray-900 w-32">Código</th>
                        <th className="text-left p-3 font-medium text-gray-900">Descripción</th>
                        <th className="text-center p-3 font-medium text-gray-900 w-32">Avance Registrado</th>
                        <th className="text-right p-3 font-medium text-gray-900 w-32">Monto Ejecutado</th>
                        <th className="text-left p-3 font-medium text-gray-900">Observaciones</th>
                        <th className="text-center p-3 font-medium text-gray-900 w-20">Hora</th>
                      </tr>
                    </thead>
                    <tbody>
                      {registroSeleccionado.detalles_avances.map((detalle) => {
                        const avanceEnEdicion = avancesEditando.get(detalle.id.toString());
                        const valorActual = avanceEnEdicion || detalle;

                        const partidaInfo = partidasInfo.get(detalle.codigo_partida);

                        return (
                          <tr key={detalle.id} className={`border-t border-gray-200 ${
                            modoEdicion ? 'bg-orange-25' : 'hover:bg-gray-50'
                          }`}>
                            <td className="p-3 font-mono text-xs font-medium text-gray-900">
                              {detalle.codigo_partida}
                            </td>
                            <td className="p-3 text-sm text-gray-800">
                              <div className="max-w-md">
                                {partidaInfo?.descripcion || 'Descripción no disponible'}
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              {modoEdicion ? (
                                <div className="flex items-center justify-center gap-2">
                                  <Input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.1"
                                    value={valorActual.porcentaje_avance}
                                    onChange={(e) => actualizarAvanceEnEdicion(
                                      detalle.id.toString(),
                                      'porcentaje_avance',
                                      parseFloat(e.target.value) || 0
                                    )}
                                    className="w-20 h-8 text-center text-xs font-medium"
                                  />
                                  <span className="text-xs text-gray-500">%</span>
                                </div>
                              ) : (
                                <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                                  {detalle.porcentaje_avance.toFixed(1)}%
                                </span>
                              )}
                            </td>
                            <td className="p-3 font-mono text-xs text-right text-gray-800">
                              {detalle.monto_ejecutado ? `S/ ${detalle.monto_ejecutado.toLocaleString('es-PE', { minimumFractionDigits: 2 })}` : <span className="text-gray-500">-</span>}
                            </td>
                            <td className="p-3 text-xs text-gray-800">
                              {modoEdicion ? (
                                <Input
                                  value={valorActual.observaciones_partida || ''}
                                  onChange={(e) => actualizarAvanceEnEdicion(
                                    detalle.id.toString(),
                                    'observaciones_partida',
                                    e.target.value
                                  )}
                                  placeholder="Observaciones..."
                                  className="h-8 text-xs text-gray-800"
                                />
                              ) : (
                                <div className="text-gray-800">
                                  {detalle.observaciones_partida || <span className="text-gray-500 italic">Sin observaciones</span>}
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-xs text-center text-gray-500">
                              {new Date(detalle.created_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                            </td>
                          </tr>
                        );
                      })}

                      {/* Mostrar partidas agregadas en esta sesión de edición */}
                      {Array.from(avancesEditando.entries())
                        .filter(([key]) => key.startsWith('nuevo_'))
                        .map(([key, detalle]) => {
                          const partidaInfo = partidasInfo.get(detalle.codigo_partida);

                          return (
                            <tr key={key} className="border-t border-green-200 bg-green-25">
                              <td className="p-3 font-mono text-xs font-medium text-gray-900">
                                <div className="flex items-center gap-2">
                                  {detalle.codigo_partida}
                                  <span className="bg-green-100 text-green-800 px-1 py-0.5 rounded text-xs font-bold">NUEVO</span>
                                </div>
                              </td>
                              <td className="p-3 text-sm text-gray-800">
                                <div className="max-w-md">
                                  {partidaInfo?.descripcion || 'Descripción no disponible'}
                                </div>
                              </td>
                              <td className="p-3 text-center">
                                {modoEdicion ? (
                                  <div className="flex items-center justify-center gap-2">
                                    <Input
                                      type="number"
                                      min="0"
                                      max="100"
                                      step="0.1"
                                      value={detalle.porcentaje_avance}
                                      onChange={(e) => actualizarAvanceEnEdicion(
                                        key,
                                        'porcentaje_avance',
                                        parseFloat(e.target.value) || 0
                                      )}
                                      className="w-20 h-8 text-center text-xs font-medium"
                                      placeholder="0"
                                    />
                                    <span className="text-xs text-gray-500">%</span>
                                  </div>
                                ) : (
                                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                                    {detalle.porcentaje_avance.toFixed(1)}%
                                  </span>
                                )}
                              </td>
                              <td className="p-3 font-mono text-xs text-right text-gray-800">
                                <span className="text-gray-500 italic">Se calculará al guardar</span>
                              </td>
                              <td className="p-3 text-xs text-gray-800">
                                {modoEdicion ? (
                                  <div className="flex items-center gap-2">
                                    <Input
                                      value={detalle.observaciones_partida || ''}
                                      onChange={(e) => actualizarAvanceEnEdicion(
                                        key,
                                        'observaciones_partida',
                                        e.target.value
                                      )}
                                      placeholder="Observaciones..."
                                      className="h-8 text-xs text-gray-800 flex-1"
                                    />
                                    <Button
                                      onClick={() => removerPartidaDeHistorial(key)}
                                      size="sm"
                                      variant="outline"
                                      className="h-6 w-6 p-0 border-red-300 hover:bg-red-50 hover:border-red-400"
                                      title="Remover partida"
                                    >
                                      <X className="w-3 h-3 text-red-600" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="text-gray-800">
                                    {detalle.observaciones_partida || <span className="text-gray-500 italic">Sin observaciones</span>}
                                  </div>
                                )}
                              </td>
                              <td className="p-3 text-xs text-center text-gray-500">
                                <span className="text-green-600 font-medium">Nuevo</span>
                              </td>
                            </tr>
                          );
                        })
                      }
                    </tbody>
                  </table>
                </div>

                {/* Sección para agregar nuevas partidas en modo edición */}
                {modoEdicion && (
                  <div className="mt-6 space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-medium text-gray-900">Agregar Más Partidas al Registro</h4>
                      <Button
                        onClick={() => setMostrarPartidasDisponibles(!mostrarPartidasDisponibles)}
                        variant="outline"
                        size="sm"
                        className="border-blue-300 hover:bg-blue-50"
                      >
                        <PlusIcon className="w-4 h-4 mr-2" />
                        {mostrarPartidasDisponibles ? 'Ocultar Partidas' : 'Mostrar Partidas Disponibles'}
                      </Button>
                    </div>

                    {mostrarPartidasDisponibles && (
                      <div className="border rounded-lg bg-blue-25">
                        <div className="p-3 border-b bg-blue-50">
                          <div className="flex items-center gap-4">
                            <Input
                              placeholder="Buscar partida por código o descripción..."
                              value={filtroPartidaNueva}
                              onChange={(e) => setFiltroPartidaNueva(e.target.value)}
                              className="flex-1 h-8 text-xs"
                            />
                            <span className="text-xs text-blue-600">
                              {partidas.filter(p =>
                                p.codigo.toLowerCase().includes(filtroPartidaNueva.toLowerCase()) ||
                                p.descripcion.toLowerCase().includes(filtroPartidaNueva.toLowerCase())
                              ).length} partidas disponibles
                            </span>
                          </div>
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-blue-100 sticky top-0">
                              <tr>
                                <th className="text-left p-2 font-medium text-blue-900 text-xs">Código</th>
                                <th className="text-left p-2 font-medium text-blue-900 text-xs">Descripción</th>
                                <th className="text-center p-2 font-medium text-blue-900 text-xs">Avance Actual</th>
                                <th className="text-center p-2 font-medium text-blue-900 text-xs w-20">Acción</th>
                              </tr>
                            </thead>
                            <tbody>
                              {partidas
                                .filter(partida => {
                                  // Filtrar por búsqueda
                                  const coincideBusqueda = partida.codigo.toLowerCase().includes(filtroPartidaNueva.toLowerCase()) ||
                                    partida.descripcion.toLowerCase().includes(filtroPartidaNueva.toLowerCase());

                                  // Excluir partidas ya presentes en el registro original
                                  const yaEnRegistro = registroSeleccionado?.detalles_avances.some(d => d.codigo_partida === partida.codigo);

                                  // Excluir partidas ya agregadas en esta sesión de edición
                                  const yaAgregada = avancesEditando.has(`nuevo_${partida.codigo}`);

                                  return coincideBusqueda && !yaEnRegistro && !yaAgregada;
                                })
                                .slice(0, 20) // Limitar a 20 para rendimiento
                                .map(partida => (
                                  <tr key={partida.id} className="border-t border-blue-200 hover:bg-blue-50">
                                    <td className="p-2 font-mono text-xs text-blue-900">{partida.codigo}</td>
                                    <td className="p-2 text-xs text-blue-800">
                                      <div className="max-w-md truncate" title={partida.descripcion}>
                                        {partida.descripcion}
                                      </div>
                                    </td>
                                    <td className="p-2 text-center">
                                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                                        {partida.porcentaje_avance_actual?.toFixed(1) || '0.0'}%
                                      </span>
                                    </td>
                                    <td className="p-2 text-center">
                                      <Button
                                        onClick={() => agregarPartidaAHistorial(partida.codigo)}
                                        size="sm"
                                        variant="outline"
                                        className="h-6 w-6 p-0 border-green-300 hover:bg-green-50 hover:border-green-400"
                                        title="Agregar al registro"
                                      >
                                        <PlusIcon className="w-3 h-3 text-green-600" />
                                      </Button>
                                    </td>
                                  </tr>
                                ))
                              }
                            </tbody>
                          </table>
                          {partidas.filter(p =>
                            (p.codigo.toLowerCase().includes(filtroPartidaNueva.toLowerCase()) ||
                             p.descripcion.toLowerCase().includes(filtroPartidaNueva.toLowerCase())) &&
                            !registroSeleccionado?.detalles_avances.some(d => d.codigo_partida === p.codigo) &&
                            !avancesEditando.has(`nuevo_${p.codigo}`)
                          ).length === 0 && (
                            <div className="p-4 text-center text-blue-600 text-sm">
                              {filtroPartidaNueva ? 'No hay partidas que coincidan con la búsqueda' : 'Todas las partidas ya están en el registro'}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 bg-gray-50 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  Registro creado: {new Date(registroSeleccionado.created_at).toLocaleString('es-PE')}
                </div>
                <div className="space-x-3">
                  <Button
                    onClick={() => {
                      setMostrarDetalleModal(false);
                      setRegistroSeleccionado(null);
                      setAvancesEditando(new Map());
                      setModoEdicion(false);
                    }}
                    variant="outline"
                    disabled={guardandoAvances}
                  >
                    Cerrar
                  </Button>

                  {!modoEdicion ? (
                    <Button
                      onClick={iniciarEdicionHistorica}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                      disabled={guardandoAvances}
                    >
                      <Edit3 className="w-4 h-4 mr-2" />
                      Editar Avances
                    </Button>
                  ) : (
                    <Button
                      onClick={guardarCambiosHistoricos}
                      disabled={guardandoAvances || avancesEditando.size === 0}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <SaveIcon className="w-4 h-4 mr-2" />
                      {guardandoAvances ? 'Guardando...' : `Guardar Cambios (${avancesEditando.size})`}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Overlay para cerrar historial al hacer clic fuera */}
      {mostrarHistorial && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setMostrarHistorial(false)}
        />
      )}
    </div>
  );
}