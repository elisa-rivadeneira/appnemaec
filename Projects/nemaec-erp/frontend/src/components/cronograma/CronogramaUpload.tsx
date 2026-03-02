/**
 * 📊 CRONOGRAMA UPLOAD - NEMAEC ERP
 * Componente para subir cronogramas valorizados desde Excel
 */

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useImportCronograma } from '@/hooks/useCronograma';
import { cronogramaService } from '@/services/cronogramaService';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { useComisarias } from '@/hooks/useComisarias';
import { CronogramaUploadData, ExcelValidationResult } from '@/types/cronograma';

interface CronogramaUploadProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedComisariaId?: number;
}

export const CronogramaUpload: React.FC<CronogramaUploadProps> = ({
  isOpen,
  onClose,
  preselectedComisariaId
}) => {
  const [step, setStep] = useState<'select' | 'validate' | 'confirm' | 'uploading' | 'success'>('select');
  const [formData, setFormData] = useState<{
    comisaria_id: number | null;
    archivo: File | null;
    nombre_cronograma: string;
  }>({
    comisaria_id: preselectedComisariaId || null,
    archivo: null,
    nombre_cronograma: ''
  });
  const [validation, setValidation] = useState<ExcelValidationResult | null>(null);

  const queryClient = useQueryClient();
  const { data: comisarias = [] } = useComisarias();

  // Mutación para validar archivo
  const validateMutation = useMutation({
    mutationFn: (file: File) => cronogramaService.validateExcelFile(file),
    onSuccess: (result) => {
      setValidation(result);
      if (result.isValid) {
        setStep('confirm');
      } else {
        setStep('validate');
      }
    },
    onError: (error) => {
      console.error('Error validando archivo:', error);
      alert('Error al validar el archivo Excel');
    }
  });

  // Usar el hook que maneja correctamente las query keys
  const baseUploadMutation = useImportCronograma();

  // Extender el hook con nuestra lógica de UI
  const uploadMutation = {
    ...baseUploadMutation,
    mutate: (data: CronogramaUploadData) => {
      baseUploadMutation.mutate(data, {
        onSuccess: () => {
          setStep('success');
          // Cerrar automáticamente después de 3 segundos
          setTimeout(() => {
            handleClose();
          }, 3000);
        },
        onError: (error) => {
          console.error('Error importando cronograma:', error);
          alert(`Error al importar cronograma: ${error}`);
          setStep('select');
        }
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx')) {
      alert('Por favor selecciona un archivo Excel (.xlsx)');
      return;
    }

    setFormData(prev => ({
      ...prev,
      archivo: file,
      nombre_cronograma: prev.nombre_cronograma || file.name.replace('.xlsx', '')
    }));

    // Auto-validar el archivo
    setStep('validate');
    validateMutation.mutate(file);
  };

  const handleUpload = () => {
    if (!formData.comisaria_id || !formData.archivo) {
      alert('Por favor completa todos los campos');
      return;
    }

    setStep('uploading');
    uploadMutation.mutate({
      comisaria_id: formData.comisaria_id,
      archivo: formData.archivo,
      nombre_cronograma: formData.nombre_cronograma
    });
  };

  const handleClose = () => {
    setStep('select');
    setFormData({
      comisaria_id: preselectedComisariaId || null,
      archivo: null,
      nombre_cronograma: ''
    });
    setValidation(null);
    onClose();
  };

  const renderStepContent = () => {
    switch (step) {
      case 'select':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                📊 Subir Cronograma Valorizado
              </h3>
              <p className="text-gray-600 mb-6">
                Selecciona la comisaría y el archivo Excel con el cronograma valorizado.
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
                  Nombre del cronograma
                </label>
                <Input
                  type="text"
                  placeholder="ej: Cronograma COLLIQUE 2026"
                  value={formData.nombre_cronograma}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    nombre_cronograma: e.target.value
                  }))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Archivo Excel (.xlsx) *
                </label>
                <input
                  type="file"
                  accept=".xlsx"
                  onChange={handleFileSelect}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nemaec-500 focus:border-nemaec-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Solo archivos .xlsx. Máximo 10MB.
                </p>
              </div>
            </div>
          </div>
        );

      case 'validate':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                🔍 Validando Archivo...
              </h3>
            </div>

            {validateMutation.isPending && (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nemaec-600"></div>
                <span className="ml-3 text-gray-600">Analizando archivo Excel...</span>
              </div>
            )}

            {validation && !validation.isValid && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start">
                  <div className="text-red-400 text-xl mr-3">❌</div>
                  <div className="flex-1">
                    <h4 className="text-red-800 font-medium mb-2">
                      El archivo contiene errores
                    </h4>
                    <div className="space-y-1">
                      {validation.errors.slice(0, 10).map((error, index) => (
                        <p key={index} className="text-sm text-red-700">• {error}</p>
                      ))}
                      {validation.errors.length > 10 && (
                        <p className="text-sm text-red-600 font-medium">
                          ... y {validation.errors.length - 10} errores más
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {validation?.warnings && validation.warnings.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start">
                  <div className="text-yellow-400 text-xl mr-3">⚠️</div>
                  <div className="flex-1">
                    <h4 className="text-yellow-800 font-medium mb-2">
                      Advertencias encontradas
                    </h4>
                    <div className="space-y-1">
                      {validation.warnings.slice(0, 5).map((warning, index) => (
                        <p key={index} className="text-sm text-yellow-700">• {warning}</p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 'confirm':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                ✅ Cronograma Listo para Importar
              </h3>
            </div>

            {validation && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-green-800">Total de partidas:</span>
                    <span className="ml-2 text-green-700">{validation.stats.partidas_validas}</span>
                  </div>
                  <div>
                    <span className="font-medium text-green-800">Presupuesto total:</span>
                    <span className="ml-2 text-green-700">
                      S/ {validation.stats.total_presupuesto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {validation?.preview && validation.preview.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Vista previa de partidas:</h4>
                <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
                  <div className="space-y-2">
                    {validation.preview.slice(0, 5).map((partida, index) => (
                      <div key={index} className="text-sm border-l-2 border-nemaec-500 pl-3">
                        <div className="font-medium text-gray-900">
                          {partida.codigo_partida} - {partida.descripcion}
                        </div>
                        <div className="text-gray-600">
                          {partida.unidad} • S/ {partida.precio_total.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    ))}
                    {validation.preview.length > 5 && (
                      <p className="text-sm text-gray-500 italic">
                        ... y {validation.stats.partidas_validas - 5} partidas más
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {validation?.warnings && validation.warnings.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  <strong>Nota:</strong> Se encontraron {validation.warnings.length} advertencias
                  que no impiden la importación.
                </p>
              </div>
            )}
          </div>
        );

      case 'uploading':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                📤 Importando Cronograma...
              </h3>
            </div>

            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nemaec-600"></div>
              <span className="ml-3 text-gray-600">
                Procesando {validation?.stats.partidas_validas} partidas...
              </span>
            </div>

            <div className="text-center text-sm text-gray-500">
              Este proceso puede tomar unos momentos dependiendo del tamaño del cronograma.
            </div>
          </div>
        );

      case 'success':
        return (
          <div className="space-y-6">
            <div className="text-center py-8">
              <div className="text-6xl mb-4">✅</div>
              <h3 className="text-lg font-semibold text-green-800 mb-4">
                ¡Cronograma Importado Exitosamente!
              </h3>
              <p className="text-gray-600 mb-4">
                Se procesaron {validation?.stats.partidas_validas} partidas correctamente.
              </p>
              <div className="text-sm text-gray-500">
                El modal se cerrará automáticamente en unos segundos...
              </div>
            </div>
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
          </>
        );

      case 'validate':
        if (!validation?.isValid) {
          return (
            <>
              <Button variant="secondary" onClick={() => setStep('select')}>
                Seleccionar otro archivo
              </Button>
              <Button variant="secondary" onClick={handleClose}>
                Cancelar
              </Button>
            </>
          );
        }
        return null;

      case 'confirm':
        return (
          <>
            <Button variant="secondary" onClick={() => setStep('select')}>
              Cambiar archivo
            </Button>
            <Button
              variant="primary"
              onClick={handleUpload}
              disabled={!formData.comisaria_id || !formData.archivo}
            >
              Importar cronograma
            </Button>
          </>
        );

      case 'uploading':
        return (
          <Button variant="secondary" disabled>
            Procesando...
          </Button>
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
      <div className="p-6">190
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