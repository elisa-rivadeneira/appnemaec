/**
 * 🏛️ COMISARÍA MODAL - NEMAEC ERP
 * Modal para crear/editar/ver comisarías con integración Google Maps.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  XMarkIcon,
  MapPinIcon,
  MagnifyingGlassIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';

import { useCreateComisaria, useUpdateComisaria } from '@/hooks/useComisarias';
import { useCronogramaByComisaria, useCronogramaById } from '@/hooks/useCronograma';
import { googleMapsService } from '@/services/comisariasService';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import SafeGoogleMap from '@/components/maps/SafeGoogleMap';
import { CronogramaUpload } from '@/components/cronograma/CronogramaUpload';
import { CronogramaView } from '@/components/cronograma/CronogramaView';
import { mockLocations } from '@/data/mockLocations';
import type { Comisaria, ComisariaFormData, GoogleMapsResult } from '@/types/comisarias';

interface ComisariaModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit' | 'view';
  comisaria?: Comisaria | null;
}

const ComisariaModal: React.FC<ComisariaModalProps> = ({
  isOpen,
  onClose,
  mode,
  comisaria
}) => {
  const [formData, setFormData] = useState<ComisariaFormData>({
    nombre: '',
    direccion: '',
    distrito: '',
    provincia: '',
    departamento: '',
    tipo: 'comisaria',
    presupuesto_total: 0
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GoogleMapsResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<GoogleMapsResult | null>(null);
  const [showMap, setShowMap] = useState(false); // Mapa oculto por defecto
  const [selectedMapLocation, setSelectedMapLocation] = useState<any>(null);
  const [addressInput, setAddressInput] = useState('');
  const [googleMapsResults, setGoogleMapsResults] = useState<any[]>([]); // Resultados convertidos para el mapa

  // Estado para tabs y cronograma
  const [activeTab, setActiveTab] = useState<'info' | 'cronograma'>('info');
  const [showCronogramaUpload, setShowCronogramaUpload] = useState(false);
  const [presupuestoRaw, setPresupuestoRaw] = useState('');

  const navigate = useNavigate();
  const createMutation = useCreateComisaria();
  const updateMutation = useUpdateComisaria();

  // Hook para cronograma - obtiene directamente el cronograma CON partidas
  const { data: cronograma, refetch: refetchCronograma } = useCronogramaByComisaria(
    comisaria?.id || 0
  );

  const isLoading = createMutation.isPending || updateMutation.isPending;
  const isReadOnly = mode === 'view';

  useEffect(() => {
    if (comisaria && (mode === 'edit' || mode === 'view')) {
      setFormData({
        nombre: comisaria.nombre,
        direccion: comisaria.ubicacion.direccion,
        distrito: comisaria.ubicacion.distrito,
        provincia: comisaria.ubicacion.provincia,
        departamento: comisaria.ubicacion.departamento,
        tipo: comisaria.tipo,
        presupuesto_total: comisaria.presupuesto_total || 0,
        coordenadas: comisaria.ubicacion.coordenadas,
        google_place_id: comisaria.ubicacion.google_place_id
      });
      setPresupuestoRaw(comisaria.presupuesto_total ? comisaria.presupuesto_total.toString() : '');
    }
  }, [comisaria, mode]);

  const handleInputChange = (field: keyof ComisariaFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // DESHABILITADO: Búsqueda automática de Google Maps
    // Campo de nombre es ahora solo texto manual
    if (field === 'nombre') {
      // Ya no se busca automáticamente en Google Maps
      // El usuario deberá llenar todos los campos manualmente
    }
  };

  // Función para auto-buscar usando Google Maps API
  const handleAutoSearch = async (searchText: string) => {
    console.log('🔍 Buscando en Google Maps:', searchText);

    if (!searchText || searchText.length < 3) {
      setSelectedMapLocation(null);
      return;
    }

    try {
      setIsSearching(true);

      // Usar la API real de Google Maps
      const results = await googleMapsService.searchPlaces(searchText);

      console.log('✅ Google Maps encontró:', results.length, 'resultados');
      console.log('📍 Resultados:', results.map(r => r.name));

      if (results.length > 0) {
        // Convertir TODOS los resultados de Google Maps a nuestro formato de mapa
        const convertedResults = results.map(result => ({
          id: result.place_id,
          name: result.name,
          address: result.formatted_address,
          coordinates: {
            lat: result.geometry.location.lat,
            lng: result.geometry.location.lng
          },
          type: 'comisaria' as const,
          distrito: extractFromComponents(result.address_components, ['locality', 'sublocality', 'sublocality_level_1']) ||
                   extractDistritoFromAddress(result.formatted_address),
          provincia: extractFromComponents(result.address_components, ['administrative_area_level_2']) ||
                     getProvinciaByDistrito(extractFromComponents(result.address_components, ['locality', 'sublocality', 'sublocality_level_1']) || extractDistritoFromAddress(result.formatted_address)),
          departamento: extractFromComponents(result.address_components, ['administrative_area_level_1']) ||
                        getDepartamentoByDistrito(extractFromComponents(result.address_components, ['locality', 'sublocality', 'sublocality_level_1']) || extractDistritoFromAddress(result.formatted_address))
        }));

        // Establecer todos los resultados para el mapa
        setGoogleMapsResults(convertedResults);

        // DEBUG: Verificar datos geográficos en el primer resultado
        if (convertedResults[0]) {
          console.log('📊 Datos geográficos del primer resultado:', {
            distrito: convertedResults[0].distrito,
            provincia: convertedResults[0].provincia,
            departamento: convertedResults[0].departamento
          });
        }

        // Seleccionar el mejor resultado (el primero)
        const bestResult = convertedResults[0];
        console.log('🎯 Mejor coincidencia Google Maps:', bestResult.name);
        setSelectedMapLocation(bestResult);

        // También guardar los resultados para el componente de búsqueda
        setSearchResults(results);
      } else {
        console.log('❌ Sin coincidencias en Google Maps');
        setSelectedMapLocation(null);
        setGoogleMapsResults([]); // Limpiar resultados del mapa
      }
    } catch (error) {
      console.error('Error buscando en Google Maps:', error);
      setSelectedMapLocation(null);
      setGoogleMapsResults([]); // Limpiar resultados del mapa
    } finally {
      setIsSearching(false);
    }
  };

  // Función helper para extraer información de los componentes de dirección de Google
  const extractFromComponents = (components: any[], types: string[]): string => {
    console.log(`🔍 Buscando types ${types} en`, components.length, 'components');

    const component = components?.find(comp => {
      const hasType = comp.types?.some((type: string) => types.includes(type));
      if (hasType) {
        console.log(`✅ Encontrado: ${comp.long_name} para types ${types}`);
      }
      return hasType;
    });

    const result = component?.long_name || '';
    console.log(`📍 Resultado para types ${types}:`, result || 'NO ENCONTRADO');
    return result;
  };

  // Función para extraer distrito desde la dirección como fallback
  const extractDistritoFromAddress = (address: string): string => {
    console.log('🏘️ Extrayendo distrito de la dirección:', address);

    // Lista de distritos y ciudades conocidos de todo el Perú
    const distritos = [
      // Lima Metropolitana
      'San Juan de Lurigancho', 'San Martín de Porres', 'Ate', 'Comas', 'Villa El Salvador',
      'Villa María del Triunfo', 'San Borja', 'Santiago de Surco', 'Breña', 'La Molina',
      'Los Olivos', 'Puente Piedra', 'Chorrillos', 'La Victoria', 'Lima', 'Rímac',
      'Independencia', 'El Agustino', 'Santa Anita', 'Chaclacayo', 'Lurigancho',
      'Miraflores', 'Barranco', 'Surquillo', 'Magdalena', 'Jesús María', 'Lince',
      'Pueblo Libre', 'San Miguel', 'Callao', 'Ventanilla', 'Bellavista',
      // Provincia de Lima
      'Chancay', 'Huaral', 'Canta', 'Huarochirí', 'Yauyos',
      // Otras provincias importantes
      'Arequipa', 'Trujillo', 'Chiclayo', 'Piura', 'Iquitos', 'Cusco', 'Huancayo',
      'Chimbote', 'Tacna', 'Ica', 'Puno', 'Ayacucho', 'Huánuco', 'Cajamarca',
      'Pucallpa', 'Sullana', 'Chincha', 'Juliaca', 'Tarapoto'
    ];

    // Buscar distrito en la dirección
    const addressLower = address.toLowerCase();
    for (const distrito of distritos) {
      if (addressLower.includes(distrito.toLowerCase())) {
        console.log(`🎯 Distrito encontrado en dirección: ${distrito}`);
        return distrito;
      }
    }

    console.log('❌ No se encontró distrito específico, usando Lima por defecto');
    return 'Lima';
  };

  // Función para obtener provincia basada en distrito
  const getProvinciaByDistrito = (distrito: string): string => {
    const distritoProvinciaMap: Record<string, string> = {
      // Provincia de Huaral
      'Chancay': 'Huaral',
      'Huaral': 'Huaral',
      'Aucallama': 'Huaral',
      'Ihuari': 'Huaral',
      'Lampian': 'Huaral',
      'Pacaraos': 'Huaral',
      'San Miguel de Acos': 'Huaral',
      'Santa Cruz de Andamarca': 'Huaral',
      'Sumbilca': 'Huaral',
      'Veintisiete de Noviembre': 'Huaral',

      // Provincia de Lima
      'Lima': 'Lima',
      'Ancón': 'Lima',
      'Ate': 'Lima',
      'Barranco': 'Lima',
      'Breña': 'Lima',
      'Carabayllo': 'Lima',
      'Chaclacayo': 'Lima',
      'Chorrillos': 'Lima',
      'Cieneguilla': 'Lima',
      'Comas': 'Lima',
      'El Agustino': 'Lima',
      'Independencia': 'Lima',
      'Jesús María': 'Lima',
      'La Molina': 'Lima',
      'La Victoria': 'Lima',
      'Lince': 'Lima',
      'Los Olivos': 'Lima',
      'Lurigancho': 'Lima',
      'Lurin': 'Lima',
      'Magdalena del Mar': 'Lima',
      'Miraflores': 'Lima',
      'Pachacámac': 'Lima',
      'Pucusana': 'Lima',
      'Pueblo Libre': 'Lima',
      'Puente Piedra': 'Lima',
      'Punta Hermosa': 'Lima',
      'Punta Negra': 'Lima',
      'Rímac': 'Lima',
      'San Bartolo': 'Lima',
      'San Borja': 'Lima',
      'San Isidro': 'Lima',
      'San Juan de Lurigancho': 'Lima',
      'San Juan de Miraflores': 'Lima',
      'San Luis': 'Lima',
      'San Martín de Porres': 'Lima',
      'San Miguel': 'Lima',
      'Santa Anita': 'Lima',
      'Santa María del Mar': 'Lima',
      'Santa Rosa': 'Lima',
      'Santiago de Surco': 'Lima',
      'Surquillo': 'Lima',
      'Villa El Salvador': 'Lima',
      'Villa María del Triunfo': 'Lima',

      // Provincia del Callao
      'Callao': 'Callao',
      'Bellavista': 'Callao',
      'Carmen de la Legua Reynoso': 'Callao',
      'La Perla': 'Callao',
      'La Punta': 'Callao',
      'Ventanilla': 'Callao',

      // Otras provincias principales
      'Arequipa': 'Arequipa',
      'Trujillo': 'Trujillo',
      'Cusco': 'Cusco',
      'Chiclayo': 'Chiclayo',
      'Piura': 'Piura',
      'Iquitos': 'Maynas',
      'Huancayo': 'Huancayo',
      'Tacna': 'Tacna',
      'Ica': 'Ica'
    };

    return distritoProvinciaMap[distrito] || 'Lima';
  };

  // Función para obtener departamento basado en distrito
  const getDepartamentoByDistrito = (distrito: string): string => {
    const distritoDepartamentoMap: Record<string, string> = {
      // Departamento de Lima
      'Chancay': 'Lima', 'Huaral': 'Lima', 'Lima': 'Lima', 'Ancón': 'Lima',
      'Ate': 'Lima', 'Barranco': 'Lima', 'Breña': 'Lima', 'Carabayllo': 'Lima',
      'Chaclacayo': 'Lima', 'Chorrillos': 'Lima', 'Cieneguilla': 'Lima', 'Comas': 'Lima',
      'El Agustino': 'Lima', 'Independencia': 'Lima', 'Jesús María': 'Lima',
      'La Molina': 'Lima', 'La Victoria': 'Lima', 'Lince': 'Lima', 'Los Olivos': 'Lima',
      'Lurigancho': 'Lima', 'Lurin': 'Lima', 'Magdalena del Mar': 'Lima',
      'Miraflores': 'Lima', 'Pachacámac': 'Lima', 'Pucusana': 'Lima',
      'Pueblo Libre': 'Lima', 'Puente Piedra': 'Lima', 'Punta Hermosa': 'Lima',
      'Punta Negra': 'Lima', 'Rímac': 'Lima', 'San Bartolo': 'Lima',
      'San Borja': 'Lima', 'San Isidro': 'Lima', 'San Juan de Lurigancho': 'Lima',
      'San Juan de Miraflores': 'Lima', 'San Luis': 'Lima', 'San Martín de Porres': 'Lima',
      'San Miguel': 'Lima', 'Santa Anita': 'Lima', 'Santa María del Mar': 'Lima',
      'Santa Rosa': 'Lima', 'Santiago de Surco': 'Lima', 'Surquillo': 'Lima',
      'Villa El Salvador': 'Lima', 'Villa María del Triunfo': 'Lima',
      'Callao': 'Lima', 'Bellavista': 'Lima', 'Carmen de la Legua Reynoso': 'Lima',
      'La Perla': 'Lima', 'La Punta': 'Lima', 'Ventanilla': 'Lima',

      // Otros departamentos
      'Arequipa': 'Arequipa',
      'Trujillo': 'La Libertad',
      'Cusco': 'Cusco',
      'Chiclayo': 'Lambayeque',
      'Piura': 'Piura',
      'Iquitos': 'Loreto',
      'Huancayo': 'Junín',
      'Tacna': 'Tacna',
      'Ica': 'Ica'
    };

    return distritoDepartamentoMap[distrito] || 'Lima';
  };

  const handleLocationSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const results = await googleMapsService.searchPlaces(searchQuery);
      setSearchResults(results);
      setShowResults(true);
    } catch (error) {
      console.error('Error buscando ubicación:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleLocationSelect = (location: GoogleMapsResult) => {
    setSelectedLocation(location);
    setFormData(prev => ({
      ...prev,
      direccion: location.formatted_address,
      coordenadas: {
        lat: location.geometry.location.lat,
        lng: location.geometry.location.lng
      },
      google_place_id: location.place_id
    }));

    // Extraer distrito, provincia, departamento de los componentes de dirección
    const components = location.address_components;
    const distrito = components.find(c => c.types.includes('locality'))?.long_name || '';
    const provincia = components.find(c => c.types.includes('administrative_area_level_2'))?.long_name || '';
    const departamento = components.find(c => c.types.includes('administrative_area_level_1'))?.long_name || '';

    if (distrito) handleInputChange('distrito', distrito);
    if (provincia) handleInputChange('provincia', provincia);
    if (departamento) handleInputChange('departamento', departamento);

    setShowResults(false);
    setSearchQuery('');
  };

  const handleMapLocationSelect = (location: any) => {
    setSelectedMapLocation(location);
    // No cerrar el mapa automáticamente, dejar que el usuario confirme
  };

  // Confirmar la ubicación seleccionada del mapa
  const handleConfirmLocation = () => {
    if (selectedMapLocation) {
      console.log('🏛️ Confirmando ubicación:', selectedMapLocation);
      console.log('📍 Datos disponibles:', {
        name: selectedMapLocation.name,
        address: selectedMapLocation.address,
        distrito: selectedMapLocation.distrito,
        provincia: selectedMapLocation.provincia,
        departamento: selectedMapLocation.departamento
      });

      setFormData(prev => ({
        ...prev,
        nombre: selectedMapLocation.name, // Usar el nombre encontrado en el mapa
        direccion: selectedMapLocation.address, // Auto-llenar dirección
        distrito: selectedMapLocation.distrito || 'No disponible',
        provincia: selectedMapLocation.provincia || 'No disponible',
        departamento: selectedMapLocation.departamento || 'No disponible',
        coordenadas: selectedMapLocation.coordinates,
        google_place_id: selectedMapLocation.id
      }));
      setShowMap(false);
      setSelectedMapLocation(null);
    }
  };

  // Rechazar la ubicación y permitir escribir manualmente
  const handleRejectLocation = () => {
    setSelectedMapLocation(null);
    setShowMap(false);
    // Mantener lo que el usuario escribió en el campo de dirección
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;

    try {
      if (mode === 'create') {
        await createMutation.mutateAsync(formData);
      } else if (mode === 'edit' && comisaria) {
        await updateMutation.mutateAsync({ id: comisaria.id, data: formData });
      }
      onClose();
    } catch (error) {
      // Error ya manejado por los hooks
    }
  };

  const getModalTitle = () => {
    switch (mode) {
      case 'create': return 'Nueva Comisaría';
      case 'edit': return `Editar ${comisaria?.nombre}`;
      case 'view': return comisaria?.nombre || 'Detalles de Comisaría';
      default: return '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-start justify-center min-h-screen px-4 pt-2 pb-20 text-center sm:block sm:p-0">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div
          className="inline-block w-full max-w-6xl my-2 min-h-[95vh] max-h-[95vh] overflow-y-auto text-left align-middle transition-all transform bg-white shadow-xl rounded-xl sm:max-w-7xl"
          onClick={(e) => e.stopPropagation()}
        >

          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-nemaec-green-100 rounded-lg flex items-center justify-center">
                <MapPinIcon className="w-6 h-6 text-nemaec-green-600" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  {getModalTitle()}
                </h3>
                {mode === 'view' && comisaria && (
                  <p className="text-sm text-gray-500">
                    Código: {comisaria.codigo} • {comisaria.tipo}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          {/* Tabs - Solo mostrar si existe la comisaría o está en modo view */}
          {(comisaria && mode !== 'create') && (
            <div className="border-b border-gray-200">
              <nav className="flex px-6">
                <button
                  type="button"
                  onClick={() => setActiveTab('info')}
                  className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'info'
                      ? 'border-nemaec-500 text-nemaec-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <MapPinIcon className="w-4 h-4 inline mr-2" />
                  <span className="text-gray-700">Información General</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('cronograma')}
                  className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'cronograma'
                      ? 'border-nemaec-500 text-nemaec-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <ChartBarIcon className="w-4 h-4 inline mr-2" />
                  <span className="text-gray-700">Cronograma Valorizado</span>
                  {cronograma && (
                    <span className="ml-2 bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                      {cronograma.total_partidas}
                    </span>
                  )}
                </button>
              </nav>
            </div>
          )}

          {/* Content */}
          {activeTab === 'info' ? (
            <form onSubmit={handleSubmit} className="p-6 space-y-6">

            {/* Información Básica */}
            <div className="space-y-4">
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre de la Comisaría *
                </label>
                <input
                  type="text"
                  required
                  disabled={isReadOnly}
                  value={formData.nombre}
                  onChange={(e) => handleInputChange('nombre', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nemaec-green-500 focus:border-transparent disabled:bg-gray-100 text-gray-900"
                  placeholder="Ej: CPNP Ensenada, Comisaría Alfonso Ugarte, CPNP San Borja"
                />
                <p className="text-xs text-gray-500 mt-1">
                  📝 Escribe el nombre de la comisaría manualmente
                </p>

                {/* Mapa Dinámico - Justo debajo del campo nombre */}
                {showMap && !isReadOnly && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-gradient-to-r from-blue-50 to-nemaec-green-50 rounded-xl p-4 border-2 border-blue-200 shadow-2xl animate-fade-in">

                    <div className="mb-4">
                      {console.log('🗺️ Pasando al mapa:', googleMapsResults.length, 'ubicaciones:', googleMapsResults.map(r => r.name))}
                      <SafeGoogleMap
                        onLocationSelect={handleMapLocationSelect}
                        onConfirmLocation={handleConfirmLocation}
                        onRejectLocation={handleRejectLocation}
                        selectedLocation={selectedMapLocation}
                        initialQuery={formData.nombre}
                        googleMapsResults={googleMapsResults}
                        className="shadow-lg rounded-lg overflow-hidden"
                      />
                    </div>


                    {/* No se encontraron ubicaciones */}
                    {showMap && !selectedMapLocation && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
                        <div className="text-yellow-700 mb-1 text-sm">
                          🔍 <strong>No se encontraron ubicaciones exactas</strong>
                        </div>
                        <div className="text-xs text-yellow-600 mb-2">
                          Puedes continuar escribiendo manualmente
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleRejectLocation}
                        >
                          Continuar Manualmente
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>

            {/* Información de Ubicación */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Dirección Completa *
              </label>
              <textarea
                required
                disabled={isReadOnly}
                value={formData.direccion}
                onChange={(e) => handleInputChange('direccion', e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nemaec-green-500 focus:border-transparent disabled:bg-gray-100"
                placeholder="Escribe: CPNP Carabayllo, Comisaría Alfonso Ugarte, etc..."
              />
              <p className="text-xs text-gray-500 mt-1">
                📍 Escribe la dirección completa de la comisaría
              </p>
            </div>


            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Distrito *
                </label>
                <input
                  type="text"
                  required
                  disabled={isReadOnly}
                  value={formData.distrito}
                  onChange={(e) => handleInputChange('distrito', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nemaec-green-500 focus:border-transparent disabled:bg-gray-100 text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Provincia *
                </label>
                <input
                  type="text"
                  required
                  disabled={isReadOnly}
                  value={formData.provincia}
                  onChange={(e) => handleInputChange('provincia', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nemaec-green-500 focus:border-transparent disabled:bg-gray-100 text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Departamento *
                </label>
                <input
                  type="text"
                  required
                  disabled={isReadOnly}
                  value={formData.departamento}
                  onChange={(e) => handleInputChange('departamento', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nemaec-green-500 focus:border-transparent disabled:bg-gray-100 text-gray-900"
                />
              </div>
            </div>

            {/* Presupuesto */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Presupuesto Total (S/)
              </label>
              <input
                type="text"
                disabled={isReadOnly}
                value={presupuestoRaw}
                onChange={(e) => {
                  const raw = e.target.value;
                  setPresupuestoRaw(raw);
                  const cleanValue = raw.replace(/[^\d.]/g, '');
                  const numValue = cleanValue === '' ? 0 : Number(cleanValue);
                  if (!isNaN(numValue)) {
                    handleInputChange('presupuesto_total', numValue);
                  }
                }}
                onFocus={() => {
                  setPresupuestoRaw(formData.presupuesto_total ? formData.presupuesto_total.toString() : '');
                }}
                onBlur={() => {
                  if (formData.presupuesto_total) {
                    setPresupuestoRaw(formData.presupuesto_total.toLocaleString('es-PE', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    }));
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nemaec-green-500 focus:border-transparent disabled:bg-gray-100 text-gray-900"
                placeholder="0.00"
              />
            </div>

            {/* Input manual de coordenadas */}
            {!isReadOnly && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Coordenadas GPS (Opcional)
                </label>
                <input
                  type="text"
                  disabled={isReadOnly}
                  placeholder="Ejemplo: -12.0464, -77.0428"
                  onChange={(e) => {
                    const coords = e.target.value.split(',');
                    if (coords.length === 2) {
                      const lat = parseFloat(coords[0].trim());
                      const lng = parseFloat(coords[1].trim());
                      if (!isNaN(lat) && !isNaN(lng)) {
                        handleInputChange('coordenadas', { lat, lng });
                      }
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nemaec-green-500 focus:border-transparent disabled:bg-gray-100 text-gray-900"
                />
                <p className="text-xs text-gray-500 mt-1">
                  💡 Pega las coordenadas desde Google Maps: clic derecho → "¿Qué hay aquí?" → copiar coordenadas
                </p>
              </div>
            )}

            {/* Coordenadas (solo mostrar si existen) */}
            {formData.coordenadas && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <MapPinIcon className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800">Coordenadas GPS</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-black font-medium">Latitud:</span>
                    <span className="ml-2 font-mono">{formData.coordenadas.lat.toFixed(6)}</span>
                  </div>
                  <div>
                    <span className="text-black font-medium">Longitud:</span>
                    <span className="ml-2 font-mono">{formData.coordenadas.lng.toFixed(6)}</span>
                  </div>
                </div>
              </div>
            )}
          </form>
          ) : (
            /* Tab Cronograma */
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {cronograma ? (
                <CronogramaView
                  cronograma={cronograma}
                  onUploadNew={() => setShowCronogramaUpload(true)}
                  onViewFullProgress={() => navigate(`/cronograma/comisaria/${comisaria?.id}`)}
                />
              ) : (
                <div className="space-y-6">
                  <div className="text-center pt-6">
                    <div className="text-6xl mb-4">📊</div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No hay cronograma valorizado
                    </h3>
                    <p className="text-gray-500 mb-4">
                      Esta comisaría aún no tiene un cronograma valorizado cargado.
                    </p>
                    <Button
                      variant="primary"
                      onClick={() => setShowCronogramaUpload(true)}
                    >
                      <DocumentTextIcon className="w-4 h-4 mr-2" />
                      Subir cronograma
                    </Button>
                  </div>

                  {/* Formato requerido del Excel */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
                    <h4 className="text-sm font-semibold text-blue-900 mb-2">
                      📋 Formato requerido del Excel (.xlsx)
                    </h4>
                    <p className="text-xs text-blue-700 mb-3">
                      La fila 1 es el encabezado (se omite). Los datos empiezan en la fila 2. Las columnas deben estar en este orden exacto:
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-blue-100">
                            <th className="border border-blue-300 px-2 py-1 text-left text-blue-800">Col</th>
                            <th className="border border-blue-300 px-2 py-1 text-left text-blue-800">Nombre</th>
                            <th className="border border-blue-300 px-2 py-1 text-left text-blue-800">Descripción</th>
                            <th className="border border-blue-300 px-2 py-1 text-center text-blue-800">Requerido</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white">
                          {[
                            { col: 'A', name: '—', desc: 'Número / campo ignorado', req: false },
                            { col: 'B', name: 'COD_INTERNO', desc: 'Código interno de la partida', req: false },
                            { col: 'C', name: '—', desc: 'Campo ignorado (puede ir vacío)', req: false },
                            { col: 'D', name: 'COD_PARTIDA', desc: 'Código de partida (ej: 01, 01.01, 01.01.01)', req: true },
                            { col: 'E', name: 'DESCRIPCION', desc: 'Descripción de la partida', req: true },
                            { col: 'F', name: '—', desc: 'Campo ignorado (puede ir vacío)', req: false },
                            { col: 'G', name: 'METRADO', desc: 'Cantidad / metrado (número)', req: false },
                            { col: 'H', name: 'PRECIO_UNIT', desc: 'Precio unitario (número)', req: false },
                            { col: 'I', name: 'PRECIO_TOTAL', desc: 'Precio total (número)', req: false },
                            { col: 'J', name: 'UNIDAD', desc: 'Unidad de medida (m², ml, glb…)', req: false },
                            { col: 'K', name: 'FECHA_INICIO', desc: 'Fecha inicio — formato YYYY-MM-DD (opcional)', req: false },
                            { col: 'L', name: 'FECHA_FIN', desc: 'Fecha fin — formato YYYY-MM-DD (opcional)', req: false },
                          ].map(({ col, name, desc, req }) => (
                            <tr key={col} className={req ? 'bg-yellow-50' : ''}>
                              <td className="border border-blue-200 px-2 py-1 font-mono font-bold">{col}</td>
                              <td className="border border-blue-200 px-2 py-1 font-medium">{name}</td>
                              <td className="border border-blue-200 px-2 py-1 text-gray-600">{desc}</td>
                              <td className="border border-blue-200 px-2 py-1 text-center">
                                {req ? <span className="text-red-600 font-bold">Sí</span> : <span className="text-gray-400">—</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-blue-700 mt-2">
                      ⚠️ Solo son obligatorias <strong>D</strong> y <strong>E</strong>. El archivo debe tener mínimo 9 columnas (A–I). Las filas sin código o descripción se ignoran.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end space-x-3 px-6 py-4 bg-gray-50 border-t border-gray-200">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              {mode === 'view' ? 'Cerrar' : 'Cancelar'}
            </Button>

            {!isReadOnly && (
              <Button
                type="submit"
                variant="primary"
                loading={isLoading}
                onClick={handleSubmit}
              >
                {mode === 'create' ? 'Crear Comisaría' : 'Guardar Cambios'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Modal para subir cronograma */}
      {showCronogramaUpload && comisaria && (
        <CronogramaUpload
          isOpen={showCronogramaUpload}
          onClose={() => {
            setShowCronogramaUpload(false);
            refetchCronograma(); // Refrescar datos del cronograma
          }}
          preselectedComisariaId={comisaria.id}
        />
      )}
    </div>
  );
};

export default ComisariaModal;