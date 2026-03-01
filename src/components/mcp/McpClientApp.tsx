import { useEffect, useState } from 'react';

export default function McpClientApp() {
  const [serverTime, setServerTime] = useState<string>('--:--:--');
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'object') return;
      if (event.data.source && typeof event.data.source === 'string' && event.data.source.includes('devtools')) return;
      const data = event.data;
      if (data.type === 'mcp_tool_result' && data.toolName === 'get-time') {
        if (data.time) {
          try {
            const date = new Date(data.time);
            setServerTime(date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 }));
          } catch {
            setServerTime(data.time);
          }
        } else {
          setServerTime('ERROR');
        }
        setIsFetching(false);
      }
    };
    window.addEventListener('message', handleMessage);
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'mcp_call_tool', toolName: 'get-time' }, '*');
    }
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleSync = () => {
    setIsFetching(true);
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'mcp_call_tool', toolName: 'get-time' }, '*');
    } else {
      setIsFetching(false);
    }
  };

  return (
    <div className="min-h-screen flex items-start justify-center p-3 pt-3 bg-transparent font-sans">
      {/* Outer card */}
      <div className="relative w-full max-w-sm bg-[#0b1221] rounded-3xl p-[3px] shadow-xl border border-white/5 overflow-hidden">
        {/* Inner panel */}
        <div className="bg-[#0f1523] rounded-[1.35rem] p-5 relative overflow-hidden">

          {/* Header */}
          <div className="flex items-center gap-4 mb-5">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20 shrink-0"
              style={{ background: 'linear-gradient(135deg, #22d3ee 0%, #3b82f6 100%)' }}
            >
              <span className="material-symbols-rounded text-[28px]">schedule</span>
            </div>
            <div>
              <h2
                className="text-xl font-bold leading-tight"
                style={{
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundImage: 'linear-gradient(to right, #60a5fa, #22d3ee)',
                }}
              >
                Live Sync
              </h2>
              <p className="text-xs font-semibold text-gray-500 tracking-wide uppercase mt-0.5">
                MCP Tool Demo
              </p>
            </div>
          </div>

          {/* Time display */}
          <div className="mb-5">
            <p className="text-xs font-semibold text-gray-600 tracking-widest uppercase mb-3 pl-1">
              Tiempo del Servidor
            </p>
            <div className="bg-[#080c14] border border-white/5 rounded-2xl px-6 py-6 flex items-center justify-center min-h-[88px]">
              <code className={`font-mono text-3xl tracking-widest font-bold transition-all duration-300 ${isFetching ? 'text-[#22d3ee] animate-pulse' : 'text-white'}`}>
                {serverTime}
              </code>
            </div>
          </div>

          {/* Button */}
          <div className="relative group mt-5">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-200 pointer-events-none"></div>
            <button
              onClick={handleSync}
              disabled={isFetching}
              className="relative w-full bg-[#1e293b]/50 hover:bg-[#1e293b] text-white py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 border border-white/10 shadow-lg disabled:opacity-60 disabled:cursor-not-allowed font-sans"
            >
              <span className={`material-symbols-rounded text-[20px] ${isFetching ? 'animate-spin' : ''}`}>
                sync
              </span>
              <span className="font-bold text-sm tracking-wide uppercase">
                {isFetching ? 'Actualizando...' : 'Sincronizar Ahora'}
              </span>
            </button>
          </div>

          {/* Background glow blobs */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3 pointer-events-none"></div>
        </div>
      </div>
    </div>
  );
}
