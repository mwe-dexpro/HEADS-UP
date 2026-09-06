export interface ToastState {
  message: string;
  onUndo?: () => void;
}

interface ToastProps {
  toast: ToastState | null;
}

/** The app's one undo-snackbar pattern (see the design spec's "Editing
 * Safety" requirement — a single consistent pattern reused everywhere,
 * rather than a mix of confirm dialogs and snackbars). */
export function Toast({ toast }: ToastProps) {
  return (
    <div className={"toast-wrap" + (toast ? " show" : "")}>
      {toast && (
        <div className="toast-card">
          <span style={{ flex: 1 }}>{toast.message}</span>
          {toast.onUndo && <button onClick={toast.onUndo}>Undo</button>}
        </div>
      )}
    </div>
  );
}
