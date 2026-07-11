import React, { useState, useMemo } from 'react';
import type { WorkOrder } from '../api/workOrders';
import { Clock, CheckCircle2, AlertCircle, Wrench, Calendar, MapPin, Tag, User, ChevronUp, ChevronDown } from 'lucide-react';

interface Props {
  workOrders: WorkOrder[];
  onRowClick?: (wo: WorkOrder) => void;
}

const getInitials = (name: string) => {
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
};

const formatFriendlyDate = (dateString: string) => {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '-';
    
    const today = new Date();
    const isToday = d.getDate() === today.getDate() && 
                    d.getMonth() === today.getMonth() && 
                    d.getFullYear() === today.getFullYear();
    
    if (isToday) {
      return `Hoy ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    return d.toLocaleString('es-ES', { 
      day: 'numeric', 
      month: 'short', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  } catch(e) {
    return '-';
  }
};

export const WorkOrdersTable = ({ workOrders, onRowClick }: Props) => {
  const [sortField, setSortField] = useState<'folio' | 'asset' | 'date' | 'status'>('folio');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');

  const sortedWorkOrders = useMemo(() => {
    return [...workOrders].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'folio':
          cmp = (a.folio || 0) - (b.folio || 0);
          break;
        case 'asset':
          cmp = a.asset.name.localeCompare(b.asset.name);
          break;
        case 'date':
          const dateA = a.scheduled_date ? new Date(a.scheduled_date).getTime() : 0;
          const dateB = b.scheduled_date ? new Date(b.scheduled_date).getTime() : 0;
          cmp = dateA - dateB;
          break;
        case 'status':
          cmp = a.status.localeCompare(b.status);
          break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [workOrders, sortField, sortDirection]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDIENTE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 shadow-sm">
            <Clock size={14} /> PENDIENTE
          </span>
        );
      case 'EN_PROCESO':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200 shadow-sm">
            <Wrench size={14} /> EN PROCESO
          </span>
        );
      case 'EN_ESPERA':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-red-100 text-red-800 border border-red-200 shadow-sm">
            <AlertCircle size={14} /> EN ESPERA
          </span>
        );
      case 'FINALIZADO':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-sm">
            <CheckCircle2 size={14} /> FINALIZADO
          </span>
        );
      case 'ANULADO':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-slate-200 text-slate-600 border border-slate-300 shadow-sm line-through">
            <AlertCircle size={14} /> ANULADO
          </span>
        );
      default:
        return <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">{status}</span>;
    }
  };

  if (workOrders.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 p-12 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 text-center flex flex-col items-center justify-center transition-colors duration-200">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-50 dark:bg-slate-900 text-slate-300 dark:text-slate-600 mb-4 border-4 border-white dark:border-slate-800 shadow-sm">
          <Wrench size={32} />
        </div>
        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">Bandeja Vacía</h3>
        <p className="text-slate-500 dark:text-slate-300 mt-2 max-w-md">No hay órdenes de trabajo que coincidan con los filtros actuales o aún no se han creado tareas.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Vista de Tarjetas para Celulares */}
      <div className="block xl:hidden flex flex-col gap-3">
        {sortedWorkOrders.map((wo) => (
          <div 
          key={wo.id} 
          onClick={() => onRowClick && onRowClick(wo)}
          className="group bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-500 transition-all cursor-pointer overflow-hidden flex flex-col md:flex-row"
        >
          {/* Main Content Area */}
          <div className="p-4 md:p-5 flex-1 flex flex-col">
            <div className="flex justify-between items-start mb-2 gap-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="bg-slate-800 text-white px-2 py-0.5 rounded text-xs font-bold tracking-wide">
                  WO-{(wo.folio || 0).toString().padStart(4, '0')}
                </span>
                
                {wo.priority === 'URGENTE' && (
                  <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded text-[10px] font-bold border border-red-100 uppercase tracking-widest flex items-center gap-1">
                    <AlertCircle size={10} /> Urgente
                  </span>
                )}
                
                {wo.maintenance_plan_id && (
                  <span className="bg-purple-50 text-purple-600 px-2 py-0.5 rounded text-[10px] font-bold border border-purple-100 uppercase tracking-widest flex items-center gap-1" title="Generado por Plan Preventivo">
                    <Clock size={10} /> Auto
                  </span>
                )}
              </div>
              <div className="md:hidden">
                {getStatusBadge(wo.status)}
              </div>
            </div>
            
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base mb-1 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors flex items-center gap-1.5">
              <User size={16} className="text-slate-400 dark:text-slate-400" />
              {wo.requester_name || wo.created_by?.name || 'Solicitante desconocido'}
            </h3>
            
            <div className="mb-4">
              <p className="text-slate-700 dark:text-slate-300 font-medium text-sm leading-relaxed">
                {wo.title}
              </p>
              {wo.description && wo.description !== wo.title && (
                <p className="text-slate-500 dark:text-slate-300 text-sm line-clamp-2 leading-relaxed mt-0.5">
                  {wo.description}
                </p>
              )}
            </div>

            <div className="mt-auto flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 px-2.5 py-1 rounded-md border border-slate-100 dark:border-slate-800">
                <div className="w-4 h-4 rounded bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400 flex items-center justify-center font-bold text-[8px] shrink-0">
                  {wo.asset.name.substring(0, 2).toUpperCase()}
                </div>
                <span className="font-semibold truncate max-w-[120px]" title={wo.asset.name}>{wo.asset.name}</span>
              </div>
              
              {wo.zone?.name && (
                <div className="flex items-center gap-1 text-slate-500">
                  <MapPin size={14} className="text-slate-400" />
                  <span className="truncate max-w-[100px]">{wo.zone.name}</span>
                </div>
              )}

              <div className="flex items-center gap-1 text-slate-500">
                <Tag size={14} className="text-slate-400" />
                <span className="font-medium">{wo.maintenance_type}</span>
              </div>
            </div>
          </div>

          {/* Right Sidebar Area (Status, Techs, Times) */}
          <div className="bg-slate-50/80 dark:bg-slate-900/50 p-4 md:p-5 border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-700 flex flex-col md:w-64 shrink-0 gap-4">
            
            <div className="hidden md:flex justify-end">
              {getStatusBadge(wo.status)}
            </div>

            <div className="flex flex-col gap-3">
              {/* Technicians */}
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-400 tracking-wider mb-1.5 block">Asignado A</span>
                {wo.assigned_technicians && wo.assigned_technicians.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {wo.assigned_technicians.map((t) => (
                      <div key={t.id} className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 px-2 py-1 rounded-full shadow-sm" title={t.name}>
                        <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 flex items-center justify-center text-[9px] font-bold shrink-0">
                          {getInitials(t.name)}
                        </div>
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t.name.split(' ')[0]}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-400 text-xs italic">
                    <User size={14} /> Sin asignar
                  </div>
                )}
              </div>

              {/* Timing */}
              <div className="space-y-1.5 bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-700 shadow-sm">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 dark:text-slate-400 font-medium flex items-center gap-1"><Calendar size={12}/> Inicio</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {wo.scheduled_date ? formatFriendlyDate(wo.scheduled_date) : <span className="text-slate-300 dark:text-slate-600">-</span>}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 dark:text-slate-400 font-medium flex items-center gap-1"><AlertCircle size={12}/> Límite</span>
                  <span className={`font-semibold ${wo.due_date && new Date(wo.due_date) < new Date() && wo.status !== 'FINALIZADO' ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'}`}>
                    {wo.due_date ? formatFriendlyDate(wo.due_date) : <span className="text-slate-300 dark:text-slate-600">-</span>}
                  </span>
                </div>
              </div>

            </div>
          </div>
        </div>
      ))}
      </div>

      {/* Vista de Tabla para Escritorio */}
      <div className="hidden xl:block bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px] font-bold shadow-md shadow-[#739239]/40 dark:shadow-[#739239]/20 relative z-10">
              <tr>
                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800/60 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors group" onClick={() => { setSortField('folio'); setSortDirection(sortField === 'folio' && sortDirection === 'asc' ? 'desc' : 'asc'); }}>
                  <div className="flex items-center gap-1.5">Orden {sortField === 'folio' ? (sortDirection === 'asc' ? <ChevronUp size={14} className="text-indigo-500"/> : <ChevronDown size={14} className="text-indigo-500"/>) : <ChevronUp size={14} className="opacity-0 group-hover:opacity-40 transition-opacity" />}</div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800/60 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors group" onClick={() => { setSortField('asset'); setSortDirection(sortField === 'asset' && sortDirection === 'asc' ? 'desc' : 'asc'); }}>
                  <div className="flex items-center gap-1.5">Equipo / Tarea {sortField === 'asset' ? (sortDirection === 'asc' ? <ChevronUp size={14} className="text-indigo-500"/> : <ChevronDown size={14} className="text-indigo-500"/>) : <ChevronUp size={14} className="opacity-0 group-hover:opacity-40 transition-opacity" />}</div>
                </th>
                <th className="px-6 py-4">Técnicos</th>
                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800/60 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors group" onClick={() => { setSortField('date'); setSortDirection(sortField === 'date' && sortDirection === 'asc' ? 'desc' : 'asc'); }}>
                  <div className="flex items-center gap-1.5">Programación {sortField === 'date' ? (sortDirection === 'asc' ? <ChevronUp size={14} className="text-indigo-500"/> : <ChevronDown size={14} className="text-indigo-500"/>) : <ChevronUp size={14} className="opacity-0 group-hover:opacity-40 transition-opacity" />}</div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800/60 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors group" onClick={() => { setSortField('status'); setSortDirection(sortField === 'status' && sortDirection === 'asc' ? 'desc' : 'asc'); }}>
                  <div className="flex items-center gap-1.5">Estado {sortField === 'status' ? (sortDirection === 'asc' ? <ChevronUp size={14} className="text-indigo-500"/> : <ChevronDown size={14} className="text-indigo-500"/>) : <ChevronUp size={14} className="opacity-0 group-hover:opacity-40 transition-opacity" />}</div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {sortedWorkOrders.map((wo) => (
                <tr 
                  key={wo.id} 
                  onClick={() => onRowClick && onRowClick(wo)}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                >
                  <td className="px-6 py-4 align-top">
                    <div className="flex flex-col gap-1.5 items-start">
                      <span className="bg-slate-800 dark:bg-slate-700 text-white px-2.5 py-1 rounded-md text-xs font-bold tracking-wide">
                        WO-{(wo.folio || 0).toString().padStart(4, '0')}
                      </span>
                      {wo.priority === 'URGENTE' && (
                        <span className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded text-[10px] font-bold border border-red-100 dark:border-red-800 uppercase tracking-widest flex items-center gap-1">
                          <AlertCircle size={10} /> Urgente
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 align-top">
                    <div className="flex flex-col gap-1 mb-2">
                      <div className="font-bold text-slate-900 dark:text-slate-100 text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {wo.title}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-semibold">{wo.asset.name}</span>
                        {wo.zone?.name && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                            <span className="flex items-center gap-1"><MapPin size={10}/> {wo.zone.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 align-top">
                    {wo.assigned_technicians && wo.assigned_technicians.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {wo.assigned_technicians.map((t) => (
                          <div key={t.id} className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-full" title={t.name}>
                            <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 flex items-center justify-center text-[9px] font-bold shrink-0">
                              {getInitials(t.name)}
                            </div>
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t.name.split(' ')[0]}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 dark:text-slate-500 italic">Sin asignar</span>
                    )}
                  </td>
                  <td className="px-6 py-4 align-top">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5 text-xs">
                        <Calendar size={12} className="text-slate-400" />
                        <span className="text-slate-700 dark:text-slate-300">
                          {wo.scheduled_date ? formatFriendlyDate(wo.scheduled_date) : '-'}
                        </span>
                      </div>
                      {wo.due_date && (
                        <div className={`flex items-center gap-1.5 text-xs ${new Date(wo.due_date) < new Date() && wo.status !== 'FINALIZADO' ? 'text-red-600 dark:text-red-400 font-medium' : 'text-slate-500 dark:text-slate-400'}`}>
                          <AlertCircle size={12} />
                          <span>Límite: {formatFriendlyDate(wo.due_date)}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 align-top text-right">
                    {getStatusBadge(wo.status)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
