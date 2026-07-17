import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar as BigCalendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import es from 'date-fns/locale/es';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import withDragAndDropRaw from 'react-big-calendar/lib/addons/dragAndDrop';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import { useAuth } from '../context/AuthContext';
import { Calendar, LayoutList, CheckCircle2, ArrowRight, X } from 'lucide-react';
import { updateWorkOrder, joinWorkOrder, deleteWorkOrder } from '../api/workOrders';
import type { WorkOrder } from '../api/workOrders';
import { WorkOrderDetailModal } from '../components/WorkOrderDetailModal';

const withDragAndDrop = (withDragAndDropRaw as any).default || withDragAndDropRaw;
const DnDCalendar = withDragAndDrop(BigCalendar);

const locales = { 'es': es };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface CustomEvent {
  title: string;
  start: Date;
  end: Date;
  order: WorkOrder;
}

export const CalendarPage = () => {
  const { token, hasPermission } = useAuth();
  const canManageCalendar = hasPermission('MANAGE_CALENDAR');
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [events, setEvents] = useState<CustomEvent[]>([]);
  const [unscheduled, setUnscheduled] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [draggedOrder, setDraggedOrder] = useState<WorkOrder | null>(null);
  
  // Calendar State
  const [currentView, setCurrentView] = useState<any>(Views.MONTH);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
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
        } else if (order.status === 'PENDIENTE') {
          newUnscheduled.push(order);
        }
      });

      // Sort unscheduled orders: Priority (Urgente > Alta > Media > Baja) then Folio (descending = most recent first)
      const priorityWeights: Record<string, number> = {
        'URGENTE': 1,
        'ALTA': 2,
        'MEDIA': 3,
        'BAJA': 4
      };

      newUnscheduled.sort((a, b) => {
        const pA = priorityWeights[a.priority] || 99;
        const pB = priorityWeights[b.priority] || 99;
        
        if (pA !== pB) {
          return pA - pB;
        }
        // If same priority, sort by most recent (higher folio first)
        return b.folio - a.folio;
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

  const handleSchedule = async (orderId: string, start: Date, end: Date | null) => {
    try {
      setIsUpdating(true);
      const scheduled_date = start.toISOString();
      // Default to 1 hour if end date is not provided
      const due_date = (end || new Date(start.getTime() + 60 * 60 * 1000)).toISOString();
      
      await axios.patch(`http://localhost:3000/api/work-orders/${orderId}`, {
        scheduled_date,
        due_date
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      await fetchOrders();
    } catch (error) {
      console.error('Error scheduling order:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUnschedule = async (orderId: string) => {
    try {
      setIsUpdating(true);
      await axios.patch(`http://localhost:3000/api/work-orders/${orderId}`, {
        scheduled_date: null,
        due_date: null
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      await fetchOrders();
    } catch (error) {
      console.error('Error unscheduling order:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateWorkOrder = async (id: string, data: any) => {
    await updateWorkOrder(id, data);
    await fetchOrders();
  };

  const handleJoinWorkOrder = async (id: string) => {
    await joinWorkOrder(id);
    setIsDetailModalOpen(false);
    await fetchOrders();
  };

  const handleDeleteWorkOrder = async (id: string) => {
    if (confirm('¿Estás seguro de que deseas eliminar esta orden permanentemente?')) {
      try {
        await deleteWorkOrder(id);
        setIsDetailModalOpen(false);
        setIsModalOpen(false);
        await fetchOrders();
      } catch (error) {
        console.error('Error al eliminar:', error);
        alert('Ocurrió un error al eliminar la orden.');
      }
    }
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

      <div className="w-full min-h-[480px] h-[calc(100dvh-14rem)] md:h-[calc(100vh-160px)] bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4 md:gap-6">
        
        {/* Main Calendar Area */}
        <div className="flex-1 min-h-[420px] md:min-h-0 md:h-full overflow-x-auto overflow-y-hidden">
          <div className="h-full min-w-[280px] md:min-w-0">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <DnDCalendar
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
              style={{ height: '100%', minHeight: 420 }}
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
              className={`dark:text-slate-200 ${isUpdating ? 'opacity-50 pointer-events-none' : ''}`}
              eventPropGetter={(event) => {
                const e = event as CustomEvent;
                // Por defecto: Amarillo (Normales)
                let bg = '#eab308'; 
                
                // Si es Preventivo: Verde
                if (e.order.maintenance_type === 'PREVENTIVO') {
                  bg = '#22c55e'; 
                }
                
                // Si es Urgente/Alta: Rojo (Sobrescribe a los demás por ser crítico)
                if (e.order.priority === 'ALTA' || e.order.priority === 'URGENTE') {
                  bg = '#ef4444'; 
                }
                
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
              draggableAccessor={() => canManageCalendar}
              onEventDrop={({ event, start, end }) => {
                if (!canManageCalendar) return;
                handleSchedule((event as CustomEvent).order.id, new Date(start), new Date(end));
              }}
              onEventResize={({ event, start, end }) => {
                if (!canManageCalendar) return;
                handleSchedule((event as CustomEvent).order.id, new Date(start), new Date(end));
              }}
              onDropFromOutside={({ start, end }) => {
                if (!canManageCalendar) return;
                if (draggedOrder) {
                  handleSchedule(draggedOrder.id, new Date(start), end ? new Date(end) : null);
                  setDraggedOrder(null);
                }
              }}
            />
          )}
          </div>
        </div>

        {/* Sidebar for Unscheduled */}
        {canManageCalendar && (
          <div className="w-full md:w-80 flex flex-col gap-4 max-h-64 md:max-h-none md:h-full shrink-0">
            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 h-full flex flex-col overflow-hidden">
              <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <LayoutList size={18} />
                  Pendientes
                </div>
                <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 py-0.5 px-2 rounded-full text-xs">
                  {unscheduled.length}
                </span>
              </h3>
              
              <div className="flex-1 overflow-y-auto pr-2 -mr-2">
                {unscheduled.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-500" />
                    Todo está programado.
                  </p>
                ) : (
                  <div className={`space-y-3 ${isUpdating ? 'opacity-50 pointer-events-none' : ''}`}>
                    {unscheduled.map(order => (
                      <div 
                        key={order.id} 
                        draggable
                        onDragStart={() => setDraggedOrder(order)}
                        onDragEnd={() => setDraggedOrder(null)}
                        className="bg-white dark:bg-slate-900 p-3 rounded shadow-sm border border-slate-200 dark:border-slate-700 text-sm cursor-grab active:cursor-grabbing hover:border-blue-400 transition-colors" 
                        onClick={() => { setSelectedOrder(order); setIsModalOpen(true); }}
                      >
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
        )}
      </div>

      {isModalOpen && selectedOrder && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex justify-between items-start mb-4">
              <h2 
                className="text-xl font-bold text-blue-600 dark:text-blue-400 cursor-pointer hover:underline"
                onClick={() => setIsDetailModalOpen(true)}
              >
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

            {/* Schedule Section */}
            {canManageCalendar && (
              <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg mb-6 border border-slate-200 dark:border-slate-700">
                <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Programación</h3>
                {selectedOrder.scheduled_date ? (
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                      Agendado del {new Date(selectedOrder.scheduled_date).toLocaleString()} al {new Date(selectedOrder.due_date!).toLocaleString()}
                    </p>
                    <button 
                      onClick={() => {
                        handleUnschedule(selectedOrder.id);
                        setIsModalOpen(false);
                      }}
                      disabled={isUpdating}
                      className="px-3 py-1.5 bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 rounded-lg text-sm font-medium transition-colors"
                    >
                      Desagendar
                    </button>
                  </div>
                ) : (
                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      const start = new Date(formData.get('start_date') as string);
                      const end = new Date(formData.get('end_date') as string);
                      handleSchedule(selectedOrder.id, start, end);
                      setIsModalOpen(false);
                    }}
                    className="space-y-3"
                  >
                    <div className="flex flex-col gap-1 text-sm">
                      <label className="text-slate-500 dark:text-slate-400 font-medium">Inicio</label>
                      <input type="datetime-local" name="start_date" required className="px-2 py-1.5 border border-slate-300 rounded-md dark:bg-slate-900 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="flex flex-col gap-1 text-sm">
                      <label className="text-slate-500 dark:text-slate-400 font-medium">Fin</label>
                      <input type="datetime-local" name="end_date" required className="px-2 py-1.5 border border-slate-300 rounded-md dark:bg-slate-900 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <button type="submit" disabled={isUpdating} className="w-full py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium disabled:opacity-50">
                      Agendar Manualmente
                    </button>
                  </form>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {isDetailModalOpen && selectedOrder && (
        <WorkOrderDetailModal
          workOrder={selectedOrder as any}
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          onUpdate={handleUpdateWorkOrder}
          onDelete={handleDeleteWorkOrder}
          onJoin={handleJoinWorkOrder}
        />
      )}
    </div>
  );
};