import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar as BigCalendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import es from 'date-fns/locale/es';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useAuth } from '../context/AuthContext';
import { Calendar, LayoutList, CheckCircle2, ArrowRight, X } from 'lucide-react';

const locales = { 'es': es };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface WorkOrder {
  id: string;
  folio: number;
  title: string;
  priority: string;
  status: string;
  scheduled_date: string | null;
  due_date: string | null;
  assigned_technicians: { id: string; name: string }[];
}

interface CustomEvent {
  title: string;
  start: Date;
  end: Date;
  order: WorkOrder;
}

export const CalendarPage = () => {
  const { token } = useAuth();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [events, setEvents] = useState<CustomEvent[]>([]);
  const [unscheduled, setUnscheduled] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Calendar State
  const [currentView, setCurrentView] = useState<any>(Views.MONTH);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);

  const fetchOrders = async () => {
    try {
      const response = await axios.get('http://localhost:3000/api/work-orders', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data: WorkOrder[] = response.data;
      setWorkOrders(data);
      
      const newEvents: CustomEvent[] = [];
      const newUnscheduled: WorkOrder[] = [];

      data.forEach(order => {
        if (order.scheduled_date && order.due_date) {
          newEvents.push({
            title: `#${order.folio} - ${order.title}`,
            start: new Date(order.scheduled_date),
            end: new Date(order.due_date),
            order: order
          });
        } else {
          newUnscheduled.push(order);
        }
      });

      setEvents(newEvents);
      setUnscheduled(newUnscheduled);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching work orders:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [token]);

  const handleEventClick = (event: CustomEvent) => {
    setSelectedOrder(event.order);
    setIsModalOpen(true);
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Calendar className="text-blue-600 dark:text-blue-400" size={28} />
            Calendario de Mantenimiento
          </h1>
          <p className="text-slate-500 dark:text-slate-300 mt-1">Programa y visualiza las órdenes de trabajo.</p>
        </div>
      </div>

      <div className="flex-1 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col md:flex-row gap-6">
        
        {/* Main Calendar Area */}
        <div className="flex-1 h-[calc(100vh-220px)] overflow-auto">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <BigCalendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              defaultDate={new Date()}
              date={currentDate}
              onNavigate={(date) => setCurrentDate(date)}
              view={currentView}
              onView={(view) => setCurrentView(view)}
              views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
              culture="es"
              messages={{
                next: "Sig",
                previous: "Ant",
                today: "Hoy",
                month: "Mes",
                week: "Semana",
                day: "Día",
                agenda: "Agenda",
                date: "Fecha",
                time: "Hora",
                event: "Evento"
              }}
              onSelectEvent={handleEventClick}
              className="dark:text-slate-200"
              eventPropGetter={(event) => {
                const e = event as CustomEvent;
                let bg = '#3b82f6'; // blue
                if (e.order.status === 'EN_PROCESO') bg = '#eab308'; // yellow
                if (e.order.status === 'FINALIZADO') bg = '#22c55e'; // green
                if (e.order.priority === 'ALTA' || e.order.priority === 'URGENTE') bg = '#ef4444'; // red
                
                return {
                  style: {
                    backgroundColor: bg,
                    borderRadius: '6px',
                    border: 'none',
                    color: 'white',
                    display: 'block',
                    padding: '2px 5px',
                    fontSize: '0.85em',
                    fontWeight: '500'
                  }
                };
              }}
            />
          )}
        </div>

        {/* Sidebar for Unscheduled */}
        <div className="w-full md:w-72 flex flex-col gap-4">
          <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 h-full overflow-y-auto">
            <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
              <LayoutList size={18} />
              Pendientes de Programar
            </h3>
            {unscheduled.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-500" />
                Todo está programado.
              </p>
            ) : (
              <div className="space-y-3">
                {unscheduled.map(order => (
                  <div key={order.id} className="bg-white dark:bg-slate-900 p-3 rounded shadow-sm border border-slate-200 dark:border-slate-700 text-sm cursor-pointer hover:border-blue-400 transition-colors" onClick={() => { setSelectedOrder(order); setIsModalOpen(true); }}>
                    <div className="font-bold text-slate-800 dark:text-slate-200">#{order.folio}</div>
                    <div className="text-slate-600 dark:text-slate-400 line-clamp-2 mt-1">{order.title}</div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        order.priority === 'ALTA' || order.priority === 'URGENTE' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                        order.priority === 'MEDIA' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                        'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}>
                        {order.priority}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {isModalOpen && selectedOrder && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Orden #{selectedOrder.folio}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X size={24} />
              </button>
            </div>
            <p className="text-slate-600 dark:text-slate-300 mb-6">{selectedOrder.title}</p>
            <div className="space-y-3 mb-6">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Estado:</span>
                <span className="font-medium dark:text-white">{selectedOrder.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Prioridad:</span>
                <span className="font-medium dark:text-white">{selectedOrder.priority}</span>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                Cerrar
              </button>
              <a href={`/`} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                Ir a Dashboard <ArrowRight size={16} />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};