import { createContext, type ReactNode, useCallback, useContext, useState } from 'react';

interface Toast {
	id: string;
	message: string;
	type: 'error' | 'success' | 'info';
}

interface ToastContextValue {
	addToast: (message: string, type?: Toast['type']) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
	const ctx = useContext(ToastContext);
	if (!ctx) throw new Error('useToast must be used within ToastProvider');
	return ctx;
}

let toastIdCounter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
	const [toasts, setToasts] = useState<Toast[]>([]);

	const addToast = useCallback((message: string, type: Toast['type'] = 'error') => {
		const id = `toast-${++toastIdCounter}`;
		setToasts((prev) => [...prev, { id, message, type }]);
		setTimeout(() => {
			setToasts((prev) => prev.filter((t) => t.id !== id));
		}, 4000);
	}, []);

	return (
		<ToastContext.Provider value={{ addToast }}>
			{children}
			{toasts.length > 0 && (
				<div className="toast-container" aria-live="polite">
					{toasts.map((t) => (
						<div key={t.id} className={`toast toast-${t.type}`} role="status">
							{t.message}
						</div>
					))}
				</div>
			)}
		</ToastContext.Provider>
	);
}
