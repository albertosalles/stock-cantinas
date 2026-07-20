import React, { useState } from 'react';
import QRCode from 'react-qr-code';
import { CantinaRow } from '../hooks/useAdminCantinas';
import { CANTINA_QR_PREFIX } from '@/lib/waiters';

interface EventCantinasTabProps {
  cantinas: CantinaRow[];
  loading: boolean;
  onToggle: (id: string, assigned: boolean) => void;
  onCreate: (name: string, pin: string) => void;
}

export default function EventCantinasTab({ cantinas, loading, onToggle, onCreate }: EventCantinasTabProps) {
  const [newName, setNewName] = useState('');
  const [newPin, setNewPin] = useState('');
  const [qrCantina, setQrCantina] = useState<CantinaRow | null>(null);

  return (
    <section className="bg-white p-6 rounded-3xl shadow-sm border border-elche-gray/50">
      <div className="font-bold text-xl mb-6 text-elche-text border-b border-elche-gray/50 pb-4 flex items-center gap-2">
        <span className="bg-elche-primary/10 p-2 rounded-xl text-elche-primary">🏪</span>
        Cantinas asignadas
      </div>

      {loading ? (
        <div className="p-10 text-center text-elche-text-light flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-elche-primary border-t-transparent rounded-full animate-spin" />
          Cargando cantinas...
        </div>
      ) : (
        <div className="grid gap-4">
          <div className="grid gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {cantinas.map(c => (
              <div key={c.id} className={`flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 rounded-2xl border transition-all gap-4 sm:gap-0 ${c.assigned ? 'bg-elche-success/5 border-elche-success/30' : 'bg-white border-elche-gray hover:border-elche-gray/80'}`}>
                <span className={`font-bold ${c.assigned ? 'text-elche-text' : 'text-elche-text-light'} break-all`}>{c.name}</span>
                <button
                  onClick={() => setQrCantina(c)}
                  className="px-3 py-1.5 rounded-lg bg-elche-text text-white font-bold text-xs hover:bg-elche-primary transition-colors shrink-0"
                  title="QR de acceso para los camareros"
                >
                  📱 QR acceso
                </button>
                <label className="flex items-center gap-3 cursor-pointer select-none w-full sm:w-auto justify-between sm:justify-start">
                  <span className={`text-xs font-bold uppercase tracking-wide ${c.assigned ? 'text-elche-success' : 'text-elche-text-light'}`}>
                    {c.assigned ? 'Asignada' : 'No asignada'}
                  </span>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={c.assigned}
                      onChange={e => onToggle(c.id, e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-elche-success"></div>
                  </div>
                </label>
              </div>
            ))}
          </div>

          {/* Create New Cantina */}
          <div className="mt-4 p-5 bg-elche-gray/30 rounded-2xl border border-elche-gray/50">
            <div className="font-bold text-elche-text mb-3">➕ Nueva cantina</div>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Nombre de la cantina"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="flex-1 p-3 rounded-xl border border-elche-gray bg-white focus:outline-none focus:ring-2 focus:ring-elche-primary"
              />
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="PIN"
                  value={newPin}
                  onChange={e => setNewPin(e.target.value)}
                  className="w-24 p-3 rounded-xl border border-elche-gray bg-white focus:outline-none focus:ring-2 focus:ring-elche-primary text-center font-mono"
                />
                <button
                  onClick={() => { onCreate(newName, newPin); setNewName(''); setNewPin(''); }}
                  disabled={!newName.trim() || !newPin.trim()}
                  className="flex-1 sm:flex-none px-5 py-3 rounded-xl bg-elche-text text-white font-bold shadow-sm hover:bg-elche-primary transition-colors disabled:opacity-50 disabled:shadow-none"
                >
                  Crear y Asignar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal QR de acceso de cantina */}
      {qrCantina && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setQrCantina(null)}
        >
          <div
            className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="font-bold text-xl text-elche-text mb-1">{qrCantina.name}</div>
            <div className="text-xs text-elche-text-light font-medium mb-6">
              QR de acceso — los camareros lo escanean para abrir su POS
            </div>
            <div className="bg-white p-4 rounded-2xl border-2 border-elche-gray/50 inline-block">
              <QRCode value={`${CANTINA_QR_PREFIX}${qrCantina.qr_token}`} size={200} />
            </div>
            <div className="text-[11px] text-elche-text-light mt-4 font-medium">
              Imprímelo y colócalo en un lugar visible de la barra.
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => window.print()}
                className="flex-1 py-3 rounded-xl bg-elche-primary text-white font-bold text-sm hover:bg-elche-secondary transition-colors"
              >
                🖨️ Imprimir
              </button>
              <button
                onClick={() => setQrCantina(null)}
                className="flex-1 py-3 rounded-xl bg-white border border-elche-gray text-elche-text font-bold text-sm hover:bg-elche-gray/30 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

