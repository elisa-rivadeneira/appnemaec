#!/usr/bin/env python3
"""
🗄️ MIGRACIÓN - CREAR TABLAS DE SEGUIMIENTO DE AVANCES
Script para crear las nuevas tablas de seguimiento en SQLite
"""

import asyncio
import sys
import os

# Agregar el directorio backend al path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.config import settings
from app.core.database import Base
from app.infrastructure.database.models import *  # Modelos existentes
from app.infrastructure.database.models_seguimiento import *  # Nuevos modelos
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import create_async_engine

async def create_seguimiento_tables():
    """Crear las nuevas tablas de seguimiento"""

    print("🗄️ CREANDO TABLAS DE SEGUIMIENTO DE AVANCES")
    print("=" * 50)

    # Usar la configuración existente
    database_url = settings.database_url
    print(f"📍 Database URL: {database_url}")

    try:
        # Para SQLite, usar engine síncrono para crear tablas
        if database_url.startswith("sqlite"):
            sync_url = database_url.replace("sqlite+aiosqlite://", "sqlite://")
            engine = create_engine(sync_url)

            print("🔧 Creando tablas de seguimiento...")

            # Crear todas las tablas (incluyendo las nuevas)
            Base.metadata.create_all(bind=engine)

            print("✅ Tablas de seguimiento creadas exitosamente")

            # Verificar tablas creadas
            from sqlalchemy import inspect
            inspector = inspect(engine)
            tables = inspector.get_table_names()

            print(f"\n📋 TABLAS EXISTENTES ({len(tables)}):")
            for table in sorted(tables):
                print(f"   ✓ {table}")

            # Verificar específicamente las nuevas tablas
            seguimiento_tables = [
                'avances_fisicos',
                'detalle_avances_partidas',
                'alertas_avances'
            ]

            print(f"\n🎯 TABLAS DE SEGUIMIENTO:")
            for table in seguimiento_tables:
                if table in tables:
                    print(f"   ✅ {table}")

                    # Mostrar columnas de la tabla
                    columns = inspector.get_columns(table)
                    print(f"      Columnas ({len(columns)}):")
                    for col in columns[:5]:  # Mostrar solo las primeras 5
                        print(f"         - {col['name']} ({col['type']})")
                    if len(columns) > 5:
                        print(f"         ... y {len(columns) - 5} más")
                else:
                    print(f"   ❌ {table} - NO CREADA")

            engine.dispose()

        else:
            # Para PostgreSQL u otras BD
            async_engine = create_async_engine(database_url)

            async with async_engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)

            print("✅ Tablas de seguimiento creadas exitosamente")
            await async_engine.dispose()

    except Exception as e:
        print(f"❌ Error creando tablas: {str(e)}")
        return False

    return True

async def test_seguimiento_models():
    """Probar que los modelos funcionen correctamente"""

    print(f"\n🧪 PROBANDO MODELOS DE SEGUIMIENTO")
    print("=" * 40)

    try:
        from app.infrastructure.database.models_seguimiento import (
            AvanceFisico, DetalleAvancePartida, AlertaAvance
        )

        # Verificar que las clases se carguen correctamente
        print(f"✅ AvanceFisico: {AvanceFisico.__tablename__}")
        print(f"✅ DetalleAvancePartida: {DetalleAvancePartida.__tablename__}")
        print(f"✅ AlertaAvance: {AlertaAvance.__tablename__}")

        # Verificar relaciones
        print(f"\n🔗 RELACIONES:")
        if hasattr(AvanceFisico, 'detalles_avances'):
            print(f"   ✅ AvanceFisico -> DetalleAvancePartida")

        if hasattr(AvanceFisico, 'comisaria'):
            print(f"   ✅ AvanceFisico -> Comisaria")

        print(f"✅ Modelos de seguimiento validados correctamente")

    except Exception as e:
        print(f"❌ Error validando modelos: {str(e)}")
        return False

    return True

if __name__ == "__main__":
    print("🚀 MIGRACIÓN TABLAS DE SEGUIMIENTO - NEMAEC ERP")
    print("=" * 60)

    # Ejecutar migración
    migration_success = asyncio.run(create_seguimiento_tables())

    if migration_success:
        # Probar modelos
        test_success = asyncio.run(test_seguimiento_models())

        if test_success:
            print("\n" + "=" * 60)
            print("🎉 MIGRACIÓN COMPLETADA EXITOSAMENTE")
            print("✅ Tablas de seguimiento listas para usar")
            print("🔄 Reinicia el servidor para aplicar cambios")
        else:
            print("\n❌ Error en validación de modelos")
    else:
        print("\n❌ Error en migración de tablas")