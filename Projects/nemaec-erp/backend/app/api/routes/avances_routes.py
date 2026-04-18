"""
📊 RUTAS - AVANCES FÍSICOS
Endpoints para el registro y seguimiento de avances físicos
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.application.services.avances_service_async import AvancesService
from app.api.schemas.avances_schemas import (
    RegistroAvanceManualRequest,
    RegistroAvanceManualResponse,
    InformacionSemanaResponse,
    PartidaConAvanceResponse,
    AvanceFisicoDetalladoResponse
)

router = APIRouter(prefix="/avances", tags=["📊 Avances Físicos"])

@router.get("/semana-actual/{comisaria_id}", response_model=InformacionSemanaResponse)
async def obtener_informacion_semana_actual(
    comisaria_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    📅 Obtener información de la semana actual del proyecto.

    Calcula en qué semana del proyecto estamos basado en la fecha de inicio
    y proporciona información para el registro de avances.
    """
    try:
        service = AvancesService(db)
        return await service.obtener_informacion_semana_actual(comisaria_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener información de semana: {str(e)}"
        )

@router.get("/partidas/{comisaria_id}", response_model=List[PartidaConAvanceResponse])
async def obtener_partidas_con_avance(
    comisaria_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    🏗️ Obtener todas las partidas ejecutables con su avance actual.

    Proporciona la lista de partidas que pueden tener avance registrado
    junto con su estado actual de progreso.
    """
    try:
        service = AvancesService(db)
        return await service.obtener_partidas_con_avance(comisaria_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener partidas: {str(e)}"
        )

@router.post("/registrar", response_model=RegistroAvanceManualResponse)
async def registrar_avance_manual(
    request: RegistroAvanceManualRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    ✍️ Registrar avance manual de partidas.

    Permite al monitor registrar avances adicionales en partidas específicas.
    El sistema suma el porcentaje adicional al avance actual de cada partida.

    **Flujo de trabajo:**
    1. El monitor selecciona la fecha y semana del reporte
    2. Marca las partidas que tuvieron avance en esa fecha
    3. Especifica el % de avance adicional para cada partida
    4. El sistema calcula automáticamente los nuevos totales
    """
    try:
        service = AvancesService(db)
        return await service.registrar_avance_manual(request)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al registrar avance: {str(e)}"
        )

@router.get("/graficos/{comisaria_id}")
async def obtener_datos_graficos(
    comisaria_id: int,
    days_back: int = 30,
    db: AsyncSession = Depends(get_db)
):
    """
    📈 Obtener datos para gráficos de avance físico vs programado.

    Retorna series de tiempo con avances acumulados para visualización.
    """
    try:
        from datetime import date, timedelta
        from sqlalchemy import select, and_
        from app.infrastructure.database.models_seguimiento import AvanceFisico

        # Calcular rango de fechas
        fecha_fin = date.today()
        fecha_inicio = fecha_fin - timedelta(days=days_back)

        # Obtener todos los avances físicos en el rango de fechas
        stmt = select(AvanceFisico).filter(
            and_(
                AvanceFisico.comisaria_id == comisaria_id,
                AvanceFisico.fecha_reporte >= fecha_inicio,
                AvanceFisico.fecha_reporte <= fecha_fin
            )
        ).order_by(AvanceFisico.fecha_reporte.asc())

        result = await db.execute(stmt)
        avances = result.scalars().all()

        # Preparar datos para gráficos
        datos_grafico = []
        for avance in avances:
            datos_grafico.append({
                "fecha": avance.fecha_reporte.isoformat(),
                "avance_programado": float(avance.avance_programado_acum * 100) if avance.avance_programado_acum else 0,
                "avance_ejecutado": float(avance.avance_ejecutado_acum * 100),
                "diferencia": float(avance.avance_ejecutado_acum * 100) - (float(avance.avance_programado_acum * 100) if avance.avance_programado_acum else 0),
                "dias_transcurridos": avance.dias_transcurridos
            })

        # Obtener información actual del proyecto
        service = AvancesService(db)
        info_semana = await service.obtener_informacion_semana_actual(comisaria_id)

        # Obtener resumen de partidas críticas
        partidas = await service.obtener_partidas_con_avance(comisaria_id)

        partidas_criticas = []
        partidas_en_tiempo = []
        partidas_adelantadas = []

        for partida in partidas:
            diferencia = partida.porcentaje_avance_actual - partida.porcentaje_programado
            if diferencia < -5:  # Más de 5% de retraso
                partidas_criticas.append({
                    "codigo": partida.codigo,
                    "descripcion": partida.descripcion,
                    "avance_actual": partida.porcentaje_avance_actual,
                    "avance_programado": partida.porcentaje_programado,
                    "diferencia": diferencia
                })
            elif diferencia > 5:  # Más de 5% adelantada
                partidas_adelantadas.append({
                    "codigo": partida.codigo,
                    "descripcion": partida.descripcion,
                    "avance_actual": partida.porcentaje_avance_actual,
                    "avance_programado": partida.porcentaje_programado,
                    "diferencia": diferencia
                })
            else:
                partidas_en_tiempo.append({
                    "codigo": partida.codigo,
                    "descripcion": partida.descripcion,
                    "avance_actual": partida.porcentaje_avance_actual,
                    "avance_programado": partida.porcentaje_programado,
                    "diferencia": diferencia
                })

        return {
            "comisaria_id": comisaria_id,
            "periodo": {
                "fecha_inicio": fecha_inicio.isoformat(),
                "fecha_fin": fecha_fin.isoformat(),
                "days_back": days_back
            },
            "proyecto": {
                "semana_actual": info_semana.semana_actual,
                "dias_transcurridos": info_semana.dias_transcurridos,
                "fecha_inicio_proyecto": info_semana.fecha_inicio_proyecto
            },
            "serie_temporal": datos_grafico,
            "resumen_partidas": {
                "criticas": partidas_criticas,
                "en_tiempo": partidas_en_tiempo,
                "adelantadas": partidas_adelantadas,
                "total_partidas": len(partidas)
            },
            "avance_actual": {
                "programado": datos_grafico[-1]["avance_programado"] if datos_grafico else 0,
                "ejecutado": datos_grafico[-1]["avance_ejecutado"] if datos_grafico else 0,
                "diferencia": datos_grafico[-1]["diferencia"] if datos_grafico else 0
            }
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener datos de gráficos: {str(e)}"
        )

@router.get("/historial/{comisaria_id}")
async def obtener_historial_avances(
    comisaria_id: int,
    limit: int = 10,
    db: AsyncSession = Depends(get_db)
):
    """
    📈 Obtener historial de avances de una comisaría.

    Muestra los últimos registros de avance con todos sus detalles.
    """
    try:
        from app.infrastructure.database.models_seguimiento import AvanceFisico, DetalleAvancePartida
        from sqlalchemy import select

        stmt = select(AvanceFisico).filter(
            AvanceFisico.comisaria_id == comisaria_id
        ).order_by(AvanceFisico.fecha_reporte.desc()).limit(limit)

        result_avances = await db.execute(stmt)
        avances = result_avances.scalars().all()

        result = []
        for avance in avances:
            stmt_detalles = select(DetalleAvancePartida).filter(
                DetalleAvancePartida.avance_fisico_id == avance.id
            )
            result_detalles = await db.execute(stmt_detalles)
            detalles = result_detalles.scalars().all()

            result.append({
                "id": avance.id,
                "comisaria_id": avance.comisaria_id,
                "fecha_reporte": avance.fecha_reporte,
                "dias_transcurridos": avance.dias_transcurridos,
                "avance_programado_acum": float(avance.avance_programado_acum * 100) if avance.avance_programado_acum else None,
                "avance_ejecutado_acum": float(avance.avance_ejecutado_acum * 100),
                "observaciones": avance.observaciones,
                "created_at": avance.created_at,
                "updated_at": avance.updated_at,
                "detalles_avances": [
                    {
                        "id": detalle.id,
                        "codigo_partida": detalle.codigo_partida,
                        "porcentaje_avance": float(detalle.porcentaje_avance * 100),
                        "monto_ejecutado": float(detalle.monto_ejecutado) if detalle.monto_ejecutado else None,
                        "observaciones_partida": detalle.observaciones_partida,
                        "created_at": detalle.created_at
                    }
                    for detalle in detalles
                ]
            })

        return {
            "comisaria_id": comisaria_id,
            "total_avances": len(result),
            "avances": result
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener historial: {str(e)}"
        )