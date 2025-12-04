import { useState, useMemo } from 'react';

type CartItem = {
  productId: string;
  qty: number;
};

type Product = {
  id: string;
  price_cents: number;
};

export function useCart(products: Product[]) {
  const [cart, setCart] = useState<CartItem[]>([]);

  const addOne = (pid: string) => setCart((c) => {
    const i = c.findIndex(x => x.productId === pid);
    if (i >= 0) { 
      const n = [...c]; 
      n[i] = { ...n[i], qty: n[i].qty + 1 }; 
      return n; 
    }
    return [...c, { productId: pid, qty: 1 }];
  });

  const decOne = (pid: string) => setCart((c) => {
    const i = c.findIndex(x => x.productId === pid);
    if (i === -1) return c;
    const n = [...c];
    const q = n[i].qty - 1;
    if (q <= 0) return n.filter(l => l.productId !== pid);
    n[i] = { ...n[i], qty: q }; 
    return n;
  });

  const clearCart = () => setCart([]);

  const totalEur = useMemo(() =>
    cart.reduce((sum, line) => {
      const p = products.find(x => x.id === line.productId);
      return sum + (p ? (p.price_cents / 100) * line.qty : 0);
    }, 0)
  , [cart, products]);

  const totalItems = useMemo(() => 
    cart.reduce((sum, line) => sum + line.qty, 0)
  , [cart]);

  return {
    cart,
    addOne,
    decOne,
    clearCart,
    totalEur,
    totalItems
  };
}

