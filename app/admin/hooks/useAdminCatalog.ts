import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export interface EventProductRow {
  id: string;
  product_id: string;
  name: string;
  sku: string;
  price_cents: number;
  low_stock_threshold: number;
  active: boolean;
  // Edit fields
  editPrice: string;
  editThreshold: string;
  editActive: boolean;
}

export function useAdminCatalog(eventId: string) {
  const [eventProducts, setEventProducts] = useState<EventProductRow[]>([]);
  const [allProducts, setAllProducts] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchCatalog() {
    setLoading(true);
    const { data: eventProds } = await supabase
      .from('event_products')
      .select('id, product_id, price_cents, low_stock_threshold, active, products(name, sku)')
      .eq('event_id', eventId);

    if (eventProds) {
      const mapped = eventProds.map((row: any) => ({
        id: row.id,
        product_id: row.product_id,
        name: row.products?.name ?? '—',
        sku: row.products?.sku ?? '',
        price_cents: row.price_cents,
        low_stock_threshold: row.low_stock_threshold ?? 0,
        active: row.active ?? true,
        editPrice: (row.price_cents / 100).toFixed(2),
        editThreshold: String(row.low_stock_threshold ?? 0),
        editActive: row.active ?? true,
      }));

      // Ordenar por SKU (alfanumérico)
      mapped.sort((a: any, b: any) => {
        const skuA = String(a.sku || '');
        const skuB = String(b.sku || '');
        return skuA.localeCompare(skuB, undefined, { numeric: true });
      });

      setEventProducts(mapped);
    }

    const { data: allProds } = await supabase
      .from('products')
      .select('id, name')
      .order('name');

    setAllProducts(allProds ?? []);
    setLoading(false);
  }

  async function saveProduct(row: EventProductRow) {
    const priceNum = parseFloat(row.editPrice.replace(',', '.'));
    const thresholdNum = parseInt(row.editThreshold || '0', 10);

    if (isNaN(priceNum) || priceNum < 0) throw new Error('Precio inválido');
    if (isNaN(thresholdNum) || thresholdNum < 0) throw new Error('Umbral inválido');

    const { error } = await supabase
      .from('event_products')
      .update({
        price_cents: Math.round(priceNum * 100),
        low_stock_threshold: thresholdNum,
        active: row.editActive
      })
      .eq('id', row.id);

    if (error) throw error;
    await fetchCatalog();
  }

  async function deleteProduct(row: EventProductRow) {
    const { error } = await supabase
      .from('event_products')
      .delete()
      .eq('id', row.id);

    if (error) throw error;
    await fetchCatalog();
  }

  async function addProduct(productId: string, price: string, threshold: string, active: boolean) {
    const priceNum = parseFloat(price.replace(',', '.'));
    const thresholdNum = parseInt(threshold || '0', 10);

    if (isNaN(priceNum) || priceNum < 0) throw new Error('Precio inválido');
    if (isNaN(thresholdNum) || thresholdNum < 0) throw new Error('Umbral inválido');

    const { error } = await supabase
      .from('event_products')
      .insert({
        event_id: eventId,
        product_id: productId,
        price_cents: Math.round(priceNum * 100),
        low_stock_threshold: thresholdNum,
        active: active,
      });

    if (error) throw error;
    await fetchCatalog();
  }

  async function createGlobalProduct(name: string) {
    if (!name.trim()) throw new Error('Nombre requerido');
    const { error } = await supabase.from('products').insert({ name: name.trim() });
    if (error) throw error;
    await fetchCatalog();
  }

  useEffect(() => {
    if (eventId) fetchCatalog();
  }, [eventId]);

  return {
    eventProducts,
    allProducts,
    loading,
    setEventProducts,
    fetchCatalog,
    saveProduct,
    deleteProduct,
    addProduct,
    createGlobalProduct
  };
}

