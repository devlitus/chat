import type { APIRoute } from 'astro';
import { handleMcpRequest, createCorsHeaders } from '../../lib/api/mcp-server';

export const POST: APIRoute = async ({ request }) => {
  try {
    const bodyText = await request.text();
    return handleMcpRequest(request, bodyText ? JSON.parse(bodyText) : undefined);
  } catch (error) {
    console.error('Error handling MCP request:', error);
    return new Response('Error in MCP Server API', { status: 500 });
  }
};

export const OPTIONS: APIRoute = () => new Response(null, { status: 204, headers: createCorsHeaders() });
