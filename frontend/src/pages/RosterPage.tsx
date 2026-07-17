import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import type { Event } from 'react-big-calendar';
import withDragAndDrop, { withDragAndDropProps } from 'react-big-calendar/lib/addons/dragAndDrop';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import es from 'date-fns/locale/es';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import { useAuth } from '../context/AuthContext';
import { getRoster, assignPattern, addException, removeException } from '../api/roster';
import type { TechnicianPattern, TechnicianException, RosterResponse } from '../api/roster';
import { startOfMonth, endOfMonth, differenceInDays, addDays } from 'date-fns';
import { Trash2, UserPlus, Calendar as CalendarIcon, Clock, AlertCircle, X, Printer } from 'lucide-react';

const locales = { 'es': es };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });
// Cast is needed because vite/rollup export handling of this HOC can be tricky
const withDragAndDropRaw = withDragAndDrop as any;
const DnDCalendar = (withDragAndDropRaw.default ? withDragAndDropRaw.default(Calendar) : withDragAndDropRaw(Calendar)) as React.ComponentType<any>;

interface RosterEvent extends Event {
  id: string;
  isException: boolean;
  exceptionId?: string;
  user_id: string;
  shiftTitle: string;
  dateStr: string;
}

const EXCEPTION_TYPES = [
  { type: 'FALTA', label: 'Falta', color: 'bg-rose-500', short: 'F' },
  { type: 'VACACIONES', label: 'Vacaciones', short: 'V', color: 'bg-emerald-500 hover:bg-emerald-600' },
  { type: 'PERMISO_SG', label: 'Permiso S/G', short: 'PSG', color: 'bg-amber-500 hover:bg-amber-600' },
  { type: 'PERMISO_CG', label: 'Permiso C/G', short: 'PCG', color: 'bg-indigo-500 hover:bg-indigo-600' },
  { type: 'TIEMPO_EXTRA', label: 'Tiempo Extra', short: 'TE', color: 'bg-cyan-500 hover:bg-cyan-600' },
  { type: 'TIEMPO_POR_TIEMPO', label: 'Tiempo por Tiempo', short: 'TxT', color: 'bg-teal-500 hover:bg-teal-600' },
  { type: 'FESTIVO', label: 'Día Festivo', short: 'DF', color: 'bg-fuchsia-500 hover:bg-fuchsia-600' },
];

export const RosterPage = () => {
  const { hasPermission } = useAuth();
  const canManageShifts = hasPermission('MANAGE_SHIFTS');
  const [data, setData] = useState<RosterResponse | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [showPatternModal, setShowPatternModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedPattern, setSelectedPattern] = useState('4X4_ROTATORIO');
  const [patternStartDate, setPatternStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const [draggedException, setDraggedException] = useState<{ type: string, user_id: string } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const start = format(startOfMonth(currentDate), 'yyyy-MM-dd');
      const end = format(endOfMonth(currentDate), 'yyyy-MM-dd');
      const res = await getRoster(start, end);
      setData(res);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentDate]);

  const handleAssignPattern = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !selectedPattern || !patternStartDate) return;
    
    await assignPattern({
      user_id: selectedUser,
      pattern_type: selectedPattern,
      start_date: patternStartDate
    });
    
    setShowPatternModal(false);
    fetchData();
  };

  const handleDropFromOutside = useCallback(
    ({ start, allDay: isAllDay }: { start: Date, end: Date, allDay?: boolean }) => {
      if (!draggedException) return;

      const dateStr = format(start, 'yyyy-MM-dd');
      
      addException({
        user_id: draggedException.user_id,
        date: dateStr,
        exception_type: draggedException.type,
      }).then(() => {
        fetchData();
      }).catch(console.error);

      setDraggedException(null);
    },
    [draggedException]
  );

  const handleSelectEvent = async (event: RosterEvent) => {
    if (!canManageShifts) return;
    if (event.isException) {
      if (window.confirm(`¿Deseas eliminar la incidencia '${event.shiftTitle}' de ${event.title.split(' - ')[0]} para regresar al turno regular?`)) {
        removeException(event.exceptionId!).then(() => fetchData());
      }
    }
  };

  const events = useMemo(() => {
    if (!data) return [];
    const _events: RosterEvent[] = [];
    
    // We render for a slightly wider range to cover the visible calendar grid
    const calStart = addDays(startOfMonth(currentDate), -7);
    const calEnd = addDays(endOfMonth(currentDate), 7);
    
    let curr = new Date(calStart);
    while (curr <= calEnd) {
      const currStr = format(curr, 'yyyy-MM-dd');
      
      data.patterns.forEach(pattern => {
        const userExceptions = data.exceptions.filter(e => {
          const exceptionDateStr = e.date.split('T')[0];
          return e.user_id === pattern.user_id && exceptionDateStr === currStr;
        });
        
        let hasOverride = false;
        
        if (userExceptions.length > 0) {
          userExceptions.forEach(exc => {
            const eType = EXCEPTION_TYPES.find(t => t.type === exc.exception_type);
            const shortName = exc.user.name.split(' ')[0];
            _events.push({
              id: `exc-${exc.id}`,
              isException: true,
              exceptionId: exc.id,
              user_id: exc.user_id,
              shiftTitle: exc.exception_type,
              title: `${shortName} [${eType?.short || exc.exception_type}]`,
              start: new Date(curr),
              end: new Date(curr),
              allDay: true,
              dateStr: currStr,
            });
            hasOverride = true;
          });
        }

        const [yyyy, mm, dd] = pattern.start_date.split('T')[0].split('-');
        const patternStart = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
        const daysDiff = differenceInDays(curr, patternStart);
        if (daysDiff >= 0 && !hasOverride) {
          let shiftTitle = '';
          
          if (pattern.pattern_type === 'MIXTO') {
             const dayOfWeek = getDay(curr); // 0 = Sunday, 1 = Monday
             if (dayOfWeek >= 1 && dayOfWeek <= 5) shiftTitle = 'Mixto (L-V)';
             else if (dayOfWeek === 6) shiftTitle = 'Mixto (Sáb)';
             else { shiftTitle = 'Descanso'; }
          } else if (pattern.pattern_type === '4X4_ROTATORIO') {
             const cycleDay = daysDiff % 8;
             if (cycleDay === 0 || cycleDay === 1) shiftTitle = 'Día';
             else if (cycleDay === 2 || cycleDay === 3) shiftTitle = 'Noche';
             else { shiftTitle = 'Descanso'; }
          } else if (pattern.pattern_type === '4X4_FIJO') {
             const cycleDay = daysDiff % 8;
             if (cycleDay >= 0 && cycleDay <= 3) shiftTitle = 'Día';
             else { shiftTitle = 'Descanso'; }
          }
          
          const shortName = pattern.user.name.split(' ')[0];
          _events.push({
            id: `shift-${pattern.user_id}-${currStr}`,
            isException: false,
            user_id: pattern.user_id,
            shiftTitle: shiftTitle,
            title: `${shortName}`,
            start: new Date(curr),
            end: new Date(curr),
            allDay: true,
            dateStr: currStr,
          });
        }
      });
      
      curr = addDays(curr, 1);
    }
    return _events;
  }, [data, currentDate]);

  const dayPropGetter = useCallback((date: Date) => {
    let className = '';
    
    // Highlight weekends
    if (date.getDay() === 0 || date.getDay() === 6) {
      className += ' bg-slate-50 dark:bg-slate-800/30';
    }

    if (data?.holidays) {
      const isHoliday = data.holidays.some(h => h.date.split('T')[0] === format(date, 'yyyy-MM-dd'));
      if (isHoliday) {
        className += ' bg-rose-100 dark:bg-rose-900/40 ring-2 ring-inset ring-rose-400 dark:ring-rose-500';
      }
    }

    return { className };
  }, [data?.holidays]);

  const eventPropGetter = useCallback((event: RosterEvent) => {
    let bgColor = '#cbd5e1'; // default slate-300 for Descanso
    
    if (event.isException) {
      const typeInfo = EXCEPTION_TYPES.find(t => t.type === event.shiftTitle);
      if (typeInfo) {
        if (typeInfo.type === 'FALTA') bgColor = '#ef4444';
        else if (typeInfo.type === 'VACACIONES') bgColor = '#10b981';
        else if (typeInfo.type === 'PERMISO_SG') bgColor = '#f59e0b';
        else if (typeInfo.type === 'PERMISO_CG') bgColor = '#6366f1';
        else if (typeInfo.type === 'TIEMPO_EXTRA') bgColor = '#06b6d4';
        else if (typeInfo.type === 'TIEMPO_POR_TIEMPO') bgColor = '#14b8a6';
        else bgColor = '#d946ef';
      }
    } else {
      if (event.shiftTitle === 'Día') bgColor = '#3b82f6';
      else if (event.shiftTitle === 'Noche') bgColor = '#1e3a8a';
      else if (event.shiftTitle.includes('Mixto')) bgColor = '#0284c7';
    }

    return {
      style: {
        backgroundColor: bgColor,
        borderColor: bgColor,
        color: 'white',
        fontSize: '0.75rem',
        padding: '2px 4px',
        border: 'none',
        borderRadius: '4px',
      }
    };
  }, []);

  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <CalendarIcon className="text-blue-500" />
            Horarios y Turnos (Roster)
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Gestiona los patrones 4x4 y mixtos, y asigna excepciones arrastrando los bloques.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.print()}
            className="bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 px-4 py-2 rounded-xl flex items-center gap-2 transition-colors shadow-sm"
          >
            <Printer size={18} />
            <span className="hidden sm:inline">Imprimir / PDF</span>
          </button>
          
          {canManageShifts && (
            <button
              onClick={() => setShowPatternModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-colors shadow-sm"
            >
              <UserPlus size={18} />
              <span className="hidden sm:inline">Asignar Patrón</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-4 lg:gap-6 min-h-0 lg:min-h-[700px] print:block print:min-h-[auto]">
        {/* Calendar Area */}
        <div className="flex-1 bg-white dark:bg-slate-800 rounded-3xl p-3 sm:p-6 shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col h-[60vh] min-h-[420px] lg:h-auto lg:min-h-[700px] print:h-[650px] print:border-none print:shadow-none print:p-0">
          {loading && !data ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <DnDCalendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              onNavigate={(date: Date) => setCurrentDate(date)}
              date={currentDate}
              views={['month', 'week']}
              defaultView="month"
              culture="es"
              style={{ height: '100%', minHeight: 400 }}
              messages={{
                next: 'Siguiente',
                previous: 'Anterior',
                today: 'Hoy',
                month: 'Mes',
                week: 'Semana',
                day: 'Día'
              }}
              className="font-sans dark:text-slate-300"
              dayPropGetter={dayPropGetter}
              eventPropGetter={eventPropGetter}
              onSelectEvent={handleSelectEvent}
              selectable={true}
              onSelectSlot={(slotInfo) => setSelectedDay(slotInfo.start)}
              draggableAccessor={() => false}
              onDropFromOutside={handleDropFromOutside}
              popup={true}
            />
          )}
        </div>

        {/* Sidebar for Drag & Drop Exceptions */}
        <div className="w-full lg:w-80 flex flex-col gap-6 print:hidden shrink-0">
          {canManageShifts && (
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                <AlertCircle size={18} className="text-amber-500" />
                Incidencias (Arrastrar)
              </h3>
              
              <p className="text-xs text-slate-500 mb-4">
                Selecciona un técnico, elige una incidencia y arrástrala hacia el calendario para sobreescribir su turno de ese día.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Técnico afectado:</label>
                  <select 
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    value={draggedException?.user_id || ''}
                    onChange={(e) => {
                      setDraggedException(prev => prev ? { ...prev, user_id: e.target.value } : { type: 'FALTA', user_id: e.target.value })
                    }}
                  >
                    <option value="" disabled>Selecciona un técnico...</option>
                    {data?.technicians.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                {draggedException?.user_id && (
                  <div className="space-y-2 mt-4">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tipos de Incidencia:</label>
                    {EXCEPTION_TYPES.map(type => (
                      <div
                        key={type.type}
                        draggable="true"
                        onDragStart={() => setDraggedException({ type: type.type, user_id: draggedException.user_id })}
                        className={`${type.color} text-white px-4 py-2 rounded-lg cursor-grab active:cursor-grabbing text-sm font-medium shadow-sm transition-transform hover:scale-[1.02]`}
                      >
                        :: {type.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="mt-8 border-t border-slate-200 dark:border-slate-700 pt-4">
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Índice de Incidencias:</h4>
                <div className="grid grid-cols-2 gap-x-2 gap-y-3 text-xs">
                  {EXCEPTION_TYPES.map(t => (
                    <div key={t.type} className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      <span className={`font-bold text-white px-2 py-0.5 rounded ${t.color}`}>[{t.short}]</span>
                      <span>= {t.label}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}
        </div>
      </div>

      {/* Modal Asignar Patrón */}
      {showPatternModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Asignar Patrón de Turno</h2>
            
            <form onSubmit={handleAssignPattern} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Técnico</label>
                <select 
                  required
                  value={selectedUser}
                  onChange={e => setSelectedUser(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                >
                  <option value="" disabled>Seleccionar técnico</option>
                  {data?.technicians.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Patrón de Turno</label>
                <select 
                  required
                  value={selectedPattern}
                  onChange={e => setSelectedPattern(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                >
                  <option value="MIXTO">Mixto (L-V Día, Sáb Medio)</option>
                  <option value="4X4_ROTATORIO">4x4 Rotatorio (2D, 2N, 4 Descanso)</option>
                  <option value="4X4_FIJO">4x4 Fijo (4D, 4 Descanso)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Día 1 del Patrón</label>
                <input 
                  type="date"
                  required
                  value={patternStartDate}
                  onChange={e => setPatternStartDate(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                />
                <p className="text-xs text-slate-500 mt-1">Este será el día donde empieza a correr su ciclo.</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowPatternModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium shadow-sm"
                >
                  Guardar Patrón
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Modal Detalles del Día */}
      {selectedDay && (() => {
        const holiday = data?.holidays?.find(h => h.date.split('T')[0] === format(selectedDay, 'yyyy-MM-dd'));
        
        return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CalendarIcon className="text-blue-500" />
                Detalles del Día: {format(selectedDay, 'dd/MM/yyyy')}
              </h2>
              <button onClick={() => setSelectedDay(null)} className="text-slate-400 hover:text-slate-500 p-2">
                <X size={20} />
              </button>
            </div>
            
            {holiday && (
              <div className="mb-4 bg-gradient-to-r from-fuchsia-500 to-fuchsia-600 rounded-xl p-4 text-white shadow-sm flex items-center justify-between">
                <div>
                  <div className="font-bold text-lg">🎉 DÍA FESTIVO OFICIAL</div>
                  <div className="text-fuchsia-100">{holiday.name}</div>
                </div>
              </div>
            )}
            
            <div className="flex-1 overflow-auto">
              <div className="space-y-3">
                {events
                  .filter(e => e.dateStr === format(selectedDay, 'yyyy-MM-dd'))
                  .sort((a, b) => a.title.localeCompare(b.title))
                  .map(event => (
                  <div key={event.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200">{event.title.split(' - ')[0]}</div>
                      <div className="text-sm text-slate-500">Turno actual: <span className="font-medium">{event.shiftTitle}</span></div>
                    </div>
                    {canManageShifts && (
                      <div className="mt-3 sm:mt-0 flex gap-2">
                        {event.isException ? (
                          <button 
                            onClick={async () => {
                              if (window.confirm('¿Eliminar incidencia?')) {
                                await removeException(event.exceptionId!);
                                fetchData();
                              }
                            }}
                            className="px-3 py-1 text-sm bg-rose-100 text-rose-700 hover:bg-rose-200 rounded-lg flex items-center gap-1"
                          >
                            <Trash2 size={14} /> Quitar
                          </button>
                        ) : (
                          <select 
                            className="px-3 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                            onChange={async (e) => {
                              if (e.target.value) {
                                await addException({
                                  user_id: event.user_id,
                                  exception_type: e.target.value,
                                  date: format(selectedDay, 'yyyy-MM-dd')
                                });
                                window.alert('Incidencia añadida correctamente');
                                fetchData();
                              }
                            }}
                            value=""
                          >
                            <option value="" disabled>Añadir Incidencia...</option>
                            {EXCEPTION_TYPES.map(t => (
                              <option key={t.type} value={t.type}>{t.label}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {events.filter(e => e.dateStr === format(selectedDay, 'yyyy-MM-dd')).length === 0 && (
                  <div className="text-center text-slate-500 py-8">No hay personal programado para este día.</div>
                )}
              </div>
            </div>
          </div>
        </div>
        );
      })()}

    </div>
  );
};
