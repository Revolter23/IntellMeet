import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router"
import { api } from "../lib/api"
import {
  CalendarIcon,
  VideoIcon,
  SparklesIcon,
  WarningIcon
} from "../lib/icons"

interface User {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
}

interface Participant {
  user: User;
  role: 'host' | 'co-host' | 'presenter' | 'attendee';
  joinedAt: string;
  leftAt?: string;
}

interface ActionItem {
  _id?: string;
  task: string;
  assignee?: User;
  assigneeName?: string;
  status: 'pending' | 'completed';
}

interface TranscriptSegment {
  _id?: string;
  speaker?: User;
  speakerName?: string;
  text: string;
  timestamp: string;
}

interface Meeting {
  _id: string;
  title: string;
  description?: string;
  meetingCode: string;
  startTime: string;
  endTime?: string;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  host: User;
  participants: Participant[];
  recordingUrl?: string;
  summary?: string;
  actionItems?: ActionItem[];
  transcript?: TranscriptSegment[];
}

export default function PostMeetingDashboard() {
  const { meetingCode } = useParams<{ meetingCode: string }>()
  const navigate = useNavigate()
  
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Tab states for the main content area
  const [activeTab, setActiveTab] = useState<'insights' | 'transcript'>('insights')

  // Action item to Kanban task conversion states
  const [convertingActionItem, setConvertingActionItem] = useState<ActionItem | null>(null)
  const [workspaces, setWorkspaces] = useState<any[]>([])
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('')
  const [boards, setBoards] = useState<any[]>([])
  const [selectedBoardId, setSelectedBoardId] = useState('')
  const [workspaceMembers, setWorkspaceMembers] = useState<any[]>([])
  const [selectedAssigneeId, setSelectedAssigneeId] = useState('')
  const [targetColumnId, setTargetColumnId] = useState('col-todo')
  const [taskPriority, setTaskPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('HIGH')
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDesc, setTaskDesc] = useState('')
  const [convertLoading, setConvertLoading] = useState(false)
  const [convertSuccessMsg, setConvertSuccessMsg] = useState('')

  const openConvertModal = async (item: ActionItem) => {
    setConvertingActionItem(item)
    setTaskTitle(item.task)
    setTaskDesc(`Action item extracted from meeting: ${meeting?.title || ''}`)
    setConvertSuccessMsg('')
    try {
      const wsRes = await api.get('/api/workspaces')
      const wsList = wsRes.data || []
      setWorkspaces(wsList)
      if (wsList.length > 0) {
        const firstWs = wsList[0]
        setSelectedWorkspaceId(firstWs._id)
        setWorkspaceMembers(firstWs.members || [])
        
        const bRes = await api.get(`/api/boards/workspace/${firstWs._id}`)
        const bList = bRes.data.boards || []
        setBoards(bList)
        if (bList.length > 0) {
          setSelectedBoardId(bList[0]._id)
        }
      }
    } catch (err) {
      console.error("Error loading workspaces for conversion:", err)
    }
  }

  const handleWorkspaceSelectChange = async (wsId: string) => {
    setSelectedWorkspaceId(wsId)
    const targetWs = workspaces.find(w => w._id === wsId)
    if (targetWs) {
      setWorkspaceMembers(targetWs.members || [])
    }
    try {
      const bRes = await api.get(`/api/boards/workspace/${wsId}`)
      const bList = bRes.data.boards || []
      setBoards(bList)
      if (bList.length > 0) {
        setSelectedBoardId(bList[0]._id)
      }
    } catch (err) {
      console.error("Error fetching boards:", err)
    }
  }

  const handleConvertSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedWorkspaceId || !selectedBoardId || !taskTitle.trim() || !convertingActionItem) return

    setConvertLoading(true)
    try {
      await api.post('/api/boards/tasks/from-action-item', {
        workspaceId: selectedWorkspaceId,
        boardId: selectedBoardId,
        columnId: targetColumnId,
        title: taskTitle.trim(),
        description: taskDesc.trim(),
        priority: taskPriority,
        assigneeId: selectedAssigneeId || undefined,
        meetingId: meeting?._id,
        actionItemId: convertingActionItem._id
      })

      if (meeting) {
        setMeeting({
          ...meeting,
          actionItems: meeting.actionItems?.map(ai => 
            ai._id === convertingActionItem._id 
              ? { ...ai, status: 'completed' } 
              : ai
          )
        })
      }

      setConvertSuccessMsg("Task successfully created and assigned!")
      setTimeout(() => {
        setConvertingActionItem(null)
        setConvertSuccessMsg('')
      }, 1200)
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to assign action item as task')
    } finally {
      setConvertLoading(false)
    }
  }

  useEffect(() => {
    const fetchMeetingDetails = async () => {
      if (!meetingCode) return
      try {
        setLoading(true)
        const res = await api.get(`/meetings/${meetingCode}`)
        setMeeting(res.data.meeting)
        setError(null)
      } catch (err: any) {
        console.error("Error fetching meeting details:", err)
        setError("Unable to load meeting dashboard. It might not exist or you might not have access permissions.")
      } finally {
        setLoading(false)
      }
    }
    
    fetchMeetingDetails()
  }, [meetingCode])

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString([], {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric"
    })
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    })
  }

  const getDuration = (start: string, end?: string) => {
    if (!end) return "Unknown"
    const durationMs = new Date(end).getTime() - new Date(start).getTime()
    const mins = Math.floor(durationMs / 60000)
    if (mins < 60) return `${mins} mins`
    const hrs = Math.floor(mins / 60)
    const remainingMins = mins % 60
    return `${hrs} hr ${remainingMins} mins`
  }

  const getInitials = (name?: string) => {
    if (!name) return "U"
    return name.trim().split(/\s+/).map(n => n[0]).slice(0, 2).join("").toUpperCase()
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-6">
        <div className="relative flex items-center justify-center">
          <div className="h-16 w-16 rounded-full border-[3px] border-slate-900" />
          <div className="absolute h-16 w-16 rounded-full border-t-[3px] border-indigo-500 animate-spin" />
          <div className="absolute h-8 w-8 rounded-full bg-indigo-600/20 border border-indigo-500/30 animate-pulse" />
        </div>
        <div className="text-center space-y-1">
          <h3 className="text-sm font-semibold text-slate-350">Compiling Session Intelligence...</h3>
          <p className="text-xs text-slate-500 font-medium">Aggregating transcripts and metadata</p>
        </div>
      </div>
    )
  }

  if (error || !meeting) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <div className="h-14 w-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-6 shadow-lg">
          <WarningIcon size={24} />
        </div>
        <h3 className="text-lg font-bold text-slate-200">Failed to Load Dashboard</h3>
        <p className="text-sm text-slate-500 mt-2 max-w-sm leading-relaxed">
          {error || "Meeting details could not be found."}
        </p>
        <button
          onClick={() => navigate("/meetings/history")}
          className="mt-6 px-6 py-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-xl text-xs font-semibold text-slate-200 transition-all active:scale-[0.98] cursor-pointer"
        >
          Return to History
        </button>
      </div>
    )
  }

  const hasSummary = !!meeting.summary
  const hasActionItems = meeting.actionItems && meeting.actionItems.length > 0
  const hasTranscript = meeting.transcript && meeting.transcript.length > 0

  return (
    <div className="space-y-6">
      {/* Back & Breadcrumb bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate("/meetings/history")}
          className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors group cursor-pointer"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="h-4 w-4 transform group-hover:-translate-x-0.5 transition-transform"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back to History
        </button>

        <span className="text-xs text-slate-500 font-medium">
          Session Code: <span className="font-mono text-slate-400 select-all">{meeting.meetingCode}</span>
        </span>
      </div>

      {/* Main Header Card */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-900 bg-slate-950/40 p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-violet-500/5 to-transparent pointer-events-none" />

        <div className="space-y-2 relative z-10">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 uppercase tracking-wide">
              {meeting.status}
            </span>
            <span className="text-xs text-slate-500">•</span>
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <CalendarIcon size={12} />
              {formatDate(meeting.startTime)}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100">{meeting.title}</h1>
          {meeting.description && (
            <p className="text-sm text-slate-400 max-w-2xl">{meeting.description}</p>
          )}
        </div>

        {/* Access Recording Action */}
        <div className="relative z-10 shrink-0">
          {meeting.recordingUrl ? (
            <a
              href={meeting.recordingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 transition-all duration-200 active:scale-[0.98] shadow-lg cursor-pointer"
            >
              <VideoIcon size={16} className="text-rose-400" />
              <span className="text-xs font-semibold">Access Recording</span>
            </a>
          ) : (
            <button
              disabled
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-850 bg-slate-900/20 text-slate-600 cursor-not-allowed opacity-60 shadow-none"
              title="No video recording is available for this session"
            >
              <VideoIcon size={16} className="text-slate-600" />
              <span className="text-xs font-semibold">No Recording Available</span>
            </button>
          )}
        </div>
      </section>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left column: Sidebar Info & Participants */}
        <div className="space-y-6 lg:col-span-1">
          {/* Details list */}
          <div className="rounded-xl border border-slate-900 bg-slate-950/20 p-5 space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Session Details</h3>
            <div className="space-y-3 text-xs text-slate-400">
              <div className="flex justify-between py-1.5 border-b border-slate-900/50">
                <span className="text-slate-500">Scheduled Time</span>
                <span>{formatTime(meeting.startTime)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-900/50">
                <span className="text-slate-500">End Time</span>
                <span>{meeting.endTime ? new Date(meeting.endTime).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }) : "Not ended"}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-900/50">
                <span className="text-slate-500">Duration</span>
                <span>{getDuration(meeting.startTime, meeting.endTime)}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Total Participants</span>
                <span className="font-semibold text-slate-350">{meeting.participants.length}</span>
              </div>
            </div>
          </div>

          {/* Participants list */}
          <div className="rounded-xl border border-slate-900 bg-slate-950/20 p-5 space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Participants ({meeting.participants.length})
            </h3>
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {meeting.participants.map((p, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs py-1">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    {p.user.avatar ? (
                      <img
                        src={p.user.avatar}
                        alt={p.user.name}
                        className="h-7 w-7 rounded-full border border-slate-900 object-cover"
                      />
                    ) : (
                      <div className="h-7 w-7 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center font-bold text-[9px] text-slate-400 shrink-0">
                        {getInitials(p.user.name)}
                      </div>
                    )}
                    <div className="overflow-hidden">
                      <p className="font-medium text-slate-300 truncate">{p.user.name}</p>
                      <p className="text-[10px] text-slate-500 truncate">{p.user.email}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[9px] capitalize shrink-0 font-medium ${
                    p.role === 'host'
                      ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/25'
                      : 'bg-slate-900 text-slate-500'
                  }`}>
                    {p.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column: Main Dashboard Insights & Transcript tabs */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tab Navigation header */}
          <div className="flex border-b border-slate-900">
            <button
              onClick={() => setActiveTab('insights')}
              className={`px-5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'insights'
                  ? 'border-indigo-500 text-indigo-400 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <SparklesIcon size={14} className={activeTab === 'insights' ? 'text-indigo-400' : 'text-slate-400'} />
              AI Insights
            </button>
            <button
              onClick={() => setActiveTab('transcript')}
              className={`px-5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'transcript'
                  ? 'border-indigo-500 text-indigo-400 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-4 w-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18V6c0-1.1.9-2 2-2h9.75m.75 3.5V3.75m0 3.75a1.125 1.125 0 01-1.125-1.125V3c0-.621.504-1.125 1.125-1.125h1.5a1.125 1.125 0 011.125 1.125v1.5a1.125 1.125 0 01-1.125 1.125H18z"
                />
              </svg>
              Full Transcript
            </button>
          </div>

          {/* Tab Contents */}
          {activeTab === 'insights' ? (
            <div className="space-y-6">
              {/* Summary window */}
              <div className="rounded-xl border border-slate-900 bg-slate-950/20 p-6 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-900 pb-3">
                  <SparklesIcon size={16} className="text-indigo-400" />
                  <h2 className="text-sm font-semibold text-slate-200">AI Summary</h2>
                </div>
                {hasSummary ? (
                  <div className="text-slate-350 text-sm leading-relaxed whitespace-pre-wrap">
                    {meeting.summary}
                  </div>
                ) : (
                  <div className="py-8 text-center text-slate-500 space-y-2">
                    <p className="text-xs">No AI summary generated for this meeting.</p>
                    <p className="text-[11px] text-slate-650 max-w-md mx-auto">
                      AI summaries are generated automatically once a recording is uploaded and parsed by the processing engine.
                    </p>
                  </div>
                )}
              </div>

              {/* Action items window */}
              <div className="rounded-xl border border-slate-900 bg-slate-950/20 p-6 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-900 pb-3">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="h-4 w-4 text-indigo-400"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <h2 className="text-sm font-semibold text-slate-200">Action Items</h2>
                </div>
                {hasActionItems ? (
                  <div className="space-y-3">
                    {meeting.actionItems?.map((item) => (
                      <div
                        key={item._id}
                        className="flex items-start justify-between gap-3 p-3.5 bg-slate-900/30 border border-slate-900 rounded-xl hover:bg-slate-900/50 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <span className={`mt-0.5 h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${
                            item.status === 'completed'
                              ? 'bg-indigo-600 border-indigo-500 text-white'
                              : 'border-slate-800'
                          }`}>
                            {item.status === 'completed' && (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={3}
                                stroke="currentColor"
                                className="h-2.5 w-2.5"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                              </svg>
                            )}
                          </span>
                          <span className={`text-xs ${
                            item.status === 'completed' ? 'text-slate-500 line-through' : 'text-slate-350'
                          }`}>
                            {item.task}
                          </span>
                        </div>

                        {/* Assignee badge & Assign as Task action */}
                        <div className="flex items-center gap-2 shrink-0 pl-4">
                          {(item.assignee || item.assigneeName) && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-slate-500">Assignee:</span>
                              <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-850 text-[10px] text-slate-400 font-medium">
                                {item.assignee?.name || item.assigneeName}
                              </span>
                            </div>
                          )}

                          <button
                            onClick={() => openConvertModal(item)}
                            className="px-2.5 py-1 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 text-indigo-400 text-[11px] font-medium rounded-lg transition-all cursor-pointer flex items-center gap-1"
                            title="Assign action item as a Kanban Task Card to a workspace member"
                          >
                            ⚡ Assign as Task
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-slate-500">
                    <p className="text-xs">No key tasks or action items were extracted by AI.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Transcript window */
            <div className="rounded-xl border border-slate-900 bg-slate-950/20 p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-900 pb-3">
                <h2 className="text-sm font-semibold text-slate-200">Meeting Transcript</h2>
                {hasTranscript && (
                  <span className="text-[11px] text-slate-500">
                    {meeting.transcript?.length} segments recorded
                  </span>
                )}
              </div>

              {hasTranscript ? (
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                  {meeting.transcript?.map((seg) => (
                    <div
                      key={seg._id}
                      className="p-3.5 bg-slate-900/10 border border-slate-900/50 rounded-xl hover:border-slate-850/80 hover:bg-slate-900/25 transition-all"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          {seg.speaker?.avatar ? (
                            <img
                              src={seg.speaker.avatar}
                              className="h-5 w-5 rounded-full object-cover border border-slate-900"
                              alt=""
                            />
                          ) : (
                            <div className="h-5 w-5 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center font-bold text-[8px] text-slate-400">
                              {getInitials(seg.speaker?.name || seg.speakerName)}
                            </div>
                          )}
                          <span className="text-xs font-semibold text-indigo-400">
                            {seg.speaker?.name || seg.speakerName || "Speaker"}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-600">
                          {new Date(seg.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-350 leading-relaxed pl-7">{seg.text}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-slate-500 space-y-2">
                  <p className="text-xs">No transcript available for this session.</p>
                  <p className="text-[11px] text-slate-650 max-w-sm mx-auto">
                    Full audio transcripts are compiled in real-time if voice recognition is enabled, or processed post-call from recordings.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal: Convert Action Item to Workspace Task Card */}
      {convertingActionItem && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                ⚡ Assign Action Item as Task
              </h3>
              <button
                onClick={() => setConvertingActionItem(null)}
                className="text-slate-500 hover:text-slate-300 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {convertSuccessMsg && (
              <p className="text-xs text-emerald-400 bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20">
                {convertSuccessMsg}
              </p>
            )}

            <form onSubmit={handleConvertSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Task Title</label>
                <input
                  type="text"
                  required
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Target Team Workspace</label>
                <select
                  value={selectedWorkspaceId}
                  onChange={(e) => handleWorkspaceSelectChange(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  {workspaces.map((w) => (
                    <option key={w._id} value={w._id}>{w.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Target Project Board</label>
                <select
                  value={selectedBoardId}
                  onChange={(e) => setSelectedBoardId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  {boards.map((b) => (
                    <option key={b._id} value={b._id}>{b.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Assign To Team Member</label>
                <select
                  value={selectedAssigneeId}
                  onChange={(e) => setSelectedAssigneeId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Unassigned (Open task)</option>
                  {workspaceMembers.map((m) => {
                    const u = m.user;
                    if (!u) return null;
                    return (
                      <option key={u._id} value={u._id}>
                        {u.name || u.email} ({m.role ? m.role.replace('WORKSPACE_', '') : 'Member'})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Kanban Column</label>
                  <select
                    value={targetColumnId}
                    onChange={(e) => setTargetColumnId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="col-todo">To Do</option>
                    <option value="col-in-progress">In Progress</option>
                    <option value="col-review">Under Review</option>
                    <option value="col-done">Done</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Priority</label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Notes / Description</label>
                <textarea
                  rows={2}
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setConvertingActionItem(null)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-medium rounded-xl hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={convertLoading}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-medium rounded-xl hover:opacity-90 cursor-pointer"
                >
                  {convertLoading ? 'Creating Task...' : 'Create & Assign Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
