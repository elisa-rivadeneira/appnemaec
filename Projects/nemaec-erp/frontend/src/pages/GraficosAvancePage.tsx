import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Button from '@/components/ui/Button';
import { ArrowLeft, Building, TrendingUp, BarChart3 } from 'lucide-react';
import GraficosAvance from '@/components/avances/GraficosAvance';

interface Comisaria {
  id: number;
  nombre: string;
  ubicacion: {
    direccion: string;
    distrito: string;
    provincia: string;
    departamento: string;
  };
  codigo: string;
  tipo: string;
  estado: string;
  presupuesto_total: number;
}

export default function GraficosAvancePage() {
  const { comisariaId } = useParams<{ comisariaId: string }>();
  const navigate = useNavigate();
  const [comisaria, setComisaria] = useState<Comisaria | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (comisariaId) {
      cargarComisaria(parseInt(comisariaId));
    }
  }, [comisariaId]);

  const cargarComisaria = async (id: number) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/comisarias/${id}`);
      if (!response.ok) {
        throw new Error('Error al cargar información de la comisaría');
      }
      const data = await response.json();
      setComisaria(data);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Cargando información de la comisaría...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <div className="text-red-600 text-lg mb-4">Error</div>
              <p className="text-gray-600 mb-4">{error}</p>
              <Button onClick={() => navigate('/comisarias')} variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver a Comisarías
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!comisaria) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <div className="text-gray-600 text-lg mb-4">Comisaría no encontrada</div>
              <Button onClick={() => navigate('/comisarias')} variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver a Comisarías
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                onClick={() => navigate('/comisarias')}
                variant="outline"
                size="sm"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver
              </Button>
              <div className="flex items-center space-x-2">
                <BarChart3 className="w-6 h-6 text-purple-600" />
                <div>
                  <h1 className="text-xl font-semibold">Gráficos de Avance - {comisaria.nombre}</h1>
                  <p className="text-sm text-gray-600">
                    {comisaria.ubicacion.distrito}, {comisaria.ubicacion.provincia}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-gray-600">Código</p>
                <p className="font-mono font-semibold">{comisaria.codigo}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Presupuesto</p>
                <p className="font-semibold text-green-600">
                  S/ {comisaria.presupuesto_total.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto px-6 py-4">
        <nav className="text-sm text-gray-600">
          <span>Comisarías</span>
          <span className="mx-2">/</span>
          <span>{comisaria.nombre}</span>
          <span className="mx-2">/</span>
          <span className="font-semibold text-purple-600">Gráficos de Avance</span>
        </nav>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 pb-6">
        <GraficosAvance comisariaId={comisaria.id} />
      </div>
    </div>
  );
}