import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

export interface Opponent {
  id: string;
  name: string;
}

/** Tipos de competición admitidos. Coinciden con el CHECK de la tabla. */
export const TIPOS_PARTIDO = ['Liga', 'Copa del Rey', 'Amistoso', 'Otro'] as const;
export type TipoPartido = (typeof TIPOS_PARTIDO)[number];

/**
 * Catálogo de rivales.
 *
 * El alta es en línea desde el formulario del evento, sin pantalla propia de
 * gestión: se crea un rival la primera vez que se juega contra él y a partir de
 * ahí se elige de la lista. Eso basta para que la comparativa histórica agrupe
 * por una referencia estable, que es el motivo de que exista el catálogo.
 */
export function useOpponents() {
  const queryClient = useQueryClient();

  const { data = [], isLoading } = useQuery({
    queryKey: ['opponents'],
    staleTime: 1000 * 60 * 10,
    queryFn: async (): Promise<Opponent[]> => {
      const { data, error } = await supabase
        .from('opponents')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  /** Crea el rival si no existe y devuelve su id en cualquier caso. */
  async function crearRival(nombre: string): Promise<string> {
    const limpio = nombre.trim();
    if (!limpio) throw new Error('El nombre del rival no puede estar vacío');

    const existente = data.find(o => o.name.toLowerCase() === limpio.toLowerCase());
    if (existente) return existente.id;

    const { data: creado, error } = await supabase
      .from('opponents')
      .insert({ name: limpio })
      .select('id')
      .single();
    if (error) throw error;

    await queryClient.invalidateQueries({ queryKey: ['opponents'] });
    return creado.id;
  }

  return { opponents: data, loading: isLoading, crearRival };
}
