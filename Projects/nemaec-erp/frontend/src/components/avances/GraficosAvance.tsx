import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Button from '@/components/ui/Button';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { CalendarIcon, TrendingUpIcon, AlertTriangleIcon, CheckCircleIcon, ArrowUpIcon, ArrowDownIcon } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

interface DatosGrafico {
  fecha: string;
  avance_programado: number;
  avance_ejecutado: number;
  diferencia: number;
  dias_transcurridos: number;
}

interface PartidaResumen {
  codigo: string;
  descripcion: string;
  avance_actual: number;
  avance_programado: number;
  diferencia: number;
}

interface DatosGraficos {
  comisaria_id: number;
  periodo: {
    fecha_inicio: string;
    fecha_fin: string;
    days_back: number;
  };
  proyecto: {
    semana_actual: number;
    dias_transcurridos: number;
    fecha_inicio_proyecto: string;
  };
  serie_temporal: DatosGrafico[];
  resumen_partidas: {
    criticas: PartidaResumen[];
    en_tiempo: PartidaResumen[];
    adelantadas: PartidaResumen[];
    total_partidas: number;
  };
  avance_actual: {
    programado: number;
    ejecutado: number;
    diferencia: number;
  };
}

interface GraficosAvanceProps {
  comisariaId: number;
}

export default function GraficosAvance({ comisariaId }: GraficosAvanceProps) {
  const [datos, setDatos] = useState<DatosGraficos | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState(30); // días hacia atrás
  const [vistaActiva, setVistaActiva] = useState<'timeline' | 'partidas' | 'resumen'>('timeline');

  useEffect(() => {
    cargarDatos();
  }, [comisariaId, periodo]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/v1/avances/graficos/${comisariaId}?days_back=${periodo}`);
      if (!response.ok) {
        throw new Error('Error al cargar datos de gráficos');
      }
      const data = await response.json();
      setDatos(data);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const formatearFecha = (fechaStr: string) => {
    return format(parseISO(fechaStr), 'dd/MM', { locale: es });
  };

  const formatearTooltip = (value: number, name: string) => {
    const nombres = {
      avance_programado: 'Avance Programado',
      avance_ejecutado: 'Avance Ejecutado',
      diferencia: 'Diferencia'
    };
    return [`${value.toFixed(1)}%`, nombres[name as keyof typeof nombres] || name];
  };

  const colores = {
    programado: '#3b82f6', // blue-500
    ejecutado: '#10b981',  // emerald-500
    diferencia: '#f59e0b', // amber-500
    critica: '#ef4444',    // red-500
    normal: '#6b7280'      // gray-500
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Cargando gráficos...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        {error}
      </div>
    );
  }

  if (!datos) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-600">No hay datos disponibles para mostrar gráficos</div>
        <Button onClick={cargarDatos} className="mt-4">
          Recargar
        </Button>
      </div>
    );
  }

  const datosParaGrafico = datos.serie_temporal.map(item => ({
    ...item,
    fecha_formateada: formatearFecha(item.fecha)
  }));

  const datosPartidas = [
    { name: 'En Tiempo', value: datos.resumen_partidas.en_tiempo.length, color: colores.ejecutado },
    { name: 'Críticas', value: datos.resumen_partidas.criticas.length, color: colores.critica },
    { name: 'Adelantadas', value: datos.resumen_partidas.adelantadas.length, color: '#8b5cf6' }
  ];

  return (
    <div className="space-y-6">
      {/* Header con métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avance Programado</p>
                <p className="text-2xl font-bold text-blue-600">
                  {datos.avance_actual.programado.toFixed(1)}%
                </p>
              </div>
              <TrendingUpIcon className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avance Ejecutado</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {datos.avance_actual.ejecutado.toFixed(1)}%
                </p>
              </div>
              <CheckCircleIcon className="w-8 h-8 text-emerald-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Diferencia</p>
                <p className={`text-2xl font-bold flex items-center ${
                  datos.avance_actual.diferencia > 0 ? 'text-emerald-600' : 'text-red-600'
                }`}>
                  {datos.avance_actual.diferencia > 0 ? (
                    <ArrowUpIcon className="w-5 h-5 mr-1" />
                  ) : (
                    <ArrowDownIcon className="w-5 h-5 mr-1" />
                  )}
                  {Math.abs(datos.avance_actual.diferencia).toFixed(1)}%
                </p>
              </div>
              <AlertTriangleIcon className={`w-8 h-8 ${
                Math.abs(datos.avance_actual.diferencia) > 5 ? 'text-red-500' : 'text-yellow-500'
              }`} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Semana Proyecto</p>
                <p className="text-2xl font-bold text-purple-600">
                  {datos.proyecto.semana_actual}
                </p>
                <p className="text-xs text-gray-500">
                  {datos.proyecto.dias_transcurridos} días
                </p>
              </div>
              <CalendarIcon className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controles de período y vista */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">Período:</span>
          {[7, 15, 30, 60, 90].map(days => (
            <Button
              key={days}
              size="sm"
              variant={periodo === days ? 'primary' : 'outline'}
              onClick={() => setPeriodo(days)}
            >
              {days}d
            </Button>
          ))}
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">Vista:</span>
          <Button
            size="sm"
            variant={vistaActiva === 'timeline' ? 'primary' : 'outline'}
            onClick={() => setVistaActiva('timeline')}
          >
            Timeline
          </Button>
          <Button
            size="sm"
            variant={vistaActiva === 'partidas' ? 'primary' : 'outline'}
            onClick={() => setVistaActiva('partidas')}
          >
            Partidas
          </Button>
          <Button
            size="sm"
            variant={vistaActiva === 'resumen' ? 'primary' : 'outline'}
            onClick={() => setVistaActiva('resumen')}
          >
            Resumen
          </Button>
        </div>
      </div>

      {/* Gráficos según vista activa */}
      {vistaActiva === 'timeline' && (
        <div className="space-y-6">
          {/* Gráfico de líneas - Evolución temporal */}
          <Card>
            <CardHeader>
              <CardTitle>Evolución de Avances (Últimos {periodo} días)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={datosParaGrafico}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="fecha_formateada"
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 12 }}
                    label={{ value: 'Avance (%)', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip
                    formatter={formatearTooltip}
                    labelFormatter={(label) => `Fecha: ${label}`}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="avance_programado"
                    stroke={colores.programado}
                    strokeWidth={2}
                    name="Avance Programado"
                    strokeDasharray="5 5"
                  />
                  <Line
                    type="monotone"
                    dataKey="avance_ejecutado"
                    stroke={colores.ejecutado}
                    strokeWidth={3}
                    name="Avance Ejecutado"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Gráfico de barras - Diferencias */}
          <Card>
            <CardHeader>
              <CardTitle>Diferencias por Período</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={datosParaGrafico}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="fecha_formateada" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, 'Diferencia']} />
                  <Bar
                    dataKey="diferencia"
                    fill={colores.diferencia}
                    name="Diferencia (Ejecutado - Programado)"
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {vistaActiva === 'partidas' && (
        <div className="space-y-6">
          {/* Distribución de partidas */}
          <Card>
            <CardHeader>
              <CardTitle>Distribución de Partidas por Estado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={datosPartidas}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {datosPartidas.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-emerald-50 rounded">
                    <span className="font-medium text-emerald-800">En Tiempo</span>
                    <span className="text-emerald-600 font-bold">
                      {datos.resumen_partidas.en_tiempo.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded">
                    <span className="font-medium text-red-800">Críticas</span>
                    <span className="text-red-600 font-bold">
                      {datos.resumen_partidas.criticas.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-purple-50 rounded">
                    <span className="font-medium text-purple-800">Adelantadas</span>
                    <span className="text-purple-600 font-bold">
                      {datos.resumen_partidas.adelantadas.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <span className="font-medium text-gray-800">Total</span>
                    <span className="text-gray-600 font-bold">
                      {datos.resumen_partidas.total_partidas}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Listado de partidas críticas */}
          {datos.resumen_partidas.criticas.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-red-600">Partidas Críticas (&gt;5% retraso)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-red-50">
                      <tr>
                        <th className="text-left p-3 border-b text-red-900">Código</th>
                        <th className="text-left p-3 border-b text-red-900">Descripción</th>
                        <th className="text-right p-3 border-b text-red-900">Programado</th>
                        <th className="text-right p-3 border-b text-red-900">Ejecutado</th>
                        <th className="text-right p-3 border-b text-red-900">Diferencia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datos.resumen_partidas.criticas.map((partida, index) => (
                        <tr key={index} className="hover:bg-red-25">
                          <td className="p-3 border-b font-mono text-xs">{partida.codigo}</td>
                          <td className="p-3 border-b">{partida.descripcion}</td>
                          <td className="p-3 border-b text-right">{partida.avance_programado.toFixed(1)}%</td>
                          <td className="p-3 border-b text-right">{partida.avance_actual.toFixed(1)}%</td>
                          <td className="p-3 border-b text-right text-red-600 font-medium">
                            {partida.diferencia.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {vistaActiva === 'resumen' && (
        <Card>
          <CardHeader>
            <CardTitle>Información del Proyecto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Cronología</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Inicio del proyecto:</span>
                    <span className="font-medium">
                      {format(parseISO(datos.proyecto.fecha_inicio_proyecto), 'dd/MM/yyyy', { locale: es })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Días transcurridos:</span>
                    <span className="font-medium">{datos.proyecto.dias_transcurridos}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Semana actual:</span>
                    <span className="font-medium">{datos.proyecto.semana_actual}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Estado Actual</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Avance programado:</span>
                    <span className="font-medium text-blue-600">
                      {datos.avance_actual.programado.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Avance ejecutado:</span>
                    <span className="font-medium text-emerald-600">
                      {datos.avance_actual.ejecutado.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Diferencia:</span>
                    <span className={`font-medium ${
                      datos.avance_actual.diferencia > 0 ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                      {datos.avance_actual.diferencia > 0 ? '+' : ''}
                      {datos.avance_actual.diferencia.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-medium mb-4">Progreso Visual</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-gray-600">Avance Programado</span>
                    <span className="text-sm text-blue-600">{datos.avance_actual.programado.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${datos.avance_actual.programado}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-gray-600">Avance Ejecutado</span>
                    <span className="text-sm text-emerald-600">{datos.avance_actual.ejecutado.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-emerald-500 h-2 rounded-full"
                      style={{ width: `${datos.avance_actual.ejecutado}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}