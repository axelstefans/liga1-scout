import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';

export const APP_BRAND_NAME = 'L1Scan';

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
      {/* Bloque Izquierdo: Marca */}
      <Link to="/scouting" className="flex items-center gap-3 group select-none">
        <svg
          width="40"
          viewBox="16 22 140 126"
          role="img"
          aria-label="Logo L1Scan"
          className="w-10 h-auto block shrink-0"
        >
          <g transform="translate(21 0) skewX(-14)">
            <path
              d="M32 30 L58 30 L58 100 L96 100 L96 126 L52 126 Q32 126 32 106 Z"
              fill="#3A3A3C"
            />
            <path
              d="M136 28 L136 126 L112 126 Q108 126 108 120 L108 66 L84 84 Q78 88 78 80 L78 62 Q78 54 86 49 Z"
              fill="#C8102E"
            />
            <circle cx="128" cy="138" r="5" fill="#C8102E" />
          </g>
        </svg>
        <span
          className="text-2xl leading-none font-extrabold italic tracking-tight text-[#111318] whitespace-nowrap group-hover:opacity-80 transition-opacity"
          style={{ fontFamily: "'Barlow', sans-serif" }}
        >
          L1Scan
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
