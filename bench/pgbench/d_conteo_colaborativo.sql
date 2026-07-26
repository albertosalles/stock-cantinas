-- Escenario D: conteo inicial colaborativo en la misma barra.
\set prod random(1, 30)
select bench_count(1, :prod);
