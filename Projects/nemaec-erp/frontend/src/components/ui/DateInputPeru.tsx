import React, { useState, useEffect, useRef } from 'react';
import { Calendar, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

interface DateInputPeruProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  id?: string;
}

/**
 * 🇵🇪 COMPONENTE DE FECHA PERUANO
 *
 * Asegura que las fechas siempre se muestren en formato DD/MM/AAAA
 * sin importar la configuración del navegador del usuario.
 */
export default function DateInputPeru({
  value,
  onChange,
  placeholder = "DD/MM/AAAA",
  disabled = false,
  required = false,
  className = "",
  id
}: DateInputPeruProps) {
  const [displayValue, setDisplayValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarPosition, setCalendarPosition] = useState<'bottom' | 'top'>('bottom');
  const inputRef = useRef<HTMLInputElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  // Convertir de formato ISO (YYYY-MM-DD) a formato peruano (DD/MM/AAAA)
  useEffect(() => {
    if (value) {
      try {
        const date = new Date(value + 'T00:00:00'); // Agregar tiempo para evitar problemas de timezone
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        setDisplayValue(`${day}/${month}/${year}`);

        // Actualizar el mes del calendario para mostrar el mes de la fecha seleccionada
        setCurrentMonth(new Date(date.getFullYear(), date.getMonth(), 1));
      } catch (error) {
        setDisplayValue('');
      }
    } else {
      setDisplayValue('');
    }
  }, [value]);

  // Manejar entrada manual de fecha en formato DD/MM/AAAA
  const handleInputChange = (inputValue: string) => {
    // Permitir solo números y barras
    const cleanValue = inputValue.replace(/[^\d\/]/g, '');

    // Auto-formatear mientras escribe
    let formatted = cleanValue;
    if (cleanValue.length >= 2 && !cleanValue.includes('/')) {
      formatted = cleanValue.substring(0, 2) + '/' + cleanValue.substring(2);
    }
    if (cleanValue.length >= 5 && cleanValue.split('/').length === 2) {
      const parts = cleanValue.split('/');
      formatted = parts[0] + '/' + parts[1].substring(0, 2) + '/' + cleanValue.substring(5);
    }

    // Limitar longitud
    if (formatted.length > 10) {
      formatted = formatted.substring(0, 10);
    }

    setDisplayValue(formatted);

    // Convertir a formato ISO si es una fecha válida
    if (formatted.length === 10) {
      const parts = formatted.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);

        // Validar fecha
        if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
          const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const testDate = new Date(isoDate + 'T00:00:00');

          // Verificar que la fecha sea válida (no como 31/02/2024)
          if (testDate.getDate() === day && testDate.getMonth() + 1 === month && testDate.getFullYear() === year) {
            onChange(isoDate);
          }
        }
      }
    } else if (formatted === '') {
      onChange('');
    }
  };

  // Manejar selección de fecha desde el calendario personalizado
  const handleDateSelect = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const isoDate = `${year}-${month}-${day}`;
    onChange(isoDate);
    setIsOpen(false);
  };

  // Navegar entre meses
  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      if (direction === 'prev') {
        newMonth.setMonth(newMonth.getMonth() - 1);
      } else {
        newMonth.setMonth(newMonth.getMonth() + 1);
      }
      return newMonth;
    });
  };

  // Generar días del calendario
  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    // Primer día del mes
    const firstDay = new Date(year, month, 1);
    // Último día del mes
    const lastDay = new Date(year, month + 1, 0);

    // Días de la semana que empiezan (0 = domingo, ajustar a lunes = 0)
    const startDay = (firstDay.getDay() + 6) % 7; // Convertir para que lunes = 0

    const days = [];

    // Días del mes anterior (grises)
    for (let i = startDay - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      days.push({ date, isCurrentMonth: false });
    }

    // Días del mes actual
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day);
      days.push({ date, isCurrentMonth: true });
    }

    // Días del próximo mes (grises) para completar 42 días (6 semanas)
    const totalDays = days.length;
    const remainingDays = 42 - totalDays;
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day);
      days.push({ date, isCurrentMonth: false });
    }

    return days;
  };

  // Verificar si es la fecha seleccionada
  const isSelectedDate = (date: Date) => {
    if (!value) return false;
    const selectedDate = new Date(value + 'T00:00:00');
    return date.toDateString() === selectedDate.toDateString();
  };

  // Verificar si es hoy
  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // Calcular posición del calendario al abrirse
  const calculateCalendarPosition = () => {
    if (!inputRef.current) return;

    const inputRect = inputRef.current.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const calendarHeight = 350; // Altura aproximada del calendario

    // Si hay espacio suficiente abajo, mostrar abajo; sino, mostrar arriba
    if (inputRect.bottom + calendarHeight > windowHeight) {
      setCalendarPosition('top');
    } else {
      setCalendarPosition('bottom');
    }
  };

  // Calcular posición fixed del calendario
  const getFixedPosition = () => {
    if (!inputRef.current) return {};

    const inputRect = inputRef.current.getBoundingClientRect();

    if (calendarPosition === 'top') {
      return {
        top: inputRect.top - 350, // Altura del calendario
        left: inputRect.left,
      };
    } else {
      return {
        top: inputRect.bottom + 4,
        left: inputRect.left,
      };
    }
  };

  // Manejar apertura del calendario
  const handleToggleCalendar = () => {
    if (!isOpen) {
      calculateCalendarPosition();
    }
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative">
      <div className={`relative ${className}`}>
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={displayValue}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className={`
            w-full px-3 py-2 pr-10 border border-gray-300 rounded-md text-sm
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            disabled:bg-gray-100 disabled:text-gray-500
            ${disabled ? 'cursor-not-allowed' : 'cursor-text'}
          `}
          maxLength={10}
        />
        <button
          type="button"
          onClick={handleToggleCalendar}
          disabled={disabled}
          className={`
            absolute right-2 top-1/2 transform -translate-y-1/2
            text-gray-400 hover:text-gray-600 transition-colors
            ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
          `}
        >
          <CalendarDays className="w-4 h-4" />
        </button>
      </div>

      {/* Calendario personalizado peruano */}
      {isOpen && (
        <div
          ref={calendarRef}
          className="fixed z-[99999] bg-white border border-gray-300 rounded-md shadow-2xl w-72"
          style={getFixedPosition()}
        >
          {/* Header del calendario */}
          <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-blue-100">
            <button
              type="button"
              onClick={() => navigateMonth('prev')}
              className="p-2 bg-white hover:bg-blue-100 text-blue-600 hover:text-blue-800 rounded-md transition-all duration-200 shadow-sm hover:shadow-md border border-blue-200"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="font-semibold text-sm text-blue-900">
              {currentMonth.toLocaleDateString('es-PE', {
                month: 'long',
                year: 'numeric'
              }).replace(/^\w/, c => c.toUpperCase())}
            </div>
            <button
              type="button"
              onClick={() => navigateMonth('next')}
              className="p-2 bg-white hover:bg-blue-100 text-blue-600 hover:text-blue-800 rounded-md transition-all duration-200 shadow-sm hover:shadow-md border border-blue-200"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Días de la semana */}
          <div className="grid grid-cols-7 gap-1 p-2 bg-gray-50">
            {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'].map((day) => (
              <div key={day} className="text-xs font-bold text-center text-blue-700 p-2 bg-blue-50 rounded-md">
                {day}
              </div>
            ))}
          </div>

          {/* Días del calendario */}
          <div className="grid grid-cols-7 gap-1 p-2 pt-0">
            {generateCalendarDays().map((dayInfo, index) => {
              const { date, isCurrentMonth } = dayInfo;
              const selected = isSelectedDate(date);
              const today = isToday(date);

              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleDateSelect(date)}
                  className={`
                    p-2 text-sm rounded-md transition-all duration-200 font-medium min-h-[36px]
                    ${!isCurrentMonth
                      ? 'text-gray-300 bg-gray-50 hover:bg-gray-100'
                      : 'text-gray-700 bg-gray-100 hover:bg-blue-100 hover:text-blue-700'
                    }
                    ${selected
                      ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'
                      : ''
                    }
                    ${today && !selected
                      ? 'bg-blue-200 text-blue-800 font-bold border-2 border-blue-300'
                      : ''
                    }
                    hover:scale-105 active:scale-95
                  `}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          {/* Footer con formato */}
          <div className="text-xs text-blue-600 p-3 text-center border-t border-gray-200 bg-gradient-to-r from-blue-50 to-blue-100 font-medium">
            📅 Formato: DD/MM/AAAA
          </div>
        </div>
      )}

      {/* Clic fuera para cerrar */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[99998] bg-black bg-opacity-20"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}