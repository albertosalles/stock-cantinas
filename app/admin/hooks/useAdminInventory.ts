import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useLiveInventory } from '@/hooks/useLiveInventory';
import { EventProductRow } from './useAdminCatalog';

export type InventoryRow = { product_id: string; current_qty: number; low_stock_threshold: number };

export function useAdminInventory(eventId: string, selectedCantinaId: string, products: EventProductRow[]) {
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Forms
  const [initForm, setInitForm] = useState<Record<string, number>>({});
  const [adjustForm, setAdjustForm] = useState<Record<string, number>>({});
  const [finalForm, setFinalForm] = useState<Record<string, number>>({});
  
  const [adjustType, setAdjustType] = useState<'ADJUSTMENT'|'WASTE'|'TRANSFER_IN'|'TRANSFER_OUT'|'RETURN'>('ADJUSTMENT');
  const [adjustReason, setAdjustReason] = useState('Ajuste manual');

  const changes = useLiveInventory(eventId, selectedCantinaId);

  async function fetchInventoryData() {
    if (!selectedCantinaId) return;
    setLoading(true);
    
    // Current Inventory
    const { data: inv } = await supabase
      .from('v_cantina_inventory')
      .select('product_id, current_qty, low_stock_threshold')
      .match({ event_id: eventId, cantina_id: selectedCantinaId });
    setInventory(inv ?? []);

    // Initial Inventory
    const { data: initRows } = await supabase
      .from('inventory_snapshots')
      .select('product_id, qty')
      .eq('event_id', eventId)
      .eq('cantina_id', selectedCantinaId)
      .eq('kind', 'INITIAL');
      
    const initMap: Record<string, number> = {};
    (initRows ?? []).forEach((row: any) => initMap[row.product_id] = row.qty);

    // Prepare forms
    const initFormTemp: Record<string, number> = {};
    const finalFormTemp: Record<string, number> = {};
    
    products.forEach(p => {
      initFormTemp[p.product_id] = initMap[p.product_id] ?? 0;
      const curRow = inv?.find((i: any) => i.product_id === p.product_id);
      finalFormTemp[p.product_id] = curRow?.current_qty ?? 0;
    });

    setInitForm(initFormTemp);
    setFinalForm(finalFormTemp);
    setAdjustForm({});
    setLoading(false);
  }

  async function saveInitialInventory() {
    const lines = Object.entries(initForm).map(([productId, qty]) => ({ productId, qty }));
    const { error } = await supabase.rpc('set_initial_inventory_bulk', {
      p_event_id: eventId,
      p_cantina_id: selectedCantinaId,
      p_user_id: process.env.NEXT_PUBLIC_APP_USER_ID,
      p_lines: lines,
    });
    if (error) throw error;
    await fetchInventoryData();
  }

  async function applyAdjustments() {
    const lines = Object.entries(adjustForm)
      .filter(([, delta]) => delta && delta !== 0)
      .map(([productId, delta]) => ({ productId, delta, movementType: adjustType, reason: adjustReason }));
      
    if (!lines.length) throw new Error('No hay ajustes');

    const { error } = await supabase.rpc('adjust_stock_bulk', {
      p_event_id: eventId,
      p_cantina_id: selectedCantinaId,
      p_user_id: process.env.NEXT_PUBLIC_APP_USER_ID,
      p_lines: lines,
    });
    if (error) throw error;
    
    setAdjustForm({});
    await fetchInventoryData();
  }

  async function saveFinalInventory() {
    const lines = Object.entries(finalForm).map(([productId, qty]) => ({ productId, qty: Math.max(0, Number(qty || 0)) }));
    const { error } = await supabase.rpc('set_final_inventory_bulk', {
      p_event_id: eventId,
      p_cantina_id: selectedCantinaId,
      p_user_id: process.env.NEXT_PUBLIC_APP_USER_ID,
      p_lines: lines,
    });
    if (error) throw error;
    await fetchInventoryData();
  }

  useEffect(() => {
    if (selectedCantinaId) fetchInventoryData();
  }, [selectedCantinaId, changes, products.length]);

  return {
    inventory,
    loading,
    initForm, setInitForm,
    adjustForm, setAdjustForm,
    finalForm, setFinalForm,
    adjustType, setAdjustType,
    adjustReason, setAdjustReason,
    saveInitialInventory,
    applyAdjustments,
    saveFinalInventory,
    fetchInventoryData
  };
}

