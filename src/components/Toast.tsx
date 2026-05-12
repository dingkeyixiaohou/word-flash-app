interface ToastProps {
  type: 'success' | 'error' | 'info';
  message: string;
  hiding?: boolean;
}

export function Toast({ type, message, hiding }: ToastProps) {
  return (
    <div className={`toast toast-${type} ${hiding ? 'hiding' : ''}`}>
      {type === 'success' && '✓ '}
      {type === 'error' && '✗ '}
      {type === 'info' && 'ℹ '}
      {message}
    </div>
  );
}
