import { useNotification, type NotificationItem } from "../context/NotificationContext"

import { SparklesIcon, WarningIcon, CheckIcon } from "../lib/icons"

export default function ToastContainer() {
	const { toasts, dismissToast } = useNotification()

	if (toasts.length === 0) return null;

	return (
		<div className="fixed top-5 right-5 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
			{toasts.map((toast) => (
				<ToastCard key={toast.id} toast={toast} onDismiss={() => dismissToast(toast.id)} />
			))}
		</div>
	)
}

function ToastCard({ toast, onDismiss }: { toast: NotificationItem; onDismiss: () => void }) {
	const getIcon = () => {
		switch (toast.type) {
			case 'user-joined':
				return <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />;
			case 'user-left':
				return <span className="h-2 w-2 rounded-full bg-rose-400" />;
			case 'success':
				return <CheckIcon className="text-emerald-400" size={16} />;
			case 'warning':
			case 'error':
				return <WarningIcon className="text-rose-400" size={16} />;
			default:
				return <SparklesIcon className="text-indigo-400" size={16} />;
		}
	}

	const getBorderColor = () => {
		switch (toast.type) {
			case 'user-joined':
			case 'success':
				return 'border-emerald-500/30 bg-slate-950/90';
			case 'user-left':
			case 'warning':
			case 'error':
				return 'border-rose-500/30 bg-slate-950/90';
			default:
				return 'border-indigo-500/30 bg-slate-950/90';
		}
	}

	return (
		<div
			className={`pointer-events-auto p-3.5 rounded-2xl border ${getBorderColor()} backdrop-blur-xl shadow-2xl transition-all duration-300 transform translate-y-0 opacity-100 flex items-start justify-between gap-3 font-sans`}
		>
			<div className="flex items-start gap-3 overflow-hidden">
				<div className="mt-0.5 p-1.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0">
					{getIcon()}
				</div>
				<div className="overflow-hidden">
					<div className="flex items-center gap-2">
						<h4 className="text-xs font-bold text-slate-200 truncate">{toast.title}</h4>
						<span className="text-[10px] text-slate-500">{toast.timestamp}</span>
					</div>
					<p className="text-xs text-slate-400 mt-0.5 leading-relaxed break-words">{toast.message}</p>
				</div>
			</div>
			<button
				onClick={onDismiss}
				className="text-slate-500 hover:text-slate-300 text-xs p-1 rounded-lg hover:bg-slate-900 transition-colors"
			>
				✕
			</button>
		</div>
	)
}
