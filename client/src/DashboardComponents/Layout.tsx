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
	BellIcon,
	MenuIcon,
	CloseIcon,
	WorkspaceIcon,
	ProjectBoardIcon,
	ShieldIcon
} from "../lib/icons"

import { useState } from "react"
import { useNotification } from "../context/NotificationContext"

export default function Layout() {
	const navigate = useNavigate()
	const location = useLocation()
	const { user, clearAuth } = useAuthStore()
	const { notifications, unreadCount, markAllAsRead, clearNotifications } = useNotification()
	const [showNotificationMenu, setShowNotificationMenu] = useState(false)
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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

	const activeTab = location.pathname.startsWith("/meetings/history")
		? "mymeetings"
		: location.pathname === "/profile"
			? "profile"
			: location.pathname === "/admin"
				? "admin"
				: location.pathname === "/workspace"
					? "workspace"
					: location.pathname === "/workspace/board"
						? "board"
						: location.pathname === "/schedule"
							? "schedule"
							: "home"

	const navContent = (
		<>
			{/* Navigation Items */}
			<nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto" aria-label="Main navigation">
				<Link
					to="/dashboard"
					onClick={() => setMobileMenuOpen(false)}
					className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === "home"
							? "bg-bg-surface text-text-brand shadow-inner"
							: "text-text-muted hover:text-text-primary hover:bg-bg-surface-hover/60"
						}`}
				>
					<HomeIcon className={activeTab === "home" ? "text-text-brand" : "text-text-muted"} />
					Home Dashboard
				</Link>

				<Link
					to="/meetings/history"
					onClick={() => setMobileMenuOpen(false)}
					className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === "mymeetings"
							? "bg-bg-surface text-text-brand shadow-inner"
							: "text-text-muted hover:text-text-primary hover:bg-bg-surface-hover/60"
						}`}
				>
					<VideoIcon className={activeTab === "mymeetings" ? "text-text-brand" : "text-text-muted"} />
					My Meetings
				</Link>

				<Link
					to="/workspace"
					onClick={() => setMobileMenuOpen(false)}
					className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === "workspace"
							? "bg-bg-surface text-brand-secondary shadow-inner"
							: "text-text-muted hover:text-text-primary hover:bg-bg-surface-hover/60"
						}`}
				>
					<WorkspaceIcon className={activeTab === "workspace" ? "text-brand-secondary" : "text-text-muted"} />
					Team Workspace
				</Link>

				<Link
					to="/workspace/board"
					onClick={() => setMobileMenuOpen(false)}
					className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === "board"
							? "bg-bg-surface text-brand-emerald shadow-inner"
							: "text-text-muted hover:text-text-primary hover:bg-bg-surface-hover/60"
						}`}
				>
					<ProjectBoardIcon className={activeTab === "board" ? "text-brand-emerald" : "text-text-muted"} />
					Project Board
				</Link>

				<Link
					to="/schedule"
					onClick={() => setMobileMenuOpen(false)}
					className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === "schedule"
							? "bg-bg-surface text-text-brand shadow-inner"
							: "text-text-muted hover:text-text-primary hover:bg-bg-surface-hover/60"
						}`}
				>
					<CalendarIcon className={activeTab === "schedule" ? "text-text-brand" : "text-text-muted"} />
					Schedule
				</Link>

				{user?.systemRole === 'SUPER_ADMIN' && (
					<Link
						to="/admin"
						onClick={() => setMobileMenuOpen(false)}
						className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 border border-border-brand/20 ${activeTab === "admin"
								? "bg-brand-primary/20 text-brand-primary-light shadow-inner"
								: "bg-brand-primary/10 text-text-brand hover:bg-brand-primary/20 hover:text-brand-primary-light"
							}`}
					>
						<ShieldIcon className={activeTab === "admin" ? "text-brand-primary-light" : "text-text-brand"} />
						Admin Panel
					</Link>
				)}

				<button
					className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-text-muted hover:text-text-primary hover:bg-bg-surface-hover/60 transition-all duration-200 cursor-pointer"
				>
					<SettingsIcon className="text-text-muted" />
					Settings
				</button>
			</nav>

			{/* User profile footer */}
			<div className="p-4 border-t border-border-subtle bg-bg-sidebar/50">
				<div className="flex items-center justify-between">
					<Link to="/profile" onClick={() => setMobileMenuOpen(false)}>
						<div className="flex items-center gap-3">
							{user?.avatar ? (
								<img
									src={user.avatar}
									alt={user.name || "Avatar"}
									className="h-10 w-10 rounded-xl object-cover border border-border-default"
								/>
							) : (
								<div className="h-10 w-10 rounded-xl bg-gradient-to-br from-brand-primary/20 to-brand-secondary/20 border border-border-brand/20 flex items-center justify-center font-bold text-text-brand">
									{getInitials(user?.name || user?.email)}
								</div>
							)}
							<div className="overflow-hidden">
								<p className="text-sm font-semibold text-text-primary truncate">{user?.name || 'User'}</p>
								<p className="text-xs text-text-muted truncate">{user?.email}</p>
							</div>
						</div>
					</Link>
					<button
						onClick={handleLogout}
						className="p-2 text-text-muted hover:text-status-danger hover:bg-bg-surface-hover/50 rounded-lg transition-colors cursor-pointer"
						title="Logout"
						aria-label="Logout account"
					>
						<LogoutIcon className="h-5 w-5" />
					</button>
				</div>
			</div>
		</>
	)

	return (
		<div className="flex h-screen bg-bg-app text-text-primary overflow-hidden font-sans">
			{/* Skip link for keyboard accessibility */}
			<a href="#main-content" className="skip-to-content">
				Skip to main content
			</a>

			{/* Background ambient glows */}
			<div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-brand-primary/5 blur-3xl pointer-events-none" />
			<div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full bg-brand-secondary/5 blur-3xl pointer-events-none" />

			{/* Desktop Sidebar */}
			<aside className="hidden md:flex w-64 border-r border-border-default bg-bg-sidebar/90 backdrop-blur-xl flex-col z-20" aria-label="Sidebar Navigation">
				{/* Logo */}
				<div className="h-16 px-6 flex items-center gap-2.5 border-b border-border-subtle">
					<div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-brand-primary to-brand-secondary flex items-center justify-center shadow-lg shadow-brand-primary/20">
						<span className="font-bold text-lg text-text-inverse">I</span>
					</div>
					<div>
						<span className="font-bold text-base tracking-tight text-text-primary">IntellMeet</span>
						<span className="text-[10px] block text-text-brand font-medium tracking-wider uppercase -mt-0.5">Workspace</span>
					</div>
				</div>
				{navContent}
			</aside>

			{/* Mobile Drawer Overlay & Sidebar */}
			{mobileMenuOpen && (
				<div className="fixed inset-0 z-50 md:hidden flex">
					{/* Backdrop overlay */}
					<div
						className="fixed inset-0 bg-bg-overlay/80 backdrop-blur-sm transition-opacity"
						onClick={() => setMobileMenuOpen(false)}
						aria-hidden="true"
					/>

					{/* Sliding Drawer Container */}
					<div className="relative w-72 max-w-[80vw] bg-bg-sidebar flex flex-col h-full z-10 border-r border-border-default shadow-2xl animate-in slide-in-from-left duration-200">
						<div className="h-16 px-6 flex items-center justify-between border-b border-border-subtle">
							<div className="flex items-center gap-2.5">
								<div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-brand-primary to-brand-secondary flex items-center justify-center shadow-lg shadow-brand-primary/20">
									<span className="font-bold text-lg text-text-inverse">I</span>
								</div>
								<div>
									<span className="font-bold text-base tracking-tight text-text-primary">IntellMeet</span>
									<span className="text-[10px] block text-text-brand font-medium tracking-wider uppercase -mt-0.5">Workspace</span>
								</div>
							</div>
							<button
								onClick={() => setMobileMenuOpen(false)}
								className="p-2 text-text-muted hover:text-text-primary rounded-lg"
								aria-label="Close navigation menu"
							>
								<CloseIcon />
							</button>
						</div>
						{navContent}
					</div>
				</div>
			)}

			{/* Main content area */}
			<main id="main-content" className="flex-1 overflow-y-auto flex flex-col z-10 min-w-0" tabIndex={-1}>
				{/* Top Header */}
				<header className="sticky top-0 z-40 h-16 px-4 md:px-8 py-4 border-b border-border-subtle bg-bg-sidebar/80 backdrop-blur-xl flex items-center justify-between gap-3 shrink-0">
					<div className="flex items-center gap-3 flex-1 min-w-0">
						{/* Mobile Hamburger Toggle */}
						<button
							onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
							className="p-2 text-text-muted hover:text-text-primary rounded-xl md:hidden shrink-0 border border-border-subtle hover:bg-bg-surface-hover/50"
							aria-label="Toggle navigation menu"
							aria-expanded={mobileMenuOpen}
						>
							<MenuIcon />
						</button>

						{/* Search Bar */}
						<div className="relative w-full max-w-[200px] sm:max-w-xs md:w-80">
							<span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-text-muted">
								<SearchIcon />
							</span>
							<input
								type="text"
								placeholder="Search meetings, tasks..."
								aria-label="Search meetings and tasks"
								className="w-full pl-10 pr-4 py-1.5 bg-bg-input border border-border-subtle rounded-xl text-sm placeholder:text-text-subtle focus:outline-none focus:border-border-brand transition-all text-text-primary"
							/>
						</div>
					</div>

					<div className="flex items-center gap-2 sm:gap-4 shrink-0">
						{/* Notification Bell */}
						<div className="relative">
							<button
								onClick={() => {
									setShowNotificationMenu(!showNotificationMenu)
									if (!showNotificationMenu) markAllAsRead()
								}}
								className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-surface-hover/50 rounded-xl transition-all cursor-pointer relative"
								title="Notifications"
								aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
							>
								<BellIcon />
								{unreadCount > 0 && (
									<span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-brand-primary text-text-inverse text-[10px] font-bold flex items-center justify-center border border-bg-app animate-pulse">
										{unreadCount}
									</span>
								)}
							</button>

							{/* Notifications Dropdown Panel */}
							{showNotificationMenu && (
								<div className="absolute right-0 mt-3 w-72 sm:w-96 rounded-2xl border border-border-default bg-bg-dropdown/95 backdrop-blur-xl shadow-2xl z-50 overflow-hidden font-sans">
									<div className="p-4 border-b border-border-subtle flex items-center justify-between">
										<div className="flex items-center gap-2">
											<h3 className="font-bold text-xs text-text-primary uppercase tracking-wider">Notifications</h3>
											{unreadCount > 0 && (
												<span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-brand-primary/10 text-text-brand border border-border-brand/20">
													{unreadCount} unread
												</span>
											)}
										</div>
										<div className="flex items-center gap-3">
											{unreadCount > 0 && (
												<button
													onClick={markAllAsRead}
													className="text-[11px] text-text-brand hover:text-brand-primary-light transition-colors font-medium cursor-pointer"
												>
													Mark Read
												</button>
											)}
											{notifications.length > 0 && (
												<button
													onClick={clearNotifications}
													className="text-[11px] text-text-muted hover:text-status-danger transition-colors cursor-pointer"
												>
													Clear All
												</button>
											)}
										</div>
									</div>

									{/* List */}
									<div className="max-h-80 overflow-y-auto p-3 space-y-2">
										{notifications.length === 0 ? (
											<div className="py-8 text-center text-text-muted">
												<p className="text-xs">No notifications yet</p>
												<p className="text-[11px] text-text-subtle mt-1">Real-time alerts for mentions & action items will appear here</p>
											</div>
										) : (
											notifications.map((item) => (
												<div
													key={item.id}
													onClick={() => {
														if (item.link) {
															navigate(item.link);
															setShowNotificationMenu(false);
														}
													}}
													className={`p-3 rounded-xl border transition-all flex items-start gap-3 cursor-pointer ${item.read
															? 'bg-bg-surface-hover/30 border-border-subtle opacity-70 hover:opacity-100 hover:bg-bg-surface-hover/60'
															: 'bg-bg-surface border-border-default hover:bg-bg-surface-hover shadow-md'
														}`}
												>
													<div className="mt-0.5 shrink-0 flex items-center justify-center h-6 w-6 rounded-lg text-xs font-bold bg-bg-surface-hover">
														{item.type === 'mention' ? '@' :
															item.type === 'action_item' ? '⚡' :
																item.type === 'task_assigned' ? '📌' :
																	item.type === 'user-joined' ? '👤' : 'ℹ️'}
													</div>
													<div className="overflow-hidden flex-1">
														<div className="flex items-center justify-between gap-2">
															<span className="text-xs font-semibold text-text-primary truncate">{item.title}</span>
															<span className="text-[10px] text-text-muted shrink-0">{item.timestamp}</span>
														</div>
														<p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{item.message}</p>
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
				<div className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto space-y-6 md:space-y-8">
					<Outlet />
				</div>
			</main>
		</div>
	)
}

