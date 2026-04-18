/**
 * 🏛️ APP COMPONENT - NEMAEC ERP
 * Componente raíz de la aplicación con routing y layout principal.
 */
import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import Sidebar from '@/components/layout/Sidebar';
import DashboardNacional from '@/pages/DashboardNacional';
import ComisariasList from '@/pages/ComisariasList';
import MapaNacional from '@/pages/MapaNacional';
import CronogramaVersionesPage from '@/pages/CronogramaVersionesPage';
import CronogramaHistorialPage from '@/pages/CronogramaHistorialPage';
import CronogramaDetallePage from '@/pages/CronogramaDetallePage';
import AvancesImportExcel from '@/pages/AvancesImportExcel';
import SeguimientoEvolucionPage from '@/pages/SeguimientoEvolucionPage';
import RegistroAvancesPage from '@/pages/RegistroAvancesPage';
import GraficosAvancePage from '@/pages/GraficosAvancePage';

// React Query Devtools (solo en desarrollo)
const ReactQueryDevtools = process.env.NODE_ENV === 'development'
  ? React.lazy(() =>
      import('@tanstack/react-query-devtools').then(module => ({
        default: module.ReactQueryDevtools
      }))
    )
  : null;

const App: React.FC = () => {
  const [sidebarExpanded, setSidebarExpanded] = useState(true);

  // Mock: número de alertas críticas (en producción vendrá del API)
  const criticalAlerts = 8;

  return (
    <div className="flex h-screen bg-gradient-to-br from-nemaec-gray-900 to-black">

      {/* Sidebar Navigation */}
      <Sidebar
        expanded={sidebarExpanded}
        onToggle={() => setSidebarExpanded(!sidebarExpanded)}
        criticalAlerts={criticalAlerts}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-auto">

        {/* Routes */}
        <Routes>
          {/* Redirect root to dashboard */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Dashboard Nacional */}
          <Route path="/dashboard" element={<DashboardNacional />} />

          {/* Comisarías Routes */}
          <Route path="/comisarias" element={<ComisariasList />} />
          <Route path="/comisarias/criticas" element={<div className="p-6 text-gray-800">Comisarías en Riesgo (Próximamente)</div>} />
          <Route path="/comisarias/mapa" element={<MapaNacional />} />

          {/* Contratos Routes */}
          <Route path="/contratos/activos" element={<div className="p-6 text-gray-800">Contratos Activos (Próximamente)</div>} />
          <Route path="/contratos/vencidos" element={<div className="p-6 text-gray-800">Contratos Vencidos (Próximamente)</div>} />
          <Route path="/contratos/equipamiento" element={<div className="p-6 text-gray-800">Contratos de Equipamiento (Próximamente)</div>} />
          <Route path="/contratos/mantenimiento" element={<div className="p-6 text-gray-800">Contratos de Mantenimiento (Próximamente)</div>} />

          {/* Avances Routes */}
          <Route path="/avances/dashboard" element={<div className="p-6 text-gray-800">Dashboard Crítico (Próximamente)</div>} />
          <Route path="/avances/partidas-criticas" element={<div className="p-6 text-gray-800">Partidas Críticas (Próximamente)</div>} />
          <Route path="/avances/import-excel" element={<AvancesImportExcel />} />
          <Route path="/avances/registro/:comisariaId" element={<RegistroAvancesPage />} />
          <Route path="/avances/graficos/:comisariaId" element={<GraficosAvancePage />} />

          {/* Cronograma Routes */}
          <Route path="/cronograma/versiones/:comisariaId" element={<CronogramaVersionesPage />} />
          <Route path="/cronograma/historial/:comisariaId" element={<CronogramaHistorialPage />} />
          <Route path="/cronograma/comisaria/:comisariaId" element={<CronogramaDetallePage />} />

          {/* Seguimiento Routes */}
          <Route path="/seguimiento/evolucion/:comisariaId" element={<SeguimientoEvolucionPage />} />

          {/* Other Routes */}
          <Route path="/reportes" element={<div className="p-6 text-gray-800">Reportes (Próximamente)</div>} />
          <Route path="/configuracion" element={<div className="p-6 text-gray-800">Configuración (Próximamente)</div>} />

          {/* 404 Not Found */}
          <Route path="*" element={
            <div className="min-h-screen bg-gradient-to-br from-nemaec-gray-900 to-black flex items-center justify-center text-white">
              <div className="text-center max-w-md mx-auto p-8">
                <div className="w-20 h-20 bg-nemaec-yellow-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-3xl text-nemaec-gray-900">🏛️</span>
                </div>
                <h1 className="text-3xl font-bold text-white mb-4">Página No Encontrada</h1>
                <p className="text-nemaec-gray-300 mb-6">
                  La página que buscas no existe en el sistema NEMAEC ERP.
                </p>
                <button
                  onClick={() => window.history.back()}
                  className="px-6 py-3 bg-nemaec-green-700 text-white rounded-lg hover:bg-nemaec-green-600 transition-colors"
                >
                  Volver Atrás
                </button>
              </div>
            </div>
          } />
        </Routes>

      </div>

      {/* React Query Devtools (solo en desarrollo) */}
      {ReactQueryDevtools && (
        <React.Suspense fallback={null}>
          <ReactQueryDevtools initialIsOpen={false} />
        </React.Suspense>
      )}
    </div>
  );
};

export default App;