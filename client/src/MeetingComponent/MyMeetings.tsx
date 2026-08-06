import { useState, useEffect } from "react"
import { useNavigate } from "react-router"
import { api } from "../lib/api"
import {
  CalendarIcon,
  VideoIcon,
  Spinner,
  WarningIcon
} from "../lib/icons"

interface User {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
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
  recordingUrl?: string;
}

export default function MyMeetings() {
  const navigate = useNavigate()
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchMeetings = async () => {
      try {
        setLoading(true)
        const res = await api.get("/meetings")
        setMeetings(res.data.meetings || [])
        setError(null)
      } catch (err: any) {
        console.error("Error fetching meetings:", err)
        setError("Failed to load meeting history. Please try again.")
      } finally {
        setLoading(false)
      }
    }
    fetchMeetings()
  }, [])

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString([], {
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

  const getInitials = (name?: string) => {
    if (!name) return "U"
    return name.trim().split(/\s+/).map(n => n[0]).slice(0, 2).join("").toUpperCase()
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-200 to-white bg-clip-text text-transparent">
          Meeting History
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Access your past meetings, review video recordings, and examine AI summaries.
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Spinner size={36} className="text-indigo-500" />
          <p className="text-sm text-slate-500 animate-pulse">Loading meetings list...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center p-8 bg-slate-900/30 border border-slate-900 rounded-2xl text-center">
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 mb-4">
            <WarningIcon size={24} />
          </div>
          <p className="text-sm text-slate-400">{error}</p>
        </div>
      ) : meetings.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-slate-900/10 border border-slate-900 rounded-2xl text-center">
          <div className="h-12 w-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-4">
            <CalendarIcon size={24} />
          </div>
          <h3 className="text-base font-semibold text-slate-200">No Meetings Found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            You have not participated in or hosted any meetings yet. Start a new instant meeting from the Home Dashboard.
          </p>
          <button
            onClick={() => navigate("/dashboard")}
            className="mt-6 px-5 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/10 transition-all active:scale-[0.98] cursor-pointer"
          >
            Create a Meeting
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {meetings.map((meeting) => (
            <div
              key={meeting._id}
              onClick={() => navigate(`/meetings/history/${meeting.meetingCode}`)}
              className="group relative overflow-hidden rounded-xl border border-slate-900 bg-slate-950/40 p-5 hover:border-slate-800 hover:bg-slate-900/20 transition-all duration-350 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/0 via-violet-500/0 to-transparent group-hover:from-indigo-500/5 group-hover:via-violet-500/5 transition-all duration-350 pointer-events-none" />

              <div className="flex items-start gap-4 z-10">
                <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500/20 transition-colors shrink-0">
                  <VideoIcon size={20} />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm text-slate-200 group-hover:text-white transition-colors">
                      {meeting.title}
                    </h3>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold border ${
                      meeting.status === 'completed' 
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                        : meeting.status === 'active'
                        ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400 animate-pulse'
                        : meeting.status === 'cancelled'
                        ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                        : 'bg-slate-800/40 border-slate-800 text-slate-400'
                    }`}>
                      {meeting.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <CalendarIcon size={12} />
                      {formatDate(meeting.startTime)} at {formatTime(meeting.startTime)}
                    </span>
                    <span>•</span>
                    <span className="font-mono text-[11px] bg-slate-900/60 px-1.5 py-0.5 rounded border border-slate-850">
                      Code: {meeting.meetingCode}
                    </span>
                  </div>
                </div>
              </div>

              {/* Host and Video Actions */}
              <div className="flex items-center justify-between md:justify-end gap-6 z-10 border-t border-slate-900/60 pt-3 md:pt-0 md:border-none">
                {/* Host Info */}
                <div className="flex items-center gap-2.5">
                  {meeting.host.avatar ? (
                    <img
                      src={meeting.host.avatar}
                      alt={meeting.host.name}
                      className="h-7 w-7 rounded-full border border-slate-800 object-cover"
                    />
                  ) : (
                    <div className="h-7 w-7 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center font-bold text-[10px] text-slate-400">
                      {getInitials(meeting.host.name)}
                    </div>
                  )}
                  <div className="text-left">
                    <p className="text-[11px] font-medium text-slate-400">Host</p>
                    <p className="text-[11px] text-slate-500 -mt-0.5">{meeting.host.name}</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      alert("Accessing recording is not implemented yet. Feature coming soon!")
                    }}
                    className="p-2.5 rounded-xl border border-slate-800 bg-slate-900/35 hover:bg-slate-900 hover:border-slate-700 text-slate-400 hover:text-slate-200 transition-all cursor-pointer shadow-sm relative group/btn"
                    title="Access Video Recording"
                  >
                    {/* Recording circle badge */}
                    <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-rose-500 group-hover/btn:animate-ping" />
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
                        d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.91 11.672a.375.375 0 0 1 0 .656l-5.603 3.113a.375.375 0 0 1-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z"
                      />
                    </svg>
                  </button>

                  <span className="text-xs font-semibold text-indigo-400 group-hover:text-indigo-300 flex items-center gap-1 transition-colors pl-2">
                    Insights
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                      className="h-3.5 w-3.5 transform group-hover:translate-x-0.5 transition-transform"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
