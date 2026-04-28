#!/usr/bin/env python3
"""
🚀 SCRIPT DE IMPORTACIÓN MASIVA DE COMISARÍAS Y CRONOGRAMAS
Crea 20 comisarías e importa sus cronogramas automáticamente
"""

import os
import requests
import json
from pathlib import Path

# Configuración del API
API_BASE = "http://localhost:8000/api/v1"

# Datos de las 20 comisarías basados en los archivos
COMISARIAS_DATA = [
    {"nombre": "Alfonso Ugarte", "codigo": "ALF-001", "distrito": "Lima", "archivo": "REPORTE_ALFONSO UGARTE.xls"},
    {"nombre": "Carabayllo", "codigo": "CAR-002", "distrito": "Carabayllo", "archivo": "REPORTE_CARABAYLLO.xls"},
    {"nombre": "Chancay", "codigo": "CHA-003", "distrito": "Chancay", "archivo": "REPORTE_CHANCAY.xls"},
    {"nombre": "Ciudad y Campo", "codigo": "CYC-004", "distrito": "Lima", "archivo": "REPORTE_CIUDAD Y CAMPO.xls"},
    {"nombre": "Collique", "codigo": "COL-005", "distrito": "Comas", "archivo": "REPORTE_COLLIQUE.xls"},
    {"nombre": "Ensenada", "codigo": "ENS-006", "distrito": "Ancón", "archivo": "REPORTE_ENSENADA.xls"},
    {"nombre": "Jicamarca", "codigo": "JIC-007", "distrito": "San Antonio", "archivo": "REPORTE_JICAMARCA.xls"},
    {"nombre": "José Gálvez", "codigo": "JGA-008", "distrito": "Lima", "archivo": "REPORTE_JOSE GALVEZ.xls"},
    {"nombre": "Mariscal Cáceres", "codigo": "MCA-009", "distrito": "Lima", "archivo": "REPORTE_MARISCAL CACERES.xls"},
    {"nombre": "Pamplona", "codigo": "PAM-010", "distrito": "San Juan de Miraflores", "archivo": "REPORTE_PAMPLONA.xls"},
    {"nombre": "Pro", "codigo": "PRO-011", "distrito": "Lima", "archivo": "REPORTE_PRO.xls"},
    {"nombre": "San Antonio de Jicamarca", "codigo": "SAJ-012", "distrito": "San Antonio", "archivo": "REPORTE_SAJICAMARCA.xls"},
    {"nombre": "San Cayetano", "codigo": "SCA-013", "distrito": "San Martín de Porres", "archivo": "REPORTE_SAN CAYETANO.xls"},
    {"nombre": "San Cosme", "codigo": "SCO-014", "distrito": "La Victoria", "archivo": "REPORTE_SAN COSME.xls"},
    {"nombre": "San Genaro", "codigo": "SGE-015", "distrito": "Los Olivos", "archivo": "REPORTE_SAN GENARO.xls"},
    {"nombre": "Santa Anita", "codigo": "SAN-016", "distrito": "Santa Anita", "archivo": "REPORTE_SANTA ANITA.xls"},
    {"nombre": "Santa Clara", "codigo": "SCL-017", "distrito": "Ate", "archivo": "REPORTE_SANTA CLARA.xls"},
    {"nombre": "San Martín de Porres", "codigo": "SMP-018", "distrito": "San Martín de Porres", "archivo": "REPORTE_SMP.xls"},
    {"nombre": "Tahuantinsuyo", "codigo": "TAH-019", "distrito": "Los Olivos", "archivo": "REPORTE_TAHUANTINSUYO.xls"},
    {"nombre": "Villa El Salvador", "codigo": "VES-020", "distrito": "Villa El Salvador", "archivo": "REPORTE_VILLA EL SALVADOR.xls"},
]

# Ubicaciones aproximadas por distrito (coordenadas de ejemplo)
COORDENADAS_DISTRITO = {
    "Lima": {"lat": -12.046374, "lng": -77.042793},
    "Carabayllo": {"lat": -11.857796, "lng": -77.020742},
    "Chancay": {"lat": -11.562092, "lng": -77.265835},
    "Comas": {"lat": -11.913048, "lng": -77.016466},
    "Ancón": {"lat": -11.770070, "lng": -77.153511},
    "San Antonio": {"lat": -11.981592, "lng": -76.822128},
    "San Juan de Miraflores": {"lat": -12.156944, "lng": -76.973333},
    "San Martín de Porres": {"lat": -11.887778, "lng": -77.066667},
    "La Victoria": {"lat": -12.067500, "lng": -77.031944},
    "Los Olivos": {"lat": -11.958333, "lng": -77.066667},
    "Santa Anita": {"lat": -12.047222, "lng": -76.975000},
    "Ate": {"lat": -12.027778, "lng": -76.919722},
    "Villa El Salvador": {"lat": -12.212500, "lng": -76.941667}
}

def crear_comisaria(comisaria_data):
    """Crea una comisaría en el sistema"""

    # Obtener coordenadas del distrito
    coordenadas = COORDENADAS_DISTRITO.get(comisaria_data["distrito"],
                                          {"lat": -12.046374, "lng": -77.042793})

    payload = {
        "nombre": comisaria_data["nombre"],
        "codigo": comisaria_data["codigo"],
        "tipo": "comisaria",
        "estado": "activo",
        "ubicacion": {
            "direccion": "",
            "distrito": comisaria_data["distrito"],
            "provincia": "Lima",
            "departamento": "Lima",
            "coordenadas": coordenadas,
            "google_place_id": None
        },
        "presupuesto_total": 0.0
    }

    try:
        response = requests.post(f"{API_BASE}/comisarias/", json=payload)
        if response.status_code == 201:
            comisaria_id = response.json()["id"]
            print(f"✅ Comisaría creada: {comisaria_data['nombre']} (ID: {comisaria_id})")
            return comisaria_id
        else:
            print(f"❌ Error creando {comisaria_data['nombre']}: {response.text}")
            return None
    except Exception as e:
        print(f"❌ Error de conexión creando {comisaria_data['nombre']}: {e}")
        return None

def importar_cronograma(comisaria_id, comisaria_nombre, archivo_path):
    """Importa el cronograma de una comisaría"""

    if not os.path.exists(archivo_path):
        print(f"❌ Archivo no encontrado: {archivo_path}")
        return False

    try:
        # Preparar el archivo para upload
        with open(archivo_path, 'rb') as f:
            # Para archivos .xls usar el content-type correcto
            content_type = 'application/vnd.ms-excel' if archivo_path.endswith('.xls') else 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            files = {'file': (os.path.basename(archivo_path), f, content_type)}
            data = {
                'comisaria_id': comisaria_id,
                'nombre_cronograma': f"Cronograma {comisaria_nombre}"
            }

            response = requests.post(f"{API_BASE}/cronogramas/import", files=files, data=data)

            if response.status_code in [200, 201]:
                result = response.json()
                partidas_importadas = result.get('valid_partidas', result.get('partidas_creadas', 0))
                print(f"✅ Cronograma importado para {comisaria_nombre}: {partidas_importadas} partidas")
                return True
            else:
                print(f"❌ Error importando cronograma para {comisaria_nombre}: {response.text}")
                return False

    except Exception as e:
        print(f"❌ Error de conexión importando cronograma para {comisaria_nombre}: {e}")
        return False

def main():
    """Función principal de importación masiva"""

    print("🚀 INICIANDO IMPORTACIÓN MASIVA DE COMISARÍAS Y CRONOGRAMAS")
    print("=" * 70)

    # Verificar que el servidor esté corriendo
    try:
        response = requests.get(f"{API_BASE}/comisarias/")
        print(f"✅ Servidor API activo. Comisarías existentes: {len(response.json())}")
    except Exception as e:
        print(f"❌ Error: El servidor API no está disponible. Asegúrate de que esté corriendo en puerto 8000")
        return

    # Directorio de archivos
    archivos_dir = "/home/oem/Documents/REPORTES COMISARIAS SGP"

    total_creadas = 0
    total_importadas = 0

    print("\\n📋 CREANDO COMISARÍAS E IMPORTANDO CRONOGRAMAS:")
    print("-" * 70)

    for i, comisaria_data in enumerate(COMISARIAS_DATA, 1):
        print(f"\\n[{i}/20] Procesando: {comisaria_data['nombre']}")

        # 1. Crear la comisaría
        comisaria_id = crear_comisaria(comisaria_data)
        if comisaria_id:
            total_creadas += 1

            # 2. Importar el cronograma
            archivo_path = os.path.join(archivos_dir, comisaria_data["archivo"])
            if importar_cronograma(comisaria_id, comisaria_data["nombre"], archivo_path):
                total_importadas += 1

        print("-" * 50)

    print("\\n🎉 RESUMEN DE IMPORTACIÓN:")
    print("=" * 70)
    print(f"✅ Comisarías creadas: {total_creadas}/20")
    print(f"✅ Cronogramas importados: {total_importadas}/20")
    print(f"✅ Proceso completado!")

    if total_creadas == 20 and total_importadas == 20:
        print("\\n🎯 ¡IMPORTACIÓN EXITOSA! Todas las comisarías y cronogramas han sido procesados.")
    else:
        print(f"\\n⚠️  Algunos elementos no pudieron ser procesados. Revisa los logs arriba.")

if __name__ == "__main__":
    main()