"""
🗄️ DATABASE CORE
Configuración de base de datos con SQLAlchemy async.
Pool de conexiones y session management.
"""
from typing import AsyncGenerator
from sqlalchemy import MetaData
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    create_async_engine,
    async_sessionmaker
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


# 🏗️ Metadata para naming conventions consistentes
convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s"
}

metadata = MetaData(naming_convention=convention)


class Base(DeclarativeBase):
    """
    Base class para todos los modelos SQLAlchemy.
    Incluye metadata con convenciones de naming.
    """
    metadata = metadata


# 🚀 Engine con configuración optimizada para producción
# Configuración condicional según el tipo de BD
engine_kwargs = {
    "echo": settings.DEBUG,  # Log SQL en development
}

# Solo agregar pool options para PostgreSQL
if not settings.database_url.startswith("sqlite"):
    engine_kwargs.update({
        "pool_size": settings.DB_POOL_SIZE,
        "max_overflow": settings.DB_MAX_OVERFLOW,
        "pool_pre_ping": True,  # Verifica conexiones antes de usar
        "pool_recycle": 3600,   # Recicla conexiones cada hora
    })

engine = create_async_engine(settings.database_url, **engine_kwargs)

# 📦 Session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency para obtener sesión de base de datos.

    Se usa como dependency en FastAPI:

    @router.get("/users")
    async def get_users(db: AsyncSession = Depends(get_db)):
        # Usar db aquí
        pass
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db() -> None:
    """
    Inicializar base de datos.
    Crear todas las tablas si no existen.

    Llamar en startup de la aplicación.
    """
    async with engine.begin() as conn:
        # Importar todos los modelos para que estén disponibles
        from app.infrastructure.database.models import (  # noqa
            ComisariaModel,
            CronogramaModel
        )
        from app.infrastructure.database.models_seguimiento import (  # noqa
            AvanceFisico,
            DetalleAvancePartida,
            AlertaAvance
        )

        # Crear todas las tablas
        await conn.run_sync(Base.metadata.create_all)


async def close_db() -> None:
    """
    Cerrar conexiones de base de datos.
    Llamar en shutdown de la aplicación.
    """
    await engine.dispose()