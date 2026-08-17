"use no memo";

import { useState, useEffect } from "react"
import { useNavigate } from "react-router"
import { useAuthStore } from "../store/useAuthStore"
import { api } from "../lib/api"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"

import {
	VideoIcon,
	CalendarIcon,
	CopyIcon,
	CheckIcon,
	SparklesIcon
} from "../lib/icons"

export default function Dashboard() {
	const navigate = useNavigate()
	const [time, setTime] = useState(new Date())
	const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
	const { user } = useAuthStore()

	const [showMeetingModal, setShowMeetingModal] = useState(false)
	const [meetingCode, setMeetingCode] = useState("")
	const [joinCodeInput, setJoinCodeInput] = useState("")
	const [loadingMeeting, setLoadingMeeting] = useState(false)

	useEffect(() => {
		const timer = setInterval(() => setTime(new Date()), 1000)
		return () => clearInterval(timer)
	}, [])

	const getFirstName = (name?: string) => {
		if (!name) return "User";
		return name.trim().split(/\s+/)[0];
	};

	const copyToClipboard = (text: string, index: number) => {
		navigator.clipboard.writeText(text)
		setCopiedIndex(index)
		setTimeout(() => setCopiedIndex(null), 2000)
	}

	const buildMeetingUrl = (code: string) => {
		return `/meetings/${code}`;
	};

	const handleStartMeeting = async () => {
		setLoadingMeeting(true)
		try {
			const res = await api.post("/meetings", {
				title: "Instant Meeting",
				startTime: new Date().toISOString(),
				isPrivate: false,
				isInstant: true
			})
			const code = res.data.meeting.meetingCode
			setMeetingCode(code)
			setShowMeetingModal(true)
		} catch (err) {
			console.error("Error starting meeting:", err)
			alert("Failed to start meeting. Please try again.")
		} finally {
			setLoadingMeeting(false)
		}
	}

	const handleJoinCode = () => {
		if (!joinCodeInput.trim()) return;
		let code = joinCodeInput.trim();
		if (code.includes("/meetings/")) {
			code = code.split("/meetings/")[1].split("?")[0];
		}
		navigate(buildMeetingUrl(code));
	}

	const formatTime = (date: Date) => {
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
	}

	const formatDate = (date: Date) => {
		return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })
	}

	const upcomingMeetings: any[] = []

	return (
		<>
			{/* Welcome Screen & Info Banner */}
			<section className="relative overflow-hidden rounded-2xl border border-border-default bg-bg-surface/80 p-5 sm:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
				<div className="absolute inset-0 bg-gradient-to-r from-brand-primary/5 via-brand-secondary/5 to-transparent pointer-events-none" />

				<div className="space-y-2 relative z-10">
					<div className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-brand-primary/10 to-brand-secondary/10 border border-border-brand/20 rounded-full text-xs font-semibold text-text-brand">
						IntellMeet Workspace
					</div>
					<h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text-primary">
						Welcome Back, {getFirstName(user?.name)}!
					</h2>
					<p className="text-text-muted text-sm max-w-xl">
						Ready for today's collaborations? Check your agenda below or jump straight into a new meeting room.
					</p>
				</div>

				{/* Time / Date widget */}
				<div className="bg-bg-surface-hover/60 border border-border-default rounded-2xl p-4 flex flex-col justify-center items-start md:items-end text-left md:text-right min-w-[200px] backdrop-blur-md relative z-10">
					<span className="text-2xl font-bold font-mono tracking-wider text-text-primary">{formatTime(time)}</span>
					<span className="text-xs font-medium text-text-brand mt-1 uppercase tracking-wider">{formatDate(time)}</span>
				</div>
			</section>

			{/* Virtual Meeting Hub (Start / Join Room) */}
			<section className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">

				{/* Quick Actions Card: Start / Join meeting */}
				<Card className="lg:col-span-2 border border-border-default bg-bg-surface rounded-2xl overflow-hidden flex flex-col shadow-md gap-0 p-0">
					<CardHeader className="p-4 sm:p-6 border-b border-border-subtle bg-bg-surface-hover/40 flex flex-row items-center justify-between">
						<div>
							<CardTitle className="font-bold text-base sm:text-lg text-text-primary">Virtual Meeting Hub</CardTitle>
							<CardDescription className="text-xs text-text-muted mt-0.5">Start an instant meeting or join an existing session with a code</CardDescription>
						</div>
						<div className="h-8 w-8 rounded-lg bg-brand-primary/10 border border-border-brand/20 flex items-center justify-center shrink-0">
							<VideoIcon className="text-text-brand h-4 w-4" />
						</div>
					</CardHeader>

					<CardContent className="p-4 sm:p-6 flex-1 flex flex-col justify-between">
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

							{/* Part 1: Start Virtual Meet */}
							<div className="flex flex-col justify-between bg-bg-app border border-border-subtle rounded-xl p-5 hover:border-border-brand/30 transition-all">
								<div className="space-y-3">
									<div className="h-10 w-10 rounded-xl bg-brand-primary/10 border border-border-brand/20 flex items-center justify-center text-text-brand">
										<VideoIcon size={20} />
									</div>
									<div>
										<h3 className="text-sm font-bold text-text-primary">Instant Meeting</h3>
										<p className="text-xs text-text-muted mt-1 leading-relaxed">
											Start an instant video meeting and invite team members or clients with a single click.
										</p>
									</div>
								</div>

								<div className="pt-5">
									<Button
										onClick={handleStartMeeting}
										disabled={loadingMeeting}
										aria-label="Start Virtual Meet"
										className="w-full py-2.5 h-10 rounded-xl bg-gradient-to-r from-brand-primary to-brand-secondary hover:from-brand-primary-hover hover:to-brand-secondary text-text-inverse font-medium text-xs sm:text-sm shadow-lg shadow-brand-primary/20 hover:shadow-brand-primary/30 transition-all duration-300 transform active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
									>
										<VideoIcon size={16} />
										{loadingMeeting ? "Creating..." : "Start Virtual Meet"}
									</Button>
								</div>
							</div>

							{/* Part 2: Join Meeting via Code */}
							<div className="flex flex-col justify-between bg-bg-app border border-border-subtle rounded-xl p-5 hover:border-border-brand/30 transition-all">
								<div className="space-y-3">
									<div className="h-10 w-10 rounded-xl bg-brand-secondary/10 border border-border-brand/20 flex items-center justify-center text-text-brand">
										<SparklesIcon size={20} />
									</div>
									<div>
										<h3 className="text-sm font-bold text-text-primary">Join via Code</h3>
										<p className="text-xs text-text-muted mt-1 leading-relaxed">
											Have a meeting code or invitation link? Enter it below to join the room instantly.
										</p>
									</div>

									<div className="pt-1">
										<Label htmlFor="meeting-code-input" className="text-[11px] font-semibold text-text-muted uppercase tracking-wider block mb-1.5">Meeting Code / Link</Label>
										<Input
											id="meeting-code-input"
											type="text"
											placeholder="e.g. abc-defg-hij"
											value={joinCodeInput}
											onChange={(e) => setJoinCodeInput(e.target.value)}
											onKeyDown={(e) => e.key === 'Enter' && handleJoinCode()}
											aria-label="Meeting code or URL"
											className="w-full px-3.5 py-2 bg-bg-input border-border-default rounded-xl text-xs placeholder:text-text-subtle text-text-primary focus-visible:border-border-brand transition-all"
										/>
									</div>
								</div>

								<div className="pt-4">
									<Button
										variant="outline"
										onClick={handleJoinCode}
										aria-label="Join Meeting"
										className="w-full py-2.5 h-10 rounded-xl border border-border-default bg-bg-surface-hover/30 hover:bg-bg-surface-hover hover:border-border-strong text-text-primary font-medium text-xs sm:text-sm transition-all duration-300 transform active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
									>
										Join Meeting
									</Button>
								</div>
							</div>

						</div>
					</CardContent>
				</Card>

				{/* Upcoming meetings card */}
				<Card className="border border-border-default bg-bg-surface rounded-2xl overflow-hidden flex flex-col shadow-md gap-0 p-0">
					<CardHeader className="p-4 sm:p-6 border-b border-border-subtle bg-bg-surface-hover/40 flex flex-row items-center justify-between">
						<div>
							<CardTitle className="font-bold text-base sm:text-lg text-text-primary">Upcoming Agenda</CardTitle>
							<CardDescription className="text-xs text-text-muted mt-0.5">Your scheduled meetings for today</CardDescription>
						</div>
						<div className="h-8 w-8 rounded-lg bg-brand-primary/10 border border-border-brand/20 flex items-center justify-center shrink-0">
							<CalendarIcon className="text-text-brand h-4 w-4" />
						</div>
					</CardHeader>

					<CardContent className="p-4 sm:p-6 flex-1 flex flex-col justify-between">
						<div className="space-y-4">
							{upcomingMeetings.length === 0 ? (
								<div className="text-center py-8 text-text-muted space-y-2">
									<div className="h-10 w-10 rounded-xl bg-bg-surface-hover flex items-center justify-center mx-auto text-text-muted">
										<CalendarIcon />
									</div>
									<p className="text-xs font-medium">No upcoming meetings scheduled</p>
									<p className="text-[11px] text-text-subtle">Start an instant meeting above or schedule one for later.</p>
								</div>
							) : null}
						</div>

						<Button
							variant="outline"
							className="w-full py-2.5 px-4 mt-6 rounded-xl border border-border-default bg-bg-surface-hover/30 hover:bg-bg-surface-hover text-text-secondary font-medium text-xs tracking-wide transition-all uppercase cursor-pointer flex items-center justify-center gap-1.5"
						>
							<CalendarIcon size={14} />
							View Calendar Agenda
						</Button>
					</CardContent>
				</Card>

			</section>

			{/* Meeting Room Started Popup Modal */}
			{
				showMeetingModal && (
					<div
						className="fixed inset-0 bg-bg-overlay backdrop-blur-sm z-50 flex items-center justify-center p-4"
						role="dialog"
						aria-modal="true"
						aria-labelledby="meeting-modal-title"
					>
						<Card className="w-full max-w-md bg-bg-modal border border-border-default rounded-2xl shadow-2xl p-6 relative overflow-hidden animate-in fade-in zoom-in-95 duration-200 gap-0">
							<div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-brand-primary/10 blur-3xl pointer-events-none" />

							<div className="flex flex-col items-center text-center space-y-4">
								<div className="h-14 w-14 rounded-2xl bg-brand-primary/10 border border-border-brand/20 flex items-center justify-center text-text-brand shadow-lg shadow-brand-primary/10">
									<SparklesIcon size={24} />
								</div>

								<div className="space-y-1">
									<h3 id="meeting-modal-title" className="text-lg font-bold text-text-primary">Your Meeting is Ready!</h3>
									<p className="text-xs text-text-muted">Share this code to invite other participants to join you</p>
								</div>

								{/* Link copying box */}
								<div className="w-full p-3 bg-bg-app border border-border-default rounded-xl flex items-center justify-between gap-3">
									<span className="text-xs text-text-brand select-all truncate font-mono">{meetingCode}</span>
									<Button
										variant="ghost"
										size="icon-sm"
										onClick={() => copyToClipboard(meetingCode, 0)}
										aria-label="Copy meeting code"
										className="hover:bg-bg-surface-hover rounded-lg text-text-muted hover:text-text-primary transition-colors cursor-pointer"
										title="Copy meeting code"
									>
										{copiedIndex === 0 ? <CheckIcon className="text-status-success" /> : <CopyIcon />}
									</Button>
								</div>

								<div className="w-full grid grid-cols-2 gap-3 pt-3">
									<Button
										variant="outline"
										onClick={() => setShowMeetingModal(false)}
										className="w-full py-2 border border-border-default bg-bg-surface-hover/30 hover:bg-bg-surface-hover rounded-xl text-text-secondary font-medium text-xs tracking-wide transition-all cursor-pointer"
									>
										Close Settings
									</Button>
									<Button
										onClick={() => navigate(buildMeetingUrl(meetingCode))}
										className="w-full py-2 bg-gradient-to-r from-brand-primary to-brand-secondary hover:from-brand-primary-hover hover:to-brand-secondary text-text-inverse rounded-xl font-medium text-xs tracking-wide shadow-lg shadow-brand-primary/25 transition-all cursor-pointer"
									>
										Enter Room
									</Button>
								</div>
							</div>
						</Card>
					</div>
				)
			}
		</>
	)
}
