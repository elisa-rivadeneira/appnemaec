#!/usr/bin/env python3
"""
📊 ANÁLISIS DE EXCEL DE SEGUIMIENTO DE AVANCES FÍSICOS
Analiza la estructura del Excel de seguimiento para diseñar la implementación
"""

import pandas as pd
import os
import sys

def analyze_excel_file(file_path):
    """Analiza todas las hojas del Excel de seguimiento"""

    if not os.path.exists(file_path):
        print(f"❌ No se encuentra el archivo: {file_path}")
        return

    print(f"📊 ANÁLISIS DEL EXCEL DE SEGUIMIENTO")
    print(f"📁 Archivo: {os.path.basename(file_path)}")
    print("=" * 80)

    try:
        # Leer todas las hojas del Excel
        excel_file = pd.ExcelFile(file_path)
        print(f"📋 HOJAS ENCONTRADAS: {len(excel_file.sheet_names)}")

        for i, sheet_name in enumerate(excel_file.sheet_names, 1):
            print(f"  {i}. {sheet_name}")
        print()

        # Analizar cada hoja
        for sheet_name in excel_file.sheet_names:
            print(f"📄 ANÁLISIS DE HOJA: '{sheet_name}'")
            print("-" * 60)

            try:
                df = pd.read_excel(file_path, sheet_name=sheet_name)

                print(f"📏 Dimensiones: {df.shape[0]} filas x {df.shape[1]} columnas")

                if df.empty:
                    print("   ⚠️  Hoja vacía")
                    print()
                    continue

                print(f"📋 Columnas encontradas ({len(df.columns)}):")
                for i, col in enumerate(df.columns, 1):
                    # Manejar columnas sin nombre
                    col_name = col if not pd.isna(col) and str(col).strip() != '' else f"[Sin nombre {i}]"
                    print(f"   {i:2d}. {col_name}")
                print()

                # Mostrar las primeras 5 filas (solo primeras 6 columnas para no saturar)
                print(f"📋 MUESTRA DE DATOS (primeras 5 filas):")
                sample_df = df.head(5)
                if len(df.columns) > 6:
                    sample_df = sample_df.iloc[:, :6]  # Solo primeras 6 columnas
                    print("   (Mostrando solo las primeras 6 columnas)")

                # Reemplazar valores NaN con [vacío] para mejor visualización
                sample_df_clean = sample_df.fillna('[vacío]')
                print(sample_df_clean.to_string(index=True, max_cols=6))
                print()

                # Buscar patrones específicos para seguimiento
                if sheet_name.lower() == 'control':
                    print("🎯 ANÁLISIS ESPECIAL - HOJA 'CONTROL':")

                    # Buscar columnas que podrían tener porcentajes
                    percent_cols = []
                    for col in df.columns:
                        if pd.notna(col):
                            col_str = str(col).lower()
                            if any(keyword in col_str for keyword in ['%', 'porcentaje', 'avance', 'progreso']):
                                percent_cols.append(col)

                    if percent_cols:
                        print(f"   📊 Columnas con posibles porcentajes: {percent_cols}")

                    # Buscar datos numéricos que podrían ser porcentajes
                    numeric_cols = df.select_dtypes(include=['number']).columns
                    print(f"   🔢 Columnas numéricas encontradas: {len(numeric_cols)}")

                    for col in numeric_cols[:5]:  # Solo las primeras 5
                        if not df[col].empty:
                            non_null_values = df[col].dropna()
                            if len(non_null_values) > 0:
                                min_val = non_null_values.min()
                                max_val = non_null_values.max()
                                print(f"     - {col}: rango [{min_val:.2f} - {max_val:.2f}]")

                elif sheet_name.lower() == 'plan':
                    print("📈 ANÁLISIS ESPECIAL - HOJA 'PLAN':")
                    print("   Esta hoja probablemente contendrá las curvas de evolución")

                    # Buscar columnas relacionadas con fechas
                    date_cols = []
                    for col in df.columns:
                        if pd.notna(col):
                            col_str = str(col).lower()
                            if any(keyword in col_str for keyword in ['fecha', 'date', 'tiempo', 'día', 'semana']):
                                date_cols.append(col)

                    if date_cols:
                        print(f"   📅 Columnas relacionadas con fechas: {date_cols}")

                print()

            except Exception as e:
                print(f"   ❌ Error al leer hoja '{sheet_name}': {str(e)}")
                print()

    except Exception as e:
        print(f"❌ Error al abrir el archivo Excel: {str(e)}")
        return

if __name__ == "__main__":
    # Ruta del archivo
    file_path = "/home/oem/Downloads/SEGUIMIENTO CPNP CARABAYLLO AL 19 DE FEBRERO - 21 DIAS (1).xlsx"

    print("🔍 ANALIZADOR DE EXCEL DE SEGUIMIENTO - NEMAEC ERP")
    print("=" * 80)

    analyze_excel_file(file_path)

    print("\n" + "=" * 80)
    print("✅ ANÁLISIS COMPLETADO")
    print("\nEste análisis nos ayudará a diseñar:")
    print("1. 📊 Estructura de datos para seguimiento de avances")
    print("2. 📈 Gráficas de evolución (programado vs físico)")
    print("3. 🗄️  Modelo de base de datos para avances")
    print("4. 📤 Sistema de importación de reportes de seguimiento")