#!/usr/bin/env python3
"""
🎯 TEST DE EVOLUCIÓN HISTÓRICA
Simula las funcionalidades implementadas para avances temporales
"""

import sqlite3
from datetime import datetime, date, timedelta

def calcular_avance_programado_fecha(fecha_corte, partidas):
    """Simula cálculo de avance programado para una fecha específica"""
    avance_total = 0.0
    total_partidas = len(partidas)

    if total_partidas == 0:
        return 0.0

    for partida in partidas:
        fecha_inicio = datetime.strptime(partida[0][:10], "%Y-%m-%d").date() if partida[0] else None
        fecha_fin = datetime.strptime(partida[1][:10], "%Y-%m-%d").date() if partida[1] else None

        if not fecha_inicio or not fecha_fin:
            avance_partida = 0.0
        elif fecha_corte < fecha_inicio:
            avance_partida = 0.0
        elif fecha_corte >= fecha_fin:
            avance_partida = 100.0
        else:
            # Interpolación lineal
            total_dias = (fecha_fin - fecha_inicio).days
            dias_transcurridos = (fecha_corte - fecha_inicio).days
            if total_dias > 0:
                avance_partida = (dias_transcurridos / total_dias) * 100
            else:
                avance_partida = 100.0

        avance_total += avance_partida

    return round(avance_total / total_partidas, 2)

def main():
    print("📈 EVOLUCIÓN HISTÓRICA - NEMAEC ERP")
    print("=" * 50)

    # Conectar a la base de datos
    conn = sqlite3.connect('nemaec_erp.db')
    cursor = conn.cursor()

    # Obtener avances físicos históricos
    cursor.execute('''
        SELECT fecha_reporte, avance_ejecutado_acum, observaciones, archivo_seguimiento
        FROM avances_fisicos
        WHERE comisaria_id = 5
        ORDER BY fecha_reporte
    ''')
    avances_fisicos = cursor.fetchall()

    # Obtener partidas con fechas (para calcular avance programado)
    cursor.execute('''
        SELECT fecha_inicio, fecha_fin, precio_total
        FROM partidas
        WHERE comisaria_id = 5 AND fecha_inicio IS NOT NULL AND fecha_fin IS NOT NULL
    ''')
    partidas = cursor.fetchall()

    print(f"📊 Datos encontrados:")
    print(f"   • {len(avances_fisicos)} reportes de avance físico")
    print(f"   • {len(partidas)} partidas con cronograma\n")

    # Procesar evolución histórica
    evolucion = []
    for avance in avances_fisicos:
        fecha_str, avance_ejecutado, observaciones, archivo = avance
        fecha_reporte = datetime.strptime(fecha_str, "%Y-%m-%d").date()

        # Calcular avance programado para esa fecha
        avance_programado = calcular_avance_programado_fecha(fecha_reporte, partidas)

        evolucion.append({
            "fecha": fecha_str,
            "avance_fisico": float(avance_ejecutado) * 100,
            "avance_programado": avance_programado,
            "observaciones": observaciones,
            "archivo": archivo
        })

    # Mostrar resultados
    print("📈 EVOLUCIÓN TEMPORAL DE AVANCES:")
    print("-" * 80)
    print(f"{'FECHA':<12} {'FÍSICO':<8} {'PROGRAMADO':<12} {'DIFERENCIA':<12} {'OBSERVACIONES':<20}")
    print("-" * 80)

    for punto in evolucion:
        diferencia = punto["avance_fisico"] - punto["avance_programado"]
        estado = "🟢" if diferencia >= 0 else "🔴"

        print(f"{punto['fecha']:<12} {punto['avance_fisico']:>6.1f}% {punto['avance_programado']:>10.1f}% {diferencia:>+10.1f}% {estado} {punto['observaciones']:<20}")

    # Calcular métricas
    if evolucion:
        ultimo_punto = evolucion[-1]
        print("\n📊 MÉTRICAS ACTUALES:")
        print(f"   • Avance físico actual: {ultimo_punto['avance_fisico']:.1f}%")
        print(f"   • Avance programado: {ultimo_punto['avance_programado']:.1f}%")
        print(f"   • Estado: {'ADELANTADO' if ultimo_punto['avance_fisico'] >= ultimo_punto['avance_programado'] else 'ATRASADO'}")

    conn.close()

    # Generar datos para gráfica (formato JSON)
    print("\n🎯 DATOS PARA GRÁFICA (formato JSON):")
    print("```json")
    print({
        "comisaria_id": 5,
        "total_reportes": len(evolucion),
        "evolucion": evolucion
    })
    print("```")

if __name__ == "__main__":
    main()