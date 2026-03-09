#!/usr/bin/env python3
"""
📊 ANÁLISIS DETALLADO DEL EXCEL DE SEGUIMIENTO
Análisis más profundo de la estructura del Excel
"""

import pandas as pd
import numpy as np

def analyze_control_sheet(file_path):
    """Analiza específicamente la hoja CONTROL"""
    print("🎯 ANÁLISIS DETALLADO - HOJA 'CONTROL'")
    print("=" * 60)

    try:
        # Leer la hoja CONTROL sin especificar header
        df = pd.read_excel(file_path, sheet_name='CONTROL', header=None)
        print(f"📏 Dimensiones reales: {df.shape[0]} filas x {df.shape[1]} columnas")

        # Buscar el header real (primera fila con datos relevantes)
        print("\n🔍 BUSCANDO ESTRUCTURA DEL CRONOGRAMA...")
        for i in range(min(15, len(df))):
            row_data = df.iloc[i]
            non_null_values = [str(val) for val in row_data if not pd.isna(val) and str(val).strip() != '']

            if non_null_values:
                print(f"Fila {i:2d}: {' | '.join(non_null_values[:8])}...")  # Solo primeros 8 valores

        # Buscar patrones específicos de seguimiento
        print("\n📊 BUSCANDO DATOS DE AVANCE...")

        # Buscar filas que contengan información de partidas
        for i in range(len(df)):
            row = df.iloc[i]
            row_text = ' '.join([str(val) for val in row if not pd.isna(val)]).lower()

            # Buscar palabras clave que indiquen avances o porcentajes
            keywords = ['%', 'porcentaje', 'avance', 'ejecutado', 'programado', 'acumulado']
            if any(keyword in row_text for keyword in keywords):
                print(f"Fila {i:2d} (posible avance): {' | '.join([str(val) for val in row[:10] if not pd.isna(val)])}")

        # Buscar columnas numéricas que podrían ser avances
        print("\n🔢 ANÁLISIS DE DATOS NUMÉRICOS...")
        for col_idx in range(df.shape[1]):
            col_data = df.iloc[:, col_idx]

            # Filtrar valores numéricos
            numeric_values = []
            for val in col_data:
                try:
                    if not pd.isna(val) and isinstance(val, (int, float)):
                        numeric_values.append(float(val))
                    elif not pd.isna(val):
                        # Intentar convertir strings que podrían ser números
                        val_str = str(val).replace('%', '').replace(',', '').strip()
                        if val_str.replace('.', '').replace('-', '').isdigit():
                            numeric_values.append(float(val_str))
                except:
                    pass

            if len(numeric_values) > 5:  # Si hay al menos 5 valores numéricos
                min_val = min(numeric_values)
                max_val = max(numeric_values)
                avg_val = sum(numeric_values) / len(numeric_values)

                # Si los valores parecen porcentajes (0-100) o decimales (0-1)
                if (0 <= max_val <= 1 and len([v for v in numeric_values if 0 <= v <= 1]) > len(numeric_values) * 0.7) or \
                   (0 <= max_val <= 100 and len([v for v in numeric_values if 0 <= v <= 100]) > len(numeric_values) * 0.7):
                    print(f"Columna {col_idx:2d}: {len(numeric_values)} valores numéricos")
                    print(f"            Rango: [{min_val:.3f} - {max_val:.3f}] (promedio: {avg_val:.3f})")
                    print(f"            Posibles porcentajes: {'SÍ' if max_val <= 1 else 'SÍ (escala 0-100)' if max_val <= 100 else 'NO'}")

    except Exception as e:
        print(f"❌ Error al analizar hoja CONTROL: {str(e)}")

def analyze_plan_sheet(file_path):
    """Analiza específicamente la hoja PLAN"""
    print("\n📈 ANÁLISIS DETALLADO - HOJA 'PLAN'")
    print("=" * 60)

    try:
        # Leer la hoja PLAN sin especificar header
        df = pd.read_excel(file_path, sheet_name='PLAN', header=None)
        print(f"📏 Dimensiones reales: {df.shape[0]} filas x {df.shape[1]} columnas")

        # Mostrar todas las filas para entender la estructura
        print("\n🔍 ESTRUCTURA COMPLETA DE LA HOJA PLAN:")
        for i in range(len(df)):
            row_data = df.iloc[i]
            non_null_values = [str(val) for val in row_data if not pd.isna(val) and str(val).strip() != '']

            if non_null_values:
                print(f"Fila {i:2d}: {' | '.join(non_null_values)}")

        # Buscar datos de curvas (avance planificado vs real)
        print("\n📊 BUSCANDO DATOS DE CURVAS DE AVANCE...")

        for i in range(len(df)):
            row = df.iloc[i]
            row_text = ' '.join([str(val) for val in row if not pd.isna(val)]).lower()

            if any(keyword in row_text for keyword in ['planificado', 'real', 'ejecutado', 'acum', 'curva']):
                print(f"Fila {i:2d} (curva): {' | '.join([str(val) for val in row if not pd.isna(val)])}")

    except Exception as e:
        print(f"❌ Error al analizar hoja PLAN: {str(e)}")

if __name__ == "__main__":
    file_path = "/home/oem/Downloads/SEGUIMIENTO CPNP CARABAYLLO AL 19 DE FEBRERO - 21 DIAS (1).xlsx"

    print("🔍 ANÁLISIS DETALLADO DEL EXCEL DE SEGUIMIENTO")
    print("=" * 80)

    analyze_control_sheet(file_path)
    analyze_plan_sheet(file_path)

    print("\n" + "=" * 80)
    print("✅ ANÁLISIS COMPLETADO")
    print("\n📋 PROPUESTA DE ARQUITECTURA:")
    print("1. 📊 Módulo 'Seguimiento de Avances'")
    print("2. 🗄️  Tablas: avances_fisicos, puntos_avance")
    print("3. 📈 Gráficas: curva_programada vs curva_real")
    print("4. 📤 Importador de reportes de seguimiento semanal")