import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import type { APIRoute } from 'astro';

// Interfaces mínimas para los mocks de Express necesarios para StreamableHTTPServerTransport
interface MockRequest {
  method: string;
  headers: Record<string, string>;
  body?: unknown;
  rawBody?: Buffer;
  [key: string]: unknown;
}

interface MockResponse {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(data?: string): void;
  [key: string]: unknown;
}

// Origen permitido por CORS: configurable via variable de entorno, con fallback a localhost
const allowedOrigin = import.meta.env.CORS_ORIGIN || 'http://localhost:4321';

// 1. Instanciar el servidor globalmente
const server = new McpServer({
  name: 'Astro MCP Server',
  version: '1.0.0',
});

// Este es el Resource URI que Claude / Hosts de MCP buscarán y renderizarán.
// Apuntará a la página cliente que desarrollaremos.
const resourceUri = 'ui://mcp-app-demo/mcp-app';

// 2. Registrar una herramienta interactiva usando "registerAppTool"
registerAppTool(
  server,
  'get-time',
  {
    title: 'Get Server Time',
    description: 'A tool that returns the current server time to the interactive MCP UI.',
    inputSchema: {},
    _meta: { ui: { resourceUri } }
  },
  async () => {
    const time = new Date().toISOString();
    return {
      content: [{ type: 'text', text: time }],
    };
  }
);

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

// Mantener estado del transporte si es necesario,
// o manejar nuevas sesiones por cada POST.
// Para un endpoint SSR puro sin express, usamos un enfoque similar a sse.
let transport: StreamableHTTPServerTransport | null = null;

export const POST: APIRoute = async ({ request }) => {
  try {
    // Inicializar el transporte
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    // Conectar el servidor al transporte
    await server.connect(transport);

    // Leer el body de la petición
    const bodyText = await request.text();
    const bodyJson = bodyText ? JSON.parse(bodyText) : undefined;

    // Manejar la petición JSON-RPC con el transport mockeando REQ/RES si es necesario,
    // o procesar el mensaje RPC directamente si no usamos Express.
    // Astro's Request/Response NO es compatible 1:1 con req/res de Express que espera "res.on('close')".
    // 
    // Adapting to standard Web Request/Response:
    // El SDK espera Express (req/res) o WebSockets en Node, pero para un API Route (SSR),
    // usaremos el método interno de mensajes.
    // StreamableHTTPServerTransport en `@modelcontextprotocol/sdk/server/streamableHttp.js`

    // Convertir a un objeto tipo "Express" básico para engañar al handleRequest (Hack funcional) 
    // O usamos Server directamente.

    // Una alternativa más limpia es crear el transporte en la ruta, llamar handleMessage y devolver Response.
    // Aún estamos en etapa experimental con Astro SSR + streamableHttp. El método handleRequest de Express es muy específico.
    // Por suerte, JSON-RPC y el servidor MCP pueden manejar el mensaje directamente sin Express.

    const reqMock: MockRequest = { method: request.method, body: bodyJson, headers: Object.fromEntries(request.headers) };
    let responseData: unknown = null;
    let statusCode = 200;

    const resMock: MockResponse = {
      statusCode,
      json: (data: unknown) => { responseData = data; },
      send: (data: unknown) => { responseData = data; },
      status: (code: number) => { statusCode = code; return resMock; },
      setHeader: () => { },
      end: () => { },
      on: () => { }, // mock eventos
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await transport.handleRequest(reqMock as any, resMock as any, bodyJson);

    return new Response(JSON.stringify(responseData), {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });

  } catch (error) {
    console.error('Error handling MCP request:', error);
    return new Response('Error in MCP Server API', { status: 500 });
  }
};

export const OPTIONS: APIRoute = () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
};
