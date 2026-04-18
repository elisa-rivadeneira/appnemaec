#!/usr/bin/env python3
"""
Script para limpiar partidas duplicadas en la base de datos
Mantiene la partida más reciente (ID más alto) cuando hay duplicados por código
"""

import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.core.database import get_async_db
from app.infrastructure.database.models import PartidaModel

async def cleanup_duplicate_partidas():
    """Eliminar partidas duplicadas, manteniendo la más reciente por código."""
    async for db in get_async_db():
        try:
            # Buscar todas las partidas ordenadas por comisaria_id y codigo_partida
            stmt = select(PartidaModel).order_by(
                PartidaModel.comisaria_id,
                PartidaModel.codigo_partida,
                PartidaModel.id.desc()
            )
            result = await db.execute(stmt)
            all_partidas = result.scalars().all()

            # Agrupar por comisaria_id + codigo_partida
            partidas_to_keep = {}
            partidas_to_delete = []

            for partida in all_partidas:
                key = (partida.comisaria_id, partida.codigo_partida)

                if key not in partidas_to_keep:
                    # Primera vez que vemos este código en esta comisaría, la guardamos
                    partidas_to_keep[key] = partida
                else:
                    # Es un duplicado, marcar para eliminar
                    partidas_to_delete.append(partida)

            print(f"Encontradas {len(partidas_to_delete)} partidas duplicadas para eliminar")

            if partidas_to_delete:
                # Eliminar duplicados
                for partida in partidas_to_delete:
                    print(f"Eliminando duplicado: ID {partida.id} - {partida.codigo_partida} - Comisaría {partida.comisaria_id}")
                    await db.delete(partida)

                await db.commit()
                print("✅ Limpieza de duplicados completada")
            else:
                print("✅ No se encontraron duplicados")

        except Exception as e:
            await db.rollback()
            print(f"❌ Error durante la limpieza: {e}")
        finally:
            break

if __name__ == "__main__":
    asyncio.run(cleanup_duplicate_partidas())