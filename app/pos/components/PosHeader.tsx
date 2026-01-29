import React from 'react';

interface PosHeaderProps {
  eventName: string;
  cantinaName: string;
  onLogout: () => void;
  // Nuevas props para el modo offline
  pendingUploads?: number;
  onManualSync?: () => void;
}

export default function PosHeader({
  eventName,
  cantinaName,
  onLogout,
  pendingUploads = 0,
  onManualSync
}: PosHeaderProps) {

  return (
    <header className="sticky top-0 z-50 bg-gradient-to-r from-elche-primary to-elche-secondary text-white shadow-md h-16 flex items-center transition-all">
      <div className="w-full max-w-7xl mx-auto px-4 flex justify-between items-center">

        {/* IZQUIERDA: Info del Evento */}
        <div className="flex items-center gap-3">
          <div>
            <div className="text-lg md:text-xl font-bold leading-tight">{cantinaName}</div>
            <div className="text-xs text-white/80 font-medium">{eventName}</div>
          </div>
        </div>

        {/* DERECHA: Acciones (Sync + Logout) */}
        <div className="flex items-center gap-3">

          {/* BOTÓN SYNC: Solo visible si hay ventas pendientes */}
          {pendingUploads > 0 && (
            <button
              onClick={onManualSync}
              className="flex items-center gap-2 bg-amber-400 text-amber-900 px-3 py-1.5 rounded-full text-xs font-bold animate-pulse hover:bg-amber-300 transition-colors shadow-sm"
            >
              <span className="text-sm">☁️</span>
              <span>{pendingUploads} <span className="hidden sm:inline">Pendientes</span></span>
            </button>
          )}

          {/* BOTÓN SALIR */}
          <button
            onClick={onLogout}
            className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors backdrop-blur-sm border border-white/10"
            title="Cerrar Sesión"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}