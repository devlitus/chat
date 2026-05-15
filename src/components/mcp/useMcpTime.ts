import { useEffect, useState } from 'react';

export function useMcpTime() {
  const [serverTime, setServerTime] = useState<string>('--:--:--');
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const d = event.data;
      if (!d || typeof d !== 'object') return;
      if (d.source && typeof d.source === 'string' && d.source.includes('devtools')) return;
      if (d.type === 'mcp_tool_result' && d.toolName === 'get-time') {
        if (d.time) {
          try { const date = new Date(d.time); setServerTime(date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 })); }
          catch { setServerTime(d.time); }
        } else { setServerTime('ERROR'); }
        setIsFetching(false);
      }
    };
    window.addEventListener('message', handler);
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'mcp_call_tool', toolName: 'get-time' }, document.referrer || window.location.origin);
    }
    return () => window.removeEventListener('message', handler);
  }, []);

  const handleSync = () => {
    setIsFetching(true);
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'mcp_call_tool', toolName: 'get-time' }, document.referrer || window.location.origin);
    } else { setIsFetching(false); }
  };

  return { serverTime, isFetching, handleSync };
}
