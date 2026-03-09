#!/usr/bin/env python3
"""
🚀 INICIALIZAR BASE DE DATOS - NEMAEC ERP
Crear tablas y datos de prueba para desarrollo
"""
import asyncio
import sys
import os
from datetime import datetime, timedelta

# Agregar el directorio backend al path
sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy.ext.asyncio import create_async_engine
from app.core.database import Base
from app.infrastructure.database.models import ComisariaModel, CronogramaModel, PartidaModel

async def init_database():
    """Inicializar base de datos con datos de prueba"""

    # Crear el directorio data si no existe
    data_dir = os.path.join(os.path.dirname(__file__), 'data')
    os.makedirs(data_dir, exist_ok=True)

    # URL de la base de datos
    database_url = f"sqlite+aiosqlite:///{data_dir}/nemaec_erp.db"

    print(f"🚀 Inicializando base de datos en: {database_url}")

    # Crear engine y tablas
    engine = create_async_engine(database_url, echo=True)

    async with engine.begin() as conn:
        # Crear todas las tablas
        await conn.run_sync(Base.metadata.create_all)
        print("✅ Tablas creadas exitosamente")

    # Agregar datos de prueba
    from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession
    AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with AsyncSessionLocal() as session:
        try:
            # 1. Crear comisarías de prueba
            comisarias = [
                ComisariaModel(
                    nombre="Comisaría Collique",
                    codigo="COM-COLLIQUE",
                    tipo="comisaria",
                    ubicacion={
                        "direccion": "Av. Los Incas 123, Collique",
                        "distrito": "Comas",
                        "provincia": "Lima",
                        "departamento": "Lima",
                        "coordenadas": {"lat": -11.9364, "lng": -77.0596}
                    },
                    presupuesto_total=2500000.0,
                    estado="en_proceso"
                ),
                ComisariaModel(
                    nombre="Comisaría San Juan de Miraflores",
                    codigo="COM-SJM",
                    tipo="comisaria",
                    ubicacion={
                        "direccion": "Av. San Juan 456",
                        "distrito": "San Juan de Miraflores",
                        "provincia": "Lima",
                        "departamento": "Lima",
                        "coordenadas": {"lat": -12.1564, "lng": -76.9736}
                    },
                    presupuesto_total=3200000.0,
                    estado="pendiente"
                ),
                ComisariaModel(
                    nombre="Comisaría Villa El Salvador",
                    codigo="COM-VES",
                    tipo="comisaria",
                    ubicacion={
                        "direccion": "Av. Villa 789",
                        "distrito": "Villa El Salvador",
                        "provincia": "Lima",
                        "departamento": "Lima",
                        "coordenadas": {"lat": -12.2009, "lng": -76.9309}
                    },
                    presupuesto_total=2800000.0,
                    estado="pendiente"
                )
            ]

            for comisaria in comisarias:
                session.add(comisaria)

            await session.flush()  # Para obtener los IDs
            print(f"✅ {len(comisarias)} comisarías creadas")

            # 2. Crear cronogramas para cada comisaría
            cronogramas = []
            for comisaria in comisarias:
                cronograma = CronogramaModel(
                    comisaria_id=comisaria.id,
                    nombre=f"Cronograma Valorizado {comisaria.nombre}",
                    descripcion=f"Cronograma de construcción para {comisaria.nombre}",
                    fecha_inicio=datetime.now() + timedelta(days=30),
                    fecha_fin=datetime.now() + timedelta(days=365),
                    estado="activo",
                    progreso=0.0
                )
                session.add(cronograma)
                cronogramas.append(cronograma)

            await session.flush()  # Para obtener los IDs de cronogramas
            print(f"✅ {len(cronogramas)} cronogramas creados")

            # 3. Crear partidas de prueba para el cronograma de Collique
            collique_cronograma = next(c for c in cronogramas if c.comisaria_id == comisarias[0].id)

            partidas_collique = [
                # Obras provisionales
                PartidaModel(
                    cronograma_id=collique_cronograma.id,
                    comisaria_id=comisarias[0].id,
                    codigo_interno="1010",
                    codigo_partida="01",
                    descripcion="OBRAS PROVISIONALES, SEGURIDAD Y SALUD",
                    unidad="GLB",
                    metrado=1.0,
                    precio_unitario=9885.57,
                    precio_total=9885.57,
                    fecha_inicio=datetime.now() + timedelta(days=30),
                    fecha_fin=datetime.now() + timedelta(days=45),
                    nivel_jerarquia=1
                ),
                PartidaModel(
                    cronograma_id=collique_cronograma.id,
                    comisaria_id=comisarias[0].id,
                    codigo_interno="1011",
                    codigo_partida="01.01",
                    descripcion="Trabajos Provisionales",
                    unidad="GLB",
                    metrado=1.0,
                    precio_unitario=600.0,
                    precio_total=600.0,
                    fecha_inicio=datetime.now() + timedelta(days=30),
                    fecha_fin=datetime.now() + timedelta(days=35),
                    nivel_jerarquia=2,
                    partida_padre="01"
                ),
                PartidaModel(
                    cronograma_id=collique_cronograma.id,
                    comisaria_id=comisarias[0].id,
                    codigo_interno="1012",
                    codigo_partida="01.01.01",
                    descripcion="Alquiler de Almacén",
                    unidad="UND",
                    metrado=1.0,
                    precio_unitario=600.0,
                    precio_total=600.0,
                    fecha_inicio=datetime.now() + timedelta(days=30),
                    fecha_fin=datetime.now() + timedelta(days=35),
                    nivel_jerarquia=3,
                    partida_padre="01.01"
                ),

                # Demolición
                PartidaModel(
                    cronograma_id=collique_cronograma.id,
                    comisaria_id=comisarias[0].id,
                    codigo_interno="1024",
                    codigo_partida="02",
                    descripcion="DEMOLICIÓN Y DESMONTAJE",
                    unidad="GLB",
                    metrado=1.0,
                    precio_unitario=7465.07,
                    precio_total=7465.07,
                    fecha_inicio=datetime.now() + timedelta(days=46),
                    fecha_fin=datetime.now() + timedelta(days=75),
                    nivel_jerarquia=1
                ),
                PartidaModel(
                    cronograma_id=collique_cronograma.id,
                    comisaria_id=comisarias[0].id,
                    codigo_interno="1025",
                    codigo_partida="02.01",
                    descripcion="Desmontaje de Artefactos",
                    unidad="UND",
                    metrado=75.0,
                    precio_unitario=14.42,
                    precio_total=1081.5,
                    fecha_inicio=datetime.now() + timedelta(days=46),
                    fecha_fin=datetime.now() + timedelta(days=55),
                    nivel_jerarquia=2,
                    partida_padre="02"
                ),
                PartidaModel(
                    cronograma_id=collique_cronograma.id,
                    comisaria_id=comisarias[0].id,
                    codigo_interno="1026",
                    codigo_partida="02.02",
                    descripcion="Desmontaje de Ventanas",
                    unidad="M2",
                    metrado=35.36,
                    precio_unitario=7.23,
                    precio_total=255.65,
                    fecha_inicio=datetime.now() + timedelta(days=56),
                    fecha_fin=datetime.now() + timedelta(days=75),
                    nivel_jerarquia=2,
                    partida_padre="02"
                ),

                # Estructuras
                PartidaModel(
                    cronograma_id=collique_cronograma.id,
                    comisaria_id=comisarias[0].id,
                    codigo_interno="1043",
                    codigo_partida="03",
                    descripcion="ESTRUCTURAS",
                    unidad="GLB",
                    metrado=1.0,
                    precio_unitario=717.79,
                    precio_total=717.79,
                    fecha_inicio=datetime.now() + timedelta(days=76),
                    fecha_fin=datetime.now() + timedelta(days=105),
                    nivel_jerarquia=1
                ),

                # Arquitectura
                PartidaModel(
                    cronograma_id=collique_cronograma.id,
                    comisaria_id=comisarias[0].id,
                    codigo_interno="1049",
                    codigo_partida="04",
                    descripcion="ARQUITECTURA",
                    unidad="GLB",
                    metrado=1.0,
                    precio_unitario=143647.39,
                    precio_total=143647.39,
                    fecha_inicio=datetime.now() + timedelta(days=106),
                    fecha_fin=datetime.now() + timedelta(days=245),
                    nivel_jerarquia=1
                ),
                PartidaModel(
                    cronograma_id=collique_cronograma.id,
                    comisaria_id=comisarias[0].id,
                    codigo_interno="1050",
                    codigo_partida="04.01",
                    descripcion="Muros y Tabiquería",
                    unidad="GLB",
                    metrado=1.0,
                    precio_unitario=1333.14,
                    precio_total=1333.14,
                    fecha_inicio=datetime.now() + timedelta(days=106),
                    fecha_fin=datetime.now() + timedelta(days=136),
                    nivel_jerarquia=2,
                    partida_padre="04"
                ),
                PartidaModel(
                    cronograma_id=collique_cronograma.id,
                    comisaria_id=comisarias[0].id,
                    codigo_interno="1051",
                    codigo_partida="04.01.01",
                    descripcion="Muro de Ladrillo KK",
                    unidad="M2",
                    metrado=13.24,
                    precio_unitario=100.69,
                    precio_total=1333.14,
                    fecha_inicio=datetime.now() + timedelta(days=106),
                    fecha_fin=datetime.now() + timedelta(days=136),
                    nivel_jerarquia=3,
                    partida_padre="04.01"
                )
            ]

            for partida in partidas_collique:
                session.add(partida)

            print(f"✅ {len(partidas_collique)} partidas creadas para Collique")

            await session.commit()
            print("✅ Base de datos inicializada exitosamente")

        except Exception as e:
            await session.rollback()
            print(f"❌ Error al inicializar datos: {e}")
            raise

    await engine.dispose()

if __name__ == "__main__":
    print("🚀 Inicializando base de datos NEMAEC ERP...")
    asyncio.run(init_database())
    print("🎉 ¡Base de datos lista para usar!")