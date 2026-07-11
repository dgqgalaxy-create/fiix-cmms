import { useState, useEffect } from 'react';
import { X, Database, MapPin, Tag, Activity, Settings, Ban, FileText, Download, Eye, DollarSign, Truck, AlertTriangle, Clock, Wrench } from 'lucide-react';
import type { Asset } from '../api/assets';
import { BACKEND_URL } from '../api/axios';
import { getAssetMetrics } from '../api/assets';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Props {
  asset: Asset | null;
  isOpen: boolean;
  onClose: () => void;
}

export const AssetDetailModal = ({ asset, isOpen, onClose }: Props) => {
  const [activeTab, setActiveTab] = useState<'info' | 'metrics' | 'history'>('info');
  const [metrics, setMetrics] = useState<any>(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);

  useEffect(() => {
    if (isOpen && asset) {
      setActiveTab('info');
      fetchMetrics();
    }
  }, [isOpen, asset]);

  const fetchMetrics = async () => {
    if (!asset) return;
    setIsLoadingMetrics(true);
    try {
      const data = await getAssetMetrics(asset.id);
      setMetrics(data);
    } catch (error) {
      console.error("Error fetching metrics", error);
    } finally {
      setIsLoadingMetrics(false);
    }
  };

  if (!isOpen || !asset) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPERATIVO':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-emerald-100 text-emerald-700">
            <Activity size={16} /> Operativo
          </span>
        );
      case 'EN_MANTENIMIENTO':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-700">
            <Settings size={16} /> Mantenimiento
          </span>
        );
      case 'FUERA_DE_SERVICIO':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700">
            <Ban size={16} /> Fuera de Servicio
          </span>
        );
      default:
        return <span className="px-3 py-1 rounded-full text-sm font-medium bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
          <div className="flex gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
              <Database size={24} />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="text-sm font-mono font-medium text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                  {asset.internal_code}
                </span>
                {getStatusBadge(asset.status)}
              </div>
              <h2 className="text-xl font-bold text-slate-800">{asset.name}</h2>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-4 border-b border-slate-100 flex gap-6">
          <button
            onClick={() => setActiveTab('info')}
            className={`pb-4 text-sm font-medium transition-colors relative ${activeTab === 'info' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Información General
            {activeTab === 'info' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full" />}
          </button>
          <button
            onClick={() => setActiveTab('metrics')}
            className={`pb-4 text-sm font-medium transition-colors relative ${activeTab === 'metrics' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Monitoreo y KPIs
            {activeTab === 'metrics' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full" />}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-4 text-sm font-medium transition-colors relative ${activeTab === 'history' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Historial de Órdenes
            {activeTab === 'history' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full" />}
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/30">
          
          {/* TAB: INFO */}
          {activeTab === 'info' && (
            <div className="space-y-6">
              {/* Image */}
              {asset.image_url && (
                <div className="w-full h-48 sm:h-64 rounded-2xl overflow-hidden bg-white border border-slate-200 flex-shrink-0 shadow-sm p-2">
                  <img 
                    src={`${BACKEND_URL}${asset.image_url}`} 
                    alt={`Foto de ${asset.name}`} 
                    className="w-full h-full object-contain rounded-xl"
                  />
                </div>
              )}
              
              {/* Description */}
              {asset.description && (
                <div>
                  <h3 className="text-sm font-bold text-slate-800 mb-2">Descripción</h3>
                  <p className="text-sm text-slate-600 bg-white border border-slate-100 p-4 rounded-xl leading-relaxed shadow-sm">
                    {asset.description}
                  </p>
                </div>
              )}

              {/* Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-white shadow-sm p-4 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-2 text-slate-500 mb-1">
                    <Tag size={16} />
                    <span className="text-xs font-bold uppercase tracking-wider">Marca</span>
                  </div>
                  <div className="text-sm font-medium text-slate-800">{asset.brand || 'No especificada'}</div>
                </div>
                
                <div className="bg-white shadow-sm p-4 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-2 text-slate-500 mb-1">
                    <Settings size={16} />
                    <span className="text-xs font-bold uppercase tracking-wider">Modelo</span>
                  </div>
                  <div className="text-sm font-medium text-slate-800">{asset.model || 'No especificado'}</div>
                </div>

                <div className="bg-white shadow-sm p-4 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-2 text-slate-500 mb-1">
                    <MapPin size={16} />
                    <span className="text-xs font-bold uppercase tracking-wider">Zona asignada</span>
                  </div>
                  <div className="text-sm font-medium text-slate-800">{asset.zone?.name || 'Sin Zona'}</div>
                </div>

                <div className="bg-white shadow-sm p-4 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-2 text-slate-500 mb-1">
                    <Database size={16} />
                    <span className="text-xs font-bold uppercase tracking-wider">Número de Serie</span>
                  </div>
                  <div className="text-sm font-medium text-slate-800">{asset.serial_number || 'No especificado'}</div>
                </div>

                <div className="bg-white shadow-sm p-4 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-2 text-slate-500 mb-1">
                    <Truck size={16} />
                    <span className="text-xs font-bold uppercase tracking-wider">Proveedor</span>
                  </div>
                  <div className="text-sm font-medium text-slate-800">{asset.vendor?.name || 'No especificado'}</div>
                </div>

                <div className="bg-white shadow-sm p-4 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-2 text-slate-500 mb-1">
                    <DollarSign size={16} />
                    <span className="text-xs font-bold uppercase tracking-wider">Precio de Compra</span>
                  </div>
                  <div className="text-sm font-medium text-slate-800">
                    {asset.price !== undefined && asset.price !== null ? `$${asset.price.toFixed(2)}` : 'No especificado'}
                  </div>
                </div>
              </div>

              {/* Document / Manual */}
              {asset.document_url && (
                <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                      <FileText size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">Manual o Documento Adjunto</h4>
                      <p className="text-xs text-slate-500 mt-0.5">Archivo relacionado con este activo</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <a 
                      href={`${BACKEND_URL}${asset.document_url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-sm font-medium transition-colors"
                    >
                      <Eye size={16} /> Ver
                    </a>
                    <a 
                      href={`${BACKEND_URL}${asset.document_url}`}
                      download
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
                    >
                      <Download size={16} /> Descargar
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: METRICS */}
          {activeTab === 'metrics' && (
            <div className="space-y-6">
              {isLoadingMetrics ? (
                <div className="flex items-center justify-center py-20 text-slate-400">
                  <Activity className="animate-spin mr-2" /> Cargando métricas...
                </div>
              ) : metrics ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* MTTR */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center items-center text-center">
                      <div className="w-12 h-12 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center mb-3">
                        <Wrench size={24} />
                      </div>
                      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-1">MTTR (T. Prom. Reparación)</h3>
                      <div className="text-3xl font-black text-slate-800">
                        {metrics.mttr_hours > 0 ? `${metrics.mttr_hours}h` : 'N/A'}
                      </div>
                      <p className="text-xs text-slate-400 mt-2">Promedio en órdenes correctivas</p>
                    </div>
                    {/* MTBF */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center items-center text-center">
                      <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3">
                        <Activity size={24} />
                      </div>
                      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-1">MTBF (T. Prom. Entre Fallas)</h3>
                      <div className="text-3xl font-black text-slate-800">
                        {metrics.mtbf_hours > 0 ? `${metrics.mtbf_hours}h` : 'N/A'}
                      </div>
                      <p className="text-xs text-slate-400 mt-2">Horas operativas entre fallas</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Fallas Graph */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                      <h3 className="text-sm font-bold text-slate-800 mb-4">Cantidad de Fallas (Últimos 6 Meses)</h3>
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={metrics.monthly_stats}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dx={-10} allowDecimals={false} />
                            <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                            <Bar dataKey="failures" name="Fallas" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={30} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Downtime Graph */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                      <h3 className="text-sm font-bold text-slate-800 mb-4">Horas de Paro / Downtime</h3>
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={metrics.monthly_stats}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dx={-10} />
                            <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                            <Bar dataKey="downtime" name="Horas" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={30} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center text-slate-500 py-10">No hay datos de monitoreo disponibles.</div>
              )}
            </div>
          )}

          {/* TAB: HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              {isLoadingMetrics ? (
                <div className="flex items-center justify-center py-20 text-slate-400">
                  <Activity className="animate-spin mr-2" /> Cargando historial...
                </div>
              ) : metrics?.history?.length > 0 ? (
                <div className="relative border-l-2 border-slate-200 ml-4 py-2 space-y-6">
                  {metrics.history.map((wo: any) => {
                    let resolutionTime = 'N/A';
                    let diffMs = wo.accumulated_time_ms;
                    if (!diffMs || diffMs <= 0) {
                      const end = wo.completed_at ? new Date(wo.completed_at).getTime() : 0;
                      const start = wo.started_at ? new Date(wo.started_at).getTime() : new Date(wo.created_at).getTime();
                      if (end > start) diffMs = end - start;
                    }
                    if (diffMs > 0) {
                      const hours = Math.floor(diffMs / (1000 * 60 * 60));
                      const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                      resolutionTime = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
                    }
                    const techs = wo.assigned_technicians?.map((t: any) => t.name).join(', ') || 'Sin asignar';

                    return (
                      <div key={wo.id} className="relative pl-6">
                        <div className="absolute w-4 h-4 bg-white border-2 border-indigo-500 rounded-full -left-[9px] top-1"></div>
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h4 className="font-bold text-slate-800 inline-flex items-center gap-2">
                                OT-{wo.folio}: {wo.title}
                                <span className="text-xs font-normal text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
                                  {techs}
                                </span>
                              </h4>
                            </div>
                            <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-1 rounded-md whitespace-nowrap ml-2">
                              {format(new Date(wo.completed_at || wo.created_at), "dd MMM, yyyy", { locale: es })}
                            </span>
                          </div>
                          <p className="text-sm text-slate-500 mb-2">{wo.resolution_notes || wo.description || "Sin detalles de resolución."}</p>
                          <div className="flex gap-2 items-center mt-3 pt-3 border-t border-slate-50">
                             <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-500">
                               {wo.maintenance_type}
                             </span>
                             {wo.machine_stopped && (
                               <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-red-100 text-red-600">
                                 PARO DE MÁQUINA
                               </span>
                             )}
                             <div className="ml-auto text-xs font-medium text-slate-500 flex items-center gap-1.5">
                               <Clock size={14} className="text-indigo-400" />
                               Tiempo de resolución: <span className="text-slate-700 font-bold">{resolutionTime}</span>
                             </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center bg-white p-10 rounded-2xl border border-slate-100 shadow-sm">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-50 text-slate-400 mb-3">
                    <Clock size={24} />
                  </div>
                  <h3 className="text-lg font-medium text-slate-800">No hay historial</h3>
                  <p className="text-slate-500">Este activo aún no tiene órdenes de trabajo completadas.</p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
