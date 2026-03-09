#!/usr/bin/env python3
"""
📊 GENERADOR DE EXCEL TEMPLATE PERSONALIZADO
Genera Excel template basado en las partidas reales de la BD
"""

import pandas as pd
import sqlite3
from datetime import datetime, date
import sys
import os

# Agregar el directorio backend al path
sys.path.append('.')
from app.core.config import settings

def obtener_partidas_reales(comisaria_id=None):
    """Obtener partidas reales de la BD para crear template"""

    db_path = settings.database_url.replace("sqlite+aiosqlite:///", "")

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        if comisaria_id:
            # Partidas de una comisaría específica
            cursor.execute("""
                SELECT codigo_partida, descripcion, unidad, metrado, precio_total
                FROM partidas
                WHERE comisaria_id = ?
                ORDER BY codigo_partida
            """, (comisaria_id,))
        else:
            # Todas las partidas disponibles
            cursor.execute("""
                SELECT DISTINCT codigo_partida, descripcion, unidad, metrado, precio_total
                FROM partidas
                ORDER BY codigo_partida
                LIMIT 20
            """)

        partidas = cursor.fetchall()
        conn.close()

        return partidas

    except Exception as e:
        print(f"❌ Error obteniendo partidas: {str(e)}")
        return []

def generar_template_personalizado(comisaria_id=None, nombre_comisaria="COMISARIA_EJEMPLO"):
    """Generar Excel template con partidas reales"""

    print(f"📊 GENERANDO EXCEL TEMPLATE PERSONALIZADO")
    print(f"🏗️  Comisaría: {nombre_comisaria}")
    print("=" * 50)

    # Obtener partidas reales
    partidas_reales = obtener_partidas_reales(comisaria_id)

    if not partidas_reales:
        print("⚠️ No se encontraron partidas. Usando datos de ejemplo.")
        # Datos de ejemplo si no hay partidas
        datos_excel = [
            ["SEGUIMIENTO AVANCES - " + nombre_comisaria, "", ""],
            ["", "", ""],
            ["FECHA DE CORTE:", "2026-03-01", ""],
            ["AVANCE TOTAL EJECUTADO:", "0.35", ""],
            ["", "", ""],
            ["CODIGO_PARTIDA", "% AVANCE_EJECUTADO", "OBSERVACIONES"],
            ["01.01", "0.80", "Almacén casi terminado"],
            ["01.02", "1.00", "Movilización completa"],
            ["02.01", "0.60", "Demolición avanzada"],
        ]
    else:
        print(f"✅ Encontradas {len(partidas_reales)} partidas reales")

        # Header del Excel
        datos_excel = [
            ["SEGUIMIENTO AVANCES - " + nombre_comisaria, "", ""],
            ["", "", ""],
            ["FECHA DE CORTE:", datetime.now().strftime("%Y-%m-%d"), ""],
            ["AVANCE TOTAL EJECUTADO:", "0.00", ""],
            ["", "", ""],
            ["CODIGO_PARTIDA", "% AVANCE_EJECUTADO", "OBSERVACIONES"]
        ]

        # Agregar partidas reales con avance 0 para llenar
        for codigo, descripcion, unidad, metrado, precio_total in partidas_reales:
            datos_excel.append([
                codigo,
                "0.00",  # Avance inicial en 0 para que lo llenes
                f"{descripcion[:50]}..." if len(descripcion) > 50 else descripcion
            ])

    # Crear DataFrame
    df = pd.DataFrame(datos_excel)

    # Nombre del archivo
    fecha_hoy = datetime.now().strftime("%Y%m%d")
    filename = f"/tmp/TEMPLATE_AVANCES_{nombre_comisaria}_{fecha_hoy}.xlsx"

    # Crear Excel
    with pd.ExcelWriter(filename, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name='AVANCES', index=False, header=False)

    print(f"✅ Template generado: {filename}")

    return filename

def generar_templates_para_todas_comisarias():
    """Generar template para cada comisaría existente"""

    print("🏗️ GENERANDO TEMPLATES PARA TODAS LAS COMISARÍAS")
    print("=" * 60)

    db_path = settings.database_url.replace("sqlite+aiosqlite:///", "")

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Obtener todas las comisarías
        cursor.execute("SELECT id, nombre FROM comisarias ORDER BY id")
        comisarias = cursor.fetchall()

        templates_generados = []

        for comisaria_id, nombre in comisarias:
            # Limpiar nombre para usar en archivo
            nombre_limpio = nombre.replace(" ", "_").replace(".", "").upper()

            print(f"\n📋 Generando template para: {nombre} (ID: {comisaria_id})")

            template_path = generar_template_personalizado(comisaria_id, nombre_limpio)
            templates_generados.append({
                'comisaria_id': comisaria_id,
                'nombre': nombre,
                'template_path': template_path
            })

        conn.close()

        print(f"\n🎉 TEMPLATES GENERADOS ({len(templates_generados)}):")
        for template in templates_generados:
            print(f"   ✓ {template['nombre']}: {template['template_path']}")

        return templates_generados

    except Exception as e:
        print(f"❌ Error generando templates: {str(e)}")
        return []

if __name__ == "__main__":
    print("🚀 GENERADOR DE EXCEL TEMPLATES - NEMAEC ERP")
    print("=" * 60)

    # Generar templates para todas las comisarías
    templates = generar_templates_para_todas_comisarias()

    if templates:
        print("\n📋 INSTRUCCIONES DE USO:")
        print("1. Descarga el Excel de tu comisaría")
        print("2. Llena SOLO la columna '% AVANCE_EJECUTADO'")
        print("3. Actualiza la FECHA DE CORTE")
        print("4. Sube al sistema para validar partidas")
        print("5. Si las partidas coinciden, procede a importar")

        print("\n💡 TIPS:")
        print("- Usa decimales: 0.50 = 50%, 0.85 = 85%")
        print("- No cambies los códigos de partida")
        print("- El sistema calculará montos automáticamente")
    else:
        print("❌ No se pudieron generar templates")