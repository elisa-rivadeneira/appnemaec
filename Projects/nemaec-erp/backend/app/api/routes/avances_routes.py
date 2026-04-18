"""
📊 RUTAS - AVANCES FÍSICOS
Endpoints para el registro y seguimiento de avances físicos
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, and_

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

        # Calcular rango de fechas histórico
        fecha_hoy = date.today()
        fecha_inicio_historico = fecha_hoy - timedelta(days=days_back)

        # Obtener todos los avances físicos en el rango histórico
        stmt = select(AvanceFisico).filter(
            and_(
                AvanceFisico.comisaria_id == comisaria_id,
                AvanceFisico.fecha_reporte >= fecha_inicio_historico,
                AvanceFisico.fecha_reporte <= fecha_hoy
            )
        ).order_by(AvanceFisico.fecha_reporte.asc())

        result = await db.execute(stmt)
        avances_historicos = result.scalars().all()

        # Obtener información del proyecto para calcular fechas
        from app.infrastructure.database.models import PartidaModel
        from sqlalchemy import func

        # Obtener la fecha de finalización del proyecto (fecha fin más tardía)
        stmt_fecha_fin = select(func.max(PartidaModel.fecha_fin)).filter(
            and_(
                PartidaModel.comisaria_id == comisaria_id,
                PartidaModel.fecha_fin.isnot(None)
            )
        )
        result_fecha_fin = await db.execute(stmt_fecha_fin)
        fecha_fin_proyecto = result_fecha_fin.scalar()

        if fecha_fin_proyecto:
            if hasattr(fecha_fin_proyecto, 'date'):
                fecha_fin_proyecto = fecha_fin_proyecto.date()
        else:
            # Si no hay fechas, proyectar 6 meses desde hoy
            fecha_fin_proyecto = fecha_hoy + timedelta(days=180)

        # Preparar datos históricos reales
        datos_grafico = []
        for avance in avances_historicos:
            datos_grafico.append({
                "fecha": avance.fecha_reporte.isoformat(),
                "avance_programado": float(avance.avance_programado_acum * 100) if avance.avance_programado_acum else 0,
                "avance_ejecutado": float(avance.avance_ejecutado_acum * 100),
                "diferencia": float(avance.avance_ejecutado_acum * 100) - (float(avance.avance_programado_acum * 100) if avance.avance_programado_acum else 0),
                "dias_transcurridos": avance.dias_transcurridos,
                "es_proyeccion": False
            })

        # Generar línea programada completa desde inicio del proyecto hasta fin
        service = AvancesService(db)
        fecha_inicio_proyecto = await service._obtener_fecha_inicio_proyecto(comisaria_id)

        if fecha_inicio_proyecto and fecha_fin_proyecto:
            # Calcular duración total del proyecto en días
            dias_totales_proyecto = (fecha_fin_proyecto - fecha_inicio_proyecto).days

            # Generar puntos de la línea programada completa (cada semana desde inicio hasta fin)
            fecha_actual = fecha_inicio_proyecto
            while fecha_actual <= fecha_fin_proyecto:
                dias_transcurridos = (fecha_actual - fecha_inicio_proyecto).days

                # Calcular avance programado basado en la línea de tiempo
                if dias_totales_proyecto > 0:
                    avance_programado_proyectado = min(100.0, (dias_transcurridos / dias_totales_proyecto) * 100)
                else:
                    avance_programado_proyectado = 100.0

                # Determinar si es proyección (fecha futura) o línea base (fecha pasada/presente sin datos reales)
                es_proyeccion = fecha_actual > fecha_hoy

                # Verificar si ya tenemos datos reales para esta fecha
                tiene_datos_reales = any(
                    item["fecha"] == fecha_actual.isoformat()
                    for item in datos_grafico
                )

                # Solo agregar si no tenemos datos reales para esta fecha
                if not tiene_datos_reales:
                    datos_grafico.append({
                        "fecha": fecha_actual.isoformat(),
                        "avance_programado": avance_programado_proyectado,
                        "avance_ejecutado": None,  # Solo datos reales tienen avance ejecutado
                        "diferencia": None,
                        "dias_transcurridos": dias_transcurridos,
                        "es_proyeccion": es_proyeccion
                    })

                # Avanzar una semana
                fecha_actual += timedelta(days=7)

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

        # Ordenar todos los datos por fecha
        datos_grafico.sort(key=lambda x: x["fecha"])

        # Separar datos históricos y proyecciones para el frontend
        datos_historicos = [d for d in datos_grafico if not d.get("es_proyeccion", False)]
        datos_proyeccion = [d for d in datos_grafico if d.get("es_proyeccion", False)]

        return {
            "comisaria_id": comisaria_id,
            "periodo": {
                "fecha_inicio": fecha_inicio_proyecto.isoformat() if fecha_inicio_proyecto else fecha_inicio_historico.isoformat(),
                "fecha_fin": fecha_fin_proyecto.isoformat() if fecha_fin_proyecto else fecha_hoy.isoformat(),
                "days_back": days_back,
                "periodo_completo": True  # Indica que se muestra el período completo del proyecto
            },
            "proyecto": {
                "semana_actual": info_semana.semana_actual,
                "dias_transcurridos": info_semana.dias_transcurridos,
                "fecha_inicio_proyecto": info_semana.fecha_inicio_proyecto,
                "fecha_fin_proyecto": fecha_fin_proyecto.isoformat() if fecha_fin_proyecto else None,
                "duracion_total_dias": (fecha_fin_proyecto - (date.fromisoformat(info_semana.fecha_inicio_proyecto) if isinstance(info_semana.fecha_inicio_proyecto, str) else info_semana.fecha_inicio_proyecto)).days if fecha_fin_proyecto and info_semana.fecha_inicio_proyecto else None
            },
            "serie_temporal": datos_historicos,
            "serie_proyeccion": datos_proyeccion,
            "serie_completa": datos_grafico,  # Todos los datos para gráficos que quieran mostrar todo junto
            "resumen_partidas": {
                "criticas": partidas_criticas,
                "en_tiempo": partidas_en_tiempo,
                "adelantadas": partidas_adelantadas,
                "total_partidas": len(partidas)
            },
            "avance_actual": {
                "programado": datos_historicos[-1]["avance_programado"] if datos_historicos else 0,
                "ejecutado": datos_historicos[-1]["avance_ejecutado"] if datos_historicos and datos_historicos[-1]["avance_ejecutado"] is not None else 0,
                "diferencia": datos_historicos[-1]["diferencia"] if datos_historicos and datos_historicos[-1]["diferencia"] is not None else 0
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

@router.put("/detalle/{detalle_id}")
async def actualizar_avance_detalle(
    detalle_id: int,
    request: dict,
    db: AsyncSession = Depends(get_db)
):
    """
    ✏️ Actualizar avance de un detalle específico en el historial.

    Permite modificar el porcentaje de avance y observaciones de una partida
    en un registro histórico específico. Al actualizar, recalcula automáticamente
    el avance total acumulado del registro.
    """
    try:
        from app.infrastructure.database.models_seguimiento import DetalleAvancePartida, AvanceFisico
        from sqlalchemy import select, update
        from decimal import Decimal

        # Validar datos de entrada
        porcentaje_avance = request.get('porcentaje_avance')
        observaciones_partida = request.get('observaciones_partida')

        if porcentaje_avance is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="porcentaje_avance es requerido"
            )

        if not (0 <= porcentaje_avance <= 100):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="porcentaje_avance debe estar entre 0 y 100"
            )

        # Obtener el detalle existente
        stmt = select(DetalleAvancePartida).filter(
            DetalleAvancePartida.id == detalle_id
        )
        result = await db.execute(stmt)
        detalle = result.scalar_one_or_none()

        if not detalle:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Detalle de avance no encontrado"
            )

        # Actualizar el detalle
        stmt_update = update(DetalleAvancePartida).where(
            DetalleAvancePartida.id == detalle_id
        ).values(
            porcentaje_avance=Decimal(str(porcentaje_avance / 100)),  # Convertir a decimal (0-1)
            observaciones_partida=observaciones_partida
        )

        await db.execute(stmt_update)

        # Recalcular el avance total acumulado del registro padre
        avance_fisico_id = detalle.avance_fisico_id

        # Obtener el avance físico para obtener la comisaria_id
        stmt_avance = select(AvanceFisico).filter(AvanceFisico.id == avance_fisico_id)
        result_avance = await db.execute(stmt_avance)
        avance_fisico = result_avance.scalar_one()

        # Obtener todos los detalles de este avance físico
        stmt_detalles = select(DetalleAvancePartida).filter(
            DetalleAvancePartida.avance_fisico_id == avance_fisico_id
        )
        result_detalles = await db.execute(stmt_detalles)
        todos_los_detalles = result_detalles.scalars().all()

        # Obtener información de las partidas para calcular montos
        from app.infrastructure.database.models import PartidaModel
        codigos_partidas = [d.codigo_partida for d in todos_los_detalles]

        stmt_partidas = select(PartidaModel).filter(
            and_(
                PartidaModel.codigo_partida.in_(codigos_partidas),
                PartidaModel.comisaria_id == avance_fisico.comisaria_id
            )
        )
        result_partidas = await db.execute(stmt_partidas)
        partidas_info = {p.codigo_partida: p for p in result_partidas.scalars().all()}

        # Recalcular el avance total acumulado
        total_monto_proyecto = Decimal('0')
        monto_ejecutado_total = Decimal('0')

        for detalle_item in todos_los_detalles:
            partida_info = partidas_info.get(detalle_item.codigo_partida)
            if partida_info and partida_info.precio_total:
                monto_partida = Decimal(str(partida_info.precio_total))
                total_monto_proyecto += monto_partida

                # Calcular monto ejecutado basado en el porcentaje
                porcentaje_decimal = detalle_item.porcentaje_avance  # Ya está en formato 0-1
                monto_ejecutado = monto_partida * porcentaje_decimal
                monto_ejecutado_total += monto_ejecutado

        # Calcular porcentaje total
        if total_monto_proyecto > 0:
            avance_ejecutado_acum = monto_ejecutado_total / total_monto_proyecto
        else:
            avance_ejecutado_acum = Decimal('0')

        # Actualizar el avance físico padre
        stmt_update_avance = update(AvanceFisico).where(
            AvanceFisico.id == avance_fisico_id
        ).values(
            avance_ejecutado_acum=avance_ejecutado_acum
        )

        await db.execute(stmt_update_avance)
        await db.commit()

        return {
            "success": True,
            "mensaje": "Avance actualizado exitosamente",
            "detalle_id": detalle_id,
            "nuevo_porcentaje": porcentaje_avance,
            "nuevo_avance_total": float(avance_ejecutado_acum * 100),
            "observaciones": observaciones_partida
        }

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al actualizar avance: {str(e)}"
        )

@router.post("/detalle")
async def crear_detalle_avance(
    request: dict,
    db: AsyncSession = Depends(get_db)
):
    """
    ➕ Crear un nuevo detalle de avance en un registro histórico existente.

    Permite agregar una nueva partida a un registro de avance físico existente.
    Al crear el detalle, recalcula automáticamente el avance total acumulado del registro.
    """
    try:
        from app.infrastructure.database.models_seguimiento import DetalleAvancePartida, AvanceFisico
        from sqlalchemy import select, update
        from decimal import Decimal

        # Validar datos de entrada
        avance_fisico_id = request.get('avance_fisico_id')
        codigo_partida = request.get('codigo_partida')
        porcentaje_avance = request.get('porcentaje_avance')
        observaciones_partida = request.get('observaciones_partida')

        if not all([avance_fisico_id, codigo_partida, porcentaje_avance is not None]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="avance_fisico_id, codigo_partida y porcentaje_avance son requeridos"
            )

        if not (0 <= porcentaje_avance <= 100):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="porcentaje_avance debe estar entre 0 y 100"
            )

        # Verificar que el avance físico existe
        stmt_avance = select(AvanceFisico).filter(AvanceFisico.id == avance_fisico_id)
        result_avance = await db.execute(stmt_avance)
        avance_fisico = result_avance.scalar_one_or_none()

        if not avance_fisico:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Registro de avance físico no encontrado"
            )

        # Verificar que la partida no existe ya en este registro
        stmt_existe = select(DetalleAvancePartida).filter(
            and_(
                DetalleAvancePartida.avance_fisico_id == avance_fisico_id,
                DetalleAvancePartida.codigo_partida == codigo_partida
            )
        )
        result_existe = await db.execute(stmt_existe)
        detalle_existente = result_existe.scalar_one_or_none()

        if detalle_existente:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"La partida {codigo_partida} ya existe en este registro"
            )

        # Crear el nuevo detalle
        nuevo_detalle = DetalleAvancePartida(
            avance_fisico_id=avance_fisico_id,
            codigo_partida=codigo_partida,
            porcentaje_avance=Decimal(str(porcentaje_avance / 100)),  # Convertir a decimal (0-1)
            monto_ejecutado=None,  # Se calculará después
            observaciones_partida=observaciones_partida
        )

        db.add(nuevo_detalle)
        await db.flush()  # Para obtener el ID

        # Recalcular el avance total acumulado del registro
        # Obtener todos los detalles de este avance físico (incluyendo el nuevo)
        stmt_detalles = select(DetalleAvancePartida).filter(
            DetalleAvancePartida.avance_fisico_id == avance_fisico_id
        )
        result_detalles = await db.execute(stmt_detalles)
        todos_los_detalles = result_detalles.scalars().all()

        # Obtener información de las partidas para calcular montos
        from app.infrastructure.database.models import PartidaModel
        codigos_partidas = [d.codigo_partida for d in todos_los_detalles]

        stmt_partidas = select(PartidaModel).filter(
            and_(
                PartidaModel.codigo_partida.in_(codigos_partidas),
                PartidaModel.comisaria_id == avance_fisico.comisaria_id
            )
        )
        result_partidas = await db.execute(stmt_partidas)
        partidas_info = {p.codigo_partida: p for p in result_partidas.scalars().all()}

        # Recalcular el avance total acumulado
        total_monto_proyecto = Decimal('0')
        monto_ejecutado_total = Decimal('0')

        for detalle_item in todos_los_detalles:
            partida_info = partidas_info.get(detalle_item.codigo_partida)
            if partida_info and partida_info.precio_total:
                monto_partida = Decimal(str(partida_info.precio_total))
                total_monto_proyecto += monto_partida

                # Calcular monto ejecutado basado en el porcentaje
                porcentaje_decimal = detalle_item.porcentaje_avance  # Ya está en formato 0-1
                monto_ejecutado = monto_partida * porcentaje_decimal
                monto_ejecutado_total += monto_ejecutado

                # Actualizar el monto ejecutado del detalle
                detalle_item.monto_ejecutado = float(monto_ejecutado)

        # Calcular porcentaje total
        if total_monto_proyecto > 0:
            avance_ejecutado_acum = monto_ejecutado_total / total_monto_proyecto
        else:
            avance_ejecutado_acum = Decimal('0')

        # Actualizar el avance físico padre
        stmt_update_avance = update(AvanceFisico).where(
            AvanceFisico.id == avance_fisico_id
        ).values(
            avance_ejecutado_acum=avance_ejecutado_acum
        )

        await db.execute(stmt_update_avance)
        await db.commit()

        return {
            "success": True,
            "mensaje": "Detalle de avance creado exitosamente",
            "detalle_id": nuevo_detalle.id,
            "codigo_partida": codigo_partida,
            "porcentaje_avance": porcentaje_avance,
            "nuevo_avance_total": float(avance_ejecutado_acum * 100),
            "observaciones": observaciones_partida
        }

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al crear detalle de avance: {str(e)}"
        )