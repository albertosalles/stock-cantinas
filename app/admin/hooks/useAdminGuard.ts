'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Hook that protects admin pages by checking sessionStorage.
 * If no admin session exists, redirects to /login.
 * Returns whether the check is complete (to avoid flash of content).
 */
export function useAdminGuard() {
    const router = useRouter();
    const [checked, setChecked] = useState(false);

    useEffect(() => {
        const isAuth = sessionStorage.getItem('admin_authenticated');
        if (isAuth !== 'true') {
            router.replace('/login');
        } else {
            setChecked(true);
        }
    }, [router]);

    return checked;
}
