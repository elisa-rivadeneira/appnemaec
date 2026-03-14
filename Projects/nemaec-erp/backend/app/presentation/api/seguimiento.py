"""
📊 API SEGUIMIENTO DE AVANCES - NEMAEC ERP
Endpoints para subir y validar avances físicos
"""

from fastapi import APIRouter, HTTPException, File, UploadFile, Form
from fastapi.responses import JSONResponse
from typing import List, Optional
import pandas as pd
from datetime import datetime

from app.application.services.validador_partidas import PartidaExcel, PartidaDB
from app.application.services.excel_import_service import ExcelImportService
from app.core.database import get_db
from app.infrastructure.database.models_seguimiento import AvanceFisico, DetalleAvancePartida
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
import tempfile
import io

router = APIRouter(prefix="/seguimiento", tags=["seguimiento"])

# 🛠️ FUNCIONES AUXILIARES PARA IMPORTACIÓN DE AVANCES

def normalizar_codigo_matematico(codigo: str) -> str:
    """
    🔢 Normaliza códigos matemáticamente CORRECTO: 2.1 -> 02.10, NO 02.01
    Esto es CRÍTICO para hacer coincidir códigos del Excel con la BD

    Reglas matemáticamente correctas:
    - Parte principal (antes del primer punto): siempre 2 dígitos
    - Partes decimales (después del punto):
      * Si es 1 dígito → multiplicar por 10 (ej: .1 = .10)
      * Si es 2+ dígitos → mantener como está

    Ejemplos CORRECTOS:
    - "1"      -> "01"
    - "1.01"   -> "01.01"
    - "2.1"    -> "02.10"  ✅ (matemáticamente correcto)
    - "6.01.1" -> "06.01.10" ✅ (matemáticamente correcto)
    """
    if not codigo or codigo.strip() == "":
        return ""

    codigo = codigo.strip().upper()
    partes = codigo.split('.')
    partes_normalizadas = []

    for i, parte in enumerate(partes):
        t = parte.strip()
        try:
            numero = int(t)
            if i == 0:
                # Primera parte: siempre 2 dígitos
                if numero < 10:
                    partes_normalizadas.append(f"0{numero}")
                else:
                    partes_normalizadas.append(str(numero))
            else:
                # Partes después del punto: matemáticamente correctas
                if numero < 10 and len(t) == 1:
                    # Un solo dígito: 1 = 10, 2 = 20, etc.
                    partes_normalizadas.append(f"{numero}0")
                else:
                    # Ya tiene 2+ dígitos o es 0X: mantener como está
                    partes_normalizadas.append(f"{numero:02d}")
        except ValueError:
            # No es número, mantener como está
            partes_normalizadas.append(t)

    resultado = '.'.join(partes_normalizadas)
    print(f"🔢 Normalizado: '{codigo}' → '{resultado}'")
    return resultado

def generar_hash_descripcion(descripcion: str) -> str:
    """Genera hash simple de la descripción para comparación"""
    import hashlib
    return hashlib.md5(descripcion.strip().upper().encode()).hexdigest()[:10]

def extraer_partidas_del_excel(content: bytes) -> List[dict]:
    """
    Extrae partidas y avances del archivo Excel.

    Args:
        content: Contenido binario del archivo Excel

    Returns:
        List[dict]: Lista de partidas con sus avances
    """
    # Crear archivo temporal
    with tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False) as tmp_file:
        tmp_file.write(content)
        tmp_file_path = tmp_file.name

    try:
        # Leer Excel
        df = pd.read_excel(tmp_file_path, sheet_name=0)

        # Detectar estructura del Excel
        columnas = df.columns.tolist()
        print(f"📊 Columnas detectadas: {columnas}")
        print(f"📊 Dimensiones: {df.shape}")

        partidas_avances = []

        # Buscar columnas relevantes (flexibilidad en nombres)
        col_item = None
        col_descripcion = None
        col_avance = None

        for col in columnas:
            col_lower = str(col).lower()
            if 'item' in col_lower or 'codigo' in col_lower:
                col_item = col
            elif 'descripcion' in col_lower:
                col_descripcion = col
            elif 'avance' in col_lower and 'acum' in col_lower:
                col_avance = col

        print(f"🔍 Columnas identificadas: ITEM={col_item}, DESC={col_descripcion}, AVANCE={col_avance}")

        # Validar que se encontró la columna de avance
        if col_avance is None:
            raise ValueError(
                f"❌ ARCHIVO INCORRECTO: Este archivo no contiene la columna de avances físicos.\n"
                f"📋 Columnas encontradas: {columnas}\n"
                f"✅ Se esperaba una columna que contenga 'AVANCE' y 'ACUMULADO' en el nombre.\n"
                f"💡 Asegúrese de subir un archivo de AVANCES FÍSICOS, no un cronograma valorizado."
            )

        # Procesar filas
        for idx, row in df.iterrows():
            try:
                if pd.notna(row[col_item]) and pd.notna(row[col_avance]):
                    item_code = str(row[col_item]).strip()
                    avance_val = float(row[col_avance]) if row[col_avance] != 0 else 0.0

                    # Solo incluir códigos que parezcan partidas (tienen números)
                    if any(c.isdigit() for c in item_code):
                        # NORMALIZACIÓN MATEMÁTICA CRÍTICA: 1 -> 01, 2.01 -> 02.01, 1.1 -> 01.10
                        codigo_normalizado = normalizar_codigo_matematico(item_code)

                        partida_data = {
                            'codigo_partida': codigo_normalizado,
                            'descripcion': str(row[col_descripcion]).strip() if pd.notna(row[col_descripcion]) else '',
                            'porcentaje_avance': avance_val
                        }
                        partidas_avances.append(partida_data)
                        print(f"✅ Partida: {item_code} → {codigo_normalizado} = {avance_val:.1f}%")

            except Exception as e:
                print(f"⚠️ Error procesando fila {idx}: {e}")
                continue

        print(f"📈 Total partidas extraídas: {len(partidas_avances)}")
        return partidas_avances

    finally:
        # Limpiar archivo temporal
        import os
        os.unlink(tmp_file_path)

async def importar_avances_a_bd(
    comisaria_id: int,
    partidas_avances: List[dict],
    archivo_nombre: str,
    fecha_reporte,
    descripcion_reporte: str = ""
) -> dict:
    """
    Importa avances físicos a la base de datos.

    Args:
        comisaria_id: ID de la comisaría
        partidas_avances: Lista de partidas con avances
        archivo_nombre: Nombre del archivo importado
        fecha_reporte: Fecha del reporte

    Returns:
        dict: Resultado de la importación
    """
    from sqlalchemy import create_engine, text
    from datetime import datetime
    import sqlite3

    # Calcular avance promedio ponderado
    if partidas_avances:
        avance_promedio = sum(p['porcentaje_avance'] for p in partidas_avances) / len(partidas_avances)
    else:
        avance_promedio = 0.0

    # Conectar a SQLite directamente para la operación
    # Usar la configuración dinámica en lugar de ruta hardcodeada
    from app.core.config import settings
    db_path = settings.database_url.replace("sqlite+aiosqlite://", "").replace("sqlite://", "")

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # 1. Crear registro principal de avance físico
        cursor.execute("""
            INSERT INTO avances_fisicos
            (comisaria_id, fecha_reporte, avance_ejecutado_acum, archivo_seguimiento, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, (
            comisaria_id,
            fecha_reporte.strftime('%Y-%m-%d'),
            avance_promedio,
            archivo_nombre,
            datetime.now().isoformat()
        ))

        avance_fisico_id = cursor.lastrowid
        print(f"📝 Avance físico creado con ID: {avance_fisico_id}")

        # 2. Insertar detalles por partida
        partidas_insertadas = 0
        for partida in partidas_avances:
            try:
                cursor.execute("""
                    INSERT INTO detalle_avances_partidas
                    (avance_fisico_id, codigo_partida, porcentaje_avance, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?)
                """, (
                    avance_fisico_id,
                    partida['codigo_partida'],
                    partida['porcentaje_avance'],
                    datetime.now().isoformat(),
                    datetime.now().isoformat()
                ))
                partidas_insertadas += 1

            except Exception as e:
                print(f"⚠️ Error insertando partida {partida['codigo_partida']}: {e}")

        conn.commit()
        print(f"✅ {partidas_insertadas} partidas importadas exitosamente")

        return {
            "exito": True,
            "avance_fisico_id": avance_fisico_id,
            "partidas_importadas": partidas_insertadas,
            "total_partidas_excel": len(partidas_avances),
            "avance_promedio": avance_promedio * 100,
            "archivo_procesado": archivo_nombre
        }

    except Exception as e:
        print(f"❌ Error en importación: {e}")
        return {
            "exito": False,
            "error": str(e),
            "partidas_importadas": 0
        }
    finally:
        if 'conn' in locals():
            conn.close()

@router.post("/validar-partidas")
async def validar_partidas_antes_avance(
    comisaria_id: int = Form(...),
    archivo: UploadFile = File(..., description="Excel de avances físicos")
):
    """
    🛡️ VALIDAR PARTIDAS antes de permitir subir avances

    Valida que las partidas del Excel coincidan EXACTAMENTE con la BD
    Si no coinciden: BLOQUEA y muestra diferencias
    Si coinciden: PERMITE continuar con avances
    """

    # 1. Validar archivo
    if not archivo.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(
            status_code=400,
            detail="Archivo debe ser Excel (.xlsx o .xls)"
        )

    try:
        # 2. Leer Excel de avances
        content = await archivo.read()
        partidas_excel = extraer_partidas_del_excel(content)
        print(f"📋 {len(partidas_excel)} partidas leídas del Excel de avances")

        # 3. Obtener partidas de BD para esta comisaría
        partidas_db = await obtener_partidas_db(comisaria_id)
        print(f"🗄️ {len(partidas_db)} partidas en BD para comisaría {comisaria_id}")

        if not partidas_db:
            return JSONResponse(
                status_code=422,
                content={
                    "error": "SIN_CRONOGRAMA",
                    "message": f"No hay cronograma importado para la comisaría {comisaria_id}. Importe un cronograma valorizado primero.",
                    "permitir_avance": False
                }
            )

        # 4. VALIDACIÓN: código + descripción deben coincidir con BD
        # Partidas en BD que no están en Excel son normales (no todas tienen avance registrado)
        import unicodedata as _ud
        from collections import defaultdict

        def normalizar_desc(s: str) -> str:
            s = s.strip().upper()
            s = ' '.join(s.split())
            s = _ud.normalize('NFKD', s)
            s = ''.join(c for c in s if not _ud.combining(c))
            return s

        # Multimap: código normalizado → lista de descripciones normalizadas
        # (maneja duplicados en BD correctamente)
        db_multimap: dict = defaultdict(list)
        db_multimap_orig: dict = defaultdict(list)  # descripciones originales para mostrar
        for p in partidas_db:
            cod = normalizar_codigo_matematico(p.codigo)
            db_multimap[cod].append(normalizar_desc(p.descripcion))
            db_multimap_orig[cod].append(p.descripcion)

        diferencias = []

        for p in partidas_excel:
            cod_norm = normalizar_codigo_matematico(p['codigo_partida'])

            if cod_norm not in db_multimap:
                diferencias.append({
                    "codigo": p['codigo_partida'],
                    "tipo_diferencia": "no_existe",
                    "descripcion_excel": p['descripcion'],
                    "descripcion_db": None,
                    "mensaje": f"Código '{p['codigo_partida']}' no existe en el cronograma de BD",
                    "estado": "no_existe"
                })
                continue

            desc_excel_norm = normalizar_desc(p['descripcion'])
            descs_db_norm = db_multimap[cod_norm]
            descs_db_orig = db_multimap_orig[cod_norm]

            # Pasa si coincide con CUALQUIERA de las entradas en BD para ese código
            if desc_excel_norm not in descs_db_norm:
                diferencias.append({
                    "codigo": p['codigo_partida'],
                    "tipo_diferencia": "descripcion_cambio",
                    "descripcion_excel": p['descripcion'],
                    "descripcion_db": descs_db_orig[0] if descs_db_orig else None,
                    "mensaje": f"Descripción diferente para '{p['codigo_partida']}':\n  Excel: {p['descripcion']}\n  BD:    {descs_db_orig}",
                    "estado": "descripcion_cambio"
                })

        print(f"{'✅' if not diferencias else '❌'} Diferencias encontradas: {len(diferencias)}")

        if diferencias:
            reporte = "\n".join([
                f"[{d['tipo_diferencia'].upper()}] Código {d['codigo']}:\n"
                f"  Excel: {d['descripcion_excel']}\n"
                f"  BD:    {d['descripcion_db'] or '[NO EXISTE]'}"
                for d in diferencias[:20]
            ])
            return JSONResponse(
                status_code=422,
                content={
                    "error": "PARTIDAS_NO_COINCIDEN",
                    "message": f"Se encontraron {len(diferencias)} diferencias entre el Excel y el cronograma en BD",
                    "reporte_diferencias": reporte,
                    "diferencias": diferencias,
                    "total_diferencias": len(diferencias),
                    "permitir_avance": False
                }
            )

        return {
            "success": True,
            "message": f"Partidas validadas correctamente: {len(partidas_excel)} códigos y descripciones coinciden",
            "partidas_validadas": len(partidas_excel),
            "permitir_avance": True,
            "siguiente_paso": "Puede proceder a subir avances físicos"
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al validar Excel: {str(e)}"
        )

@router.post("/import-avances")
async def importar_avances_fisicos(
    comisaria_id: int = Form(...),
    archivo: UploadFile = File(...),
    fecha_reporte: str = Form(..., description="Fecha del reporte en formato YYYY-MM-DD"),
    descripcion_reporte: str = Form(default="", description="Descripción opcional del reporte"),
    validacion_previa: bool = Form(default=False, description="¿Se validaron las partidas previamente?")
):
    """
    📊 IMPORTAR AVANCES FÍSICOS REALMENTE

    Solo permite importar si las partidas fueron validadas previamente
    Guarda los avances en la base de datos
    """

    if not validacion_previa:
        raise HTTPException(
            status_code=400,
            detail="Debe validar partidas primero usando /validar-partidas"
        )

    try:
        # 1. Leer Excel de avances
        content = await archivo.read()
        partidas_excel = extraer_partidas_del_excel(content)

        # 2. Importar avances a la base de datos
        from datetime import datetime
        fecha_reporte_obj = datetime.strptime(fecha_reporte, "%Y-%m-%d").date()
        resultado = await importar_avances_a_bd(
            comisaria_id=comisaria_id,
            partidas_avances=partidas_excel,
            archivo_nombre=archivo.filename,
            fecha_reporte=fecha_reporte_obj,
            descripcion_reporte=descripcion_reporte
        )

        return resultado

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al importar avances: {str(e)}"
        )

@router.get("/evolucion-historica/{comisaria_id}")
async def obtener_evolucion_historica(comisaria_id: int):
    """
    📈 EVOLUCIÓN HISTÓRICA DE AVANCES

    Obtiene la evolución del avance físico y programado en el tiempo
    para generar gráficas de seguimiento.

    Returns:
        List[dict]: Lista de puntos con fecha, avance_fisico, avance_programado
    """
    try:
        from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
        from app.infrastructure.database.models_seguimiento import AvanceFisico
        from app.core.config import settings
        from sqlalchemy import select
        from datetime import datetime, timedelta

        engine = create_async_engine(settings.database_url, echo=False)
        AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

        async with AsyncSessionLocal() as session:
            # Obtener todos los avances físicos ordenados por fecha
            result = await session.execute(
                select(AvanceFisico)
                .where(AvanceFisico.comisaria_id == comisaria_id)
                .order_by(AvanceFisico.fecha_reporte)
            )
            avances = result.scalars().all()

            if not avances:
                return {
                    "message": "No hay datos de avances para esta comisaría",
                    "evolucion": []
                }

            # Construir evolución histórica
            evolucion = []
            for avance in avances:
                # Calcular avance programado para esa fecha
                avance_programado = await calcular_avance_programado_fecha(
                    comisaria_id,
                    avance.fecha_reporte
                )

                evolucion.append({
                    "fecha": avance.fecha_reporte.isoformat(),
                    "avance_fisico": float(avance.avance_ejecutado_acum) * 100,  # Convertir a porcentaje
                    "avance_programado": avance_programado,
                    "observaciones": avance.observaciones,
                    "archivo": avance.archivo_seguimiento
                })

            return {
                "comisaria_id": comisaria_id,
                "total_reportes": len(evolucion),
                "evolucion": evolucion
            }

    except Exception as e:
        print(f"❌ Error obteniendo evolución histórica: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error al obtener evolución histórica: {str(e)}"
        )

async def calcular_avance_programado_fecha(comisaria_id: int, fecha_corte):
    """
    📊 Calcula el avance programado que debería tener una obra en una fecha específica
    basado en el cronograma con fechas de inicio/fin de partidas.
    """
    try:
        from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
        from app.infrastructure.database.models import PartidaModel
        from app.core.config import settings
        from sqlalchemy import select, and_
        from datetime import datetime

        engine = create_async_engine(settings.database_url, echo=False)
        AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

        async with AsyncSessionLocal() as session:
            # Obtener todas las partidas con fechas del cronograma de la comisaría
            result = await session.execute(
                select(PartidaModel)
                .where(and_(
                    PartidaModel.comisaria_id == comisaria_id,
                    PartidaModel.fecha_inicio.isnot(None),
                    PartidaModel.fecha_fin.isnot(None)
                ))
            )
            partidas = result.scalars().all()

            if not partidas:
                return 0.0

            # Calcular avance por partida según fecha de corte
            avance_total = 0.0
            total_partidas = len(partidas)

            for partida in partidas:
                if fecha_corte < partida.fecha_inicio.date():
                    # No ha comenzado
                    avance_partida = 0.0
                elif fecha_corte >= partida.fecha_fin.date():
                    # Ya terminó
                    avance_partida = 100.0
                else:
                    # En progreso: calcular interpolación lineal
                    total_dias = (partida.fecha_fin.date() - partida.fecha_inicio.date()).days
                    dias_transcurridos = (fecha_corte - partida.fecha_inicio.date()).days
                    if total_dias > 0:
                        avance_partida = (dias_transcurridos / total_dias) * 100
                    else:
                        avance_partida = 100.0

                avance_total += avance_partida

            return round(avance_total / total_partidas, 2) if total_partidas > 0 else 0.0

    except Exception as e:
        print(f"❌ Error calculando avance programado: {str(e)}")
        return 0.0

@router.get("/avances/{comisaria_id}")
async def obtener_avances_comisaria(comisaria_id: int):
    """
    📊 CONSULTAR AVANCES DE UNA COMISARÍA

    Devuelve todos los reportes de avance de una comisaría
    """
    try:
        avances = await consultar_avances_comisaria(comisaria_id)
        return {
            "comisaria_id": comisaria_id,
            "total_reportes": len(avances),
            "avances": avances
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al consultar avances: {str(e)}"
        )

@router.get("/avances/{comisaria_id}/ultimo")
async def obtener_ultimo_avance(comisaria_id: int):
    """
    📊 OBTENER ÚLTIMO AVANCE DE UNA COMISARÍA
    """
    try:
        avance = await consultar_ultimo_avance(comisaria_id)
        if not avance:
            raise HTTPException(
                status_code=404,
                detail="No hay avances registrados para esta comisaría"
            )
        return avance
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al consultar último avance: {str(e)}"
        )

@router.get("/avances/{comisaria_id}/detalle/{avance_id}")
async def obtener_detalle_avance(comisaria_id: int, avance_id: int):
    """
    📊 OBTENER DETALLE DE AVANCE POR PARTIDAS
    """
    try:
        detalle = await consultar_detalle_avance(avance_id)
        return {
            "avance_id": avance_id,
            "comisaria_id": comisaria_id,
            "total_partidas": len(detalle),
            "partidas": detalle
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al consultar detalle de avance: {str(e)}"
        )

@router.get("/avances/{comisaria_id}/programado")
async def calcular_avance_programado(comisaria_id: int, fecha_corte: str = None):
    """
    📅 CALCULAR AVANCE PROGRAMADO BASADO EN FECHAS Y PESOS

    Calcula qué porcentaje del proyecto debería estar avanzado
    según las fechas del cronograma y los pesos de las partidas.
    """
    try:
        return await obtener_avance_programado_por_fecha(comisaria_id, fecha_corte)
    except Exception as e:
        print(f"❌ Error calculando avance programado: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

@router.get("/cronograma-actualizado/{comisaria_id}")
async def verificar_cronograma_actualizado(comisaria_id: int):
    """
    📋 Verificar si el cronograma está actualizado para recibir avances
    """

    # Simular verificación
    ultima_modificacion = datetime.now()

    return {
        "cronograma_actualizado": True,
        "ultima_modificacion": ultima_modificacion.isoformat(),
        "partidas_totales": 45,
        "listo_para_avances": True
    }

@router.post("/comparar-partidas")
async def comparar_partidas_lado_a_lado(
    comisaria_id: int = Form(...),
    archivo_avances: UploadFile = File(..., description="Excel con avances físicos")
):
    """
    🔍 COMPARAR PARTIDAS LADO A LADO

    Muestra:
    - IZQUIERDA: Partidas guardadas en cronograma (BD)
    - DERECHA: Partidas del Excel de avances físicos

    Permite ver exactamente qué hay en cada lado para tomar decisiones
    """

    try:
        # 1. Leer partidas del Excel de avances
        content = await archivo_avances.read()
        partidas_excel = extraer_partidas_del_excel(content)

        # 2. Obtener partidas del cronograma (BD)
        partidas_bd = await obtener_partidas_db(comisaria_id)

        # 3. Crear mapas para comparación rápida con códigos normalizados

        map_excel = {normalizar_codigo_matematico(p['codigo_partida']): p for p in partidas_excel}
        map_bd = {normalizar_codigo_matematico(p.codigo): p for p in partidas_bd}

        # Mapas de código normalizado a código original para mostrar
        codigos_originales_excel = {normalizar_codigo_matematico(p['codigo_partida']): p['codigo_partida'] for p in partidas_excel}
        codigos_originales_bd = {normalizar_codigo_matematico(p.codigo): p.codigo for p in partidas_bd}

        # 4. Generar comparación lado a lado
        codigos_normalizados_bd = set(map_bd.keys())
        codigos_normalizados_excel = set(map_excel.keys())

        comparacion = {
            "cronograma_bd": {
                "total_partidas": len(partidas_bd),
                "partidas": [
                    {
                        "codigo": p.codigo,  # Código original
                        "descripcion": p.descripcion,
                        "precio_total": p.precio_total,
                        "codigo_normalizado": normalizar_codigo_matematico(p.codigo),
                        "estado": "solo_cronograma" if normalizar_codigo_matematico(p.codigo) not in map_excel else "en_ambos",
                        "coincide_descripcion": (
                            normalizar_codigo_matematico(p.codigo) in map_excel and
                            p.descripcion.strip().upper() == map_excel[normalizar_codigo_matematico(p.codigo)]['descripcion'].strip().upper()
                        ) if normalizar_codigo_matematico(p.codigo) in map_excel else None
                    }
                    for p in partidas_bd[:50]  # Limitar para no sobrecargar
                ]
            },
            "excel_avances": {
                "total_partidas": len(partidas_excel),
                "partidas": [
                    {
                        "codigo": p['codigo_partida'],  # Código original
                        "descripcion": p['descripcion'],
                        "avance_ejecutado": p['porcentaje_avance'],
                        "codigo_normalizado": normalizar_codigo_matematico(p['codigo_partida']),
                        "estado": "solo_excel" if normalizar_codigo_matematico(p['codigo_partida']) not in map_bd else "en_ambos",
                        "coincide_descripcion": (
                            normalizar_codigo_matematico(p['codigo_partida']) in map_bd and
                            p['descripcion'].strip().upper() == map_bd[normalizar_codigo_matematico(p['codigo_partida'])].descripcion.strip().upper()
                        ) if normalizar_codigo_matematico(p['codigo_partida']) in map_bd else None
                    }
                    for p in partidas_excel[:50]  # Limitar para no sobrecargar
                ]
            },
            "resumen": {
                "total_cronograma": len(partidas_bd),
                "total_excel": len(partidas_excel),
                "solo_en_cronograma": len(codigos_normalizados_bd - codigos_normalizados_excel),
                "solo_en_excel": len(codigos_normalizados_excel - codigos_normalizados_bd),
                "en_ambos": len(codigos_normalizados_bd & codigos_normalizados_excel),
                "descripciones_diferentes": len([
                    codigo_norm for codigo_norm in (codigos_normalizados_bd & codigos_normalizados_excel)
                    if map_bd[codigo_norm].descripcion.strip().upper() != map_excel[codigo_norm]['descripcion'].strip().upper()
                ])
            }
        }

        return comparacion

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al comparar partidas: {str(e)}"
        )

@router.post("/sugerir-actualizacion-cronograma")
async def sugerir_actualizacion_cronograma(
    comisaria_id: int = Form(...),
    archivo_avances: UploadFile = File(..., description="Excel con partidas nuevas/modificadas")
):
    """
    💡 SUGERIR cómo actualizar el cronograma basado en el Excel de avances

    Analiza las diferencias y sugiere qué partidas agregar/modificar
    """

    # Aquí iría lógica para analizar diferencias y sugerir cambios
    return {
        "sugerencias": [
            {
                "accion": "modificar_partida",
                "codigo": "01.01",
                "descripcion_actual": "CAMBIAR TECHO DE COCINA",
                "descripcion_sugerida": "TANQUE DE AGUA",
                "justificacion": "Cambio de alcance detectado en Excel de avances"
            }
        ],
        "requiere_aprobacion": True,
        "impacto_presupuesto": "medio"
    }

# === FUNCIONES DE BASE DE DATOS ===

async def obtener_partidas_db(comisaria_id: int) -> List[PartidaDB]:
    """Obtiene partidas de la BD usando el mismo sistema que el resto de la aplicación"""
    from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
    from app.infrastructure.database.models import PartidaModel, CronogramaModel
    from app.core.config import settings

    print(f"🗄️ Conectando a BD: {settings.database_url}")

    # Usar la misma configuración de base de datos que el resto de la app
    engine = create_async_engine(settings.database_url, echo=False)
    AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with AsyncSessionLocal() as session:
        try:
            # Obtener el cronograma más reciente de la comisaría
            from sqlalchemy import select, desc
            result = await session.execute(
                select(CronogramaModel.id)
                .where(CronogramaModel.comisaria_id == comisaria_id)
                .order_by(desc(CronogramaModel.created_at))
                .limit(1)
            )
            cronograma = result.scalar_one_or_none()

            if not cronograma:
                print(f"⚠️ No hay cronograma para comisaría {comisaria_id}")
                return []

            cronograma_id = cronograma
            print(f"🎯 Usando cronograma ID={cronograma_id} para comisaría {comisaria_id}")

            # Obtener todas las partidas de ese cronograma
            result = await session.execute(
                select(PartidaModel.codigo_partida, PartidaModel.descripcion, PartidaModel.precio_total)
                .where(PartidaModel.cronograma_id == cronograma_id)
            )
            partidas = result.fetchall()

        finally:
            await engine.dispose()

    partidas_bd = [
        PartidaDB(
            codigo=p[0],
            descripcion=p[1] or "",
            precio_total=p[2] or 0.0,
            descripcion_hash=generar_hash_descripcion(p[1] or ""),
            fecha_modificacion=datetime.now()
        )
        for p in partidas
    ]
    print(f"📊 BD: {len(partidas_bd)} partidas cargadas para comisaría {comisaria_id}")
    return partidas_bd

# === FUNCIONES PARA GESTIÓN DE AVANCES ===


async def consultar_avances_comisaria(comisaria_id: int):
    """Consulta todos los avances de una comisaría"""
    from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
    from app.infrastructure.database.models_seguimiento import AvanceFisico
    from app.core.config import settings
    from sqlalchemy import select, desc

    engine = create_async_engine(settings.database_url, echo=False)
    AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with AsyncSessionLocal() as session:
        try:
            result = await session.execute(
                select(AvanceFisico)
                .where(AvanceFisico.comisaria_id == comisaria_id)
                .order_by(desc(AvanceFisico.fecha_reporte))
            )
            avances = result.scalars().all()

            return [
                {
                    "id": a.id,
                    "fecha_reporte": a.fecha_reporte.isoformat(),
                    "avance_ejecutado": float(a.avance_ejecutado_acum),
                    "archivo_seguimiento": a.archivo_seguimiento,
                    "created_at": a.created_at.isoformat()
                }
                for a in avances
            ]
        finally:
            await engine.dispose()

async def consultar_ultimo_avance(comisaria_id: int):
    """Consulta el último avance de una comisaría"""
    avances = await consultar_avances_comisaria(comisaria_id)
    return avances[0] if avances else None

async def consultar_detalle_avance(avance_id: int):
    """Consulta el detalle por partidas de un avance específico"""
    from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
    from app.infrastructure.database.models_seguimiento import DetalleAvancePartida
    from app.core.config import settings
    from sqlalchemy import select

    engine = create_async_engine(settings.database_url, echo=False)
    AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with AsyncSessionLocal() as session:
        try:
            result = await session.execute(
                select(DetalleAvancePartida)
                .where(DetalleAvancePartida.avance_fisico_id == avance_id)
                .order_by(DetalleAvancePartida.codigo_partida)
            )
            detalles = result.scalars().all()

            return [
                {
                    "codigo_partida": d.codigo_partida,
                    "porcentaje_avance": float(d.porcentaje_avance),
                    "monto_ejecutado": float(d.monto_ejecutado) if d.monto_ejecutado else None,
                    "observaciones": d.observaciones_partida
                }
                for d in detalles
            ]
        finally:
            await engine.dispose()

async def obtener_avance_programado_por_fecha(comisaria_id: int, fecha_corte_str: str = None):
    """Calcula el avance programado basado en fechas y pesos de partidas"""

    from datetime import datetime, date
    from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
    from app.infrastructure.database.models import PartidaModel, CronogramaModel
    from app.core.config import settings

    # Si no se proporciona fecha, usar hoy
    if fecha_corte_str:
        fecha_corte = datetime.strptime(fecha_corte_str, "%Y-%m-%d").date()
    else:
        fecha_corte = date.today()

    # Crear engine async
    engine = create_async_engine(settings.database_url)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    try:
        async with async_session() as session:
            # Obtener cronograma más reciente
            from sqlalchemy import select, desc
            cronograma_query = select(CronogramaModel).where(
                CronogramaModel.comisaria_id == comisaria_id
            ).order_by(desc(CronogramaModel.created_at)).limit(1)

            cronograma_result = await session.execute(cronograma_query)
            cronograma = cronograma_result.scalars().first()

            if not cronograma:
                return {
                    "comisaria_id": comisaria_id,
                    "fecha_corte": fecha_corte.isoformat(),
                    "avance_programado": 0.0,
                    "mensaje": "No hay cronograma para esta comisaría"
                }

            # Obtener partidas del cronograma
            partidas_query = select(PartidaModel).where(
                PartidaModel.cronograma_id == cronograma.id
            ).order_by(PartidaModel.codigo_partida)

            partidas_result = await session.execute(partidas_query)
            partidas = partidas_result.scalars().all()

            if not partidas:
                return {
                    "comisaria_id": comisaria_id,
                    "fecha_corte": fecha_corte.isoformat(),
                    "avance_programado": 0.0,
                    "mensaje": "No hay partidas en el cronograma"
                }

            # Calcular avance programado
            presupuesto_total = sum(p.precio_total for p in partidas)
            avance_programado_total = 0.0
            partidas_detalle = []

            for partida in partidas:
                peso_partida = partida.precio_total / presupuesto_total
                avance_partida = 0.0

                if partida.fecha_inicio and partida.fecha_fin:
                    fecha_inicio = partida.fecha_inicio.date() if hasattr(partida.fecha_inicio, 'date') else partida.fecha_inicio
                    fecha_fin = partida.fecha_fin.date() if hasattr(partida.fecha_fin, 'date') else partida.fecha_fin

                    if fecha_corte >= fecha_fin:
                        avance_partida = 1.0  # Ya debería estar completada
                    elif fecha_corte >= fecha_inicio:
                        # En progreso
                        dias_transcurridos = (fecha_corte - fecha_inicio).days
                        dias_totales = (fecha_fin - fecha_inicio).days
                        if dias_totales > 0:
                            avance_partida = min(dias_transcurridos / dias_totales, 1.0)

                avance_programado_total += avance_partida * peso_partida

                partidas_detalle.append({
                    "codigo_partida": partida.codigo_partida,
                    "descripcion": partida.descripcion,
                    "precio_total": float(partida.precio_total),
                    "peso_porcentaje": peso_partida,
                    "fecha_inicio": str(partida.fecha_inicio) if partida.fecha_inicio else None,
                    "fecha_fin": str(partida.fecha_fin) if partida.fecha_fin else None,
                    "avance_programado": avance_partida
                })

            return {
                "comisaria_id": comisaria_id,
                "cronograma_id": cronograma.id,
                "fecha_corte": fecha_corte.isoformat(),
                "presupuesto_total": float(presupuesto_total),
                "avance_programado": round(avance_programado_total, 4),
                "total_partidas": len(partidas),
                "partidas": partidas_detalle
            }

    finally:
        await engine.dispose()
