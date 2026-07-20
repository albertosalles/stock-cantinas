'use client';

import React from 'react';
import { TerminalStatus } from '../hooks/useStripeTerminal';

interface PaymentMethodModalProps {
    visible: boolean;
    totalEur: number;
    terminalStatus: TerminalStatus;
    terminalError: string | null;
    readerConnected: boolean;
    onPayCash: () => void;
    onPayCard: () => void;
    onClose: () => void;
}

const STATUS_MESSAGES: Record<TerminalStatus, { icon: string; text: string }> = {
    idle: { icon: '💳', text: 'Selecciona método de pago' },
    loading: { icon: '⏳', text: 'Cargando terminal...' },
    discovering: { icon: '🔍', text: 'Buscando lector...' },
    connecting: { icon: '🔗', text: 'Conectando al lector...' },
    ready: { icon: '✅', text: 'Lector conectado' },
    collecting: { icon: '📱', text: 'Esperando tarjeta...' },
    processing: { icon: '⚙️', text: 'Procesando pago...' },
    succeeded: { icon: '🎉', text: '¡Pago completado!' },
    error: { icon: '❌', text: 'Error en el pago' },
};

export default function PaymentMethodModal({
    visible,
    totalEur,
    terminalStatus,
    terminalError,
    readerConnected,
    onPayCash,
    onPayCard,
    onClose,
}: PaymentMethodModalProps) {
    if (!visible) return null;

    const isProcessing = ['loading', 'discovering', 'connecting', 'collecting', 'processing'].includes(terminalStatus);
    const isSuccess = terminalStatus === 'succeeded';
    const isError = terminalStatus === 'error';
    const showMethodSelection = !isProcessing && !isSuccess;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] animate-in fade-in duration-200"
                onClick={!isProcessing ? onClose : undefined}
            />

            {/* Modal */}
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300">

                    {/* Header */}
                    <div className="bg-gradient-to-r from-elche-primary to-elche-secondary p-5 text-white text-center">
                        <div className="text-sm font-medium opacity-90 uppercase tracking-wider">Total a cobrar</div>
                        <div className="text-4xl font-extrabold mt-1">{totalEur.toFixed(2)} €</div>
                    </div>

                    {/* Body */}
                    <div className="p-5">

                        {/* Method Selection */}
                        {showMethodSelection && !isError && (
                            <div className="grid gap-3">
                                <button
                                    onClick={onPayCash}
                                    className="flex items-center gap-4 p-4 rounded-2xl border-2 border-elche-gray/50 hover:border-elche-primary/30 hover:bg-elche-gray/20 transition-all active:scale-[0.98] group"
                                >
                                    <div className="w-14 h-14 bg-green-50 rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                                        💵
                                    </div>
                                    <div className="text-left">
                                        <div className="font-bold text-elche-text text-lg">Efectivo</div>
                                        <div className="text-sm text-elche-text-light">Registrar pago en efectivo</div>
                                    </div>
                                </button>

                                <button
                                    onClick={onPayCard}
                                    className="flex items-center gap-4 p-4 rounded-2xl border-2 border-elche-gray/50 hover:border-blue-300 hover:bg-blue-50/30 transition-all active:scale-[0.98] group"
                                >
                                    <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                                        💳
                                    </div>
                                    <div className="text-left">
                                        <div className="font-bold text-elche-text text-lg">Tarjeta</div>
                                        <div className="text-sm text-elche-text-light">
                                            {readerConnected ? 'Cobrar con lector' : 'Conectar y cobrar'}
                                        </div>
                                    </div>
                                </button>
                            </div>
                        )}

                        {/* Processing State */}
                        {isProcessing && (
                            <div className="text-center py-8">
                                <div className="text-5xl mb-4 animate-pulse">
                                    {STATUS_MESSAGES[terminalStatus]?.icon}
                                </div>
                                <div className="text-lg font-bold text-elche-text mb-2">
                                    {STATUS_MESSAGES[terminalStatus]?.text}
                                </div>
                                {terminalStatus === 'collecting' && (
                                    <div className="text-sm text-elche-text-light mt-2">
                                        Acerca la tarjeta al lector...
                                    </div>
                                )}
                                {/* Animated progress bar */}
                                <div className="mt-4 h-1.5 bg-elche-gray/30 rounded-full overflow-hidden max-w-[200px] mx-auto">
                                    <div className="h-full bg-gradient-to-r from-elche-primary to-elche-secondary rounded-full animate-pulse w-3/4" />
                                </div>
                            </div>
                        )}

                        {/* Success State */}
                        {isSuccess && (
                            <div className="text-center py-8">
                                <div className="text-6xl mb-4">🎉</div>
                                <div className="text-xl font-bold text-green-600 mb-2">¡Pago completado!</div>
                                <div className="text-sm text-elche-text-light">
                                    La transacción se ha procesado correctamente
                                </div>
                            </div>
                        )}

                        {/* Error State */}
                        {isError && (
                            <div className="text-center py-6">
                                <div className="text-5xl mb-3">❌</div>
                                <div className="text-lg font-bold text-red-600 mb-2">Error en el pago</div>
                                <div className="text-sm text-red-500 bg-red-50 p-3 rounded-xl mb-4">
                                    {terminalError || 'Ha ocurrido un error desconocido'}
                                </div>
                                <div className="grid gap-2">
                                    <button
                                        onClick={onPayCard}
                                        className="p-3 rounded-xl bg-blue-50 text-blue-600 font-semibold hover:bg-blue-100 transition-colors text-sm"
                                    >
                                        🔄 Reintentar con tarjeta
                                    </button>
                                    <button
                                        onClick={onPayCash}
                                        className="p-3 rounded-xl bg-green-50 text-green-600 font-semibold hover:bg-green-100 transition-colors text-sm"
                                    >
                                        💵 Cobrar en efectivo
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {!isProcessing && (
                        <div className="px-5 pb-5">
                            <button
                                onClick={onClose}
                                className="w-full p-3 rounded-2xl bg-elche-gray/30 text-elche-text-light font-semibold hover:bg-elche-gray/50 transition-colors text-sm"
                            >
                                {isSuccess ? 'Cerrar' : 'Cancelar'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
