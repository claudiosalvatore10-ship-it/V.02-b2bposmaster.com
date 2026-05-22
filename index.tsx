
import React, { Component, ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { registerSW } from 'virtual:pwa-register';
import { Toaster, toast } from 'sonner';
import { ShieldAlert } from 'lucide-react';
import './src/i18n';

// Error Boundary Component
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

const ErrorBoundary: any = class extends React.Component<any, any> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Critical Error caught by Boundary:", error, errorInfo);
  }

  render() {
    const { hasError, error } = (this as any).state;
    const { children } = (this as any).props;

    if (hasError) {
      return (
        <div className="h-screen flex items-center justify-center bg-red-50 p-8">
          <div className="max-w-md bg-white p-8 rounded-2xl shadow-xl border border-red-100 text-center">
            <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-black text-gray-900 mb-2">Critical Error</h1>
            <p className="text-gray-600 mb-6">
              The application failed to start. This is likely due to a data synchronization issue or a missing dependency.
            </p>
            <div className="bg-gray-100 p-4 rounded-lg text-left text-xs font-mono mb-6 overflow-auto max-h-40">
              {error?.message}
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return children;
  }
}

// Register service worker for PWA
const updateSW = registerSW({
  onNeedRefresh() {
    toast('New content available.', {
      action: {
        label: 'Reload',
        onClick: () => updateSW(true),
      },
      duration: Infinity,
    });
  },
  onOfflineReady() {
    console.log('App ready to work offline');
  },
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <ErrorBoundary>
    <Toaster position="top-center" richColors />
    <App />
  </ErrorBoundary>
);
