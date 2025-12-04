import React from 'react';

type Tab = 'venta' | 'inventario' | 'ventas';

interface PosHeaderProps {
  eventName: string;
  cantinaName: string;
  tab: Tab;
  setTab: (t: Tab) => void;
  onLogout: () => void;
}

export default function PosHeader({ eventName, cantinaName, tab, setTab, onLogout }: PosHeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-gradient-to-r from-elche-primary to-elche-secondary text-white shadow-md h-14 md:h-auto flex items-center transition-all">
      <div className="w-full max-w-[1600px] mx-auto px-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          {/* Mobile Menu Button */}
          <button className="md:hidden text-white/90 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <div>
            <div className="text-lg md:text-2xl font-bold leading-tight">{eventName}</div>
            <div className="text-xs opacity-90 hidden md:block">📍 {cantinaName}</div>
          </div>
        </div>

        <div className="flex gap-4 items-center">
          {/* Tabs de navegación - Escritorio */}
          <nav className="hidden md:flex gap-2 bg-white/10 p-1.5 rounded-xl backdrop-blur-md border border-white/10">
            {(['venta', 'inventario', 'ventas'] as const).map(t => (
              <button key={t}
                onClick={() => setTab(t)}
                className={`px-5 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                  tab === t 
                    ? 'bg-white/25 text-white font-bold shadow-sm' 
                    : 'bg-transparent text-white/80 font-medium hover:bg-white/10'
                }`}>
                {t === 'venta' ? '💰 Venta' : t === 'inventario' ? '📦 Inventario' : '📊 Ventas'}
              </button>
            ))}
          </nav>

          {/* Botón de cerrar sesión */}
          <button
            onClick={onLogout}
            className="p-2 md:px-5 md:py-2.5 rounded-lg bg-white/15 text-white font-semibold text-sm hover:bg-white/25 transition-colors backdrop-blur-md border border-white/10">
            <span className="md:hidden">🚪</span>
            <span className="hidden md:inline">🚪 Salir</span>
          </button>
        </div>
      </div>
    </header>
  );
}
