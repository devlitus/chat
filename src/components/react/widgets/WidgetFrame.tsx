import { useRef } from 'react';
import type { Message } from '../../../lib/db';
import { useMcpTools } from './useMcpTools';

const ALLOWED_UI_PATHS = ['/mcp-app', '/crypto-app', '/weather-app', '/travel-app', '/chart-app'];

const widgetConfig: Record<string, { title: string; height: string; width: string }> = {
  '/weather-app': { title: 'Widget de clima', height: '480px', width: '360px' },
  '/crypto-app': { title: 'Widget de criptomonedas', height: '480px', width: '360px' },
  '/travel-app': { title: 'Widget de viajes', height: '520px', width: '640px' },
  '/chart-app': { title: 'Widget de gráfico', height: '450px', width: '100%' },
};

interface Props {
  uiResourceUri: string;
  message: Message;
}

export function WidgetFrame({ uiResourceUri, message }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  useMcpTools(iframeRef, message);

  const uiPath = uiResourceUri.replace('ui://mcp-app-demo', '');
  if (!ALLOWED_UI_PATHS.some(p => uiPath.startsWith(p))) return null;

  const config = widgetConfig[Object.keys(widgetConfig).find(k => uiPath.startsWith(k))!] ?? { title: 'Widget MCP', height: '480px', width: '360px' };

  return (
    <div style={{ width: config.width, height: config.height }}>
      <iframe
        ref={iframeRef}
        src={window.location.origin + uiPath}
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        sandbox="allow-scripts allow-same-origin allow-forms"
        allow="geolocation"
        title={config.title}
      />
    </div>
  );
}
