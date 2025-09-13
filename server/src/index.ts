#!/usr/bin/env node

import cors from "cors";
import { parseArgs } from "node:util";
import { parse as shellParseArgs } from "shell-quote";

import {
  SSEClientTransport,
  SseError,
} from "@modelcontextprotocol/sdk/client/sse.js";
import {
  StdioClientTransport,
  getDefaultEnvironment,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import express from "express";
import { findActualExecutable } from "spawn-rx";
import mcpProxy from "./mcpProxy.js";
import { randomUUID, randomBytes, timingSafeEqual } from "node:crypto";
import bodyParser from "body-parser";
import { PORTS, getSupergatewayPort } from "../../shared/config.js";

const SSE_HEADERS_PASSTHROUGH = ["authorization"];
const STREAMABLE_HTTP_HEADERS_PASSTHROUGH = [
  "authorization",
  "mcp-session-id",
  "last-event-id",
];

const defaultEnvironment = {
  ...getDefaultEnvironment(),
  ...(process.env.MCP_ENV_VARS ? JSON.parse(process.env.MCP_ENV_VARS) : {}),
};

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    env: { type: "string" },
    args: { type: "string" },
  },
  allowPositionals: true,
});

// Function to get HTTP headers.
// Supports only "sse" and "streamable-http" transport types.
const getHttpHeaders = (
  req: express.Request,
  transportType: string,
): HeadersInit => {
  const headers: HeadersInit = {
    Accept:
      transportType === "sse"
        ? "text/event-stream"
        : "text/event-stream, application/json",
  };
  const defaultHeaders =
    transportType === "sse"
      ? SSE_HEADERS_PASSTHROUGH
      : STREAMABLE_HTTP_HEADERS_PASSTHROUGH;

  for (const key of defaultHeaders) {
    if (req.headers[key] === undefined) {
      continue;
    }

    const value = req.headers[key];
    headers[key] = Array.isArray(value) ? value[value.length - 1] : value;
  }

  // If the header "x-custom-auth-header" is present, use its value as the custom header name.
  if (req.headers["x-custom-auth-header"] !== undefined) {
    const customHeaderName = req.headers["x-custom-auth-header"] as string;
    const lowerCaseHeaderName = customHeaderName.toLowerCase();
    if (req.headers[lowerCaseHeaderName] !== undefined) {
      const value = req.headers[lowerCaseHeaderName];
      headers[customHeaderName] = value as string;
    }
  }
  return headers;
};

const app = express();
app.use(cors());
app.use((req, res, next) => {
  res.header("Access-Control-Expose-Headers", "mcp-session-id");
  next();
});

const webAppTransports: Map<string, Transport> = new Map<string, Transport>(); // Web app transports by web app sessionId
const serverTransports: Map<string, Transport> = new Map<string, Transport>(); // Server Transports by web app sessionId

const sessionToken = randomBytes(32).toString("hex");
const authDisabled = true; // Disabled authentication for direct access

// Origin validation middleware to prevent DNS rebinding attacks
const originValidationMiddleware = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  const origin = req.headers.origin;

  // Allow requests with no origin (file:// protocol doesn't send origin header)
  if (!origin) {
    return next();
  }

  // Default origins based on CLIENT_PORT or use environment variable
  const clientPort = process.env.CLIENT_PORT || "6274";
  const defaultOrigins = [
    `http://localhost:${clientPort}`,
    `http://127.0.0.1:${clientPort}`,
  ];
  const allowedOrigins =
    process.env.ALLOWED_ORIGINS?.split(",") || defaultOrigins;

  if (!allowedOrigins.includes(origin)) {
    console.error(`Invalid origin: ${origin}`);
    res.status(403).json({
      error: "Forbidden - invalid origin",
      message:
        "Request blocked to prevent DNS rebinding attacks. Configure allowed origins via environment variable.",
    });
    return;
  }
  next();
};

const authMiddleware = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  if (authDisabled) {
    return next();
  }

  const sendUnauthorized = () => {
    res.status(401).json({
      error: "Unauthorized",
      message:
        "Authentication required. Use the session token shown in the console when starting the server.",
    });
  };

  // 1. Check query parameter first (for EventSource)
  let providedToken: string | undefined = undefined;
  if (req.query["mcp-proxy-auth-token"]) {
    providedToken = req.query["mcp-proxy-auth-token"] as string;
  } else {
    // 2. Check header as fallback
    const authHeader = req.headers["x-mcp-proxy-auth"];
    const authHeaderValue = Array.isArray(authHeader)
      ? authHeader[0]
      : authHeader;
    if (authHeaderValue && authHeaderValue.startsWith("Bearer ")) {
      providedToken = authHeaderValue.substring(7); // Remove 'Bearer ' prefix
    }
  }

  if (!providedToken) {
    sendUnauthorized();
    return;
  }

  const expectedToken = sessionToken;

  // Convert to buffers for timing-safe comparison
  const providedBuffer = Buffer.from(providedToken);
  const expectedBuffer = Buffer.from(expectedToken);

  // Check length first to prevent timing attacks
  if (providedBuffer.length !== expectedBuffer.length) {
    sendUnauthorized();
    return;
  }

  // Perform timing-safe comparison
  if (!timingSafeEqual(providedBuffer, expectedBuffer)) {
    sendUnauthorized();
    return;
  }

  next();
};

const createTransport = async (req: express.Request): Promise<Transport> => {
  const query = req.query;
  console.log("Query parameters:", JSON.stringify(query));

  const transportType = query.transportType as string;

  if (transportType === "stdio") {
    const command = query.command as string;
    const origArgs = shellParseArgs(query.args as string) as string[];
    const queryEnv = query.env ? JSON.parse(query.env as string) : {};
    const env = {
      ...process.env,
      ...defaultEnvironment,
      ...queryEnv,
      // 抑制 npx 的警告信息
      NPM_CONFIG_LOGLEVEL: "silent",
      NPM_CONFIG_UPDATE_NOTIFIER: "false",
    };

    // 构建用户的完整命令
    const userCommand = `${command} ${origArgs.join(" ")}`.trim();

    // 使用 supergateway 启动用户命令并转换为 SSE
    // 从配置中获取端口，支持环境变量覆盖
    const supergatewayPort = getSupergatewayPort();
    const supergatewayArgs = [
      "-y",
      "supergateway",
      "--stdio",
      userCommand,
      "--port",
      supergatewayPort.toString(),
      "--baseUrl",
      `http://localhost:${supergatewayPort}`,
      "--ssePath",
      "/sse",
      "--messagePath",
      "/message",
      "--logLevel",
      "none", // 抑制 supergateway 日志
    ];

    console.log(
      `STDIO transport: Starting supergateway for command: ${userCommand}`,
    );
    console.log(
      `Supergateway will be available at: http://localhost:${supergatewayPort}/sse`,
    );

    // 启动 supergateway
    const supergatewayTransport = new StdioClientTransport({
      command: "npx",
      args: supergatewayArgs,
      env,
      stderr: "pipe",
    });

    try {
      await supergatewayTransport.start();
    } catch (error) {
      console.error(`Failed to start supergateway:`, error);
      throw error;
    }

    // 等待 supergateway 启动
    console.log(`Waiting for supergateway to start on port ${supergatewayPort}...`);
    
    // 给 supergateway 更多时间启动
    // 第一次运行时，npx 需要下载 supergateway 和 MCP 服务器
    let connected = false;
    let attempts = 0;
    const maxAttempts = 30; // 最多等待30秒
    
    while (!connected && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // 每秒检查一次
      attempts++;
      
      try {
        // 尝试连接到 SSE 端点
        const testResponse = await fetch(`http://localhost:${supergatewayPort}/sse`, {
          method: 'GET',
          headers: {
            'Accept': 'text/event-stream'
          },
          signal: AbortSignal.timeout(500) // 500ms 超时
        });
        
        // 如果返回任何响应（即使是错误），说明服务器在监听
        connected = true;
        console.log(`Supergateway is ready on port ${supergatewayPort} (attempt ${attempts})`);
      } catch (error) {
        // 继续等待
        if (attempts % 5 === 0) {
          console.log(`Still waiting for supergateway... (${attempts}/${maxAttempts})`);
        }
      }
    }
    
    if (!connected) {
      throw new Error(`Supergateway failed to start on port ${supergatewayPort} after ${maxAttempts} seconds`);
    }
    
    console.log(`Connecting to supergateway at http://localhost:${supergatewayPort}/sse`);

    // 连接到 supergateway 的 SSE 端点
    const sseTransport = new SSEClientTransport(
      new URL(`http://localhost:${supergatewayPort}/sse`),
      {
        requestInit: {
          headers: {},
        },
      },
    );

    await sseTransport.start();
    return sseTransport;
  } else if (transportType === "sse") {
    const url = query.url as string;

    const headers = getHttpHeaders(req, transportType);

    console.log(
      `SSE transport: url=${url}, headers=${JSON.stringify(headers)}`,
    );

    const transport = new SSEClientTransport(new URL(url), {
      eventSourceInit: {
        fetch: (url, init) => fetch(url, { ...init, headers }),
      },
      requestInit: {
        headers,
      },
    });
    await transport.start();
    return transport;
  } else if (transportType === "streamable-http") {
    const headers = getHttpHeaders(req, transportType);

    const transport = new StreamableHTTPClientTransport(
      new URL(query.url as string),
      {
        requestInit: {
          headers,
        },
      },
    );
    await transport.start();
    return transport;
  } else {
    console.error(`Invalid transport type: ${transportType}`);
    throw new Error("Invalid transport type specified");
  }
};

app.get(
  "/mcp",
  originValidationMiddleware,
  authMiddleware,
  async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string;
    console.log(`Received GET message for sessionId ${sessionId}`);
    try {
      const transport = webAppTransports.get(
        sessionId,
      ) as StreamableHTTPServerTransport;
      if (!transport) {
        res.status(404).end("Session not found");
        return;
      } else {
        await transport.handleRequest(req, res);
      }
    } catch (error) {
      console.error("Error in /mcp route:", error);
      res.status(500).json(error);
    }
  },
);

app.post(
  "/mcp",
  originValidationMiddleware,
  authMiddleware,
  async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    let serverTransport: Transport | undefined;
    if (!sessionId) {
      try {
        console.log("New StreamableHttp connection request");
        try {
          serverTransport = await createTransport(req);
        } catch (error) {
          if (error instanceof SseError && error.code === 401) {
            console.error(
              "Received 401 Unauthorized from MCP server:",
              error.message,
            );
            res.status(401).json(error);
            return;
          }

          throw error;
        }

        console.log("Created StreamableHttp server transport");

        const webAppTransport = new StreamableHTTPServerTransport({
          sessionIdGenerator: randomUUID,
          onsessioninitialized: (sessionId) => {
            webAppTransports.set(sessionId, webAppTransport);
            serverTransports.set(sessionId, serverTransport!);
            console.log("Client <-> Proxy  sessionId: " + sessionId);
          },
        });
        console.log("Created StreamableHttp client transport");

        await webAppTransport.start();

        mcpProxy({
          transportToClient: webAppTransport,
          transportToServer: serverTransport,
        });

        await (webAppTransport as StreamableHTTPServerTransport).handleRequest(
          req,
          res,
        );
      } catch (error) {
        console.error("Error in /mcp POST route:", error);
        res.status(500).json(error);
      }
    } else {
      console.log(`Received POST message for sessionId ${sessionId}`);
      try {
        const transport = webAppTransports.get(
          sessionId,
        ) as StreamableHTTPServerTransport;
        if (!transport) {
          res.status(404).end("Transport not found for sessionId " + sessionId);
        } else {
          await (transport as StreamableHTTPServerTransport).handleRequest(
            req,
            res,
          );
        }
      } catch (error) {
        console.error("Error in /mcp route:", error);
        res.status(500).json(error);
      }
    }
  },
);

app.delete(
  "/mcp",
  originValidationMiddleware,
  authMiddleware,
  async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    console.log(`Received DELETE message for sessionId ${sessionId}`);
    let serverTransport: Transport | undefined;
    if (sessionId) {
      try {
        serverTransport = serverTransports.get(
          sessionId,
        ) as StreamableHTTPClientTransport;
        if (!serverTransport) {
          res.status(404).end("Transport not found for sessionId " + sessionId);
        } else {
          await (
            serverTransport as StreamableHTTPClientTransport
          ).terminateSession();
          webAppTransports.delete(sessionId);
          serverTransports.delete(sessionId);
          console.log(`Transports removed for sessionId ${sessionId}`);
        }
        res.status(200).end();
      } catch (error) {
        console.error("Error in /mcp route:", error);
        res.status(500).json(error);
      }
    }
  },
);

app.get(
  "/stdio",
  originValidationMiddleware,
  authMiddleware,
  async (req, res) => {
    try {
      console.log("New STDIO connection request");
      let serverTransport: Transport | undefined;
      try {
        serverTransport = await createTransport(req);
        console.log("Created server transport");
      } catch (error) {
        if (error instanceof SseError && error.code === 401) {
          console.error(
            "Received 401 Unauthorized from MCP server. Authentication failure.",
          );
          res.status(401).json(error);
          return;
        }

        throw error;
      }

      const webAppTransport = new SSEServerTransport("/message", res);
      console.log("Created client transport");

      webAppTransports.set(webAppTransport.sessionId, webAppTransport);
      serverTransports.set(webAppTransport.sessionId, serverTransport);

      await webAppTransport.start();

      // 只有在 serverTransport 是 StdioClientTransport 时才监听 stderr
      if (
        serverTransport instanceof StdioClientTransport &&
        serverTransport.stderr
      ) {
        serverTransport.stderr.on("data", (chunk) => {
          if (chunk.toString().includes("MODULE_NOT_FOUND")) {
            webAppTransport.send({
              jsonrpc: "2.0",
              method: "notifications/stderr",
              params: {
                content: "Command not found, transports removed",
              },
            });
            webAppTransport.close();
            serverTransport.close();
            webAppTransports.delete(webAppTransport.sessionId);
            serverTransports.delete(webAppTransport.sessionId);
            console.error("Command not found, transports removed");
          } else {
            webAppTransport.send({
              jsonrpc: "2.0",
              method: "notifications/stderr",
              params: {
                content: chunk.toString(),
              },
            });
          }
        });
      }

      mcpProxy({
        transportToClient: webAppTransport,
        transportToServer: serverTransport,
      });
    } catch (error) {
      console.error("Error in /stdio route:", error);
      res.status(500).json(error);
    }
  },
);

app.get(
  "/sse",
  originValidationMiddleware,
  authMiddleware,
  async (req, res) => {
    try {
      console.log(
        "New SSE connection request. NOTE: The sse transport is deprecated and has been replaced by StreamableHttp",
      );
      

      
      let serverTransport: Transport | undefined;
      try {
        serverTransport = await createTransport(req);
      } catch (error) {
        if (error instanceof SseError && error.code === 401) {
          console.error(
            "Received 401 Unauthorized from MCP server. Authentication failure.",
          );
          res.status(401).json(error);
          return;
        } else if (error instanceof SseError && error.code === 404) {
          console.error(
            "Received 404 not found from MCP server. Does the MCP server support SSE?",
          );
          res.status(404).json(error);
          return;
        } else if (JSON.stringify(error).includes("ECONNREFUSED")) {
          console.error("Connection refused. Is the MCP server running?");
          res.status(500).json(error);
        } else {
          throw error;
        }
      }

      if (serverTransport) {
        const webAppTransport = new SSEServerTransport("/message", res);
        webAppTransports.set(webAppTransport.sessionId, webAppTransport);
        console.log("Created client transport");
        serverTransports.set(webAppTransport.sessionId, serverTransport!);
        console.log("Created server transport");

        await webAppTransport.start();

        mcpProxy({
          transportToClient: webAppTransport,
          transportToServer: serverTransport,
        });
      }
    } catch (error) {
      console.error("Error in /sse route:", error);
      res.status(500).json(error);
    }
  },
);

app.post(
  "/message",
  originValidationMiddleware,
  authMiddleware,
  async (req, res) => {
    try {
      const sessionId = req.query.sessionId;
      console.log(`Received POST message for sessionId ${sessionId}`);

      const transport = webAppTransports.get(
        sessionId as string,
      ) as SSEServerTransport;
      if (!transport) {
        res.status(404).end("Session not found");
        return;
      }
      await transport.handlePostMessage(req, res);
    } catch (error) {
      console.error("Error in /message route:", error);
      res.status(500).json(error);
    }
  },
);

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
  });
});

app.get("/config", originValidationMiddleware, authMiddleware, (_req, res) => {
  try {
    res.json({
      defaultEnvironment: {}, // Return empty object instead of system env vars
      defaultCommand: values.env || "",
      defaultArgs: values.args || "",
    });
  } catch (error) {
    console.error("Error in /config route:", error);
    res.status(500).json(error);
  }
});

let ngrokProcess: any = null;
let ngrokUrl: string | null = null;

// Helper function to check if URL is localhost
const isLocalhostUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url);
    return (
      urlObj.hostname === "localhost" ||
      urlObj.hostname === "127.0.0.1" ||
      urlObj.hostname === "0.0.0.0"
    );
  } catch {
    return false;
  }
};

app.post(
  "/tunnel/start",
  express.json(),
  originValidationMiddleware,
  authMiddleware,
  async (req, res) => {
    try {
      const { port, url, transportType } = req.body;

      if (ngrokProcess) {
        return res.status(400).json({ error: "Tunnel is already running" });
      }

      let targetUrl = url;
      let useDirectMapping = false;

      // For SSE/HTTP transport types, check if URL is localhost for direct mapping
      if (
        (transportType === "sse" || transportType === "streamable-http") &&
        url &&
        isLocalhostUrl(url)
      ) {
        useDirectMapping = true;
        const urlObj = new URL(url);
        targetUrl = `http://localhost:${urlObj.port || (urlObj.protocol === "https:" ? 443 : 80)}`;
        console.log(
          `Direct URL mapping detected for ${transportType}: ${url} -> ${targetUrl}`,
        );
      }

      const targetPort = useDirectMapping ? parseInt(new URL(targetUrl).port || '80') : (port || 6277);
      console.log(
        `Starting ngrok tunnel for ${useDirectMapping ? "direct URL mapping" : "port"} ${targetPort}...`,
      );

      // 启动 ngrok
      const { spawn } = await import("child_process");
      ngrokProcess = spawn("ngrok", ["http", targetPort.toString()], {
        stdio: "ignore",
      });

      ngrokProcess.on("error", (error: any) => {
        console.error("Failed to start ngrok:", error.message);
        if (error.code === "ENOENT") {
          throw new Error(
            "ngrok command not found. Please install ngrok: https://ngrok.com/download"
          );
        }
        throw error;
      });

      ngrokProcess.on("close", (code: number) => {
        console.log(`Ngrok process exited with code ${code}`);
        ngrokProcess = null;
        ngrokUrl = null;
      });

      // 等待 ngrok 启动并获取 URL
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Ngrok startup timeout"));
        }, 10000);

        const checkUrl = async () => {
          try {
            // 从 ngrok API 获取隧道信息
            const response = await fetch("http://127.0.0.1:4040/api/tunnels");
            const data = await response.json();

            if (data.tunnels && data.tunnels.length > 0) {
              const tunnel = data.tunnels.find((t: any) => t.proto === "https");
              if (tunnel) {
                ngrokUrl = tunnel.public_url;
                clearTimeout(timeout);
                resolve(ngrokUrl);
                return;
              }
            }

            // 如果还没获取到，1秒后重试
            setTimeout(checkUrl, 1000);
          } catch (error) {
            // API还没准备好，继续重试
            setTimeout(checkUrl, 1000);
          }
        };

        // 开始检查
        setTimeout(checkUrl, 2000); // 给ngrok一些启动时间
      });

      // For direct URL mapping, append the original path to the ngrok URL
      let publicUrl = ngrokUrl;
      if (useDirectMapping && url) {
        const originalPath = new URL(url).pathname;
        if (originalPath && originalPath !== "/") {
          publicUrl = `${ngrokUrl}${originalPath}`;
        }
      } else if (!useDirectMapping) {
        // For proxy mode (stdio), always append /sse to the ngrok URL
        publicUrl = `${ngrokUrl}/sse`;
      }

      console.log(`Ngrok tunnel started: ${publicUrl}`);
      res.json({
        success: true,
        publicUrl: publicUrl,
        localPort: targetPort,
        directMapping: useDirectMapping,
        originalUrl: useDirectMapping ? url : undefined,
      });
    } catch (error) {
      console.error("Error starting tunnel:", error);
      if (ngrokProcess) {
        ngrokProcess.kill();
        ngrokProcess = null;
      }
      ngrokUrl = null;
      res
        .status(500)
        .json({
          error: error instanceof Error ? error.message : String(error),
        });
    }
  },
);

app.post(
  "/tunnel/stop",
  express.json(),
  originValidationMiddleware,
  authMiddleware,
  (_req, res) => {
    try {
      if (ngrokProcess) {
        ngrokProcess.kill();
        ngrokProcess = null;
        ngrokUrl = null;
        console.log("Ngrok tunnel stopped");
        res.json({ success: true });
      } else {
        res.status(400).json({ error: "No tunnel is running" });
      }
    } catch (error) {
      console.error("Error stopping tunnel:", error);
      res
        .status(500)
        .json({
          error: error instanceof Error ? error.message : String(error),
        });
    }
  },
);

app.get(
  "/tunnel/status",
  originValidationMiddleware,
  authMiddleware,
  (_req, res) => {
    res.json({
      running: !!ngrokProcess,
      publicUrl: ngrokUrl,
    });
  },
);

const PORT = parseInt(process.env.PORT || PORTS.PROXY_SERVER.toString(), 10);
const HOST = process.env.HOST || "127.0.0.1";

const server = app.listen(PORT, HOST);
server.on("listening", () => {
  console.log(`⚙️ Proxy server listening on ${HOST}:${PORT}`);
  if (!authDisabled) {
    console.log(`🔑 Session token: ${sessionToken}`);
    console.log(
      `Use this token to authenticate requests or set DANGEROUSLY_OMIT_AUTH=true to disable auth`,
    );

    // Display clickable URL with pre-filled token
    const clientPort = process.env.CLIENT_PORT || "6274";
    const clientUrl = `http://localhost:${clientPort}/?MCP_PROXY_AUTH_TOKEN=${sessionToken}`;
    console.log(
      `\n🔗 Open inspector with token pre-filled:\n   ${clientUrl}\n   (Auto-open is disabled when authentication is enabled)\n`,
    );
  } else {
    console.log(
      `⚠️  WARNING: Authentication is disabled. This is not recommended.`,
    );
  }
});
server.on("error", (err) => {
  if (err.message.includes(`EADDRINUSE`)) {
    console.error(`❌  Proxy Server PORT IS IN USE at port ${PORT} ❌ `);
  } else {
    console.error(err.message);
  }
  process.exit(1);
});
