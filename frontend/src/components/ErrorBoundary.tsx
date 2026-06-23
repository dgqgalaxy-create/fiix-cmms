import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-900">
          <div className="bg-white rounded-3xl p-8 shadow-xl max-w-3xl w-full border border-red-100">
            <h1 className="text-2xl font-bold text-red-600 mb-4 flex items-center gap-2">
              <span className="text-3xl">⚠️</span> Algo salió mal en la aplicación
            </h1>
            <p className="text-slate-600 mb-6 font-medium">
              Ocurrió un error inesperado. Por favor, copia el texto de abajo y envíaselo a tu asistente para solucionarlo de inmediato:
            </p>
            <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto mb-6">
              <pre className="text-red-400 text-sm whitespace-pre-wrap font-mono">
                {this.state.error && this.state.error.toString()}
                <br />
                {this.state.errorInfo && this.state.errorInfo.componentStack}
              </pre>
            </div>
            <div className="flex gap-4">
              <button
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors"
                onClick={() => window.location.href = '/'}
              >
                Volver al Inicio
              </button>
              <button
                className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors"
                onClick={() => window.location.reload()}
              >
                Recargar Página
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
