import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { adminOp } from '@/lib/adminData';

export interface EventProductRow {
  id: string;
  product_id: string;
  name: string;
  sku: string;
  category: string | null;
  price_cents: number;
  low_stock_threshold: number;
  active: boolean;
  featured: boolean;
  // Edit fields
  editPrice: string;
  editThreshold: string;
  editActive: boolean;
  editCategory: string;
  editFeatured: boolean;
}

export function useAdminCatalog(eventId: string) {
  const [eventProducts, setEventProducts] = useState<EventProductRow[]>([]);
  const [allProducts, setAllProducts] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchCatalog() {
    setLoading(true);
    const { data: eventProds } = await supabase
      .from('event_products')
      .select('id, product_id, price_cents, low_stock_threshold, active, featured, products(name, sku, category)')
      .eq('event_id', eventId);

    if (eventProds) {
      const mapped = eventProds.map((row: any) => ({
        id: row.id,
        product_id: row.product_id,
        name: row.products?.name ?? '—',
        sku: row.products?.sku ?? '',
        category: row.products?.category ?? null,
        price_cents: row.price_cents,
        low_stock_threshold: row.low_stock_threshold ?? 0,
        active: row.active ?? true,
        featured: row.featured ?? false,
        editPrice: (row.price_cents / 100).toFixed(2),
        editThreshold: String(row.low_stock_threshold ?? 0),
        editActive: row.active ?? true,
        editCategory: row.products?.category ?? '',
        editFeatured: row.featured ?? false,
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

    await adminOp('catalogo.guardar', {
      id: row.id,
      priceCents: Math.round(priceNum * 100),
      threshold: thresholdNum,
      active: row.editActive,
      featured: row.editFeatured,
    });

    // La categoría es intrínseca al producto global: se actualiza en `products`
    // (afecta al producto en todos los eventos).
    if ((row.editCategory || null) !== (row.category ?? null)) {
      await adminOp('producto.categoria', { id: row.product_id, category: row.editCategory || null });
    }

    await fetchCatalog();
  }

  async function deleteProduct(row: EventProductRow) {
    await adminOp('catalogo.quitar', { id: row.id });
    await fetchCatalog();
  }

  async function addProduct(productId: string, price: string, threshold: string, active: boolean) {
    const priceNum = parseFloat(price.replace(',', '.'));
    const thresholdNum = parseInt(threshold || '0', 10);

    if (isNaN(priceNum) || priceNum < 0) throw new Error('Precio inválido');
    if (isNaN(thresholdNum) || thresholdNum < 0) throw new Error('Umbral inválido');

    await adminOp('catalogo.anadir', {
      eventId, productId,
      priceCents: Math.round(priceNum * 100),
      threshold: thresholdNum,
      active,
    });
    await fetchCatalog();
  }

  async function createGlobalProduct(name: string, category?: string) {
    if (!name.trim()) throw new Error('Nombre requerido');
    await adminOp('producto.crear', { name, category: category || null });
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

