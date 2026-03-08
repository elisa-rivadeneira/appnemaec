#!/usr/bin/env python3
"""
🗄️ RESET DATABASE SCRIPT - NEMAEC ERP
Script para resetear completamente la base de datos.
USAR SOLO EN DESARROLLO O CUANDO NO HAY DATOS DE PRODUCCIÓN.
"""
import os
import sys
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from app.infrastructure.database.database import engine, DATABASE_URL
from app.infrastructure.database.models import Base
from app.infrastructure.database.models_seguimiento import Base as SeguimientoBase

def reset_database():
    """
    Resetea completamente la base de datos:
    1. Elimina todas las tablas
    2. Recrea el esquema completo
    """
    print("🗄️ NEMAEC ERP - Reset de Base de Datos")
    print("=" * 50)

    # Confirmar la acción
    print("⚠️  ADVERTENCIA: Esto eliminará TODOS los datos de la base de datos.")
    print(f"📍 Base de datos: {DATABASE_URL}")

    confirm = input("\n¿Estás seguro? Escribe 'RESET' para confirmar: ")
    if confirm != 'RESET':
        print("❌ Reset cancelado.")
        return False

    try:
        print("\n🗑️  Eliminando todas las tablas...")

        # Drop all tables
        Base.metadata.drop_all(bind=engine)
        SeguimientoBase.metadata.drop_all(bind=engine)

        print("✅ Tablas eliminadas correctamente.")

        print("\n🔧 Recreando esquema de base de datos...")

        # Recreate all tables
        Base.metadata.create_all(bind=engine)
        SeguimientoBase.metadata.create_all(bind=engine)

        print("✅ Esquema recreado correctamente.")

        print("\n🎉 Reset de base de datos completado exitosamente!")
        print("\nLa base de datos está limpia y lista para usar.")
        print("El sistema recreará automáticamente las tablas al iniciar.")

        return True

    except Exception as e:
        print(f"\n❌ Error durante el reset: {e}")
        return False

if __name__ == "__main__":
    success = reset_database()
    sys.exit(0 if success else 1)