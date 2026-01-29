'use client';

import { useState } from 'react';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { get, set, del } from 'idb-keyval';
import { Persister } from '@tanstack/react-query-persist-client';

// 1. Creamos un "Persister" (Adaptador) para guardar la caché en IndexedDB
// Esto permite guardar megas de datos (localStorage solo permite 5MB)
const createIDBPersister = (key = 'reactQueryClient'): Persister => ({
  persistClient: async (client) => {
    await set(key, client);
  },
  restoreClient: async () => {
    return await get(key);
  },
  removeClient: async () => {
    await del(key);
  },
});

export default function Providers({ children }: { children: React.ReactNode }) {
  // 2. Configuración del Cliente
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Tiempo que los datos se consideran "frescos" (5 minutos)
            // Si navegas y vuelves antes de 5 min, no hace petición nueva.
            staleTime: 1000 * 60 * 5, 
            
            // Tiempo que los datos permanecen en memoria/disco (24 horas)
            // CRÍTICO PARA OFFLINE: Si abres la app mañana sin internet, 
            // los datos seguirán ahí.
            gcTime: 1000 * 60 * 60 * 24, 
          },
        },
      })
  );

  // 3. Inicializamos el persister
  const [persister] = useState(() => createIDBPersister());

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}