"""
🗄️ MODELOS DE BASE DE DATOS - SEGUIMIENTO DE AVANCES FÍSICOS
SQLAlchemy models para el módulo de seguimiento de avances físicos
"""

from sqlalchemy import Column, Integer, String, Decimal, Date, DateTime, Text, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.infrastructure.database.base import Base

class AvanceFisico(Base):
    """
    📊 Punto de seguimiento de avance físico de una comisaría

    Representa un corte de avance en una fecha específica.
    Puede actualizarse múltiples veces en el mismo día.
    """
    __tablename__ = "avances_fisicos"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # Relación con comisaría
    comisaria_id = Column(Integer, ForeignKey("comisarias.id"), nullable=False)

    # Información temporal
    fecha_reporte = Column(Date, nullable=False,
                          comment="Fecha del reporte de avance (puede actualizarse)")
    dias_transcurridos = Column(Integer, nullable=True,
                               comment="Días desde inicio de obra")

    # Avances globales
    avance_programado_acum = Column(Decimal(5, 4), nullable=True,
                                   comment="Avance programado acumulado (0.0-1.0)")
    avance_ejecutado_acum = Column(Decimal(5, 4), nullable=False,
                                  comment="Avance real ejecutado acumulado (0.0-1.0)")

    # Información del reporte
    archivo_seguimiento = Column(String(255), nullable=True,
                                comment="Nombre del archivo Excel importado")
    observaciones = Column(Text, nullable=True,
                          comment="Observaciones del avance")

    # Auditoría
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relaciones
    comisaria = relationship("Comisaria", back_populates="avances_fisicos")
    detalles_avances = relationship("DetalleAvancePartida",
                                   back_populates="avance_fisico",
                                   cascade="all, delete-orphan")

    # Índice único: una comisaría puede tener solo un reporte por fecha
    __table_args__ = (
        UniqueConstraint('comisaria_id', 'fecha_reporte',
                        name='uq_comisaria_fecha_reporte'),
    )

    def __repr__(self):
        return (f"<AvanceFisico(id={self.id}, comisaria_id={self.comisaria_id}, "
                f"fecha={self.fecha_reporte}, avance={self.avance_ejecutado_acum})>")

class DetalleAvancePartida(Base):
    """
    🔧 Detalle de avance por partida específica

    Almacena el porcentaje de avance de cada partida
    en un punto de seguimiento específico.
    """
    __tablename__ = "detalle_avances_partidas"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # Relación con avance físico
    avance_fisico_id = Column(Integer, ForeignKey("avances_fisicos.id"), nullable=False)

    # Identificación de partida
    codigo_partida = Column(String(50), nullable=False,
                           comment="Código de partida (ej: 01.01.02)")

    # Avance de la partida
    porcentaje_avance = Column(Decimal(5, 4), nullable=False,
                              comment="Porcentaje de avance (0.0-1.0)")
    monto_ejecutado = Column(Decimal(12, 2), nullable=True,
                            comment="Monto ejecutado calculado automáticamente")

    # Información adicional
    observaciones_partida = Column(Text, nullable=True,
                                  comment="Observaciones específicas de la partida")

    # Auditoría
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relaciones
    avance_fisico = relationship("AvanceFisico", back_populates="detalles_avances")

    def __repr__(self):
        return (f"<DetalleAvancePartida(id={self.id}, "
                f"codigo={self.codigo_partida}, avance={self.porcentaje_avance})>")

class AlertaAvance(Base):
    """
    🚨 Alertas automáticas de seguimiento

    Almacena alertas generadas automáticamente cuando se detectan
    retrasos, adelantos o problemas en los avances.
    """
    __tablename__ = "alertas_avances"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # Relación con comisaría y avance
    comisaria_id = Column(Integer, ForeignKey("comisarias.id"), nullable=False)
    avance_fisico_id = Column(Integer, ForeignKey("avances_fisicos.id"), nullable=True)

    # Información de la alerta
    tipo_alerta = Column(String(50), nullable=False,
                        comment="tipo: retraso, adelanto, partida_critica, etc.")
    severidad = Column(String(20), nullable=False,
                      comment="baja, media, alta, critica")

    titulo = Column(String(200), nullable=False,
                   comment="Título de la alerta")
    descripcion = Column(Text, nullable=False,
                        comment="Descripción detallada de la alerta")

    # Estado de la alerta
    estado = Column(String(20), default="activa", nullable=False,
                   comment="activa, vista, resuelta, ignorada")

    # Información contextual
    dias_retraso = Column(Integer, nullable=True,
                         comment="Días de retraso detectados (si aplica)")
    porcentaje_diferencia = Column(Decimal(5, 4), nullable=True,
                                  comment="Diferencia % vs programado")

    # Auditoría
    created_at = Column(DateTime, default=func.now(), nullable=False)
    resuelta_at = Column(DateTime, nullable=True)

    # Relaciones
    comisaria = relationship("Comisaria")
    avance_fisico = relationship("AvanceFisico")

    def __repr__(self):
        return (f"<AlertaAvance(id={self.id}, tipo={self.tipo_alerta}, "
                f"severidad={self.severidad}, estado={self.estado})>")

# Agregar relaciones al modelo Comisaria existente
def extend_comisaria_model():
    """
    Extiende el modelo Comisaria existente con relaciones de seguimiento
    """
    try:
        from app.infrastructure.database.models import Comisaria

        # Agregar relación de avances físicos
        if not hasattr(Comisaria, 'avances_fisicos'):
            Comisaria.avances_fisicos = relationship("AvanceFisico",
                                                    back_populates="comisaria",
                                                    cascade="all, delete-orphan")

        print("✅ Relaciones de seguimiento agregadas al modelo Comisaria")

    except ImportError as e:
        print(f"⚠️ No se pudo extender modelo Comisaria: {e}")

# Llamar la función de extensión
extend_comisaria_model()