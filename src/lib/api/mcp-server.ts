import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';

const allowedOrigin = import.meta.env.CORS_ORIGIN || 'http://localhost:4321';

export const server = new McpServer({ name: 'Astro MCP Server', version: '1.0.0' });

registerAppTool(server, 'get-time', {
  title: 'Get Server Time', description: 'Returns current server time.', inputSchema: {},
  _meta: { ui: { resourceUri: 'ui://mcp-app-demo/mcp-app' } }
}, async () => ({ content: [{ type: 'text', text: new Date().toISOString() }] }));

registerAppTool(server, 'get-crypto-price', {
  title: 'Get Crypto Prices', description: 'Returns crypto prices.', inputSchema: {},
  _meta: { ui: { resourceUri: 'ui://mcp-app-demo/crypto-app' } }
}, async () => ({ content: [{ type: 'text', text: 'Crypto prices tool invoked' }] }));

export function createCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export async function handleMcpRequest(request: Request, bodyJson: unknown): Promise<Response> {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  let responseData: unknown = null;
  let statusCode = 200;
  const resMock = { statusCode, json: (d: unknown) => { responseData = d; }, send: (d: unknown) => { responseData = d; }, status: (c: number) => { statusCode = c; return resMock; }, setHeader: () => {}, end: () => {}, on: () => {} };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await transport.handleRequest({ method: request.method, body: bodyJson, headers: Object.fromEntries(request.headers) } as any, resMock as any, bodyJson);
  return new Response(JSON.stringify(responseData), { status: statusCode, headers: { 'Content-Type': 'application/json', ...createCorsHeaders() } });
}
