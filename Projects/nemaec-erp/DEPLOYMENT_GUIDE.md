# 🚀 GUÍA DE DEPLOYMENT - NEMAEC ERP

## 📋 Cambios en esta versión
- ✅ Dashboard Nacional con datos reales (no simulados)
- ✅ Sistema de seguimiento de avances temporales
- ✅ Navegación funcional desde dashboard
- ✅ Títulos ejecutivos mejorados (sin códigos técnicos)
- ✅ Base de datos actualizada con nuevas tablas

## ⚠️ IMPORTANTE: Reset de Base de Datos Requerido

Esta versión incluye **cambios en el esquema de base de datos** que requieren un reset completo.

### 🗄️ Paso 1: Reset de Base de Datos

**EN EL SERVIDOR DE PRODUCCIÓN:**

```bash
# Opción A: Reset automático con script
cd /ruta/al/backend
python reset_database.py
# Escribir 'RESET' para confirmar

# Opción B: Reset manual
rm /ruta/al/servidor/database.db
# El sistema recreará automáticamente las tablas
```

### 📦 Paso 2: Deployment de Código

```bash
# 1. En tu repositorio local
git push origin main

# 2. En el servidor
git pull origin main

# 3. Reiniciar servicios
sudo systemctl restart nemaec-backend
sudo systemctl restart nemaec-frontend
```

### 🔄 Paso 3: Verificación Post-Deployment

**Verificar que el sistema funciona:**

1. **Backend Health Check:**
   ```bash
   curl http://localhost:8002/api/v1/comisarias/
   # Debe retornar: []
   ```

2. **Frontend Dashboard:**
   - Ir a: `http://tu-servidor:3000/dashboard`
   - Debe mostrar: "0 comisarías" pero sin errores
   - Las métricas deben estar en 0

3. **Importar datos de prueba:**
   - Crear una comisaría nueva
   - Importar cronograma
   - Subir avances físicos
   - Verificar dashboard actualizado

## 🎯 Nuevas Funcionalidades

### Dashboard Real
- ✅ **Métricas reales** calculadas de la base de datos
- ✅ **Comisarías con avances** mostradas primero
- ✅ **Comisarías sin reportes** identificadas automáticamente
- ✅ **Navegación funcional** a cronogramas y evolución

### Botones Activos
- 📊 **Ver Cronograma** → `/cronograma/comisaria/{id}`
- 📈 **Ver Evolución** → `/seguimiento/evolucion/{id}`
- ⚠️ **Subir Avances** → `/avances/import-excel?comisaria={id}`

### Sistema de Evolución
- 📅 **Tracking temporal** de avances físicos
- 📈 **Gráficos de evolución** real vs programado
- 🎯 **Detección automática** de comisarías problemáticas

## 🚨 Rollback (si algo falla)

```bash
# Volver a la versión anterior
git reset --hard HEAD~1
git push --force origin main

# En el servidor
git pull origin main
sudo systemctl restart nemaec-backend
sudo systemctl restart nemaec-frontend
```

## 📞 Soporte

Si encuentras problemas durante el deployment:

1. **Verificar logs del backend:**
   ```bash
   sudo journalctl -u nemaec-backend -f
   ```

2. **Verificar logs del frontend:**
   ```bash
   sudo journalctl -u nemaec-frontend -f
   ```

3. **Verificar base de datos:**
   ```bash
   python -c "
   from app.infrastructure.database.database import engine
   print('✅ Base de datos conectada correctamente')
   "
   ```

## ✅ Checklist de Deployment

- [ ] Commit y push realizados
- [ ] Base de datos reseteada en servidor
- [ ] Código actualizado en servidor
- [ ] Servicios reiniciados
- [ ] Dashboard carga sin errores
- [ ] Navegación funciona
- [ ] Se puede crear nueva comisaría
- [ ] Se puede importar cronograma
- [ ] Se puede subir avances

---

🎉 **¡Deployment exitoso!** El sistema NEMAEC ERP está actualizado con dashboard ejecutivo real.