import { useState, useEffect } from "react"
import { useNavigate } from "react-router"
import { api } from "../lib/api"
import { useAuthStore } from "../store/useAuthStore"
import { useWorkspaceStore } from "../store/useWorkspaceStore"
import {
	CalendarIcon,
	PlusIcon,
	VideoIcon,
	CopyIcon,
	CheckIcon,
	UsersIcon,
	SearchIcon,
	CloseIcon,
	ClockIcon,
	SparklesIcon
} from "../lib/icons"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"

interface UserOption {
	_id: string;
	name: string;
	email: string;
	avatar?: string;
}

export default function ScheduleView() {
	const navigate = useNavigate()
	const { user } = useAuthStore()
	const { workspaces, fetchWorkspaces } = useWorkspaceStore()

	const [meetings, setMeetings] = useState<any[]>([])
	const [loading, setLoading] = useState(true)
	const [filterTab, setFilterTab] = useState<'upcoming' | 'all' | 'hosted'>('upcoming')
	const [searchQuery, setSearchQuery] = useState('')

	// Modal & Form States
	const [showScheduleModal, setShowScheduleModal] = useState(false)
	const [title, setTitle] = useState('')
	const [description, setDescription] = useState('')
	const [startTime, setStartTime] = useState('')
	const [passcode, setPasscode] = useState('')
	const [isPrivate, setIsPrivate] = useState(false)
	const [inviteMode, setInviteMode] = useState<'individuals' | 'team'>('individuals')
	const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('')

	// Individual User Search
	const [userSearchQuery, setUserSearchQuery] = useState('')
	const [userSearchResults, setUserSearchResults] = useState<UserOption[]>([])
	const [selectedUsers, setSelectedUsers] = useState<UserOption[]>([])
	const [searchingUsers, setSearchingUsers] = useState(false)

	const [submitting, setSubmitting] = useState(false)
	const [successToast, setSuccessToast] = useState<string | null>(null)
	const [copiedCode, setCopiedCode] = useState<string | null>(null)

	// Default start time: 1 hour from current time
	const getDefaultStartTime = () => {
		const now = new Date()
		now.setHours(now.getHours() + 1)
		now.setMinutes(0, 0, 0)
		const tzOffset = now.getTimezoneOffset() * 60000
		const localISOTime = new Date(now.getTime() - tzOffset).toISOString().slice(0, 16)
		return localISOTime
	}

	const loadMeetings = async () => {
		setLoading(true)
		try {
			const res = await api.get('/meetings')
			setMeetings(res.data.meetings || [])
		} catch (err) {
			console.error("Error loading meetings:", err)
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		loadMeetings()
		fetchWorkspaces()
		setStartTime(getDefaultStartTime())
	}, [])

	// Search Users for Individual Invites
	useEffect(() => {
		if (!userSearchQuery.trim()) {
			setUserSearchResults([])
			return
		}
		const timer = setTimeout(async () => {
			setSearchingUsers(true)
			try {
				const res = await api.get(`/meetings/users/search?q=${encodeURIComponent(userSearchQuery)}`)
				setUserSearchResults(res.data.users || [])
			} catch (err) {
				console.error("Error searching users:", err)
			} finally {
				setSearchingUsers(false)
			}
		}, 300)
		return () => clearTimeout(timer)
	}, [userSearchQuery])

	const handleAddUser = (userOpt: UserOption) => {
		if (!selectedUsers.some(u => u._id === userOpt._id)) {
			setSelectedUsers([...selectedUsers, userOpt])
		}
		setUserSearchQuery('')
		setUserSearchResults([])
	}

	const handleRemoveUser = (userId: string) => {
		setSelectedUsers(selectedUsers.filter(u => u._id !== userId))
	}

	const handleScheduleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!title.trim() || !startTime) return

		setSubmitting(true)
		setSuccessToast(null)

		try {
			const payload = {
				title: title.trim(),
				description: description.trim(),
				startTime: new Date(startTime).toISOString(),
				passcode: passcode.trim(),
				isPrivate,
				invitedUsers: inviteMode === 'individuals' ? selectedUsers.map(u => u._id) : [],
				workspaceId: inviteMode === 'team' ? selectedWorkspaceId : undefined
			}

			const res = await api.post('/meetings', payload)
			const notifiedCount = res.data.notifiedCount || 0
			
			setSuccessToast(`Meeting "${title}" scheduled successfully! ${notifiedCount > 0 ? `${notifiedCount} attendee(s) notified.` : ''}`)
			
			// Reset form
			setTitle('')
			setDescription('')
			setPasscode('')
			setSelectedUsers([])
			setSelectedWorkspaceId('')
			setShowScheduleModal(false)
			
			// Reload scheduled meetings list
			loadMeetings()
		} catch (err: any) {
			console.error("Failed to schedule meeting:", err)
			alert(err.response?.data?.message || "Failed to schedule meeting. Please try again.")
		} finally {
			setSubmitting(false)
		}
	}

	const copyMeetingLink = (code: string) => {
		const link = `${window.location.origin}/meetings/${code}`
		navigator.clipboard.writeText(link)
		setCopiedCode(code)
		setTimeout(() => setCopiedCode(null), 2000)
	}

	// Filtering logic - exclude instant meetings so ONLY explicitly scheduled meetings appear
	const filteredMeetings = meetings.filter(m => {
		const isInstant = m.isInstant === true || m.title?.toLowerCase() === "instant meeting"
		if (isInstant) return false

		const matchesSearch = searchQuery === '' ||
			m.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
			m.meetingCode?.toLowerCase().includes(searchQuery.toLowerCase())

		if (!matchesSearch) return false

		const isHost = m.host?._id === user?.id || m.host === user?.id

		// Meeting is upcoming if current time is before or within 30 minutes after scheduled startTime
		const meetingTimeMs = new Date(m.startTime).getTime()
		const thirtyMinsAfterStart = meetingTimeMs + (30 * 60 * 1000)
		const isUpcomingWindow = Date.now() <= thirtyMinsAfterStart

		if (filterTab === 'upcoming') {
			return isUpcomingWindow && m.status !== 'cancelled'
		}

		if (filterTab === 'hosted') {
			return isHost
		}

		// 'all' tab shows all non-instant scheduled meetings
		return true
	})

	const selectedWorkspaceObj = workspaces.find(w => w._id === selectedWorkspaceId)

	return (
		<div className="space-y-6 font-sans">
			{/* Success Notification Banner */}
			{successToast && (
				<div className="p-4 bg-status-success/15 border border-status-success/30 rounded-2xl flex items-center justify-between text-status-success text-sm font-semibold animate-in fade-in slide-in-from-top-2 duration-300">
					<div className="flex items-center gap-2.5">
						<SparklesIcon size={18} />
						<span>{successToast}</span>
					</div>
					<button
						onClick={() => setSuccessToast(null)}
						className="p-1 hover:bg-status-success/20 rounded-lg text-status-success cursor-pointer"
					>
						<CloseIcon size={16} />
					</button>
				</div>
			)}

			{/* Page Header */}
			<Card className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-bg-surface border border-border-default p-6 rounded-2xl shadow-md gap-0">
				<div className="space-y-1">
					<div className="flex items-center gap-3">
						<div className="h-9 w-9 rounded-xl bg-brand-primary/10 border border-border-brand/20 flex items-center justify-center text-text-brand shrink-0">
							<CalendarIcon size={20} />
						</div>
						<h1 className="text-2xl font-bold text-text-primary tracking-tight">Scheduled Meetings</h1>
					</div>
					<p className="text-sm text-text-muted">
						View upcoming sessions, manage scheduled invitations, or set up a new meeting with individuals or team workspaces.
					</p>
				</div>

				<Button
					onClick={() => setShowScheduleModal(true)}
					className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-brand-primary to-brand-secondary hover:from-brand-primary-hover hover:to-brand-secondary text-text-inverse font-medium text-sm rounded-xl shadow-lg shadow-brand-primary/20 hover:shadow-brand-primary/30 transition-all duration-300 transform active:scale-[0.98] cursor-pointer shrink-0"
				>
					<PlusIcon />
					Schedule New Meeting
				</Button>
			</Card>

			{/* Filter Tabs & Search Bar */}
			<div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-bg-surface/50 p-4 border border-border-subtle rounded-2xl backdrop-blur-md">
				<div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
					<button
						onClick={() => setFilterTab('upcoming')}
						className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
							filterTab === 'upcoming'
								? 'bg-brand-primary text-text-inverse shadow-md'
								: 'bg-bg-surface-hover/60 text-text-muted hover:text-text-primary'
						}`}
					>
						Upcoming Meetings
					</button>
					<button
						onClick={() => setFilterTab('hosted')}
						className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
							filterTab === 'hosted'
								? 'bg-brand-primary text-text-inverse shadow-md'
								: 'bg-bg-surface-hover/60 text-text-muted hover:text-text-primary'
						}`}
					>
						Hosted by Me
					</button>
					<button
						onClick={() => setFilterTab('all')}
						className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
							filterTab === 'all'
								? 'bg-brand-primary text-text-inverse shadow-md'
								: 'bg-bg-surface-hover/60 text-text-muted hover:text-text-primary'
						}`}
					>
						All Scheduled
					</button>
				</div>

				<div className="relative w-full sm:w-72">
					<span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-text-muted">
						<SearchIcon size={16} />
					</span>
					<input
						type="text"
						placeholder="Search by title or code..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="w-full pl-9 pr-4 py-2 bg-bg-input border border-border-default rounded-xl text-xs placeholder:text-text-subtle text-text-primary focus:outline-none focus:border-border-brand"
					/>
				</div>
			</div>

			{/* Meetings List / Grid */}
			{loading ? (
				<div className="p-12 text-center text-text-muted space-y-2">
					<div className="h-8 w-8 rounded-full border-2 border-brand-primary border-t-transparent animate-spin mx-auto" />
					<p className="text-xs font-medium">Loading scheduled meetings...</p>
				</div>
			) : filteredMeetings.length === 0 ? (
				<Card className="p-12 text-center bg-bg-surface border border-border-default rounded-2xl max-w-xl mx-auto space-y-4 shadow-md gap-0">
					<div className="h-14 w-14 rounded-2xl bg-brand-primary/10 border border-border-brand/20 text-text-brand flex items-center justify-center mx-auto text-2xl">
						<CalendarIcon size={28} />
					</div>
					<h2 className="text-xl font-bold text-text-primary">No Scheduled Meetings Found</h2>
					<p className="text-sm text-text-muted leading-relaxed">
						{searchQuery
							? "No meetings matched your search criteria."
							: filterTab === 'upcoming'
							? "You have no upcoming scheduled meetings right now."
							: "No meeting records found."}
					</p>
					<Button
						onClick={() => setShowScheduleModal(true)}
						className="px-6 py-2.5 bg-gradient-to-r from-brand-primary to-brand-secondary text-text-inverse font-medium text-sm rounded-xl shadow-lg shadow-brand-primary/20 transition-all cursor-pointer mx-auto"
					>
						Schedule a Meeting Now
					</Button>
				</Card>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{filteredMeetings.map((m) => {
						const isHost = m.host?._id === user?.id || m.host === user?.id
						const hostName = m.host?.name || m.host?.email || 'Host'
						const formattedTime = new Date(m.startTime).toLocaleString([], {
							weekday: 'short',
							month: 'short',
							day: 'numeric',
							hour: '2-digit',
							minute: '2-digit'
						})

						const participantCount = m.participants?.length || 1

						return (
							<Card
								key={m._id}
								className="border border-border-default bg-bg-surface rounded-2xl overflow-hidden shadow-md flex flex-col justify-between hover:border-border-brand/40 transition-all group gap-0 p-0"
							>
								<CardHeader className="p-5 border-b border-border-subtle bg-bg-surface-hover/30 space-y-2">
									<div className="flex items-start justify-between gap-2">
										<span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${
											isHost
												? 'bg-brand-primary/10 text-text-brand border border-border-brand/20'
												: 'bg-brand-secondary/10 text-brand-secondary border border-brand-secondary/20'
										}`}>
											{isHost ? 'Host' : 'Invited Attendee'}
										</span>
										<span className="text-[11px] font-mono text-text-muted uppercase">
											{m.meetingCode}
										</span>
									</div>
									<CardTitle className="font-bold text-base text-text-primary line-clamp-1 group-hover:text-text-brand transition-colors">
										{m.title}
									</CardTitle>
									{m.description && (
										<CardDescription className="text-xs text-text-muted line-clamp-2">
											{m.description}
										</CardDescription>
									)}
								</CardHeader>

								<CardContent className="p-5 space-y-4 flex-1 flex flex-col justify-between">
									<div className="space-y-3">
										<div className="flex items-center gap-2 text-xs text-text-brand font-medium">
											<ClockIcon size={14} />
											<span>{formattedTime}</span>
										</div>

										<div className="flex items-center justify-between text-xs text-text-muted border-t border-border-subtle pt-3">
											<span className="truncate">Organized by: <strong className="text-text-primary font-semibold">{hostName}</strong></span>
											<span className="flex items-center gap-1 shrink-0 font-medium text-text-secondary">
												<UsersIcon size={14} />
												{participantCount} {participantCount === 1 ? 'person' : 'people'}
											</span>
										</div>
									</div>

									<div className="pt-2 flex items-center gap-2">
										<Button
											onClick={() => navigate(`/meetings/${m.meetingCode}`)}
											className="flex-1 py-2 bg-gradient-to-r from-brand-primary to-brand-secondary hover:from-brand-primary-hover hover:to-brand-secondary text-text-inverse font-medium text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
										>
											<VideoIcon size={14} />
											Join Room
										</Button>

										<Button
											variant="outline"
											size="icon-sm"
											onClick={() => copyMeetingLink(m.meetingCode)}
											className="p-2 border border-border-default bg-bg-surface-hover/40 hover:bg-bg-surface-hover text-text-muted hover:text-text-primary rounded-xl transition-all cursor-pointer shrink-0"
											title="Copy room link"
										>
											{copiedCode === m.meetingCode ? (
												<CheckIcon size={16} className="text-status-success" />
											) : (
												<CopyIcon size={16} />
											)}
										</Button>
									</div>
								</CardContent>
							</Card>
						)
					})}
				</div>
			)}

			{/* Schedule Meeting Modal Dialog */}
			{showScheduleModal && (
				<div
					className="fixed inset-0 bg-bg-overlay backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
					role="dialog"
					aria-modal="true"
					aria-labelledby="schedule-modal-title"
				>
					<div className="w-full max-w-xl bg-bg-modal border border-border-default rounded-2xl shadow-2xl p-6 relative overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
						<div className="flex items-center justify-between border-b border-border-subtle pb-4 mb-5">
							<div className="flex items-center gap-2.5">
								<div className="h-8 w-8 rounded-xl bg-brand-primary/10 border border-border-brand/20 flex items-center justify-center text-text-brand">
									<CalendarIcon size={18} />
								</div>
								<h3 id="schedule-modal-title" className="text-lg font-bold text-text-primary">
									Schedule a Virtual Meeting
								</h3>
							</div>
							<button
								onClick={() => setShowScheduleModal(false)}
								className="p-1.5 text-text-muted hover:text-text-primary rounded-lg transition-colors cursor-pointer"
								aria-label="Close schedule modal"
							>
								<CloseIcon size={18} />
							</button>
						</div>

						<form onSubmit={handleScheduleSubmit} className="space-y-4">
							{/* Subject / Title */}
							<div>
								<Label htmlFor="sched-title" className="text-xs font-semibold text-text-secondary block mb-1.5">
									Meeting Title <span className="text-status-danger">*</span>
								</Label>
								<Input
									id="sched-title"
									type="text"
									required
									placeholder="e.g. Q3 Sprint Planning & AI Demo"
									value={title}
									onChange={(e) => setTitle(e.target.value)}
									className="w-full bg-bg-input border-border-default text-text-primary text-sm rounded-xl px-4 py-2 focus-visible:border-border-brand"
								/>
							</div>

							{/* Description */}
							<div>
								<Label htmlFor="sched-desc" className="text-xs font-semibold text-text-secondary block mb-1.5">
									Agenda / Description
								</Label>
								<textarea
									id="sched-desc"
									rows={2}
									placeholder="Brief agenda topics or notes..."
									value={description}
									onChange={(e) => setDescription(e.target.value)}
									className="w-full bg-bg-input border border-border-default text-text-primary text-xs rounded-xl p-3 focus:outline-none focus:border-border-brand"
								/>
							</div>

							{/* Date & Time Selector */}
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
								<div>
									<Label htmlFor="sched-time" className="text-xs font-semibold text-text-secondary block mb-1.5">
										Date & Start Time <span className="text-status-danger">*</span>
									</Label>
									<Input
										id="sched-time"
										type="datetime-local"
										required
										value={startTime}
										onChange={(e) => setStartTime(e.target.value)}
										className="w-full bg-bg-input border-border-default text-text-primary text-xs rounded-xl px-4 py-2 focus-visible:border-border-brand"
									/>
								</div>

								<div>
									<Label htmlFor="sched-passcode" className="text-xs font-semibold text-text-secondary block mb-1.5">
										Room Passcode (Optional)
									</Label>
									<Input
										id="sched-passcode"
										type="text"
										placeholder="e.g. 123456"
										value={passcode}
										onChange={(e) => setPasscode(e.target.value)}
										className="w-full bg-bg-input border-border-default text-text-primary text-xs rounded-xl px-4 py-2 focus-visible:border-border-brand"
									/>
								</div>
							</div>

							{/* Private Meeting Toggle */}
							<div className="flex items-center justify-between p-3 bg-bg-app border border-border-subtle rounded-xl">
								<div>
									<Label htmlFor="sched-private" className="text-xs font-semibold text-text-primary block cursor-pointer">
										Private Meeting Room
									</Label>
									<p className="text-[11px] text-text-muted">Only invited attendees and team members can enter.</p>
								</div>
								<input
									id="sched-private"
									type="checkbox"
									checked={isPrivate}
									onChange={(e) => setIsPrivate(e.target.checked)}
									className="h-4 w-4 rounded border-border-default text-brand-primary focus:ring-brand-primary cursor-pointer"
								/>
							</div>

							{/* Invite Mode Selector: Individuals vs Team */}
							<div className="pt-2">
								<Label className="text-xs font-semibold text-text-secondary block mb-2">
									Invite Attendees & Send Real-Time Notifications
								</Label>

								<div className="grid grid-cols-2 gap-3 mb-3">
									<button
										type="button"
										onClick={() => setInviteMode('individuals')}
										className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
											inviteMode === 'individuals'
												? 'bg-brand-primary/10 border-border-brand text-text-brand shadow-sm'
												: 'bg-bg-input border-border-default text-text-muted hover:text-text-primary'
										}`}
									>
										<UsersIcon size={16} />
										Select Individuals
									</button>
									<button
										type="button"
										onClick={() => setInviteMode('team')}
										className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
											inviteMode === 'team'
												? 'bg-brand-secondary/10 border-brand-secondary text-brand-secondary shadow-sm'
												: 'bg-bg-input border-border-default text-text-muted hover:text-text-primary'
										}`}
									>
										🏢 Select Team Workspace
									</button>
								</div>

								{/* Mode A: Select Individual Registered Users */}
								{inviteMode === 'individuals' && (
									<div className="space-y-3 p-3 bg-bg-app border border-border-subtle rounded-xl">
										<div className="relative">
											<span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-text-muted">
												<SearchIcon size={14} />
											</span>
											<Input
												type="text"
												placeholder="Search colleagues by name or email..."
												value={userSearchQuery}
												onChange={(e) => setUserSearchQuery(e.target.value)}
												className="w-full pl-9 bg-bg-input border-border-default text-xs text-text-primary rounded-xl"
											/>
											{searchingUsers && (
												<span className="absolute inset-y-0 right-0 flex items-center pr-3 text-[10px] text-text-muted">
													Searching...
												</span>
											)}
										</div>

										{/* Search Results Dropdown */}
										{userSearchResults.length > 0 && (
											<div className="max-h-36 overflow-y-auto border border-border-default bg-bg-dropdown rounded-xl divide-y divide-border-subtle shadow-lg">
												{userSearchResults.map((u) => (
													<button
														key={u._id}
														type="button"
														onClick={() => handleAddUser(u)}
														className="w-full p-2.5 flex items-center justify-between hover:bg-bg-surface-hover text-left transition-colors cursor-pointer"
													>
														<div className="flex items-center gap-2">
															<div className="h-6 w-6 rounded-full bg-brand-primary/20 text-text-brand text-[10px] font-bold flex items-center justify-center">
																{u.name ? u.name[0].toUpperCase() : u.email[0].toUpperCase()}
															</div>
															<div>
																<p className="text-xs font-semibold text-text-primary">{u.name || 'User'}</p>
																<p className="text-[10px] text-text-muted">{u.email}</p>
															</div>
														</div>
														<span className="text-[10px] text-text-brand font-medium">+ Add</span>
													</button>
												))}
											</div>
										)}

										{/* Selected Users Chips */}
										<div className="flex flex-wrap gap-2 pt-1">
											{selectedUsers.length === 0 ? (
												<span className="text-[11px] text-text-subtle">No individual attendees selected yet.</span>
											) : (
												selectedUsers.map((u) => (
													<span
														key={u._id}
														className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-brand-primary/10 border border-border-brand/20 rounded-full text-xs font-medium text-text-brand"
													>
														<span>{u.name || u.email}</span>
														<button
															type="button"
															onClick={() => handleRemoveUser(u._id)}
															className="hover:text-status-danger text-text-muted cursor-pointer"
														>
															<CloseIcon size={12} />
														</button>
													</span>
												))
											)}
										</div>
									</div>
								)}

								{/* Mode B: Select Team Workspace */}
								{inviteMode === 'team' && (
									<div className="space-y-2 p-3 bg-bg-app border border-border-subtle rounded-xl">
										{workspaces.length === 0 ? (
											<p className="text-xs text-text-muted py-2">
												No Team Workspaces found. You can create a workspace in the <strong>Team Workspace</strong> tab.
											</p>
										) : (
											<div>
												<select
													value={selectedWorkspaceId}
													onChange={(e) => setSelectedWorkspaceId(e.target.value)}
													className="w-full p-2.5 bg-bg-input border border-border-default rounded-xl text-xs text-text-primary focus:outline-none focus:border-border-brand font-medium"
												>
													<option value="">-- Choose a Team Workspace --</option>
													{workspaces.map((w) => (
														<option key={w._id} value={w._id}>
															🏢 {w.name} ({w.members?.length || 1} team members)
														</option>
													))}
												</select>
												{selectedWorkspaceObj && (
													<p className="text-[11px] text-status-success font-medium mt-2">
														✓ All {selectedWorkspaceObj.members?.length || 1} team members will receive in-app notifications.
													</p>
												)}
											</div>
										)}
									</div>
								)}
							</div>

							{/* Actions */}
							<div className="flex items-center justify-end gap-3 pt-4 border-t border-border-subtle">
								<Button
									type="button"
									variant="outline"
									onClick={() => setShowScheduleModal(false)}
									className="px-4 py-2 border border-border-default bg-bg-surface-hover/30 hover:bg-bg-surface-hover text-text-secondary font-medium text-xs rounded-xl transition-all cursor-pointer"
								>
									Cancel
								</Button>
								<Button
									type="submit"
									disabled={submitting || !title.trim()}
									className="px-6 py-2 bg-gradient-to-r from-brand-primary to-brand-secondary hover:from-brand-primary-hover hover:to-brand-secondary text-text-inverse font-medium text-xs rounded-xl shadow-lg shadow-brand-primary/25 transition-all cursor-pointer disabled:opacity-50"
								>
									{submitting ? 'Scheduling...' : 'Schedule & Notify Attendees'}
								</Button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	)
}
