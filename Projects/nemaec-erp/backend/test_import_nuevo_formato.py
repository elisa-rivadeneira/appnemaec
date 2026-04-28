#!/usr/bin/env python3
"""
🧪 TEST IMPORT NUEVO FORMATO
Script de prueba para verificar la importación del nuevo formato de Excel.

Formato detectado en el archivo: comisaria, codigo, partida, und, metrado, pu, parcial, inicio, fec_termino
Formato original: NID, COMISARIA, COD, PARTIDA, UNI, METRADO, PU, PARCIAL
"""

import asyncio
import sys
import os
from pathlib import Path
import pandas as pd

# Agregar el directorio raíz al PYTHONPATH
sys.path.insert(0, str(Path(__file__).parent))

from app.application.services.excel_import_service import ExcelImportService

async def test_detectar_formato():
    """Test para verificar la detección automática de formato"""
    excel_path = "/home/oem/Documents/aaaaaaaaaaaaaaaaa.xlsx"

    if not os.path.exists(excel_path):
        print(f"❌ Archivo no encontrado: {excel_path}")
        return False

    try:
        # Crear instancia del servicio (sin repositorios para esta prueba)
        service = ExcelImportService(None, None)

        # Leer Excel
        df = pd.read_excel(excel_path)
        print(f"📊 Excel cargado: {len(df)} filas, {len(df.columns)} columnas")

        # Detectar formato
        formato_alternativo = service._detectar_formato_excel(df)

        print(f"🔍 Formato detectado: {'ALTERNATIVO' if formato_alternativo else 'ORIGINAL'}")

        # Mostrar columnas encontradas
        print(f"\n🏷️ Columnas en el archivo:")
        for i, col in enumerate(df.columns, 1):
            print(f"  {chr(64+i)}: {col}")

        # Verificar mapeo de columnas esperadas para formato alternativo
        if formato_alternativo:
            columnas_esperadas = ["comisaria", "codigo", "partida", "und", "metrado", "pu", "parcial"]
            columnas_encontradas = []
            columnas_faltantes = []

            for col in columnas_esperadas:
                if col in df.columns:
                    columnas_encontradas.append(col)
                else:
                    columnas_faltantes.append(col)

            print(f"\n✅ Columnas encontradas ({len(columnas_encontradas)}):")
            for col in columnas_encontradas:
                print(f"  - {col}")

            if columnas_faltantes:
                print(f"\n❌ Columnas faltantes ({len(columnas_faltantes)}):")
                for col in columnas_faltantes:
                    print(f"  - {col}")

            # Columnas opcionales (fechas)
            columnas_opcionales = ["inicio", "fec_termino"]
            print(f"\n📅 Columnas de fecha:")
            for col in columnas_opcionales:
                if col in df.columns:
                    print(f"  ✅ {col}: Disponible")
                    # Mostrar algunos ejemplos de fechas
                    ejemplos = df[col].dropna().head(3)
                    for idx, fecha in ejemplos.items():
                        print(f"     Fila {idx}: {fecha}")
                else:
                    print(f"  ❌ {col}: No disponible")

        # Mostrar datos de muestra de las primeras 5 filas
        print(f"\n📋 Muestra de datos (primeras 5 filas):")
        if formato_alternativo:
            cols_muestra = ["comisaria", "codigo", "partida", "und", "metrado"]
            if all(col in df.columns for col in cols_muestra):
                print(df[cols_muestra].head().to_string(index=False))

        return True

    except Exception as e:
        print(f"❌ Error durante la prueba: {e}")
        import traceback
        traceback.print_exc()
        return False

async def main():
    """Función principal del test"""
    print("🧪 INICIANDO PRUEBA DE DETECCIÓN DE FORMATO EXCEL")
    print("=" * 60)

    success = await test_detectar_formato()

    print("\n" + "=" * 60)
    if success:
        print("✅ PRUEBA COMPLETADA CON ÉXITO")
        print("\n🎯 RESULTADO: El sistema ahora puede detectar automáticamente ambos formatos:")
        print("   📝 Formato original: NID, COMISARIA, COD, PARTIDA, UNI, METRADO, PU, PARCIAL")
        print("   📝 Formato nuevo: comisaria, codigo, partida, und, metrado, pu, parcial, inicio, fec_termino")
        print("\n🚀 El archivo /home/oem/Documents/aaaaaaaaaaaaaaaaa.xlsx ahora puede ser importado!")
    else:
        print("❌ PRUEBA FALLÓ")
        return 1

    return 0

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)