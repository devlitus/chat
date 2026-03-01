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
        fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m,weather_code,relative_humidity_2m`
        ),
        fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
        ),
      ]);
      const meteoData = await meteoRes.json();
      const nominatimData = await nominatimRes.json();
      const city =
        nominatimData.address?.city ||
        nominatimData.address?.town ||
        nominatimData.address?.village ||
        nominatimData.address?.county ||
        'Ubicación desconocida';
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
    // Pedir coordenadas al host padre (evita restricciones del sandbox en el iframe)
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
        if (data.error) {
          setStatus('geo-error');
        } else {
          fetchFromCoords(data.latitude, data.longitude);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    fetchWeather();
    return () => window.removeEventListener('message', handleMessage);
  }, [fetchWeather, fetchFromCoords]);

  const weatherInfo = weather ? getWeatherInfo(weather.weatherCode) : null;

  return (
    <div className="min-h-screen font-sans flex items-start justify-center p-4 pt-6 sm:pt-10 bg-transparent text-slate-200">
      <div className="relative w-full max-w-sm rounded-[2rem] bg-slate-900/40 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden p-8 transition-all duration-500 hover:shadow-cyan-500/10">

        <div className="absolute -top-24 -left-24 w-48 h-48 bg-cyan-600 rounded-full mix-blend-multiply filter blur-[64px] opacity-30 animate-pulse"></div>
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-blue-600 rounded-full mix-blend-multiply filter blur-[64px] opacity-30 animate-pulse" style={{ animationDelay: '2s' }}></div>

        <div className="relative z-10">
          <div className="flex items-center space-x-4 mb-8">
            <div className="p-2.5 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-2xl shadow-lg border border-white/10">
              <span className="material-symbols-outlined text-white text-[28px] block leading-none">wb_sunny</span>
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-200 tracking-tight leading-none mb-1">
                Clima Actual
              </h1>
              <span className="text-xs text-slate-400 font-medium tracking-wide uppercase">Open-Meteo · Nominatim</span>
            </div>
          </div>

          {status === 'loading' && (
            <div className="mb-8 flex flex-col items-center gap-3 py-6">
              <span className="material-symbols-outlined animate-spin text-cyan-400 text-[40px]">sync</span>
              <p className="text-slate-400 text-sm">Obteniendo ubicación y clima...</p>
            </div>
          )}

          {status === 'geo-error' && (
            <div className="mb-8 flex flex-col items-center gap-3 py-4 text-center">
              <span className="material-symbols-outlined text-red-400 text-[40px]">location_off</span>
              <p className="text-slate-300 text-sm font-medium">No se pudo obtener la ubicación.</p>
              <p className="text-slate-500 text-xs">Permite el acceso a la geolocalización en tu navegador.</p>
            </div>
          )}

          {status === 'fetch-error' && (
            <div className="mb-8 flex flex-col items-center gap-3 py-4 text-center">
              <span className="material-symbols-outlined text-red-400 text-[40px]">cloud_off</span>
              <p className="text-slate-300 text-sm font-medium">No se pudo obtener el clima.</p>
              <p className="text-slate-500 text-xs">Verifica tu conexión a internet.</p>
            </div>
          )}

          {status === 'success' && weather && weatherInfo && (
            <div className="mb-8 space-y-4">
              <div className="flex items-center gap-2 pl-1">
                <span className="material-symbols-outlined text-cyan-400 text-[18px]">location_on</span>
                <p className="text-slate-300 text-sm font-semibold truncate">{weather.city}</p>
              </div>

              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500/30 to-blue-600/30 rounded-2xl blur-md opacity-50 group-hover:opacity-100 transition duration-500"></div>
                <div className="relative bg-black/60 backdrop-blur-sm px-6 py-5 rounded-2xl border border-white/5 flex items-center justify-between shadow-inner">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-cyan-300 text-[48px]">{weatherInfo.icon}</span>
                    <div>
                      <p className="text-4xl font-extrabold text-white leading-none">{weather.temperature}°C</p>
                      <p className="text-slate-400 text-sm mt-1">{weatherInfo.label}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-black/40 rounded-2xl border border-white/5 px-4 py-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-cyan-400 text-[20px]">air</span>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Viento</p>
                    <p className="text-slate-200 font-semibold text-sm">{weather.windSpeed} km/h</p>
                  </div>
                </div>
                <div className="bg-black/40 rounded-2xl border border-white/5 px-4 py-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-cyan-400 text-[20px]">water_drop</span>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Humedad</p>
                    <p className="text-slate-200 font-semibold text-sm">{weather.humidity}%</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={fetchWeather}
            disabled={status === 'loading'}
            className={`group relative w-full flex justify-center py-4 px-6 rounded-2xl text-sm font-bold text-white overflow-hidden transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed ${status === 'loading' ? 'opacity-70 scale-95' : 'hover:scale-[1.02] shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)]'}`}
          >
            <div className="absolute inset-0 w-full h-full bg-slate-800 border border-slate-700 rounded-2xl transition-opacity duration-300"></div>
            <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-cyan-500 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

            <span className="relative flex items-center gap-2 tracking-wide">
              {status === 'loading' ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
                  ACTUALIZANDO...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">refresh</span>
                  ACTUALIZAR
                </>
              )}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
