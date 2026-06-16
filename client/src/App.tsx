import './App.css'
import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { Routes, Route, Link } from 'react-router'
import Login from './AuthComponents/Login'
import SignUp from './AuthComponents/SignUp'

// Connect to the backend server
const socket = io('http://localhost:3000')

function Home({ isConnected }: { isConnected: boolean }) {
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

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
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
        </div>

        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-slate-900 bg-slate-950/60 text-sm">
          <span className="text-slate-500">Server Status:</span>
          <span className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            <span className={isConnected ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </span>
        </div>
      </div>
    </div>
  )
}

function App() {
  const [isConnected, setIsConnected] = useState(socket.connected)

  useEffect(() => {
    function onConnect() {
      setIsConnected(true)
    }

    function onDisconnect() {
      setIsConnected(false)
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
    }
  }, [])

  return (
    <Routes>
      <Route path="/" element={<Home isConnected={isConnected} />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<SignUp />} />
    </Routes>
  )
}

export default App
