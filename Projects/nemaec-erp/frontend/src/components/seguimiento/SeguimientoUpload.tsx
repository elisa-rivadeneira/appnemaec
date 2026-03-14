/**
 * 📊 SEGUIMIENTO UPLOAD - NEMAEC ERP
 * Componente para subir avances físicos desde Excel con validación doble
 */

import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { useComisarias } from '@/hooks/useComisarias';
import { seguimientoService } from '@/services/seguimientoService';

interface PartidaValidacion {
  codigo: string;
  descripcion: string;
  estado: 'valida' | 'modificada' | 'faltante' | 'nueva';
  mensaje: string;
}

interface ValidationResult {
  isValid: boolean;
  partidas_validadas: number;
  errores: string[];
  diferencias: PartidaValidacion[];
  mensaje: string;
  permitir_avance: boolean;
}

interface SeguimientoUploadProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedComisariaId?: number;
}

export const SeguimientoUpload: React.FC<SeguimientoUploadProps> = ({
  isOpen,
  onClose,
  preselectedComisariaId
}) => {
  const [step, setStep] = useState<'select' | 'validate' | 'confirm' | 'uploading' | 'success' | 'blocked' | 'comparison'>('select');
  const [formData, setFormData] = useState<{
    comisaria_id: number | null;
    archivo: File | null;
    fecha_corte: string;
  }>({
    comisaria_id: preselectedComisariaId || null,
    archivo: null,
    fecha_corte: new Date().toISOString().split('T')[0] // Fecha de hoy
  });
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [comparison, setComparison] = useState<any>(null);

  const queryClient = useQueryClient();
  const { data: comisarias = [] } = useComisarias();

  // Actualizar comisaria_id cuando cambie preselectedComisariaId
  useEffect(() => {
    if (preselectedComisariaId !== undefined) {
      setFormData(prev => ({
        ...prev,
        comisaria_id: preselectedComisariaId
      }));
    }
  }, [preselectedComisariaId]);

  // Mutación para validar partidas antes del avance
  const validateMutation = useMutation({
    mutationFn: async ({ comisaria_id, archivo }: { comisaria_id: number; archivo: File }) => {
      return seguimientoService.validarPartidas(comisaria_id, archivo);
    },
    onSuccess: (result: ValidationResult) => {
      setValidation(result);
      if (result.permitir_avance) {
        setStep('confirm');
      } else {
        setStep('blocked');
      }
    },
    onError: (error) => {
      console.error('Error validando partidas:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      alert(`Error al validar las partidas del archivo Excel:\n${errorMessage}`);
    }
  });

  // Mutación para comparar partidas
  const comparisonMutation = useMutation({
    mutationFn: async ({ comisaria_id, archivo }: { comisaria_id: number; archivo: File }) => {
      return seguimientoService.compararPartidas(comisaria_id, archivo);
    },
    onSuccess: (result) => {
      setComparison(result);
      setStep('comparison');
    },
    onError: (error) => {
      console.error('Error comparando partidas:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      alert(`Error al comparar partidas:\n${errorMessage}`);
    }
  });

  // Mutación para importar avances físicos
  const importMutation = useMutation({
    mutationFn: async ({ comisaria_id, archivo, fecha_reporte }: { comisaria_id: number; archivo: File; fecha_reporte: string }) => {
      return seguimientoService.importarAvances(comisaria_id, archivo, fecha_reporte, `Avances físicos importados el ${fecha_reporte}`, true); // validacion_previa = true
    },
    onSuccess: () => {
      setStep('success');
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['avances-fisicos'] });
      queryClient.invalidateQueries({ queryKey: ['comisarias'] });

      // Cerrar automáticamente después de 3 segundos
      setTimeout(() => {
        handleClose();
      }, 3000);
    },
    onError: (error) => {
      console.error('Error importando avances:', error);
      alert(`Error al importar avances físicos: ${error}`);
      setStep('select');
    }
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      alert('Por favor selecciona un archivo Excel (.xlsx o .xls)');
      return;
    }

    setFormData(prev => ({
      ...prev,
      archivo: file
    }));
  };

  const handleValidate = () => {
    if (!formData.comisaria_id || !formData.archivo) {
      alert('Por favor selecciona una comisaría y un archivo');
      return;
    }

    setStep('validate');
    validateMutation.mutate({
      comisaria_id: formData.comisaria_id,
      archivo: formData.archivo
    });
  };

  const handleCompare = () => {
    if (!formData.comisaria_id || !formData.archivo) {
      alert('Por favor selecciona una comisaría y un archivo');
      return;
    }

    comparisonMutation.mutate({
      comisaria_id: formData.comisaria_id,
      archivo: formData.archivo
    });
  };

  const handleImport = () => {
    if (!formData.comisaria_id || !formData.archivo || !formData.fecha_corte) {
      alert('Por favor completa todos los campos incluyendo la fecha de corte');
      return;
    }

    setStep('uploading');
    importMutation.mutate({
      comisaria_id: formData.comisaria_id,
      archivo: formData.archivo,
      fecha_reporte: formData.fecha_corte
    });
  };

  const handleClose = () => {
    setStep('select');
    setFormData({
      comisaria_id: preselectedComisariaId || null,
      archivo: null,
      fecha_corte: new Date().toISOString().split('T')[0]
    });
    setValidation(null);
    setComparison(null);
    onClose();
  };

  const renderStepContent = () => {
    switch (step) {
      case 'select':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                📊 Subir Avances Físicos
              </h3>
              <p className="text-gray-600 mb-6">
                Sube el Excel con los avances físicos de las partidas. Se validarán automáticamente antes de la importación.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Comisaría *
                </label>
                <Select
                  value={formData.comisaria_id?.toString() || ''}
                  onChange={(value) => setFormData(prev => ({
                    ...prev,
                    comisaria_id: value ? parseInt(value) : null
                  }))}
                  disabled={!!preselectedComisariaId}
                  className="w-full"
                >
                  <option value="">Seleccionar comisaría...</option>
                  {comisarias.map(comisaria => (
                    <option key={comisaria.id} value={comisaria.id}>
                      {comisaria.nombre} - {comisaria.codigo}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha de corte *
                </label>
                <Input
                  type="date"
                  value={formData.fecha_corte}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    fecha_corte: e.target.value
                  }))}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Fecha a la que corresponden los avances reportados.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Archivo Excel de Avances *
                </label>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nemaec-500 focus:border-nemaec-500"
                />
                {formData.archivo && (
                  <div className="mt-2 text-sm text-green-600">
                    ✓ {formData.archivo.name} ({(formData.archivo.size / 1024).toFixed(1)} KB)
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Excel con estructura: CODIGO_PARTIDA, DESCRIPCION, % AVANCE_EJECUTADO, OBSERVACIONES
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start">
                  <div className="text-blue-400 text-xl mr-3">ℹ️</div>
                  <div className="flex-1">
                    <h4 className="text-blue-800 font-medium mb-2">
                      Validación de Seguridad
                    </h4>
                    <p className="text-sm text-blue-700">
                      El sistema validará que las partidas del Excel coincidan exactamente con las de la base de datos.
                      Si detecta cambios no autorizados (ej: "techo de cocina" → "tanque de agua"), bloqueará la importación.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'validate':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                🔍 Validando Partidas...
              </h3>
            </div>

            {validateMutation.isPending && (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nemaec-600"></div>
                <span className="ml-3 text-gray-600">Validando partidas del Excel...</span>
              </div>
            )}
          </div>
        );

      case 'blocked':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-red-800 mb-4">
                🚫 Validación Fallida
              </h3>
            </div>

            {validation && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start">
                  <div className="text-red-400 text-xl mr-3">❌</div>
                  <div className="flex-1">
                    <h4 className="text-red-800 font-medium mb-2">
                      Las partidas no coinciden con la base de datos
                    </h4>
                    <p className="text-red-700 mb-4">{validation.mensaje || validation.message}</p>

                    {/* Mostrar reporte detallado si existe */}
                    {validation.reporte_diferencias && (
                      <div className="bg-white rounded border p-4 mb-4">
                        <h5 className="font-medium text-red-800 mb-2">📋 Reporte detallado:</h5>
                        <pre className="text-xs text-gray-700 whitespace-pre-wrap max-h-64 overflow-y-auto">
                          {validation.reporte_diferencias}
                        </pre>
                      </div>
                    )}

                    {/* Mostrar diferencias estructuradas si existen */}
                    {validation.diferencias && validation.diferencias.length > 0 && (
                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        <p className="text-sm font-medium text-red-800">🔍 Diferencias específicas detectadas:</p>
                        {validation.diferencias.slice(0, 15).map((diff, index) => (
                          <div key={index} className="bg-white rounded border border-red-200 p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-mono text-sm bg-red-100 px-2 py-1 rounded text-red-800">
                                {diff.codigo}
                              </span>
                              <span className="text-xs bg-red-500 text-white px-2 py-1 rounded">
                                {diff.estado?.toUpperCase() || 'PROBLEMA'}
                              </span>
                            </div>
                            <div className="text-sm text-red-700 mb-1">
                              <strong>Problema:</strong> {diff.mensaje}
                            </div>
                            {diff.descripcion_excel && (
                              <div className="text-xs text-gray-600">
                                <strong>En Excel:</strong> {diff.descripcion_excel}
                              </div>
                            )}
                            {diff.descripcion_db && (
                              <div className="text-xs text-gray-600">
                                <strong>En BD:</strong> {diff.descripcion_db}
                              </div>
                            )}
                          </div>
                        ))}
                        {validation.diferencias.length > 15 && (
                          <p className="text-sm text-red-600 font-medium text-center">
                            ... y {validation.diferencias.length - 15} diferencias más
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start">
                <div className="text-yellow-400 text-xl mr-3">💡</div>
                <div className="flex-1">
                  <h4 className="text-yellow-800 font-medium mb-2">
                    ¿Qué hacer ahora?
                  </h4>
                  <ol className="text-sm text-yellow-700 space-y-1 list-decimal list-inside">
                    <li>Revisa las diferencias específicas mostradas arriba</li>
                    <li>Actualiza primero el cronograma con las nuevas partidas si es necesario</li>
                    <li>O corrige el Excel para que coincida exactamente con las partidas existentes</li>
                    <li>Vuelve a intentar la validación</li>
                  </ol>
                  <div className="mt-3 p-2 bg-yellow-100 rounded text-xs">
                    <strong>💡 Tip:</strong> Para ver qué partidas tienes en el cronograma vs el Excel, usa el botón "Ver comparación" antes de validar.
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'confirm':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-green-800 mb-4">
                ✅ Partidas Validadas Correctamente
              </h3>
            </div>

            {validation && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-green-800">Partidas validadas:</span>
                    <span className="ml-2 text-green-700">{validation.partidas_validadas}</span>
                  </div>
                  <div>
                    <span className="font-medium text-green-800">Estado:</span>
                    <span className="ml-2 text-green-700">Listo para importar</span>
                  </div>
                </div>
                <div className="mt-3 text-sm text-green-700">
                  {validation.mensaje}
                </div>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-700">
                <strong>Nota:</strong> Los avances se importarán para la fecha: <strong>{formData.fecha_corte}</strong>
              </p>
            </div>
          </div>
        );

      case 'uploading':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                📤 Importando Avances Físicos...
              </h3>
            </div>

            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nemaec-600"></div>
              <span className="ml-3 text-gray-600">
                Procesando avances de {validation?.partidas_validadas} partidas...
              </span>
            </div>

            <div className="text-center text-sm text-gray-500">
              Se están creando los puntos de avance en la base de datos...
            </div>
          </div>
        );

      case 'success':
        return (
          <div className="space-y-6">
            <div className="text-center py-8">
              <div className="text-6xl mb-4">✅</div>
              <h3 className="text-lg font-semibold text-green-800 mb-4">
                ¡Avances Físicos Importados!
              </h3>
              <p className="text-gray-600 mb-4">
                Se procesaron {validation?.partidas_validadas} partidas correctamente para la fecha {formData.fecha_corte}.
              </p>
              <div className="text-sm text-gray-500">
                El modal se cerrará automáticamente...
              </div>
            </div>
          </div>
        );

      case 'comparison':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-blue-800 mb-4">
                🔍 Comparación de Partidas - Lado a Lado
              </h3>
            </div>

            {comparison && (
              <div className="space-y-6">
                {/* ALERTA CRÍTICA si hay inconsistencias REALES */}
                {(comparison.resumen?.solo_en_excel > 0 ||
                  comparison.resumen?.descripciones_diferentes > 0) && (
                  <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6 shadow-lg">
                    <div className="flex items-start space-x-3">
                      <div className="text-4xl">🚨</div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-red-800 mb-3">
                          ¡PARTIDAS NO COINCIDEN!
                        </h3>
                        <p className="text-red-700 mb-4 font-medium">
                          No se puede proceder con la subida de avances físicos porque las partidas del Excel no coinciden exactamente con el cronograma en la base de datos.
                        </p>

                        <div className="bg-red-100 rounded-lg p-4 mb-4">
                          <h4 className="font-bold text-red-800 mb-2">Problemas detectados:</h4>
                          <ul className="space-y-1 text-red-700">
                            {comparison.resumen?.solo_en_cronograma > 0 && (
                              <li>• <strong>{comparison.resumen.solo_en_cronograma}</strong> partidas faltan en el archivo Excel</li>
                            )}
                            {comparison.resumen?.solo_en_excel > 0 && (
                              <li>• <strong>{comparison.resumen.solo_en_excel}</strong> partidas nuevas en Excel que no existen en cronograma</li>
                            )}
                            {comparison.resumen?.descripciones_diferentes > 0 && (
                              <li>• <strong>{comparison.resumen.descripciones_diferentes}</strong> partidas con descripciones diferentes</li>
                            )}
                          </ul>
                        </div>

                        <div className="bg-yellow-100 rounded-lg p-4">
                          <h4 className="font-bold text-yellow-800 mb-2">📋 Pasos a seguir:</h4>
                          <ol className="list-decimal list-inside space-y-1 text-yellow-700">
                            <li>Primero actualiza el cronograma con las nuevas partidas</li>
                            <li>O corrige el Excel para que tenga exactamente las mismas partidas</li>
                            <li>Luego vuelve a intentar subir los avances físicos</li>
                          </ol>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Mensaje de éxito si no hay problemas REALES */}
                {comparison.resumen?.solo_en_excel === 0 &&
                 comparison.resumen?.descripciones_diferentes === 0 && (
                  <div className="bg-green-50 border-2 border-green-300 rounded-lg p-6 shadow-lg">
                    <div className="flex items-start space-x-3">
                      <div className="text-4xl">✅</div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-green-800 mb-2">
                          ¡Partidas Coinciden Perfectamente!
                        </h3>
                        <p className="text-green-700 font-medium">
                          Todas las partidas coinciden entre el cronograma y el archivo Excel. Puedes proceder a subir los avances físicos con confianza.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Mensaje informativo sobre partidas faltantes */}
                {comparison.resumen?.solo_en_cronograma > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <div className="text-yellow-400 text-xl">ℹ️</div>
                      <div className="flex-1">
                        <h4 className="font-medium text-yellow-800 mb-2">
                          Información: {comparison.resumen.solo_en_cronograma} partidas sin avance reportado
                        </h4>
                        <p className="text-sm text-yellow-700">
                          Es normal que el Excel de avances contenga menos partidas que el cronograma completo.
                          Solo se reportan partidas con avance físico ejecutado. Las partidas sin avance (0%) no necesitan incluirse.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Resumen de comparación */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-800 mb-3">📊 Resumen de Comparación</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="space-y-2">
                      <div><strong>Cronograma BD:</strong> {comparison.resumen?.total_cronograma || 0} partidas</div>
                      <div><strong>En ambos:</strong> {comparison.resumen?.en_ambos || 0} partidas</div>
                    </div>
                    <div className="space-y-2">
                      <div><strong>Excel Avances:</strong> {comparison.resumen?.total_excel || 0} partidas</div>
                      <div><strong>Descripciones diferentes:</strong> {comparison.resumen?.descripciones_diferentes || 0}</div>
                    </div>
                  </div>
                </div>

                {/* Comparación lado a lado */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* IZQUIERDA: Partidas del Cronograma */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-800 mb-3">📋 Cronograma Actual (BD)</h4>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {comparison.cronograma_bd?.partidas?.slice(0, 20).map((partida: any, index: number) => {
                        const tieneProblemas = partida.estado === 'solo_cronograma' || partida.coincide_descripcion === false;
                        return (
                          <div
                            key={index}
                            className={`text-sm border-b pb-2 p-2 rounded-md ${
                              tieneProblemas
                                ? 'bg-yellow-100 border-yellow-300 border-2'
                                : 'bg-white border-gray-200'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className={`font-mono text-xs px-2 py-1 rounded ${
                                tieneProblemas ? 'bg-yellow-200 text-yellow-800' : 'bg-gray-200'
                              }`}>
                                {partida.codigo}
                              </span>
                              <div className="flex items-center space-x-1">
                                {partida.estado === 'en_ambos' && !tieneProblemas && <span className="text-green-500">✅</span>}
                                {partida.estado === 'solo_cronograma' && (
                                  <span className="bg-yellow-500 text-white text-xs px-2 py-1 rounded font-medium">
                                    FALTA EN EXCEL
                                  </span>
                                )}
                                {partida.coincide_descripcion === false && (
                                  <span className="bg-red-500 text-white text-xs px-2 py-1 rounded font-medium">
                                    DESCRIPCIÓN ≠
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className={`mt-1 text-xs ${tieneProblemas ? 'text-yellow-800' : 'text-gray-700'}`}>
                              {partida.descripcion}
                            </div>
                            <div className="mt-1 text-gray-500 text-xs">
                              S/ {partida.precio_total?.toLocaleString() || '0'}
                            </div>
                            {partida.estado === 'solo_cronograma' && (
                              <div className="mt-2 text-xs text-yellow-700 bg-yellow-50 p-2 rounded">
                                ⚠️ Esta partida existe en el cronograma pero NO en el archivo de avances
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* DERECHA: Partidas del Excel */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="font-medium text-green-800 mb-3">📊 Excel de Avances</h4>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {comparison.excel_avances?.partidas?.slice(0, 20).map((partida: any, index: number) => {
                        const tieneProblemas = partida.estado === 'solo_excel' || partida.coincide_descripcion === false;
                        return (
                          <div
                            key={index}
                            className={`text-sm border-b pb-2 p-2 rounded-md ${
                              tieneProblemas
                                ? 'bg-yellow-100 border-yellow-300 border-2'
                                : 'bg-white border-green-200'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className={`font-mono text-xs px-2 py-1 rounded ${
                                tieneProblemas ? 'bg-yellow-200 text-yellow-800' : 'bg-green-200'
                              }`}>
                                {partida.codigo}
                              </span>
                              <div className="flex items-center space-x-1">
                                {partida.estado === 'en_ambos' && !tieneProblemas && <span className="text-green-500">✅</span>}
                                {partida.estado === 'solo_excel' && (
                                  <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded font-medium">
                                    NUEVA PARTIDA
                                  </span>
                                )}
                                {partida.coincide_descripcion === false && (
                                  <span className="bg-red-500 text-white text-xs px-2 py-1 rounded font-medium">
                                    DESCRIPCIÓN ≠
                                  </span>
                                )}
                                <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                                  {(partida.avance_ejecutado * 100).toFixed(1)}%
                                </span>
                              </div>
                            </div>
                            <div className={`mt-1 text-xs ${tieneProblemas ? 'text-yellow-800' : 'text-gray-700'}`}>
                              {partida.descripcion}
                            </div>
                            {partida.estado === 'solo_excel' && (
                              <div className="mt-2 text-xs text-blue-700 bg-blue-50 p-2 rounded">
                                🆕 Esta partida NO existe en el cronograma actual
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Leyenda */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <h4 className="font-medium text-yellow-800 mb-2">📝 Leyenda</h4>
                  <div className="text-sm text-yellow-700 grid grid-cols-2 gap-2">
                    <div>✅ Partida existe en ambos</div>
                    <div>🔸 Solo en cronograma</div>
                    <div>🆕 Solo en Excel</div>
                    <div>❌ Descripción diferente</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const renderFooterButtons = () => {
    switch (step) {
      case 'select':
        return (
          <>
            <Button variant="secondary" onClick={handleClose}>
              Cancelar
            </Button>
            <Button
              variant="secondary"
              onClick={handleCompare}
              disabled={!formData.comisaria_id || !formData.archivo}
            >
              🔍 Ver comparación
            </Button>
            <Button
              variant="primary"
              onClick={handleValidate}
              disabled={!formData.comisaria_id || !formData.archivo}
            >
              Validar partidas
            </Button>
          </>
        );

      case 'validate':
        return (
          <Button variant="secondary" disabled>
            Validando...
          </Button>
        );

      case 'blocked':
        return (
          <>
            <Button variant="secondary" onClick={handleClose}>
              Cerrar
            </Button>
            <Button variant="primary" onClick={() => setStep('select')}>
              Seleccionar otro archivo
            </Button>
          </>
        );

      case 'confirm':
        return (
          <>
            <Button variant="secondary" onClick={() => setStep('select')}>
              Cambiar archivo
            </Button>
            <Button
              variant="primary"
              onClick={handleImport}
            >
              Importar avances
            </Button>
          </>
        );

      case 'uploading':
        return (
          <Button variant="secondary" disabled>
            Procesando...
          </Button>
        );

      case 'comparison':
        const tieneInconsistencias = comparison && (
          // Solo consideramos inconsistencias REALES:
          // - Partidas en Excel que no están en cronograma (ERROR)
          // - Descripciones diferentes (ERROR)
          // - NO consideramos problema que falten partidas en Excel (normal en avances)
          comparison.resumen?.solo_en_excel > 0 ||
          comparison.resumen?.descripciones_diferentes > 0
        );

        return (
          <>
            <Button variant="secondary" onClick={() => setStep('select')}>
              Cambiar archivo
            </Button>
            {!tieneInconsistencias ? (
              <Button
                variant="primary"
                onClick={() => {
                  // Si todo coincide, proceder con validación formal
                  setStep('validate');
                  validateMutation.mutate({
                    comisaria_id: formData.comisaria_id!,
                    archivo: formData.archivo!
                  });
                }}
              >
                ✅ Proceder con validación
              </Button>
            ) : (
              <Button variant="danger" disabled>
                🚫 Corregir inconsistencias primero
              </Button>
            )}
          </>
        );

      case 'success':
        return (
          <Button variant="primary" onClick={handleClose}>
            Continuar
          </Button>
        );

      default:
        return null;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={step === 'uploading' ? undefined : handleClose}
      title=""
      size="lg"
    >
      <div className="p-6">
        {renderStepContent()}
      </div>

      {renderFooterButtons() && (
        <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200">
          {renderFooterButtons()}
        </div>
      )}
    </Modal>
  );
};