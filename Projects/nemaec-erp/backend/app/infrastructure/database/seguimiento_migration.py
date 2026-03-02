"""
🗄️ MIGRACIÓN RÁPIDA - TABLAS DE SEGUIMIENTO
Crear tablas directamente en el servidor activo
"""

import sqlite3
import os
from app.core.config import settings

def create_seguimiento_tables():
    """Crear tablas de seguimiento en SQLite directamente"""

    print("🗄️ CREANDO TABLAS DE SEGUIMIENTO")
    print("=" * 40)

    # Obtener ruta de la BD
    db_path = settings.database_url.replace("sqlite+aiosqlite:///", "")
    print(f"📍 Base de datos: {db_path}")

    if not os.path.exists(db_path):
        print(f"❌ Base de datos no encontrada: {db_path}")
        return False

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # 1. Tabla de avances físicos
        print("📊 Creando tabla: avances_fisicos")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS avances_fisicos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                comisaria_id INTEGER NOT NULL,
                fecha_reporte DATE NOT NULL,
                dias_transcurridos INTEGER,
                avance_programado_acum DECIMAL(5,4),
                avance_ejecutado_acum DECIMAL(5,4) NOT NULL,
                archivo_seguimiento VARCHAR(255),
                observaciones TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (comisaria_id) REFERENCES comisarias(id),
                UNIQUE(comisaria_id, fecha_reporte)
            );
        """)

        # 2. Tabla de detalles de avance por partida
        print("🔧 Creando tabla: detalle_avances_partidas")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS detalle_avances_partidas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                avance_fisico_id INTEGER NOT NULL,
                codigo_partida VARCHAR(50) NOT NULL,
                porcentaje_avance DECIMAL(5,4) NOT NULL,
                monto_ejecutado DECIMAL(12,2),
                observaciones_partida TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (avance_fisico_id) REFERENCES avances_fisicos(id)
            );
        """)

        # 3. Tabla de alertas
        print("🚨 Creando tabla: alertas_avances")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS alertas_avances (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                comisaria_id INTEGER NOT NULL,
                avance_fisico_id INTEGER,
                tipo_alerta VARCHAR(50) NOT NULL,
                severidad VARCHAR(20) NOT NULL,
                titulo VARCHAR(200) NOT NULL,
                descripcion TEXT NOT NULL,
                estado VARCHAR(20) DEFAULT 'activa',
                dias_retraso INTEGER,
                porcentaje_diferencia DECIMAL(5,4),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                resuelta_at DATETIME,
                FOREIGN KEY (comisaria_id) REFERENCES comisarias(id),
                FOREIGN KEY (avance_fisico_id) REFERENCES avances_fisicos(id)
            );
        """)

        # 4. Índices para mejor rendimiento
        print("📈 Creando índices")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_avances_comisaria ON avances_fisicos(comisaria_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_avances_fecha ON avances_fisicos(fecha_reporte);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_detalle_avance ON detalle_avances_partidas(avance_fisico_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_alertas_comisaria ON alertas_avances(comisaria_id);")

        conn.commit()

        # Verificar tablas creadas
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%avances%';")
        tablas_creadas = cursor.fetchall()

        print(f"\n✅ TABLAS CREADAS ({len(tablas_creadas)}):")
        for (tabla,) in tablas_creadas:
            print(f"   ✓ {tabla}")

        conn.close()

        print(f"\n🎉 MIGRACIÓN COMPLETADA EXITOSAMENTE")
        return True

    except Exception as e:
        print(f"❌ Error creando tablas: {str(e)}")
        return False

if __name__ == "__main__":
    success = create_seguimiento_tables()
    if success:
        print("🔄 Reinicia el servidor para ver los cambios")
    else:
        print("❌ Migración fallida")