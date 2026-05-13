import { useState, useCallback } from 'react';

export interface WeatherData {
  city: string;
  temperature: number;
  weatherCode: number;
  windSpeed: number;
  humidity: number;
}

type Status = 'idle' | 'loading' | 'success' | 'geo-error' | 'fetch-error';

export function useWeatherData() {
  const [status, setStatus] = useState<Status>('loading');
  const [weather, setWeather] = useState<WeatherData | null>(null);

  const fetchWeather = useCallback(() => {
    setStatus('loading');
    setWeather(null);
    if (!navigator.geolocation) { setStatus('geo-error'); return; }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10_000);
          const [meteoRes, geoRes] = await Promise.all([
            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,wind_speed_10m,weather_code,relative_humidity_2m`, { signal: controller.signal }),
            fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=es`, { signal: controller.signal }),
          ]);
          clearTimeout(timeout);
          if (!meteoRes.ok) throw new Error(`open-meteo HTTP ${meteoRes.status}`);
          const meteoData = await meteoRes.json();
          const geoData = geoRes.ok ? await geoRes.json() : {};
          if (!meteoData.current) throw new Error('open-meteo: sin datos de current');
          setWeather({
            city: geoData.city || geoData.locality || geoData.principalSubdivision || 'Ubicación desconocida',
            temperature: Math.round(meteoData.current.temperature_2m),
            weatherCode: meteoData.current.weather_code,
            windSpeed: Math.round(meteoData.current.wind_speed_10m),
            humidity: meteoData.current.relative_humidity_2m,
          });
          setStatus('success');
        } catch { setStatus('fetch-error'); }
      },
      () => setStatus('geo-error'),
      { timeout: 10_000 }
    );
  }, []);

  return { status, weather, fetchWeather };
}
