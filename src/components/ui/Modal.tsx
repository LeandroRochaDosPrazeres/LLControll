'use client';

import { Fragment, ReactNode } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils/helpers';

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  title?: string;
  description?: string;
}

export function Modal({ open, onOpenChange, children, title, description }: ModalProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content asChild>
              <motion.div
                initial={{ opacity: 0, y: '100%' }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className={cn(
                  'fixed bottom-0 left-0 right-0 z-50',
                  'bg-white rounded-t-3xl',
                  'max-h-[90vh] overflow-y-auto',
                  'pb-[env(safe-area-inset-bottom)]',
                  'focus:outline-none'
                )}
              >
                {/* Handle bar */}
                <div className="sticky top-0 bg-white pt-3 pb-2 flex justify-center">
                  <div className="w-10 h-1 bg-gray-300 rounded-full" />
                </div>

                {/* Header */}
                {(title || description) && (
                  <div className="px-6 pb-4 border-b border-gray-100">
                    {title && (
                      <DialogPrimitive.Title className="text-lg font-semibold text-gray-900">
                        {title}
                      </DialogPrimitive.Title>
                    )}
                    {description && (
                      <DialogPrimitive.Description className="mt-1 text-sm text-gray-500">
                        {description}
                      </DialogPrimitive.Description>
                    )}
                  </div>
                )}

                {/* Close button */}
                <DialogPrimitive.Close asChild>
                  <button
                    className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition-colors"
                    aria-label="Fechar"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </DialogPrimitive.Close>

                {/* Content */}
                <div className="px-6 py-4">{children}</div>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}

interface ConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  variant?: 'danger' | 'warning' | 'default';
  isLoading?: boolean;
}

export function ConfirmModal({
  open,
  onOpenChange,
  title,
  description,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  onConfirm,
  variant = 'default',
  isLoading,
}: ConfirmModalProps) {
  const buttonVariants = {
    danger: 'bg-danger-600 hover:bg-danger-700 text-white',
    warning: 'bg-warning-600 hover:bg-warning-700 text-white',
    default: 'bg-primary-600 hover:bg-primary-700 text-white',
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <div className="flex gap-3 mt-4">
        <button
          onClick={() => onOpenChange(false)}
          className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 font-medium rounded-xl active:scale-95 transition-transform"
        >
          {cancelText}
        </button>
        <button
          onClick={onConfirm}
          disabled={isLoading}
          className={cn(
            'flex-1 py-3 px-4 font-medium rounded-xl active:scale-95 transition-transform',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            buttonVariants[variant]
          )}
        >
          {isLoading ? 'Aguarde...' : confirmText}
        </button>
      </div>
    </Modal>
  );
}
