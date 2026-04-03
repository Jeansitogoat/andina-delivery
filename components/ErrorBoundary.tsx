'use client';

import { Component, type ReactNode } from 'react';
import Link from 'next/link';
import { mapErrorToUserMessage } from '@/lib/errorMessages';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary:', error, errorInfo);
    if (!this.state.error) this.setState({ error });
  }

  render() {
    if (this.state.hasError) {
      const showDebug =
        typeof window !== 'undefined' && window.location.search.includes('debug=1');
      const err = this.state.error;
      const { message: userMessage, action } = mapErrorToUserMessage(err ?? new Error('Unknown'));

      return (
        <main className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full text-center">
            <div className="text-6xl mb-4">😕</div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              Algo salió mal
            </h1>
            <p className="text-gray-600 mb-6">
              {userMessage}
            </p>
            {showDebug && err && (
              <div className="w-full text-left mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-xs font-bold text-red-800 uppercase mb-1">Modo debug (?debug=1)</p>
                <p className="text-sm text-red-900 font-mono break-all">{err.message}</p>
                {err.stack && (
                  <pre className="mt-2 text-xs text-red-800 overflow-auto max-h-40 whitespace-pre-wrap">
                    {err.stack}
                  </pre>
                )}
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-6 py-3 rounded-xl bg-rojo-andino text-white font-semibold hover:bg-rojo-andino/90 transition-colors"
              >
                Recargar página
              </button>
              {action === 'login' ? (
                <Link
                  href="/auth"
                  className="px-6 py-3 rounded-xl border-2 border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
                >
                  Iniciar sesión
                </Link>
              ) : (
                <Link
                  href="/?modo=cliente"
                  className="px-6 py-3 rounded-xl border-2 border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
                >
                  Ir al inicio
                </Link>
              )}
            </div>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
