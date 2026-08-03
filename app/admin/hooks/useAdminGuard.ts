'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAccessToken, sessionRole, sessionExpired, setAccessToken } from '@/lib/session';

/**
 * Protege las páginas de admin.
 *
 * Antes miraba un booleano en `sessionStorage` que cualquiera podía poner desde
 * la consola. Ahora la fuente de verdad es la cookie httpOnly, que el
 * JavaScript de la página no puede leer ni fabricar: si el token local falta o
 * ha caducado, se le pide otro al servidor y es él quien decide.
 *
 * Sigue siendo una guarda de INTERFAZ, no de datos: evita enseñar el panel a
 * quien no toca, pero lo que impide leer facturación es el token que viaja en
 * cada petición y las políticas de S4 y S5. Saltársela no da acceso a nada,
 * sólo pinta una pantalla vacía.
 *
 * De paso desaparece una molestia de F1: `sessionStorage` es por pestaña, así
 * que la sesión se perdía al recrearse la pestaña del preview. La cookie no.
 */
export function useAdminGuard() {
    const router = useRouter();
    const [checked, setChecked] = useState(false);

    useEffect(() => {
        let cancelado = false;

        async function comprobar() {
            if (getAccessToken() && sessionRole() === 'admin' && !sessionExpired()) {
                if (!cancelado) setChecked(true);
                return;
            }

            // Rehidratación tras una recarga: la cookie sigue puesta, el token no.
            try {
                const res = await fetch('/api/auth/admin');
                if (!res.ok) throw new Error('sin sesión');
                const { token } = await res.json();
                if (cancelado) return;
                setAccessToken(token);
                setChecked(true);
            } catch {
                if (!cancelado) {
                    setAccessToken(null);
                    router.replace('/login');
                }
            }
        }

        comprobar();
        return () => { cancelado = true; };
    }, [router]);

    return checked;
}
