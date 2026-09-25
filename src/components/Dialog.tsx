import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from '@phosphor-icons/react';

/**
 * Native <dialog> opened with showModal(): the browser provides focus
 * containment, Escape to close and inert background. Focus returns to the
 * element that opened it.
 */
export function Dialog({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const returnTo = useRef<Element | null>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      returnTo.current = document.activeElement;
      d.showModal();
    } else if (!open && d.open) {
      d.close();
    }
  }, [open]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const handleClose = () => {
      if (returnTo.current instanceof HTMLElement) returnTo.current.focus();
    };
    d.addEventListener('close', handleClose);
    return () => d.removeEventListener('close', handleClose);
  }, []);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      {open ? (
        <div className="dialog-inner">
          <div className="dialog-head">
            <h2 id={titleId}>{title}</h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              <X size={22} aria-hidden />
            </button>
          </div>
          <div className="stack">{children}</div>
          {footer ? <div className="btn-row end">{footer}</div> : null}
        </div>
      ) : null}
    </dialog>
  );
}
