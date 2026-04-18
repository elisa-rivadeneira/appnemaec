"""
📊 SCHEMAS - AVANCES FÍSICOS
Schemas Pydantic para el módulo de seguimiento de avances físicos
"""
from pydantic import BaseModel, Field, validator
from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List, Dict
from enum import Enum

class TipoFuenteDatos(str, Enum):
    """Fuente de los datos de avance"""
    MANUAL = "manual"
    EXCEL = "excel"
    SISTEMA = "sistema"

class RegistroAvancePartidaRequest(BaseModel):
    """Schema para registrar avance de una partida específica"""
    codigo_partida: str = Field(..., description="Código de la partida")
    porcentaje_avance_adicional: float = Field(
        ...,
        ge=0,
        le=100,
        description="Porcentaje de avance adicional a sumar"
    )
    observaciones: Optional[str] = Field(None, description="Observaciones del avance")

class RegistroAvanceManualRequest(BaseModel):
    """Schema para registro manual de avances"""
    comisaria_id: int = Field(..., description="ID de la comisaría")
    fecha_reporte: date = Field(..., description="Fecha del reporte de avance")
    semana_proyecto: Optional[int] = Field(None, description="Semana del proyecto")
    dia_semana: Optional[int] = Field(
        None,
        ge=1,
        le=7,
        description="Día de la semana (1=lunes, 7=domingo)"
    )
    partidas_avance: List[RegistroAvancePartidaRequest] = Field(
        ...,
        description="Lista de partidas con avance"
    )
    observaciones_generales: Optional[str] = Field(None, description="Observaciones generales")
    monitor_responsable: Optional[str] = Field(None, description="Monitor responsable")

    @validator('partidas_avance')
    def validate_partidas_no_vacia(cls, v):
        if not v:
            raise ValueError("Debe registrar al menos una partida con avance")
        return v

class InformacionSemanaResponse(BaseModel):
    """Información de la semana actual del proyecto"""
    semana_actual: int = Field(..., description="Número de semana actual")
    dia_actual: int = Field(..., description="Día actual (1=lunes, 7=domingo)")
    fecha_actual: date = Field(..., description="Fecha actual")
    fecha_inicio_proyecto: date = Field(..., description="Fecha de inicio del proyecto")
    dias_transcurridos: int = Field(..., description="Días transcurridos desde inicio")

class PartidaConAvanceResponse(BaseModel):
    """Partida con información de avance actual"""
    id: int
    codigo: str
    descripcion: str
    unidad: Optional[str]
    metrado: float
    precio_unitario: float
    parcial: float
    porcentaje_avance_actual: float = Field(..., description="Avance físico actual (%)")
    porcentaje_programado: float = Field(..., description="Avance programado actual (%)")
    monto_ejecutado: float = Field(..., description="Monto ejecutado")
    es_ejecutable: bool = Field(..., description="Si es una partida ejecutable")
    estado: str

class RegistroAvanceManualResponse(BaseModel):
    """Respuesta del registro de avance manual"""
    avance_fisico_id: int = Field(..., description="ID del avance físico creado")
    comisaria_id: int
    fecha_reporte: date
    semana_proyecto: int
    partidas_actualizadas: int = Field(..., description="Cantidad de partidas actualizadas")
    avance_programado_total: float = Field(..., description="Avance programado total (%)")
    avance_ejecutado_total: float = Field(..., description="Avance ejecutado total (%)")
    diferencia_total: float = Field(..., description="Diferencia total (%)")
    observaciones: Optional[str]
    created_at: datetime

class DetalleAvancePartidaResponse(BaseModel):
    """Detalle de avance de una partida"""
    id: int
    codigo_partida: str
    porcentaje_avance: float
    monto_ejecutado: Optional[float]
    observaciones_partida: Optional[str]
    created_at: datetime

class AvanceFisicoDetalladoResponse(BaseModel):
    """Avance físico con todos sus detalles"""
    id: int
    comisaria_id: int
    fecha_reporte: date
    dias_transcurridos: Optional[int]
    avance_programado_acum: Optional[float]
    avance_ejecutado_acum: float
    archivo_seguimiento: Optional[str]
    observaciones: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    detalles_avances: List[DetalleAvancePartidaResponse]

class HistorialAvancesResponse(BaseModel):
    """Historial de avances de una comisaría"""
    comisaria_id: int
    total_avances: int
    avances: List[AvanceFisicoDetalladoResponse]