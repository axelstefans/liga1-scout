import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';

export const APP_BRAND_NAME = 'LIGA 1 SCOUT';
export const APP_SUBTITLE = 'Plataforma de Rendimiento y Análisis Deportivo';

interface NavItem {
  label: string;
  path: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Scouting', path: '/scouting' },
  { label: 'Equipos y Liga', path: '/teams' },
  { label: 'Clubes', path: '/clubs' },
];

export const Navbar: React.FC = () => {
  const location = useLocation();
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // En el tope de la página siempre visible
      if (currentScrollY <= 10) {
        setIsVisible(true);
      } 
      // Si scrolea hacia abajo y ha bajado más de 40px, ocultar
      else if (currentScrollY > lastScrollY.current && currentScrollY > 40) {
        setIsVisible(false);
      } 
      // Si scrolea hacia arriba, mostrar
      else if (currentScrollY < lastScrollY.current) {
        setIsVisible(true);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`bg-[#fafafa] border-b border-[#e0e0e0] px-6 py-2.5 flex items-center justify-between sticky top-0 z-40 export-ignore shadow-2xs transition-transform duration-300 ease-in-out ${
        isVisible ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      {/* Bloque Izquierdo: Marca y Contexto */}
      <Link to="/scouting" className="flex flex-col group select-none">
        <span className="text-base font-bold text-slate-900 tracking-tight leading-none group-hover:text-slate-700 transition-colors">
          {APP_BRAND_NAME}
        </span>
        <span className="text-xs text-slate-500 font-medium leading-none mt-1">
          {APP_SUBTITLE}
        </span>
      </Link>

      {/* Bloque Derecho: Control Segmentado Tipo Píldora */}
      <nav className="inline-flex items-center bg-white p-1 rounded-lg border border-[#e0e0e0] gap-1 shadow-2xs">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`px-3.5 py-1.5 text-xs rounded-md font-medium transition-all duration-150 select-none ${
                isActive
                  ? 'bg-slate-900 text-white font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
};

export default Navbar;
