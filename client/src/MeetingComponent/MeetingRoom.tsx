import { useState, useEffect, useRef } from "react"
import { useParams, useNavigate } from "react-router"
import axios from "axios"
import { io } from "socket.io-client"
import { useAuthStore } from "../store/useAuthStore"
import { api } from "../lib/api"
import { API_BASE_URL } from "../lib/config"
import {
	VideoIcon,
	MicIcon,
	ScreenShareIcon,
	CopyIcon,
	CheckIcon,
	SparklesIcon,
	WarningIcon,
	ChatIcon,
	SendIcon,
	RecordIcon,
	StopRecordIcon
} from "../lib/icons"

import { useNotification } from "../context/NotificationContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface User {
	id: string;
	_id?: string;
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
	isScreenSharing?: boolean;
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
	const [meeting, setMeeting] = useState<any>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [copied, setCopied] = useState(false)
	const [showParticipants, setShowParticipants] = useState(false)

	// Floating In-Meeting Room Alert (does not trigger persistent user notifications)
	const [roomAlert, setRoomAlert] = useState<{ id: string; message: string } | null>(null)

	const triggerRoomAlert = (message: string) => {
		setRoomAlert({ id: Date.now().toString(), message })
		setTimeout(() => {
			setRoomAlert(null)
		}, 4000)
	}

	// Chat States & Refs
	const [showChat, setShowChat] = useState(false)
	const [messages, setMessages] = useState<ChatMessage[]>([])
	const [newMessageText, setNewMessageText] = useState("")
	const [unreadCount, setUnreadCount] = useState(0)
	const [typingUsers, setTypingUsers] = useState<{ [socketId: string]: string }>({})
	const chatBottomRef = useRef<HTMLDivElement | null>(null)
	const showChatRef = useRef(showChat)
	const typingTimeoutRef = useRef<any>(null)

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
	const [isAudioMuted, setIsAudioMuted] = useState(true) // Default muted until joined
	const [isVideoMuted, setIsVideoMuted] = useState(true) // Default camera off until joined
	const [isScreenSharing, setIsScreenSharing] = useState(false)

	// Pre-join Device Configuration Modal States
	const [hasJoinedRoom, setHasJoinedRoom] = useState(false)
	const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
	const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([])
	const [selectedAudioId, setSelectedAudioId] = useState<string>('')
	const [selectedVideoId, setSelectedVideoId] = useState<string>('')
	const [preJoinMicOn, setPreJoinMicOn] = useState(false) // Keep Mic OFF by default
	const [preJoinCameraOn, setPreJoinCameraOn] = useState(false) // Keep Camera OFF by default
	const [previewStream, setPreviewStream] = useState<MediaStream | null>(null)

	// Enumerate Mic & Camera devices when in Pre-Join Modal
	useEffect(() => {
		if (hasJoinedRoom) return;

		const detectDevices = async () => {
			try {
				const devices = await navigator.mediaDevices.enumerateDevices();
				const audioInputs = devices.filter(d => d.kind === 'audioinput');
				const videoInputs = devices.filter(d => d.kind === 'videoinput');

				setAudioDevices(audioInputs);
				setVideoDevices(videoInputs);

				if (audioInputs.length > 0 && !selectedAudioId) {
					setSelectedAudioId(audioInputs[0].deviceId);
				}
				if (videoInputs.length > 0 && !selectedVideoId) {
					setSelectedVideoId(videoInputs[0].deviceId);
				}
			} catch (err) {
				console.error("Error enumerating devices:", err);
			}
		};

		detectDevices();

		navigator.mediaDevices.addEventListener('devicechange', detectDevices);
		return () => {
			navigator.mediaDevices.removeEventListener('devicechange', detectDevices);
		};
	}, [hasJoinedRoom, selectedAudioId, selectedVideoId]);

	// Camera Preview in Pre-Join Modal
	useEffect(() => {
		let activePreview = true;
		let streamInstance: MediaStream | null = null;

		if (!hasJoinedRoom && preJoinCameraOn && videoDevices.length > 0) {
			const videoConstraints = selectedVideoId ? { deviceId: { exact: selectedVideoId } } : true;
			navigator.mediaDevices.getUserMedia({ video: videoConstraints })
				.then(stream => {
					if (!activePreview) {
						stream.getTracks().forEach(t => t.stop());
						return;
					}
					streamInstance = stream;
					setPreviewStream(stream);
				})
				.catch(err => {
					console.error("Camera preview failed:", err);
					setPreJoinCameraOn(false);
				});
		} else {
			if (previewStream) {
				previewStream.getTracks().forEach(t => t.stop());
				setPreviewStream(null);
			}
		}

		return () => {
			activePreview = false;
			if (streamInstance) {
				streamInstance.getTracks().forEach(t => t.stop());
			}
		};
	}, [hasJoinedRoom, preJoinCameraOn, selectedVideoId, videoDevices.length]);

	const handleConfirmJoin = () => {
		if (previewStream) {
			previewStream.getTracks().forEach(t => t.stop());
			setPreviewStream(null);
		}
		setHasJoinedRoom(true);
	};

	// Recording States & References
	const [isRecording, setIsRecording] = useState(false)
	const [recordingTime, setRecordingTime] = useState(0)
	const mediaRecorderRef = useRef<MediaRecorder | null>(null)
	const recordedChunksRef = useRef<Blob[]>([])

	// Recording timer effect
	useEffect(() => {
		let timer: any;
		if (isRecording) {
			timer = setInterval(() => {
				setRecordingTime(prev => prev + 1);
			}, 1000);
		} else {
			setRecordingTime(0);
		}
		return () => clearInterval(timer);
	}, [isRecording]);

	const formatRecordingTime = (totalSeconds: number) => {
		const mins = Math.floor(totalSeconds / 60);
		const secs = totalSeconds % 60;
		return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
	};

	// WebRTC / Socket References
	const socketRef = useRef<any>(null)
	const localStreamRef = useRef<MediaStream | null>(null)
	const peersRef = useRef<{ [socketId: string]: RTCPeerConnection }>({})
	const screenStreamRef = useRef<MediaStream | null>(null)

	// Remote Peers State
	const [remotePeers, setRemotePeers] = useState<RemotePeer[]>([])

	// Handle input change and emit typing status
	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setNewMessageText(e.target.value)

		if (socketRef.current) {
			socketRef.current.emit("typing-start")

			if (typingTimeoutRef.current) {
				clearTimeout(typingTimeoutRef.current)
			}

			typingTimeoutRef.current = setTimeout(() => {
				socketRef.current?.emit("typing-stop")
			}, 1500)
		}
	}

	// Handle sending new chat message
	const handleSendMessage = (e: React.FormEvent) => {
		e.preventDefault()
		if (!newMessageText.trim() || !socketRef.current) return

		const textToSend = newMessageText.trim()
		setNewMessageText("")

		if (typingTimeoutRef.current) {
			clearTimeout(typingTimeoutRef.current)
		}
		socketRef.current.emit("typing-stop")

		socketRef.current.emit("send-message", { text: textToSend })
	}

	// Action: Toggle Local Screen Recording
	const handleToggleRecording = () => {
		if (isRecording) {
			stopRecording();
		} else {
			startRecording();
		}
	};

	const startRecording = () => {
		try {
			recordedChunksRef.current = [];
			const tracks: MediaStreamTrack[] = [];

			if (localStreamRef.current) {
				localStreamRef.current.getTracks().forEach(t => tracks.push(t));
			}

			remotePeers.forEach(peer => {
				if (peer.stream) {
					peer.stream.getTracks().forEach(t => tracks.push(t));
				}
			});

			if (tracks.length === 0) {
				alert("No active media streams found to record.");
				return;
			}

			const combinedStream = new MediaStream(tracks);
			const mediaRecorder = new MediaRecorder(combinedStream, {
				mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
					? 'video/webm;codecs=vp9'
					: 'video/webm'
			});

			mediaRecorder.ondataavailable = (event) => {
				if (event.data && event.data.size > 0) {
					recordedChunksRef.current.push(event.data);
				}
			};

			mediaRecorder.onstop = async () => {
				const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
				if (blob.size === 0) return;

				const confirmUpload = confirm(
					"Meeting recording stopped. Would you like to save this recording to Cloud Storage?"
				);

				if (confirmUpload) {
					await uploadRecordingToCloud(blob);
				} else {
					const url = URL.createObjectURL(blob);
					const a = document.createElement('a');
					a.style.display = 'none';
					a.href = url;
					a.download = `meeting-${meetingCode}-${Date.now()}.webm`;
					document.body.appendChild(a);
					a.click();
					setTimeout(() => {
						document.body.removeChild(a);
						window.URL.revokeObjectURL(url);
					}, 100);
				}
			};

			mediaRecorder.start(1000);
			mediaRecorderRef.current = mediaRecorder;
			setIsRecording(true);
		} catch (err) {
			console.error("Error starting recording:", err);
			alert("Failed to start local meeting recording.");
		}
	};

	const stopRecording = () => {
		if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
			mediaRecorderRef.current.stop();
		}
		setIsRecording(false);
	};

	const uploadRecordingToCloud = async (blob: Blob) => {
		try {
			const signatureRes = await api.get("/auth/cloudinary-signature");
			const { signature, timestamp, folder, cloudName, apiKey } = signatureRes.data;

			const formData = new FormData();
			formData.append("file", blob, `meeting-${meetingCode}.webm`);
			formData.append("api_key", apiKey);
			formData.append("timestamp", timestamp.toString());
			formData.append("signature", signature);
			formData.append("folder", folder);

			const uploadRes = await axios.post(
				`https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
				formData
			);

			const secureUrl = uploadRes.data.secure_url;

			if (meeting?._id) {
				await api.put(`/meetings/${meeting._id}`, {
					recordingUrl: secureUrl
				});
				alert("Meeting recording uploaded and attached successfully!");
			}
		} catch (err) {
			console.error("Error uploading recording:", err);
			alert("Failed to upload recording to cloud storage.");
		}
	};

	const isHostUser = (u: any) => {
		if (!meeting || !u) return false;
		const hostId = meeting.host?._id || meeting.host?.id || (typeof meeting.host === 'string' ? meeting.host : null);
		const targetId = u._id || u.id || (typeof u === 'string' ? u : null);
		return !!(hostId && targetId && hostId.toString() === targetId.toString());
	};

	// 1. Fetch meeting info from Backend on mount
	useEffect(() => {
		const fetchMeeting = async () => {
			if (!meetingCode) return
			try {
				const res = await api.get(`/meetings/${meetingCode}`)
				setMeeting(res.data.meeting)
				setMeetingTitle(res.data.meeting.title || "Virtual Meeting Room")
				setLoading(false)
			} catch (err: any) {
				console.error("Error fetching meeting:", err)
				setError(err.response?.data?.message || "Meeting not found or link has expired.")
				setLoading(false)
			}
		}
		fetchMeeting()
	}, [meetingCode])

	// 2. Initialize WebRTC, Local Media, and Socket Connections once joined
	useEffect(() => {
		if (loading || error || !user || !meetingCode || !hasJoinedRoom) return;

		let active = true;

		const startCall = async () => {
			try {
				const videoConstraints: boolean | MediaTrackConstraints = (videoDevices.length > 0 && selectedVideoId)
					? { deviceId: { exact: selectedVideoId } }
					: videoDevices.length > 0;

				const audioConstraints: boolean | MediaTrackConstraints = selectedAudioId
					? { deviceId: { exact: selectedAudioId } }
					: true;

				let stream: MediaStream;
				try {
					stream = await navigator.mediaDevices.getUserMedia({
						video: videoDevices.length > 0 && preJoinCameraOn ? videoConstraints : false,
						audio: audioConstraints
					});
				} catch (err) {
					console.warn("Retrying getUserMedia with audio-only fallback:", err);
					stream = await navigator.mediaDevices.getUserMedia({
						video: false,
						audio: true
					});
				}

				if (!preJoinMicOn) {
					stream.getAudioTracks().forEach(track => { track.enabled = false; });
					setIsAudioMuted(true);
				} else {
					setIsAudioMuted(false);
				}

				if (!preJoinCameraOn || videoDevices.length === 0) {
					stream.getVideoTracks().forEach(track => { track.enabled = false; });
					setIsVideoMuted(true);
				} else {
					setIsVideoMuted(false);
				}

				if (!active) {
					stream.getTracks().forEach(t => t.stop())
					return;
				}

				setLocalStream(stream)
				localStreamRef.current = stream;

				socketRef.current = io(API_BASE_URL, {
					withCredentials: true,
					transports: ["websocket", "polling"]
				})

				socketRef.current.emit("join-room", {
					meetingCode,
					user: {
						id: user.id || (user as any)._id,
						_id: (user as any)._id || user.id,
						name: user.name,
						email: user.email,
						avatar: user.avatar
					}
				})

				const handleExistingUsers = async (usersInRoom: { socketId: string; user: User }[]) => {
					console.log("Existing users in room:", usersInRoom)
					const uniqueUsers: { socketId: string; user: User }[] = [];
					const seenIds = new Set<string>();

					for (const u of usersInRoom) {
						const uId = u.user?._id || (u.user as any)?.id || u.socketId;
						if (!seenIds.has(uId)) {
							seenIds.add(uId);
							uniqueUsers.push(u);
						}
					}

					setRemotePeers(uniqueUsers.map(u => ({
						socketId: u.socketId,
						user: u.user,
						isAudioMuted: false,
						isVideoMuted: false
					})))

					for (const remote of uniqueUsers) {
						const pc = createPeerConnection(remote.socketId, remote.user)
						peersRef.current[remote.socketId] = pc;

						if (localStreamRef.current) {
							localStreamRef.current.getTracks().forEach(track => {
								pc.addTrack(track, localStreamRef.current!)
							})
						}

						const offer = await pc.createOffer()
						await pc.setLocalDescription(offer)

						socketRef.current.emit("offer", {
							to: remote.socketId,
							offer
						})
					}
				}

				socketRef.current.on("all-users", handleExistingUsers)
				socketRef.current.on("existing-users", handleExistingUsers)

				socketRef.current.on("user-joined", ({ socketId, user: joinedUser }: { socketId: string; user: User }) => {
					console.log("New user joined room:", joinedUser)
					const joinedUserId = joinedUser?._id || (joinedUser as any)?.id;
					setRemotePeers(prev => {
						const filtered = prev.filter(p => {
							if (p.socketId === socketId) return false;
							if (joinedUserId && ((p.user as any)?._id === joinedUserId || (p.user as any)?.id === joinedUserId)) return false;
							return true;
						});
						return [...filtered, {
							socketId,
							user: joinedUser,
							isAudioMuted: false,
							isVideoMuted: false
						}]
					})
				})

				socketRef.current.on("offer", async ({ from, offer, user: offerUser }: { from: string; offer: RTCSessionDescriptionInit; user: User }) => {
					console.log("Received WebRTC offer from:", offerUser?.email)
					let pc = peersRef.current[from]
					if (!pc) {
						pc = createPeerConnection(from, offerUser)
						peersRef.current[from] = pc;
					}

					if (localStreamRef.current) {
						const senders = pc.getSenders()
						if (senders.length === 0) {
							localStreamRef.current.getTracks().forEach(track => {
								pc.addTrack(track, localStreamRef.current!)
							})
						}
					}

					await pc.setRemoteDescription(new RTCSessionDescription(offer))
					const answer = await pc.createAnswer()
					await pc.setLocalDescription(answer)

					socketRef.current.emit("answer", {
						to: from,
						answer
					})
				})

				socketRef.current.on("answer", async ({ from, answer }: { from: string; answer: RTCSessionDescriptionInit }) => {
					console.log("Received WebRTC answer from:", from)
					const pc = peersRef.current[from]
					if (pc) {
						await pc.setRemoteDescription(new RTCSessionDescription(answer))
					}
				})

				socketRef.current.on("ice-candidate", async ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
					const pc = peersRef.current[from]
					if (pc) {
						try {
							await pc.addIceCandidate(new RTCIceCandidate(candidate))
						} catch (e) {
							console.error("Error adding ice candidate:", e)
						}
					}
				})

				socketRef.current.on("user-left", (data: any) => {
					const leftSocketId = typeof data === 'string' ? data : data?.socketId;
					const leftUser = typeof data === 'object' ? data?.user : null;
					const leftUserId = leftUser?._id || leftUser?.id;
					const userName = leftUser ? (leftUser.name || leftUser.email) : 'A participant';

					console.log("User left room:", leftSocketId, leftUserId)

					if (leftSocketId && peersRef.current[leftSocketId]) {
						peersRef.current[leftSocketId].close()
						delete peersRef.current[leftSocketId]
					}

					setRemotePeers(prev => prev.filter(p => {
						if (leftSocketId && p.socketId === leftSocketId) return false;
						if (leftUserId && ((p.user as any)?._id === leftUserId || (p.user as any)?.id === leftUserId)) return false;
						return true;
					}))

					// Show floating in-meeting alert box only (no persistent user notification)
					triggerRoomAlert(`🚪 ${userName} left the meeting`);
				})

				socketRef.current.on("meeting-ended", () => {
					console.log("Meeting was ended by host")
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
					alert("The host has ended the meeting for all participants.")
					navigate(`/meetings/history/${meetingCode}`)
				})

				socketRef.current.on("user-media-toggled", ({ socketId, isAudioMuted: audioMuted, isVideoMuted: videoMuted }: { socketId: string; isAudioMuted: boolean; isVideoMuted: boolean }) => {
					setRemotePeers(prev => prev.map(p => {
						if (p.socketId === socketId) {
							return { ...p, isAudioMuted: audioMuted, isVideoMuted: videoMuted }
						}
						return p;
					}))
				})

				socketRef.current.on("user-screen-toggled", ({ socketId, isScreenSharing: screenSharing }: { socketId: string; isScreenSharing: boolean }) => {
					setRemotePeers(prev => prev.map(p => {
						if (p.socketId === socketId) {
							return { ...p, isScreenSharing: screenSharing }
						}
						return p;
					}))
				})

				socketRef.current.on("user-typing", ({ socketId, userName, isTyping }: { socketId: string; userName?: string; isTyping: boolean }) => {
					setTypingUsers(prev => {
						const updated = { ...prev }
						if (isTyping && userName) {
							updated[socketId] = userName
						} else {
							delete updated[socketId]
						}
						return updated
					})
				})

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
	}, [loading, error, user, meetingCode, hasJoinedRoom])

	const createPeerConnection = (targetSocketId: string, peerUser: User) => {
		const pc = new RTCPeerConnection(ICE_SERVERS)

		pc.onicecandidate = (event) => {
			if (event.candidate && socketRef.current) {
				socketRef.current.emit("ice-candidate", {
					to: targetSocketId,
					candidate: event.candidate
				})
			}
		}

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

	const handleToggleScreen = async () => {
		if (isScreenSharing) {
			stopScreenSharing()
		} else {
			try {
				const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true })
				screenStreamRef.current = screenStream;
				const screenTrack = screenStream.getVideoTracks()[0]

				for (const socketId in peersRef.current) {
					const pc = peersRef.current[socketId]
					const senders = pc.getSenders()
					const videoSender = senders.find(sender => sender.track?.kind === "video")
					if (videoSender) {
						videoSender.replaceTrack(screenTrack)
					}
				}

				screenTrack.onended = () => {
					stopScreenSharing()
				}

				setIsScreenSharing(true)
				socketRef.current?.emit("screen-share-toggled", { isScreenSharing: true })
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
		socketRef.current?.emit("screen-share-toggled", { isScreenSharing: false })
	}

	const copyInviteLink = () => {
		const link = window.location.href;
		navigator.clipboard.writeText(link)
		setCopied(true)
		setTimeout(() => setCopied(false), 2000)
	}

	const handleLeaveMeeting = () => {
		if (isRecording) {
			stopRecording();
		}
		navigate(`/meetings/history/${meetingCode}`)
	}

	const handleEndMeetingForAll = async () => {
		if (!confirm("Are you sure you want to end this meeting for all participants?")) return;

		if (isRecording) {
			stopRecording();
		}

		try {
			if (socketRef.current) {
				socketRef.current.emit("end-meeting", { meetingCode })
			}
			if (meeting) {
				await api.put(`/meetings/${meeting._id}`, {
					status: 'completed',
					endTime: new Date().toISOString()
				})
			}
		} catch (err) {
			console.error("Error ending meeting:", err)
		} finally {
			navigate(`/meetings/history/${meetingCode}`)
		}
	}

	if (loading) {
		return (
			<div className="flex flex-col items-center justify-center min-h-screen bg-bg-app text-text-primary">
				<div className="relative flex items-center justify-center mb-6">
					<div className="h-16 w-16 rounded-full border-[3px] border-border-default" />
					<div className="absolute h-16 w-16 rounded-full border-t-[3px] border-brand-primary animate-spin" />
					<div className="absolute h-8 w-8 rounded-full bg-brand-primary/20 border border-border-brand/30 animate-pulse" />
				</div>
				<h3 className="text-lg font-semibold text-text-primary">Joining Room...</h3>
				<p className="text-xs text-text-muted mt-1">Securing peer signaling networks</p>
			</div>
		)
	}

	if (error) {
		return (
			<div className="flex flex-col items-center justify-center min-h-screen bg-bg-app text-text-primary px-4 text-center">
				<div className="h-14 w-14 rounded-2xl bg-status-danger/10 border border-status-danger/20 flex items-center justify-center text-status-danger mb-6 shadow-lg">
					<WarningIcon size={24} />
				</div>
				<h3 className="text-xl font-bold text-text-primary">Unable to Join Meeting</h3>
				<p className="text-sm text-text-muted mt-2 max-w-sm leading-relaxed">{error}</p>
				<button
					onClick={() => navigate("/dashboard")}
					className="mt-6 px-6 py-2 bg-bg-surface border border-border-default hover:bg-bg-surface-hover rounded-xl text-xs font-semibold text-text-primary transition-all active:scale-[0.98] cursor-pointer"
				>
					Return to Dashboard
				</button>
			</div>
		)
	}

	const totalParticipants = remotePeers.length + 1;
	let gridClass = "grid-cols-1";
	if (totalParticipants === 2) gridClass = "grid-cols-1 md:grid-cols-2";
	else if (totalParticipants >= 3 && totalParticipants <= 4) gridClass = "grid-cols-1 md:grid-cols-2";
	else if (totalParticipants > 4) gridClass = "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";

	return (
		<div className="fixed inset-0 min-h-screen bg-bg-app text-text-primary flex flex-col z-[100] overflow-hidden font-sans">
			{/* Ambient glows */}
			<div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full bg-brand-primary/5 blur-3xl pointer-events-none" />
			<div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full bg-brand-secondary/5 blur-3xl pointer-events-none" />

			{/* Top Bar Header */}
			<header className="h-16 px-6 border-b border-border-default bg-bg-surface/80 backdrop-blur-xl flex items-center justify-between z-10 shadow-sm relative">
				{/* Floating In-Meeting Alert Box */}
				{roomAlert && (
					<div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-bg-modal/95 border border-border-brand/40 text-text-primary text-xs font-semibold rounded-2xl shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2 flex items-center gap-2">
						<span className="h-2 w-2 rounded-full bg-status-warning animate-ping" />
						<span>{roomAlert.message}</span>
					</div>
				)}
				<div className="flex items-center gap-3">
					<div className="h-8 w-8 rounded-lg bg-brand-primary/10 border border-border-brand/20 flex items-center justify-center text-text-brand">
						<SparklesIcon size={16} />
					</div>
					<div>
						<h2 className="font-bold text-sm text-text-primary truncate max-w-xs md:max-w-md">{meetingTitle}</h2>
						<span className="text-[10px] text-text-muted flex items-center gap-1.5 uppercase font-semibold tracking-wider">
							<span className="h-1.5 w-1.5 rounded-full bg-status-success animate-pulse" />
							P2P Secure Mesh
						</span>
					</div>
				</div>

				<div className="flex items-center gap-3">
					{/* Live Recording Badge */}
					{isRecording && (
						<div className="flex items-center gap-2 px-3 py-1 bg-status-danger/10 border border-status-danger/30 rounded-xl text-xs font-semibold text-status-danger animate-pulse">
							<span className="h-2 w-2 rounded-full bg-status-danger" />
							<span>REC {formatRecordingTime(recordingTime)}</span>
						</div>
					)}

					{/* Meeting Code Badge */}
					<div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-bg-app border border-border-default rounded-xl">
						<span className="text-xs text-text-muted font-mono select-all">{meetingCode}</span>
						<button
							onClick={copyInviteLink}
							className="text-text-muted hover:text-text-primary transition-colors cursor-pointer"
							title="Copy invite link"
						>
							{copied ? <CheckIcon className="text-status-success" size={14} /> : <CopyIcon size={14} />}
						</button>
					</div>

					{/* Participants Count Toggle */}
					<button
						onClick={() => {
							setShowParticipants(!showParticipants)
							if (!showParticipants) setShowChat(false)
						}}
						className={`px-3 py-1 text-xs font-medium rounded-xl border transition-all cursor-pointer ${showParticipants
								? "bg-brand-primary/10 border-border-brand/30 text-text-brand"
								: "bg-bg-surface border-border-default text-text-muted hover:text-text-primary"
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
								? "bg-brand-primary/10 border-border-brand/30 text-text-brand"
								: "bg-bg-surface border-border-default text-text-muted hover:text-text-primary"
							}`}
					>
						<ChatIcon size={14} />
						<span>Chat</span>
						{unreadCount > 0 && (
							<span className="h-4 w-4 rounded-full bg-brand-primary text-text-inverse text-[10px] font-bold flex items-center justify-center animate-pulse">
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
					<aside className="w-80 border-l border-border-default bg-bg-sidebar/90 backdrop-blur-xl flex flex-col z-10 shadow-xl">
						<div className="p-4 border-b border-border-subtle">
							<h3 className="font-bold text-sm text-text-primary">Room Participants</h3>
							<p className="text-[11px] text-text-muted">Connected to room {meetingCode}</p>
						</div>

						<div className="flex-1 overflow-y-auto p-4 space-y-4">
							{/* Local User Row */}
							<div className="flex items-center justify-between p-2 rounded-xl bg-bg-surface border border-border-subtle">
								<div className="flex items-center gap-3">
									{user?.avatar ? (
										<img src={user.avatar} className="h-8 w-8 rounded-lg object-cover border border-border-subtle" />
									) : (
										<div className="h-8 w-8 rounded-lg bg-brand-primary/10 border border-border-brand/20 flex items-center justify-center text-xs font-bold text-text-brand">
											{user?.name ? (user.name.trim().split(/\s+/).length >= 2 ? (user.name.trim().split(/\s+/)[0][0] + user.name.trim().split(/\s+/)[1][0]).toUpperCase() : user.name.substring(0, 2).toUpperCase()) : "ME"}
										</div>
									)}
									<div className="overflow-hidden">
										<p className="text-xs font-semibold text-text-primary truncate">{user?.name || user?.email} (You)</p>
										{isHostUser(user) && (
											<p className="text-[10px] text-text-brand font-semibold truncate">Host</p>
										)}
									</div>
								</div>
								<div className="flex gap-1.5">
									<span className={`p-1 rounded bg-bg-app text-xs ${isAudioMuted ? "text-status-danger" : "text-status-success"}`}>
										<MicIcon size={12} />
									</span>
									<span className={`p-1 rounded bg-bg-app text-xs ${isVideoMuted ? "text-status-danger" : "text-status-success"}`}>
										<VideoIcon size={12} />
									</span>
								</div>
							</div>

							{/* Remote Users Rows */}
							{remotePeers.map(peer => {
								const peerName = peer.user?.name || peer.user?.email || "Participant";
								const peerAvatar = peer.user?.avatar;
								const peerInitials = peerName.trim().split(/\s+/).length >= 2
									? (peerName.trim().split(/\s+/)[0][0] + peerName.trim().split(/\s+/)[1][0]).toUpperCase()
									: peerName.substring(0, 2).toUpperCase();

								return (
									<div key={peer.socketId} className="flex items-center justify-between p-2 rounded-xl bg-bg-surface-hover/30 hover:bg-bg-surface-hover border border-transparent transition-all">
										<div className="flex items-center gap-3">
											{peerAvatar ? (
												<img src={peerAvatar} className="h-8 w-8 rounded-lg object-cover border border-border-subtle" />
											) : (
												<div className="h-8 w-8 rounded-lg bg-brand-primary/10 border border-border-brand/20 flex items-center justify-center text-xs font-bold text-text-brand">
													{peerInitials}
												</div>
											)}
											<div className="overflow-hidden">
												<p className="text-xs font-semibold text-text-primary truncate">{peerName}</p>
												{isHostUser(peer.user) && (
													<p className="text-[10px] text-text-brand font-semibold truncate">Host</p>
												)}
											</div>
										</div>
										<div className="flex gap-1.5">
											<span className={`p-1 rounded bg-bg-app text-xs ${peer.isAudioMuted ? "text-status-danger" : "text-status-success"}`}>
												<MicIcon size={12} />
											</span>
											<span className={`p-1 rounded bg-bg-app text-xs ${peer.isVideoMuted ? "text-status-danger" : "text-status-success"}`}>
												<VideoIcon size={12} />
											</span>
										</div>
									</div>
								);
							})}
						</div>
					</aside>
				)}

				{/* Collapsible Right Sidebar: In-Meeting Chat */}
				{showChat && (
					<aside className="w-80 sm:w-96 border-l border-border-default bg-bg-modal/95 backdrop-blur-xl flex flex-col z-20 shadow-2xl">
						<div className="p-4 border-b border-border-subtle flex items-center justify-between">
							<div>
								<h3 className="font-bold text-sm text-text-primary">In-Meeting Chat</h3>
								<p className="text-[11px] text-text-muted">Messages are visible to everyone</p>
							</div>
							<button
								onClick={() => setShowChat(false)}
								className="text-text-muted hover:text-text-primary text-xs px-2 py-1 rounded-lg hover:bg-bg-surface-hover transition-colors cursor-pointer"
							>
								✕
							</button>
						</div>

						{/* Message History List */}
						<div className="flex-1 overflow-y-auto p-4 space-y-3.5">
							{messages.length === 0 ? (
								<div className="h-full flex flex-col items-center justify-center text-center p-6 text-text-muted">
									<ChatIcon size={32} className="opacity-30 mb-2" />
									<p className="text-xs font-medium text-text-secondary">No messages yet</p>
									<p className="text-[11px] text-text-muted mt-1">Send a message to start chatting with participants</p>
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
												<span className="text-[11px] font-semibold text-text-muted">
													{isMe ? "You" : msg.senderName}
												</span>
												<span className="text-[10px] text-text-subtle">{msg.timestamp}</span>
											</div>
											<div
												className={`px-3 py-2 rounded-2xl text-xs max-w-[85%] break-words shadow-sm ${isMe
														? "bg-brand-primary text-text-inverse rounded-tr-none"
														: "bg-bg-surface border border-border-default text-text-primary rounded-tl-none"
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

						{/* Typing Indicator Banner */}
						{Object.keys(typingUsers).length > 0 && (
							<div className="px-4 py-1.5 bg-bg-surface/60 border-t border-border-subtle flex items-center gap-2 text-[11px] text-text-brand font-medium tracking-wide">
								<div className="flex items-center gap-1">
									<span className="h-1.5 w-1.5 rounded-full bg-brand-primary animate-bounce [animation-delay:-0.3s]" />
									<span className="h-1.5 w-1.5 rounded-full bg-brand-primary animate-bounce [animation-delay:-0.15s]" />
									<span className="h-1.5 w-1.5 rounded-full bg-brand-primary animate-bounce" />
								</div>
								<span className="truncate">
									{Object.values(typingUsers).join(", ")} {Object.keys(typingUsers).length === 1 ? "is typing..." : "are typing..."}
								</span>
							</div>
						)}

						{/* Message Input Form using Shadcn Input & Button */}
						<form onSubmit={handleSendMessage} className="p-3 border-t border-border-subtle bg-bg-surface flex items-center gap-2">
							<Input
								type="text"
								value={newMessageText}
								onChange={handleInputChange}
								placeholder="Type a message..."
								className="flex-1 bg-bg-input border-border-default focus-visible:border-border-brand text-xs text-text-primary placeholder:text-text-subtle rounded-xl px-3 py-2.5 transition-all"
							/>
							<Button
								type="submit"
								size="icon"
								disabled={!newMessageText.trim()}
								className="p-2.5 bg-brand-primary hover:bg-brand-primary-hover disabled:opacity-40 disabled:hover:bg-brand-primary text-text-inverse rounded-xl transition-all cursor-pointer shadow-md flex items-center justify-center"
								title="Send Message"
							>
								<SendIcon size={16} />
							</Button>
						</form>

					</aside>
				)}
			</div>

			{/* Bottom Controls Bar */}
			<footer className="min-h-[4.5rem] py-3 px-3 sm:px-6 bg-bg-surface/90 border-t border-border-default backdrop-blur-md flex items-center justify-center z-10 shadow-lg">
				<div className="flex items-center flex-wrap justify-center gap-2.5 sm:gap-4">

					{/* Mute Mic Button */}
					<button
						onClick={handleToggleAudio}
						aria-label={isAudioMuted ? "Unmute Microphone" : "Mute Microphone"}
						aria-pressed={isAudioMuted}
						className={`p-2.5 sm:p-3 rounded-full border transition-all cursor-pointer shadow-md ${isAudioMuted
								? "bg-status-danger/20 border-status-danger/40 text-status-danger hover:bg-status-danger/30"
								: "bg-bg-surface-hover border-border-default text-text-primary hover:bg-bg-surface"
							}`}
						title={isAudioMuted ? "Unmute Mic" : "Mute Mic"}
					>
						<MicIcon size={20} />
					</button>

					{/* Toggle Camera Button */}
					<button
						onClick={handleToggleVideo}
						disabled={videoDevices.length === 0}
						aria-label={isVideoMuted ? "Turn Camera On" : "Turn Camera Off"}
						aria-pressed={isVideoMuted}
						className={`p-2.5 sm:p-3 rounded-full border transition-all shadow-md ${
							videoDevices.length === 0
								? "bg-bg-surface-hover/40 border-border-subtle text-text-subtle opacity-40 cursor-not-allowed"
								: isVideoMuted
								? "bg-status-danger/20 border-status-danger/40 text-status-danger hover:bg-status-danger/30 cursor-pointer"
								: "bg-bg-surface-hover border-border-default text-text-primary hover:bg-bg-surface cursor-pointer"
							}`}
						title={videoDevices.length === 0 ? "No camera device available" : isVideoMuted ? "Turn Camera On" : "Turn Camera Off"}
					>
						<VideoIcon size={20} />
					</button>

					{/* Share Screen Button */}
					<button
						onClick={handleToggleScreen}
						aria-label={isScreenSharing ? "Stop Sharing Screen" : "Share Screen"}
						aria-pressed={isScreenSharing}
						className={`p-2.5 sm:p-3 rounded-full border transition-all cursor-pointer shadow-md ${isScreenSharing
								? "bg-brand-primary/20 border-border-brand/40 text-text-brand hover:bg-brand-primary/30"
								: "bg-bg-surface-hover border-border-default text-text-primary hover:bg-bg-surface"
							}`}
						title={isScreenSharing ? "Stop Screen Share" : "Share Screen"}
					>
						<ScreenShareIcon size={20} />
					</button>

					{/* Record Meeting Button */}
					<button
						onClick={handleToggleRecording}
						aria-label={isRecording ? `Stop Recording (${formatRecordingTime(recordingTime)})` : "Record Meeting"}
						aria-pressed={isRecording}
						className={`p-2.5 sm:p-3 rounded-full border transition-all cursor-pointer shadow-md relative ${isRecording
								? "bg-status-danger/20 border-status-danger/40 text-status-danger hover:bg-status-danger/30 animate-pulse"
								: "bg-bg-surface-hover border-border-default text-text-primary hover:bg-bg-surface"
							}`}
						title={isRecording ? `Stop Recording (${formatRecordingTime(recordingTime)})` : "Record Meeting"}
					>
						{isRecording ? <StopRecordIcon size={20} /> : <RecordIcon size={20} />}
					</button>

					{/* Chat Toggle Button */}
					<button
						onClick={() => {
							setShowChat(!showChat)
							if (!showChat) setShowParticipants(false)
						}}
						aria-label={`In-Meeting Chat ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
						aria-expanded={showChat}
						className={`relative p-2.5 sm:p-3 rounded-full border transition-all cursor-pointer shadow-md ${showChat
								? "bg-brand-primary/20 border-border-brand/40 text-text-brand hover:bg-brand-primary/30"
								: "bg-bg-surface-hover border-border-default text-text-primary hover:bg-bg-surface"
							}`}
						title="In-Meeting Chat"
					>
						<ChatIcon size={20} />
						{unreadCount > 0 && (
							<span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-brand-primary text-text-inverse text-[10px] font-bold flex items-center justify-center border-2 border-bg-surface animate-pulse">
								{unreadCount}
							</span>
						)}
					</button>

					{/* Copy Invite Link Button */}
					<button
						onClick={copyInviteLink}
						aria-label="Copy meeting link"
						className={`sm:hidden p-2.5 sm:p-3 rounded-full border transition-all cursor-pointer shadow-md ${copied
								? "bg-status-success/20 border-status-success/40 text-status-success"
								: "bg-bg-surface-hover border-border-default text-text-primary"
							}`}
						title="Copy Meeting Link"
					>
						{copied ? <CheckIcon size={20} /> : <CopyIcon size={20} />}
					</button>

					{/* End Call / Leave Buttons */}
					{meeting && user && (meeting.host?._id === user.id || meeting.host === user.id || meeting.host?.id === user.id) ? (
						<>
							<button
								onClick={handleLeaveMeeting}
								aria-label="Leave Room"
								className="px-4 sm:px-5 py-2.5 sm:py-3 bg-bg-surface-hover border border-border-default hover:bg-bg-surface active:scale-[0.98] text-text-primary font-semibold rounded-full transition-all flex items-center gap-1.5 cursor-pointer shadow-md text-xs sm:text-sm"
								title="Leave Room (Keep Call Active)"
							>
								<span>Leave</span>
							</button>
							<button
								onClick={handleEndMeetingForAll}
								aria-label="End Meeting for All"
								className="px-4 sm:px-6 py-2.5 sm:py-3 bg-status-danger hover:bg-status-danger/90 active:scale-[0.98] text-text-inverse font-semibold rounded-full border border-status-danger/20 transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-status-danger/20 text-xs sm:text-sm"
								title="End Meeting for All Participants"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									fill="currentColor"
									viewBox="0 0 24 24"
									className="h-4 w-4 sm:h-5 sm:w-5"
								>
									<path d="M21 16.5c0 .38-.21.71-.53.88l-3.37 2c-.32.19-.72.16-1.02-.07l-2.01-1.5c-.32-.24-.47-.64-.38-1.03l.63-2.61c.09-.37-.02-.76-.3-1.04-1.25-1.25-2.73-2.26-4.37-3-.28-.13-.61-.13-.88 0-1.64.74-3.12 1.75-4.37 3-.28.28-.39.67-.3 1.04l.63 2.61c.09.39-.06.79-.38 1.03l-2.01 1.5c-.3.23-.7.26-1.02.07l-3.37-2c-.32-.17-.53-.5-.53-.88 0-.55.45-1 1-1 3.51 0 6.82-1.37 9.3-3.69l1.45-1.45c.39-.39 1.02-.39 1.41 0l1.45 1.45c2.48 2.32 5.79 3.69 9.3 3.69.55 0 1 .45 1 1z" />
								</svg>
								<span>End for All</span>
							</button>
						</>
					) : (
						<button
							onClick={handleLeaveMeeting}
							aria-label="Leave Meeting"
							className="px-4 sm:px-6 py-2.5 sm:py-3 bg-status-danger hover:bg-status-danger/90 active:scale-[0.98] text-text-inverse font-semibold rounded-full border border-status-danger/20 transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-status-danger/20 text-xs sm:text-sm"
							title="Leave Call"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								fill="currentColor"
								viewBox="0 0 24 24"
								className="h-4 w-4 sm:h-5 sm:w-5"
							>
								<path d="M21 16.5c0 .38-.21.71-.53.88l-3.37 2c-.32.19-.72.16-1.02-.07l-2.01-1.5c-.32-.24-.47-.64-.38-1.03l.63-2.61c.09-.37-.02-.76-.3-1.04-1.25-1.25-2.73-2.26-4.37-3-.28-.13-.61-.13-.88 0-1.64.74-3.12 1.75-4.37 3-.28.28-.39.67-.3 1.04l.63 2.61c.09.39-.06.79-.38 1.03l-2.01 1.5c-.3.23-.7.26-1.02.07l-3.37-2c-.32-.17-.53-.5-.53-.88 0-.55.45-1 1-1 3.51 0 6.82-1.37 9.3-3.69l1.45-1.45c.39-.39 1.02-.39 1.41 0l1.45 1.45c2.48 2.32 5.79 3.69 9.3 3.69.55 0 1 .45 1 1z" />
							</svg>
							<span>Leave</span>
						</button>
					)}

				</div>
			</footer>

			{/* Pre-Join Device Configuration Modal */}
			{!hasJoinedRoom && !loading && !error && (
				<div className="fixed inset-0 z-[200] bg-bg-modal/90 backdrop-blur-2xl flex items-center justify-center p-4 sm:p-6 overflow-y-auto font-sans">
					<div className="bg-bg-surface border border-border-default rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 my-auto">
						<div className="text-center space-y-1.5">
							<div className="h-12 w-12 rounded-2xl bg-brand-primary/10 border border-border-brand/20 text-text-brand flex items-center justify-center mx-auto text-xl mb-3 shadow-md">
								<SparklesIcon size={24} />
							</div>
							<h2 className="text-xl font-bold text-text-primary tracking-tight">Audio & Video Setup</h2>
							<p className="text-xs text-text-muted">Configure your devices and preferences before joining the call</p>
						</div>

						{/* Video Preview Container */}
						<div className="relative h-48 w-full bg-black/60 border border-border-subtle rounded-2xl overflow-hidden flex items-center justify-center shadow-inner">
							{preJoinCameraOn && previewStream ? (
								<CameraPreview stream={previewStream} />
							) : (
								<div className="flex flex-col items-center gap-2 text-text-muted">
									<div className="h-14 w-14 rounded-full bg-bg-surface/80 border border-border-default flex items-center justify-center text-sm font-bold text-text-secondary overflow-hidden">
										{user?.avatar ? (
											<img src={user.avatar} className="h-full w-full object-cover" />
										) : (
											user?.name?.substring(0, 2).toUpperCase() || "ME"
										)}
									</div>
									<p className="text-xs font-medium">Camera is turned off</p>
								</div>
							)}
							
							{/* Status Badge */}
							<div className="absolute bottom-3 left-3 px-2.5 py-1 bg-bg-modal/80 backdrop-blur-md rounded-xl text-[11px] font-medium text-text-primary border border-border-subtle flex items-center gap-2">
								<MicIcon size={12} className={preJoinMicOn ? "text-status-success" : "text-status-danger"} />
								<span>{preJoinMicOn ? "Microphone Ready" : "Microphone Muted"}</span>
							</div>
						</div>

						{/* Device Toggles */}
						<div className="grid grid-cols-2 gap-3">
							{/* Mic Toggle Switch (Off by default) */}
							<button
								type="button"
								onClick={() => setPreJoinMicOn(!preJoinMicOn)}
								disabled={audioDevices.length === 0}
								className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all ${
									audioDevices.length === 0
										? "bg-bg-app border-border-subtle text-text-subtle opacity-50 cursor-not-allowed"
										: preJoinMicOn
										? "bg-brand-primary/10 border-border-brand/40 text-text-brand cursor-pointer"
										: "bg-bg-surface-hover/50 border-border-default text-text-muted hover:text-text-primary cursor-pointer"
								}`}
							>
								<div className="flex items-center gap-2.5">
									<MicIcon size={18} />
									<span className="text-xs font-semibold">Microphone</span>
								</div>
								<span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
									preJoinMicOn ? "bg-brand-primary text-text-inverse" : "bg-bg-app text-text-muted"
								}`}>
									{preJoinMicOn ? "ON" : "OFF"}
								</span>
							</button>

							{/* Camera Toggle Switch (Off by default, disabled if no camera) */}
							<button
								type="button"
								onClick={() => {
									if (videoDevices.length > 0) {
										setPreJoinCameraOn(!preJoinCameraOn)
									}
								}}
								disabled={videoDevices.length === 0}
								className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all ${
									videoDevices.length === 0
										? "bg-bg-app border-border-subtle text-text-subtle opacity-50 cursor-not-allowed"
										: preJoinCameraOn
										? "bg-brand-primary/10 border-border-brand/40 text-text-brand cursor-pointer"
										: "bg-bg-surface-hover/50 border-border-default text-text-muted hover:text-text-primary cursor-pointer"
								}`}
								title={videoDevices.length === 0 ? "No camera device available" : undefined}
							>
								<div className="flex items-center gap-2.5">
									<VideoIcon size={18} />
									<span className="text-xs font-semibold">Camera</span>
								</div>
								<span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
									videoDevices.length === 0
										? "bg-status-danger/10 text-status-danger"
										: preJoinCameraOn ? "bg-brand-primary text-text-inverse" : "bg-bg-app text-text-muted"
								}`}>
									{videoDevices.length === 0 ? "NONE" : preJoinCameraOn ? "ON" : "OFF"}
								</span>
							</button>
						</div>

						{/* Device Dropdown Selectors */}
						<div className="space-y-3 pt-1">
							{/* Microphone Select */}
							<div className="space-y-1.5">
								<label className="text-[11px] font-bold uppercase tracking-wider text-text-muted flex items-center justify-between">
									<span>Microphone Device</span>
									<span className="text-[10px] font-normal lowercase text-text-subtle">
										{audioDevices.length} detected
									</span>
								</label>
								<select
									value={selectedAudioId}
									onChange={(e) => setSelectedAudioId(e.target.value)}
									disabled={audioDevices.length === 0}
									className="w-full px-3 py-2 bg-bg-input border border-border-default rounded-xl text-xs text-text-primary focus:outline-none focus:border-border-brand disabled:opacity-50"
								>
									{audioDevices.length === 0 ? (
										<option value="">No microphone device detected</option>
									) : (
										audioDevices.map((d, i) => (
											<option key={d.deviceId || i} value={d.deviceId}>
												{d.label || `Microphone ${i + 1}`}
											</option>
										))
									)}
								</select>
							</div>

							{/* Camera Select */}
							<div className="space-y-1.5">
								<label className="text-[11px] font-bold uppercase tracking-wider text-text-muted flex items-center justify-between">
									<span>Camera Device</span>
									<span className="text-[10px] font-normal lowercase text-text-subtle">
										{videoDevices.length} detected
									</span>
								</label>
								<select
									value={selectedVideoId}
									onChange={(e) => setSelectedVideoId(e.target.value)}
									disabled={videoDevices.length === 0}
									className="w-full px-3 py-2 bg-bg-input border border-border-default rounded-xl text-xs text-text-primary focus:outline-none focus:border-border-brand disabled:opacity-50"
								>
									{videoDevices.length === 0 ? (
										<option value="">No camera device detected</option>
									) : (
										videoDevices.map((d, i) => (
											<option key={d.deviceId || i} value={d.deviceId}>
												{d.label || `Camera ${i + 1}`}
											</option>
										))
									)}
								</select>
							</div>
						</div>

						{/* Guard Alerts */}
						{audioDevices.length === 0 && (
							<div className="p-3 bg-status-danger/10 border border-status-danger/30 rounded-xl flex items-start gap-2.5 text-status-danger text-xs">
								<WarningIcon size={18} className="shrink-0 mt-0.5" />
								<div>
									<p className="font-bold">Microphone Required</p>
									<p className="text-[11px] opacity-90">At least one audio input microphone device must be connected to join this meeting.</p>
								</div>
							</div>
						)}

						{videoDevices.length === 0 && (
							<div className="p-2.5 bg-bg-surface-hover/60 border border-border-subtle rounded-xl text-text-muted text-[11px] flex items-center gap-2">
								<VideoIcon size={14} className="shrink-0 text-text-subtle" />
								<span>No camera device detected on your system. Camera toggle is disabled.</span>
							</div>
						)}

						{/* Actions */}
						<div className="pt-2 flex items-center gap-3">
							<Button
								type="button"
								variant="outline"
								onClick={() => navigate('/meetings/history')}
								className="flex-1 py-2.5 bg-bg-surface border border-border-default hover:bg-bg-surface-hover rounded-xl text-xs font-semibold text-text-primary transition-all cursor-pointer"
							>
								Cancel
							</Button>
							<Button
								type="button"
								onClick={handleConfirmJoin}
								disabled={audioDevices.length === 0}
								className="flex-1 py-2.5 bg-gradient-to-r from-brand-primary to-brand-secondary text-text-inverse font-semibold text-xs rounded-xl shadow-lg shadow-brand-primary/20 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
							>
								Join Meeting Now
							</Button>
						</div>
					</div>
				</div>
			)}

		</div>
	)
}

// Sub-component: Video stream preview inside pre-join modal
function CameraPreview({ stream }: { stream: MediaStream | null }) {
	const videoRef = useRef<HTMLVideoElement | null>(null);

	useEffect(() => {
		if (videoRef.current && stream) {
			videoRef.current.srcObject = stream;
		}
	}, [stream]);

	if (!stream) return null;

	return (
		<video
			ref={videoRef}
			autoPlay
			playsInline
			muted
			className="w-full h-full object-cover rounded-2xl transform -scale-x-100"
		/>
	);
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

	const initials = name && name !== "Participant" && name !== "User"
		? (name.trim().split(/\s+/).length >= 2
			? (name.trim().split(/\s+/)[0][0] + name.trim().split(/\s+/)[1][0]).toUpperCase()
			: name.substring(0, 2).toUpperCase())
		: "PA";

	return (
		<div className="relative aspect-video bg-bg-surface border border-border-default rounded-2xl overflow-hidden shadow-lg group">

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
				<div className="absolute inset-0 flex flex-col items-center justify-center bg-bg-surface/80 backdrop-blur-md">
					{avatar ? (
						<img
							src={avatar}
							alt={name}
							className="h-20 w-20 rounded-full border border-border-default object-cover shadow-2xl animate-pulse"
						/>
					) : (
						<div className="h-20 w-20 rounded-full bg-gradient-to-br from-brand-primary/20 to-brand-secondary/20 border border-border-brand/30 flex items-center justify-center font-bold text-2xl text-text-brand shadow-2xl">
							{initials}
						</div>
					)}
					<span className="text-text-muted text-[11px] font-semibold tracking-wider uppercase mt-4">{name}</span>
				</div>
			)}

			{/* Label / Audio Muted overlays */}
			<div className="absolute bottom-4 left-4 right-4 flex items-center justify-between pointer-events-none z-10">
				<span className="px-3 py-1 text-[11px] font-semibold text-text-primary bg-bg-modal/80 border border-border-default backdrop-blur-md rounded-full shadow-md flex items-center gap-1.5">
					{isLocal && <span className="h-1.5 w-1.5 rounded-full bg-brand-primary animate-pulse" />}
					{label}
				</span>

				{isMuted && (
					<span className="p-1.5 rounded-full bg-status-danger/20 border border-status-danger/30 text-status-danger backdrop-blur-md shadow-md">
						<MicIcon size={12} />
					</span>
				)}
			</div>
		</div>
	)
}
