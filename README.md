# MCP Portal

A **supergateway** that bridges local STDIO MCP servers to Server-Sent Events (SSE) and exposes them to public networks. Built as a fork of the [Model Context Protocol Inspector](https://github.com/modelcontextprotocol/inspector), MCP Portal transforms local-only MCP servers into network-accessible services.

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/your-org/mcp-portal.git
cd mcp-portal

# Install dependencies and start
npm install --ignore-scripts
npm run dev
```

If you encounter build errors, try:
```bash
# Clean install
npm run clean
npm run dev
```

Open http://localhost:6274 and use the web UI to connect to your MCP servers.

> **Note**: The portal automatically installs MCP packages (like `@playwright/mcp`) when you connect to them through the UI. No manual installation needed!

## 🌐 Public Network Access

To expose your MCP server to the internet:

1. Sign up at [ngrok.com](https://ngrok.com) and get your auth token
2. Configure ngrok: `ngrok config add-authtoken YOUR_TOKEN`
3. Run: `npm run dev`
4. In another terminal: `ngrok http 6277`

Your MCP server is now accessible via the ngrok URL.

## 📖 Usage Examples

### Basic Local Testing

```bash
# Test your MCP server locally
npx mcp-portal node src/server.js

# With environment variables
npx mcp-portal -e API_KEY=your-key -e DEBUG=true node src/server.js

# With arguments
npx mcp-portal node src/server.js --verbose --port 3000
```

### Remote Client Connection

Once running, remote clients can connect via SSE:

```javascript
// Client-side connection example
const eventSource = new EventSource('http://your-server:6277/events', {
  headers: {
    'Authorization': 'Bearer your-session-token'
  }
});

eventSource.onmessage = (event) => {
  const mcpMessage = JSON.parse(event.data);
  // Handle MCP protocol messages
};
```

### Configuration File

Create `mcp-config.json`:

```json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["build/index.js"],
      "env": {
        "API_KEY": "your-api-key"
      }
    }
  }
}
```

Run with config:

```bash
npx mcp-portal --config mcp-config.json --server my-server
```

## 🔧 Development

### Local Development

```bash
# Clone the repository
git clone https://github.com/your-org/mcp-portal.git
cd mcp-portal

# Install dependencies
npm install

# Start development mode
npm run dev

# On Windows
npm run dev:windows
```

### Building

```bash
# Build all components
npm run build

# Build client only
npm run build-client

# Build server only
npm run build-server
```

### Code Style

- TypeScript with strict type checking
- React functional components with hooks
- Tailwind CSS for styling
- ES modules (import/export)
- Prettier for code formatting

## 🔒 Security

### Authentication

The portal generates a random session token on startup:

```
🔑 Session token: 3a1c267fad21f7150b7d624c160b7f09b0b8c4f623c7107bbf13378f051538d4

🔗 Open portal with token:
  http://localhost:6274/?MCP_PROXY_AUTH_TOKEN=3a1c267fad21f7150b7d624c160b7f09b0b8c4f623c7107bbf13378f051538d4
```

### Network Binding

- Defaults to `127.0.0.1` (localhost only)
- Set `HOST=0.0.0.0` to expose publicly
- DNS rebinding protection enabled
- Origin validation for requests

### Disable Authentication (NOT RECOMMENDED)

```bash
DANGEROUSLY_OMIT_AUTH=true npx mcp-portal node server.js
```

## 🎛️ Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| `CLIENT_PORT` | Web UI port | 6274 |
| `SERVER_PORT` | Gateway/SSE port | 6277 |
| `HOST` | Bind address | 127.0.0.1 |
| `MCP_SERVER_REQUEST_TIMEOUT` | Request timeout (ms) | 10000 |
| `MCP_REQUEST_MAX_TOTAL_TIMEOUT` | Max total timeout (ms) | 60000 |
| `ALLOWED_ORIGINS` | Comma-separated allowed origins | auto |

## 🌐 Related Projects

- **Original**: [MCP Inspector](https://github.com/modelcontextprotocol/inspector) - The foundation this project builds upon
- **Supergateway**: [supercorp-ai/supergateway](https://github.com/supercorp-ai/supergateway) - Advanced gateway patterns and architecture
- **MCP Specification**: [Model Context Protocol](https://modelcontextprotocol.io/) - Official protocol documentation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines

- Follow the existing code style and patterns
- Add tests for new functionality
- Update documentation as needed
- Ensure all tests pass before submitting

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Model Context Protocol team](https://github.com/modelcontextprotocol) for the original inspector
- [Supercorp AI](https://github.com/supercorp-ai) for gateway architecture inspiration
- The open-source community for continuous improvements and feedback

---

**Transform your local MCP servers into network-accessible services with MCP Portal** 🚀