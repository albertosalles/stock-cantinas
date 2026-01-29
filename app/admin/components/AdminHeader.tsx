import React from 'react';
import Link from 'next/link';

import NotificationBell from './NotificationBell';

interface AdminHeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  backUrl?: string;
  children?: React.ReactNode;
  eventId?: string;
}

export default function AdminHeader({
  title = 'Panel de Administración',
  subtitle = 'Configuración de eventos y catálogo',
  showBack = false,
  backUrl = '/admin',
  children,
  eventId
}: AdminHeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-gradient-to-r from-elche-primary to-elche-secondary text-white shadow-md h-auto transition-all">
      <div className="w-full max-w-[1600px] mx-auto px-6 py-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4 self-start md:self-auto">
            {showBack && (
              <Link href={backUrl} className="text-white/90 hover:text-white hover:scale-110 transition-transform text-xl p-2 bg-white/10 rounded-full backdrop-blur-md">
                ←
              </Link>
            )}
            <div>
              <div className="text-2xl font-bold leading-tight tracking-tight">{title}</div>
              <div className="text-sm opacity-90 font-medium">{subtitle}</div>
            </div>
          </div>

          <div className="flex items-center gap-3 self-stretch md:self-auto justify-end">
            {children && (
              <div className="flex gap-2 bg-white/10 p-1.5 rounded-2xl backdrop-blur-md border border-white/10 overflow-x-auto max-w-full">
                {children}
              </div>
            )}

            {eventId && <NotificationBell eventId={eventId} />}
          </div>
        </div>
      </div>
    </header>
  );
}
