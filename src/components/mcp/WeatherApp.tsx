import { useEffect, useState, useCallback } from 'react';

interface WeatherData {
  city: string;
  temperature: number;
  weatherCode: number;
  windSpeed: number;
  humidity: number;
}

type FetchStatus = 'idle' | 'loading' | 'success' | 'geo-error' | 'fetch-error';

function getWeatherInfo(code: number): { icon: string; label: string } {
  if (code === 0) return { icon: 'sunny', label: 'Despejado' };
  if (code >= 1 && code <= 3) return { icon: 'partly_cloudy_day', label: 'Parcialmente nublado' };
  if (code >= 45 && code <= 48) return { icon: 'foggy', label: 'Niebla' };
  if (code >= 51 && code <= 55) return { icon: 'grain', label: 'Llovizna' };
  if (code >= 61 && code <= 65) return { icon: 'rainy', label: 'Lluvia' };
  if (code >= 71 && code <= 75) return { icon: 'ac_unit', label: 'Nieve' };
  if (code >= 80 && code <= 82) return { icon: 'rainy', label: 'Chubascos' };
  if (code >= 95 && code <= 99) return { icon: 'thunderstorm', label: 'Tormenta' };
  return { icon: 'partly_cloudy_day', label: 'Desconocido' };
}

export default function WeatherApp() {
  const [status, setStatus] = useState<FetchStatus>('loading');
  const [weather, setWeather] = useState<WeatherData | null>(null);

  const fetchFromCoords = useCallback(async (lat: number, lon: number) => {
    try {
      const [meteoRes, nominatimRes] = await Promise.all([
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m,weather_code,relative_humidity_2m`),
        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`),
      ]);
      const meteoData = await meteoRes.json();
      const nominatimData = await nominatimRes.json();
      const city = nominatimData.address?.city || nominatimData.address?.town || nominatimData.address?.village || nominatimData.address?.county || 'Ubicación desconocida';
      setWeather({
        city,
        temperature: Math.round(meteoData.current.temperature_2m),
        weatherCode: meteoData.current.weather_code,
        windSpeed: Math.round(meteoData.current.wind_speed_10m),
        humidity: meteoData.current.relative_humidity_2m,
      });
      setStatus('success');
    } catch {
      setStatus('fetch-error');
    }
  }, []);

  const fetchWeather = useCallback(() => {
    setStatus('loading');
    setWeather(null);
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'mcp_call_tool', toolName: 'get-location' }, '*');
    } else {
      setStatus('geo-error');
    }
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'object') return;
      if (event.data.source && typeof event.data.source === 'string' && event.data.source.includes('devtools')) return;
      const data = event.data;
      if (data.type === 'mcp_tool_result' && data.toolName === 'get-location') {
        if (data.error) setStatus('geo-error');
        else fetchFromCoords(data.latitude, data.longitude);
      }
    };
    window.addEventListener('message', handleMessage);
    fetchWeather();
    return () => window.removeEventListener('message', handleMessage);
  }, [fetchWeather, fetchFromCoords]);

  const weatherInfo = weather ? getWeatherInfo(weather.weatherCode) : null;

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
              <span className="material-symbols-rounded text-[28px]">wb_sunny</span>
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
                Clima Actual
              </h2>
              <p className="text-xs font-semibold text-gray-500 tracking-wide uppercase mt-0.5">
                Open-Meteo · Nominatim
              </p>
            </div>
          </div>

          {/* Loading */}
          {status === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <span className="material-symbols-rounded animate-spin text-[#22d3ee] text-[36px]">sync</span>
              <p className="text-gray-500 text-sm">Obteniendo ubicación y clima...</p>
            </div>
          )}

          {/* Geo error */}
          {status === 'geo-error' && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <span className="material-symbols-rounded text-red-400 text-[36px]">location_off</span>
              <p className="text-gray-400 text-sm font-medium">No se pudo obtener la ubicación.</p>
              <p className="text-gray-600 text-xs">Permite el acceso a la geolocalización.</p>
            </div>
          )}

          {/* Fetch error */}
          {status === 'fetch-error' && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <span className="material-symbols-rounded text-red-400 text-[36px]">cloud_off</span>
              <p className="text-gray-400 text-sm font-medium">No se pudo obtener el clima.</p>
              <p className="text-gray-600 text-xs">Verifica tu conexión a internet.</p>
            </div>
          )}

          {/* Success */}
          {status === 'success' && weather && weatherInfo && (
            <div className="space-y-2.5 mb-5">
              {/* City */}
              <div className="bg-[#080c14] border border-white/5 rounded-2xl px-4 py-3 flex items-center gap-3">
                <span className="material-symbols-rounded text-[#22d3ee] text-[20px]">location_on</span>
                <p className="text-white text-sm font-semibold truncate">{weather.city}</p>
              </div>

              {/* Temperature */}
              <div className="bg-[#080c14] border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-rounded text-[#22d3ee] text-[44px]">{weatherInfo.icon}</span>
                  <div>
                    <p className="text-4xl font-extrabold text-white leading-none">{weather.temperature}°C</p>
                    <p className="text-gray-500 text-sm mt-1">{weatherInfo.label}</p>
                  </div>
                </div>
              </div>

              {/* Wind + Humidity */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-[#080c14] border border-white/5 rounded-2xl px-4 py-3 flex items-center gap-2">
                  <span className="material-symbols-rounded text-[#22d3ee] text-[20px]">air</span>
                  <div>
                    <p className="text-xs text-gray-600 uppercase tracking-wide">Viento</p>
                    <p className="text-white font-semibold text-sm">{weather.windSpeed} km/h</p>
                  </div>
                </div>
                <div className="bg-[#080c14] border border-white/5 rounded-2xl px-4 py-3 flex items-center gap-2">
                  <span className="material-symbols-rounded text-[#22d3ee] text-[20px]">water_drop</span>
                  <div>
                    <p className="text-xs text-gray-600 uppercase tracking-wide">Humedad</p>
                    <p className="text-white font-semibold text-sm">{weather.humidity}%</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Button */}
          <div className="relative group mt-5">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-200 pointer-events-none"></div>
            <button
              onClick={fetchWeather}
              disabled={status === 'loading'}
              className="relative w-full bg-[#1e293b]/50 hover:bg-[#1e293b] text-white py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 border border-white/10 shadow-lg disabled:opacity-60 disabled:cursor-not-allowed font-sans"
            >
              <span className={`material-symbols-rounded text-[20px] ${status === 'loading' ? 'animate-spin' : ''}`}>
                refresh
              </span>
              <span className="font-bold text-sm tracking-wide uppercase">
                {status === 'loading' ? 'Actualizando...' : 'Actualizar'}
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
