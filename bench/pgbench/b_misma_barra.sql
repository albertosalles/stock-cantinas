-- Escenario B: todos los clientes venden en la MISMA barra.
-- Mide el coste del advisory lock por (evento, cantina).
select bench_sale(1, 2, 0);
