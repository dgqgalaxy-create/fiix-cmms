import { useState, useEffect, FormEvent } from 'react';
import axios from 'axios';
import { Wifi, WifiOff, CheckCircle2 } from 'lucide-react';
import CreatableSelect from 'react-select/creatable';
import Select from 'react-select';

interface Zone {
  id: string;
  name: string;
}

interface Asset {
  id: string;
  name: string;
  internal_code: string;
}

export const RequestPortal = () => {
  const [zones, setZones] = useState<Zone[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [requesters, setRequesters] = useState<{ value: string; label: string }[]>([]);

  // Form State
  const [requesterName, setRequesterName] = useState<{ value: string; label: string } | null>(null);
  const [productionGroup, setProductionGroup] = useState<{ value: string; label: string } | null>(null);
  const [location, setLocation] = useState('');
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [machineStopped, setMachineStopped] = useState(false);
  const [maintenanceType, setMaintenanceType] = useState<{ value: string; label: string } | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<{ value: string; label: string } | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [zonesRes, reqsRes] = await Promise.all([
          axios.get('http://localhost:3000/api/public/zones'),
          axios.get('http://localhost:3000/api/public/requesters')
        ]);
        setZones(zonesRes.data);
        setRequesters(reqsRes.data.map((name: string) => ({ value: name, label: name })));
      } catch (err) {
        console.error('Error fetching initial data', err);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedZone) {
      axios.get(`http://localhost:3000/api/public/assets?zone_id=${selectedZone.id}`)
        .then(res => setAssets(res.data))
        .catch(err => console.error('Error fetching assets', err));
    } else {
      setAssets([]);
      setSelectedAsset(null);
    }
  }, [selectedZone]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!requesterName || !productionGroup || !selectedZone || !maintenanceType || !title || !priority || !selectedAsset) {
      setError('Por favor completa todos los campos requeridos marcados con *');
      return;
    }
    
    if (!isOnline) {
      setError('No tienes conexión a internet. No se puede enviar la solicitud.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await axios.post('http://localhost:3000/api/public/requests', {
        requester_name: requesterName.value,
        production_group: productionGroup.value,
        location,
        zone_id: selectedZone.id,
        machine_stopped: machineStopped,
        maintenance_type: maintenanceType.value,
        title,
        description,
        priority: priority.value,
        asset_id: selectedAsset.id
      });
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      setError('Ocurrió un error al enviar la solicitud. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl text-center">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={40} className="text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">¡Solicitud Enviada!</h2>
          <p className="text-slate-600 mb-8">El equipo de mantenimiento ha sido notificado y la orden se ha creado exitosamente.</p>
          <button 
            onClick={() => {
              setSubmitted(false);
              setSelectedAsset(null);
              setTitle('');
              setDescription('');
              setMachineStopped(false);
              setLocation('');
            }}
            className="w-full bg-slate-900 text-white font-bold py-3 px-4 rounded-xl hover:bg-slate-800 transition-colors"
          >
            Crear otra solicitud
          </button>
        </div>
      </div>
    );
  }

  const zoneOptions = zones.map(z => ({ value: z, label: z.name }));
  const assetOptions = assets.map(a => ({ value: a, label: `${a.internal_code} - ${a.name}` }));
  
  const groupOptions = [
    { value: 'A', label: 'Grupo A' },
    { value: 'B', label: 'Grupo B' },
    { value: 'C', label: 'Grupo C' },
    { value: 'D', label: 'Grupo D' },
    { value: 'NA', label: 'No Aplica (NA)' },
  ];

  const maintenanceOptions = [
    { value: 'CORRECTIVO', label: 'Correctivo' },
    { value: 'PREVENTIVO', label: 'Preventivo' },
    { value: 'SERVICIO', label: 'Servicio / Mejora' }
  ];

  const priorityOptions = [
    { value: 'NORMAL', label: 'Normal' },
    { value: 'URGENTE', label: 'Urgente' },
    { value: 'BAJO', label: 'Baja' }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-slate-900 text-white p-4 shadow-md sticky top-0 z-10">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/icono_app.jpg" alt="Logo" className="w-10 h-10 rounded-lg object-cover" />
            <div>
              <h1 className="font-bold text-lg leading-tight">Portal de Mantenimiento</h1>
              <p className="text-xs text-slate-400">Reporte de Fallas</p>
            </div>
          </div>
          <div>
            {isOnline ? (
              <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                <Wifi size={16} /> Online
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-red-400 animate-pulse">
                <WifiOff size={16} /> Offline
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 w-full max-w-xl mx-auto">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {error && (
              <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Nombre del solicitante <span className="text-red-500">*</span></label>
              <CreatableSelect 
                options={requesters}
                value={requesterName}
                onChange={(opt) => setRequesterName(opt)}
                placeholder="Escribe o busca tu nombre..."
                formatCreateLabel={(inputValue) => `Añadir "${inputValue}"`}
                className="react-select-container"
                classNamePrefix="react-select"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Grupo <span className="text-red-500">*</span></label>
                <Select 
                  options={groupOptions}
                  value={productionGroup}
                  onChange={(opt) => setProductionGroup(opt)}
                  placeholder="Selecciona..."
                  className="react-select-container"
                  classNamePrefix="react-select"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Prioridad <span className="text-red-500">*</span></label>
                <Select 
                  options={priorityOptions}
                  value={priority}
                  onChange={(opt) => setPriority(opt)}
                  placeholder="Selecciona..."
                  className="react-select-container"
                  classNamePrefix="react-select"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Ubicación Especifica</label>
              <input 
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ej. Nave 1, Pasillo 3..."
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Zona <span className="text-red-500">*</span></label>
              <Select 
                options={zoneOptions}
                value={selectedZone ? { value: selectedZone, label: selectedZone.name } : null}
                onChange={(opt) => {
                  setSelectedZone(opt ? opt.value : null);
                  setSelectedAsset(null); // Reset asset when zone changes
                }}
                placeholder="Selecciona la zona..."
                className="react-select-container"
                classNamePrefix="react-select"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Equipo <span className="text-red-500">*</span></label>
              <Select 
                options={assetOptions}
                value={selectedAsset ? { value: selectedAsset, label: `${selectedAsset.internal_code} - ${selectedAsset.name}` } : null}
                onChange={(opt) => setSelectedAsset(opt ? opt.value : null)}
                placeholder={selectedZone ? "Selecciona la máquina..." : "Primero selecciona una zona"}
                isDisabled={!selectedZone}
                className="react-select-container"
                classNamePrefix="react-select"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Tipo de mantenimiento <span className="text-red-500">*</span></label>
              <Select 
                options={maintenanceOptions}
                value={maintenanceType}
                onChange={(opt) => setMaintenanceType(opt)}
                placeholder="Selecciona..."
                className="react-select-container"
                classNamePrefix="react-select"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Descripción de la falla <span className="text-red-500">*</span></label>
              <input 
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Breve resumen (Ej. Banda rota, ruido fuerte)"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Detalles adicionales</label>
              <textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe más detalles si es necesario..."
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all min-h-[80px] resize-y"
              />
            </div>

            <div className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <input 
                type="checkbox"
                id="machineStopped"
                checked={machineStopped}
                onChange={(e) => setMachineStopped(e.target.checked)}
                className="w-5 h-5 text-red-500 rounded border-slate-300 focus:ring-red-500"
              />
              <label htmlFor="machineStopped" className="font-medium text-slate-700 cursor-pointer">
                ¿Paró máquina por la falla? <span className="text-red-500">*</span>
              </label>
            </div>

            <button 
              type="submit"
              disabled={loading || !isOnline}
              className={`w-full font-bold py-3 px-4 rounded-xl transition-all ${
                loading || !isOnline 
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed' 
                  : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98] shadow-md shadow-blue-600/20'
              }`}
            >
              {loading ? 'Enviando...' : 'Enviar Solicitud'}
            </button>

          </form>
        </div>
      </main>
    </div>
  );
};
