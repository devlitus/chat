import { useState, useEffect } from 'react';

interface ChartData { [key: string]: string | number; }

export function useChartData() {
  const [data, setData] = useState<ChartData[] | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg?.type === 'mcp_tool_result' && msg.toolName === 'get-chart-data') {
        if (msg.error) setErrorMsg(msg.error);
        else if (msg.data && Array.isArray(msg.data)) setData(msg.data);
        else setErrorMsg('No se encontraron datos en el formato correcto.');
        setLoading(false);
      }
    };
    window.addEventListener('message', handler);
    window.parent.postMessage({ type: 'mcp_call_tool', toolName: 'get-chart-data' }, '*');
    const timer = setTimeout(() => setLoading(prev => { if (prev) setErrorMsg('Tiempo de espera agotado solicitando datos.'); return false; }), 5000);
    return () => { window.removeEventListener('message', handler); clearTimeout(timer); };
  }, []);

  return { data, errorMsg, loading };
}
