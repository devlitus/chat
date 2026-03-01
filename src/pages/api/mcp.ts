import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import type { APIRoute } from 'astro';

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

    const reqMock: any = { body: bodyJson, headers: Object.fromEntries(request.headers) };
    let responseData: unknown = null;
    let statusCode = 200;

    const resMock: any = {
      json: (data: unknown) => { responseData = data; },
      send: (data: unknown) => { responseData = data; },
      status: (code: number) => { statusCode = code; return resMock; },
      setHeader: () => { },
      end: () => { },
      on: () => { }, // mock eventos
    };

    await transport.handleRequest(reqMock, resMock, bodyJson);

    return new Response(JSON.stringify(responseData), {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
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
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
};
