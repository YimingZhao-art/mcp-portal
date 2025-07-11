# Shared Configuration

This directory contains shared configuration that is used across the entire MCP Portal application.

## Port Configuration

All port numbers are centralized in the config files:

- **Proxy Server**: 6277 (MCP Inspector Proxy Server)
- **Client Dev**: 6274 (Client development server)
- **Supergateway**: 8742 (Supergateway SSE server for stdio transport)

## Usage

### In TypeScript/ES Modules (Server)
```typescript
import { PORTS, getSupergatewayPort } from '../../shared/config.js';
```

### In CommonJS (Electron)
```javascript
const { PORTS, getSupergatewayPort } = require('../shared/config.cjs');
```

### In Client
```typescript
import { PORTS, getSupergatewayUrl } from '@/config/ports';
```

## Environment Variables

- `SUPERGATEWAY_PORT`: Override the default supergateway port (default: 8742)
- `PORT`: Override the proxy server port (default: 6277)

## Why Port 8742?

Port 8742 was chosen for supergateway because:
- It's in the dynamic/private port range (8000-49151)
- It's unlikely to conflict with common development tools
- It's easy to remember
- It avoids conflicts with common ports like 8000, 8080, 8888, etc.