import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { Mail, Lock, Loader2, Eye, EyeOff, Info, X } from 'lucide-react';
import { APP_VERSION } from '../components/VersionModal';
import { POST_WIPE_MESSAGE_KEY } from '../utils/postWipeMessage';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [postWipeMessage, setPostWipeMessage] = useState<string | null>(null);
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    const msg = sessionStorage.getItem(POST_WIPE_MESSAGE_KEY);
    if (msg) {
      setPostWipeMessage(msg);
      sessionStorage.removeItem(POST_WIPE_MESSAGE_KEY);
    }
  }, []);

  const dismissPostWipeMessage = () => setPostWipeMessage(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await api.post('/auth/login', { email, password });
      login(response.data.token, response.data.user);
      navigate('/home');
    } catch (err: any) {
      const status = err.response?.status;
      const apiError = err.response?.data?.error as string | undefined;
      if (status === 401) {
        setError(apiError || 'Contraseña o usuario incorrectos');
      } else if (apiError) {
        setError(apiError);
      } else {
        setError('Ocurrió un error al iniciar sesión');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800 relative z-10">
        <div className="text-center mb-8">
          <img 
            src="/lpet.png" 
            alt="GTZ Logo" 
            className="mx-auto h-20 md:h-24 object-contain mb-4"
          />
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 flex items-center justify-center gap-2">
            CMMS <span className="text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full mt-1">v{APP_VERSION}</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">Inicia sesión para gestionar el mantenimiento</p>
        </div>

        {postWipeMessage && (
          <div
            role="status"
            className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-100 rounded-2xl text-sm relative"
          >
            <button
              type="button"
              onClick={dismissPostWipeMessage}
              className="absolute top-3 right-3 text-amber-600/70 dark:text-amber-300/70 hover:text-amber-800 dark:hover:text-amber-100 transition-colors"
              aria-label="Cerrar aviso"
            >
              <X size={16} />
            </button>
            <div className="flex gap-3 pr-6">
              <Info className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" size={18} />
              <div className="space-y-1.5 font-medium leading-relaxed">
                {postWipeMessage.split('\n').map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 text-red-600 dark:text-red-400 rounded-2xl text-sm text-center font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 ml-1">Usuario</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-emerald-600 dark:group-focus-within:text-emerald-400 transition-colors">
                <Mail size={18} />
              </div>
              <input
                type="text"
                required
                className="block w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition-all outline-none"
                placeholder="usuario"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 ml-1">Contraseña</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-emerald-600 dark:group-focus-within:text-emerald-400 transition-colors">
                <Lock size={18} />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                className="block w-full pl-11 pr-12 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition-all outline-none"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-medium shadow-lg shadow-emerald-700/20 transform transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed mt-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          >
            {isLoading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              'Ingresar'
            )}
          </button>
        </form>
        
        <div className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
          Usa <span className="font-medium text-slate-700 dark:text-slate-300">admin@fiix.com</span> y <span className="font-medium text-slate-700 dark:text-slate-300">password123</span> para probar.
        </div>
      </div>
    </div>
  );
};
