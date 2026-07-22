import { supabase } from '@/lib/supabaseClient';

// ─── Tipos de incidencia (conjunto fijo) ───
export type IncidentType = 'STOCK' | 'TECH' | 'OTHER';

export interface IncidentTypeMeta {
  type: IncidentType;
  label: string;
  icon: string;
  /** El camarero selecciona productos afectados (solo STOCK). */
  needsProducts: boolean;
  /** La descripción es obligatoria (solo OTHER). */
  needsDescription: boolean;
}

export const INCIDENT_TYPES: IncidentTypeMeta[] = [
  { type: 'STOCK', label: 'Falta de stock', icon: '🧊', needsProducts: true, needsDescription: false },
  { type: 'TECH', label: 'Problema técnico', icon: '🖧', needsProducts: false, needsDescription: false },
  { type: 'OTHER', label: 'Otro', icon: '❓', needsProducts: false, needsDescription: true },
];

export function incidentMeta(type: string): IncidentTypeMeta {
  return INCIDENT_TYPES.find(t => t.type === type) ?? INCIDENT_TYPES[2];
}

// ─── Modelo ───
export interface Incident {
  id: string;
  event_id: string;
  cantina_id: string;
  waiter_id: string | null;
  type: IncidentType;
  product_ids: string[] | null;
  description: string | null;
  status: 'pending' | 'resolved';
  created_at: string;
  resolved_at: string | null;
}

export interface ReportIncidentInput {
  eventId: string;
  cantinaId: string;
  waiterId?: string | null;
  type: IncidentType;
  productIds?: string[];
  description?: string;
}

/** Crea una incidencia (reporte desde el POS). */
export async function reportIncident(input: ReportIncidentInput): Promise<void> {
  const { error } = await supabase.from('incidents').insert({
    event_id: input.eventId,
    cantina_id: input.cantinaId,
    waiter_id: input.waiterId || null,
    type: input.type,
    product_ids: input.productIds && input.productIds.length ? input.productIds : null,
    description: input.description?.trim() || null,
  });
  if (error) throw error;
}

/** Marca una incidencia como resuelta (desde el panel admin). */
export async function resolveIncident(id: string): Promise<void> {
  const { error } = await supabase
    .from('incidents')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}
