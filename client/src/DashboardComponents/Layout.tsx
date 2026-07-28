import { Link, useNavigate, useLocation, Outlet } from "react-router"
import { useAuthStore } from "../store/useAuthStore"
import { api } from "../lib/api"
import {
	VideoIcon,
	CalendarIcon,
	SearchIcon,
	HomeIcon,
	SettingsIcon,
	LogoutIcon,
	BellIcon
} from "../lib/icons"

import { useState } from "react"
import { useNotification } from "../context/NotificationContext"

export default function Layout() {
	const navigate = useNavigate()
	const location = useLocation()
	const { user, clearAuth } = useAuthStore()
	const { notifications, unreadCount, markAllAsRead, clearNotifications } = useNotification()
	const [showNotificationMenu, setShowNotificationMenu] = useState(false)


	const getInitials = (name?: string) => {
		if (!name) return "U";
		const parts = name.trim().split(/\s+/);
		if (parts.length >= 2) {
			return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
		}
		return parts[0].substring(0, 2).toUpperCase();
	};

	const handleLogout = async () => {
		try {
			await api.post("/auth/logout")
		} catch (err) {
			console.error("Logout error:", err)
		} finally {
			clearAuth()
			navigate("/login")
		}
	}

	const activeTab = location.pathname === "/profile" ? "profile" : "home"

	return (
		<div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
			{/* Background ambient glows */}
			<div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-indigo-600/5 blur-3xl pointer-events-none" />
			<div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full bg-violet-600/5 blur-3xl pointer-events-none" />

			{/* Sidebar navigation */}
			<aside className="w-64 border-r border-slate-900 bg-slate-950/80 backdrop-blur-xl flex flex-col z-20">
				{/* Logo */}
				<div className="h-16 px-6 flex items-center gap-2.5 border-b border-slate-900">
					<div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-600/20">
						<span className="font-bold text-lg text-white">I</span>
					</div>
					<div>
						<span className="font-bold text-base tracking-tight text-white">IntellMeet</span>
						<span className="text-[10px] block text-indigo-400 font-medium tracking-wider uppercase -mt-0.5">Workspace</span>
					</div>
				</div>

				{/* Navigation Items */}
				<nav className="flex-1 px-4 py-6 space-y-1">
					<Link
						to="/dashboard"
						className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
							activeTab === "home"
								? "bg-slate-900 text-indigo-400 shadow-inner"
								: "text-slate-400 hover:text-slate-200 hover:bg-slate-900/40"
						}`}
					>
						<HomeIcon className={activeTab === "home" ? "text-indigo-400" : "text-slate-400"} />
						Home Dashboard
					</Link>

					<button
						className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 transition-all duration-200"
					>
						<VideoIcon className="text-slate-400" />
						My Meetings
					</button>

					<button
						className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 transition-all duration-200"
					>
						<CalendarIcon className="text-slate-400" />
						Schedule
					</button>

					<button
						className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 transition-all duration-200"
					>
						<SettingsIcon className="text-slate-400" />
						Settings
					</button>
				</nav>

				{/* User profile footer */}
				<div className="p-4 border-t border-slate-900 bg-slate-950/40">
					<div className="flex items-center justify-between">
						<Link to="/profile">
							<div className="flex items-center gap-3">
								{user?.avatar ? (
									<img
										src={user.avatar}
										alt={user.name || "Avatar"}
										className="h-10 w-10 rounded-xl object-cover border border-slate-850"
									/>
								) : (
									<div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/20 flex items-center justify-center font-bold text-indigo-300">
										{getInitials(user?.name || user?.email)}
									</div>
								)}
								<div className="overflow-hidden">
									<p className="text-sm font-semibold text-slate-200 truncate">{user?.name || 'User'}</p>
									<p className="text-xs text-slate-500 truncate">{user?.email}</p>
								</div>
							</div>
						</Link>
						<button
							onClick={handleLogout}
							className="p-2 text-slate-500 hover:text-rose-400 hover:bg-slate-900/50 rounded-lg transition-colors cursor-pointer"
							title="Logout"
						>
							<LogoutIcon className="h-5 w-5" />
						</button>
					</div>
				</div>
			</aside>

			{/* Main content area */}
			<main className="flex-1 overflow-y-auto flex flex-col z-10">
				{/* Top Header */}
				<header className="h-16 px-8 py-4 border-b border-slate-900 bg-slate-950/60 backdrop-blur-xl flex items-center justify-between">
					<div className="relative w-80">
						<span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-500">
							<SearchIcon />
						</span>
						<input
							type="text"
							placeholder="Search meetings, recordings, transcripts..."
							className="w-full pl-10 pr-4 py-1.5 bg-slate-900/40 border border-slate-900 rounded-xl text-sm placeholder:text-slate-600 focus:outline-none focus:border-slate-800 focus:bg-slate-900/60 transition-all text-slate-200"
						/>
					</div>

					<div className="flex items-center gap-4">
						{/* Live Indicator */}
						<div className="flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
							<span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
							<span className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider">Premium Plan</span>
						</div>

						{/* Notification Bell */}
						<div className="relative">
							<button
								onClick={() => {
									setShowNotificationMenu(!showNotificationMenu)
									if (!showNotificationMenu) markAllAsRead()
								}}
								className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-900/50 rounded-xl transition-all cursor-pointer relative"
								title="Notifications"
							>
								<BellIcon />
								{unreadCount > 0 && (
									<span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-indigo-500 text-white text-[10px] font-bold flex items-center justify-center border border-slate-950 animate-pulse">
										{unreadCount}
									</span>
								)}
							</button>

							{/* Notifications Dropdown Panel */}
							{showNotificationMenu && (
								<div className="absolute right-0 mt-3 w-80 sm:w-96 rounded-2xl border border-slate-900 bg-slate-950/95 backdrop-blur-xl shadow-2xl z-50 overflow-hidden font-sans">
									<div className="p-4 border-b border-slate-900 flex items-center justify-between">
										<div className="flex items-center gap-2">
											<h3 className="font-bold text-xs text-slate-200 uppercase tracking-wider">Notifications</h3>
											{notifications.length > 0 && (
												<span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
													{notifications.length}
												</span>
											)}
										</div>
										{notifications.length > 0 && (
											<button
												onClick={clearNotifications}
												className="text-[11px] text-slate-500 hover:text-rose-400 transition-colors"
											>
												Clear All
											</button>
										)}
									</div>

									{/* List */}
									<div className="max-h-80 overflow-y-auto p-3 space-y-2">
										{notifications.length === 0 ? (
											<div className="py-8 text-center text-slate-500">
												<p className="text-xs">No notifications yet</p>
												<p className="text-[11px] text-slate-600 mt-1">Real-time alerts will appear here</p>
											</div>
										) : (
											notifications.map((item) => (
												<div
													key={item.id}
													className="p-3 rounded-xl bg-slate-900/40 border border-slate-850 hover:bg-slate-900/70 transition-all flex items-start gap-3"
												>
													<div className="mt-0.5 h-2 w-2 rounded-full bg-indigo-500 shrink-0" />
													<div className="overflow-hidden flex-1">
														<div className="flex items-center justify-between">
															<span className="text-xs font-semibold text-slate-200 truncate">{item.title}</span>
															<span className="text-[10px] text-slate-500">{item.timestamp}</span>
														</div>
														<p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{item.message}</p>
													</div>
												</div>
											))
										)}
									</div>
								</div>
							)}
						</div>

					</div>
				</header>

				{/* Child content render area */}
				<div className="flex-1 p-8 max-w-7xl w-full mx-auto space-y-8">
					<Outlet />
				</div>
			</main>
		</div>
	)
}
