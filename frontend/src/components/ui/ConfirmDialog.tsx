import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: 'danger' | 'default';
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  variant = 'default',
  loading,
}: ConfirmDialogProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-dark-secondary rounded-xl border border-dark-elevated p-6 max-w-md w-full shadow-2xl">
              <div className="flex items-start gap-4">
                {variant === 'danger' && (
                  <div className="h-10 w-10 shrink-0 rounded-full bg-danger/10 flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-danger" />
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
                  <p className="text-sm text-text-secondary mt-2">{message}</p>
                </div>
                <button onClick={onClose} className="text-text-muted hover:text-text-primary" aria-label="Close">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={onClose} className="btn-secondary" disabled={loading}>
                  Cancel
                </button>
                <button
                  onClick={onConfirm}
                  className={variant === 'danger' ? 'btn-danger' : 'btn-primary'}
                  disabled={loading}
                >
                  {loading ? 'Processing...' : confirmLabel}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
