'use client';
import { useMemo, useState } from 'react';
import { createSale } from '@/lib/sales';

type Product = { id: string; name: string; price_cents: number };
type InventoryRow = { product_id: string; current_qty: number; low_stock_threshold: number };

export default function CantinaPOS({
  eventId, cantinaId, userId, products, inventory, onSold
}: {
  eventId: string; cantinaId: string; userId: string;
  products: Product[]; inventory: InventoryRow[]; onSold?: () => void;
}) {
  const [cart, setCart] = useState<{productId:string, qty:number}[]>([]);

  const invByProduct = useMemo(() => {
    const m = new Map<string, InventoryRow>();
    (inventory || []).forEach(r => m.set(r.product_id, r));
    return m;
  }, [inventory]);

  const addOne = (pid: string) => setCart((c) => {
    const i = c.findIndex(x => x.productId === pid);
    if (i >= 0) { const n=[...c]; n[i] = {...n[i], qty: n[i].qty+1}; return n; }
    return [...c, {productId: pid, qty: 1}];
  });

  const totalEur = useMemo(() => cart.reduce((sum, line) => {
    const p = products.find(x => x.id === line.productId);
    return sum + (p ? (p.price_cents/100)*line.qty : 0);
  }, 0), [cart, products]);

  const sell = async () => {
    await createSale(eventId, cantinaId, userId, cart);
    setCart([]);
    onSold?.();
  };

  return (
    <div className="grid grid-cols-2 gap-3 p-4">
      {products.map((p:any) => {
        const inv = invByProduct.get(p.id);
        const qty = inv?.current_qty ?? 0;
        const low = inv?.low_stock_threshold ?? 0;
        const status =
          qty <= 0 ? 'agotado' :
          qty <= low ? 'bajo' : 'ok';

        return (
          <button
            key={p.id}
            className="rounded-2xl shadow p-6 text-left disabled:opacity-50"
            onClick={() => addOne(p.id)}
            disabled={qty <= 0}
            title={qty <= 0 ? 'Sin stock' : undefined}
          >
            <div className="text-xl font-semibold">{p.name}</div>
            <div className="opacity-70">{(p.price_cents/100).toFixed(2)} €</div>

            <div className="mt-2 text-sm flex items-center gap-2">
              <span>
                Stock: {qty}
              </span>
              <span className={
                status === 'agotado' ? 'w-2 h-2 rounded-full bg-red-600 inline-block' :
                status === 'bajo'    ? 'w-2 h-2 rounded-full bg-amber-500 inline-block' :
                                        'w-2 h-2 rounded-full bg-green-600 inline-block'
              } />
            </div>
          </button>
        );
      })}

      <div className="col-span-2 mt-4 flex gap-3 items-center">
        <button
          className="rounded-2xl shadow px-6 py-3"
          onClick={sell}
          disabled={!cart.length}
        >
          Vender ({cart.reduce((a,b)=>a+b.qty,0)}) — {totalEur.toFixed(2)} €
        </button>
        <pre className="text-sm opacity-70">{JSON.stringify(cart)}</pre>
      </div>
    </div>
  );
}
