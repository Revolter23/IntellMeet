"use no memo";

import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router"
import { useAuthStore } from "../store/useAuthStore"
import { api } from "../lib/api"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"

import {
	VideoIcon,
	MicIcon,
	CalendarIcon,
	CopyIcon,
	CheckIcon,
	SparklesIcon,
	CameraIcon,
	WarningIcon
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

	// Media Device Enumeration & Live Preview States
	const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([])
	const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
	const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState<string>("")
	const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState<string>("")
	const [previewStream, setPreviewStream] = useState<MediaStream | null>(null)
	const [previewError, setPreviewError] = useState<string | null>(null)
	const previewVideoRef = useRef<HTMLVideoElement | null>(null)

	const meetingLink = `${window.location.origin}/meetings/${meetingCode}`

	useEffect(() => {
		const timer = setInterval(() => setTime(new Date()), 1000)
		return () => clearInterval(timer)
	}, [])

	// Enumerate Media Input Devices (Microphones & Cameras)
	useEffect(() => {
		let active = true;

		const initDevices = async () => {
			try {
				let tempStream: MediaStream | null = null;
				try {
					tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
				} catch (err) {
					console.warn("Media permissions prompt result:", err);
				}

				const devices = await navigator.mediaDevices.enumerateDevices();
				if (!active) {
					if (tempStream) tempStream.getTracks().forEach(t => t.stop());
					return;
				}

				const vDevs = devices.filter(d => d.kind === 'videoinput');
				const aDevs = devices.filter(d => d.kind === 'audioinput');

				setVideoDevices(vDevs);
				setAudioDevices(aDevs);

				if (vDevs.length > 0 && !selectedVideoDeviceId) {
					setSelectedVideoDeviceId(vDevs[0].deviceId);
				}
				if (aDevs.length > 0 && !selectedAudioDeviceId) {
					setSelectedAudioDeviceId(aDevs[0].deviceId);
				}

				if (tempStream) {
					tempStream.getTracks().forEach(t => t.stop());
				}
			} catch (err: any) {
				console.error("Error enumerating devices:", err);
			}
		};

		initDevices();

		const handleDeviceChange = () => {
			initDevices();
		};

		if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
			navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
		}

		return () => {
			active = false;
			if (navigator.mediaDevices && navigator.mediaDevices.removeEventListener) {
				navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
			}
		};
	}, []);

	// Live Camera Preview Effect
	useEffect(() => {
		let active = true;
		let currentStream: MediaStream | null = null;

		const updatePreview = async () => {
			setPreviewError(null);

			if (isCamOff) {
				setPreviewStream(null);
				return;
			}

			try {
				const constraints: MediaStreamConstraints = {
					video: selectedVideoDeviceId ? { deviceId: { exact: selectedVideoDeviceId } } : true,
					audio: false // muted for dashboard preview
				};

				currentStream = await navigator.mediaDevices.getUserMedia(constraints);
				if (!active) {
					currentStream.getTracks().forEach(t => t.stop());
					return;
				}

				setPreviewStream(currentStream);
			} catch (err: any) {
				console.error("Camera preview error:", err);
				if (active) {
					setPreviewError("Camera device unavailable or permission denied");
					setPreviewStream(null);
				}
			}
		};

		updatePreview();

		return () => {
			active = false;
			if (currentStream) {
				currentStream.getTracks().forEach(t => t.stop());
			}
		};
	}, [isCamOff, selectedVideoDeviceId]);

	// Attach preview stream to video element
	useEffect(() => {
		if (previewVideoRef.current && previewStream) {
			previewVideoRef.current.srcObject = previewStream;
		}
	}, [previewStream]);

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
		const audioParam = `audio=${!isMuted}`;
		const videoParam = `video=${!isCamOff}`;
		const audioIdParam = selectedAudioDeviceId ? `&audioId=${selectedAudioDeviceId}` : '';
		const videoIdParam = selectedVideoDeviceId ? `&videoId=${selectedVideoDeviceId}` : '';
		return `/meetings/${code}?${audioParam}&${videoParam}${audioIdParam}${videoIdParam}`;
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
		} else if (code.includes("/m/")) {
			code = code.split("/m/")[1].split("?")[0];
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

	const selectedAudioDeviceObj = audioDevices.find(d => d.deviceId === selectedAudioDeviceId);
	const selectedVideoDeviceObj = videoDevices.find(d => d.deviceId === selectedVideoDeviceId);

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

				{/* Quick Actions Card: Start instant meeting */}
				<Card className="lg:col-span-2 border border-border-default bg-bg-surface rounded-2xl overflow-hidden flex flex-col shadow-md gap-0 p-0">
					<CardHeader className="p-4 sm:p-6 border-b border-border-subtle bg-bg-surface-hover/40 flex flex-row items-center justify-between">
						<div>
							<CardTitle className="font-bold text-base sm:text-lg text-text-primary">Start a Virtual Meeting</CardTitle>
							<CardDescription className="text-xs text-text-muted mt-0.5">Launch an instant meeting or join an ongoing conversation</CardDescription>
						</div>
						<div className="h-8 w-8 rounded-lg bg-brand-primary/10 border border-border-brand/20 flex items-center justify-center shrink-0">
							<VideoIcon className="text-text-brand h-4 w-4" />
						</div>
					</CardHeader>

					<CardContent className="p-4 sm:p-6 flex-1 flex flex-col md:flex-row gap-6 md:gap-8">

						{/* Visual Settings Preview */}
						<div className="flex-1 flex flex-col justify-between bg-bg-app border border-border-subtle rounded-xl p-4 sm:p-5">
							<div className="space-y-4">
								<span className="text-xs font-semibold text-text-muted uppercase tracking-wider block">Meeting Room Settings</span>

								{/* Camera Preview Box */}
								<div className="aspect-video bg-bg-sidebar rounded-lg flex flex-col items-center justify-center border border-border-default relative overflow-hidden group">
									{isCamOff ? (
										<div className="text-center space-y-1">
											<div className="h-8 w-8 rounded-full bg-bg-surface-hover flex items-center justify-center mx-auto text-text-muted">
												<VideoIcon />
											</div>
											<span className="text-[11px] text-text-muted font-medium">Camera is turned off</span>
										</div>
									) : previewError ? (
										<div className="text-center space-y-1 p-3">
											<div className="h-8 w-8 rounded-full bg-status-danger/10 flex items-center justify-center mx-auto text-status-danger">
												<WarningIcon />
											</div>
											<span className="text-[11px] text-status-danger font-medium block">{previewError}</span>
										</div>
									) : videoDevices.length === 0 ? (
										<div className="text-center space-y-1">
											<div className="h-8 w-8 rounded-full bg-status-warning/10 flex items-center justify-center mx-auto text-status-warning">
												<CameraIcon />
											</div>
											<span className="text-[11px] text-status-warning font-medium">No Camera Device Detected</span>
										</div>
									) : (
										<>
											<video
												ref={previewVideoRef}
												autoPlay
												playsInline
												muted
												aria-label="Live camera preview"
												className="w-full h-full object-cover"
											/>
											<span className="absolute bottom-2.5 left-3 text-[10px] font-semibold text-status-success flex items-center gap-1.5 z-20 bg-bg-modal/80 px-2 py-0.5 rounded-full border border-border-subtle backdrop-blur-md">
												<span className="h-1.5 w-1.5 rounded-full bg-status-success animate-ping" />
												Live Camera Feed
											</span>
										</>
									)}
								</div>

								{/* Camera and Microphone quick controls */}
								<div className="flex justify-center gap-4">
									<Button
										variant="outline"
										size="icon"
										onClick={() => setIsMuted(!isMuted)}
										aria-label={isMuted ? "Unmute Microphone" : "Mute Microphone"}
										aria-pressed={isMuted}
										className={`rounded-xl border transition-all cursor-pointer ${isMuted
											? "bg-status-danger/10 border-status-danger/30 text-status-danger hover:bg-status-danger/20"
											: "bg-bg-surface border-border-default text-text-muted hover:text-text-primary hover:bg-bg-surface-hover"
											}`}
										title={isMuted ? "Unmute Mic" : "Mute Mic"}
									>
										<MicIcon />
									</Button>
									<Button
										variant="outline"
										size="icon"
										onClick={() => setIsCamOff(!isCamOff)}
										aria-label={isCamOff ? "Turn Camera On" : "Turn Camera Off"}
										aria-pressed={isCamOff}
										className={`rounded-xl border transition-all cursor-pointer ${isCamOff
											? "bg-status-danger/10 border-status-danger/30 text-status-danger hover:bg-status-danger/20"
											: "bg-bg-surface border-border-default text-text-muted hover:text-text-primary hover:bg-bg-surface-hover"
											}`}
										title={isCamOff ? "Turn Cam On" : "Turn Cam Off"}
									>
										<VideoIcon />
									</Button>
								</div>

								{/* Device Selectors */}
								<div className="space-y-3 pt-2">
									<div>
										<Label htmlFor="mic-input-select" className="text-[11px] font-semibold text-text-muted uppercase tracking-wider block mb-1">Microphone Input</Label>
										<select
											id="mic-input-select"
											value={selectedAudioDeviceId}
											onChange={(e) => setSelectedAudioDeviceId(e.target.value)}
											aria-label="Select Microphone Input"
											className="w-full px-3 py-1.5 bg-bg-input border border-border-default rounded-xl text-xs text-text-primary focus:outline-none focus:border-border-brand"
										>
											{audioDevices.length > 0 ? (
												audioDevices.map((d, i) => (
													<option key={d.deviceId || i} value={d.deviceId}>
														{d.label || `Microphone ${i + 1}`}
													</option>
												))
											) : (
												<option value="" disabled>No Microphone Device Detected</option>
											)}
										</select>
									</div>

									<div>
										<Label htmlFor="cam-input-select" className="text-[11px] font-semibold text-text-muted uppercase tracking-wider block mb-1">Camera Input</Label>
										<select
											id="cam-input-select"
											value={selectedVideoDeviceId}
											onChange={(e) => setSelectedVideoDeviceId(e.target.value)}
											aria-label="Select Camera Input"
											className="w-full px-3 py-1.5 bg-bg-input border border-border-default rounded-xl text-xs text-text-primary focus:outline-none focus:border-border-brand"
										>
											{videoDevices.length > 0 ? (
												videoDevices.map((d, i) => (
													<option key={d.deviceId || i} value={d.deviceId}>
														{d.label || `Camera ${i + 1}`}
													</option>
												))
											) : (
												<option value="" disabled>No Camera Device Detected</option>
											)}
										</select>
									</div>
								</div>
							</div>

							<div className="mt-4 pt-4 border-t border-border-subtle flex flex-col sm:flex-row justify-between text-xs text-text-muted gap-1">
								<span className="truncate">
									Mic: {audioDevices.length === 0 ? "Not Available" : selectedAudioDeviceObj?.label || "Default Input"}
								</span>
								<span className="truncate">
									Cam: {videoDevices.length === 0 ? "Not Available" : selectedVideoDeviceObj?.label || "Default Camera"}
								</span>
							</div>
						</div>

						{/* Meeting options pane */}
						<div className="flex-1 flex flex-col justify-between space-y-6">
							<div className="space-y-4">
								<h3 className="text-sm font-semibold text-text-primary">Start / Join Live Room</h3>

								{/* Quick inputs using Shadcn Input & Label */}
								<div className="space-y-3">
									<div>
										<Label htmlFor="meeting-code-input" className="text-[11px] font-semibold text-text-muted uppercase tracking-wider block mb-1.5">Meeting Code / URL</Label>
										<Input
											id="meeting-code-input"
											type="text"
											placeholder="e.g. xrt-vdwq-jhz"
											value={joinCodeInput}
											onChange={(e) => setJoinCodeInput(e.target.value)}
											onKeyDown={(e) => e.key === 'Enter' && handleJoinCode()}
											aria-label="Meeting code or URL"
											className="w-full px-4 py-2 bg-bg-input border-border-default rounded-xl text-sm placeholder:text-text-subtle text-text-primary focus-visible:border-border-brand transition-all"
										/>
									</div>
								</div>
							</div>

							<div className="space-y-3">
								<Button
									onClick={handleStartMeeting}
									disabled={loadingMeeting}
									aria-label="Start Instant Meeting"
									className="w-full py-2.5 h-10 rounded-xl bg-gradient-to-r from-brand-primary to-brand-secondary hover:from-brand-primary-hover hover:to-brand-secondary text-text-inverse font-medium text-sm shadow-lg shadow-brand-primary/20 hover:shadow-brand-primary/30 transition-all duration-300 transform active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
								>
									<VideoIcon size={16} />
									{loadingMeeting ? "Creating..." : "Start Instant Meeting"}
								</Button>

								<Button
									variant="outline"
									onClick={handleJoinCode}
									aria-label="Join via Code"
									className="w-full py-2.5 h-10 rounded-xl border border-border-default bg-bg-surface-hover/30 hover:bg-bg-surface-hover hover:border-border-strong text-text-primary font-medium text-sm transition-all duration-300 transform active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
								>
									Join via Code
								</Button>
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

			{/* Mock Meeting Room Started Popup Modal */}
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
									<p className="text-xs text-text-muted">Share this link to invite other participants to join you</p>
								</div>

								{/* Link copying box */}
								<div className="w-full p-3 bg-bg-app border border-border-default rounded-xl flex items-center justify-between gap-3">
									<span className="text-xs text-text-brand select-all truncate font-mono">{meetingLink}</span>
									<Button
										variant="ghost"
										size="icon-sm"
										onClick={() => copyToClipboard(meetingLink, 0)}
										aria-label="Copy meeting link"
										className="hover:bg-bg-surface-hover rounded-lg text-text-muted hover:text-text-primary transition-colors cursor-pointer"
										title="Copy meeting link"
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
