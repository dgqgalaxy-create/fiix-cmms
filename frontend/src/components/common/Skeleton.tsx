/**
 * Bloques de carga (skeletons) con brillo suave, para sustituir los
 * textos de «Cargando…» por una silueta del contenido real.
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded-md ${className}`} aria-hidden="true" />;
}

/** Filas de tabla en carga: `columns` celdas por fila. */
export function TableSkeleton({ columns, rows = 6 }: { columns: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex} className="border-t border-slate-100 dark:border-slate-800">
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <td key={columnIndex} className="px-6 py-4">
              <Skeleton className={`h-3.5 ${columnIndex === 0 ? 'w-20' : columnIndex === 1 ? 'w-48' : 'w-24'}`} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** Tarjetas en carga (para vistas de cuadrícula). */
export function CardsSkeleton({ count = 6, className = '' }: { count?: number; className?: string }) {
  return (
    <div className={`grid gap-3 sm:grid-cols-2 xl:grid-cols-3 ${className}`}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-3 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-2/3" />
          <Skeleton className="mt-4 h-7 w-24 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Bloque de detalle en carga (paneles laterales). */
export function DetailSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-6 w-56" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}
