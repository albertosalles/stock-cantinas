'use client';

import { useState, useEffect } from 'react';

export default function InstallPrompt() {
    const [isIOS, setIsIOS] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

    useEffect(() => {
        // 1. Detectar si ya está instalada (Standalone mode)
        setIsStandalone(window.matchMedia('(display-mode: standalone)').matches);

        // 2. Detectar si es iOS
        const userAgent = window.navigator.userAgent.toLowerCase();
        setIsIOS(/iphone|ipad|ipod/.test(userAgent));

        // 3. Capturar el evento de instalación en Android
        const handleBeforeInstallPrompt = (e: any) => {
            e.preventDefault(); // Evita que Chrome muestre el banner por defecto (poco visible)
            setDeferredPrompt(e); // Guardamos el evento para dispararlo cuando queramos
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    // Si ya está instalada, no mostramos nada
    if (isStandalone) return null;

    // Función para disparar la instalación en Android
    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
        }
    };

    if (!deferredPrompt && !isIOS) return null; // Si no es iOS y no podemos instalar, no mostramos nada.

    return (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-green-50 border-t border-black-500 shadow-xl z-50 flex flex-col items-center animate-slide-up">
            <div className="flex items-center gap-3 mb-3 w-full">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-xl">
                    🏟️ {/* Tu icono aquí */}
                </div>
                <div className="flex-1">
                    <h3 className="font-bold text-sm text-slate-800">Instalar Cantina POS</h3>
                    <p className="text-xs text-slate-500">Accede más rápido y a pantalla completa</p>
                </div>
                {/* Botón cerrar */}
                <button onClick={() => setIsStandalone(true)} className="text-slate-400 p-2">✕</button>
            </div>

            {/* CASO ANDROID: Botón directo */}
            {deferredPrompt && (
                <button
                    onClick={handleInstallClick}
                    className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl active:scale-95 transition-transform"
                >
                    Instalar Aplicación
                </button>
            )}

            {/* CASO IOS: Instrucciones visuales */}
            {isIOS && (
                <div className="w-full bg-slate-50 p-3 rounded-xl border border-slate-500 text-center">
                    <p className="text-sm text-slate-600 mb-2">
                        Para instalar en iPhone/iPad:
                    </p>
                    <div className="flex items-center justify-center gap-2 text-sm font-semibold text-black-600">
                        1. Pulsa boton "compartir" abajo
                    </div>
                    <div className="flex items-center justify-center gap-2 text-sm font-semibold text-black-600 mt-1">
                        2. Selecciona "Añadir a inicio"
                        <span className="inline-block w-5 h-5 border border-current rounded text-[10px] leading-4 text-center">+</span>
                    </div>
                    {/* Triangulito señalando abajo (hacia el botón share de Safari) */}
                    <div className="absolute bottom-[-8px] left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-r border-b border-gray-200 rotate-45 transform"></div>
                </div>
            )}
        </div>
    );
}