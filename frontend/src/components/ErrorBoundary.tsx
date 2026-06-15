import React, { Component, ErrorInfo, ReactNode } from "react";

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
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-50 text-red-900 border border-red-200 rounded-lg max-w-full overflow-auto">
          <h1 className="font-bold mb-2">Error Crítico de Renderizado</h1>
          <p className="mb-2 text-sm">Ocurrió un error inesperado al intentar mostrar esta pantalla. Por favor, reporta el siguiente código:</p>
          <pre className="text-xs bg-white p-2 border border-red-100 rounded mb-2 overflow-x-auto">
            {this.state.error?.toString()}
          </pre>
          <pre className="text-xs bg-white p-2 border border-red-100 rounded overflow-x-auto whitespace-pre-wrap max-h-[300px]">
            {this.state.errorInfo?.componentStack}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}
