import './App.css'
import { useEffect } from 'react'
import { Routes, Route, Link, Navigate } from 'react-router'
import Login from './AuthComponents/Login'
import SignUp from './AuthComponents/SignUp'
import Dashboard from './DashboardComponents/Dashboard'
import Profile from './DashboardComponents/Profile'
import Layout from './DashboardComponents/Layout'
import AdminPanel from './DashboardComponents/AdminPanel'
import WorkspaceView from './DashboardComponents/WorkspaceView'
import ProjectBoardView from './DashboardComponents/ProjectBoardView'
import MeetingRoom from './MeetingComponent/MeetingRoom'
import MyMeetings from './MeetingComponent/MyMeetings'
import PostMeetingDashboard from './MeetingComponent/PostMeetingDashboard'
import { useAuthStore } from './store/useAuthStore'
import { NotificationProvider } from './context/NotificationContext'
import ToastContainer from './components/ToastContainer'


function Home() {
  const { accessToken, user } = useAuthStore()

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-indigo-600/10 blur-3xl pointer-events-none" />

      <div className="relative z-10 text-center px-4 max-w-lg">
        <h1 className="text-4xl md:text-5xl font-extrabold mb-4 bg-gradient-to-r from-indigo-200 via-violet-200 to-white bg-clip-text text-transparent tracking-tight">
          IntellMeet Realtime
        </h1>
        <p className="text-slate-400 text-lg mb-8 leading-relaxed">
          Experience AI-powered collaboration and real-time meeting intelligence.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          {accessToken && user ? (
            <Link
              to="/dashboard"
              className="w-full sm:w-auto px-8 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-medium shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="w-full sm:w-auto px-8 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-medium shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
              >
                Sign In
              </Link>
              <Link
                to="/signup"
                className="w-full sm:w-auto px-8 py-3 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900 hover:border-slate-700 text-slate-200 font-medium transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

interface RouteGuardProps {
  children: React.ReactNode
}

function ProtectedRoute({ children }: RouteGuardProps) {
  const { accessToken, user } = useAuthStore()
  if (!accessToken || !user) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

function PublicRoute({ children }: RouteGuardProps) {
  const { accessToken, user } = useAuthStore()
  if (accessToken && user) {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}

function App() {

  const { isCheckingAuth, checkAuth } = useAuthStore()

  useEffect(() => {
    // Perform silent refresh on boot
    checkAuth()
  }, [checkAuth])

  if (isCheckingAuth) {
    return (
      <div className="relative flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white overflow-hidden">
        {/* Background ambient glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-indigo-600/10 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col items-center gap-6 z-10">
          <div className="relative flex items-center justify-center">
            {/* Spinning track */}
            <div className="h-16 w-16 rounded-full border-[3px] border-slate-900" />
            {/* Spinner indicator */}
            <div className="absolute h-16 w-16 rounded-full border-t-[3px] border-indigo-500 animate-spin" />
            {/* Inner pulsing core */}
            <div className="absolute h-8 w-8 rounded-full bg-indigo-600/20 border border-indigo-500/30 animate-pulse" />
          </div>
          <div className="flex flex-col items-center gap-1.5 text-center">
            <h2 className="text-lg font-bold bg-gradient-to-r from-indigo-200 to-white bg-clip-text text-transparent">IntellMeet</h2>
            <p className="text-xs text-slate-500 font-medium tracking-wide">Securing session...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <NotificationProvider>
      <ToastContainer />
      <Routes>
        <Route path="/" element={<Home />} />

        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route
          path="/signup"
          element={
            <PublicRoute>
              <SignUp />
            </PublicRoute>
          }
        />
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/workspace" element={<WorkspaceView />} />
          <Route path="/workspace/board" element={<ProjectBoardView />} />
          <Route path="/meetings/history" element={<MyMeetings />} />
          <Route path="/meetings/history/:meetingCode" element={<PostMeetingDashboard />} />
        </Route>
        <Route
          path="/meetings/:meetingCode"
          element={
            <ProtectedRoute>
              <MeetingRoom />
            </ProtectedRoute>
          }
        />
      </Routes>
    </NotificationProvider>
  )
}

export default App;

