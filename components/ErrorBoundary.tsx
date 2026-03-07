'use client';

import { Component, type ReactNode } from 'react';
import Link from 'next/link';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full text-center">
            <div className="text-6xl mb-4">😕</div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              Algo salió mal
            </h1>
            <p className="text-gray-600 mb-6">
              Hubo un error al cargar la página. Intenta recargar o volver al inicio.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-6 py-3 rounded-xl bg-rojo-andino text-white font-semibold hover:bg-rojo-andino/90 transition-colors"
              >
                Recargar página
              </button>
              <Link
                href="/"
                className="px-6 py-3 rounded-xl border-2 border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
              >
                Ir al inicio
              </Link>
            </div>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
