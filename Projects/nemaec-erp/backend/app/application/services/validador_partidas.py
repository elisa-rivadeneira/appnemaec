"""
🛡️ VALIDADOR DE PARTIDAS - NEMAEC ERP
Valida que las partidas del Excel de avances coincidan exactamente con la BD
"""

import hashlib
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass
from datetime import datetime

@dataclass
class PartidaExcel:
    codigo: str
    descripcion: str
    porcentaje_avance: float

    @property
    def avance_ejecutado(self) -> float:
        """Alias para compatibilidad"""
        return self.porcentaje_avance

@dataclass
class PartidaDB:
    codigo: str
    descripcion: str
    precio_total: float
    descripcion_hash: str
    fecha_modificacion: datetime

@dataclass
class DiferenciaPartida:
    codigo: str
    tipo_diferencia: str  # 'no_existe', 'descripcion_cambio', 'nueva_partida'
    descripcion_excel: str
    descripcion_db: Optional[str]
    sugerencia: str

class ValidadorPartidas:
    """Validador estricto de partidas antes de actualizar avances"""

    @staticmethod
    def normalizar_codigo_partida(codigo: str) -> str:
        """
        Normaliza códigos de partida para comparación flexible

        Ejemplos:
        - "1" -> "01"
        - "1.01" -> "01.01"
        - "4.1" -> "04.10"
        - "01.01" -> "01.01" (ya normalizado)
        """
        if not codigo or codigo.strip() == "":
            return ""

        codigo = codigo.strip()

        # Dividir por puntos para procesar cada parte
        partes = codigo.split('.')
        partes_normalizadas = []

        for parte in partes:
            # Convertir a número y luego a string con padding
            try:
                numero = int(parte)
                # Usar 2 dígitos mínimo para cada parte
                parte_normalizada = f"{numero:02d}"
                partes_normalizadas.append(parte_normalizada)
            except ValueError:
                # Si no es un número, mantener como está
                partes_normalizadas.append(parte)

        return '.'.join(partes_normalizadas)

    @staticmethod
    def generar_hash_descripcion(descripcion: str) -> str:
        """
        Genera hash de la descripción para comparación flexible
        - Convierte a mayúsculas
        - Elimina espacios extra
        - Normaliza caracteres especiales
        """
        if not descripcion:
            return ""

        # Normalizar descripción
        desc_normalizada = descripcion.strip().upper()
        # Eliminar espacios dobles
        desc_normalizada = ' '.join(desc_normalizada.split())
        # Remover caracteres especiales comunes que pueden variar
        desc_normalizada = desc_normalizada.replace('´', "'").replace('`', "'")

        return hashlib.sha256(desc_normalizada.encode()).hexdigest()

    @classmethod
    def validar_partidas_excel_vs_db(
        cls,
        partidas_excel: List[PartidaExcel],
        partidas_db: List[PartidaDB],
        comisaria_id: int
    ) -> Tuple[bool, List[DiferenciaPartida]]:
        """
        Valida que las partidas del Excel coincidan EXACTAMENTE con la BD

        Returns:
            (es_valido: bool, diferencias: List[DiferenciaPartida])
        """
        diferencias = []

        # Crear mapas para búsqueda rápida con códigos normalizados
        partidas_db_map = {cls.normalizar_codigo_partida(p.codigo): p for p in partidas_db}
        codigos_excel = {cls.normalizar_codigo_partida(p.codigo) for p in partidas_excel}
        codigos_db = {cls.normalizar_codigo_partida(p.codigo) for p in partidas_db}

        # También mantener un mapeo de código normalizado -> código original para mensajes
        codigos_originales_db = {cls.normalizar_codigo_partida(p.codigo): p.codigo for p in partidas_db}
        codigos_originales_excel = {cls.normalizar_codigo_partida(p.codigo): p.codigo for p in partidas_excel}

        # 1. Verificar partidas que están en Excel pero no en BD
        for partida_excel in partidas_excel:
            codigo_normalizado = cls.normalizar_codigo_partida(partida_excel.codigo)

            if codigo_normalizado not in partidas_db_map:
                diferencias.append(DiferenciaPartida(
                    codigo=partida_excel.codigo,  # Usar código original del Excel
                    tipo_diferencia='no_existe',
                    descripcion_excel=partida_excel.descripcion,
                    descripcion_db=None,
                    sugerencia=f"Partida {partida_excel.codigo} (normalizado: {codigo_normalizado}) no existe en BD. ¿Es una partida nueva?"
                ))
                continue

            # 2. Verificar que la descripción coincida (case-insensitive y normalizada)
            partida_db = partidas_db_map[codigo_normalizado]

            # Normalizar ambas descripciones para comparación
            desc_excel_norm = partida_excel.descripcion.strip().upper()
            desc_excel_norm = ' '.join(desc_excel_norm.split())
            desc_excel_norm = desc_excel_norm.replace('´', "'").replace('`', "'")

            desc_bd_norm = partida_db.descripcion.strip().upper()
            desc_bd_norm = ' '.join(desc_bd_norm.split())
            desc_bd_norm = desc_bd_norm.replace('´', "'").replace('`', "'")

            if desc_excel_norm != desc_bd_norm:
                diferencias.append(DiferenciaPartida(
                    codigo=partida_excel.codigo,  # Usar código original del Excel
                    tipo_diferencia='descripcion_cambio',
                    descripcion_excel=partida_excel.descripcion,
                    descripcion_db=partida_db.descripcion,
                    sugerencia=(
                        f"Descripción de {partida_excel.codigo} ha cambiado. "
                        f"Excel: '{partida_excel.descripcion}' vs BD: '{partida_db.descripcion}'"
                    )
                ))

        # 3. Verificar si hay partidas nuevas en BD que no están en Excel
        partidas_solo_db = codigos_db - codigos_excel
        for codigo_normalizado in partidas_solo_db:
            partida_db = partidas_db_map[codigo_normalizado]
            codigo_original_db = codigos_originales_db[codigo_normalizado]
            diferencias.append(DiferenciaPartida(
                codigo=codigo_original_db,  # Usar código original de la BD
                tipo_diferencia='nueva_partida',
                descripcion_excel="[NO PRESENTE EN EXCEL]",
                descripcion_db=partida_db.descripcion,
                sugerencia=f"Partida {codigo_original_db} existe en BD pero no en Excel de avances"
            ))

        es_valido = len(diferencias) == 0
        return es_valido, diferencias

    @classmethod
    def generar_reporte_diferencias(
        cls,
        diferencias: List[DiferenciaPartida]
    ) -> str:
        """Genera reporte legible de diferencias encontradas"""

        if not diferencias:
            return "✅ Todas las partidas coinciden perfectamente"

        reporte = "⚠️ DIFERENCIAS ENCONTRADAS EN PARTIDAS:\n"
        reporte += "=" * 60 + "\n\n"

        for i, diff in enumerate(diferencias, 1):
            reporte += f"{i}. CÓDIGO: {diff.codigo}\n"
            reporte += f"   TIPO: {diff.tipo_diferencia.upper()}\n"

            if diff.tipo_diferencia == 'no_existe':
                reporte += f"   EXCEL: {diff.descripcion_excel}\n"
                reporte += f"   BD: [NO EXISTE]\n"

            elif diff.tipo_diferencia == 'descripcion_cambio':
                reporte += f"   EXCEL: {diff.descripcion_excel}\n"
                reporte += f"   BD:    {diff.descripcion_db}\n"
                reporte += "   ❌ DESCRIPCIONES NO COINCIDEN\n"

            elif diff.tipo_diferencia == 'nueva_partida':
                reporte += f"   EXCEL: [NO PRESENTE]\n"
                reporte += f"   BD:    {diff.descripcion_db}\n"

            reporte += f"   💡 {diff.sugerencia}\n\n"

        reporte += "🚨 ACCIÓN REQUERIDA:\n"
        reporte += "1. Actualizar cronograma con las partidas correctas\n"
        reporte += "2. Verificar que todas las partidas coincidan\n"
        reporte += "3. Intentar subir avances nuevamente\n"

        return reporte

    @classmethod
    def validar_y_generar_reporte(
        cls,
        partidas_excel: List[PartidaExcel],
        partidas_db: List[PartidaDB],
        comisaria_id: int
    ) -> Tuple[bool, str]:
        """
        Valida partidas y genera reporte completo

        Returns:
            (es_valido: bool, reporte: str)
        """
        es_valido, diferencias = cls.validar_partidas_excel_vs_db(
            partidas_excel, partidas_db, comisaria_id
        )

        reporte = cls.generar_reporte_diferencias(diferencias)

        return es_valido, reporte

# Ejemplo de uso
if __name__ == "__main__":
    # Simular datos de prueba
    partidas_excel = [
        PartidaExcel("01.01", "TANQUE DE AGUA", 0.5),  # Cambió de "CAMBIAR TECHO COCINA"
        PartidaExcel("01.02", "MOVILIZACION EQUIPOS", 1.0),
    ]

    partidas_db = [
        PartidaDB(
            codigo="01.01",
            descripcion="CAMBIAR TECHO DE COCINA",  # Original en BD
            precio_total=5000.0,
            descripcion_hash=ValidadorPartidas.generar_hash_descripcion("CAMBIAR TECHO DE COCINA"),
            fecha_modificacion=datetime.now()
        ),
        PartidaDB(
            codigo="01.02",
            descripcion="MOVILIZACION EQUIPOS",
            precio_total=1500.0,
            descripcion_hash=ValidadorPartidas.generar_hash_descripcion("MOVILIZACION EQUIPOS"),
            fecha_modificacion=datetime.now()
        )
    ]

    # Validar
    es_valido, reporte = ValidadorPartidas.validar_y_generar_reporte(
        partidas_excel, partidas_db, comisaria_id=1
    )

    print(f"¿Es válido? {es_valido}")
    print(reporte)