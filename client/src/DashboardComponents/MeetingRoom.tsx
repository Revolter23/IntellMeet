import { useState, useEffect, useRef } from "react"
import { useParams, useNavigate } from "react-router"
import { io } from "socket.io-client"
import { useAuthStore } from "../store/useAuthStore"
import { api } from "../lib/api"
import {
	VideoIcon,
	MicIcon,
	ScreenShareIcon,
	CopyIcon,
	CheckIcon,
	SparklesIcon,
	WarningIcon,
	ChatIcon,
	SendIcon
} from "../lib/icons"

import { useNotification } from "../context/NotificationContext"

interface User {
	id: string;
	name: string;
	email: string;
	avatar?: string;
}


interface RemotePeer {
	socketId: string;
	user: User;
	stream?: MediaStream;
	isAudioMuted: boolean;
	isVideoMuted: boolean;
}

interface ChatMessage {
	id: string;
	senderSocketId: string;
	senderName: string;
	senderAvatar?: string;
	senderId?: string;
	text: string;
	timestamp: string;
}

const ICE_SERVERS = {
	iceServers: [
		{ urls: 'stun:stun.l.google.com:19302' },
		{ urls: 'stun:stun1.l.google.com:19302' },
		{ urls: 'stun:stun2.l.google.com:19302' },
	],
};

export default function MeetingRoom() {
	const { meetingCode } = useParams<{ meetingCode: string }>()
	const navigate = useNavigate()
	const { user } = useAuthStore()
	const { addNotification } = useNotification()


	// UI States
	const [meetingTitle, setMeetingTitle] = useState("Loading...")
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [copied, setCopied] = useState(false)
	const [showParticipants, setShowParticipants] = useState(false)

	// Chat States & Refs
	const [showChat, setShowChat] = useState(false)
	const [messages, setMessages] = useState<ChatMessage[]>([])
	const [newMessageText, setNewMessageText] = useState("")
	const [unreadCount, setUnreadCount] = useState(0)
	const chatBottomRef = useRef<HTMLDivElement | null>(null)
	const showChatRef = useRef(showChat)

	// Sync showChatRef and reset unread count when chat panel is opened
	useEffect(() => {
		showChatRef.current = showChat
		if (showChat) {
			setUnreadCount(0)
		}
	}, [showChat])

	// Auto-scroll to bottom of chat when new messages arrive or panel opens
	useEffect(() => {
		if (showChat && chatBottomRef.current) {
			chatBottomRef.current.scrollIntoView({ behavior: "smooth" })
		}
	}, [messages, showChat])

	// Media States
	const [localStream, setLocalStream] = useState<MediaStream | null>(null)
	const [isAudioMuted, setIsAudioMuted] = useState(false)
	const [isVideoMuted, setIsVideoMuted] = useState(false)
	const [isScreenSharing, setIsScreenSharing] = useState(false)

	// WebRTC / Socket References
	const socketRef = useRef<any>(null)
	const localStreamRef = useRef<MediaStream | null>(null)
	const peersRef = useRef<{ [socketId: string]: RTCPeerConnection }>({})
	const screenStreamRef = useRef<MediaStream | null>(null)

	// Remote Peers State
	const [remotePeers, setRemotePeers] = useState<RemotePeer[]>([])

	// Send message handler
	const handleSendMessage = (e: React.FormEvent) => {
		e.preventDefault()
		if (!newMessageText.trim() || !socketRef.current) return;
		socketRef.current.emit("send-message", { text: newMessageText.trim() })
		setNewMessageText("")
	}


	// Parse initial camera / microphone parameters from URL query
	useEffect(() => {
		const queryParams = new URLSearchParams(window.location.search)
		setIsAudioMuted(queryParams.get("audio") === "false")
		setIsVideoMuted(queryParams.get("video") === "false")
	}, [])

	// 1. Fetch meeting info & check validation
	useEffect(() => {
		const verifyMeeting = async () => {
			try {
				const res = await api.get(`/meetings/${meetingCode}`)
				setMeetingTitle(res.data.meeting.title)
				setLoading(false)
			} catch (err: any) {
				console.error("Meeting verification failed:", err)
				setError(err.response?.data?.message || "Invalid or unauthorized meeting code.")
				setLoading(false)
			}
		}
		verifyMeeting()
	}, [meetingCode])

	// 2. Initialize media stream and signaling connection
	useEffect(() => {
		if (loading || error || !user || !meetingCode) return;

		let active = true;

		const startCall = async () => {
			try {
				// Acquire camera and mic streams
				let stream: MediaStream;
				try {
					stream = await navigator.mediaDevices.getUserMedia({
						video: true,
						audio: true
					})
				} catch (mediaErr) {
					console.warn("Failed to get audio and video, attempting audio-only...", mediaErr)
					try {
						stream = await navigator.mediaDevices.getUserMedia({
							video: false,
							audio: true
						})
						setIsVideoMuted(true)
					} catch (audioErr) {
						console.error("Failed to get microphone. Starting streamless...", audioErr)
						// Create empty fallback stream
						stream = new MediaStream()
						setIsAudioMuted(true)
						setIsVideoMuted(true)
					}
				}

				if (!active) {
					stream.getTracks().forEach(t => t.stop())
					return;
				}

				localStreamRef.current = stream;
				setLocalStream(stream);

				// Apply initial audio/video track configurations
				const queryParams = new URLSearchParams(window.location.search)
				const initAudio = queryParams.get("audio") !== "false"
				const initVideo = queryParams.get("video") !== "false"

				stream.getAudioTracks().forEach(track => {
					track.enabled = initAudio;
				})
				stream.getVideoTracks().forEach(track => {
					track.enabled = initVideo;
				})

				// Initialize Socket.io signaling connection
				socketRef.current = io("http://localhost:3000")

				// Event: Connected
				socketRef.current.on("connect", () => {
					console.log("Connected to signaling server:", socketRef.current.id)
					socketRef.current.emit("join-room", {
						meetingCode,
						user: {
							id: user.id,
							name: user.name,
							email: user.email,
							avatar: user.avatar
						}
					})
				})

				// Event: All current users in the room (for newly joined peer)
				socketRef.current.on("all-users", async (users: { socketId: string; user: User }[]) => {
					console.log("All existing users in room:", users)
					const peers: RemotePeer[] = []

					for (const u of users) {
						const peerConnection = createPeerConnection(u.socketId, u.user)
						peersRef.current[u.socketId] = peerConnection

						// Add local tracks to peer connection
						stream.getTracks().forEach(track => {
							peerConnection.addTrack(track, stream)
						})

						try {
							const offer = await peerConnection.createOffer()
							await peerConnection.setLocalDescription(offer)

							socketRef.current.emit("offer", {
								to: u.socketId,
								offer
							})

							peers.push({
								socketId: u.socketId,
								user: u.user,
								isAudioMuted: false,
								isVideoMuted: false
							})
						} catch (offerErr) {
							console.error(`Error creating offer for ${u.socketId}:`, offerErr)
						}
					}

					setRemotePeers(peers)
				})

				// Event: Receive Offer (from a newly joined peer)
				socketRef.current.on("offer", async ({ from, offer, user: callerUser }: { from: string; offer: RTCSessionDescriptionInit; user: User }) => {
					console.log(`Received WebRTC offer from: ${from}`)

					const peerConnection = createPeerConnection(from, callerUser)
					peersRef.current[from] = peerConnection

					// Add local tracks to peer connection
					stream.getTracks().forEach(track => {
						peerConnection.addTrack(track, stream)
					})

					try {
						await peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
						const answer = await peerConnection.createAnswer()
						await peerConnection.setLocalDescription(answer)

						socketRef.current.emit("answer", {
							to: from,
							answer
						})

						setRemotePeers(prev => {
							if (prev.some(p => p.socketId === from)) return prev;
							return [...prev, { socketId: from, user: callerUser, isAudioMuted: false, isVideoMuted: false }]
						})
					} catch (answerErr) {
						console.error(`Error answering offer from ${from}:`, answerErr)
					}
				})

				// Event: Receive Answer (from an existing peer)
				socketRef.current.on("answer", async ({ from, answer }: { from: string; answer: RTCSessionDescriptionInit }) => {
					console.log(`Received WebRTC answer from: ${from}`)
					const pc = peersRef.current[from]
					if (pc) {
						try {
							await pc.setRemoteDescription(new RTCSessionDescription(answer))
						} catch (descErr) {
							console.error("Error setting remote description:", descErr)
						}
					}
				})

				// Event: Receive ICE Candidate
				socketRef.current.on("ice-candidate", async ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
					const pc = peersRef.current[from]
					if (pc) {
						try {
							await pc.addIceCandidate(new RTCIceCandidate(candidate))
						} catch (iceErr) {
							console.error("Error adding ice candidate:", iceErr)
						}
					}
				})

				// Event: Peer left/disconnected
				socketRef.current.on("user-left", (socketId: string) => {
					console.log(`User left call: ${socketId}`)
					const pc = peersRef.current[socketId]
					if (pc) {
						pc.close()
						delete peersRef.current[socketId]
					}
					setRemotePeers(prev => prev.filter(p => p.socketId !== socketId))
				})

				// Event: User Joined (Notifies existing peers that metadata is ready)
				socketRef.current.on("user-joined", ({ socketId, user: joinedUser }: { socketId: string; user: User }) => {
					console.log(`User metadata registered for: ${joinedUser.email}`)
					setRemotePeers(prev => {
						if (prev.some(p => p.socketId === socketId)) return prev;
						return [...prev, { socketId, user: joinedUser, isAudioMuted: false, isVideoMuted: false }]
					})
				})

				// Event: Remote user toggled camera/mic
				socketRef.current.on("user-media-toggled", ({ socketId, isAudioMuted: audioMuted, isVideoMuted: videoMuted }: { socketId: string; isAudioMuted: boolean; isVideoMuted: boolean }) => {
					setRemotePeers(prev => prev.map(p => {
						if (p.socketId === socketId) {
							return { ...p, isAudioMuted: audioMuted, isVideoMuted: videoMuted }
						}
						return p;
					}))
				})

				// Event: Receive Chat Message
				socketRef.current.on("receive-message", (msg: ChatMessage) => {
					setMessages(prev => [...prev, msg])
					if (!showChatRef.current) {
						setUnreadCount(prev => prev + 1)
						addNotification({
							type: 'info',
							title: `Message from ${msg.senderName}`,
							message: msg.text,
							timestamp: msg.timestamp
						})
					}
				})

				// Event: Receive Real-Time System / Room Notification
				socketRef.current.on("receive-notification", (notif: { id?: string; type?: any; title: string; message: string; timestamp?: string }) => {
					addNotification({
						id: notif.id,
						type: notif.type || 'info',
						title: notif.title,
						message: notif.message,
						timestamp: notif.timestamp
					})
				})



			} catch (err) {
				console.error("Error initializing camera/signaling:", err)
				setError("Camera or Microphone permissions failed. Ensure you have given permission and are running on localhost/HTTPS.")
			}
		}

		startCall()

		// Cleanup logic when unmounting component
		return () => {
			active = false;
			if (localStreamRef.current) {
				localStreamRef.current.getTracks().forEach(track => track.stop())
			}
			if (screenStreamRef.current) {
				screenStreamRef.current.getTracks().forEach(track => track.stop())
			}
			for (const id in peersRef.current) {
				peersRef.current[id].close()
			}
			peersRef.current = {}
			if (socketRef.current) {
				socketRef.current.disconnect()
			}
		}
	}, [loading, error, user, meetingCode])

	// Helper to create RTCPeerConnection and bind event handlers
	const createPeerConnection = (targetSocketId: string, peerUser: User) => {
		const pc = new RTCPeerConnection(ICE_SERVERS)

		// Handle ICE Candidate generation
		pc.onicecandidate = (event) => {
			if (event.candidate && socketRef.current) {
				socketRef.current.emit("ice-candidate", {
					to: targetSocketId,
					candidate: event.candidate
				})
			}
		}

		// Handle Track receiving from remote peers
		pc.ontrack = (event) => {
			console.log(`Received media track from peer: ${peerUser.email}`, event.streams[0])
			setRemotePeers(prev => prev.map(p => {
				if (p.socketId === targetSocketId) {
					return { ...p, stream: event.streams[0] }
				}
				return p;
			}))
		}

		return pc;
	}

	// Action: Toggle Microphone (Local)
	const handleToggleAudio = () => {
		const stream = localStreamRef.current;
		if (stream) {
			const tracks = stream.getAudioTracks()
			if (tracks.length > 0) {
				const nextState = !isAudioMuted;
				tracks.forEach(track => {
					track.enabled = !nextState;
				})
				setIsAudioMuted(nextState)
				socketRef.current?.emit("toggle-media", {
					isAudioMuted: nextState,
					isVideoMuted
				})
			}
		}
	}

	// Action: Toggle Camera (Local)
	const handleToggleVideo = () => {
		const stream = localStreamRef.current;
		if (stream) {
			const tracks = stream.getVideoTracks()
			if (tracks.length > 0) {
				const nextState = !isVideoMuted;
				tracks.forEach(track => {
					track.enabled = !nextState;
				})
				setIsVideoMuted(nextState)
				socketRef.current?.emit("toggle-media", {
					isAudioMuted,
					isVideoMuted: nextState
				})
			}
		}
	}

	// Action: Toggle Screen Sharing
	const handleToggleScreen = async () => {
		if (isScreenSharing) {
			stopScreenSharing()
		} else {
			try {
				const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true })
				screenStreamRef.current = screenStream;
				const screenTrack = screenStream.getVideoTracks()[0]

				// Replace video track on all peer connections
				for (const socketId in peersRef.current) {
					const pc = peersRef.current[socketId]
					const senders = pc.getSenders()
					const videoSender = senders.find(sender => sender.track?.kind === "video")
					if (videoSender) {
						videoSender.replaceTrack(screenTrack)
					}
				}

				// Switch local video element track
				// Track screen share termination from browser default toolbar
				screenTrack.onended = () => {
					stopScreenSharing()
				}

				setIsScreenSharing(true)
			} catch (err) {
				console.error("Error launching screen share:", err)
			}
		}
	}

	const stopScreenSharing = () => {
		if (screenStreamRef.current) {
			screenStreamRef.current.getTracks().forEach(track => track.stop())
			screenStreamRef.current = null;
		}

		// Restore camera video track on all peer connections
		const cameraTrack = localStreamRef.current?.getVideoTracks()[0]
		if (cameraTrack) {
			for (const socketId in peersRef.current) {
				const pc = peersRef.current[socketId]
				const senders = pc.getSenders()
				const videoSender = senders.find(sender => sender.track?.kind === "video")
				if (videoSender) {
					videoSender.replaceTrack(cameraTrack)
				}
			}
		}

		setIsScreenSharing(false)
	}

	// Action: Copy invitation link
	const copyInviteLink = () => {
		const link = `${window.location.origin}/meetings/${meetingCode}`
		navigator.clipboard.writeText(link)
		setCopied(true)
		setTimeout(() => setCopied(false), 2000)
	}

	// Action: Leave meeting room
	const handleLeaveMeeting = () => {
		if (localStreamRef.current) {
			localStreamRef.current.getTracks().forEach(track => track.stop())
		}
		if (screenStreamRef.current) {
			screenStreamRef.current.getTracks().forEach(track => track.stop())
		}
		navigate("/dashboard")
	}

	// Render Loading State
	if (loading) {
		return (
			<div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white">
				<div className="relative flex items-center justify-center mb-6">
					<div className="h-16 w-16 rounded-full border-[3px] border-slate-900" />
					<div className="absolute h-16 w-16 rounded-full border-t-[3px] border-indigo-500 animate-spin" />
					<div className="absolute h-8 w-8 rounded-full bg-indigo-600/20 border border-indigo-500/30 animate-pulse" />
				</div>
				<h3 className="text-lg font-semibold bg-gradient-to-r from-indigo-200 to-white bg-clip-text text-transparent">Joining Room...</h3>
				<p className="text-xs text-slate-500 mt-1">Securing peer signaling networks</p>
			</div>
		)
	}

	// Render Error State
	if (error) {
		return (
			<div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white px-4 text-center">
				<div className="h-14 w-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-6 shadow-lg shadow-rose-600/5">
					<WarningIcon size={24} />
				</div>
				<h3 className="text-xl font-bold text-slate-200">Unable to Join Meeting</h3>
				<p className="text-sm text-slate-500 mt-2 max-w-sm leading-relaxed">{error}</p>
				<button
					onClick={() => navigate("/dashboard")}
					className="mt-6 px-6 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-xl text-xs font-semibold text-slate-200 transition-all active:scale-[0.98] cursor-pointer"
				>
					Return to Dashboard
				</button>
			</div>
		)
	}

	// Dynamic Layout Grid Sizing
	const totalParticipants = remotePeers.length + 1;
	let gridClass = "grid-cols-1";
	if (totalParticipants === 2) gridClass = "grid-cols-1 md:grid-cols-2";
	else if (totalParticipants >= 3 && totalParticipants <= 4) gridClass = "grid-cols-1 md:grid-cols-2";
	else if (totalParticipants > 4) gridClass = "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";

	return (
		<div className="fixed inset-0 min-h-screen bg-slate-950 text-slate-100 flex flex-col z-[100] overflow-hidden font-sans">
			{/* Ambient glows */}
			<div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full bg-indigo-600/5 blur-3xl pointer-events-none" />
			<div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full bg-violet-600/5 blur-3xl pointer-events-none" />

			{/* Top Bar Header */}
			<header className="h-16 px-6 border-b border-slate-900 bg-slate-950/60 backdrop-blur-xl flex items-center justify-between z-10">
				<div className="flex items-center gap-3">
					<div className="h-8 w-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
						<SparklesIcon size={16} />
					</div>
					<div>
						<h2 className="font-bold text-sm text-slate-200 truncate max-w-xs md:max-w-md">{meetingTitle}</h2>
						<span className="text-[10px] text-slate-500 flex items-center gap-1.5 uppercase font-semibold tracking-wider">
							<span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
							P2P Secure Mesh
						</span>
					</div>
				</div>

				<div className="flex items-center gap-3">
					{/* Meeting Code Badge */}
					<div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-slate-900/60 border border-slate-800 rounded-xl">
						<span className="text-xs text-slate-400 font-mono select-all">{meetingCode}</span>
						<button
							onClick={copyInviteLink}
							className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
							title="Copy invite link"
						>
							{copied ? <CheckIcon className="text-emerald-400" size={14} /> : <CopyIcon size={14} />}
						</button>
					</div>

					{/* Participants Count Toggle */}
					<button
						onClick={() => {
							setShowParticipants(!showParticipants)
							if (!showParticipants) setShowChat(false)
						}}
						className={`px-3 py-1 text-xs font-medium rounded-xl border transition-all cursor-pointer ${showParticipants
								? "bg-indigo-600/10 border-indigo-500/30 text-indigo-400"
								: "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
							}`}
					>
						People ({totalParticipants})
					</button>

					{/* Chat Panel Toggle */}
					<button
						onClick={() => {
							setShowChat(!showChat)
							if (!showChat) setShowParticipants(false)
						}}
						className={`relative px-3 py-1 text-xs font-medium rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${showChat
								? "bg-indigo-600/10 border-indigo-500/30 text-indigo-400"
								: "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
							}`}
					>
						<ChatIcon size={14} />
						<span>Chat</span>
						{unreadCount > 0 && (
							<span className="h-4 w-4 rounded-full bg-indigo-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
								{unreadCount}
							</span>
						)}
					</button>
				</div>
			</header>

			{/* Main Calling Stage */}
			<div className="flex-1 flex overflow-hidden relative">
				<div className="flex-1 p-6 overflow-y-auto flex items-center justify-center">
					<div className={`grid ${gridClass} gap-6 w-full max-w-6xl`}>

						{/* Local Stream display */}
						<VideoFeed
							stream={isScreenSharing && screenStreamRef.current ? screenStreamRef.current : localStream || undefined}
							label={`${user?.name || "You"}${isScreenSharing ? " (Screen Sharing)" : ""}`}
							isMuted={isAudioMuted}
							isVideoMuted={isVideoMuted && !isScreenSharing}
							isLocal={true}
							avatar={user?.avatar}
							name={user?.name || "User"}
						/>

						{/* Remote Streams display */}
						{remotePeers.map(peer => (
							<VideoFeed
								key={peer.socketId}
								stream={peer.stream}
								label={peer.user.name || "Participant"}
								isMuted={peer.isAudioMuted}
								isVideoMuted={peer.isVideoMuted}
								isLocal={false}
								avatar={peer.user.avatar}
								name={peer.user.name || "User"}
							/>
						))}
					</div>
				</div>

				{/* Collapsible Right Sidebar: Participants List */}
				{showParticipants && (
					<aside className="w-80 border-l border-slate-900 bg-slate-950/80 backdrop-blur-xl flex flex-col z-10">
						<div className="p-4 border-b border-slate-900">
							<h3 className="font-bold text-sm text-slate-200">Room Participants</h3>
							<p className="text-[11px] text-slate-500">Connected to room {meetingCode}</p>
						</div>

						<div className="flex-1 overflow-y-auto p-4 space-y-4">
							{/* Local User Row */}
							<div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/40 border border-slate-850">
								<div className="flex items-center gap-3">
									{user?.avatar ? (
										<img src={user.avatar} className="h-8 w-8 rounded-lg object-cover" />
									) : (
										<div className="h-8 w-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-xs font-bold text-indigo-400">
											{user?.name?.substring(0, 2).toUpperCase() || "ME"}
										</div>
									)}
									<div className="overflow-hidden">
										<p className="text-xs font-semibold text-slate-200 truncate">{user?.name} (You)</p>
										<p className="text-[10px] text-slate-500 truncate">Host</p>
									</div>
								</div>
								<div className="flex gap-1.5">
									<span className={`p-1 rounded bg-slate-950 text-xs ${isAudioMuted ? "text-rose-500" : "text-emerald-500"}`}>
										<MicIcon size={12} />
									</span>
									<span className={`p-1 rounded bg-slate-950 text-xs ${isVideoMuted ? "text-rose-500" : "text-emerald-500"}`}>
										<VideoIcon size={12} />
									</span>
								</div>
							</div>

							{/* Remote Users Rows */}
							{remotePeers.map(peer => (
								<div key={peer.socketId} className="flex items-center justify-between p-2 rounded-xl bg-slate-900/10 hover:bg-slate-900/30 border border-transparent transition-all">
									<div className="flex items-center gap-3">
										{peer.user.avatar ? (
											<img src={peer.user.avatar} className="h-8 w-8 rounded-lg object-cover" />
										) : (
											<div className="h-8 w-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-400">
												{peer.user.name?.substring(0, 2).toUpperCase() || "PA"}
											</div>
										)}
										<div className="overflow-hidden">
											<p className="text-xs font-semibold text-slate-300 truncate">{peer.user.name}</p>
											<p className="text-[10px] text-slate-500 truncate">Attendee</p>
										</div>
									</div>
									<div className="flex gap-1.5">
										<span className={`p-1 rounded bg-slate-900/60 text-xs ${peer.isAudioMuted ? "text-rose-500" : "text-emerald-500"}`}>
											<MicIcon size={12} />
										</span>
										<span className={`p-1 rounded bg-slate-900/60 text-xs ${peer.isVideoMuted ? "text-rose-500" : "text-emerald-500"}`}>
											<VideoIcon size={12} />
										</span>
									</div>
								</div>
							))}
						</div>
					</aside>
				)}

				{/* Collapsible Right Sidebar: In-Meeting Chat */}
				{showChat && (
					<aside className="w-80 sm:w-96 border-l border-slate-900 bg-slate-950/90 backdrop-blur-xl flex flex-col z-20 shadow-2xl">
						<div className="p-4 border-b border-slate-900 flex items-center justify-between">
							<div>
								<h3 className="font-bold text-sm text-slate-200">In-Meeting Chat</h3>
								<p className="text-[11px] text-slate-500">Messages are visible to everyone</p>
							</div>
							<button
								onClick={() => setShowChat(false)}
								className="text-slate-400 hover:text-slate-200 text-xs px-2 py-1 rounded-lg hover:bg-slate-900 transition-colors"
							>
								✕
							</button>
						</div>

						{/* Message History List */}
						<div className="flex-1 overflow-y-auto p-4 space-y-3.5">
							{messages.length === 0 ? (
								<div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
									<ChatIcon size={32} className="opacity-30 mb-2" />
									<p className="text-xs font-medium text-slate-400">No messages yet</p>
									<p className="text-[11px] text-slate-600 mt-1">Send a message to start chatting with participants</p>
								</div>
							) : (
								messages.map((msg) => {
									const isMe = socketRef.current && msg.senderSocketId === socketRef.current.id;
									return (
										<div
											key={msg.id}
											className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
										>
											<div className="flex items-center gap-1.5 mb-1">
												<span className="text-[11px] font-semibold text-slate-400">
													{isMe ? "You" : msg.senderName}
												</span>
												<span className="text-[10px] text-slate-600">{msg.timestamp}</span>
											</div>
											<div
												className={`px-3 py-2 rounded-2xl text-xs max-w-[85%] break-words shadow-sm ${isMe
														? "bg-indigo-600 text-white rounded-tr-none"
														: "bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none"
													}`}
											>
												{msg.text}
											</div>
										</div>
									)
								})
							)}
							<div ref={chatBottomRef} />
						</div>

						{/* Message Input Form */}
						<form onSubmit={handleSendMessage} className="p-3 border-t border-slate-900 bg-slate-950 flex items-center gap-2">
							<input
								type="text"
								value={newMessageText}
								onChange={(e) => setNewMessageText(e.target.value)}
								placeholder="Type a message..."
								className="flex-1 bg-slate-900 border border-slate-800 focus:border-indigo-500 focus:outline-none text-xs text-slate-100 placeholder-slate-500 rounded-xl px-3 py-2.5 transition-all"
							/>
							<button
								type="submit"
								disabled={!newMessageText.trim()}
								className="p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white rounded-xl transition-all cursor-pointer shadow-md flex items-center justify-center"
								title="Send Message"
							>
								<SendIcon size={16} />
							</button>
						</form>
					</aside>
				)}
			</div>

			{/* Bottom Controls Bar */}
			<footer className="h-20 bg-slate-950/80 border-t border-slate-900 backdrop-blur-md flex items-center justify-center z-10 px-6">
				<div className="flex items-center gap-4">

					{/* Mute Mic Button */}
					<button
						onClick={handleToggleAudio}
						className={`p-3 rounded-full border transition-all cursor-pointer shadow-md ${isAudioMuted
								? "bg-rose-500/20 border-rose-500/40 text-rose-400 hover:bg-rose-500/30"
								: "bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-850"
							}`}
						title={isAudioMuted ? "Unmute Mic" : "Mute Mic"}
					>
						<MicIcon size={20} />
					</button>

					{/* Toggle Camera Button */}
					<button
						onClick={handleToggleVideo}
						className={`p-3 rounded-full border transition-all cursor-pointer shadow-md ${isVideoMuted
								? "bg-rose-500/20 border-rose-500/40 text-rose-400 hover:bg-rose-500/30"
								: "bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-850"
							}`}
						title={isVideoMuted ? "Turn Camera On" : "Turn Camera Off"}
					>
						<VideoIcon size={20} />
					</button>

					{/* Share Screen Button */}
					<button
						onClick={handleToggleScreen}
						className={`p-3 rounded-full border transition-all cursor-pointer shadow-md ${isScreenSharing
								? "bg-indigo-600/20 border-indigo-500/40 text-indigo-400 hover:bg-indigo-600/30"
								: "bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-850"
							}`}
						title={isScreenSharing ? "Stop Screen Share" : "Share Screen"}
					>
						<ScreenShareIcon size={20} />
					</button>

					{/* Chat Toggle Button (Bottom Toolbar) */}
					<button
						onClick={() => {
							setShowChat(!showChat)
							if (!showChat) setShowParticipants(false)
						}}
						className={`relative p-3 rounded-full border transition-all cursor-pointer shadow-md ${showChat
								? "bg-indigo-600/20 border-indigo-500/40 text-indigo-400 hover:bg-indigo-600/30"
								: "bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-850"
							}`}
						title="In-Meeting Chat"
					>
						<ChatIcon size={20} />
						{unreadCount > 0 && (
							<span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-indigo-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-slate-950 animate-pulse">
								{unreadCount}
							</span>
						)}
					</button>


					{/* Copy Invite (Mobile fallback trigger) */}
					<button
						onClick={copyInviteLink}
						className={`sm:hidden p-3 rounded-full border transition-all cursor-pointer shadow-md ${copied
								? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
								: "bg-slate-900 border-slate-800 text-slate-300 hover:text-white"
							}`}
						title="Copy Meeting Link"
					>
						{copied ? <CheckIcon size={20} /> : <CopyIcon size={20} />}
					</button>

					{/* End Call / Hang Up Button */}
					<button
						onClick={handleLeaveMeeting}
						className="px-6 py-3 bg-rose-600 hover:bg-rose-500 active:scale-[0.98] text-white font-semibold rounded-full border border-rose-500/20 transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-rose-600/20"
						title="Leave Call"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="currentColor"
							viewBox="0 0 24 24"
							className="h-5 w-5"
						>
							<path d="M21 16.5c0 .38-.21.71-.53.88l-3.37 2c-.32.19-.72.16-1.02-.07l-2.01-1.5c-.32-.24-.47-.64-.38-1.03l.63-2.61c.09-.37-.02-.76-.3-1.04-1.25-1.25-2.73-2.26-4.37-3-.28-.13-.61-.13-.88 0-1.64.74-3.12 1.75-4.37 3-.28.28-.39.67-.3 1.04l.63 2.61c.09.39-.06.79-.38 1.03l-2.01 1.5c-.3.23-.7.26-1.02.07l-3.37-2c-.32-.17-.53-.5-.53-.88 0-.55.45-1 1-1 3.51 0 6.82-1.37 9.3-3.69l1.45-1.45c.39-.39 1.02-.39 1.41 0l1.45 1.45c2.48 2.32 5.79 3.69 9.3 3.69.55 0 1 .45 1 1z" />
						</svg>
						<span className="hidden sm:inline text-sm">Leave Meeting</span>
					</button>

				</div>
			</footer>
		</div>
	)
}

// Sub-component: Renders individual video grid cell or avatar placeholder
function VideoFeed({
	stream,
	label,
	isMuted,
	isVideoMuted,
	isLocal,
	avatar,
	name
}: {
	stream?: MediaStream
	label: string
	isMuted?: boolean
	isVideoMuted?: boolean
	isLocal?: boolean
	avatar?: string
	name: string
}) {
	const videoRef = useRef<HTMLVideoElement | null>(null)

	useEffect(() => {
		if (videoRef.current && stream) {
			videoRef.current.srcObject = stream
		}
	}, [stream])

	return (
		<div className="relative aspect-video bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg group">

			{/* Show Video element if stream has active video track and is unmuted */}
			{stream && !isVideoMuted ? (
				<video
					ref={videoRef}
					autoPlay
					playsInline
					muted={isLocal} // Avoid local feedback echo
					className="w-full h-full object-cover"
				/>
			) : (
				// Show avatar/name visualizer card when camera is off
				<div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-md">
					{avatar ? (
						<img
							src={avatar}
							alt={name}
							className="h-20 w-20 rounded-full border border-slate-700/80 object-cover shadow-2xl animate-pulse"
						/>
					) : (
						<div className="h-20 w-20 rounded-full bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/30 flex items-center justify-center font-bold text-2xl text-indigo-300 shadow-2xl">
							{name.substring(0, 2).toUpperCase()}
						</div>
					)}
					<span className="text-slate-400 text-[11px] font-semibold tracking-wider uppercase mt-4">{name} (Camera Off)</span>
				</div>
			)}

			{/* Label / Audio Muted overlays */}
			<div className="absolute bottom-4 left-4 right-4 flex items-center justify-between pointer-events-none z-10">
				<span className="px-3 py-1 text-[11px] font-semibold text-slate-200 bg-slate-950/70 border border-slate-850/80 backdrop-blur-md rounded-full shadow-md flex items-center gap-1.5">
					{isLocal && <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />}
					{label}
				</span>

				{isMuted && (
					<span className="p-1.5 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-400 backdrop-blur-md shadow-md">
						<MicIcon size={12} />
					</span>
				)}
			</div>
		</div>
	)
}
