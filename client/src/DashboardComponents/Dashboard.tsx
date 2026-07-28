"use no memo";

import { useState, useEffect } from "react"
import { useNavigate } from "react-router"
import { useAuthStore } from "../store/useAuthStore"
import { api } from "../lib/api"

import {
	VideoIcon,
	MicIcon,
	CalendarIcon,
	ScreenShareIcon,
	CopyIcon,
	CheckIcon,
	SparklesIcon
} from "../lib/icons"

export default function Dashboard() {
	const navigate = useNavigate()
	const [time, setTime] = useState(new Date())
	const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
	const { user } = useAuthStore()

	const [isMuted, setIsMuted] = useState(false)
	const [isCamOff, setIsCamOff] = useState(false)
	const [showMeetingModal, setShowMeetingModal] = useState(false)
	const [meetingCode, setMeetingCode] = useState("")
	const [joinCodeInput, setJoinCodeInput] = useState("")
	const [loadingMeeting, setLoadingMeeting] = useState(false)

	const meetingLink = `${window.location.origin}/meetings/${meetingCode}`

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

	const handleStartMeeting = async () => {
		setLoadingMeeting(true)
		try {
			const res = await api.post("/meetings", {
				title: "Instant Meeting",
				startTime: new Date().toISOString(),
				isPrivate: false
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
		} else if (code.includes("/m/")) {
			code = code.split("/m/")[1].split("?")[0];
		}
		navigate(`/meetings/${code}?audio=${!isMuted}&video=${!isCamOff}`);
	}

	const formatTime = (date: Date) => {
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
	}

	const formatDate = (date: Date) => {
		return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })
	}

	const upcomingMeetings: any[] = [
	]


	return (
		<>
			{/* Welcome Screen & Info */}
			<section className="relative overflow-hidden rounded-2xl border border-slate-900 bg-slate-950/40 p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
				<div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-violet-500/5 to-transparent pointer-events-none" />

				<div className="space-y-2 relative z-10">
					<div className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-indigo-500/10 to-violet-500/10 border border-indigo-500/10 rounded-full text-xs font-semibold text-indigo-300">
						<SparklesIcon size={14} className="text-indigo-400" />
						Intelligent Workspace Active
					</div>
					<h2 className="text-3xl font-extrabold tracking-tight text-white">
						Welcome Back, {getFirstName(user?.name)}!
					</h2>
					<p className="text-slate-400 text-sm max-w-xl">
						Ready for today's collaborations? Check your agenda below or jump straight into a new meeting room.
					</p>
				</div>

				{/* Time / Date widget */}
				<div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-center items-end text-right min-w-[220px] backdrop-blur-md relative z-10">
					<span className="text-2xl font-bold font-mono tracking-wider text-slate-100">{formatTime(time)}</span>
					<span className="text-xs font-medium text-indigo-400 mt-1 uppercase tracking-wider">{formatDate(time)}</span>
				</div>
			</section>

			{/* Virtual Meeting Hub (Start / Join Room) */}
			<section className="grid grid-cols-1 lg:grid-cols-3 gap-8">

				{/* Quick Actions Card: Start instant meeting */}
				<div className="lg:col-span-2 border border-slate-900 bg-slate-950/40 rounded-2xl overflow-hidden flex flex-col">
					<div className="p-6 border-b border-slate-900 bg-slate-950/60 flex items-center justify-between">
						<div>
							<h3 className="font-bold text-lg text-white">Start a Virtual Meeting</h3>
							<p className="text-xs text-slate-500">Launch an instant meeting or join an ongoing conversation</p>
						</div>
						<div className="h-8 w-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
							<VideoIcon className="text-indigo-400 h-4 w-4" />
						</div>
					</div>

					<div className="p-6 flex-1 flex flex-col md:flex-row gap-8">

						{/* Visual Settings Preview */}
						<div className="flex-1 flex flex-col justify-between bg-slate-900/30 border border-slate-900/80 rounded-xl p-5">
							<div className="space-y-4">
								<span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Meeting Room Settings</span>

								{/* Fake Camera Preview Box */}
								<div className="aspect-video bg-slate-950/80 rounded-lg flex flex-col items-center justify-center border border-slate-900 relative overflow-hidden group">
									{isCamOff ? (
										<div className="text-center space-y-1">
											<div className="h-8 w-8 rounded-full bg-slate-900 flex items-center justify-center mx-auto text-slate-500">
												<VideoIcon />
											</div>
											<span className="text-[11px] text-slate-500 font-medium">Camera is turned off</span>
										</div>
									) : (
										<>
											<div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 to-transparent z-10" />
											{/* Ambient pattern for webcam mock */}
											<div className="absolute inset-0 opacity-40 bg-[radial-gradient(#4f46e5_1px,transparent_1px)] [background-size:16px_16px]" />
											<div className="absolute inset-0 flex items-center justify-center z-0">
												<div className="h-16 w-16 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center animate-pulse">
													<SparklesIcon className="text-indigo-400" size={24} />
												</div>
											</div>
											<span className="absolute bottom-2.5 left-3 text-[10px] font-semibold text-emerald-400 flex items-center gap-1.5 z-20">
												<span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
												Live Camera Feed
											</span>
										</>
									)}
								</div>

								{/* Camera and Microphone quick controls */}
								<div className="flex justify-center gap-4">
									<button
										onClick={() => setIsMuted(!isMuted)}
										className={`p-2.5 rounded-xl border transition-all cursor-pointer ${isMuted
											? "bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20"
											: "bg-slate-950/50 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-950"
											}`}
										title={isMuted ? "Unmute Mic" : "Mute Mic"}
									>
										<MicIcon />
									</button>
									<button
										onClick={() => setIsCamOff(!isCamOff)}
										className={`p-2.5 rounded-xl border transition-all cursor-pointer ${isCamOff
											? "bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20"
											: "bg-slate-950/50 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-950"
											}`}
										title={isCamOff ? "Turn Cam On" : "Turn Cam Off"}
									>
										<VideoIcon />
									</button>
								</div>
							</div>

							<div className="mt-4 pt-4 border-t border-slate-900 flex justify-between text-xs text-slate-500">
								<span>Microphone: Default Input</span>
								<span>Camera: Facetime HD</span>
							</div>
						</div>

						{/* Meeting options pane */}
						<div className="flex-1 flex flex-col justify-between space-y-6">
							<div className="space-y-4">
								<h4 className="text-sm font-semibold text-slate-200">Start / Join Live Room</h4>

								{/* Quick inputs */}
								<div className="space-y-3">
									<div>
										<label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Meeting Code / URL</label>
										<input
											type="text"
											placeholder="e.g. xrt-vdwq-jhz"
											value={joinCodeInput}
											onChange={(e) => setJoinCodeInput(e.target.value)}
											onKeyDown={(e) => e.key === 'Enter' && handleJoinCode()}
											className="w-full px-4 py-2 bg-slate-950/50 border border-slate-800 rounded-xl text-sm placeholder:text-slate-700 text-slate-200 focus:outline-none focus:border-indigo-500 transition-all"
										/>
									</div>
								</div>
							</div>

							<div className="space-y-3">
								<button
									onClick={handleStartMeeting}
									disabled={loadingMeeting}
									className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-medium text-sm shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all duration-300 transform active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
								>
									<VideoIcon size={16} />
									{loadingMeeting ? "Creating..." : "Start Instant Meeting"}
								</button>

								<button
									onClick={handleJoinCode}
									className="w-full py-2.5 px-4 rounded-xl border border-slate-800 bg-slate-900/30 hover:bg-slate-900/60 hover:border-slate-700 text-slate-200 font-medium text-sm transition-all duration-300 transform active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
								>
									Join via Code
								</button>
							</div>
						</div>

					</div>
				</div>

				{/* Upcoming meetings card */}
				<div className="border border-slate-900 bg-slate-950/40 rounded-2xl overflow-hidden flex flex-col">
					<div className="p-6 border-b border-slate-900 bg-slate-950/60 flex items-center justify-between">
						<div>
							<h3 className="font-bold text-lg text-white">Upcoming Agenda</h3>
							<p className="text-xs text-slate-500">Your scheduled meetings for today</p>
						</div>
						<div className="h-8 w-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
							<CalendarIcon className="text-indigo-400 h-4 w-4" />
						</div>
					</div>

					<div className="p-6 flex-1 flex flex-col justify-between">
						<div className="space-y-4">
							{upcomingMeetings.length > 0 ?
								(
									upcomingMeetings.map((mtg) => (
										<div
											key={mtg.id}
											className={`p-3.5 rounded-xl border transition-all duration-200 ${mtg.active
												? "bg-indigo-600/5 border-indigo-500/20 shadow-md shadow-indigo-500/[0.02]"
												: "bg-slate-900/20 border-slate-900 hover:border-slate-800/80"
												}`}
										>
											<div className="flex justify-between items-start mb-1.5">
												<span className="font-semibold text-sm text-slate-200 line-clamp-1">{mtg.title}</span>
												{mtg.active && (
													<span className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-[9px] font-bold text-indigo-400 tracking-wide uppercase">
														Now
													</span>
												)}
											</div>

											<div className="flex items-center justify-between text-xs text-slate-500">
												<span>{mtg.time}</span>
												<span className="font-medium text-slate-400">{mtg.organizer}</span>
											</div>
										</div>
									))
								)
								: (
									< p className="text-lg text-slate-500 text-center">No upcoming meetings</p>
								)
							}
						</div>

						<button className="w-full py-2.5 px-4 mt-6 rounded-xl border border-slate-800/80 bg-slate-900/30 hover:bg-slate-900/60 text-slate-300 font-medium text-xs tracking-wide transition-all uppercase cursor-pointer flex items-center justify-center gap-1.5">
							<CalendarIcon size={14} />
							View Calendar Agenda
						</button>
					</div>
				</div>

			</section >

			{/* Productivity widgets / Platform stats */}
			< section className="grid grid-cols-1 md:grid-cols-3 gap-6" >

				<div className="p-5 border border-slate-900 bg-slate-950/40 rounded-2xl flex items-center gap-4">
					<div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
						<VideoIcon />
					</div>
					<div>
						<p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Meetings</p>
						<p className="text-xl font-bold text-slate-200">12 hrs 40 mins</p>
					</div>
				</div>

				<div className="p-5 border border-slate-900 bg-slate-950/40 rounded-2xl flex items-center gap-4">
					<div className="h-10 w-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
						<ScreenShareIcon />
					</div>
					<div>
						<p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Presentations Shared</p>
						<p className="text-xl font-bold text-slate-200">4 Sessions</p>
					</div>
				</div>

				<div className="p-5 border border-slate-900 bg-slate-950/40 rounded-2xl flex items-center gap-4">
					<div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
						<SparklesIcon />
					</div>
					<div>
						<p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Audio Quality Score</p>
						<p className="text-xl font-bold text-slate-200">99.8% Perfect</p>
					</div>
				</div>

			</section >

			{/* Mock Meeting Room Started Popup Modal */}
			{
				showMeetingModal && (
					<div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
						<div className="w-full max-w-md bg-slate-950 border border-slate-900 rounded-2xl shadow-2xl p-6 relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
							<div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-indigo-500/5 blur-3xl pointer-events-none" />

							<div className="flex flex-col items-center text-center space-y-4">
								<div className="h-14 w-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-lg shadow-indigo-600/10">
									<SparklesIcon size={24} />
								</div>

								<div className="space-y-1">
									<h3 className="text-lg font-bold text-white">Your Meeting is Ready!</h3>
									<p className="text-xs text-slate-400">Share this link to invite other participants to join you</p>
								</div>

								{/* Link copying box */}
								<div className="w-full p-3 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center justify-between gap-3">
									<span className="text-xs text-indigo-300 select-all truncate font-mono">{meetingLink}</span>
									<button
										onClick={() => copyToClipboard(meetingLink, 0)}
										className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
										title="Copy meeting link"
									>
										{copiedIndex === 0 ? <CheckIcon className="text-emerald-400" /> : <CopyIcon />}
									</button>
								</div>

								<div className="w-full grid grid-cols-2 gap-3 pt-3">
									<button
										onClick={() => setShowMeetingModal(false)}
										className="w-full py-2 border border-slate-800 bg-slate-900/20 hover:bg-slate-900/60 rounded-xl text-slate-300 font-medium text-xs tracking-wide transition-all cursor-pointer"
									>
										Close Settings
									</button>
									<button
										onClick={() => navigate(`/meetings/${meetingCode}?audio=${!isMuted}&video=${!isCamOff}`)}
										className="w-full py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl font-medium text-xs tracking-wide shadow-lg shadow-indigo-600/25 transition-all cursor-pointer"
									>
										Enter Room
									</button>
								</div>
							</div>
						</div>
					</div>
				)
			}
		</>
	)
}
