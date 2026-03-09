#!/usr/bin/env python3
"""
📊 GENERADOR DE EXCEL TEMPLATE CON VALIDACIÓN DOBLE
Template con CÓDIGO + DESCRIPCIÓN para máxima seguridad
"""

import pandas as pd
import sqlite3
from datetime import datetime
import sys
import os

# Agregar el directorio backend al path
sys.path.append('.')
from app.core.config import settings

def generar_template_validacion_doble(comisaria_id=4, nombre_comisaria="COLLIQUE"):
    """
    Generar Excel template con validación doble: CÓDIGO + DESCRIPCIÓN

    Esto garantiza que no haya cambios no detectados como:
    "TECHO DE COCINA" → "TANQUE DE AGUA"
    """

    print(f"🛡️ GENERANDO TEMPLATE CON VALIDACIÓN DOBLE")
    print(f"🏗️  Comisaría: {nombre_comisaria} (ID: {comisaria_id})")
    print("=" * 60)

    # Obtener partidas reales de la BD
    db_path = settings.database_url.replace("sqlite+aiosqlite:///", "")

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Consultar partidas de la comisaría específica
        cursor.execute("""
            SELECT codigo_partida, descripcion, unidad, metrado, precio_total
            FROM partidas
            WHERE comisaria_id = ?
            ORDER BY codigo_partida
        """, (comisaria_id,))

        partidas = cursor.fetchall()
        conn.close()

        if not partidas:
            print(f"❌ No se encontraron partidas para comisaría {comisaria_id}")
            return None

        print(f"✅ Encontradas {len(partidas)} partidas")

        # Crear datos del Excel con validación doble
        datos_excel = [
            # Header principal
            ["SEGUIMIENTO AVANCES - " + nombre_comisaria, "", "", "", ""],
            ["", "", "", "", ""],
            ["FECHA DE CORTE:", datetime.now().strftime("%Y-%m-%d"), "", "", ""],
            ["AVANCE TOTAL EJECUTADO:", "0.00", "", "", ""],
            ["OBSERVACIONES GENERALES:", "Reporte de avance físico", "", "", ""],
            ["", "", "", "", ""],

            # Header de tabla con validación doble
            ["CODIGO_PARTIDA", "DESCRIPCION", "% AVANCE_EJECUTADO", "OBSERVACIONES", "INFO_REFERENCIA"]
        ]

        # Agregar todas las partidas con información completa
        for codigo, descripcion, unidad, metrado, precio_total in partidas:
            datos_excel.append([
                codigo,                    # Columna A: Código para validación
                descripcion,               # Columna B: Descripción COMPLETA para validación
                "0.00",                   # Columna C: Avance a llenar (decimal 0-1)
                "",                       # Columna D: Observaciones específicas
                f"{unidad} | {metrado:.2f} | S/ {precio_total:.2f}"  # Columna E: Referencia
            ])

        # Crear DataFrame
        df = pd.DataFrame(datos_excel)

        # Generar archivo
        fecha_hoy = datetime.now().strftime("%Y%m%d")
        filename = f"/tmp/TEMPLATE_VALIDACION_DOBLE_{nombre_comisaria}_{fecha_hoy}.xlsx"

        # Crear Excel con formato mejorado
        with pd.ExcelWriter(filename, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='AVANCES_VALIDACION', index=False, header=False)

        print(f"✅ Template generado: {filename}")

        # Mostrar estadísticas
        print(f"\n📊 ESTADÍSTICAS DEL TEMPLATE:")
        print(f"   📋 Partidas incluidas: {len(partidas)}")
        print(f"   🏷️  Códigos únicos: {len(set([p[0] for p in partidas]))}")
        print(f"   💰 Presupuesto total: S/ {sum([p[4] for p in partidas]):,.2f}")

        return filename

    except Exception as e:
        print(f"❌ Error generando template: {str(e)}")
        return None

def mostrar_ejemplo_llenado():
    """Mostrar ejemplo de cómo llenar el Excel"""

    print(f"\n📋 EJEMPLO DE CÓMO LLENAR EL EXCEL:")
    print("=" * 50)

    ejemplo_tabla = [
        ["CODIGO_PARTIDA", "DESCRIPCION", "% AVANCE_EJECUTADO", "OBSERVACIONES"],
        ["01", "OBRAS PROVISIONALES", "0.85", "Casi terminado"],
        ["01.01", "ALMACEN PROVISIONAL", "1.00", "Completado"],
        ["01.02", "MOVILIZACION EQUIPOS", "1.00", "Todo movilizado"],
        ["02.01", "DEMOLICION MUROS", "0.60", "En progreso"],
        ["04.03", "PISOS PAVIMENTOS", "0.25", "Iniciado esta semana"],
    ]

    for fila in ejemplo_tabla:
        print(f"   {fila[0]:<15} | {fila[1]:<25} | {fila[2]:<10} | {fila[3]}")

    print(f"\n💡 REGLAS IMPORTANTES:")
    print(f"   ✅ NO CAMBIES el código ni la descripción")
    print(f"   ✅ Solo llena la columna '% AVANCE_EJECUTADO'")
    print(f"   ✅ Usa decimales: 0.50 = 50%, 0.85 = 85%")
    print(f"   ✅ Agrega observaciones si quieres")
    print(f"   ❌ Si cambias código/descripción = VALIDACIÓN FALLA")

def mostrar_flujo_validacion():
    """Explicar el flujo de validación doble"""

    print(f"\n🛡️ FLUJO DE VALIDACIÓN DOBLE:")
    print("=" * 40)
    print(f"1. 📤 Subes Excel con códigos + descripciones")
    print(f"2. 🔍 Sistema valida CADA partida:")
    print(f"   ✓ ¿Existe el código?")
    print(f"   ✓ ¿La descripción coincide exactamente?")
    print(f"3. ✅ Si todo coincide → PERMITE importar avances")
    print(f"4. ❌ Si algo cambió → BLOQUEA e informa diferencias")
    print(f"5. 💡 Sugiere actualizar cronograma primero")

    print(f"\n🚨 CASOS QUE DETECTA:")
    print(f"   • Código 01.01: 'TECHO COCINA' → 'TANQUE AGUA' ❌")
    print(f"   • Código nuevo que no existe en BD ❌")
    print(f"   • Partida eliminada del cronograma ❌")
    print(f"   • Descripción con typos ❌")

if __name__ == "__main__":
    print("🛡️ GENERADOR TEMPLATE VALIDACIÓN DOBLE - NEMAEC ERP")
    print("=" * 70)

    # Generar template para Collique (tiene más partidas)
    template_path = generar_template_validacion_doble(
        comisaria_id=4,
        nombre_comisaria="COLLIQUE"
    )

    if template_path:
        mostrar_ejemplo_llenado()
        mostrar_flujo_validacion()

        print(f"\n🎯 ARCHIVO LISTO PARA USAR:")
        print(f"📁 {template_path}")
        print(f"\n🔄 SIGUIENTE PASO:")
        print(f"1. Abre el Excel generado")
        print(f"2. Llena solo la columna '% AVANCE_EJECUTADO'")
        print(f"3. Prueba subir al sistema para validar")
    else:
        print(f"❌ No se pudo generar el template")