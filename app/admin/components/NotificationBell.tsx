import React, { useState, useEffect, useMemo } from 'react';
import { useStockNotifications, StockAlert } from '../hooks/useStockNotifications';

interface NotificationBellProps {
    eventId: string;
}

export default function NotificationBell({ eventId }: NotificationBellProps) {
    const { alerts, loading } = useStockNotifications(eventId);
    const [isOpen, setIsOpen] = useState(false);

    // Local state to track dismissed alerts (by cantinaId + productId)
    const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set());

    // Filter visible alerts
    const visibleAlerts = useMemo(() => {
        return alerts.filter(a => !dismissedKeys.has(`${a.cantinaId}-${a.productId}`));
    }, [alerts, dismissedKeys]);

    const count = visibleAlerts.length;

    const handleDismiss = (e: React.MouseEvent, alert: StockAlert) => {
        e.stopPropagation();
        const key = `${alert.cantinaId}-${alert.productId}`;
        setDismissedKeys(prev => {
            const next = new Set(prev);
            next.add(key);
            return next;
        });
    };

    const handleDismissAll = () => {
        const newKeys = new Set(dismissedKeys);
        visibleAlerts.forEach(a => newKeys.add(`${a.cantinaId}-${a.productId}`));
        setDismissedKeys(newKeys);
        setIsOpen(false);
    };

    // Close on click outside (simple implementation)
    useEffect(() => {
        const close = () => setIsOpen(false);
        if (isOpen) window.addEventListener('click', close);
        return () => window.removeEventListener('click', close);
    }, [isOpen]);

    return (
        <div className="relative" onClick={e => e.stopPropagation()}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative flex h-10 w-10 items-center justify-center rounded-[11px] border border-elche-gray bg-elche-bg text-elche-text-light transition-colors hover:bg-red-50 hover:text-red-500"
                title="Notificaciones de Stock"
            >
                <span className="ms text-xl">notifications</span>

                {/* Badge */}
                {count > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-[9px] border-2 border-white bg-red-500 px-1 text-[10px] font-bold text-white">
                        {count}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-[60] animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-100">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            🔔 Notificaciones
                            {count > 0 && <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full">{count}</span>}
                        </h3>
                        {count > 0 && (
                            <button
                                onClick={handleDismissAll}
                                className="text-xs font-semibold text-elche-primary hover:text-elche-secondary transition-colors"
                            >
                                Limpiar todo
                            </button>
                        )}
                    </div>

                    <div className="max-h-[60vh] overflow-y-auto">
                        {loading && alerts.length === 0 ? (
                            <div className="p-4 text-center text-gray-400">Cargando...</div>
                        ) : count === 0 ? (
                            <div className="p-8 text-center text-gray-400 flex flex-col items-center gap-2">
                                <span className="text-3xl opacity-50">👍</span>
                                <span>Todo en orden</span>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-50">
                                {visibleAlerts.map(alert => (
                                    <div key={`${alert.cantinaId}-${alert.productId}`} className="p-4 hover:bg-gray-50 transition-colors flex gap-3 group">
                                        <div className="shrink-0 pt-1">
                                            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="font-bold text-gray-800 text-sm truncate" title={alert.productName}>
                                                    {alert.productName}
                                                </div>
                                                <button
                                                    onClick={(e) => handleDismiss(e, alert)}
                                                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 rounded hover:bg-red-50 transition-all font-bold text-xs"
                                                    title="Descartar"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                            <div className="text-xs text-gray-500 font-medium mt-0.5 truncate">
                                                {alert.cantinaName}
                                            </div>
                                            <div className="mt-2 text-xs font-semibold flex items-center gap-2">
                                                <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded border border-red-200">
                                                    Stock: {alert.currentQty}
                                                </span>
                                                <span className="text-gray-400">
                                                    Mínimo: {alert.threshold}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
