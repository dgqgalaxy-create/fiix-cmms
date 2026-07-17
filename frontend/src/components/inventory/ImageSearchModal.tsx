import React, { useState, useEffect } from 'react';
import { Search, X, Download, AlertCircle, Loader2 } from 'lucide-react';
import { searchImagesWeb } from '../../api/inventory';
import api from '../../api/axios';

interface ImageSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImageSelected: (file: File) => void;
  initialQuery: string;
}

interface ImageResult {
  url: string;
  title: string;
}

export const ImageSearchModal: React.FC<ImageSearchModalProps> = ({ isOpen, onClose, onImageSelected, initialQuery }) => {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<ImageResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && initialQuery) {
      setQuery(initialQuery);
      handleSearch(initialQuery);
    } else {
      setResults([]);
      setError(null);
    }
  }, [isOpen, initialQuery]);

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setError(null);
    try {
      const images = await searchImagesWeb(searchQuery);
      setResults(images);
      if (images.length === 0) {
        setError('No se encontraron imágenes para esta búsqueda.');
      }
    } catch (err: any) {
      setError('Error al buscar imágenes. Intenta con otra palabra.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectImage = async (url: string) => {
    setIsDownloading(true);
    setError(null);
    try {
      // Create a proxy download request
      const response = await api.get('/inventory/images/proxy', {
        params: { url },
        responseType: 'blob', // Important! Get as blob to convert to File
      });
      
      const blob = response.data;
      
      // Determine extension from content-type or default to jpg
      const contentTypeHeader = response.headers['content-type'];
      const contentType = (typeof contentTypeHeader === 'string' ? contentTypeHeader : 'image/jpeg');
      const extension = contentType.split('/')[1] || 'jpg';
      const fileName = `web_image_${Date.now()}.${extension}`;
      
      const file = new File([blob], fileName, { type: contentType });
      
      onImageSelected(file);
      onClose();
    } catch (err) {
      console.error(err);
      setError('No se pudo descargar la imagen seleccionada. Es posible que el servidor de origen la haya bloqueado. Intenta con otra imagen.');
    } finally {
      setIsDownloading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl animate-in zoom-in-95 duration-200 dark:border-slate-700 dark:bg-slate-900">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-6 dark:border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Buscar Imagen en Web</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Busca e importa imágenes directamente de internet</p>
          </div>
          <button 
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X size={24} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="border-b border-slate-100 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-950">
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSearch(query); }}
            className="flex gap-3"
          >
            <div className="relative flex-1">
              <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-slate-400">
                <Search size={20} />
              </div>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ej. Balero SKF 6205, Motor Siemens..."
                className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 shadow-sm transition-all outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <button 
              type="submit"
              disabled={isSearching || !query.trim()}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:bg-emerald-400"
            >
              {isSearching ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
              Buscar
            </button>
          </form>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6 dark:bg-slate-950/50">
          {error && (
            <div className="mb-6 flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
              <AlertCircle size={20} className="flex-shrink-0 text-rose-500" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {isSearching ? (
            <div className="flex h-64 flex-col items-center justify-center text-slate-400">
              <Loader2 size={40} className="mb-4 animate-spin text-emerald-500" />
              <p>Buscando en Google Imágenes...</p>
            </div>
          ) : results.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {results.map((img, index) => (
                <div 
                  key={index}
                  onClick={() => !isDownloading && handleSelectImage(img.url)}
                  className={`group relative aspect-square cursor-pointer overflow-hidden rounded-xl border-2 border-transparent bg-slate-100 shadow-sm transition-all hover:border-emerald-500 dark:bg-slate-800 ${isDownloading ? 'pointer-events-none opacity-50' : ''}`}
                >
                  <img 
                    src={img.url} 
                    alt={img.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                  
                  {/* Overlay */}
                  <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
                    <p className="mb-2 line-clamp-2 text-xs font-medium text-white">{img.title}</p>
                    <div className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white">
                      <Download size={14} /> Usar Imagen
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : query && !isSearching && !error ? (
            <div className="flex h-64 flex-col items-center justify-center text-slate-400">
              <Search size={40} className="mb-4 opacity-20" />
              <p>No hay resultados. Intenta buscar.</p>
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center text-slate-400">
              <p>Escribe el nombre del repuesto para buscar fotos.</p>
            </div>
          )}
        </div>

        {/* Loading Overlay when downloading */}
        {isDownloading && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
            <Loader2 size={48} className="animate-spin text-blue-600 mb-4" />
            <h3 className="text-lg font-bold text-slate-900">Descargando imagen...</h3>
            <p className="text-sm text-slate-500">Importando desde la web hacia el servidor</p>
          </div>
        )}
      </div>
    </div>
  );
};
