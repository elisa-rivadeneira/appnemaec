"""
📊 CRONOGRAMAS API ROUTER - DATABASE VERSION - NEMAEC ERP
Drop-in replacement for JSON-based cronogramas API using SQLAlchemy database.
Maintains exact same Pydantic models and response format as the JSON version.
"""
import io
from typing import List, Optional, Dict, Any
from datetime import datetime
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel
import openpyxl

from app.core.database import get_db
from app.infrastructure.database.models import CronogramaModel, PartidaModel

router = APIRouter(
    prefix="/cronogramas",
    tags=["cronogramas"],
    responses={404: {"description": "Not found"}}
)

# Modelos Pydantic - Idénticos a la versión JSON

class PartidaBase(BaseModel):
    codigo_interno: str
    comisaria_id: int
    codigo_partida: str
    descripcion: str
    unidad: str
    metrado: float
    precio_unitario: float
    precio_total: float
    fecha_inicio: Optional[str] = None  # 🎯 PERMITIR FECHAS NULAS
    fecha_fin: Optional[str] = None     # 🎯 PERMITIR FECHAS NULAS
    nivel_jerarquia: int
    partida_padre: Optional[str] = None

class PartidaResponse(PartidaBase):
    id: int
    cronograma_id: int
    created_at: str

class CronogramaCreate(BaseModel):
    comisaria_id: int
    nombre_cronograma: Optional[str] = None

class CronogramaResponse(BaseModel):
    id: int
    comisaria_id: int
    nombre: str
    descripcion: Optional[str] = None
    fecha_inicio: Optional[str] = None
    fecha_fin: Optional[str] = None
    estado: str
    progreso: float
    created_at: str
    updated_at: Optional[str] = None

class CronogramaWithPartidas(CronogramaResponse):
    partidas: List[PartidaResponse]

class ImportStats(BaseModel):
    total_rows: int
    valid_partidas: int
    invalid_rows: int
    cronograma_id: int
    stats: Dict[str, Any]

# Helper functions

def partida_model_to_response(db_model: PartidaModel) -> PartidaResponse:
    """Convert SQLAlchemy PartidaModel to Pydantic response"""
    return PartidaResponse(
        id=db_model.id,
        cronograma_id=db_model.cronograma_id,
        codigo_interno=db_model.codigo_interno,
        comisaria_id=db_model.comisaria_id,
        codigo_partida=db_model.codigo_partida,
        descripcion=db_model.descripcion,
        unidad=db_model.unidad,
        metrado=db_model.metrado,
        precio_unitario=db_model.precio_unitario,
        precio_total=db_model.precio_total,
        fecha_inicio=db_model.fecha_inicio.isoformat() if db_model.fecha_inicio else None,
        fecha_fin=db_model.fecha_fin.isoformat() if db_model.fecha_fin else None,
        nivel_jerarquia=db_model.nivel_jerarquia,
        partida_padre=db_model.partida_padre,
        created_at=db_model.created_at.isoformat() if db_model.created_at else datetime.now().isoformat()
    )

def cronograma_model_to_response(db_model: CronogramaModel) -> CronogramaResponse:
    """Convert SQLAlchemy CronogramaModel to Pydantic response"""
    return CronogramaResponse(
        id=db_model.id,
        comisaria_id=db_model.comisaria_id,
        nombre=db_model.nombre,
        descripcion=db_model.descripcion,
        fecha_inicio=db_model.fecha_inicio.isoformat() if db_model.fecha_inicio else None,
        fecha_fin=db_model.fecha_fin.isoformat() if db_model.fecha_fin else None,
        estado=db_model.estado,
        progreso=db_model.progreso,
        created_at=db_model.created_at.isoformat() if db_model.created_at else datetime.now().isoformat(),
        updated_at=db_model.updated_at.isoformat() if db_model.updated_at else None
    )

def get_partida_padre(codigo_partida: str) -> Optional[str]:
    """Obtener código de partida padre"""
    partes = codigo_partida.split('.')
    if len(partes) > 1:
        return '.'.join(partes[:-1])
    return None

def calcular_nivel_jerarquia(codigo_partida: str) -> int:
    """Calcular nivel de jerarquía basado en el código de partida"""
    return len(codigo_partida.split('.'))

# Endpoints

@router.get("/", response_model=List[CronogramaResponse])
async def get_all_cronogramas(db: AsyncSession = Depends(get_db)):
    """
    Obtener todos los cronogramas

    Returns:
        List[CronogramaResponse]: Lista de cronogramas
    """
    print("🔍 DEBUG: GET /cronogramas - Consultando base de datos SQLite")

    stmt = select(CronogramaModel).order_by(CronogramaModel.created_at.desc())
    result = await db.execute(stmt)
    cronogramas = result.scalars().all()

    print(f"🗄️ Encontrados {len(cronogramas)} cronogramas en la base de datos")

    return [cronograma_model_to_response(cronograma) for cronograma in cronogramas]

@router.get("/comisaria/{comisaria_id}", response_model=List[CronogramaResponse])
async def get_cronogramas_by_comisaria(comisaria_id: int, db: AsyncSession = Depends(get_db)):
    """
    Obtener cronogramas de una comisaría específica

    Args:
        comisaria_id: ID de la comisaría

    Returns:
        List[CronogramaResponse]: Cronogramas de la comisaría
    """
    print(f"🔍 DEBUG: GET /cronogramas/comisaria/{comisaria_id}")

    stmt = select(CronogramaModel).where(
        CronogramaModel.comisaria_id == comisaria_id
    ).order_by(CronogramaModel.created_at.desc())

    result = await db.execute(stmt)
    cronogramas = result.scalars().all()

    print(f"🗄️ Encontrados {len(cronogramas)} cronogramas para comisaría {comisaria_id}")
    return [cronograma_model_to_response(cronograma) for cronograma in cronogramas]

@router.get("/{cronograma_id}", response_model=CronogramaWithPartidas)
async def get_cronograma_with_partidas(cronograma_id: int, db: AsyncSession = Depends(get_db)):
    """
    Obtener cronograma con sus partidas

    Args:
        cronograma_id: ID del cronograma

    Returns:
        CronogramaWithPartidas: Cronograma con lista de partidas
    """
    # Obtener cronograma
    stmt = select(CronogramaModel).where(CronogramaModel.id == cronograma_id)
    result = await db.execute(stmt)
    cronograma = result.scalar_one_or_none()

    if not cronograma:
        raise HTTPException(status_code=404, detail="Cronograma no encontrado")

    # Obtener partidas del cronograma
    stmt = select(PartidaModel).where(
        PartidaModel.cronograma_id == cronograma_id
    ).order_by(PartidaModel.codigo_partida)

    result = await db.execute(stmt)
    partidas = result.scalars().all()

    # Convertir a response format
    cronograma_response = cronograma_model_to_response(cronograma)
    partidas_response = [partida_model_to_response(partida) for partida in partidas]

    return CronogramaWithPartidas(
        **cronograma_response.model_dump(),
        partidas=partidas_response
    )

@router.post("/import", response_model=ImportStats, status_code=201)
async def import_cronograma_from_excel(
    comisaria_id: int = Form(...),
    nombre_cronograma: str = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Importar cronograma desde archivo Excel

    Args:
        comisaria_id: ID de la comisaría
        nombre_cronograma: Nombre del cronograma
        file: Archivo Excel con las partidas

    Returns:
        ImportStats: Estadísticas de la importación
    """
    print(f"📊 Importando cronograma: {nombre_cronograma} para comisaría {comisaria_id}")

    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Solo se aceptan archivos Excel (.xlsx, .xls)")

    try:
        # Cargar dos veces:
        # - data_only=True  → valores cacheados (precios calculados, fechas directas)
        # - data_only=False → fórmulas como texto (para calcular fecha_fin cuando no hay cache)
        contents = await file.read()
        workbook = openpyxl.load_workbook(io.BytesIO(contents), data_only=True)
        workbook_fmls = openpyxl.load_workbook(io.BytesIO(contents), data_only=False)
        sheet = workbook.active
        sheet_fmls = workbook_fmls.active

        # Crear cronograma
        nuevo_cronograma = CronogramaModel(
            comisaria_id=comisaria_id,
            nombre=nombre_cronograma,
            descripcion=f"Cronograma importado desde {file.filename}",
            estado="activo",
            progreso=0.0,
            created_at=datetime.now()
        )

        db.add(nuevo_cronograma)
        await db.commit()
        await db.refresh(nuevo_cronograma)

        cronograma_id = nuevo_cronograma.id

        # Detectar formato del Excel según la fila de encabezado
        header_row = [str(c).strip().upper() if c else "" for c in next(sheet.iter_rows(min_row=1, max_row=1, values_only=True))]
        print(f"📋 Encabezados detectados: {header_row}")

        # Formato A: ITEM, DESCRIPCION, UND, CANT, PU, PARCIAL, FECHA INICIO, FECHA FIN
        # Formato B (original): N°, COD_INTERNO, REF, COD_PARTIDA, DESCRIPCION, REF2, METRADO, P.UNIT, P.TOTAL, UNIDAD, FECHA_INICIO, FECHA_FIN
        if header_row and header_row[0] in ("ITEM", "N°", "NRO", "NUM", "#"):
            if "DESCRIPCION" in header_row[:3]:
                fmt = "A"  # ITEM(0), DESCRIPCION(1), UND(2), CANT(3), PU(4), PARCIAL(5), F_INI(6), F_FIN(7)
            else:
                fmt = "B"
        else:
            fmt = "B"
        print(f"📊 Formato detectado: {fmt}")

        def normalizar_codigo(val) -> str:
            """
            Normaliza códigos de partida a formato XX.XX.XX con ceros a la izquierda.

            Casos que maneja:
              - int  1        -> "01"
              - float 1.01   -> "01.01"   (2 decimales, ya correctos)
              - float 2.1    -> "02.10"   (1 decimal: Excel trunco el cero final de "2.10")
              - float 1.0    -> "01"      (categoria raiz sin subcategoria)
              - str "01.01.01" -> "01.01.01"  (ya formateado, limpia espacios)
              - str "1.01.01"  -> "01.01.01"  (sin cero inicial)
            """
            import math

            if val is None:
                return ""

            # Cadena de texto (e.g. "01.01.01 ", "01.02.01", "2.1")
            if isinstance(val, str):
                s = val.strip()
                if s in ("nan", "None", ""):
                    return ""
                partes = s.split(".")
                result = []
                for i, p in enumerate(partes):
                    t = p.strip()
                    if not t.isdigit():
                        result.append(t)
                    elif i == 0:
                        # Primer segmento: siempre pad izquierda ("2" -> "02")
                        result.append(t.zfill(2))
                    elif len(t) == 1:
                        # 1 dígito en posición no-primera: vino de float truncado
                        # ("2.1" era "2.10") -> pad derecha
                        result.append(t + "0")
                    else:
                        # 2+ dígitos: pad izquierda ("01" -> "01")
                        result.append(t.zfill(2))
                return ".".join(result)

            # Entero (e.g. 1, 2, 3) -> categoria raiz
            if isinstance(val, int):
                return str(val).zfill(2)

            # Float (e.g. 1.01, 2.1, 2.03)
            if isinstance(val, float):
                if math.isnan(val) or math.isinf(val):
                    return ""
                s = str(val)
                if "." in s:
                    integer_part, decimal_part = s.split(".", 1)
                    if decimal_part == "0":
                        # 1.0 -> categoria raiz "01"
                        return integer_part.zfill(2)
                    if len(decimal_part) == 1:
                        # 2.1 -> Excel trunco "2.10" -> "02.10"
                        decimal_part = decimal_part + "0"
                    # 2 digitos (e.g. "01", "03") -> ya correctos
                    return integer_part.zfill(2) + "." + decimal_part.zfill(2)
                else:
                    return s.zfill(2)

            # Fallback
            return normalizar_codigo(str(val))

        def parse_fecha(val):
            if not val:
                return None
            if isinstance(val, datetime):
                return val
            try:
                return datetime.strptime(str(val)[:10], "%Y-%m-%d")
            except:
                return None

        def parse_float(val):
            if val is None:
                return 0.0
            try:
                return float(str(val).replace(",", "."))
            except:
                return 0.0

        def parse_fecha_formula(formula: str, fecha_inicio_base) -> Optional[datetime]:
            """
            Calcula fecha_fin desde una fórmula como =+G4+30-1 o =G4+29 cuando
            el valor cacheado (data_only) no está disponible.
            """
            import re
            from datetime import timedelta
            if not formula or not isinstance(formula, str) or not formula.startswith("="):
                return None
            if fecha_inicio_base is None:
                return None
            # Patrón: =+CELDA+DIAS o =CELDA+DIAS-1 o =+CELDA+DIAS-1
            # Los días de duración y la resta de 1 al final son el patrón típico de Gantt
            m = re.match(r'^=\+?[A-Za-z]+\d+\+(\d+)(?:-(\d+))?$', formula.strip())
            if m:
                add_days = int(m.group(1))
                sub_days = int(m.group(2)) if m.group(2) else 0
                return fecha_inicio_base + timedelta(days=add_days - sub_days)
            return None

        # Procesar partidas del Excel
        valid_partidas = 0
        invalid_rows = 0
        total_rows = 0

        rows_vals = list(sheet.iter_rows(min_row=2, values_only=True))
        rows_fmls = list(sheet_fmls.iter_rows(min_row=2, values_only=True))

        for idx, row in enumerate(rows_vals):  # Skip header
            total_rows += 1
            if not row or all(c is None for c in row):
                invalid_rows += 1
                continue

            # Fila de fórmulas para este mismo índice (fallback de fechas)
            fml_row = rows_fmls[idx] if idx < len(rows_fmls) else ()

            try:
                if fmt == "A":
                    # ITEM(0), DESCRIPCION(1), UND(2), CANT(3), PU(4), PARCIAL(5), F_INI(6), F_FIN(7)
                    codigo_partida  = normalizar_codigo(row[0])
                    descripcion     = str(row[1]).strip() if row[1] else ""
                    unidad          = str(row[2]).strip() if row[2] else "UND"
                    metrado         = parse_float(row[3])
                    precio_unitario = parse_float(row[4])
                    precio_total    = parse_float(row[5])
                    # Fallback: calcular desde metrado × PU si PARCIAL vino vacío/0
                    if precio_total == 0.0 and metrado > 0 and precio_unitario > 0:
                        precio_total = round(metrado * precio_unitario, 2)
                    fecha_inicio    = parse_fecha(row[6] if len(row) > 6 else None)
                    fecha_fin       = parse_fecha(row[7] if len(row) > 7 else None)
                    # Fallback: si fecha_fin no está cacheada, calcular desde fórmula
                    if fecha_fin is None and len(fml_row) > 7:
                        fecha_fin = parse_fecha_formula(fml_row[7], fecha_inicio)
                    codigo_interno  = codigo_partida
                else:
                    # Formato original: índices 1,3,4,6,7,8,9,10,11
                    codigo_interno  = str(row[1]).strip() if row[1] else f"AUTO_{total_rows}"
                    codigo_partida  = normalizar_codigo(row[3])
                    descripcion     = str(row[4]).strip() if row[4] else ""
                    metrado         = parse_float(row[6]) if len(row) > 6 else 0.0
                    precio_unitario = parse_float(row[7]) if len(row) > 7 else 0.0
                    precio_total    = parse_float(row[8]) if len(row) > 8 else 0.0
                    unidad          = str(row[9]).strip() if len(row) > 9 and row[9] else "UND"
                    fecha_inicio    = parse_fecha(row[10] if len(row) > 10 else None)
                    fecha_fin       = parse_fecha(row[11] if len(row) > 11 else None)
                    if fecha_fin is None and len(fml_row) > 11:
                        fecha_fin = parse_fecha_formula(fml_row[11], fecha_inicio)

                if codigo_partida and descripcion:
                    nueva_partida = PartidaModel(
                        cronograma_id=cronograma_id,
                        codigo_interno=codigo_interno,
                        comisaria_id=comisaria_id,
                        codigo_partida=codigo_partida,
                        descripcion=descripcion,
                        unidad=unidad,
                        metrado=metrado,
                        precio_unitario=precio_unitario,
                        precio_total=precio_total,
                        fecha_inicio=fecha_inicio,
                        fecha_fin=fecha_fin,
                        nivel_jerarquia=calcular_nivel_jerarquia(codigo_partida),
                        partida_padre=get_partida_padre(codigo_partida),
                        created_at=datetime.now()
                    )
                    db.add(nueva_partida)
                    valid_partidas += 1
                else:
                    invalid_rows += 1

            except Exception as e:
                print(f"Error procesando fila {total_rows}: {e}")
                invalid_rows += 1

        # Commit todas las partidas
        await db.commit()

        # --- Rollup: calcular precio_total, fecha_inicio y fecha_fin de agrupaciones ---
        # Las filas de categoría (nivel 1 y 2) no tienen precios/fechas en el Excel.
        # Se calculan sumando/min/max desde los hijos, de adentro hacia afuera.
        stmt_all = select(PartidaModel).where(PartidaModel.cronograma_id == cronograma_id)
        result_all = await db.execute(stmt_all)
        todas = list(result_all.scalars().all())

        # Procesar de mayor nivel (hojas) a menor (raíz)
        for partida in sorted(todas, key=lambda p: p.nivel_jerarquia, reverse=True):
            hijos = [p for p in todas if p.partida_padre == partida.codigo_partida]
            if not hijos:
                continue

            total_hijos = sum(h.precio_total or 0.0 for h in hijos)
            if total_hijos > 0:
                partida.precio_total = total_hijos

            fechas_ini = [h.fecha_inicio for h in hijos if h.fecha_inicio]
            fechas_fin = [h.fecha_fin    for h in hijos if h.fecha_fin]
            if fechas_ini:
                partida.fecha_inicio = min(fechas_ini)
            if fechas_fin:
                partida.fecha_fin = max(fechas_fin)

        await db.commit()

        print(f"✅ Cronograma importado: {valid_partidas} partidas válidas de {total_rows} filas")

        return ImportStats(
            total_rows=total_rows,
            valid_partidas=valid_partidas,
            invalid_rows=invalid_rows,
            cronograma_id=cronograma_id,
            stats={
                "nombre_cronograma": nombre_cronograma,
                "comisaria_id": comisaria_id,
                "archivo": file.filename
            }
        )

    except Exception as e:
        print(f"❌ Error importando cronograma: {e}")
        raise HTTPException(status_code=500, detail=f"Error procesando archivo: {str(e)}")

@router.delete("/{cronograma_id}", status_code=204)
async def delete_cronograma(cronograma_id: int, db: AsyncSession = Depends(get_db)):
    """
    Eliminar cronograma y todas sus partidas

    Args:
        cronograma_id: ID del cronograma a eliminar
    """
    # Verificar que existe
    stmt = select(CronogramaModel).where(CronogramaModel.id == cronograma_id)
    result = await db.execute(stmt)
    cronograma = result.scalar_one_or_none()

    if not cronograma:
        raise HTTPException(status_code=404, detail="Cronograma no encontrado")

    cronograma_name = cronograma.nombre

    # Eliminar todas las partidas del cronograma
    stmt = delete(PartidaModel).where(PartidaModel.cronograma_id == cronograma_id)
    await db.execute(stmt)

    # Eliminar el cronograma
    stmt = delete(CronogramaModel).where(CronogramaModel.id == cronograma_id)
    await db.execute(stmt)

    await db.commit()

    print(f"✅ Cronograma eliminado: {cronograma_name} (ID: {cronograma_id})")

@router.get("/{cronograma_id}/partidas", response_model=List[PartidaResponse])
async def get_cronograma_partidas(cronograma_id: int, db: AsyncSession = Depends(get_db)):
    """
    Obtener solo las partidas de un cronograma específico

    Args:
        cronograma_id: ID del cronograma

    Returns:
        List[PartidaResponse]: Lista de partidas del cronograma
    """
    print(f"🔍 DEBUG: GET /cronogramas/{cronograma_id}/partidas")

    # Verificar que el cronograma existe
    stmt_cronograma = select(CronogramaModel).where(CronogramaModel.id == cronograma_id)
    result_cronograma = await db.execute(stmt_cronograma)
    cronograma = result_cronograma.scalar_one_or_none()

    if not cronograma:
        raise HTTPException(status_code=404, detail="Cronograma no encontrado")

    # Obtener partidas del cronograma
    stmt = select(PartidaModel).where(
        PartidaModel.cronograma_id == cronograma_id
    ).order_by(PartidaModel.codigo_partida)

    result = await db.execute(stmt)
    partidas = result.scalars().all()

    print(f"📊 Encontradas {len(partidas)} partidas para cronograma {cronograma_id}")

    return [partida_model_to_response(partida) for partida in partidas]

@router.get("/comisaria/{comisaria_id}/detalle", response_model=CronogramaWithPartidas)
async def get_cronograma_detalle_by_comisaria(comisaria_id: int, db: AsyncSession = Depends(get_db)):
    """
    Obtener cronograma más reciente de una comisaría CON sus partidas

    Args:
        comisaria_id: ID de la comisaría

    Returns:
        CronogramaWithPartidas: Cronograma completo con todas las partidas
    """
    print(f"🔍 DEBUG: GET /cronogramas/comisaria/{comisaria_id}/detalle")

    # Obtener el cronograma más reciente de la comisaría
    stmt = select(CronogramaModel).where(
        CronogramaModel.comisaria_id == comisaria_id
    ).order_by(CronogramaModel.created_at.desc()).limit(1)

    result = await db.execute(stmt)
    cronograma = result.scalars().first()

    if not cronograma:
        raise HTTPException(status_code=404, detail="No se encontró cronograma para esta comisaría")

    # Obtener todas las partidas del cronograma
    stmt_partidas = select(PartidaModel).where(
        PartidaModel.cronograma_id == cronograma.id
    ).order_by(PartidaModel.codigo_partida)

    result_partidas = await db.execute(stmt_partidas)
    partidas = result_partidas.scalars().all()

    print(f"📊 Encontrado cronograma {cronograma.nombre} con {len(partidas)} partidas")

    # Convertir a modelos de respuesta
    cronograma_response = cronograma_model_to_response(cronograma)
    partidas_response = [partida_model_to_response(partida) for partida in partidas]

    return CronogramaWithPartidas(
        **cronograma_response.model_dump(),
        partidas=partidas_response
    )