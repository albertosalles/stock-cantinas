-- Escenario C: misma barra Y mismo producto (cerveza, sku 3).
-- Hoy es idéntico a B (el lock es de barra). Tras materializar el stock debería
-- convertirse en el nuevo punto caliente, ahora sobre una sola fila.
select bench_sale(1, 1, 3);
