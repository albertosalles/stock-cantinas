'use client';

import React from 'react';
import { TRAMOS_DISPONIBLES, type SlotVentas, type Tramo, type FasePartido } from '../hooks/useSalesBySlot';

/**
 * Mapa de calor de afluencia a lo largo del partido.
 *
 * Dos lecturas superpuestas a propósito:
 *   · la ALTURA de la barra da la magnitud exacta, comparable entre tramos;
 *   · la INTENSIDAD del color da la lectura de un vistazo, que es lo que
 *     convierte esto en un mapa de calor y no en otro gráfico de barras.
 *
 * Debajo, una banda con las fases del partido: sin ella los tramos son sólo
 * horas sueltas y se pierde justo lo que se quiere analizar — que el pico está
 * en el descanso y que durante el juego no se vende.
 */

/** Forma corta para bandas de un solo tramo. */
const ABREV: Record<FasePartido, string> = {
  'Previa': 'PRE',
  '1ª parte': '1ª',
  'Descanso': 'DESC',
  '2ª parte': '2ª',
  'Final': 'FIN',
};

const COLOR_FASE: Record<FasePartido, string> = {
  'Previa': '#7cc4a0',
  '1ª parte': '#4da77b',
  'Descanso': '#f0a500',
  '2ª parte': '#4da77b',
  'Final': '#7cc4a0',
};

interface Props {
  /** Encabezado. Distingue la curva del evento de la de una barra concreta. */
  titulo?: string;
  slots: SlotVentas[];
  tramo: Tramo;
  onTramoChange: (t: Tramo) => void;
  sinKickoff: boolean;
  loading: boolean;
  /** Lleva a la pestaña donde se define la hora de inicio. */
  onDefinirKickoff?: () => void;
  /**
   * Total de tickets del ámbito (evento o cantina). Sirve para avisar de cuántas
   * ventas quedan FUERA de la ventana del partido: sin ese aviso, el KPI de
   * arriba y la suma del gráfico no cuadran y parece un error de cálculo.
   */
  totalReferencia?: number;
}

export default function SalesHeatmap({
  titulo = 'Afluencia durante el partido',
  slots, tramo, onTramoChange, sinKickoff, loading, onDefinirKickoff, totalReferencia,
}: Props) {
  // La magnitud es el NÚMERO DE TICKETS, no la recaudación: la pregunta que
  // responde esta tarjeta es cuánta gente pasa por la barra, y un tramo de pocos
  // tickets caros no es un tramo de mucha afluencia. La recaudación sigue
  // estando en el detalle de cada tramo.
  const maxTickets = Math.max(...slots.map(s => s.numSales), 1);
  const totalTickets = slots.reduce((n, s) => n + s.numSales, 0);

  // Tramo más concurrido: es la respuesta a "¿cuál es el instante de mayor
  // afluencia?", así que se destaca en vez de dejar que se busque a ojo.
  const pico = slots.reduce<SlotVentas | null>(
    (max, s) => (!max || s.numSales > max.numSales ? s : max), null);

  const eur = (c: number) => `${(c / 100).toFixed(0)}€`;

  // Fases consecutivas agrupadas, para pintar la banda inferior de una pieza.
  const bandas: { fase: FasePartido; ancho: number }[] = [];
  slots.forEach(s => {
    const ultima = bandas[bandas.length - 1];
    if (ultima && ultima.fase === s.fase) ultima.ancho += 1;
    else bandas.push({ fase: s.fase, ancho: 1 });
  });

  return (
    <div className="rounded-2xl border border-elche-gray bg-white p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="ms text-xl text-elche-primary">local_fire_department</span>
          <h3 className="m-0 text-[15px] font-extrabold tracking-tight">{titulo}</h3>
        </div>

        {!sinKickoff && (
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-elche-bg px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#8aa397]">
              Tickets
            </span>
          <div className="flex items-center gap-1 rounded-lg bg-elche-bg p-0.5">
            {TRAMOS_DISPONIBLES.map(t => (
              <button
                key={t}
                onClick={() => onTramoChange(t)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors ${
                  t === tramo ? 'bg-white text-elche-primary shadow-sm' : 'text-[#8aa397] hover:text-elche-primary'
                }`}
              >
                {t} min
              </button>
            ))}
          </div>
          </div>
        )}
      </div>

      {sinKickoff ? (
        // Sin hora de inicio no hay ventana de partido que acotar, así que se
        // pide el dato en lugar de mostrar un gráfico vacío que parecería un fallo.
        <div className="flex h-[210px] flex-col items-center justify-center gap-3 text-center text-elche-text-light">
          <span className="ms text-4xl text-[#bfe3cf]">schedule</span>
          <div>
            <div className="text-[13px] font-bold text-elche-text">Falta la hora de inicio</div>
            <div className="mt-1 max-w-[300px] text-[12px] font-semibold">
              La afluencia se mide desde la apertura de puertas, hora y media antes del partido.
            </div>
          </div>
          {onDefinirKickoff && (
            <button
              onClick={onDefinirKickoff}
              className="rounded-[10px] bg-elche-primary px-4 py-2 text-[12.5px] font-bold text-white transition-colors hover:bg-elche-secondary"
            >
              Definirla en General
            </button>
          )}
        </div>
      ) : loading ? (
        <div className="flex h-[210px] items-center justify-center text-[12.5px] font-semibold text-elche-text-light">
          Calculando…
        </div>
      ) : totalTickets === 0 ? (
        <div className="flex h-[210px] flex-col items-center justify-center gap-2 text-elche-text-light">
          <span className="ms text-4xl text-[#bfe3cf]">bar_chart</span>
          <span className="text-[12.5px] font-semibold">Sin ventas en la ventana del partido</span>
        </div>
      ) : (
        <>
          {typeof totalReferencia === 'number' && totalReferencia > totalTickets && (
            <div className="mb-3 flex items-center gap-2 text-[11.5px] font-semibold text-[#8aa397]">
              <span className="ms text-sm">info</span>
              <span>
                {totalReferencia - totalTickets} de {totalReferencia} ventas quedan fuera
                de la ventana del partido y no se cuentan aquí
              </span>
            </div>
          )}

          {pico && pico.numSales > 0 && (
            <div className="mb-3 flex items-center gap-2 rounded-[10px] bg-[#fff8e8] px-3 py-2">
              <span className="ms text-base text-[#f0a500]">trending_up</span>
              <span className="text-[12px] font-semibold text-elche-text">
                Mayor afluencia a las <b>{pico.etiqueta}</b> · {pico.fase} ·{' '}
                <b>{pico.numSales}</b> tickets
              </span>
            </div>
          )}

          <div className="overflow-x-auto">
            <div style={{ minWidth: `${slots.length * 34}px` }}>
              {/* Barras */}
              <div className="flex h-[150px] items-end gap-[3px]">
                {slots.map(s => {
                  const alturaPct = (s.numSales / maxTickets) * 100;
                  // La opacidad codifica el calor; el mínimo evita que un tramo
                  // con pocas ventas se confunda con uno vacío.
                  const calor = s.numSales === 0 ? 0 : 0.25 + (s.numSales / maxTickets) * 0.75;
                  return (
                    <div key={s.minuto} className="flex h-full flex-1 flex-col justify-end" title={
                      `${s.etiqueta} · ${s.fase}\n${s.numSales} tickets · ${eur(s.totalCents)}`
                    }>
                      <div
                        className="w-full rounded-t-[5px] transition-[height] duration-500"
                        style={{
                          height: `${Math.max(s.numSales > 0 ? 4 : 2, alturaPct)}%`,
                          background: s.numSales === 0 ? '#eef4f0' : COLOR_FASE[s.fase],
                          opacity: s.numSales === 0 ? 1 : calor,
                        }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Banda de fases */}
              <div className="mt-1.5 flex gap-[3px]">
                {bandas.map((b, i) => (
                  <div key={i} style={{ flex: b.ancho }} className="min-w-0">
                    <div className="h-[3px] rounded-full" style={{ background: COLOR_FASE[b.fase] }} />
                    <div className="mt-1 text-center text-[9.5px] font-bold uppercase tracking-[0.04em] text-[#8aa397]">
                      {/* Una banda de un solo tramo no da para "DESCANSO": se
                          abrevia en vez de recortarla con puntos suspensivos,
                          que dejaban ilegible justo la fase más importante. */}
                      {b.ancho >= 2 ? b.fase : ABREV[b.fase]}
                    </div>
                  </div>
                ))}
              </div>

              {/* Horas: sólo una de cada dos si hay muchos tramos, para que se lean */}
              <div className="mt-1 flex gap-[3px]">
                {slots.map((s, i) => (
                  <div key={s.minuto} className="min-w-0 flex-1 text-center">
                    {(slots.length <= 16 || i % 2 === 0) && (
                      <span className="text-[9.5px] font-semibold text-[#8aa397]">{s.etiqueta}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
