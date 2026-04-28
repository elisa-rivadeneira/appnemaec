/**
 * 📋 SIDEBAR COMPONENT
 * Navegación lateral del ERP NEMAEC con diseño militar.
 * Expandible/colapsable con módulos jerárquicos.
 */
import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  HomeIcon,
  BuildingOfficeIcon,
  DocumentTextIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import {
  HomeIcon as HomeIconSolid,
  BuildingOfficeIcon as BuildingOfficeIconSolid,
  DocumentTextIcon as DocumentTextIconSolid,
  ChartBarIcon as ChartBarIconSolid,
} from '@heroicons/react/24/solid';

interface MenuItem {
  id: string;
  name: string;
  href?: string;
  icon: React.ComponentType<any>;
  iconSolid: React.ComponentType<any>;
  children?: MenuItem[];
  badge?: number | string;
  critical?: boolean;
}

interface SidebarProps {
  expanded: boolean;
  onToggle: () => void;
  criticalAlerts?: number;
}

const menuItems: MenuItem[] = [
  {
    id: 'dashboard',
    name: 'Dashboard Nacional',
    href: '/dashboard',
    icon: HomeIcon,
    iconSolid: HomeIconSolid,
  },
  {
    id: 'comisarias',
    name: 'Comisarías',
    icon: BuildingOfficeIcon,
    iconSolid: BuildingOfficeIconSolid,
    children: [
      {
        id: 'comisarias-overview',
        name: 'Vista General',
        href: '/comisarias',
        icon: ChartBarIcon,
        iconSolid: ChartBarIconSolid,
      },
      {
        id: 'comisarias-criticas',
        name: 'En Riesgo',
        href: '/comisarias/criticas',
        icon: ExclamationTriangleIcon,
        iconSolid: ExclamationTriangleIcon,
        critical: true,
        badge: 8, // Número dinámico de comisarías críticas
      },
      {
        id: 'comisarias-mapa',
        name: 'Mapa Nacional',
        href: '/comisarias/mapa',
        icon: HomeIcon,
        iconSolid: HomeIconSolid,
      },
    ],
  },
  {
    id: 'avances',
    name: 'Seguimiento',
    icon: ChartBarIcon,
    iconSolid: ChartBarIconSolid,
    children: [
      {
        id: 'avances-dashboard',
        name: 'Dashboard Crítico',
        href: '/avances/dashboard',
        icon: ChartBarIcon,
        iconSolid: ChartBarIconSolid,
      },
      {
        id: 'avances-partidas',
        name: 'Partidas Críticas',
        href: '/avances/partidas-criticas',
        icon: ExclamationTriangleIcon,
        iconSolid: ExclamationTriangleIcon,
        critical: true,
        badge: 145,
      },
      {
        id: 'avances-excel',
        name: 'Import Excel',
        href: '/avances/import-excel',
        icon: DocumentTextIcon,
        iconSolid: DocumentTextIconSolid,
      },
    ],
  },
  {
    id: 'reportes',
    name: 'Reportes',
    href: '/reportes',
    icon: ChartBarIcon,
    iconSolid: ChartBarIconSolid,
  },
  {
    id: 'configuracion',
    name: 'Configuración',
    href: '/configuracion',
    icon: Cog6ToothIcon,
    iconSolid: Cog6ToothIcon,
  },
];

const Sidebar: React.FC<SidebarProps> = ({
  expanded,
  onToggle,
  criticalAlerts = 0
}) => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleExpanded = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  const renderMenuItem = (item: MenuItem, level: number = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.has(item.id);

    if (hasChildren) {
      return (
        <div key={item.id}>
          <button
            onClick={() => toggleExpanded(item.id)}
            className={clsx(
              'w-full flex items-center px-3 py-3 text-left rounded-lg transition-all duration-200',
              'text-nemaec-gray-100 hover:bg-nemaec-gray-700 hover:text-white',
              'focus:outline-none focus:ring-2 focus:ring-nemaec-green-500',
              level > 0 && 'ml-4'
            )}
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />

            {expanded && (
              <>
                <span className="ml-3 font-medium flex-1">{item.name}</span>
                <ChevronDownIcon
                  className={clsx(
                    'w-4 h-4 transition-transform duration-200',
                    isExpanded && 'transform rotate-180'
                  )}
                />
                {item.badge && (
                  <span className={clsx(
                    'ml-2 px-2 py-0.5 rounded-full text-xs font-bold',
                    item.critical
                      ? 'bg-nemaec-red-800 text-white animate-pulse-critical'
                      : 'bg-nemaec-yellow-500 text-nemaec-gray-900'
                  )}>
                    {item.badge}
                  </span>
                )}
              </>
            )}
          </button>

          {/* Subitems */}
          {hasChildren && isExpanded && expanded && (
            <div className="mt-1 space-y-1">
              {item.children!.map(child => renderMenuItem(child, level + 1))}
            </div>
          )}
        </div>
      );
    }

    // Item sin hijos - NavLink
    return (
      <NavLink
        key={item.id}
        to={item.href!}
        className={({ isActive }) => clsx(
          'flex items-center px-3 py-3 rounded-lg transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-nemaec-green-500',
          level > 0 && 'ml-4',
          isActive
            ? 'bg-nemaec-green-700 border border-nemaec-green-500 text-white shadow-nemaec'
            : 'text-nemaec-gray-100 hover:bg-nemaec-gray-700 hover:text-white'
        )}
      >
        {({ isActive }) => (
          <>
            {React.createElement(
              isActive ? item.iconSolid : item.icon,
              { className: 'w-5 h-5 flex-shrink-0' }
            )}

            {expanded && (
              <>
                <span className="ml-3 font-medium flex-1">{item.name}</span>
                {item.badge && (
                  <span className={clsx(
                    'ml-2 px-2 py-0.5 rounded-full text-xs font-bold',
                    item.critical
                      ? 'bg-nemaec-red-800 text-white animate-pulse-critical'
                      : isActive
                        ? 'bg-white text-nemaec-green-700'
                        : 'bg-nemaec-yellow-500 text-nemaec-gray-900'
                  )}>
                    {item.badge}
                  </span>
                )}
                {isActive && (
                  <div className="w-2 h-2 bg-nemaec-green-400 rounded-full ml-2" />
                )}
              </>
            )}
          </>
        )}
      </NavLink>
    );
  };

  return (
    <div className={clsx(
      'flex flex-col h-screen transition-all duration-300',
      'bg-gradient-nemaec border-r border-nemaec-green-500/30',
      expanded ? 'w-64' : 'w-16'
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-nemaec-green-500/30">
        <div className="flex items-center space-x-3">
          {/* Logo NEMAEC */}
          <div className="w-8 h-8 bg-nemaec-yellow-500 rounded-full flex items-center justify-center">
            <span className="text-sm font-bold text-nemaec-gray-900">⚡</span>
          </div>

          {expanded && (
            <div className="animate-slide-in">
              <div className="font-bold text-nemaec-green-400 text-lg">
                NEMAEC
                <span className="text-nemaec-yellow-500 ml-1">ERP</span>
              </div>
              <div className="text-xs text-nemaec-gray-100">
                v1.0 Nacional
              </div>
            </div>
          )}
        </div>

        {/* Critical Alerts Badge */}
        {criticalAlerts > 0 && !expanded && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-nemaec-red-800 rounded-full flex items-center justify-center animate-pulse-critical">
            <span className="text-xs font-bold text-white">{criticalAlerts}</span>
          </div>
        )}
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {menuItems.map(item => renderMenuItem(item))}
      </nav>

      {/* Critical Status Banner */}
      {criticalAlerts > 0 && expanded && (
        <div className="p-4 m-4 bg-critical-glow rounded-lg animate-pulse-critical">
          <div className="flex items-center space-x-2">
            <ExclamationTriangleIcon className="w-5 h-5 text-nemaec-red-400" />
            <div>
              <div className="text-sm font-bold text-white">
                {criticalAlerts} Alertas Críticas
              </div>
              <div className="text-xs text-nemaec-red-300">
                Requieren acción inmediata
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toggle Button */}
      <div className="p-4 border-t border-nemaec-green-500/30">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center px-3 py-2 rounded-lg bg-nemaec-gray-800 hover:bg-nemaec-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-nemaec-green-500"
        >
          {expanded ? (
            <ChevronLeftIcon className="w-5 h-5 text-nemaec-gray-100" />
          ) : (
            <ChevronRightIcon className="w-5 h-5 text-nemaec-gray-100" />
          )}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;