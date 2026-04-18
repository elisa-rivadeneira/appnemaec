"""
📊 SERVICIO DE AVANCES FÍSICOS
Lógica de negocio para el registro y seguimiento de avances físicos
"""
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import List, Optional, Dict, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import and_, func, select

from app.infrastructure.database.models_seguimiento import (
    AvanceFisico,
    DetalleAvancePartida
)
from app.infrastructure.database.models import PartidaModel, ComisariaModel
from app.api.schemas.avances_schemas import (
    RegistroAvanceManualRequest,
    RegistroAvanceManualResponse,
    InformacionSemanaResponse,
    PartidaConAvanceResponse,
    AvanceFisicoDetalladoResponse,
    DetalleAvancePartidaResponse
)

class AvancesService:
    """Servicio para gestión de avances físicos"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def obtener_informacion_semana_actual(self, comisaria_id: int) -> InformacionSemanaResponse:
        """
        Obtener información de la semana actual del proyecto.
        Calcula en qué semana estamos basado en la fecha de inicio del proyecto.
        """
        # Buscar la comisaría
        comisaria = self.db.query(ComisariaModel).filter(
            ComisariaModel.id == comisaria_id
        ).first()

        if not comisaria:
            raise ValueError(f"Comisaría con ID {comisaria_id} no encontrada")

        # Obtener fecha de inicio del proyecto desde el primer cronograma
        fecha_inicio = self._obtener_fecha_inicio_proyecto(comisaria_id)

        if not fecha_inicio:
            # Si no hay fecha de inicio, usar fecha de creación de la comisaría
            fecha_inicio = comisaria.created_at.date()

        fecha_actual = date.today()
        dias_transcurridos = (fecha_actual - fecha_inicio).days

        # Calcular semana del proyecto (empezando desde 1)
        semana_actual = max(1, (dias_transcurridos // 7) + 1)

        # Día de la semana (1=lunes, 7=domingo)
        dia_actual = fecha_actual.weekday() + 1

        return InformacionSemanaResponse(
            semana_actual=semana_actual,
            dia_actual=dia_actual,
            fecha_actual=fecha_actual,
            fecha_inicio_proyecto=fecha_inicio,
            dias_transcurridos=dias_transcurridos
        )

    def _obtener_fecha_inicio_proyecto(self, comisaria_id: int) -> Optional[date]:
        """
        Obtener la fecha de inicio del proyecto desde las partidas con fechas.
        """
        # Buscar la fecha de inicio más temprana en las partidas
        partida_inicio = self.db.query(PartidaModel).filter(
            and_(
                PartidaModel.comisaria_id == comisaria_id,
                PartidaModel.fecha_inicio.isnot(None)
            )
        ).order_by(PartidaModel.fecha_inicio.asc()).first()

        return partida_inicio.fecha_inicio if partida_inicio else None

    def obtener_partidas_con_avance(self, comisaria_id: int) -> List[PartidaConAvanceResponse]:
        """
        Obtener todas las partidas ejecutables de la comisaría con su avance actual.
        """
        # Obtener partidas ejecutables (que tienen metrado > 0)
        partidas = self.db.query(PartidaModel).filter(
            and_(
                PartidaModel.comisaria_id == comisaria_id,
                PartidaModel.metrado > 0,
                PartidaModel.tipo == "partida"  # Solo partidas ejecutables
            )
        ).order_by(PartidaModel.codigo).all()

        result = []
        for partida in partidas:
            # Obtener el último avance de esta partida
            ultimo_avance = self._obtener_ultimo_avance_partida(partida.codigo, comisaria_id)

            porcentaje_actual = 0.0
            porcentaje_programado = 0.0

            if ultimo_avance:
                porcentaje_actual = float(ultimo_avance.porcentaje_avance * 100)

            # Calcular avance programado basado en fechas (si las tiene)
            if partida.fecha_inicio and partida.fecha_fin:
                porcentaje_programado = self._calcular_avance_programado_fecha(
                    partida.fecha_inicio, partida.fecha_fin
                )

            result.append(PartidaConAvanceResponse(
                id=partida.id,
                codigo=partida.codigo,
                descripcion=partida.descripcion,
                unidad=partida.unidad,
                metrado=float(partida.metrado),
                precio_unitario=float(partida.precio_unitario),
                parcial=float(partida.parcial),
                porcentaje_avance_actual=porcentaje_actual,
                porcentaje_programado=porcentaje_programado,
                monto_ejecutado=float(partida.parcial * Decimal(str(porcentaje_actual / 100))),
                es_ejecutable=True,
                estado="en_proceso" if porcentaje_actual > 0 else "no_iniciada"
            ))

        return result

    def _obtener_ultimo_avance_partida(self, codigo_partida: str, comisaria_id: int) -> Optional[DetalleAvancePartida]:
        """
        Obtener el último avance registrado de una partida.
        """
        ultimo_avance = self.db.query(DetalleAvancePartida).join(
            AvanceFisico
        ).filter(
            and_(
                AvanceFisico.comisaria_id == comisaria_id,
                DetalleAvancePartida.codigo_partida == codigo_partida
            )
        ).order_by(AvanceFisico.fecha_reporte.desc()).first()

        return ultimo_avance

    def _calcular_avance_programado_fecha(self, fecha_inicio: date, fecha_fin: date) -> float:
        """
        Calcular el avance programado basado en las fechas de la partida.
        """
        fecha_actual = date.today()

        if fecha_actual <= fecha_inicio:
            return 0.0
        elif fecha_actual >= fecha_fin:
            return 100.0
        else:
            # Calcular proporción del tiempo transcurrido
            dias_totales = (fecha_fin - fecha_inicio).days
            dias_transcurridos = (fecha_actual - fecha_inicio).days
            return min(100.0, (dias_transcurridos / dias_totales) * 100)

    def registrar_avance_manual(self, request: RegistroAvanceManualRequest) -> RegistroAvanceManualResponse:
        """
        Registrar avance manual de partidas.
        """
        # Validar que la comisaría existe
        comisaria = self.db.query(ComisariaModel).filter(
            ComisariaModel.id == request.comisaria_id
        ).first()

        if not comisaria:
            raise ValueError(f"Comisaría con ID {request.comisaria_id} no encontrada")

        # Calcular información de semana si no se proporcionó
        if not request.semana_proyecto:
            info_semana = self.obtener_informacion_semana_actual(request.comisaria_id)
            semana_proyecto = info_semana.semana_actual
        else:
            semana_proyecto = request.semana_proyecto

        # Calcular días transcurridos
        fecha_inicio = self._obtener_fecha_inicio_proyecto(request.comisaria_id)
        dias_transcurridos = None
        if fecha_inicio:
            dias_transcurridos = (request.fecha_reporte - fecha_inicio).days

        # Verificar si ya existe un avance para esta fecha
        avance_existente = self.db.query(AvanceFisico).filter(
            and_(
                AvanceFisico.comisaria_id == request.comisaria_id,
                AvanceFisico.fecha_reporte == request.fecha_reporte
            )
        ).first()

        if avance_existente:
            # Actualizar el avance existente
            avance_fisico = avance_existente
            # Eliminar detalles existentes para reemplazarlos
            self.db.query(DetalleAvancePartida).filter(
                DetalleAvancePartida.avance_fisico_id == avance_fisico.id
            ).delete()
        else:
            # Crear nuevo avance físico
            avance_fisico = AvanceFisico(
                comisaria_id=request.comisaria_id,
                fecha_reporte=request.fecha_reporte,
                dias_transcurridos=dias_transcurridos,
                avance_ejecutado_acum=0.0,  # Se calculará después
                observaciones=request.observaciones_generales
            )
            self.db.add(avance_fisico)
            self.db.flush()  # Para obtener el ID

        # Procesar cada partida con avance
        partidas_actualizadas = 0
        for partida_avance in request.partidas_avance:
            # Obtener la partida
            partida = self.db.query(PartidaModel).filter(
                and_(
                    PartidaModel.codigo == partida_avance.codigo_partida,
                    PartidaModel.comisaria_id == request.comisaria_id
                )
            ).first()

            if not partida:
                continue

            # Obtener avance actual de la partida
            avance_actual = 0.0
            ultimo_avance = self._obtener_ultimo_avance_partida(
                partida_avance.codigo_partida,
                request.comisaria_id
            )
            if ultimo_avance and ultimo_avance.avance_fisico.fecha_reporte < request.fecha_reporte:
                avance_actual = float(ultimo_avance.porcentaje_avance * 100)

            # Calcular nuevo avance (actual + adicional)
            nuevo_avance = min(100.0, avance_actual + partida_avance.porcentaje_avance_adicional)

            # Calcular monto ejecutado
            monto_ejecutado = float(partida.parcial * Decimal(str(nuevo_avance / 100)))

            # Crear detalle de avance
            detalle = DetalleAvancePartida(
                avance_fisico_id=avance_fisico.id,
                codigo_partida=partida_avance.codigo_partida,
                porcentaje_avance=Decimal(str(nuevo_avance / 100)),  # Guardar como decimal 0-1
                monto_ejecutado=Decimal(str(monto_ejecutado)),
                observaciones_partida=partida_avance.observaciones
            )
            self.db.add(detalle)
            partidas_actualizadas += 1

        # Calcular avances totales
        avance_total_info = self._calcular_avances_totales(request.comisaria_id, request.fecha_reporte)

        # Actualizar el avance físico con los totales
        avance_fisico.avance_ejecutado_acum = Decimal(str(avance_total_info['avance_ejecutado'] / 100))
        avance_fisico.avance_programado_acum = avance_total_info.get('avance_programado')
        if avance_fisico.avance_programado_acum:
            avance_fisico.avance_programado_acum = Decimal(str(avance_fisico.avance_programado_acum / 100))

        # Guardar cambios
        self.db.commit()

        return RegistroAvanceManualResponse(
            avance_fisico_id=avance_fisico.id,
            comisaria_id=request.comisaria_id,
            fecha_reporte=request.fecha_reporte,
            semana_proyecto=semana_proyecto,
            partidas_actualizadas=partidas_actualizadas,
            avance_programado_total=avance_total_info.get('avance_programado', 0.0),
            avance_ejecutado_total=avance_total_info['avance_ejecutado'],
            diferencia_total=avance_total_info['diferencia'],
            observaciones=request.observaciones_generales,
            created_at=avance_fisico.created_at
        )

    def _calcular_avances_totales(self, comisaria_id: int, fecha_reporte: date) -> Dict[str, float]:
        """
        Calcular los avances totales de una comisaría a una fecha específica.
        """
        # Obtener todas las partidas ejecutables
        partidas = self.db.query(PartidaModel).filter(
            and_(
                PartidaModel.comisaria_id == comisaria_id,
                PartidaModel.metrado > 0,
                PartidaModel.tipo == "partida"
            )
        ).all()

        if not partidas:
            return {
                'avance_ejecutado': 0.0,
                'avance_programado': 0.0,
                'diferencia': 0.0
            }

        total_presupuesto = sum(float(p.parcial) for p in partidas)
        monto_ejecutado_total = 0.0
        monto_programado_total = 0.0

        for partida in partidas:
            # Obtener avance ejecutado
            ultimo_avance = self._obtener_ultimo_avance_partida_fecha(
                partida.codigo, comisaria_id, fecha_reporte
            )

            if ultimo_avance:
                porcentaje_ejecutado = float(ultimo_avance.porcentaje_avance * 100)
                monto_ejecutado_total += float(partida.parcial * Decimal(str(porcentaje_ejecutado / 100)))

            # Calcular avance programado si tiene fechas
            if partida.fecha_inicio and partida.fecha_fin:
                porcentaje_programado = self._calcular_avance_programado_fecha_especifica(
                    partida.fecha_inicio, partida.fecha_fin, fecha_reporte
                )
                monto_programado_total += float(partida.parcial * Decimal(str(porcentaje_programado / 100)))

        avance_ejecutado = (monto_ejecutado_total / total_presupuesto * 100) if total_presupuesto > 0 else 0.0
        avance_programado = (monto_programado_total / total_presupuesto * 100) if total_presupuesto > 0 else 0.0
        diferencia = avance_ejecutado - avance_programado

        return {
            'avance_ejecutado': avance_ejecutado,
            'avance_programado': avance_programado,
            'diferencia': diferencia
        }

    def _obtener_ultimo_avance_partida_fecha(self, codigo_partida: str, comisaria_id: int, fecha_limite: date) -> Optional[DetalleAvancePartida]:
        """
        Obtener el último avance de una partida hasta una fecha específica.
        """
        ultimo_avance = self.db.query(DetalleAvancePartida).join(
            AvanceFisico
        ).filter(
            and_(
                AvanceFisico.comisaria_id == comisaria_id,
                DetalleAvancePartida.codigo_partida == codigo_partida,
                AvanceFisico.fecha_reporte <= fecha_limite
            )
        ).order_by(AvanceFisico.fecha_reporte.desc()).first()

        return ultimo_avance

    def _calcular_avance_programado_fecha_especifica(self, fecha_inicio: date, fecha_fin: date, fecha_referencia: date) -> float:
        """
        Calcular el avance programado a una fecha específica.
        """
        if fecha_referencia <= fecha_inicio:
            return 0.0
        elif fecha_referencia >= fecha_fin:
            return 100.0
        else:
            dias_totales = (fecha_fin - fecha_inicio).days
            dias_transcurridos = (fecha_referencia - fecha_inicio).days
            return min(100.0, (dias_transcurridos / dias_totales) * 100)