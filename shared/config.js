/**
 * Shared configuration constants used across the application
 */
export const PORTS = {
    // MCP Inspector Proxy Server
    PROXY_SERVER: 6277,
    // Client development server
    CLIENT_DEV: 6274,
    // Supergateway SSE server for stdio transport
    SUPERGATEWAY: 8742,
};
export const DEFAULT_CONFIG = {
    // Default environment variable name for supergateway port override
    SUPERGATEWAY_PORT_ENV: 'SUPERGATEWAY_PORT',
};
// Helper function to get supergateway port with environment override
export function getSupergatewayPort() {
    const envPort = process.env[DEFAULT_CONFIG.SUPERGATEWAY_PORT_ENV];
    return envPort ? parseInt(envPort, 10) : PORTS.SUPERGATEWAY;
}
