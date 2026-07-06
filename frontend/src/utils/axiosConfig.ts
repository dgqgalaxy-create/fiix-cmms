import axios from 'axios';
import { addOfflineRequest } from './offlineQueue';

// Configurar el interceptor de peticiones
axios.interceptors.request.use(async (config) => {
  // Si estamos sin conexión y la petición no es un GET (modificación de datos)
  if (!navigator.onLine && config.method && config.method.toUpperCase() !== 'GET') {
    console.warn(`[Offline Mode] Guardando petición ${config.method.toUpperCase()} a ${config.url}`);
    
    await addOfflineRequest(
      config.url || '', 
      config.method.toUpperCase(), 
      config.headers || {}, 
      config.data
    );

    // Cancelar la petición real arrojando un error controlado para que Axios no intente enviarla
    // Esto evita que falle en el navegador con ERR_INTERNET_DISCONNECTED
    // Para que las llamadas originales no revienten la UI, podríamos retornar una respuesta dummy
    // Sin embargo, lanzar un error con una marca es la forma más limpia.
    return Promise.reject({ isOfflineHandled: true, message: 'Guardado offline exitosamente' });
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Interceptor de respuestas para capturar errores de red (cuando navigator.onLine falla)
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Si la petición original fue capturada por nuestro interceptor offline
    if (error && error.isOfflineHandled) {
      // Devolver una respuesta exitosa falsa para engañar a los componentes UI y que asuman éxito
      return Promise.resolve({ data: { success: true, offline: true }, status: 200, statusText: 'OK', headers: {}, config: error.config || {} });
    }
    
    // Si ocurrió un error de red real (ej. el internet se fue justo en ese momento)
    if (!navigator.onLine || error.message === 'Network Error') {
       if (error.config && error.config.method && error.config.method.toUpperCase() !== 'GET') {
         console.warn(`[Offline Mode] Recuperando error de red para ${error.config.url}`);
         await addOfflineRequest(
            error.config.url || '', 
            error.config.method.toUpperCase(), 
            error.config.headers || {}, 
            error.config.data
          );
          return Promise.resolve({ data: { success: true, offline: true }, status: 200, statusText: 'OK', headers: {}, config: error.config });
       }
    }

    return Promise.reject(error);
  }
);

export default axios;
