#!/usr/bin/env bash
# ============================================================================
# Medición del techo global: ¿cuántas cantinas simultáneas aguanta el sistema?
#
# Simula el PICO DEL DESCANSO de un partido y sube el número de barras hasta que
# la venta deja de ser fluida para el cajero.
#
# Modelo, tomado de los datos del propio banco (INF-2):
#   · Pico medido: 4.478 ventas en 10 min repartidas en 20 barras
#     → 0,373 ventas/s POR BARRA.
#   · Carga de administración, con 3 administradores conectados:
#       ANTES  → sin agrupar: cada movimiento de stock provocaba un refetch en
#                cada uno de los 5 hooks de cada admin. Una venta genera ~2,4
#                movimientos ⇒ 2,4 × 5 × 3 = 36 consultas por venta.
#       DESPUÉS → agrupadas en ventana de 2,5 s: ~1,4 invalidaciones/s por
#                administrador con independencia del ritmo de ventas ⇒ ~4 /s.
#
# Criterio de aceptación: menos del 1 % de las ventas por encima de 500 ms.
# Medio segundo es el umbral a partir del cual el cajero percibe que el TPV
# "se ha quedado pensando" con el cliente delante.
#
# Uso:  ./bench/techo.sh <base_de_datos> <lista de N>
#       ./bench/techo.sh cantinas "10 20 40 60 80"
# ============================================================================
set -u
DB="${1:-cantinas}"
NS="${2:-10 20 40}"
DUR="${DUR:-15}"
VENTAS_POR_BARRA=0.373

printf '%-6s %-10s %-10s %-9s %-11s %-9s %s\n' \
  "Barras" "Ventas/s" "Admin real/pedido" "TPS real" "Latencia" ">500ms" "Veredicto"

for N in $NS; do
  RS=$(awk -v n="$N" -v r="$VENTAS_POR_BARRA" 'BEGIN{printf "%.1f", n*r}')

  # La base se resiembra con EXACTAMENTE N cantinas y 1.000 ventas por cantina.
  # Sin esto la medición estaría sesgada por dos vías: el grid recorre todas las
  # cantinas registradas (penalizaría a los N pequeños) y el histórico por barra
  # variaría con N (favorecería a la vista agregada del estado antiguo).
  VENTAS=$((N * 1000))
  docker exec cantinas-bench psql -U postgres -d "$DB" -tAc \
    "select bench_seed($N, $VENTAS, 60); select bench_topup(500000);" >/dev/null 2>&1

  if [ "$DB" = "antes" ]; then
    RA=$(awk -v rs="$RS" 'BEGIN{printf "%.0f", rs*36}')
  else
    RA=4
  fi

  CLI=$(awk -v n="$N" 'BEGIN{c=n*3; if(c>48)c=48; if(c<4)c=4; printf "%d", c}')

  # Carga de administración en segundo plano (grid 3:1 stock bajo).
  # Se guarda su salida para poder comprobar si llega al ritmo pedido: si no
  # llega, es que la instancia ya está saturada por el propio panel.
  docker exec -d cantinas-bench sh -c "pgbench -n -U postgres -d $DB \
    -f /tmp/pgbench/f_admin_grid.sql@3 -f /tmp/pgbench/g_admin_stockbajo.sql@1 \
    -c 8 -j 2 -T $((DUR + 4)) -R $RA > /tmp/admin_$N.txt 2>&1"
  sleep 1

  OUT=$(docker exec cantinas-bench pgbench -n -U postgres -d "$DB" \
    -f /tmp/pgbench/e_venta_partido.sql -D ncantinas="$N" \
    -c "$CLI" -j 4 -T "$DUR" -R "$RS" --latency-limit=500 2>&1)

  TPS=$(echo "$OUT"  | grep -oE '^tps = [0-9.]+' | grep -oE '[0-9.]+$' | head -1)
  LAT=$(echo "$OUT"  | grep -oE 'latency average = [0-9.]+' | grep -oE '[0-9.]+' | head -1)
  TARDE=$(echo "$OUT"| sed -n 's/.*latency limit: [0-9]*\/[0-9]* (\([0-9.]*\)%).*/\1/p' | head -1)
  TARDE=${TARDE:-0}

  sleep 4
  ATPS=$(docker exec cantinas-bench sh -c "grep -oE '^tps = [0-9.]+' /tmp/admin_$N.txt 2>/dev/null | grep -oE '[0-9.]+$' | head -1")
  ADMIN_REAL=$(awk -v a="${ATPS:-0}" -v r="$RA" 'BEGIN{printf "%.0f/%s", a, r}')

  # Dos formas de degradarse, y hay que vigilar las dos:
  #   1. La venta se vuelve lenta para el cajero (>1 % por encima de 500 ms).
  #   2. El PANEL no llega al ritmo que necesitaría. No afecta a la venta, pero
  #      significa cuadros de mando y alertas retrasados: el administrador deja
  #      de ver el partido en tiempo real. Es el modo en que se degradaba antes.
  VER=$(awk -v t="$TARDE" -v a="${ATPS:-0}" -v r="$RA" 'BEGIN{
    lento = (t >= 1.0);
    panel = (a < r*0.9);
    if (lento && panel) print "DEGRADADO (venta+panel)";
    else if (lento)     print "DEGRADADO (venta lenta)";
    else if (panel)     print "DEGRADADO (panel retrasado)";
    else                print "OK";
  }')
  printf '%-6s %-10s %-10s %-9s %-11s %-9s %s\n' \
    "$N" "$RS" "$ADMIN_REAL" "${TPS:-–}" "${LAT:-–} ms" "${TARDE}%" "$VER"

  sleep 5
done
