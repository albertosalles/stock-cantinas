'use client';

import AdminHeader from './components/AdminHeader';
import { useAdminEvents } from './hooks/useAdminEvents';
import CreateEventForm from './components/CreateEventForm';
import EventsList from './components/EventsList';

export default function AdminHome() {
  const { events, loading, createEvent, updateEventStatus } = useAdminEvents();

  return (
    <div className="min-h-screen bg-elche-bg pb-20">
      <AdminHeader />

      <main className="max-w-[1200px] mx-auto p-6 grid gap-8">
        
        <CreateEventForm onCreate={createEvent} />

        <section>
          <div className="font-bold text-xl mb-6 text-elche-text flex items-center gap-3">
            <span className="bg-elche-primary/10 p-2 rounded-xl text-elche-primary">📅</span>
            Eventos registrados
          </div>

          <EventsList 
            events={events} 
            loading={loading} 
            onUpdateStatus={updateEventStatus} 
          />
        </section>
      </main>
    </div>
  );
}
