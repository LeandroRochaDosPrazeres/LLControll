'use client';

import * as React from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils/helpers';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

const icons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="w-5 h-5 text-success-600" />,
  error: <AlertCircle className="w-5 h-5 text-danger-600" />,
  info: <Info className="w-5 h-5 text-primary-600" />,
  warning: <AlertTriangle className="w-5 h-5 text-warning-600" />,
};

const bgColors: Record<ToastType, string> = {
  success: 'bg-success-50 border-success-200',
  error: 'bg-danger-50 border-danger-200',
  info: 'bg-primary-50 border-primary-200',
  warning: 'bg-warning-50 border-warning-200',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const addToast = React.useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);

    // Auto remove after 4 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}
        <ToastPrimitive.Viewport className="fixed top-4 right-4 left-4 z-[100] flex flex-col gap-2 outline-none" />
        <AnimatePresence>
          {toasts.map((toast) => (
            <ToastPrimitive.Root key={toast.id} asChild>
              <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className={cn(
                  'fixed top-4 left-4 right-4 z-[100]',
                  'flex items-start gap-3 p-4',
                  'border rounded-xl shadow-lg',
                  bgColors[toast.type]
                )}
              >
                <div className="flex-shrink-0">{icons[toast.type]}</div>
                <div className="flex-1 min-w-0">
                  <ToastPrimitive.Title className="text-sm font-semibold text-gray-900">
                    {toast.title}
                  </ToastPrimitive.Title>
                  {toast.description && (
                    <ToastPrimitive.Description className="mt-1 text-sm text-gray-600">
                      {toast.description}
                    </ToastPrimitive.Description>
                  )}
                </div>
                <ToastPrimitive.Close asChild>
                  <button
                    onClick={() => removeToast(toast.id)}
                    className="flex-shrink-0 p-1 rounded-full hover:bg-black/5 transition-colors"
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </ToastPrimitive.Close>
              </motion.div>
            </ToastPrimitive.Root>
          ))}
        </AnimatePresence>
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}
