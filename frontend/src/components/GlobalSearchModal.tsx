import { useEffect, useState, useRef, useCallback, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Database, Package, MapPin, ClipboardList, Loader2 } from 'lucide-react';
import api from '../api/axios';
import { formatWorkOrderFolio } from '../utils/folio';

interface SearchResults {
  assets: Array<{ id: string; name: string; internal_code: string; status: string; zone?: { name: string } | null }>;
  items: Array<{ id: string; name: string; internal_code: string; stock: number; uom: string; location?: { name: string } | null }>;
  locations: Array<{ id: string; name: string; internal_id: string }>;
  work_orders: Array<{
    id: string;
    folio: number;
    title: string;
    status: string;
    asset?: { name: string; internal_code: string; zone?: { name: string } | null } | null;
    zone?: { name: string } | null;
  }>;
}

function workOrderZoneName(wo: SearchResults['work_orders'][number]): string | undefined {
  return wo.zone?.name || wo.asset?.zone?.name || undefined;
}

type ResultKind = 'asset' | 'item' | 'location' | 'work_order' | 'zone_orders';

interface FlatResult {
  kind: ResultKind;
  id: string;
  title: string;
  subtitle: string;
  /** Para zone_orders: término a llevar a /dashboard?q= */
  query?: string;
}

export const GlobalSearchModal = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResults>({ assets: [], items: [], locations: [], work_orders: [] });
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flatten = useCallback((data: SearchResults, q: string): FlatResult[] => {
    const list: FlatResult[] = [];
    const term = q.trim().toLowerCase();

    // Atajo: si hay OT y la consulta parece una zona, ofrecer ver todas en Órdenes
    const zoneNames = new Set<string>();
    data.work_orders.forEach((wo) => {
      const z = workOrderZoneName(wo);
      if (z) zoneNames.add(z);
    });
    data.assets.forEach((a) => {
      if (a.zone?.name) zoneNames.add(a.zone.name);
    });
    const matchedZones = [...zoneNames].filter((z) => z.toLowerCase().includes(term));
    if (term && matchedZones.length > 0 && data.work_orders.length > 0) {
      const label = matchedZones.length === 1 ? matchedZones[0] : matchedZones.slice(0, 3).join(', ');
      list.push({
        kind: 'zone_orders',
        id: `zone:${matchedZones[0]}`,
        title: `Órdenes en zona ${label}`,
        subtitle: 'Abrir listado filtrado en Órdenes de Trabajo',
        query: matchedZones[0],
      });
    }

    data.work_orders.forEach((wo) => {
      const bits = [wo.status.replace(/_/g, ' ')];
      const zoneName = workOrderZoneName(wo);
      if (zoneName) bits.push(zoneName);
      if (wo.asset) bits.push(wo.asset.internal_code);
      list.push({
        kind: 'work_order',
        id: wo.id,
        title: `${formatWorkOrderFolio(wo.folio)} · ${wo.title}`,
        subtitle: bits.join(' · '),
      });
    });
    data.assets.forEach((a) => {
      list.push({
        kind: 'asset',
        id: a.id,
        title: `${a.internal_code} · ${a.name}`,
        subtitle: `${a.status.replace(/_/g, ' ')}${a.zone ? ` · ${a.zone.name}` : ''}`,
      });
    });
    data.items.forEach((i) => {
      list.push({
        kind: 'item',
        id: i.id,
        title: `${i.internal_code} · ${i.name}`,
        subtitle: `Stock: ${i.stock} ${i.uom}${i.location ? ` · ${i.location.name}` : ''}`,
      });
    });
    data.locations.forEach((l) => {
      list.push({
        kind: 'location',
        id: l.id,
        title: `${l.internal_id} · ${l.name}`,
        subtitle: 'Ubicación de almacén',
      });
    });
    return list;
  }, []);

  const flatResults = flatten(results, query);

  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape') setIsOpen(false);
    };
    const onOpenEvent = () => setIsOpen(true);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('open-global-search', onOpenEvent);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('open-global-search', onOpenEvent);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults({ assets: [], items: [], locations: [], work_orders: [] });
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults({ assets: [], items: [], locations: [], work_orders: [] });
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await api.get('/search', { params: { q: query.trim() } });
        setResults(data);
        setActiveIndex(0);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, isOpen]);

  const goTo = (item: FlatResult) => {
    setIsOpen(false);
    switch (item.kind) {
      case 'work_order':
        navigate(`/dashboard?wo=${item.id}`);
        break;
      case 'zone_orders':
        navigate(`/dashboard?q=${encodeURIComponent(item.query || query.trim())}`);
        break;
      case 'asset':
        navigate(`/assets?asset=${item.id}`);
        break;
      case 'item':
        navigate(`/inventory?item=${item.id}`);
        break;
      case 'location':
        navigate(`/inventory?tab=locations&location=${item.id}`);
        break;
    }
  };

  const onInputKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(flatResults.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && flatResults[activeIndex]) {
      e.preventDefault();
      goTo(flatResults[activeIndex]);
    }
  };

  const iconFor = (kind: ResultKind) => {
    switch (kind) {
      case 'asset': return <Database size={16} className="text-blue-500" />;
      case 'item': return <Package size={16} className="text-emerald-500" />;
      case 'location': return <MapPin size={16} className="text-amber-500" />;
      case 'work_order': return <ClipboardList size={16} className="text-violet-500" />;
      case 'zone_orders': return <MapPin size={16} className="text-violet-500" />;
    }
  };

  const kindLabel = (kind: ResultKind) => {
    switch (kind) {
      case 'asset': return 'Activo';
      case 'item': return 'Repuesto';
      case 'location': return 'Ubicación';
      case 'work_order': return 'Orden';
      case 'zone_orders': return 'Zona';
    }
  };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
          <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
              {loading ? <Loader2 size={18} className="animate-spin text-emerald-500" /> : <Search size={18} className="text-slate-400" />}
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder="Buscar activos, repuestos, zonas, folios FOL-…"
                className="flex-1 bg-transparent outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400 text-sm"
              />
              <button type="button" onClick={() => setIsOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[50vh] overflow-y-auto">
              {!query.trim() && (
                <p className="px-4 py-8 text-center text-sm text-slate-400">
                  Escribe un código, nombre, zona o folio (ej. L1, MTTO-0001-A-001-F, FOL-0042…)
                </p>
              )}
              {query.trim() && !loading && flatResults.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-slate-400">Sin resultados para “{query}”</p>
              )}
              {flatResults.map((item, idx) => (
                <button
                  key={`${item.kind}-${item.id}`}
                  type="button"
                  onClick={() => goTo(item)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors ${
                    idx === activeIndex ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="mt-0.5">{iconFor(item.kind)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{item.title}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{item.subtitle}</div>
                  </div>
                  <span className="text-[10px] uppercase tracking-wide font-semibold text-slate-400 shrink-0">{kindLabel(item.kind)}</span>
                </button>
              ))}
            </div>

            <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex gap-3">
              <span>↑↓ navegar</span>
              <span>↵ abrir</span>
              <span>esc cerrar</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const GlobalSearchTrigger = ({ className = '' }: { className?: string }) => (
  <button
    type="button"
    onClick={() => window.dispatchEvent(new Event('open-global-search'))}
    className={className || 'flex items-center gap-2 px-3 py-1.5 text-sm text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full shadow-sm hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors'}
    title="Búsqueda global (Ctrl+K / Cmd+K)"
  >
    <Search size={14} />
    <span>Buscar…</span>
    <kbd className="ml-1 text-[10px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 whitespace-nowrap">
      Ctrl/Cmd+K
    </kbd>
  </button>
);
