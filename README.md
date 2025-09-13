# MCP Portal

A **supergateway** that bridges local STDIO MCP servers to Server-Sent Events (SSE) and exposes them to public networks. Built as a fork of the [Model Context Protocol Inspector](https://github.com/modelcontextprotocol/inspector), MCP Portal transforms local-only MCP servers into network-accessible services.

Available as both a **desktop application** and web interface, MCP Portal provides a user-friendly way to inspect, test, and share your MCP servers.

## 🚀 Quick Start

### Desktop App (Recommended)

```bash
# Clone the repository
git clone https://github.com/YimingZhao-art/mcp-portal.git
cd mcp-portal

# Install dependencies
npm install --ignore-scripts

# Start desktop app in development mode
npm run electron-dev

# Or build and run desktop app
npm run electron
```

### Web Version

```bash
# Install dependencies and start web version
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

## 🔧 Development

### Local Development

```bash
# Clone the repository
git clone https://github.com/YimingZhao-art/mcp-portal.git
cd mcp-portal

# Install dependencies
npm install

# Start web development mode
npm run dev

# On Windows
npm run dev:windows

# Start desktop app development mode
npm run electron-dev
```

### Building Desktop App

```bash
# Build for all platforms
npm run dist

# Build for specific platforms
npm run dist-mac    # macOS
npm run dist-win    # Windows  
npm run dist-linux  # Linux
```

The built applications will be available in the `dist-electron/` directory.

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
