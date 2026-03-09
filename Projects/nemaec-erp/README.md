# 🏛️ NEMAEC ERP - Sistema de Gestión de Obras

**Núcleo Ejecutor de Mantenimiento, Acondicionamiento y Equipamiento de Comisarías**

Sistema ERP empresarial para gestión de contratos, obras y seguimiento de avances en tiempo real. Diseñado para escalar a **132 comisarías a nivel nacional**.

---

## 🎯 **ARQUITECTURA CLEAN - GUÍA PARA DEVELOPERS**

### **📐 Principios de Diseño**

Este proyecto implementa **Clean Architecture** con separación de responsabilidades:

```
🏗️ CAPAS DE LA APLICACIÓN
┌─────────────────────────────────────┐
│  🖥️  PRESENTATION LAYER            │  ← Controllers, DTOs, Validators
├─────────────────────────────────────┤
│  ⚡  APPLICATION LAYER              │  ← Use Cases, Services, Commands
├─────────────────────────────────────┤
│  🎯  DOMAIN LAYER                   │  ← Entities, Value Objects, Rules
├─────────────────────────────────────┤
│  🔌  INFRASTRUCTURE LAYER           │  ← DB, External APIs, Frameworks
└─────────────────────────────────────┘
```

### **🧩 Estructura del Proyecto**

```
nemaec-erp/
├── backend/
│   ├── app/
│   │   ├── core/           # 🏗️ Config, constants, base classes
│   │   │   ├── config.py   # Settings con Pydantic
│   │   │   ├── database.py # DB connection & session
│   │   │   └── security.py # Auth & encryption
│   │   │
│   │   ├── domain/         # 🎯 Business Logic (NO dependencies)
│   │   │   ├── entities/   # Domain objects (User, Contract, etc.)
│   │   │   ├── value_objects/ # Immutable objects (Email, Money)
│   │   │   ├── repositories/  # Abstract interfaces
│   │   │   └── services/   # Domain services
│   │   │
│   │   ├── application/    # ⚡ Use Cases & Orchestration
│   │   │   ├── commands/   # Write operations (CreateContract)
│   │   │   ├── queries/    # Read operations (GetContractList)
│   │   │   ├── handlers/   # Command/Query handlers
│   │   │   └── services/   # Application services
│   │   │
│   │   ├── infrastructure/ # 🔌 External concerns
│   │   │   ├── database/   # SQLAlchemy models & repos
│   │   │   ├── external/   # Third-party APIs
│   │   │   ├── storage/    # File handling
│   │   │   └── messaging/  # Email, notifications
│   │   │
│   │   └── presentation/   # 🖥️ Web layer
│   │       ├── api/        # FastAPI routers
│   │       ├── schemas/    # Pydantic request/response
│   │       └── middleware/ # Auth, CORS, logging
│   │
│   ├── tests/             # 🧪 Testing structure mirrors app/
│   ├── migrations/        # 📦 Alembic database migrations
│   └── requirements.txt   # 📋 Dependencies
│
└── frontend/              # ⚛️ React + TypeScript
    ├── src/
    │   ├── components/    # 🧩 Reusable UI components
    │   │   ├── ui/        # Base components (Button, Input)
    │   │   ├── forms/     # Form components
    │   │   └── charts/    # Data visualization
    │   │
    │   ├── pages/         # 📄 Route components
    │   ├── services/      # 🌐 API communication
    │   ├── hooks/         # 🪝 Custom React hooks
    │   ├── types/         # 📝 TypeScript interfaces
    │   ├── utils/         # 🔧 Pure utility functions
    │   └── tests/         # 🧪 Frontend tests
    │
    ├── package.json       # Dependencies & scripts
    └── tailwind.config.js # NEMAEC design system
```

---

## 🚀 **QUICK START PARA DEVELOPERS**

### **1. Setup Backend**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Database setup
alembic upgrade head

# Start development server
uvicorn app.main:app --reload
```

### **2. Setup Frontend**
```bash
cd frontend
npm install
npm run dev
```

### **3. Verificación**
- Backend: http://localhost:8000/docs
- Frontend: http://localhost:3000
- Database: PostgreSQL on localhost:5432

---

## 🎨 **DESIGN SYSTEM NEMAEC**

### **Paleta de Colores Oficial**
```css
:root {
  /* 🟢 Verde Militar */
  --primary-green-dark: #1B5E20;
  --primary-green: #388E3C;
  --primary-green-light: #4CAF50;

  /* ⚫ Grises Mates */
  --bg-dark: #263238;
  --bg-secondary: #37474F;
  --bg-light: #455A64;

  /* 🟡 Amarillo Institucional */
  --accent-yellow: #FFC107;
  --accent-yellow-light: #FFEB3B;

  /* 🔴 Alertas Críticas */
  --critical-red: #C62828;
  --critical-red-light: #EF5350;

  /* ⚪ Textos */
  --text-primary: #FFFFFF;
  --text-secondary: #ECEFF1;
}
```

---

## 📚 **GUÍA PARA JUNIORS**

### **¿Cómo agregar una nueva funcionalidad?**

**Ejemplo: Agregar "Reportes de Avance"**

#### **1. Domain Layer (¿Qué es un Reporte?)**
```python
# app/domain/entities/reporte.py
from dataclasses import dataclass
from datetime import datetime
from typing import List

@dataclass
class Reporte:
    """
    Entidad de dominio para Reportes de Avance.
    Sin dependencias externas - solo lógica de negocio.
    """
    id: int
    comisaria_id: int
    fecha_reporte: datetime
    avance_programado: float
    avance_fisico: float

    def calcular_diferencia(self) -> float:
        """Regla de negocio: diferencia entre programado y físico"""
        return self.avance_fisico - self.avance_programado

    def es_critico(self) -> bool:
        """Regla de negocio: alerta si diferencia > 5%"""
        return abs(self.calcular_diferencia()) > 5.0
```

#### **2. Application Layer (¿Cómo crear un Reporte?)**
```python
# app/application/commands/crear_reporte_command.py
from dataclasses import dataclass

@dataclass
class CrearReporteCommand:
    """Comando para crear un nuevo reporte"""
    comisaria_id: int
    avance_programado: float
    avance_fisico: float
    usuario_id: int

# app/application/handlers/crear_reporte_handler.py
from app.domain.entities.reporte import Reporte
from app.domain.repositories.reporte_repository import ReporteRepository

class CrearReporteHandler:
    """Handler que orquesta la creación de reportes"""

    def __init__(self, repo: ReporteRepository):
        self.repo = repo

    async def handle(self, command: CrearReporteCommand) -> int:
        # 1. Crear entidad de dominio
        reporte = Reporte(
            id=None,
            comisaria_id=command.comisaria_id,
            fecha_reporte=datetime.now(),
            avance_programado=command.avance_programado,
            avance_fisico=command.avance_fisico
        )

        # 2. Aplicar reglas de negocio
        if reporte.es_critico():
            # Enviar notificación (a través de otro service)
            pass

        # 3. Persistir
        return await self.repo.save(reporte)
```

#### **3. Infrastructure Layer (¿Cómo guardar en BD?)**
```python
# app/infrastructure/database/models/reporte_model.py
from sqlalchemy import Column, Integer, Float, DateTime
from app.core.database import Base

class ReporteModel(Base):
    """Modelo SQLAlchemy - solo para persistencia"""
    __tablename__ = "reportes"

    id = Column(Integer, primary_key=True)
    comisaria_id = Column(Integer, nullable=False)
    fecha_reporte = Column(DateTime, nullable=False)
    avance_programado = Column(Float, nullable=False)
    avance_fisico = Column(Float, nullable=False)
```

#### **4. Presentation Layer (¿Cómo exponer la API?)**
```python
# app/presentation/api/reporte_router.py
from fastapi import APIRouter, Depends
from app.application.commands.crear_reporte_command import CrearReporteCommand
from app.application.handlers.crear_reporte_handler import CrearReporteHandler

router = APIRouter(prefix="/api/reportes", tags=["reportes"])

@router.post("/", response_model=int)
async def crear_reporte(
    comando: CrearReporteCommand,
    handler: CrearReporteHandler = Depends()
):
    """Endpoint para crear un nuevo reporte de avance"""
    return await handler.handle(comando)
```

### **📋 Reglas de Codificación**

1. **Naming Conventions:**
   - Classes: `PascalCase`
   - Functions/variables: `snake_case`
   - Constants: `UPPER_CASE`
   - Files: `snake_case.py`

2. **Imports:**
   - Standard library first
   - Third-party second
   - Local imports last

3. **Documentation:**
   - Docstrings en español para lógica de negocio
   - Comments en inglés para código técnico
   - Type hints siempre

4. **Testing:**
   - Un test por cada use case
   - Tests de integración para controllers

---

## 🔧 **TECNOLOGÍAS**

### **Backend**
- **Python 3.11+** - Lenguaje principal
- **FastAPI** - Framework web asíncrono
- **PostgreSQL** - Base de datos principal
- **SQLAlchemy 2.0** - ORM con async support
- **Alembic** - Migraciones de DB
- **Redis** - Cache y cola de tareas
- **Celery** - Procesamiento asíncrono
- **Pytest** - Testing framework

### **Frontend**
- **React 18** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first CSS
- **React Query** - Server state management
- **React Hook Form** - Form handling
- **Recharts** - Data visualization
- **Vite** - Build tool

### **DevOps**
- **Docker** - Containerización
- **PostgreSQL** - Database
- **Nginx** - Reverse proxy
- **GitHub Actions** - CI/CD

---

## 📊 **MÓDULOS DEL SISTEMA**

### **🏗️ Core Modules**
- **Contratos** - Gestión de contratos de equipamiento/mantenimiento
- **Obras** - Seguimiento de avances y partidas
- **Personal** - Ingenieros, monitores, maestros de obra
- **Comisarías** - Información de las 132 comisarías
- **Reportes** - Dashboard y análisis de avances

### **⚡ Features Avanzadas**
- **Import Excel** - Carga masiva de partidas y avances
- **Alertas Críticas** - Sistema de notificaciones automáticas
- **Dashboard Ejecutivo** - Métricas en tiempo real
- **Multi-tenant** - Soporte para múltiples regiones
- **Audit Log** - Trazabilidad de cambios

---

## 🧪 **TESTING STRATEGY**

```
📊 PIRÁMIDE DE TESTING
     /\
    /  \  E2E Tests (pocos, lentos, confiables)
   /____\
  /      \  Integration Tests (algunos)
 /________\
/          \  Unit Tests (muchos, rápidos)
```

### **Unit Tests**
- Entities y Value Objects
- Use Case handlers
- Utility functions

### **Integration Tests**
- API endpoints
- Database repositories
- External services

### **E2E Tests**
- Flujos críticos de negocio
- User journeys completos

---

## 📈 **ROADMAP**

### **Fase 1: MVP (Actual)**
- ✅ Arquitectura base
- ✅ Módulos core
- ✅ Import Excel básico
- ✅ Dashboard principal

### **Fase 2: Escalabilidad**
- 🔄 Multi-tenancy
- 🔄 Performance optimization
- 🔄 Monitoring y alertas
- 🔄 Mobile app (PWA)

### **Fase 3: Inteligencia**
- 🔮 Análisis predictivo con IA
- 🔮 Optimización automática de recursos
- 🔮 Integración con sistemas externos
- 🔮 Reportes automáticos

---

## 🤝 **CONTRIBUCIÓN**

### **Workflow para Developers**
1. **Fork** el repositorio
2. **Branch** de feature: `git checkout -b feature/nueva-funcionalidad`
3. **Commit** con mensaje claro: `git commit -m "feat: agregar reportes críticos"`
4. **Push** a tu branch: `git push origin feature/nueva-funcionalidad`
5. **Pull Request** con descripción detallada

### **Code Review Checklist**
- [ ] Sigue Clean Architecture
- [ ] Tests unitarios incluidos
- [ ] Documentación actualizada
- [ ] Sin secrets hardcodeados
- [ ] Manejo de errores adecuado
- [ ] Performance considerado

---

## 📞 **CONTACTO & SOPORTE**

**Proyecto:** NEMAEC ERP Nacional
**Versión:** 1.0.0
**Última actualización:** Febrero 2026

---

*Este README es un documento vivo que debe actualizarse con cada cambio significativo en la arquitectura.*