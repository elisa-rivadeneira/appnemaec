#!/usr/bin/env python3
"""
📊 TEMPLATE OPTIMIZADO DE SEGUIMIENTO DE AVANCES
Solo campos esenciales, sin duplicación de datos
"""

import pandas as pd
from datetime import datetime

def create_optimized_template():
    """Crea template optimizado con solo lo esencial"""

    print("📊 CREANDO TEMPLATE OPTIMIZADO DE SEGUIMIENTO")
    print("=" * 50)

    # Template simplificado - Solo lo necesario
    template_data = [
        # Header mínimo
        ["SEGUIMIENTO AVANCES - CARABAYLLO", "", ""],
        ["", "", ""],
        ["FECHA DE CORTE:", "2026-02-20", ""],
        ["AVANCE TOTAL EJECUTADO:", "0.5477", ""],
        ["", "", ""],

        # Header de tabla simplificada
        ["CODIGO_PARTIDA", "% AVANCE_EJECUTADO", "OBSERVACIONES"],

        # Datos mínimos - Solo código y porcentaje
        ["01", "0.85", "Obras provisionales casi terminadas"],
        ["01.01", "1.00", "Almacén completado"],
        ["01.02", "1.00", "Movilización completa"],
        ["01.03", "0.80", "Energía eléctrica avanzada"],
        ["01.04", "1.00", "Plan seguridad implementado"],
        ["01.05", "0.60", "EPIs distribuidos parcialmente"],
        ["02", "0.40", "Demolición en proceso"],
        ["02.01", "0.50", "Desmontaje de artefactos"],
        ["02.02", "0.30", "Demolición muros iniciada"],
        ["03", "0.00", "Estructuras no iniciadas"],
        ["03.01", "0.00", "Concreto pendiente"],
        ["04", "0.25", "Arquitectura iniciada"],
        ["04.01", "0.40", "Muros en proceso"],
        ["04.02", "0.20", "Revoques iniciados"],
        ["04.03", "0.10", "Pisos en preparación"],
    ]

    # Crear DataFrame
    df = pd.DataFrame(template_data)

    # Guardar template optimizado
    filename = "/tmp/TEMPLATE_AVANCES_OPTIMIZADO.xlsx"

    with pd.ExcelWriter(filename, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name='AVANCES', index=False, header=False)

    print(f"✅ Template optimizado creado: {filename}")
    print("\n📋 VENTAJAS DEL NUEVO FORMATO:")
    print("├─ 🎯 Solo 2-3 columnas esenciales")
    print("├─ ⚡ Sin duplicación de datos de BD")
    print("├─ 🛡️ Validación automática de códigos")
    print("├─ 📊 Cálculo automático de montos")
    print("└─ 🚀 Más rápido de llenar")

    print("\n🔧 CAMPOS REQUERIDOS:")
    print("├─ Fila 3: FECHA DE CORTE (YYYY-MM-DD)")
    print("├─ Fila 4: AVANCE TOTAL (decimal 0-1)")
    print("├─ Col A: CODIGO_PARTIDA (debe existir en BD)")
    print("└─ Col B: % AVANCE_EJECUTADO (decimal 0-1)")

    print("\n📊 LO QUE NO NECESITAS PONER:")
    print("├─ ❌ Descripción (se obtiene de BD)")
    print("├─ ❌ Unidad (se obtiene de BD)")
    print("├─ ❌ Metrado (se obtiene de BD)")
    print("├─ ❌ Precio unitario (se obtiene de BD)")
    print("└─ ✅ Solo códigos y porcentajes!")

    return filename

if __name__ == "__main__":
    template_file = create_optimized_template()

    print("\n" + "=" * 50)
    print("🚀 FLUJO DE TRABAJO OPTIMIZADO:")
    print("1. Descargar template optimizado")
    print("2. Llenar SOLO los % de avance")
    print("3. Actualizar fecha de corte")
    print("4. Subir al sistema")
    print("5. El sistema automáticamente:")
    print("   - Valida códigos de partida")
    print("   - Obtiene datos de BD (precio, descripción, etc)")
    print("   - Calcula montos ejecutados")
    print("   - Genera curvas de seguimiento")
    print("   - Crea alertas si hay retrasos")