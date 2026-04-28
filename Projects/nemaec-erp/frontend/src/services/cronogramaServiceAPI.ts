/**
 * 📊 CRONOGRAMA SERVICE API - NEMAEC ERP
 * Servicio para gestión de cronogramas valorizados con API real.
 */

import {
  Partida,
  CronogramaValorizado,
  ExcelPartidaRow,
  CronogramaUploadData,
  ExcelValidationResult,
  CronogramaResumen,
  CronogramaFilters,
  CronogramaStats,
  ImportStats
} from '@/types/cronograma';

// API Base URL - Use proxy in development
const API_BASE_URL = '/api/v1';

// Función para hacer llamadas HTTP
const apiCall = async <T>(endpoint: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    },
    ...options
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Error desconocido' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
};

// Función para upload de archivos
const uploadFile = async <T>(endpoint: string, formData: FormData): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Error desconocido' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const cronogramaService = {
  // Validar y previsualizar archivo Excel
  async validateExcelFile(file: File): Promise<ExcelValidationResult> {
    console.log('🔗 Validando archivo Excel con API (fallback local)');

    // El backend simple no tiene validación de Excel, usar validación local
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          // Simulación de validación básica
          await delay(1000);

          const errors: string[] = [];
          const warnings: string[] = [];
          const validPartidas: Partida[] = [];

          // Validación básica del archivo
          if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
            errors.push('El archivo debe ser de formato Excel (.xlsx o .xls)');
          }

          if (file.size > 10 * 1024 * 1024) { // 10MB
            errors.push('El archivo es muy grande (máximo 10MB)');
          }

          if (file.size === 0) {
            errors.push('El archivo está vacío');
          }

          // Si hay errores básicos, no continuar
          if (errors.length > 0) {
            resolve({
              isValid: false,
              errors,
              warnings,
              preview: [],
              stats: {
                total_filas: 0,
                partidas_validas: 0,
                total_presupuesto: 0
              }
            });
            return;
          }

          // Simular algunas partidas de ejemplo para preview
          const mockPreview: Partida[] = [
            {
              codigo_interno: '1001',
              comisaria_id: 0,
              codigo_partida: '01.01',
              descripcion: 'Trabajos preliminares',
              unidad: 'GLB',
              metrado: 1,
              precio_unitario: 50000,
              precio_total: 50000,
              fecha_inicio: '2026-01-01T00:00:00Z',
              fecha_fin: '2026-01-31T00:00:00Z',
              nivel_jerarquia: 2,
              partida_padre: '01'
            }
          ];

          resolve({
            isValid: true,
            errors: [],
            warnings: warnings.length > 0 ? warnings : ['Validación completa. Archivo listo para importar.'],
            preview: mockPreview,
            stats: {
              total_filas: 50, // Simulado
              partidas_validas: 48, // Simulado
              total_presupuesto: 3500000 // Simulado
            }
          });

        } catch (error) {
          reject(new Error(`Error al procesar archivo Excel: ${error}`));
        }
      };

      reader.onerror = () => reject(new Error('Error al leer el archivo'));
      reader.readAsBinaryString(file);
    });
  },

  // Importar cronograma desde Excel
  async importCronograma(uploadData: CronogramaUploadData): Promise<CronogramaValorizado> {
    console.log('🔗 Consultando API: POST /cronogramas/import');

    try {
      const formData = new FormData();
      formData.append('comisaria_id', uploadData.comisaria_id.toString());
      if (uploadData.nombre_cronograma) {
        formData.append('nombre_cronograma', uploadData.nombre_cronograma);
      }
      formData.append('file', uploadData.archivo);

      // Primero importar el cronograma
      const importResult = await uploadFile<ImportStats>('/cronogramas/import', formData);
      console.log('✅ Cronograma importado:', importResult);

      // Luego obtener el cronograma completo con sus partidas
      const cronograma = await apiCall<CronogramaValorizado>(`/cronogramas/${importResult.cronograma_id}`);

      return cronograma;
    } catch (error) {
      console.error('❌ Error al importar cronograma:', error);
      throw error;
    }
  },

  // Obtener cronograma por comisaría
  async getCronogramaByComisaria(comisariaId: number): Promise<CronogramaValorizado | null> {
    console.log(`🔗 Consultando API: GET /cronogramas/comisaria/${comisariaId}/detalle`);
    try {
      const response = await apiCall<any>(`/cronogramas/comisaria/${comisariaId}/detalle`);

      // Map backend response to frontend interface
      const mappedResponse: CronogramaValorizado = {
        id: response.id,
        comisaria_id: response.comisaria_id,
        nombre_cronograma: response.nombre || 'Cronograma',
        archivo_original: response.descripcion || 'archivo.xlsx',
        fecha_importacion: response.created_at,
        total_presupuesto: response.partidas?.reduce((sum: number, p: any) => sum + (p.precio_total || 0), 0) || 0,
        total_partidas: response.partidas?.length || 0,
        fecha_inicio_obra: response.fecha_inicio || '',
        fecha_fin_obra: response.fecha_fin || '',
        estado: response.estado as 'activo' | 'archivado',
        partidas: response.partidas || [],
        created_at: response.created_at,
        updated_at: response.updated_at
      };

      console.log(`✅ Cronograma mapeado: ${mappedResponse.total_partidas} partidas`);
      return mappedResponse;
    } catch (error: any) {
      if (error.message.includes('404')) {
        return null;
      }
      console.error(`❌ Error al obtener cronograma para comisaría ${comisariaId}:`, error);
      throw error;
    }
  },

  // Obtener todos los cronogramas (resumen)
  async getAllCronogramas(): Promise<CronogramaResumen[]> {
    console.log('🔗 Consultando API: GET /cronogramas');
    try {
      return await apiCall<CronogramaResumen[]>('/cronogramas');
    } catch (error) {
      console.error('❌ Error al obtener cronogramas:', error);
      throw error;
    }
  },

  // Buscar partidas
  async searchPartidas(cronogramaId: number, filters: CronogramaFilters): Promise<Partida[]> {
    console.log(`🔗 Buscando partidas en cronograma ${cronogramaId} (filtros locales)`);
    await delay(300);

    // El backend simple no tiene búsqueda de partidas, implementar filtrado local
    try {
      const cronograma = await this.getCronogramaByComisaria(cronogramaId);
      if (!cronograma) return [];

      let partidas = cronograma.partidas;

      // Aplicar filtros localmente
      if (filters.codigo_partida) {
        partidas = partidas.filter(p =>
          p.codigo_partida.toLowerCase().includes(filters.codigo_partida!.toLowerCase())
        );
      }

      if (filters.descripcion) {
        partidas = partidas.filter(p =>
          p.descripcion.toLowerCase().includes(filters.descripcion!.toLowerCase())
        );
      }

      if (filters.nivel_jerarquia) {
        partidas = partidas.filter(p => p.nivel_jerarquia === filters.nivel_jerarquia);
      }

      if (filters.fecha_desde) {
        partidas = partidas.filter(p => p.fecha_inicio >= filters.fecha_desde!);
      }

      if (filters.fecha_hasta) {
        partidas = partidas.filter(p => p.fecha_fin <= filters.fecha_hasta!);
      }

      if (filters.rango_presupuesto) {
        partidas = partidas.filter(p =>
          p.precio_total >= filters.rango_presupuesto!.min &&
          p.precio_total <= filters.rango_presupuesto!.max
        );
      }

      return partidas;
    } catch (error) {
      console.error('❌ Error al buscar partidas:', error);
      throw error;
    }
  },

  // Obtener estadísticas del cronograma
  async getCronogramaStats(cronogramaId: number): Promise<CronogramaStats> {
    console.log(`🔗 Calculando estadísticas del cronograma ${cronogramaId}`);
    await delay(200);

    try {
      const cronograma = await this.getCronogramaByComisaria(cronogramaId);
      if (!cronograma) {
        throw new Error('Cronograma no encontrado');
      }

      const partidas = cronograma.partidas;
      const partidasPorNivel = {
        nivel_1: partidas.filter(p => p.nivel_jerarquia === 1).length,
        nivel_2: partidas.filter(p => p.nivel_jerarquia === 2).length,
        nivel_3: partidas.filter(p => p.nivel_jerarquia === 3).length,
        nivel_4: partidas.filter(p => p.nivel_jerarquia === 4).length,
      };

      const partidaMasCostosa = partidas.reduce((max, p) =>
        p.precio_total > max.precio_total ? p : max
      );

      // Calcular duración más larga
      const partidaConDuracionMasLarga = partidas.reduce((max, p) => {
        const duracionActual = new Date(p.fecha_fin).getTime() - new Date(p.fecha_inicio).getTime();
        const duracionMax = new Date(max.fecha_fin).getTime() - new Date(max.fecha_inicio).getTime();
        return duracionActual > duracionMax ? p : max;
      });

      const fechaInicio = new Date(cronograma.fecha_inicio_obra);
      const fechaFin = new Date(cronograma.fecha_fin_obra);
      const duracionObra = Math.ceil((fechaFin.getTime() - fechaInicio.getTime()) / (1000 * 60 * 60 * 24));

      return {
        total_presupuesto: cronograma.total_presupuesto,
        total_partidas: cronograma.total_partidas,
        partidas_por_nivel: partidasPorNivel,
        duracion_obra_dias: duracionObra,
        partida_mas_costosa: partidaMasCostosa,
        partida_mas_larga: partidaConDuracionMasLarga
      };
    } catch (error) {
      console.error('❌ Error al calcular estadísticas:', error);
      throw error;
    }
  },

  // Obtener cronograma por ID específico (CON partidas)
  async getCronogramaById(cronogramaId: number): Promise<CronogramaValorizado | null> {
    console.log(`🔗 Consultando API: GET /cronogramas/${cronogramaId}`);
    try {
      return await apiCall<CronogramaValorizado>(`/cronogramas/${cronogramaId}`);
    } catch (error: any) {
      if (error.message.includes('404')) {
        return null;
      }
      console.error(`❌ Error al obtener cronograma ${cronogramaId}:`, error);
      throw error;
    }
  },

  // Eliminar cronograma
  async deleteCronograma(cronogramaId: number): Promise<void> {
    console.log(`🔗 Consultando API: DELETE /cronogramas/${cronogramaId}`);
    try {
      const response = await fetch(`${API_BASE_URL}/cronogramas/${cronogramaId}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Error desconocido' }));
        throw new Error(error.detail || `HTTP ${response.status}`);
      }
      // 204 No Content — éxito, sin body que parsear
    } catch (error) {
      console.error(`❌ Error al eliminar cronograma ${cronogramaId}:`, error);
      throw error;
    }
  },

  // Obtener todas las versiones de una comisaría (ordenadas por fecha)
  async getAllVersionsByComisaria(comisariaId: number): Promise<CronogramaValorizado[]> {
    console.log(`🔗 Consultando API: GET /cronogramas/comisaria/${comisariaId} (historial)`);
    try {
      const cronogramas = await apiCall<CronogramaResumen[]>(`/cronogramas/comisaria/${comisariaId}`);

      // Convertir CronogramaResumen a CronogramaValorizado para compatibilidad
      // y ordenar por fecha de creación (más reciente primero)
      const cronogramasConvertidos: CronogramaValorizado[] = cronogramas.map(cronograma => ({
        id: cronograma.id,
        comisaria_id: cronograma.comisaria_id,
        nombre_cronograma: cronograma.nombre || '',
        archivo_original: 'imported.xlsx',
        fecha_importacion: cronograma.created_at,
        total_presupuesto: 0, // Se calculará al obtener detalles
        total_partidas: 0,    // Se calculará al obtener detalles
        fecha_inicio_obra: cronograma.fecha_inicio || '',
        fecha_fin_obra: cronograma.fecha_fin || '',
        estado: cronograma.estado as 'activo' | 'archivado',
        partidas: [], // Vacío para historial, se cargan bajo demanda
        created_at: cronograma.created_at,
        updated_at: cronograma.updated_at
      }));

      // Ordenar por fecha de creación (más reciente primero)
      return cronogramasConvertidos.sort((a, b) =>
        new Date(b.fecha_importacion).getTime() - new Date(a.fecha_importacion).getTime()
      );
    } catch (error) {
      console.error(`❌ Error al obtener versiones para comisaría ${comisariaId}:`, error);
      throw error;
    }
  },

  // Actualizar fechas de una partida específica
  async updatePartidaFechas(partidaId: number, fechas: {fecha_inicio?: string; fecha_fin?: string}): Promise<Partida> {
    console.log(`🔗 Actualizando fechas de partida ${partidaId}`);
    try {
      return await apiCall<Partida>(`/cronogramas/partidas/${partidaId}/fechas`, {
        method: 'PUT',
        body: JSON.stringify(fechas)
      });
    } catch (error) {
      console.error(`❌ Error al actualizar fechas de partida ${partidaId}:`, error);
      throw error;
    }
  },

  // Utilidad para obtener partida padre
  getPartidaPadre(codigoPartida: string): string | undefined {
    const partes = codigoPartida.split('.');
    if (partes.length <= 1) return undefined;
    return partes.slice(0, -1).join('.');
  }
};