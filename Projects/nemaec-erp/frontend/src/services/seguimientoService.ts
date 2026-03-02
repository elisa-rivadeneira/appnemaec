/**
 * 📊 SEGUIMIENTO SERVICE - NEMAEC ERP
 * Servicio para gestionar avances físicos y seguimiento de obras
 */

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

  // Para validación de partidas, 422 es una respuesta válida (validación fallida)
  const responseData = await response.json();

  if (!response.ok) {
    if (response.status === 422 && endpoint.includes('validar-partidas')) {
      // Para validación fallida (422), devolver los datos tal como vienen
      // El frontend manejará esto como ValidationResult con error
      return responseData as T;
    } else {
      // Para otros errores, lanzar excepción
      throw new Error(responseData.detail || responseData.message || `HTTP ${response.status}`);
    }
  }

  return responseData;
};

interface ValidationResult {
  // Para validación exitosa (HTTP 200)
  success?: boolean;
  partidas_validadas?: number;
  mensaje?: string;
  permitir_avance?: boolean;
  siguiente_paso?: string;

  // Para validación fallida (HTTP 422)
  error?: string;
  message?: string;
  reporte_diferencias?: string;
  accion_requerida?: string;
  total_diferencias?: number;

  // Campos comunes
  isValid?: boolean;
  errores?: string[];
  diferencias?: Array<{
    codigo: string;
    tipo_diferencia: string;
    descripcion_excel: string;
    descripcion_db: string | null;
    mensaje: string;
    estado: string;
  }>;
}

interface ImportAvancesResult {
  success: boolean;
  message: string;
  puntos_avance_creados: number;
  curva_actualizada: boolean;
}

interface AvanceFisico {
  id: number;
  comisaria_id: number;
  fecha_reporte: string;
  dias_transcurridos: number;
  avance_programado_acum: number;
  avance_ejecutado_acum: number;
  archivo_seguimiento: string;
  observaciones: string;
  created_at: string;
  updated_at: string;
}

interface DetalleAvancePartida {
  id: number;
  avance_fisico_id: number;
  codigo_partida: string;
  porcentaje_avance: number;
  monto_ejecutado: number;
  observaciones_partida: string;
}

export class SeguimientoService {
  private baseUrl = 'seguimiento';

  /**
   * 🔍 Validar partidas antes de permitir subir avances
   */
  async validarPartidas(comisaria_id: number, archivo: File): Promise<ValidationResult> {
    const formData = new FormData();
    formData.append('comisaria_id', comisaria_id.toString());
    formData.append('archivo', archivo);

    return apiCall<ValidationResult>(`/${this.baseUrl}/validar-partidas`, {
      method: 'POST',
      body: formData,
      headers: {} // Don't set Content-Type for FormData, let browser set it
    });
  }

  /**
   * 📤 Importar avances físicos después de validación exitosa
   */
  async importarAvances(
    comisaria_id: number,
    archivo: File,
    validacion_previa: boolean = false
  ): Promise<ImportAvancesResult> {
    const formData = new FormData();
    formData.append('comisaria_id', comisaria_id.toString());
    formData.append('archivo', archivo);
    formData.append('validacion_previa', validacion_previa.toString());

    return apiCall<ImportAvancesResult>(`/${this.baseUrl}/import-avances`, {
      method: 'POST',
      body: formData,
      headers: {} // Don't set Content-Type for FormData, let browser set it
    });
  }

  /**
   * 📋 Verificar si el cronograma está actualizado
   */
  async verificarCronogramaActualizado(comisaria_id: number) {
    return apiCall(`/${this.baseUrl}/cronograma-actualizado/${comisaria_id}`);
  }

  /**
   * 💡 Sugerir actualización del cronograma basado en Excel
   */
  async sugerirActualizacionCronograma(comisaria_id: number, archivo_avances: File) {
    const formData = new FormData();
    formData.append('comisaria_id', comisaria_id.toString());
    formData.append('archivo_avances', archivo_avances);

    return apiCall(`/${this.baseUrl}/sugerir-actualizacion-cronograma`, {
      method: 'POST',
      body: formData,
      headers: {}
    });
  }

  /**
   * 📊 Obtener avances físicos de una comisaría
   */
  async getAvancesFisicos(comisaria_id: number): Promise<AvanceFisico[]> {
    return apiCall<AvanceFisico[]>(`/${this.baseUrl}/avances-fisicos/${comisaria_id}`);
  }

  /**
   * 📈 Obtener detalle de avances por partida
   */
  async getDetalleAvancesPartidas(avance_fisico_id: number): Promise<DetalleAvancePartida[]> {
    return apiCall<DetalleAvancePartida[]>(`/${this.baseUrl}/detalle-avances/${avance_fisico_id}`);
  }

  /**
   * 🎯 Obtener último avance físico de una comisaría
   */
  async getUltimoAvance(comisaria_id: number): Promise<AvanceFisico | null> {
    try {
      return await apiCall<AvanceFisico>(`/${this.baseUrl}/ultimo-avance/${comisaria_id}`);
    } catch (error: any) {
      if (error.message.includes('404')) {
        return null; // No hay avances aún
      }
      throw error;
    }
  }

  /**
   * 📉 Obtener curva de avances (programado vs ejecutado)
   */
  async getCurvaAvances(comisaria_id: number) {
    return apiCall(`/${this.baseUrl}/curva-avances/${comisaria_id}`);
  }

  /**
   * 🚨 Obtener alertas de seguimiento
   */
  async getAlertasSeguimiento(comisaria_id: number) {
    return apiCall(`/${this.baseUrl}/alertas/${comisaria_id}`);
  }

  /**
   * 🔍 Comparar partidas lado a lado
   */
  async compararPartidas(comisaria_id: number, archivo: File) {
    const formData = new FormData();
    formData.append('comisaria_id', comisaria_id.toString());
    formData.append('archivo_avances', archivo);

    return apiCall(`/${this.baseUrl}/comparar-partidas`, {
      method: 'POST',
      body: formData,
      headers: {} // Don't set Content-Type for FormData, let browser set it
    });
  }
}

// Instancia singleton
export const seguimientoService = new SeguimientoService();