"""
🚀 NEMAEC ERP - MAIN APPLICATION
FastAPI application with Clean Architecture.
Entry point para el sistema ERP.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse

from app.core.config import settings
from app.core.database import init_db, close_db
# from app.core.security import SecurityHeaders


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manejo del ciclo de vida de la aplicación.
    Setup y cleanup de recursos.
    """
    # 🚀 Startup
    print(f"🚀 Iniciando {settings.PROJECT_NAME} v{settings.VERSION} - DB Persistence Test")
    print(f"🌍 Entorno: {settings.ENVIRONMENT}")

    # Intentar activar base de datos SQLite
    try:
        await init_db()
        print("🗄️ Base de datos SQLite inicializada")
    except Exception as e:
        print(f"⚠️ Error inicializando base de datos (continuando sin BD): {e}")
        # Continuar sin base de datos - mejor que fallar completamente

    yield

    # 🛑 Shutdown
    # await close_db()
    print("🛑 Aplicación terminada correctamente")


# 🏗️ Crear aplicación FastAPI
app = FastAPI(
    title=settings.PROJECT_NAME,
    description=settings.PROJECT_DESCRIPTION,
    version=settings.VERSION,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    openapi_url=f"{settings.API_PREFIX}/openapi.json" if settings.DEBUG else None,
    lifespan=lifespan
)


# 🌐 Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS if not settings.is_production
                  else ["https://nemaec-erp.gob.pe"],  # Ejemplo URL producción
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 🛡️ Middleware de seguridad - Deshabilitado temporalmente
# @app.middleware("http")
# async def add_security_headers(request, call_next):
#     """Agregar headers de seguridad a todas las respuestas"""
#     response = await call_next(request)
#
#     # Solo agregar en producción para no interferir con desarrollo
#     if settings.is_production:
#         security_headers = SecurityHeaders.get_security_headers()
#         for header, value in security_headers.items():
#             response.headers[header] = value
#
#     return response


# 📁 Servir archivos estáticos del frontend
import os
from fastapi.responses import FileResponse

# Montar archivos estáticos del frontend React
static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "static")
if os.path.exists(static_dir):
    # Montar tanto /static como /assets para compatibilidad con Vite
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

    # Montar assets específicamente para archivos JS/CSS de Vite
    assets_dir = os.path.join(static_dir, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")


# 🏠 Ruta raíz - Servir index.html del frontend
@app.get("/", include_in_schema=False)
async def root():
    """
    Servir la aplicación React desde index.html
    """
    static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "static")
    index_path = os.path.join(static_dir, "index.html")

    # Debug - listar contenido del directorio static
    print(f"📂 DEBUG - static_dir: {static_dir}")
    print(f"📂 DEBUG - index_path: {index_path}")
    print(f"📂 DEBUG - static_dir exists: {os.path.exists(static_dir)}")
    if os.path.exists(static_dir):
        static_contents = os.listdir(static_dir)
        print(f"📂 DEBUG - static_dir contents: {static_contents}")

        # Check if assets directory exists
        assets_dir = os.path.join(static_dir, "assets")
        print(f"📂 DEBUG - assets_dir: {assets_dir}")
        print(f"📂 DEBUG - assets_dir exists: {os.path.exists(assets_dir)}")
        if os.path.exists(assets_dir):
            print(f"📂 DEBUG - assets contents: {os.listdir(assets_dir)}")
    print(f"📂 DEBUG - index.html exists: {os.path.exists(index_path)}")

    if os.path.exists(index_path):
        return FileResponse(index_path)
    else:
        # Fallback a documentación si no existe el frontend
        if settings.DEBUG:
            return RedirectResponse(url="/docs")
        else:
            return {"error": "Frontend not found", "static_dir": static_dir, "debug": True}


# 🎯 Catch-all will be defined AFTER router includes to avoid conflicts


# 🩺 Health check
@app.get("/health", tags=["system"])
async def health_check():
    """
    Endpoint de health check para monitoring.

    Returns:
        dict: Estado del sistema y componentes
    """
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "components": {
            "database": "healthy",  # TODO: Implementar check real
            "redis": "healthy",     # TODO: Implementar check real
            "storage": "healthy"    # TODO: Implementar check real
        },
        "timestamp": "2026-02-18T12:00:00Z"  # TODO: Usar datetime real
    }


# 📊 Métricas básicas
@app.get("/metrics", tags=["system"])
async def metrics():
    """
    Métricas básicas del sistema para monitoring.

    Returns:
        dict: Métricas del sistema
    """
    # TODO: Implementar métricas reales con Prometheus/StatsD
    return {
        "requests_total": 0,
        "active_users": 0,
        "database_connections": 0,
        "memory_usage": "0MB",
        "cpu_usage": "0%"
    }


# 🗄️ DEBUG: Información de la base de datos (TEMPORAL)
@app.get("/api/v1/debug/database", tags=["system"])
async def debug_database():
    """
    DEBUG: Información de la base de datos SQLite.
    SOLO PARA DESARROLLO - NO USAR EN PRODUCCIÓN FINAL.
    """
    try:
        import sqlite3
        import os
        from app.core.config import settings

        # Obtener ruta de la base de datos
        db_path = settings.database_url.replace("sqlite+aiosqlite:///", "")

        stats = {
            "database_path": db_path,
            "database_exists": os.path.exists(db_path),
            "database_size": os.path.getsize(db_path) if os.path.exists(db_path) else 0,
            "tables": {}
        }

        if os.path.exists(db_path):
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()

            # Obtener lista de tablas
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
            tables = cursor.fetchall()

            for (table_name,) in tables:
                # Contar registros en cada tabla
                cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
                count = cursor.fetchone()[0]

                # Obtener esquema de la tabla
                cursor.execute(f"PRAGMA table_info({table_name})")
                columns = cursor.fetchall()

                stats["tables"][table_name] = {
                    "record_count": count,
                    "columns": [{"name": col[1], "type": col[2]} for col in columns]
                }

            conn.close()

        return stats

    except Exception as e:
        return {"error": str(e), "message": "Error accediendo a la base de datos"}


# 🔧 Include routers
from app.presentation.api.google_maps_fallback import router as google_maps_router  # 🚨 Using fallback (no Google billing)
from app.presentation.api.comisarias_db import router as comisarias_router  # 🗄️ Using database version
from app.presentation.api.cronogramas_db import router as cronogramas_router  # 🗄️ Using database version
from app.presentation.api.cronograma_versiones import router as cronograma_versiones_router
from app.presentation.api.seguimiento import router as seguimiento_router  # 📊 New: Progress tracking
from app.api.routes.avances_routes import router as avances_router  # 📊 Manual progress registration

app.include_router(google_maps_router, prefix=settings.API_PREFIX)
app.include_router(comisarias_router, prefix=settings.API_PREFIX)
app.include_router(cronogramas_router, prefix=settings.API_PREFIX)
app.include_router(cronograma_versiones_router, prefix=settings.API_PREFIX)
app.include_router(seguimiento_router, prefix=settings.API_PREFIX)  # 📊 Seguimiento de avances físicos
app.include_router(avances_router, prefix=settings.API_PREFIX)  # 📊 Registro manual de avances

# Otros routers pendientes de implementar:
# from app.presentation.api.auth import router as auth_router
# from app.presentation.api.contracts import router as contracts_router
# from app.presentation.api.obras import router as obras_router
# from app.presentation.api.dashboard import router as dashboard_router

# app.include_router(auth_router, prefix=settings.API_PREFIX)
# app.include_router(contracts_router, prefix=settings.API_PREFIX)
# app.include_router(obras_router, prefix=settings.API_PREFIX)
# app.include_router(dashboard_router, prefix=settings.API_PREFIX)

# 🎯 Catch-all para SPA routing (React Router) - NOW PLACED AFTER ROUTERS
@app.get("/{path:path}", include_in_schema=False)
async def catch_all(path: str):
    """
    Manejar rutas del frontend React (SPA routing)
    Devolver index.html para cualquier ruta que no sea API
    """
    # Excluir rutas de API y assets estáticos - permitir que FastAPI las maneje
    if (path.startswith("api/") or path.startswith("docs") or path.startswith("redoc") or
        path.startswith("assets/") or path.startswith("static/") or
        path == "health" or path == "metrics" or path.startswith("openapi")):
        # No manejar estas rutas aquí - dejar que FastAPI las procese normalmente
        return

    static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "static")
    index_path = os.path.join(static_dir, "index.html")

    if os.path.exists(index_path):
        return FileResponse(index_path)
    else:
        return {"error": "Frontend not found", "static_dir": static_dir}


if __name__ == "__main__":
    import uvicorn

    # 🔧 Configuración para desarrollo local
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        access_log=settings.DEBUG,
        log_level="info" if settings.DEBUG else "warning"
    )