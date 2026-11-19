import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  Calendar,
  CalendarClock,
  ClipboardCheck,
  Clock,
  Database,
  FileText,
  FolderOpen,
  Gauge,
  GitBranch,
  Globe,
  HardHat,
  Home,
  Info,
  LayoutDashboard,
  Lightbulb,
  ListChecks,
  MessageSquare,
  Package,
  Rocket,
  Scale,
  Search,
  Settings,
  ShoppingCart,
  StickyNote,
  Trophy,
  Users,
  UsersRound,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { GLOSSARY } from '../content/glossary';
import { MANUAL_SECTIONS, type ManualIconKey, type ManualSection } from '../content/manual';

const ICONS: Record<ManualIconKey, LucideIcon> = {
  home: Home,
  orders: LayoutDashboard,
  plans: CalendarClock,
  reports: FileText,
  messages: MessageSquare,
  notes: StickyNote,
  inventory: Package,
  meters: Gauge,
  checklists: ClipboardCheck,
  roster: Clock,
  calendar: Calendar,
  purchases: ShoppingCart,
  people: Users,
  assets: Wrench,
  rca: GitBranch,
  stats: BarChart3,
  performance: Trophy,
  workload: Scale,
  contractors: HardHat,
  crews: UsersRound,
  files: FolderOpen,
  settings: Settings,
  portal: Globe,
  data: Database,
  glossary: BookOpen,
};

type SectionItem = ManualSection & { isGlossary?: boolean };

const GLOSSARY_SECTION: SectionItem = {
  id: 'glossary',
  title: 'Glosario',
  icon: 'glossary',
  tagline: 'Todo lo que significan los indicadores, siglas y datos.',
  purpose:
    'Diccionario de la aplicación: qué mide cada indicador, qué significa cada estado, unidad o sigla. Busca cualquier término.',
  actions: [],
  tips: ['Si un término no está, pídemelo y lo agrego.'],
};

export const UserManual = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeId, setActiveId] = useState('quick');
  const [query, setQuery] = useState('');
  const [glossaryQuery, setGlossaryQuery] = useState('');
  const contentRef = useRef<HTMLDivElement>(null);

  const isAdmin = user?.role === 'ADMINISTRADOR';

  const allSections = useMemo<SectionItem[]>(() => {
    const base = MANUAL_SECTIONS.filter((section) => !section.adminOnly || isAdmin);
    return [...base, GLOSSARY_SECTION];
  }, [isAdmin]);

  const matches = (section: SectionItem, needle: string): boolean => {
    if (!needle) return true;
    const haystack = [
      section.title,
      section.tagline,
      section.purpose,
      ...(section.actions ?? []),
      ...(section.fields ?? []).flatMap((field) => [field.label, field.meaning]),
      ...(section.tips ?? []),
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(needle.toLowerCase());
  };

  const visibleSections = useMemo(
    () => allSections.filter((section) => matches(section, query.trim())),
    [allSections, query]
  );

  const activeSection =
    visibleSections.find((section) => section.id === activeId) ?? visibleSections[0] ?? allSections[0];

  const changeSection = (id: string) => {
    setActiveId(id);
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const glossaryNeedle = glossaryQuery.trim().toLowerCase();
  const glossaryGroups = GLOSSARY.map((group) => ({
    ...group,
    entries: group.entries.filter((entry) => {
      if (!glossaryNeedle) return true;
      return [entry.term, ...(entry.aliases ?? []), entry.definition, group.title]
        .join(' ')
        .toLowerCase()
        .includes(glossaryNeedle);
    }),
  })).filter((group) => group.entries.length > 0);

  const ActiveIcon = ICONS[activeSection.icon];
  const related = (activeSection.related ?? [])
    .map((id) => allSections.find((section) => section.id === id))
    .filter((section): section is SectionItem => Boolean(section));

  return (
    <div className="flex min-h-dvh flex-col gap-4 p-3 sm:p-5">
      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            <BookOpen className="text-emerald-600 dark:text-emerald-400" size={30} />
            Manual de usuario
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Qué hace cada módulo, cómo usarlo y qué significan sus datos. En lenguaje de planta.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
        >
          <ArrowLeft size={16} /> Volver
        </button>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Navegación */}
        <aside className="w-full shrink-0 lg:w-80">
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar en el manual…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <p className="mb-2 px-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
              {query.trim() ? `${visibleSections.length} resultado(s)` : `${allSections.length} temas`}
            </p>

            <div className="max-h-[62vh] space-y-1 overflow-y-auto pr-1">
              {visibleSections.map((section) => {
                const Icon = ICONS[section.icon];
                const isActive = activeSection?.id === section.id;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => changeSection(section.id)}
                    className={`flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors ${
                      isActive
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon size={17} className="mt-0.5 shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-sm font-bold leading-tight">{section.title}</span>
                      <span className={`block text-[11px] leading-snug ${isActive ? 'text-emerald-50/90' : 'text-slate-400'}`}>
                        {section.tagline}
                      </span>
                    </span>
                  </button>
                );
              })}
              {visibleSections.length === 0 && (
                <p className="px-2 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                  Sin resultados para «{query}». Prueba con «orden», «inventario» o «SLA».
                </p>
              )}
            </div>
          </div>
        </aside>

        {/* Contenido */}
        <main ref={contentRef} className="min-w-0 flex-1">
          {activeSection?.id === 'glossary' ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-emerald-100 p-3 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                    <BookOpen size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white">Glosario</h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Qué significa cada indicador, sigla, estado y dato de la aplicación.
                    </p>
                  </div>
                </div>
                <div className="relative mt-4">
                  <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    value={glossaryQuery}
                    onChange={(event) => setGlossaryQuery(event.target.value)}
                    placeholder="Buscar un término (ej. SLA, stock, MTTR, turno)…"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              {glossaryGroups.length === 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                  No se encontró «{glossaryQuery}».
                </div>
              )}

              {glossaryGroups.map((group) => (
                <div
                  key={group.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <h3 className="text-base font-black text-slate-800 dark:text-slate-100">{group.title}</h3>
                  <p className="mb-3 mt-1 text-xs text-slate-500 dark:text-slate-400">{group.description}</p>
                  <dl className="grid gap-2 sm:grid-cols-2">
                    {group.entries.map((entry) => (
                      <div
                        key={entry.term}
                        className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/40"
                      >
                        <dt className="text-sm font-bold text-slate-800 dark:text-slate-100">{entry.term}</dt>
                        <dd className="mt-0.5 text-[12.5px] leading-relaxed text-slate-600 dark:text-slate-300">
                          {entry.definition}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          ) : (
            activeSection && (
              <div className="space-y-4">
                {/* Título de la sección */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-emerald-100 p-3 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                      <ActiveIcon size={24} />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-2xl font-black text-slate-900 dark:text-white">{activeSection.title}</h2>
                      <p className="mt-0.5 text-sm font-medium text-slate-500 dark:text-slate-400">
                        {activeSection.tagline}
                      </p>
                    </div>
                  </div>
                  <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700 dark:bg-slate-950/40 dark:text-slate-300">
                    {activeSection.purpose}
                  </p>
                </div>

                {/* Qué puedes hacer */}
                {activeSection.actions.length > 0 && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-slate-500">
                      <ListChecks size={16} className="text-emerald-600" /> Qué puedes hacer aquí
                    </h3>
                    <ul className="space-y-2">
                      {activeSection.actions.map((action) => (
                        <li key={action} className="flex items-start gap-2 text-[13px] leading-relaxed text-slate-700 dark:text-slate-300">
                          <ArrowRight size={14} className="mt-0.5 shrink-0 text-emerald-600" />
                          <span>{action}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Datos y significados */}
                {activeSection.fields && activeSection.fields.length > 0 && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-slate-500">
                      <Info size={16} className="text-sky-600" /> Datos y significados
                    </h3>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {activeSection.fields.map((field) => (
                        <div
                          key={field.label}
                          className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/40"
                        >
                          <p className="text-[12.5px] font-bold text-slate-800 dark:text-slate-100">{field.label}</p>
                          <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-600 dark:text-slate-300">
                            {field.meaning}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tips */}
                {activeSection.tips && activeSection.tips.length > 0 && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/20">
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-amber-800 dark:text-amber-300">
                      <Lightbulb size={16} /> Buenas prácticas
                    </h3>
                    <ul className="space-y-1.5">
                      {activeSection.tips.map((tip) => (
                        <li key={tip} className="flex items-start gap-2 text-[12.5px] leading-relaxed text-amber-900 dark:text-amber-200/90">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Relacionado */}
                {related.length > 0 && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <h3 className="mb-2 text-sm font-black uppercase tracking-wide text-slate-500">Ver también</h3>
                    <div className="flex flex-wrap gap-2">
                      {related.map((section) => {
                        const Icon = ICONS[section.icon];
                        return (
                          <button
                            key={section.id}
                            type="button"
                            onClick={() => changeSection(section.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          >
                            <Icon size={14} /> {section.title}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {activeSection.id === 'quick' && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/20">
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                      <Rocket size={16} /> Recomendación de arranque
                    </h3>
                    <p className="text-[12.5px] leading-relaxed text-emerald-900 dark:text-emerald-200/90">
                      Empieza por lo que te da resultados en la primera semana: activos y refacciones cargados, técnicos con
                      horario y órdenes con evidencia. Lo demás (KPI, desempeño, carga) empieza a ser útil cuando ya hay
                      datos reales.
                    </p>
                  </div>
                )}
              </div>
            )
          )}
        </main>
      </div>
    </div>
  );
};
