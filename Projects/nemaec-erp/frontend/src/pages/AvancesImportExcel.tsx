/**
 * 📊 AVANCES IMPORT EXCEL PAGE - NEMAEC ERP
 * Página para importar avances físicos desde Excel
 */

import React, { useState } from 'react';
import { SeguimientoUpload } from '@/components/seguimiento/SeguimientoUpload';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/card';
import { useComisarias } from '@/hooks/useComisarias';

const AvancesImportExcel: React.FC = () => {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedComisariaId, setSelectedComisariaId] = useState<number | null>(null);

  const { data: comisarias = [], isLoading } = useComisarias();

  // Generar template de Excel (placeholder para ahora)
  const handleGenerarTemplate = async (comisariaId?: number) => {
    // Aquí se integraría con el backend para generar el template
    alert(`Generando template Excel${comisariaId ? ` para comisaría ${comisariaId}` : ''}...`);
  };

  const handleOpenUpload = (comisariaId?: number) => {
    setSelectedComisariaId(comisariaId || null);
    setIsUploadModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-nemaec-gray-900 to-black p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nemaec-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-nemaec-gray-900 to-black p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">
                📊 Importar Avances Físicos
              </h1>
              <p className="text-nemaec-gray-300">
                Gestiona la importación de avances físicos desde archivos Excel
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => handleGenerarTemplate()}
              >
                📋 Generar Template
              </Button>
              <Button
                variant="primary"
                onClick={() => handleOpenUpload()}
              >
                📤 Subir Avances
              </Button>
            </div>
          </div>
        </div>

        {/* Instrucciones principales */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card className="bg-nemaec-gray-800 border-nemaec-gray-700 text-white p-6">
            <div className="text-center">
              <div className="text-4xl mb-4">📋</div>
              <h3 className="text-xl font-bold mb-2 text-nemaec-green-400">
                1. Generar Template
              </h3>
              <p className="text-nemaec-gray-300 text-sm">
                Descarga el Excel template con las partidas exactas de la base de datos.
                Incluye códigos y descripciones para validación doble.
              </p>
            </div>
          </Card>

          <Card className="bg-nemaec-gray-800 border-nemaec-gray-700 text-white p-6">
            <div className="text-center">
              <div className="text-4xl mb-4">✏️</div>
              <h3 className="text-xl font-bold mb-2 text-nemaec-yellow-500">
                2. Llenar Avances
              </h3>
              <p className="text-nemaec-gray-300 text-sm">
                Completa SOLO la columna "% AVANCE_EJECUTADO".
                No modifiques códigos ni descripciones.
              </p>
            </div>
          </Card>

          <Card className="bg-nemaec-gray-800 border-nemaec-gray-700 text-white p-6">
            <div className="text-center">
              <div className="text-4xl mb-4">🔒</div>
              <h3 className="text-xl font-bold mb-2 text-nemaec-red-400">
                3. Validación Automática
              </h3>
              <p className="text-nemaec-gray-300 text-sm">
                El sistema validará que las partidas coincidan exactamente.
                Bloquea cambios no autorizados.
              </p>
            </div>
          </Card>
        </div>

        {/* Lista de comisarías */}
        <Card className="bg-nemaec-gray-800 border-nemaec-gray-700">
          <div className="p-6">
            <h2 className="text-xl font-bold text-white mb-4">
              🏗️ Comisarías Disponibles
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {comisarias.map((comisaria) => (
                <Card key={comisaria.id} className="bg-nemaec-gray-700 border-nemaec-gray-600 hover:bg-nemaec-gray-650 transition-colors">
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-medium text-nemaec-green-400 text-sm mb-1">
                          {comisaria.nombre}
                        </h3>
                        <p className="text-xs text-nemaec-gray-300">
                          {comisaria.codigo}
                        </p>
                        <p className="text-xs text-nemaec-gray-400 mt-1">
                          {comisaria.ubicacion?.distrito}, {comisaria.ubicacion?.provincia}
                        </p>
                      </div>
                      <div className="text-xs bg-nemaec-green-800 text-nemaec-green-200 px-2 py-1 rounded">
                        {comisaria.tipo}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleGenerarTemplate(comisaria.id)}
                        className="text-xs flex-1"
                      >
                        📋 Template
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleOpenUpload(comisaria.id)}
                        className="text-xs flex-1"
                      >
                        📤 Subir
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {comisarias.length === 0 && (
              <div className="text-center py-12 text-nemaec-gray-400">
                No hay comisarías disponibles
              </div>
            )}
          </div>
        </Card>

        {/* Información adicional */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-blue-900/20 border-blue-700/50">
            <div className="p-6">
              <h3 className="text-lg font-bold text-blue-300 mb-3">
                ℹ️ Formato del Excel
              </h3>
              <div className="space-y-2 text-sm text-blue-200">
                <div>• <strong>CODIGO_PARTIDA:</strong> No modificar</div>
                <div>• <strong>DESCRIPCION:</strong> No modificar</div>
                <div>• <strong>% AVANCE_EJECUTADO:</strong> Valor entre 0.00 y 1.00</div>
                <div>• <strong>OBSERVACIONES:</strong> Comentarios opcionales</div>
              </div>
            </div>
          </Card>

          <Card className="bg-red-900/20 border-red-700/50">
            <div className="p-6">
              <h3 className="text-lg font-bold text-red-300 mb-3">
                🚨 Casos que Bloquean
              </h3>
              <div className="space-y-2 text-sm text-red-200">
                <div>• Código de partida modificado</div>
                <div>• Descripción cambiada</div>
                <div>• Partida nueva no autorizada</div>
                <div>• Partida eliminada del cronograma</div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Modal de Upload */}
      <SeguimientoUpload
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        preselectedComisariaId={selectedComisariaId || undefined}
      />
    </div>
  );
};

export default AvancesImportExcel;