#!/usr/bin/env python3
"""
📊 GENERADOR DE TEMPLATE DE SEGUIMIENTO DE AVANCES
Crea un Excel template para subir avances físicos diarios
"""

import pandas as pd
from datetime import datetime

def create_seguimiento_template():
    """Crea un template de Excel para seguimiento de avances físicos"""

    print("📊 CREANDO TEMPLATE DE SEGUIMIENTO DE AVANCES FÍSICOS")
    print("=" * 60)

    # Datos de ejemplo basados en el análisis del Excel real
    template_data = [
        # Header information
        ["CRONOGRAMA VALORIZADO - SEGUIMIENTO DIARIO", "", "", "", "", "", ""],
        ["", "", "", "", "", "", ""],
        ["FECHA DE CORTE:", "2026-02-20", "", "", "", "", ""],
        ["AVANCE EJECUTADO ACUMULADO:", "0.5477", "", "DIAS TRANSCURRIDOS:", "22", "", ""],
        ["OBSERVACIONES:", "Avance dentro de lo programado", "", "", "", "", ""],
        ["", "", "", "", "", "", ""],

        # Table headers
        ["ITEM", "CODIGO_PARTIDA", "DESCRIPCION", "UNIDAD", "METRADO", "PRECIO_TOTAL", "% AVANCE_EJECUTADO"],

        # Sample data rows
        [1, "01", "OBRAS PROVISIONALES", "GLB", 0, 9914.54, 0.85],
        [2, "01.01", "ALMACEN PROVISIONAL", "MES", 1.5, 750, 1.0],
        [3, "01.02", "MOVILIZACION EQUIPOS", "GLB", 1, 500, 1.0],
        [4, "01.03", "ENERGIA ELECTRICA PROVISIONAL", "GLB", 1, 593.04, 0.8],
        [5, "01.04", "PLAN SEGURIDAD Y SALUD", "GLB", 1, 3000, 1.0],
        [6, "01.05", "EQUIPOS PROTECCION INDIVIDUAL", "GLB", 1, 5061.5, 0.6],
        [7, "02", "DEMOLICION Y DESMONTAJE", "GLB", 0, 15420.75, 0.4],
        [8, "02.01", "DESMONTAJE ARTEFACTOS", "UND", 75, 1081.5, 0.5],
        [9, "02.02", "DEMOLICION MUROS ALBAÑILERIA", "M2", 35.36, 2127.78, 0.3],
        [10, "03", "ESTRUCTURAS", "GLB", 0, 2500.0, 0.0],
        [11, "03.01", "CONCRETO ARMADO", "M3", 2.5, 2500.0, 0.0],
        [12, "04", "ARQUITECTURA", "GLB", 0, 85430.25, 0.25],
        [13, "04.01", "MUROS Y TABIQUERIA", "M2", 45.2, 4521.2, 0.4],
        [14, "04.02", "REVOQUES ENLUCIDOS", "M2", 120.5, 8540.5, 0.2],
        [15, "04.03", "PISOS Y PAVIMENTOS", "M2", 95.8, 12450.8, 0.1],
    ]

    # Crear DataFrame
    df = pd.DataFrame(template_data)

    # Crear el archivo Excel
    template_filename = f"/tmp/TEMPLATE_SEGUIMIENTO_AVANCES.xlsx"

    with pd.ExcelWriter(template_filename, engine='openpyxl') as writer:
        # Escribir hoja CONTROL
        df.to_excel(writer, sheet_name='CONTROL', index=False, header=False)

        # Crear hoja PLAN (opcional, para curvas)
        plan_data = [
            ["CUADRO SEGUIMIENTO - CURVAS DE AVANCE", "", "", "", ""],
            ["", "", "", "", ""],
            ["FECHA", "DIAS", "AV. PROGRAMADO ACUM", "AV. EJECUTADO ACUM", "DIFERENCIA"],
            ["2026-02-05", 7, 0.0856, 0.0572, -0.0284],
            ["2026-02-12", 15, 0.2989, 0.2833, -0.0156],
            ["2026-02-19", 21, 0.4722, 0.5477, 0.0755],
            ["2026-02-26", 30, 0.7522, "", ""],
            ["2026-03-05", 37, 0.9078, "", ""],
            ["2026-03-12", 42, 0.9800, "", ""],
            ["2026-03-15", 45, 1.0000, "", ""],
        ]

        plan_df = pd.DataFrame(plan_data)
        plan_df.to_excel(writer, sheet_name='PLAN', index=False, header=False)

    print(f"✅ Template creado: {template_filename}")
    print("\n📋 ESTRUCTURA DEL TEMPLATE:")
    print("├─ HOJA 'CONTROL': Datos de avances por partida")
    print("├─ HOJA 'PLAN': Curvas de seguimiento (opcional)")
    print("└─ Formato compatible con el sistema NEMAEC ERP")
    print("\n🔧 CAMPOS CLAVE:")
    print("- Fila 3: FECHA DE CORTE (obligatorio)")
    print("- Fila 4: AVANCE EJECUTADO ACUMULADO (obligatorio)")
    print("- Columna F: PRECIO_TOTAL por partida")
    print("- Columna G: % AVANCE_EJECUTADO (0.0 a 1.0)")
    print(f"\n📁 Archivo guardado en: {template_filename}")

    return template_filename

if __name__ == "__main__":
    template_file = create_seguimiento_template()

    print("\n" + "=" * 60)
    print("🚀 INSTRUCCIONES DE USO:")
    print("1. Descargar el template generado")
    print("2. Completar los % de avance por partida")
    print("3. Actualizar la fecha de corte")
    print("4. Subir al sistema NEMAEC ERP")
    print("5. El sistema detectará automáticamente:")
    print("   - Avance total de la obra")
    print("   - Avances por partida")
    print("   - Comparación vs cronograma programado")
    print("   - Alertas de retrasos/adelantos")