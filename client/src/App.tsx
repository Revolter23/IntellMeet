import './App.css'

import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

// Connect to the backend server
const socket = io('http://localhost:3000');

function App() {
  const [isConnected, setIsConnected] = useState(socket.connected);

  useEffect(() => {
    function onConnect() {
      setIsConnected(true);
    }

    function onDisconnect() {
      setIsConnected(false);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white">
      <h1 className="text-3xl font-bold mb-4">IntellMeet Realtime</h1>
      <p className="text-lg">
        Status: {isConnected ? (
          <span className="text-green-400 font-semibold">Connected</span>
        ) : (
          <span className="text-red-400 font-semibold">Disconnected</span>
        )}
      </p>
    </div>
  );
}

export default App;
