# Plan de Implementacion: Widget Crypto Prices (MCP)

## Resumen

Widget interactivo que muestra precios en tiempo real de Bitcoin, Ethereum y Solana con variacion porcentual de 24 horas. Se integra al sistema MCP existente siguiendo el mismo patron arquitectonico de `WeatherApp` y `McpClientApp`.

## Contexto

El proyecto ya cuenta con dos widgets MCP funcionales (Live Sync y Weather). El sistema usa un protocolo `postMessage` entre iframes (widgets) y el host (`MessageBubble.tsx`). El LLM activa los widgets mediante marcadores `[WIDGET:nombre]` que `ChatInput.tsx` detecta y convierte en `uiResourceUri`. Este nuevo widget extiende el ecosistema con informacion financiera de criptomonedas.

## Diseno propuesto

### Arquitectura general

```
Usuario pregunta sobre crypto
        |
        v
LLM responde con [WIDGET:crypto]
        |
        v
ChatInput.tsx detecta marcador -> uiResourceUri = "ui://mcp-app-demo/crypto-app"
        |
        v
MessageBubble.tsx renderiza iframe src="/crypto-app"
        |
        v
CryptoApp.tsx (iframe) envia postMessage: { type: 'mcp_call_tool', toolName: 'get-crypto-price' }
        |
        v
MessageBubble.tsx (host) recibe -> fetch a CoinGecko API -> postMessage de vuelta con datos
        |
        v
CryptoApp.tsx recibe datos y renderiza tarjetas de precios
```

### Archivos nuevos a crear

1. **`src/components/mcp/CryptoApp.tsx`** -- Componente React del widget
2. **`src/pages/crypto-app.astro`** -- Pagina standalone para el iframe

### Archivos existentes a modificar

1. **`src/components/react/MessageBubble.tsx`** -- Agregar handler para `get-crypto-price`
2. **`src/components/react/ChatInput.tsx`** -- Agregar `crypto` al regex y al mapa de URIs
3. **`src/lib/system-prompt.ts`** -- Agregar instruccion para el widget crypto
4. **`src/pages/api/mcp.ts`** -- Registrar herramienta `get-crypto-price`

---

## Detalle de implementacion por archivo

### 1. `src/components/mcp/CryptoApp.tsx` (NUEVO)

Componente React que sigue el patron exacto de `WeatherApp.tsx`: estado con `FetchStatus`, comunicacion via `postMessage`, UI glassmorphism con colores cyan/blue.

```tsx
import { useEffect, useState, useCallback } from 'react';

interface CoinData {
  id: string;
  name: string;
  symbol: string;
  price: number;
  change24h: number;
}

type FetchStatus = 'idle' | 'loading' | 'success' | 'fetch-error';

// Iconos Material Symbols para cada moneda
const COIN_META: Record<string, { name: string; symbol: string; icon: string }> = {
  bitcoin:  { name: 'Bitcoin',  symbol: 'BTC', icon: 'currency_bitcoin' },
  ethereum: { name: 'Ethereum', symbol: 'ETH', icon: 'diamond' },
  solana:   { name: 'Solana',   symbol: 'SOL', icon: 'bolt' },
};

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

function formatChange(change: number): string {
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(2)}%`;
}

export default function CryptoApp() {
  const [status, setStatus] = useState<FetchStatus>('loading');
  const [coins, setCoins] = useState<CoinData[]>([]);

  const fetchPrices = useCallback(() => {
    setStatus('loading');
    setCoins([]);
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(
        { type: 'mcp_call_tool', toolName: 'get-crypto-price' },
        '*'
      );
    } else {
      setStatus('fetch-error');
    }
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'object') return;
      if (event.data.source && typeof event.data.source === 'string' && event.data.source.includes('devtools')) return;

      const data = event.data;
      if (data.type === 'mcp_tool_result' && data.toolName === 'get-crypto-price') {
        if (data.error) {
          setStatus('fetch-error');
        } else if (data.data && Array.isArray(data.data)) {
          setCoins(data.data);
          setStatus('success');
        } else {
          setStatus('fetch-error');
        }
      }
    };

    window.addEventListener('message', handleMessage);
    fetchPrices();
    return () => window.removeEventListener('message', handleMessage);
  }, [fetchPrices]);

  return (
    <div className="min-h-screen font-sans flex items-start justify-center p-4 pt-6 sm:pt-10 bg-transparent text-slate-200">
      <div className="relative w-full max-w-sm rounded-[2rem] bg-slate-900/40 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden p-8 transition-all duration-500 hover:shadow-cyan-500/10">

        {/* Glow decorativo */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-cyan-600 rounded-full mix-blend-multiply filter blur-[64px] opacity-30 animate-pulse"></div>
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-blue-600 rounded-full mix-blend-multiply filter blur-[64px] opacity-30 animate-pulse" style={{ animationDelay: '2s' }}></div>

        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-center space-x-4 mb-8">
            <div className="p-2.5 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-2xl shadow-lg border border-white/10">
              <span className="material-symbols-outlined text-white text-[28px] block leading-none">currency_bitcoin</span>
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-200 tracking-tight leading-none mb-1">
                Crypto Prices
              </h1>
              <span className="text-xs text-slate-400 font-medium tracking-wide uppercase">CoinGecko API</span>
            </div>
          </div>

          {/* Estado: Loading */}
          {status === 'loading' && (
            <div className="mb-8 flex flex-col items-center gap-3 py-6">
              <span className="material-symbols-outlined animate-spin text-cyan-400 text-[40px]">sync</span>
              <p className="text-slate-400 text-sm">Obteniendo precios...</p>
            </div>
          )}

          {/* Estado: Error */}
          {status === 'fetch-error' && (
            <div className="mb-8 flex flex-col items-center gap-3 py-4 text-center">
              <span className="material-symbols-outlined text-red-400 text-[40px]">cloud_off</span>
              <p className="text-slate-300 text-sm font-medium">No se pudieron obtener los precios.</p>
              <p className="text-slate-500 text-xs">Verifica tu conexion a internet.</p>
            </div>
          )}

          {/* Estado: Success - Tarjetas de monedas */}
          {status === 'success' && coins.length > 0 && (
            <div className="mb-8 space-y-3">
              {coins.map((coin) => {
                const meta = COIN_META[coin.id] || { name: coin.name, symbol: coin.symbol, icon: 'toll' };
                const isPositive = coin.change24h >= 0;
                return (
                  <div key={coin.id} className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500/20 to-blue-600/20 rounded-2xl blur-md opacity-0 group-hover:opacity-100 transition duration-500"></div>
                    <div className="relative bg-black/60 backdrop-blur-sm px-5 py-4 rounded-2xl border border-white/5 flex items-center justify-between shadow-inner">
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-cyan-300 text-[32px]">{meta.icon}</span>
                        <div>
                          <p className="text-white font-bold text-sm leading-none">{meta.name}</p>
                          <p className="text-slate-500 text-xs mt-0.5">{meta.symbol}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-extrabold text-lg leading-none">{formatPrice(coin.price)}</p>
                        <p className={`text-xs font-semibold mt-1 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                          {isPositive ? '▲' : '▼'} {formatChange(coin.change24h)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Boton actualizar */}
          <button
            onClick={fetchPrices}
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
                  ACTUALIZAR PRECIOS
                </>
              )}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Notas de diseno:**
- Sigue exactamente la estructura visual de `WeatherApp.tsx` y `McpClientApp.tsx`: misma tarjeta glassmorphism, mismos glows cyan/blue, mismo boton con gradiente hover.
- Cada moneda se muestra en una sub-tarjeta con fondo `bg-black/60` (igual al panel de temperatura en WeatherApp).
- La variacion 24h usa verde (`text-emerald-400`) para positivo y rojo (`text-red-400`) para negativo, con flechas unicode.
- Los iconos de Material Symbols usados: `currency_bitcoin` (BTC header + tarjeta), `diamond` (ETH), `bolt` (SOL).

---

### 2. `src/pages/crypto-app.astro` (NUEVO)

Copia exacta del patron de `weather-app.astro`, cambiando solo el componente importado.

```astro
---
import CryptoApp from "../components/mcp/CryptoApp.tsx";
---

<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Crypto Prices App View</title>
    <script src="https://cdn.tailwindcss.com" is:inline></script>
    <script is:inline>
      tailwind.config = {
        theme: {
          extend: {
            fontFamily: {
              sans: ["Inter", "sans-serif"],
            },
          },
        },
      };
    </script>
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
      rel="stylesheet"
    />
    <link
      href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
      rel="stylesheet"
    />
    <style>
      body {
        margin: 0;
        padding: 0;
        overflow: hidden;
        background: transparent;
      }
    </style>
  </head>
  <body>
    <CryptoApp client:only="react" />
  </body>
</html>
```

**Nota:** Se usa `client:only="react"` (no `client:load`) para evitar SSR del componente, ya que depende de `window.parent.postMessage` que solo existe en el navegador. Este es el mismo patron usado en `weather-app.astro`.

---

### 3. Modificacion de `src/components/react/MessageBubble.tsx`

Agregar un nuevo bloque `if` en el `handleMessage` del `useEffect` (linea 62, despues del handler de `get-location`):

```tsx
// Handler para get-crypto-price (despues del bloque de get-location, ~linea 61)
if (data && data.type === 'mcp_call_tool' && data.toolName === 'get-crypto-price') {
  fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true')
    .then((res) => res.json())
    .then((json) => {
      const coins = Object.entries(json).map(([id, values]: [string, any]) => ({
        id,
        name: id.charAt(0).toUpperCase() + id.slice(1),
        symbol: id === 'bitcoin' ? 'BTC' : id === 'ethereum' ? 'ETH' : 'SOL',
        price: values.usd,
        change24h: values.usd_24h_change,
      }));
      iframeRef.current?.contentWindow?.postMessage({
        type: 'mcp_tool_result',
        toolName: 'get-crypto-price',
        data: coins,
      }, '*');
    })
    .catch(() => {
      iframeRef.current?.contentWindow?.postMessage({
        type: 'mcp_tool_result',
        toolName: 'get-crypto-price',
        error: 'fetch-failed',
      }, '*');
    });
}
```

**Justificacion:** El fetch se hace en el host (no en el iframe) para mantener la consistencia con el patron MCP del proyecto, donde el host actua como intermediario de todas las llamadas a APIs externas. Esto tambien evita problemas de CORS dentro del sandbox del iframe.

**Formato de respuesta de CoinGecko:**
```json
{
  "bitcoin": { "usd": 67234.12, "usd_24h_change": 2.345 },
  "ethereum": { "usd": 3456.78, "usd_24h_change": -1.234 },
  "solana": { "usd": 145.67, "usd_24h_change": 5.678 }
}
```

Se transforma a un array de `CoinData` que el iframe espera.

---

### 4. Modificacion de `src/components/react/ChatInput.tsx`

Dos cambios necesarios:

**a) Actualizar el regex de deteccion de widget (linea 56):**

```tsx
// Antes:
const WIDGET_RE = /\[WIDGET:(weather|time)\]/i;

// Despues:
const WIDGET_RE = /\[WIDGET:(weather|time|crypto)\]/i;
```

**b) Agregar entrada al mapa de URIs (linea 60-63):**

```tsx
// Antes:
const uriMap: Record<string, string> = {
  weather: 'ui://mcp-app-demo/weather-app',
  time: 'ui://mcp-app-demo/mcp-app',
};

// Despues:
const uriMap: Record<string, string> = {
  weather: 'ui://mcp-app-demo/weather-app',
  time: 'ui://mcp-app-demo/mcp-app',
  crypto: 'ui://mcp-app-demo/crypto-app',
};
```

**c) Agregar deteccion por fallback de topico (lineas 72-81):**

Agregar despues del bloque `isTimeTopic`:

```tsx
const isCryptoTopic =
  lowerMsg.includes('crypto') || lowerMsg.includes('bitcoin') ||
  lowerMsg.includes('btc') || lowerMsg.includes('ethereum') ||
  lowerMsg.includes('eth') || lowerMsg.includes('solana') ||
  lowerMsg.includes('sol') || lowerMsg.includes('criptomoneda') ||
  lowerMsg.includes('precio') && (lowerMsg.includes('moneda') || lowerMsg.includes('coin'));

// Y en la cadena de if/else:
if (isWeatherTopic) uiResourceUri = uriMap.weather;
else if (isTimeTopic) uiResourceUri = uriMap.time;
else if (isCryptoTopic) uiResourceUri = uriMap.crypto;
```

---

### 5. Modificacion de `src/lib/system-prompt.ts`

Agregar la instruccion del widget crypto al system prompt:

```ts
export const SYSTEM_PROMPT = `Eres un asistente de IA util y amigable. Responde de forma clara y concisa. Puedes usar Markdown para formatear tus respuestas.

Tienes acceso a widgets interactivos que se muestran al usuario automaticamente.

INSTRUCCION OBLIGATORIA: Cuando el usuario pregunte sobre clima, temperatura, lluvia, pronostico del tiempo meteorologico o condiciones atmosfericas, DEBES terminar tu respuesta con el texto exacto en una linea nueva:
[WIDGET:weather]

Cuando el usuario pregunte la hora actual del sistema, DEBES terminar tu respuesta con:
[WIDGET:time]

Cuando el usuario pregunte sobre precios de criptomonedas, Bitcoin, Ethereum, Solana, o el mercado crypto en general, DEBES terminar tu respuesta con:
[WIDGET:crypto]

REGLAS ESTRICTAS:
- El marcador debe ser la ULTIMA linea de tu respuesta, sin ningun texto despues.
- Escribelo EXACTAMENTE como aparece arriba, con corchetes y sin espacios.
- Solo un marcador por respuesta.
- Si no aplica ningun widget, no incluyas ningun marcador.`;
```

---

### 6. Modificacion de `src/pages/api/mcp.ts`

Registrar la nueva herramienta `get-crypto-price` despues del registro de `get-time` (linea 32):

```ts
const cryptoResourceUri = 'ui://mcp-app-demo/crypto-app';

registerAppTool(
  server,
  'get-crypto-price',
  {
    title: 'Get Crypto Prices',
    description: 'Returns current prices and 24h change for Bitcoin, Ethereum, and Solana.',
    inputSchema: {},
    _meta: { ui: { resourceUri: cryptoResourceUri } }
  },
  async () => {
    // El fetch real lo hace el host (MessageBubble), aqui solo declaramos la herramienta
    return {
      content: [{ type: 'text', text: 'Crypto prices tool invoked' }],
    };
  }
);
```

**Nota:** Al igual que `get-time`, la herramienta MCP en el servidor es declarativa. El fetch real a CoinGecko lo ejecuta `MessageBubble.tsx` en el navegador del cliente.

---

## Protocolo de mensajes

### Iframe -> Host

```ts
{
  type: 'mcp_call_tool',
  toolName: 'get-crypto-price'
}
```

### Host -> Iframe (exito)

```ts
{
  type: 'mcp_tool_result',
  toolName: 'get-crypto-price',
  data: [
    { id: 'bitcoin',  name: 'Bitcoin',  symbol: 'BTC', price: 67234.12, change24h: 2.345 },
    { id: 'ethereum', name: 'Ethereum', symbol: 'ETH', price: 3456.78,  change24h: -1.234 },
    { id: 'solana',   name: 'Solana',   symbol: 'SOL', price: 145.67,   change24h: 5.678 }
  ]
}
```

### Host -> Iframe (error)

```ts
{
  type: 'mcp_tool_result',
  toolName: 'get-crypto-price',
  error: 'fetch-failed'
}
```

---

## Consideraciones tecnicas

### Rendimiento
- La API de CoinGecko tiene un rate limit de 10-30 req/min en el plan gratuito (sin API key). Para uso normal del chat esto es mas que suficiente.
- El fetch se ejecuta solo cuando el usuario hace clic en "Actualizar" o cuando el widget se monta por primera vez.
- No se implementa polling automatico para evitar consumir el rate limit.

### Accesibilidad
- Los colores de variacion (verde/rojo) se acompanan de flechas unicode (triangulos arriba/abajo) para no depender solo del color.
- El boton tiene `focus:ring` visible para navegacion con teclado.
- Los textos de estado (`Obteniendo precios...`, errores) son descriptivos.

### SEO
- No aplica: el widget se renderiza dentro de un iframe que no es indexado por motores de busqueda.

### CORS
- CoinGecko permite peticiones desde el navegador (CORS habilitado en su API publica).
- El fetch se hace desde el host (`MessageBubble`) que corre en el contexto principal del navegador, no dentro del sandbox del iframe.

### Seguridad
- El iframe mantiene `sandbox="allow-scripts allow-same-origin allow-forms"` igual que los otros widgets.
- Se valida el `event.source` contra `iframeRef.current.contentWindow` en el handler del host.
- No se envian credenciales ni API keys a CoinGecko (API publica).

---

## Dependencias

No se requieren paquetes nuevos. Se usa:
- CoinGecko API publica (sin autenticacion): `https://api.coingecko.com/api/v3/simple/price`
- Material Symbols Outlined (ya incluido via CDN en las paginas de widgets)
- Tailwind CDN (ya incluido en las paginas de widgets)

---

## Plan de implementacion (orden)

| Paso | Archivo | Accion |
|------|---------|--------|
| 1 | `src/components/mcp/CryptoApp.tsx` | Crear componente React completo |
| 2 | `src/pages/crypto-app.astro` | Crear pagina standalone del iframe |
| 3 | `src/pages/api/mcp.ts` | Registrar herramienta `get-crypto-price` |
| 4 | `src/components/react/MessageBubble.tsx` | Agregar handler de `get-crypto-price` con fetch a CoinGecko |
| 5 | `src/components/react/ChatInput.tsx` | Actualizar regex, uriMap y fallback de topico |
| 6 | `src/lib/system-prompt.ts` | Agregar instruccion para `[WIDGET:crypto]` |
| 7 | Pruebas manuales | Verificar flujo completo: pregunta -> LLM -> marcador -> iframe -> precios |

### Validacion paso a paso

1. **Paso 1-2**: Navegar a `http://localhost:4321/crypto-app` directamente. Debe mostrar la tarjeta con estado "loading" y luego error (porque no hay host padre).
2. **Paso 3**: Verificar que el servidor MCP arranca sin errores con `pnpm dev`.
3. **Paso 4-6**: En el chat, escribir "Cuanto vale Bitcoin?" y verificar que:
   - El LLM responde con texto + `[WIDGET:crypto]`
   - Se renderiza el iframe con el widget
   - Los precios se cargan correctamente desde CoinGecko
   - El boton "Actualizar" funciona

---

## Alternativas consideradas

### 1. Fetch dentro del iframe (descartada)
Se considero hacer el fetch a CoinGecko directamente desde `CryptoApp.tsx` dentro del iframe, como hace parcialmente `WeatherApp.tsx` con Open-Meteo. Se descarto porque:
- Rompe el patron MCP donde el host es el intermediario de las herramientas.
- El sandbox del iframe podria bloquear requests a dominios externos en ciertos navegadores.
- Mantener la consistencia arquitectonica facilita el mantenimiento.

### 2. Usar API con autenticacion (descartada)
CoinGecko ofrece un plan Pro con API key que tiene mayor rate limit. Se descarto porque:
- El plan gratuito es suficiente para el caso de uso (consultas esporadicas del chat).
- Agregar API keys requeriria manejo de variables de entorno del lado del cliente, lo cual complica la arquitectura.

### 3. Incluir mas criptomonedas (descartada para v1)
Se considero mostrar un listado mas amplio (top 10, top 20). Se descarto para la primera version porque:
- Tres monedas (BTC, ETH, SOL) cubren el caso de uso principal.
- La UI se mantiene limpia y consistente con el tamano de los otros widgets.
- Se puede extender facilmente en el futuro agregando IDs al query de CoinGecko y al mapa `COIN_META`.

### 4. Auto-refresh periodico (descartada)
Se considero implementar un `setInterval` para actualizar precios cada 30 segundos. Se descarto porque:
- Consume rate limit de CoinGecko innecesariamente.
- Los otros widgets no hacen auto-refresh (patron consistente).
- El usuario puede hacer clic en "Actualizar" cuando quiera datos frescos.
