-- Escenario A: cada cliente vende en una barra DISTINTA (sin contención esperada).
\set cantina random(1, 20)
select bench_sale(:cantina, 2, 0);
