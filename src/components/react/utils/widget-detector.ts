export const WIDGET_RE = /\[WIDGET:(weather|time|crypto|travel|chart)\]/i;

export const uriMap: Record<string, string> = {
  weather: 'ui://mcp-app-demo/weather-app',
  time: 'ui://mcp-app-demo/mcp-app',
  crypto: 'ui://mcp-app-demo/crypto-app',
  travel: 'ui://mcp-app-demo/travel-app',
  chart: 'ui://mcp-app-demo/chart-app',
};

export function detectWidgetFromModelResponse(content: string): string | undefined {
  const match = content.match(WIDGET_RE);
  return match ? uriMap[match[1].toLowerCase()] : undefined;
}

export function detectWidgetFromKeywords(userMessage: string): string | undefined {
  const lower = userMessage.toLowerCase();

  const isWeather = lower.includes('clima') || lower.includes('tiempo') ||
    lower.includes('lluv') || lower.includes('temperatura') ||
    lower.includes('weather') || lower.includes('pronóstico') ||
    lower.includes('pronostico') || lower.includes('rain') || lower.includes('forecast');

  const isTime = lower.includes('hora') || lower.includes('time') || lower === '/mcp';

  const isCrypto = lower.includes('crypto') || lower.includes('bitcoin') ||
    lower.includes('btc') || lower.includes('ethereum') ||
    lower.includes('eth') || lower.includes('solana') ||
    lower.includes('sol') || lower.includes('criptomoneda') ||
    (lower.includes('precio') && (lower.includes('moneda') || lower.includes('coin')));

  const isTravel = lower.includes('viaje') || lower.includes('vuelo') ||
    lower.includes('hotel') || lower.includes('destino') ||
    lower.includes('turismo') || lower.includes('vacaciones') || lower.includes('viajar');

  const isChart = lower.includes('gráfico') || lower.includes('grafico') ||
    lower.includes('gráfica') || lower.includes('grafica') ||
    lower.includes('diagrama') || lower.includes('compara') || lower.includes('visualiza');

  if (isWeather) return uriMap.weather;
  if (isTime) return uriMap.time;
  if (isCrypto) return uriMap.crypto;
  if (isTravel) return uriMap.travel;
  if (isChart) return uriMap.chart;
  return undefined;
}
