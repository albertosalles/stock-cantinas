'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// Types for Stripe Terminal SDK
interface StripeTerminalSDK {
    create: (config: {
        onFetchConnectionToken: () => Promise<string>;
        onUnexpectedReaderDisconnect: () => void;
    }) => Promise<TerminalInstance>;
}

interface TerminalInstance {
    discoverReaders: (config: { simulated: boolean }) => Promise<{ discoveredReaders: Reader[] }>;
    connectReader: (reader: Reader) => Promise<{ reader: Reader }>;
    collectPaymentMethod: (clientSecret: string) => Promise<{ paymentIntent: PaymentIntentResult }>;
    processPayment: (paymentIntent: PaymentIntentResult) => Promise<{ paymentIntent: PaymentIntentResult }>;
    disconnectReader: () => Promise<void>;
    clearReaderDisplay: () => Promise<void>;
    setSimulatorConfiguration: (config: { testCardNumber?: string }) => void;
}

interface Reader {
    id: string;
    label: string;
    status: string;
    device_type: string;
    serial_number: string;
}

interface PaymentIntentResult {
    id: string;
    status: string;
    amount: number;
    currency: string;
}

export type TerminalStatus =
    | 'idle'
    | 'loading'
    | 'discovering'
    | 'connecting'
    | 'ready'
    | 'collecting'
    | 'processing'
    | 'succeeded'
    | 'error';

interface UseStripeTerminalReturn {
    status: TerminalStatus;
    error: string | null;
    readerConnected: boolean;
    initialize: () => Promise<boolean>;
    collectCardPayment: (amountCents: number, metadata?: Record<string, string>) => Promise<{ success: boolean; paymentIntentId?: string; error?: string }>;
    disconnect: () => Promise<void>;
}

export function useStripeTerminal(): UseStripeTerminalReturn {
    const [status, setStatus] = useState<TerminalStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    const [readerConnected, setReaderConnected] = useState(false);
    const terminalRef = useRef<TerminalInstance | null>(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (terminalRef.current && readerConnected) {
                terminalRef.current.disconnectReader().catch(() => { });
            }
        };
    }, [readerConnected]);

    const fetchConnectionToken = async (): Promise<string> => {
        const res = await fetch('/api/stripe/connection-token', { method: 'POST' });
        if (!res.ok) throw new Error('Failed to fetch connection token');
        const data = await res.json();
        return data.secret;
    };

    const initialize = useCallback(async (): Promise<boolean> => {
        if (terminalRef.current) {
            // Already initialized
            return true;
        }

        try {
            setError(null);
            setStatus('loading');

            // Dynamically import the Stripe Terminal SDK
            const { loadStripeTerminal } = await import('@stripe/terminal-js');
            const StripeTerminal = await loadStripeTerminal();

            if (!StripeTerminal) {
                throw new Error('Stripe Terminal SDK not loaded');
            }

            const terminal = StripeTerminal.create({
                onFetchConnectionToken: fetchConnectionToken,
                onUnexpectedReaderDisconnect: () => {
                    console.warn('⚠️ Reader disconnected unexpectedly');
                    setReaderConnected(false);
                    setStatus('idle');
                },
            }) as unknown as TerminalInstance;

            terminalRef.current = terminal;

            // Configure simulator for test mode
            terminal.setSimulatorConfiguration({
                testCardNumber: '4242424242424242',
            });

            // Discover simulated readers
            setStatus('discovering');
            const { discoveredReaders } = await terminal.discoverReaders({ simulated: true });

            if (discoveredReaders.length === 0) {
                throw new Error('No simulated readers found');
            }

            // Connect to the first simulated reader
            setStatus('connecting');
            await terminal.connectReader(discoveredReaders[0]);

            setReaderConnected(true);
            setStatus('ready');
            return true;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error initializing terminal';
            setError(message);
            setStatus('error');
            console.error('Terminal initialization error:', err);
            return false;
        }
    }, []);

    const collectCardPayment = useCallback(async (
        amountCents: number,
        metadata?: Record<string, string>
    ): Promise<{ success: boolean; paymentIntentId?: string; error?: string }> => {
        if (!terminalRef.current) {
            return { success: false, error: 'Terminal not connected' };
        }

        try {
            setError(null);
            setStatus('collecting');

            // 1. Create PaymentIntent on the server
            const res = await fetch('/api/stripe/create-payment-intent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: amountCents, metadata }),
            });

            if (!res.ok) {
                throw new Error('Failed to create payment intent');
            }

            const { client_secret } = await res.json();

            // 2. Collect payment method from the reader (simulated card tap)
            const collectResult = await terminalRef.current.collectPaymentMethod(client_secret);

            // 3. Process the payment
            setStatus('processing');
            const processResult = await terminalRef.current.processPayment(collectResult.paymentIntent);

            if (processResult.paymentIntent.status === 'succeeded' || processResult.paymentIntent.status === 'requires_capture') {
                setStatus('succeeded');
                return {
                    success: true,
                    paymentIntentId: processResult.paymentIntent.id,
                };
            } else {
                throw new Error(`Payment failed with status: ${processResult.paymentIntent.status}`);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Payment failed';
            setError(message);
            setStatus('error');
            return { success: false, error: message };
        }
    }, [readerConnected]);

    const disconnect = useCallback(async () => {
        if (terminalRef.current && readerConnected) {
            try {
                await terminalRef.current.disconnectReader();
            } catch (err) {
                console.warn('Error disconnecting reader:', err);
            }
            setReaderConnected(false);
            setStatus('idle');
        }
    }, [readerConnected]);

    return {
        status,
        error,
        readerConnected,
        initialize,
        collectCardPayment,
        disconnect,
    };
}
