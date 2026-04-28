"""
📊 EXCEL IMPORT SERVICE
Servicio de aplicación para importación masiva de datos Excel.
Core del sistema para actualización por monitores regionales.
"""
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
import pandas as pd
from pathlib import Path
import logging

from app.domain.entities.partida import Partida, TipoPartida, AvancePartida
from app.domain.entities.comisaria import Comisaria
from app.domain.repositories.partida_repository import PartidaRepository
from app.domain.repositories.comisaria_repository import ComisariaRepository

logger = logging.getLogger(__name__)


class ExcelImportError(Exception):
    """Excepción específica para errores de importación Excel"""
    pass


class ExcelValidationError(ExcelImportError):
    """Excepción para errores de validación de datos"""
    pass


class ExcelImportService:
    """
    Servicio para importación masiva desde Excel.

    Funcionalidades:
    - Importar estructura inicial de partidas desde Excel
    - Actualizar avances desde reportes de monitores
    - Validar integridad de datos
    - Generar reportes de importación
    """

    def __init__(
        self,
        partida_repo: PartidaRepository,
        comisaria_repo: ComisariaRepository
    ):
        self.partida_repo = partida_repo
        self.comisaria_repo = comisaria_repo

    async def import_partidas_inicial(
        self,
        excel_path: str,
        comisaria_codigo: str,
        usuario_importador: str
    ) -> Dict[str, Any]:
        """
        Importar estructura inicial de partidas desde Excel base.

        Args:
            excel_path: Ruta al archivo Excel
            comisaria_codigo: Código de la comisaría (ej: "COM-001")
            usuario_importador: Usuario que ejecuta la importación

        Returns:
            Dict[str, Any]: Resultado de la importación

        Raises:
            ExcelImportError: Error en la importación
            ExcelValidationError: Error de validación de datos
        """
        inicio = datetime.now()
        resultado = {
            "exito": False,
            "partidas_creadas": 0,
            "errores": [],
            "advertencias": [],
            "tiempo_procesamiento": 0,
            "archivo_procesado": excel_path,
            "usuario_importador": usuario_importador
        }

        try:
            # 1. Validar archivo
            if not Path(excel_path).exists():
                raise ExcelImportError(f"Archivo no encontrado: {excel_path}")

            # 2. Obtener comisaría
            comisaria = await self.comisaria_repo.get_by_codigo(comisaria_codigo)
            if not comisaria:
                raise ExcelValidationError(f"Comisaría no encontrada: {comisaria_codigo}")

            # 3. Leer Excel
            df = pd.read_excel(excel_path)
            resultado["total_filas_excel"] = len(df)

            # 4. Detectar formato automáticamente y validar estructura
            formato_alternativo = self._detectar_formato_excel(df)
            resultado["formato_detectado"] = "alternativo" if formato_alternativo else "original"

            if formato_alternativo:
                columnas_requeridas = ["comisaria", "codigo", "partida", "und", "metrado", "pu", "parcial"]
                # inicio y fec_termino son opcionales en el formato alternativo
            else:
                columnas_requeridas = ["NID", "COMISARIA", "COD", "PARTIDA", "UNI", "METRADO", "PU", "PARCIAL"]

            self._validar_columnas_excel(df, columnas_requeridas)

            # 5. Filtrar por comisaría
            if formato_alternativo:
                # En el formato alternativo, filtrar por columna "comisaria"
                df_comisaria = df[df["comisaria"] == comisaria.nombre].copy()
            else:
                # En el formato original, filtrar por columna "COMISARIA"
                df_comisaria = df[df["COMISARIA"] == comisaria.nombre].copy()

            if df_comisaria.empty:
                raise ExcelValidationError(f"No se encontraron partidas para comisaría: {comisaria.nombre}")

            # 6. Procesar partidas
            partidas_creadas = []
            errores_fila = []

            for index, row in df_comisaria.iterrows():
                try:
                    partida = await self._crear_partida_desde_excel_row(row, comisaria.id, formato_alternativo)
                    partidas_creadas.append(partida)
                except Exception as e:
                    nid_key = "codigo" if formato_alternativo else "NID"
                    cod_key = "codigo" if formato_alternativo else "COD"
                    errores_fila.append({
                        "fila": index + 1,
                        "nid": row.get(nid_key),
                        "codigo": row.get(cod_key),
                        "error": str(e)
                    })

            # 7. Guardar en lote
            if partidas_creadas:
                partidas_guardadas = await self.partida_repo.bulk_create(partidas_creadas)
                resultado["partidas_creadas"] = len(partidas_guardadas)

            resultado["errores"] = errores_fila
            resultado["exito"] = len(partidas_creadas) > 0

            logger.info(
                f"Import inicial completado: {resultado['partidas_creadas']} partidas "
                f"para comisaría {comisaria_codigo}"
            )

        except Exception as e:
            resultado["errores"].append({
                "tipo": "error_general",
                "mensaje": str(e)
            })
            logger.error(f"Error en importación inicial: {e}")

        finally:
            resultado["tiempo_procesamiento"] = (datetime.now() - inicio).total_seconds()

        return resultado

    async def actualizar_avances_desde_excel(
        self,
        excel_path: str,
        comisaria_codigo: str,
        monitor_responsable: str,
        observaciones_generales: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Actualizar avances desde reporte Excel del monitor.

        Args:
            excel_path: Ruta al archivo Excel de avances
            comisaria_codigo: Código de la comisaría
            monitor_responsable: Nombre del monitor que reporta
            observaciones_generales: Observaciones generales del reporte

        Returns:
            Dict[str, Any]: Resultado de la actualización

        Expected Excel format:
        | NID | CODIGO | AVANCE_PROGRAMADO | AVANCE_FISICO | OBSERVACIONES |
        """
        inicio = datetime.now()
        resultado = {
            "exito": False,
            "avances_actualizados": 0,
            "partidas_criticas_detectadas": 0,
            "alertas_generadas": [],
            "errores": [],
            "advertencias": [],
            "tiempo_procesamiento": 0,
            "archivo_procesado": excel_path,
            "monitor_responsable": monitor_responsable
        }

        try:
            # 1. Validaciones iniciales
            if not Path(excel_path).exists():
                raise ExcelImportError(f"Archivo no encontrado: {excel_path}")

            comisaria = await self.comisaria_repo.get_by_codigo(comisaria_codigo)
            if not comisaria:
                raise ExcelValidationError(f"Comisaría no encontrada: {comisaria_codigo}")

            # 2. Leer Excel de avances
            df = pd.read_excel(excel_path)
            columnas_avance = ["NID", "AVANCE_PROGRAMADO", "AVANCE_FISICO"]
            self._validar_columnas_excel(df, columnas_avance)

            # 3. Procesar cada avance
            avances_data = []
            criticas_detectadas = []

            for index, row in df.iterrows():
                try:
                    # Validar datos de la fila
                    nid = int(row["NID"])
                    avance_programado = float(row["AVANCE_PROGRAMADO"])
                    avance_fisico = float(row["AVANCE_FISICO"])

                    # Validar rangos
                    if not (0 <= avance_programado <= 100):
                        raise ValueError(f"Avance programado fuera de rango: {avance_programado}")
                    if not (0 <= avance_fisico <= 100):
                        raise ValueError(f"Avance físico fuera de rango: {avance_fisico}")

                    # Buscar partida
                    partida = await self.partida_repo.get_by_nid_and_comisaria(nid, comisaria.id)
                    if not partida:
                        resultado["advertencias"].append(f"Partida NID {nid} no encontrada")
                        continue

                    # Crear datos de avance
                    avance_data = {
                        "partida_id": partida.id,
                        "avance_programado": avance_programado,
                        "avance_fisico": avance_fisico,
                        "observaciones": row.get("OBSERVACIONES", observaciones_generales),
                        "monitor_responsable": monitor_responsable,
                        "fuente_datos": "excel"
                    }
                    avances_data.append(avance_data)

                    # Detectar partidas críticas
                    diferencia = avance_fisico - avance_programado
                    if abs(diferencia) > 5.0:
                        criticas_detectadas.append({
                            "nid": nid,
                            "codigo": partida.codigo,
                            "descripcion": partida.descripcion,
                            "diferencia": diferencia,
                            "avance_programado": avance_programado,
                            "avance_fisico": avance_fisico
                        })

                except Exception as e:
                    resultado["errores"].append({
                        "fila": index + 1,
                        "nid": row.get("NID"),
                        "error": str(e)
                    })

            # 4. Actualizar avances en lote
            if avances_data:
                actualizados = await self.partida_repo.bulk_update_avances(avances_data)
                resultado["avances_actualizados"] = actualizados

            # 5. Generar alertas para partidas críticas
            resultado["partidas_criticas_detectadas"] = len(criticas_detectadas)
            resultado["alertas_generadas"] = await self._generar_alertas_criticas(
                criticas_detectadas, comisaria_codigo, monitor_responsable
            )

            resultado["exito"] = len(avances_data) > 0

            logger.info(
                f"Actualización avances completada: {resultado['avances_actualizados']} avances, "
                f"{resultado['partidas_criticas_detectadas']} críticas detectadas"
            )

        except Exception as e:
            resultado["errores"].append({
                "tipo": "error_general",
                "mensaje": str(e)
            })
            logger.error(f"Error en actualización de avances: {e}")

        finally:
            resultado["tiempo_procesamiento"] = (datetime.now() - inicio).total_seconds()

        return resultado

    async def generar_plantilla_avances(
        self,
        comisaria_codigo: str,
        solo_ejecutables: bool = True
    ) -> str:
        """
        Generar plantilla Excel para reporte de avances.

        Args:
            comisaria_codigo: Código de la comisaría
            solo_ejecutables: Solo incluir partidas ejecutables

        Returns:
            str: Ruta del archivo generado

        Note:
            Genera Excel con estructura lista para llenar avances
        """
        comisaria = await self.comisaria_repo.get_by_codigo(comisaria_codigo)
        if not comisaria:
            raise ExcelValidationError(f"Comisaría no encontrada: {comisaria_codigo}")

        if solo_ejecutables:
            partidas = await self.partida_repo.list_ejecutables(comisaria_id=comisaria.id)
        else:
            partidas = await self.partida_repo.list_by_comisaria(comisaria_id=comisaria.id)

        # Crear DataFrame para plantilla
        datos_plantilla = []
        for partida in partidas:
            ultimo_avance = partida.get_ultimo_avance()
            datos_plantilla.append({
                "NID": partida.nid,
                "CODIGO": partida.codigo,
                "DESCRIPCION": partida.descripcion,
                "UNIDAD": partida.unidad,
                "METRADO": float(partida.metrado),
                "AVANCE_ANTERIOR": ultimo_avance.avance_fisico if ultimo_avance else 0.0,
                "AVANCE_PROGRAMADO": "",  # Para llenar
                "AVANCE_FISICO": "",      # Para llenar
                "OBSERVACIONES": ""       # Para llenar
            })

        df = pd.DataFrame(datos_plantilla)

        # Generar archivo
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"plantilla_avances_{comisaria_codigo}_{timestamp}.xlsx"
        filepath = f"uploads/{filename}"

        # Crear directorio si no existe
        Path("uploads").mkdir(exist_ok=True)

        # Guardar con formato
        with pd.ExcelWriter(filepath, engine='xlsxwriter') as writer:
            df.to_excel(writer, sheet_name='Avances', index=False)

            # Formato condicional para campos a llenar
            workbook = writer.book
            worksheet = writer.sheets['Avances']

            # Formato para campos obligatorios
            fill_format = workbook.add_format({'bg_color': '#FFEB9C'})
            worksheet.set_column('G:I', 15, fill_format)  # Columnas a llenar

        logger.info(f"Plantilla generada: {filepath}")
        return filepath

    def _validar_columnas_excel(self, df: pd.DataFrame, columnas_requeridas: List[str]) -> None:
        """Validar que el Excel tenga las columnas requeridas"""
        columnas_faltantes = set(columnas_requeridas) - set(df.columns)
        if columnas_faltantes:
            raise ExcelValidationError(
                f"Columnas faltantes en Excel: {', '.join(columnas_faltantes)}"
            )

    async def _crear_partida_desde_excel_row(self, row: pd.Series, comisaria_id: int, formato_alternativo: bool = False) -> Partida:
        """Crear entidad Partida desde fila de Excel"""
        from decimal import Decimal
        from datetime import datetime

        # Mapear nombres de columnas según el formato
        if formato_alternativo:
            col_codigo = "codigo"
            col_descripcion = "partida"
            col_unidad = "und"
            col_metrado = "metrado"
            col_precio_unitario = "pu"
            col_parcial = "parcial"
            # Para el formato alternativo, no hay NID, usar índice + 1000
            nid = row.name + 1000  # usar índice de fila como base para NID
        else:
            col_codigo = "COD"
            col_descripcion = "PARTIDA"
            col_unidad = "UNI"
            col_metrado = "METRADO"
            col_precio_unitario = "PU"
            col_parcial = "PARCIAL"
            nid = int(row["NID"])

        # Validar y limpiar datos antes de procesamiento
        codigo_raw = row[col_codigo]
        descripcion_raw = row[col_descripcion]
        metrado_val = row[col_metrado]

        # Validación de datos requeridos
        if pd.isna(codigo_raw) or str(codigo_raw).strip() == '' or str(codigo_raw).strip().lower() == 'nan':
            raise ValueError(f"Código de partida es obligatorio en fila {row.name + 1}")

        if pd.isna(descripcion_raw) or str(descripcion_raw).strip() == '' or str(descripcion_raw).strip().lower() == 'nan':
            raise ValueError(f"Descripción es obligatoria en fila {row.name + 1}")

        # Limpiar y procesar datos
        codigo = str(codigo_raw).strip()
        descripcion = str(descripcion_raw).strip()

        if pd.isna(metrado_val) or metrado_val == 0:
            if len(codigo.split('.')) == 1:
                tipo = TipoPartida.TITULO
            else:
                tipo = TipoPartida.SUBTITULO
        else:
            tipo = TipoPartida.PARTIDA

        # Crear partida base
        partida = Partida(
            id=None,
            nid=nid,
            codigo=codigo,
            descripcion=descripcion,
            tipo=tipo,
            unidad=str(row[col_unidad]).strip() if pd.notna(row[col_unidad]) else None,
            metrado=Decimal(str(metrado_val)) if pd.notna(metrado_val) else Decimal('0'),
            precio_unitario=Decimal(str(row[col_precio_unitario])) if pd.notna(row[col_precio_unitario]) else Decimal('0'),
            parcial=Decimal(str(row[col_parcial])) if pd.notna(row[col_parcial]) else Decimal('0'),
            comisaria_id=comisaria_id
        )

        # Si es formato alternativo y tiene fechas, agregarlas
        if formato_alternativo:
            if "inicio" in row and pd.notna(row["inicio"]):
                # Convertir fecha de inicio si está presente
                try:
                    if isinstance(row["inicio"], str):
                        partida.fecha_inicio = datetime.strptime(row["inicio"], "%Y-%m-%d")
                    else:
                        partida.fecha_inicio = row["inicio"]
                except:
                    pass  # Si falla la conversión, continuar sin fecha

            if "fec_termino" in row and pd.notna(row["fec_termino"]):
                # Convertir fecha de término si está presente
                try:
                    if isinstance(row["fec_termino"], str):
                        partida.fecha_termino = datetime.strptime(row["fec_termino"], "%Y-%m-%d")
                    else:
                        partida.fecha_termino = row["fec_termino"]
                except:
                    pass  # Si falla la conversión, continuar sin fecha

        return partida

    async def _generar_alertas_criticas(
        self,
        partidas_criticas: List[Dict[str, Any]],
        comisaria_codigo: str,
        monitor_responsable: str
    ) -> List[Dict[str, Any]]:
        """Generar alertas para partidas críticas detectadas"""
        alertas = []

        for partida in partidas_criticas:
            diferencia = partida["diferencia"]
            nivel_alerta = "critica" if abs(diferencia) > 8 else "alta"

            # Generar recomendación
            if diferencia < -5:  # Retraso crítico
                recomendacion = "Incrementar personal o turnos de trabajo"
                if abs(diferencia) > 10:
                    recomendacion = "Evaluar rescisión de contrato"
            else:  # Adelanto excesivo
                recomendacion = "Verificar calidad de ejecución"

            alerta = {
                "tipo": "partida_critica",
                "nivel": nivel_alerta,
                "comisaria": comisaria_codigo,
                "nid": partida["nid"],
                "codigo": partida["codigo"],
                "descripcion": partida["descripcion"][:100],
                "diferencia": diferencia,
                "avance_programado": partida["avance_programado"],
                "avance_fisico": partida["avance_fisico"],
                "monitor_responsable": monitor_responsable,
                "recomendacion": recomendacion,
                "fecha_deteccion": datetime.now().isoformat(),
                "requiere_accion_inmediata": abs(diferencia) > 8
            }
            alertas.append(alerta)

        return sorted(alertas, key=lambda x: abs(x["diferencia"]), reverse=True)

    def _detectar_formato_excel(self, df: pd.DataFrame) -> bool:
        """
        Detectar automáticamente el formato del Excel.

        Returns:
            bool: True si es formato alternativo (comisaria, codigo, partida, etc.),
                  False si es formato original (NID, COMISARIA, COD, etc.)
        """
        # Formato alternativo tiene columnas: comisaria, codigo, partida, und, etc.
        columnas_formato_alternativo = ["comisaria", "codigo", "partida", "und"]
        # Formato original tiene columnas: NID, COMISARIA, COD, PARTIDA, UNI, etc.
        columnas_formato_original = ["NID", "COMISARIA", "COD", "PARTIDA", "UNI"]

        # Contar cuántas columnas coinciden con cada formato
        coincidencias_alternativo = sum(1 for col in columnas_formato_alternativo if col in df.columns)
        coincidencias_original = sum(1 for col in columnas_formato_original if col in df.columns)

        # Si hay más coincidencias con formato alternativo, usar ese formato
        return coincidencias_alternativo > coincidencias_original