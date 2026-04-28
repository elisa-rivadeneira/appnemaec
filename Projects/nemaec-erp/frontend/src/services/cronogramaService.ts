/**
 * 📊 CRONOGRAMA SERVICE - NEMAEC ERP
 * Servicio para gestión de cronogramas valorizados con importación Excel
 */

import * as XLSX from 'xlsx';
import {
  Partida,
  CronogramaValorizado,
  ExcelPartidaRow,
  CronogramaUploadData,
  ExcelValidationResult,
  CronogramaResumen,
  CronogramaFilters,
  CronogramaStats
} from '@/types/cronograma';

// Función para cargar cronogramas del localStorage
const loadCronogramas = (): CronogramaValorizado[] => {
  try {
    const saved = localStorage.getItem('nemaec_cronogramas');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.warn('Error loading cronogramas from localStorage:', error);
  }
  return [];
};

// Función para guardar cronogramas en localStorage
const saveCronogramas = (cronogramas: CronogramaValorizado[]) => {
  try {
    localStorage.setItem('nemaec_cronogramas', JSON.stringify(cronogramas));
  } catch (error) {
    console.warn('Error saving cronogramas to localStorage:', error);
  }
};

// Función para cargar IDs del localStorage
const loadIds = () => {
  try {
    const saved = localStorage.getItem('nemaec_cronograma_ids');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.warn('Error loading IDs from localStorage:', error);
  }
  return { nextId: 1, nextPartidaId: 1 };
};

// Función para guardar IDs en localStorage
const saveIds = (nextId: number, nextPartidaId: number) => {
  try {
    localStorage.setItem('nemaec_cronograma_ids', JSON.stringify({ nextId, nextPartidaId }));
  } catch (error) {
    console.warn('Error saving IDs to localStorage:', error);
  }
};

// Mock data para desarrollo con persistencia
const mockCronogramas: CronogramaValorizado[] = loadCronogramas();
const { nextId: loadedNextId, nextPartidaId: loadedNextPartidaId } = loadIds();
let nextId = loadedNextId;
let nextPartidaId = loadedNextPartidaId;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const cronogramaService = {
  // Validar y previsualizar archivo Excel
  async validateExcelFile(file: File): Promise<ExcelValidationResult> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];

          // Convertir a JSON con cabeceras
          const jsonData: ExcelPartidaRow[] = XLSX.utils.sheet_to_json(worksheet, { raw: false, dateNF: 'yyyy-mm-dd' });
          // También leer con raw:true para obtener números reales (no strings)
          const jsonDataRaw: ExcelPartidaRow[] = XLSX.utils.sheet_to_json(worksheet, { raw: true });

          if (jsonData.length === 0) {
            resolve({ isValid: false, errors: ['El archivo está vacío o no tiene datos'], warnings: [], preview: [], stats: { total_filas: 0, partidas_validas: 0, total_presupuesto: 0 } });
            return;
          }

          const headers = Object.keys(jsonData[0] || {});
          console.log('🔍 XLSX Debug - Headers detectados:', headers);
          console.log('🔍 XLSX Debug - Primera fila raw:', jsonDataRaw[0]);

          // Detectar formato:
          // Formato A (nuevo): ITEM, DESCRIPCION, UND, CANT, PU, PARCIAL, FECHA INICIO, FECHA FIN
          // Formato B (viejo): __EMPTY_1, __EMPTY_3, __EMPTY_4, ...
          // Formato C (tu archivo): comisaria, proveedor, codigo, partida, und, metrado, pu, parcial, inicio, fec_termino
          const isFormatoA = headers.some(h => h.toUpperCase() === 'ITEM') &&
                             headers.some(h => h.toUpperCase() === 'DESCRIPCION');
          const isFormatoC = headers.some(h => h.toUpperCase() === 'CODIGO') &&
                             headers.some(h => h.toUpperCase() === 'PARTIDA');

          // Normalizar código de partida igual que el backend
          const normalizarCodigo = (val: any): string => {
            if (val === null || val === undefined) return '';
            if (typeof val === 'string') {
              const s = val.trim();
              if (!s || s === 'nan' || s === 'None') return '';
              return s.split('.').map(p => {
                const t = p.trim();
                return /^\d+$/.test(t) ? t.padStart(2, '0') : t;
              }).join('.');
            }
            if (typeof val === 'number') {
              if (isNaN(val) || !isFinite(val)) return '';
              const s = String(val);
              if (!s.includes('.')) return s.padStart(2, '0');
              const [intPart, decPart] = s.split('.');
              if (decPart === '0') return intPart.padStart(2, '0');
              // 1 dígito decimal → Excel truncó el cero final (2.1 era 2.10)
              if (decPart.length === 1) return intPart.padStart(2, '0') + '.' + decPart + '0';
              return intPart.padStart(2, '0') + '.' + decPart.padStart(2, '0');
            }
            return normalizarCodigo(String(val));
          };

          const parseFecha = (val: any): string | null => {
            if (!val) return null;
            if (val instanceof Date) return isNaN(val.getTime()) ? null : val.toISOString();
            if (typeof val === 'string') {
              const d = new Date(val);
              return isNaN(d.getTime()) ? null : d.toISOString();
            }
            return null;
          };

          const parseFloat2 = (val: any): number => {
            if (val === null || val === undefined || val === '') return 0;
            const n = parseFloat(String(val).replace(',', '.'));
            return isNaN(n) ? 0 : n;
          };

          const errors: string[] = [];
          const warnings: string[] = [];
          const validPartidas: Partida[] = [];
          let totalPresupuesto = 0;

          jsonDataRaw.forEach((rowRaw, index) => {
            const rowFmt = jsonData[index];
            const rowNumber = index + 2;

            let codigoRaw: any, descripcion: any, unidad: any, metrado: any,
                precioUnitario: any, precioTotal: any, fechaInicioRaw: any, fechaFinRaw: any;

            if (isFormatoA) {
              // Buscar keys case-insensitive
              const key = (name: string) => {
                const found = Object.keys(rowRaw).find(k => k.trim().toUpperCase() === name.toUpperCase());
                return found ? rowRaw[found] : undefined;
              };
              const keyFmt = (name: string) => {
                const found = Object.keys(rowFmt).find(k => k.trim().toUpperCase() === name.toUpperCase());
                return found ? rowFmt[found] : undefined;
              };
              codigoRaw      = key('ITEM');
              descripcion    = key('DESCRIPCION');
              unidad         = key('UND');
              metrado        = key('CANT');
              precioUnitario = key('PU');
              precioTotal    = key('PARCIAL');
              fechaInicioRaw = keyFmt('FECHA INICIO');
              fechaFinRaw    = keyFmt('FECHA FIN');
            } else if (isFormatoC) {
              // Formato C (tu archivo): comisaria, proveedor, codigo, partida, und, metrado, pu, parcial, inicio, fec_termino
              const key = (name: string) => {
                const found = Object.keys(rowRaw).find(k => k.trim().toUpperCase() === name.toUpperCase());
                return found ? rowRaw[found] : undefined;
              };
              const keyFmt = (name: string) => {
                const found = Object.keys(rowFmt).find(k => k.trim().toUpperCase() === name.toUpperCase());
                return found ? rowFmt[found] : undefined;
              };
              codigoRaw      = key('CODIGO');
              descripcion    = key('PARTIDA');
              unidad         = key('UND');
              metrado        = key('METRADO');
              precioUnitario = key('PU');
              precioTotal    = key('PARCIAL');
              fechaInicioRaw = keyFmt('INICIO');
              fechaFinRaw    = keyFmt('FEC_TERMINO');
            } else {
              // Formato viejo (Collique)
              codigoRaw      = rowRaw['__EMPTY_1'];
              descripcion    = rowRaw['__EMPTY_4'];
              unidad         = rowRaw['__EMPTY_5'];
              metrado        = rowRaw['__EMPTY_6'];
              precioUnitario = rowRaw['__EMPTY_7'];
              precioTotal    = rowRaw['__EMPTY_8'];
              fechaInicioRaw = rowFmt?.['FECHA\nINICIO'];
              fechaFinRaw    = rowFmt?.['FECHA\nFIN'];
            }

            const codigoPartida = normalizarCodigo(codigoRaw);
            const desc = descripcion ? String(descripcion).trim() : '';

            if (index <= 2) {
              console.log(`🔍 Fila ${rowNumber}:`, { codigoRaw, codigoPartida, desc, unidad, metrado, precioTotal, fechaInicioRaw, fechaFinRaw });
            }

            // Solo son obligatorios codigo y descripcion
            if (!codigoPartida) {
              errors.push(`Fila ${rowNumber}: Código de partida es obligatorio`);
            }
            if (!desc) {
              errors.push(`Fila ${rowNumber}: Descripción es obligatoria`);
            }

            if (codigoPartida && desc) {
              const fechaInicio = parseFecha(fechaInicioRaw);
              const fechaFin    = parseFecha(fechaFinRaw);
              const precio      = parseFloat2(precioTotal) || parseFloat2(metrado) * parseFloat2(precioUnitario);

              const partida: Partida = {
                codigo_interno: codigoPartida,
                comisaria_id: 0,
                codigo_partida: codigoPartida,
                descripcion: desc,
                unidad: unidad ? String(unidad).trim() : 'UND',
                metrado: parseFloat2(metrado),
                precio_unitario: parseFloat2(precioUnitario),
                precio_total: precio,
                fecha_inicio: fechaInicio || '',
                fecha_fin: fechaFin || '',
                nivel_jerarquia: codigoPartida.split('.').length,
                partida_padre: this.getPartidaPadre(codigoPartida)
              };

              validPartidas.push(partida);
              totalPresupuesto += partida.precio_total;
            }
          });

          resolve({
            isValid: errors.length === 0,
            errors,
            warnings,
            preview: validPartidas.slice(0, 10),
            stats: {
              total_filas: jsonData.length,
              partidas_validas: validPartidas.length,
              total_presupuesto: totalPresupuesto
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
    await delay(2000); // Simular procesamiento

    // Primero validar el archivo
    const validation = await this.validateExcelFile(uploadData.archivo);

    if (!validation.isValid) {
      throw new Error(`Archivo Excel inválido: ${validation.errors.join(', ')}`);
    }

    // Procesar el archivo completo
    const reader = new FileReader();

    return new Promise((resolve, reject) => {
      reader.onload = async (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData: ExcelPartidaRow[] = XLSX.utils.sheet_to_json(worksheet);

          // Convertir todas las filas a partidas
          const partidas: Partida[] = jsonData
            .filter(row => {
              const values = Object.values(row);
              return values[1] && values[3]; // Código interno y código de partida
            })
            .map(row => {
              const values = Object.values(row);
              const fechaInicio = row['FECHA\nINICIO'];
              const fechaFin = row['FECHA\nFIN'];

              // Mapeo corregido para la importación
              const metrado = row['__EMPTY_6'] || 0;
              const precioUnitario = row['__EMPTY_7'] || 0;
              const precioTotal = metrado * precioUnitario; // Calcular en lugar de leer columna fija

              return {
                id: nextPartidaId++,
                codigo_interno: row['__EMPTY_1'].toString(),
                comisaria_id: uploadData.comisaria_id,
                codigo_partida: row['__EMPTY_3'].toString(),
                descripcion: row['__EMPTY_4'].toString(),
                unidad: row['__EMPTY_5']?.toString() || 'UND',  // Corregido de __EMPTY_6 a __EMPTY_5
                metrado: metrado,
                precio_unitario: precioUnitario,
                precio_total: precioTotal,
                fecha_inicio: fechaInicio ? new Date(fechaInicio).toISOString() : '',
                fecha_fin: fechaFin ? new Date(fechaFin).toISOString() : '',
                nivel_jerarquia: row['__EMPTY_3'].toString().split('.').length,
                partida_padre: this.getPartidaPadre(row['__EMPTY_3'].toString()),
                created_at: new Date().toISOString()
              };
            });

          // Calcular estadísticas
          const totalPresupuesto = partidas.reduce((sum, p) => sum + p.precio_total, 0);
          const fechasInicio = partidas.map(p => new Date(p.fecha_inicio)).filter(d => !isNaN(d.getTime()));
          const fechasFin = partidas.map(p => new Date(p.fecha_fin)).filter(d => !isNaN(d.getTime()));

          const cronograma: CronogramaValorizado = {
            id: nextId++,
            comisaria_id: uploadData.comisaria_id,
            nombre_cronograma: uploadData.nombre_cronograma ||
              `Cronograma ${uploadData.archivo.name.replace('.xlsx', '')}`,
            archivo_original: uploadData.archivo.name,
            fecha_importacion: new Date().toISOString(),
            total_presupuesto: totalPresupuesto,
            total_partidas: partidas.length,
            fecha_inicio_obra: fechasInicio.length > 0 ?
              new Date(Math.min(...fechasInicio.map(d => d.getTime()))).toISOString() : '',
            fecha_fin_obra: fechasFin.length > 0 ?
              new Date(Math.max(...fechasFin.map(d => d.getTime()))).toISOString() : '',
            estado: 'activo',
            partidas,
            created_at: new Date().toISOString()
          };

          mockCronogramas.push(cronograma);

          // Guardar en localStorage
          saveCronogramas(mockCronogramas);
          saveIds(nextId, nextPartidaId);

          resolve(cronograma);

        } catch (error) {
          reject(new Error(`Error al importar cronograma: ${error}`));
        }
      };

      reader.readAsBinaryString(uploadData.archivo);
    });
  },

  // Obtener cronograma por comisaría (devuelve el más reciente)
  async getCronogramaByComisaria(comisariaId: number): Promise<CronogramaValorizado | null> {
    try {
      const response = await fetch(`/api/v1/cronogramas/comisaria/${comisariaId}/detalle`);
      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching cronograma by comisaria:', error);
      return null;
    }
  },

  // Obtener todos los cronogramas (resumen)
  async getAllCronogramas(): Promise<CronogramaResumen[]> {
    await delay(500);
    return mockCronogramas.map(c => ({
      id: c.id!,
      comisaria_id: c.comisaria_id,
      comisaria_nombre: `Comisaría ${c.comisaria_id}`, // En producción vendría de join
      nombre_cronograma: c.nombre_cronograma,
      total_presupuesto: c.total_presupuesto,
      total_partidas: c.total_partidas,
      fecha_inicio_obra: c.fecha_inicio_obra,
      fecha_fin_obra: c.fecha_fin_obra,
      estado: c.estado,
      fecha_importacion: c.fecha_importacion
    }));
  },

  // Buscar partidas
  async searchPartidas(cronogramaId: number, filters: CronogramaFilters): Promise<Partida[]> {
    await delay(300);

    const cronograma = mockCronogramas.find(c => c.id === cronogramaId);
    if (!cronograma) return [];

    let partidas = cronograma.partidas;

    // Aplicar filtros
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
  },

  // Obtener estadísticas del cronograma
  async getCronogramaStats(cronogramaId: number): Promise<CronogramaStats> {
    await delay(200);

    const cronograma = mockCronogramas.find(c => c.id === cronogramaId);
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
  },

  // Eliminar cronograma
  async deleteCronograma(cronogramaId: number): Promise<void> {
    await delay(400);
    const index = mockCronogramas.findIndex(c => c.id === cronogramaId);
    if (index === -1) {
      throw new Error('Cronograma no encontrado');
    }
    mockCronogramas.splice(index, 1);
  },

  // Utilidad para obtener partida padre
  getPartidaPadre(codigoPartida: string): string | undefined {
    const partes = codigoPartida.split('.');
    if (partes.length <= 1) return undefined;
    return partes.slice(0, -1).join('.');
  },

  // Obtener todas las versiones de una comisaría (ordenadas por fecha)
  async getAllVersionsByComisaria(comisariaId: number): Promise<CronogramaValorizado[]> {
    await delay(300);
    const cronogramasComisaria = mockCronogramas.filter(c => c.comisaria_id === comisariaId);

    // Ordenar por fecha de importación (más reciente primero)
    return cronogramasComisaria.sort((a, b) =>
      new Date(b.fecha_importacion).getTime() - new Date(a.fecha_importacion).getTime()
    );
  },

  // Obtener cronograma por ID específico (para ver versión específica)
  async getCronogramaById(cronogramaId: number): Promise<CronogramaValorizado | null> {
    await delay(200);
    return mockCronogramas.find(c => c.id === cronogramaId) || null;
  },

  // Comparar dos versiones de cronograma
  async compareVersions(versionAnteriorId: number, versionNuevaId: number): Promise<{
    anterior: CronogramaValorizado;
    nueva: CronogramaValorizado;
    cambios: {
      partidas_agregadas: Partida[];
      partidas_eliminadas: Partida[];
      partidas_modificadas: {
        anterior: Partida;
        nueva: Partida;
        cambios: string[];
      }[];
    };
  } | null> {
    await delay(500);

    const versionAnterior = mockCronogramas.find(c => c.id === versionAnteriorId);
    const versionNueva = mockCronogramas.find(c => c.id === versionNuevaId);

    if (!versionAnterior || !versionNueva) return null;

    const cambios = this.detectarCambiosEntreVersiones(versionAnterior.partidas, versionNueva.partidas);

    return {
      anterior: versionAnterior,
      nueva: versionNueva,
      cambios
    };
  },

  // Detectar cambios entre dos arrays de partidas
  detectarCambiosEntreVersiones(partidasAnteriores: Partida[], partidasNuevas: Partida[]) {
    const partidas_agregadas: Partida[] = [];
    const partidas_eliminadas: Partida[] = [];
    const partidas_modificadas: {
      anterior: Partida;
      nueva: Partida;
      cambios: string[];
    }[] = [];

    // Crear mapas para búsqueda rápida por código de partida
    const mapAnterior = new Map(partidasAnteriores.map(p => [p.codigo_partida, p]));
    const mapNueva = new Map(partidasNuevas.map(p => [p.codigo_partida, p]));

    // Encontrar partidas agregadas
    for (const partidaNueva of partidasNuevas) {
      if (!mapAnterior.has(partidaNueva.codigo_partida)) {
        partidas_agregadas.push(partidaNueva);
      }
    }

    // Encontrar partidas eliminadas
    for (const partidaAnterior of partidasAnteriores) {
      if (!mapNueva.has(partidaAnterior.codigo_partida)) {
        partidas_eliminadas.push(partidaAnterior);
      }
    }

    // Encontrar partidas modificadas
    for (const [codigo, partidaAnterior] of mapAnterior) {
      const partidaNueva = mapNueva.get(codigo);
      if (partidaNueva) {
        const cambios: string[] = [];

        if (partidaAnterior.metrado !== partidaNueva.metrado) {
          cambios.push(`Metrado: ${partidaAnterior.metrado} → ${partidaNueva.metrado}`);
        }

        if (partidaAnterior.precio_unitario !== partidaNueva.precio_unitario) {
          cambios.push(`Precio unitario: S/ ${partidaAnterior.precio_unitario} → S/ ${partidaNueva.precio_unitario}`);
        }

        if (partidaAnterior.precio_total !== partidaNueva.precio_total) {
          cambios.push(`Precio total: S/ ${partidaAnterior.precio_total} → S/ ${partidaNueva.precio_total}`);
        }

        if (partidaAnterior.descripcion !== partidaNueva.descripcion) {
          cambios.push(`Descripción modificada`);
        }

        if (partidaAnterior.unidad !== partidaNueva.unidad) {
          cambios.push(`Unidad: ${partidaAnterior.unidad} → ${partidaNueva.unidad}`);
        }

        if (cambios.length > 0) {
          partidas_modificadas.push({
            anterior: partidaAnterior,
            nueva: partidaNueva,
            cambios
          });
        }
      }
    }

    return {
      partidas_agregadas,
      partidas_eliminadas,
      partidas_modificadas
    };
  },

  // Función de utilidad para limpiar datos y reiniciar
  clearAllData(): void {
    localStorage.removeItem('nemaec_cronogramas');
    localStorage.removeItem('nemaec_cronograma_ids');
    mockCronogramas.length = 0; // Vaciar array
    nextId = 1;
    nextPartidaId = 1;
    console.log('✅ Datos de cronogramas limpiados');
  }
};