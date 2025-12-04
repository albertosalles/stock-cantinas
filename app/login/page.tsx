'use client';

import { useLogin } from './hooks/useLogin';
import EventSelector from './components/EventSelector';
import CantinaSelector from './components/CantinaSelector';
import PinInput from './components/PinInput';

export default function CantinaLoginPage() {
  const {
    step,
    events,
    cantinas,
    selectedEvent,
    selectedCantina,
    pin,
    setPin,
    loading,
    error,
    selectEvent,
    selectCantina,
    goBack,
    login
  } = useLogin();

  return (
    <div className="min-h-screen bg-elche-bg flex flex-col items-center justify-center p-4 font-sans">
      {/* Contenido centrado */}
      <div className="w-full max-w-[500px]">
        
        {/* Logo / Header */}
        <div className="text-center mb-8 animate-in fade-in slide-in-from-top-8 duration-500">
          <div className="w-20 h-20 bg-gradient-to-br from-elche-primary to-elche-secondary rounded-3xl mx-auto mb-4 flex items-center justify-center shadow-xl shadow-elche-primary/20 transform rotate-3 hover:rotate-0 transition-transform duration-300">
            <span className="text-4xl drop-shadow-sm">🏪</span>
          </div>
          <h1 className="text-3xl font-extrabold text-elche-text mb-2 tracking-tight">
            Stock Cantinas
          </h1>
          <p className="text-elche-text-light font-medium text-sm bg-white/50 px-3 py-1 rounded-full inline-block backdrop-blur-sm">
            Sistema de gestión — Elche CF
          </p>
        </div>

        <div className="bg-white rounded-[32px] p-6 md:p-8 shadow-[0_8px_40px_rgba(0,150,79,0.08)] border border-elche-border/60 relative overflow-hidden backdrop-blur-xl">
          
          {/* Barra de progreso superior */}
          <div className="absolute top-0 left-0 h-1.5 bg-elche-gray w-full">
            <div 
              className="h-full bg-elche-primary transition-all duration-500 ease-out shadow-[0_0_10px_rgba(0,150,79,0.5)]"
              style={{ width: step === 'event' ? '33%' : step === 'cantina' ? '66%' : '100%' }}
            />
          </div>

          {/* Breadcrumb */}
          <div className="flex justify-center gap-2 mb-8 text-[11px] font-bold uppercase tracking-widest text-elche-text-light/60 select-none">
            <span className={`transition-colors duration-300 ${step === 'event' ? 'text-elche-primary' : ''}`}>1. Evento</span>
            <span className="text-elche-gray">•</span>
            <span className={`transition-colors duration-300 ${step === 'cantina' ? 'text-elche-primary' : ''}`}>2. Cantina</span>
            <span className="text-elche-gray">•</span>
            <span className={`transition-colors duration-300 ${step === 'pin' ? 'text-elche-primary' : ''}`}>3. Acceso</span>
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4 mb-6 text-red-600 text-sm font-bold flex items-center gap-3 animate-in zoom-in-95 duration-200">
              <span className="text-lg bg-white rounded-full w-8 h-8 flex items-center justify-center shadow-sm">⚠️</span> 
              {error}
            </div>
          )}

          {/* Steps */}
          {step === 'event' && (
            <EventSelector 
              events={events} 
              onSelect={selectEvent} 
            />
          )}

          {step === 'cantina' && (
            <CantinaSelector 
              cantinas={cantinas} 
              selectedEvent={selectedEvent} 
              onSelect={selectCantina} 
              onBack={goBack} 
            />
          )}

          {step === 'pin' && (
            <PinInput 
              selectedEvent={selectedEvent} 
              selectedCantina={selectedCantina} 
              pin={pin} 
              loading={loading} 
              onPinChange={setPin} 
              onLogin={login} 
              onBack={goBack} 
            />
          )}

        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center animate-in fade-in delay-300 duration-500">
          <p className="text-xs text-elche-text-light/80 font-medium bg-white/40 py-2.5 px-5 rounded-2xl inline-block backdrop-blur-md border border-white/50 shadow-sm hover:bg-white/60 transition-colors cursor-help">
            💡 Si tienes problemas de acceso, contacta con administración
          </p>
        </div>
      </div>
    </div>
  );
}
