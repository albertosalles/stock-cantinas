-- Venta en una de las N barras activas del partido.
-- :ncantinas se pasa con -D ncantinas=N
\set c random(1, :ncantinas)
select bench_sale(:c, 2, 0);
