"""
🏗️ PARTIDA - Domain Entity
Entidad de dominio que representa las partidas de obra.
Base para el sistema de seguimiento crítico de avances.
"""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum
from decimal import Decimal


class TipoPartida(str, Enum):
    """Tipos de partida según estructura de obra"""
    TITULO = "titulo"  # Título principal (ej: "01 OBRAS PROVISIONALES")
    SUBTITULO = "subtitulo"  # Subtítulo (ej: "01.01 Trabajos Provisionales")
    PARTIDA = "partida"  # Partida ejecutable (ej: "01.01.01 Alquiler de Almacén")


class EstadoPartida(str, Enum):
    """Estados de ejecución de la partida"""
    NO_INICIADA = "no_iniciada"
    EN_PROCESO = "en_proceso"
    COMPLETADA = "completada"
    SUSPENDIDA = "suspendida"
    OBSERVADA = "observada"


class CriticidadPartida(str, Enum):
    """Niveles de criticidad según diferencia de avance"""
    NORMAL = "normal"  # Diferencia 0-3%
    ATENCION = "atencion"  # Diferencia 3-5%
    CRITICA = "critica"  # Diferencia >5%


@dataclass
class AvancePartida:
    """Value Object para registrar avances de partida"""
    fecha_reporte: datetime
    avance_programado: float  # Porcentaje programado a esta fecha
    avance_fisico: float  # Porcentaje real ejecutado
    observaciones: Optional[str] = None
    monitor_responsable: Optional[str] = None
    fuente_datos: str = "manual"  # "excel", "manual", "sistema"

    def calcular_diferencia(self) -> float:
        """
        Calcular diferencia entre avance físico y programado.

        Returns:
            float: Diferencia (físico - programado)
        """
        return self.avance_fisico - self.avance_programado

    def es_critico(self, umbral_critico: float = 5.0) -> bool:
        """
        Verificar si el avance está en estado crítico.

        Args:
            umbral_critico: Umbral de diferencia para considerar crítico

        Returns:
            bool: True si la diferencia absoluta supera el umbral
        """
        return abs(self.calcular_diferencia()) > umbral_critico

    def get_criticidad(self) -> CriticidadPartida:
        """
        Obtener nivel de criticidad basado en la diferencia.

        Returns:
            CriticidadPartida: Nivel de criticidad
        """
        diferencia_abs = abs(self.calcular_diferencia())

        if diferencia_abs <= 3.0:
            return CriticidadPartida.NORMAL
        elif diferencia_abs <= 5.0:
            return CriticidadPartida.ATENCION
        else:
            return CriticidadPartida.CRITICA


@dataclass
class Partida:
    """
    Entidad de dominio Partida.
    Representa las partidas de obra con seguimiento de avance crítico.
    """
    # Campos requeridos primero
    id: Optional[int]
    nid: int  # NID del Excel original
    codigo: str  # Código jerárquico (ej: "01.01.01")
    descripcion: str
    tipo: TipoPartida
    comisaria_id: int

    # Información técnica con valores por defecto
    unidad: Optional[str] = None  # "m2", "ml", "glb", etc.
    metrado: Decimal = Decimal('0.00')
    precio_unitario: Decimal = Decimal('0.00')
    parcial: Decimal = Decimal('0.00')  # metrado * precio_unitario

    # Relación opcional
    contrato_id: Optional[int] = None

    # Estado actual
    estado: EstadoPartida = EstadoPartida.NO_INICIADA

    # Fechas de planificación
    fecha_inicio: Optional[datetime] = None
    fecha_termino: Optional[datetime] = None

    # Avances históricos
    avances: List[AvancePartida] = field(default_factory=list)

    # Jerarquía (para partidas tipo TITULO/SUBTITULO)
    partidas_hijas: List['Partida'] = field(default_factory=list)
    partida_padre_id: Optional[int] = None

    # Auditoría
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: Optional[datetime] = None

    def __post_init__(self):
        """Validaciones de integridad"""
        if not self.codigo:
            raise ValueError("Código de partida es requerido")

        if not self.descripcion:
            raise ValueError("Descripción de partida es requerida")

        if self.metrado < 0:
            raise ValueError("Metrado no puede ser negativo")

        # Validar formato de código jerárquico
        if not self._validar_codigo_jerarquico():
            raise ValueError(f"Código {self.codigo} no tiene formato válido")

    def _validar_codigo_jerarquico(self) -> bool:
        """
        Validar que el código siga formato jerárquico.
        Ejemplos válidos: "01", "01.01", "01.01.01"
        """
        import re
        patron = r'^(\d{2})(\.\d{2})*$'
        return bool(re.match(patron, self.codigo))

    def get_nivel_jerarquico(self) -> int:
        """
        Obtener nivel jerárquico basado en el código.

        Returns:
            int: Nivel (1 para "01", 2 para "01.01", etc.)
        """
        return len(self.codigo.split('.'))

    def get_codigo_padre(self) -> Optional[str]:
        """
        Obtener código de la partida padre.

        Returns:
            Optional[str]: Código del padre o None si es nivel 1
        """
        partes = self.codigo.split('.')
        if len(partes) <= 1:
            return None

        return '.'.join(partes[:-1])

    def es_partida_ejecutable(self) -> bool:
        """
        Verificar si es una partida ejecutable (tiene metrado y precio).

        Returns:
            bool: True si es ejecutable
        """
        return self.tipo == TipoPartida.PARTIDA and self.metrado > 0

    def get_ultimo_avance(self) -> Optional[AvancePartida]:
        """
        Obtener el último avance registrado.

        Returns:
            Optional[AvancePartida]: Último avance o None si no hay
        """
        if not self.avances:
            return None

        return max(self.avances, key=lambda a: a.fecha_reporte)

    def get_avance_actual(self) -> float:
        """
        Obtener porcentaje de avance físico actual.

        Returns:
            float: Porcentaje de avance (0-100)
        """
        ultimo_avance = self.get_ultimo_avance()
        return ultimo_avance.avance_fisico if ultimo_avance else 0.0

    def get_avance_programado_actual(self) -> float:
        """
        Obtener porcentaje de avance programado actual.

        Returns:
            float: Porcentaje programado (0-100)
        """
        ultimo_avance = self.get_ultimo_avance()
        return ultimo_avance.avance_programado if ultimo_avance else 0.0

    def calcular_diferencia_actual(self) -> float:
        """
        Calcular diferencia actual entre avance físico y programado.

        Returns:
            float: Diferencia (físico - programado)
        """
        ultimo_avance = self.get_ultimo_avance()
        if not ultimo_avance:
            return 0.0

        return ultimo_avance.calcular_diferencia()

    def get_criticidad_actual(self) -> CriticidadPartida:
        """
        Obtener nivel de criticidad actual.

        Returns:
            CriticidadPartida: Nivel de criticidad
        """
        ultimo_avance = self.get_ultimo_avance()
        if not ultimo_avance:
            return CriticidadPartida.NORMAL

        return ultimo_avance.get_criticidad()

    def esta_critica(self) -> bool:
        """
        Verificar si la partida está en estado crítico.

        Returns:
            bool: True si está crítica
        """
        return self.get_criticidad_actual() == CriticidadPartida.CRITICA

    def registrar_avance(
        self,
        avance_programado: float,
        avance_fisico: float,
        observaciones: Optional[str] = None,
        monitor_responsable: Optional[str] = None,
        fuente_datos: str = "manual"
    ) -> None:
        """
        Registrar nuevo avance de la partida.

        Args:
            avance_programado: Porcentaje programado (0-100)
            avance_fisico: Porcentaje físico ejecutado (0-100)
            observaciones: Observaciones opcionales
            monitor_responsable: Monitor que reporta
            fuente_datos: Fuente del dato (excel, manual, sistema)
        """
        # Validaciones
        if not (0 <= avance_programado <= 100):
            raise ValueError("Avance programado debe estar entre 0 y 100")

        if not (0 <= avance_fisico <= 100):
            raise ValueError("Avance físico debe estar entre 0 y 100")

        nuevo_avance = AvancePartida(
            fecha_reporte=datetime.now(),
            avance_programado=avance_programado,
            avance_fisico=avance_fisico,
            observaciones=observaciones,
            monitor_responsable=monitor_responsable,
            fuente_datos=fuente_datos
        )

        self.avances.append(nuevo_avance)
        self.updated_at = datetime.now()

        # Actualizar estado automáticamente
        if avance_fisico >= 100:
            self.estado = EstadoPartida.COMPLETADA
        elif avance_fisico > 0:
            self.estado = EstadoPartida.EN_PROCESO
        else:
            self.estado = EstadoPartida.NO_INICIADA

    def calcular_monto_ejecutado(self) -> Decimal:
        """
        Calcular monto ejecutado basado en avance físico.

        Returns:
            Decimal: Monto ejecutado
        """
        if not self.es_partida_ejecutable():
            return Decimal('0.00')

        avance = self.get_avance_actual()
        return self.parcial * Decimal(str(avance / 100))

    def get_tendencia_avance(self) -> str:
        """
        Analizar tendencia de avance en los últimos registros.

        Returns:
            str: "mejorando", "empeorando", "estable", "sin_datos"
        """
        if len(self.avances) < 2:
            return "sin_datos"

        # Comparar últimos dos avances
        avances_ordenados = sorted(self.avances, key=lambda a: a.fecha_reporte)
        ultimo = avances_ordenados[-1]
        penultimo = avances_ordenados[-2]

        diferencia_actual = ultimo.calcular_diferencia()
        diferencia_anterior = penultimo.calcular_diferencia()

        if abs(diferencia_actual) < abs(diferencia_anterior):
            return "mejorando"
        elif abs(diferencia_actual) > abs(diferencia_anterior):
            return "empeorando"
        else:
            return "estable"

    def to_dict(self) -> Dict[str, Any]:
        """
        Convertir entidad a diccionario para serialización.

        Returns:
            Dict[str, Any]: Representación en diccionario
        """
        ultimo_avance = self.get_ultimo_avance()

        return {
            "id": self.id,
            "nid": self.nid,
            "codigo": self.codigo,
            "descripcion": self.descripcion,
            "tipo": self.tipo.value,
            "unidad": self.unidad,
            "metrado": float(self.metrado),
            "precio_unitario": float(self.precio_unitario),
            "parcial": float(self.parcial),
            "comisaria_id": self.comisaria_id,
            "estado": self.estado.value,
            "nivel_jerarquico": self.get_nivel_jerarquico(),
            "es_ejecutable": self.es_partida_ejecutable(),
            "avance_actual": self.get_avance_actual(),
            "avance_programado": self.get_avance_programado_actual(),
            "diferencia": self.calcular_diferencia_actual(),
            "criticidad": self.get_criticidad_actual().value,
            "monto_ejecutado": float(self.calcular_monto_ejecutado()),
            "tendencia": self.get_tendencia_avance(),
            "total_avances": len(self.avances),
            "ultimo_reporte": ultimo_avance.fecha_reporte.isoformat() if ultimo_avance else None,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }