import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UseAutoSaveInventoryOptions {
    eventId: string;
    cantinaId: string;
    userId: string;
    /** Product IDs to track */
    productIds: string[];
    /** Debounce delay in ms (default 500) */
    debounceMs?: number;
    /** Enable/disable the hook */
    enabled?: boolean;
}

export function useAutoSaveInventory({
    eventId,
    cantinaId,
    userId,
    productIds,
    debounceMs = 500,
    enabled = true,
}: UseAutoSaveInventoryOptions) {
    // Form state: productId → qty
    const [form, setForm] = useState<Record<string, number | ''>>({});
    // Save status per product
    const [status, setStatus] = useState<Record<string, SaveStatus>>({});
    // Debounce timers per product
    const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
    // Track which products the user is currently editing (to avoid Realtime overwrite)
    const editingRef = useRef<Set<string>>(new Set());
    // Track if we've loaded initial data
    const loadedRef = useRef(false);

    // ─── Load initial values from inventory_snapshots ───
    const loadSnapshots = useCallback(async () => {
        if (!eventId || !cantinaId || productIds.length === 0) return;

        const { data } = await supabase
            .from('inventory_snapshots')
            .select('product_id, qty')
            .eq('event_id', eventId)
            .eq('cantina_id', cantinaId)
            .eq('kind', 'INITIAL');

        const rows = data ?? [];
        const map: Record<string, number | ''> = {};
        productIds.forEach(pid => {
            const found = rows.find((r: any) => r.product_id === pid);
            map[pid] = found ? found.qty : '';
        });

        // Only update fields that the user is NOT currently editing
        setForm(prev => {
            const next = { ...prev };
            Object.entries(map).forEach(([pid, qty]) => {
                if (!editingRef.current.has(pid)) {
                    next[pid] = qty;
                }
            });
            return next;
        });

        loadedRef.current = true;
    }, [eventId, cantinaId, productIds.join(',')]);

    // Load on mount / when cantina changes
    useEffect(() => {
        if (enabled) {
            loadedRef.current = false;
            loadSnapshots();
        }
    }, [enabled, loadSnapshots]);

    // ─── Realtime: listen for stock_movements to reload snapshots ───
    useEffect(() => {
        if (!enabled || !eventId || !cantinaId) return;

        const channel = supabase
            .channel(`autosave-inv-${eventId}-${cantinaId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'stock_movements',
                filter: `event_id=eq.${eventId}`,
            }, () => {
                // Another user saved → reload snapshots (respecting editing guard)
                loadSnapshots();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [enabled, eventId, cantinaId, loadSnapshots]);

    // ─── Auto-save a single product ───
    const saveProduct = useCallback(async (productId: string, qty: number) => {
        setStatus(s => ({ ...s, [productId]: 'saving' }));

        try {
            const { error } = await supabase.rpc('set_initial_inventory_bulk', {
                p_event_id: eventId,
                p_cantina_id: cantinaId,
                p_user_id: userId,
                p_lines: [{ productId, qty }],
            });

            if (error) {
                console.error('Auto-save error:', error);
                setStatus(s => ({ ...s, [productId]: 'error' }));
            } else {
                setStatus(s => ({ ...s, [productId]: 'saved' }));
                // Clear "saved" indicator after 2s
                setTimeout(() => {
                    setStatus(s => s[productId] === 'saved' ? { ...s, [productId]: 'idle' } : s);
                }, 2000);
            }
        } catch (err) {
            console.error('Auto-save exception:', err);
            setStatus(s => ({ ...s, [productId]: 'error' }));
        } finally {
            editingRef.current.delete(productId);
        }
    }, [eventId, cantinaId, userId]);

    // ─── Update a field value (triggers debounced save) ───
    const setValue = useCallback((productId: string, rawValue: string | number) => {
        const value = rawValue === '' ? '' : Number(rawValue);

        // Mark as editing so Realtime won't overwrite
        editingRef.current.add(productId);

        // Update local state immediately
        setForm(s => ({ ...s, [productId]: value }));

        // Clear previous timer for this product
        if (timersRef.current[productId]) {
            clearTimeout(timersRef.current[productId]);
        }

        // Don't save empty values
        if (value === '') return;

        // Debounce the save
        setStatus(s => ({ ...s, [productId]: 'saving' }));
        timersRef.current[productId] = setTimeout(() => {
            saveProduct(productId, value);
        }, debounceMs);
    }, [debounceMs, saveProduct]);

    // ─── Increment / Decrement helpers ───
    const increment = useCallback((productId: string) => {
        setForm(prev => {
            const current = prev[productId] === '' ? 0 : (prev[productId] as number);
            const next = current + 1;
            // Trigger save via setValue (which handles debounce)
            setValue(productId, next);
            return prev; // setValue already updates form
        });
    }, [setValue]);

    const decrement = useCallback((productId: string) => {
        setForm(prev => {
            const current = prev[productId] === '' ? 0 : (prev[productId] as number);
            const next = Math.max(0, current - 1);
            setValue(productId, next);
            return prev;
        });
    }, [setValue]);

    // ─── Cleanup timers on unmount ───
    useEffect(() => {
        return () => {
            Object.values(timersRef.current).forEach(clearTimeout);
        };
    }, []);

    return {
        form,
        status,
        setValue,
        increment,
        decrement,
        reload: loadSnapshots,
    };
}
