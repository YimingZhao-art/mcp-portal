/**
 * Port configuration for the client
 * These should match the values in shared/config.ts
 */

export const PORTS = {
  // MCP Inspector Proxy Server
  PROXY_SERVER: 6277,
  
  // Client development server
  CLIENT_DEV: 6274,
  
  // Supergateway SSE server for stdio transport
  SUPERGATEWAY: 8742,
} as const;

// Helper function to get supergateway URL
export function getSupergatewayUrl(): string {
  return `http://localhost:${PORTS.SUPERGATEWAY}/sse`;
}