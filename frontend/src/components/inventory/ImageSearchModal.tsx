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
      const contentType = response.headers['content-type'] || 'image/jpeg';
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
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Buscar Imagen en Web</h2>
            <p className="text-sm text-slate-500 mt-1">Busca e importa imágenes directamente de internet</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-6 border-b border-slate-100 bg-slate-50">
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSearch(query); }}
            className="flex gap-3"
          >
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400">
                <Search size={20} />
              </div>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ej. Balero SKF 6205, Motor Siemens..."
                className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
              />
            </div>
            <button 
              type="submit"
              disabled={isSearching || !query.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-3 rounded-xl font-medium transition-colors shadow-sm flex items-center gap-2"
            >
              {isSearching ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
              Buscar
            </button>
          </form>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {error && (
            <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl flex items-center gap-3">
              <AlertCircle size={20} className="text-rose-500 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {isSearching ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400">
              <Loader2 size={40} className="animate-spin mb-4 text-blue-500" />
              <p>Buscando en Google Imágenes...</p>
            </div>
          ) : results.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {results.map((img, index) => (
                <div 
                  key={index}
                  onClick={() => !isDownloading && handleSelectImage(img.url)}
                  className={`group relative aspect-square rounded-xl overflow-hidden bg-slate-100 border-2 border-transparent hover:border-blue-500 cursor-pointer transition-all shadow-sm ${isDownloading ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  {/* We use the raw URL to display it. Note: some hotlinking might be blocked by the origin, 
                      but usually browsers bypass it if it's an img tag without referer strictness, 
                      or we could proxy the preview too, but usually direct img src works for preview. */}
                  <img 
                    src={img.url} 
                    alt={img.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                  
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                    <p className="text-white text-xs font-medium line-clamp-2 mb-2">{img.title}</p>
                    <div className="bg-blue-600 text-white text-xs font-bold py-1.5 px-3 rounded-lg flex items-center justify-center gap-2">
                      <Download size={14} /> Usar Imagen
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : query && !isSearching && !error ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400">
              <Search size={40} className="mb-4 opacity-20" />
              <p>No hay resultados. Intenta buscar.</p>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-400">
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
