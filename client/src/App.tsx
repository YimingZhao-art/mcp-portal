import { LoggingLevel } from "@modelcontextprotocol/sdk/types.js";
import { useEffect, useState } from "react";
import { useConnection } from "./lib/hooks/useConnection";
import {
  useDraggablePane,
  useDraggableSidebar,
} from "./lib/hooks/useDraggablePane";
import { StdErrNotification } from "./lib/notificationTypes";

import { z } from "zod";
import "./App.css";
import NgrokPanel from "./components/History";
import Sidebar from "./components/Sidebar";
import StatusPanel from "./components/StatusPanel";
import { InspectorConfig } from "./lib/configurationTypes";
import {
  getMCPProxyAddress,
  getMCPProxyAuthToken,
  getInitialSseUrl,
  getInitialTransportType,
  getInitialCommand,
  getInitialArgs,
  initializeInspectorConfig,
  saveInspectorConfig,
} from "./utils/configUtils";

const CONFIG_LOCAL_STORAGE_KEY = "inspectorConfig_v1";

const App = () => {
  const [command, setCommand] = useState<string>(getInitialCommand);
  const [args, setArgs] = useState<string>(getInitialArgs);

  const [sseUrl, setSseUrl] = useState<string>(getInitialSseUrl);
  const [transportType, setTransportType] = useState<
    "stdio" | "sse" | "streamable-http"
  >(getInitialTransportType);
  const [logLevel, setLogLevel] = useState<LoggingLevel>("debug");
  const [stdErrNotifications, setStdErrNotifications] = useState<
    StdErrNotification[]
  >([]);
  const [env, setEnv] = useState<Record<string, string>>({});

  const [config, setConfig] = useState<InspectorConfig>(() =>
    initializeInspectorConfig(CONFIG_LOCAL_STORAGE_KEY),
  );
  const [bearerToken, setBearerToken] = useState<string>(() => {
    return localStorage.getItem("lastBearerToken") || "";
  });

  const [headerName, setHeaderName] = useState<string>(() => {
    return localStorage.getItem("lastHeaderName") || "";
  });

  // 隧道相关状态
  const [localUrl, setLocalUrl] = useState<string>("");
  const [publicUrl, setPublicUrl] = useState<string>("");
  const [tunnelStatus, setTunnelStatus] = useState<
    "idle" | "starting" | "active" | "error"
  >("idle");

  const { height: historyPaneHeight, handleDragStart } = useDraggablePane(300);
  const {
    width: sidebarWidth,
    isDragging: isSidebarDragging,
    handleDragStart: handleSidebarDragStart,
  } = useDraggableSidebar(320);

  const {
    connectionStatus,
    serverCapabilities,
    makeRequest,
    connect: connectMcpServer,
    disconnect: disconnectMcpServer,
  } = useConnection({
    transportType,
    command,
    args,
    sseUrl,
    env,
    bearerToken,
    headerName,
    config,
    onStdErrNotification: (notification) => {
      setStdErrNotifications((prev) => [
        ...prev,
        notification as StdErrNotification,
      ]);
    },
    getRoots: () => [],
  });

  // 根据传输类型和连接状态更新本地 URL
  useEffect(() => {
    if (connectionStatus === "connected") {
      if (transportType === "stdio") {
        // stdio 模式使用 supergateway 的地址
        setLocalUrl("http://localhost:8000/sse");
      } else if (
        transportType === "sse" ||
        transportType === "streamable-http"
      ) {
        // sse/http 模式直接显示原始 URL
        setLocalUrl(sseUrl);
      }
    } else {
      setLocalUrl("");
    }
  }, [connectionStatus, transportType, sseUrl]);

  useEffect(() => {
    localStorage.setItem("lastCommand", command);
  }, [command]);

  useEffect(() => {
    localStorage.setItem("lastArgs", args);
  }, [args]);

  useEffect(() => {
    localStorage.setItem("lastSseUrl", sseUrl);
  }, [sseUrl]);

  useEffect(() => {
    localStorage.setItem("lastTransportType", transportType);
  }, [transportType]);

  useEffect(() => {
    localStorage.setItem("lastBearerToken", bearerToken);
  }, [bearerToken]);

  useEffect(() => {
    localStorage.setItem("lastHeaderName", headerName);
  }, [headerName]);

  useEffect(() => {
    saveInspectorConfig(CONFIG_LOCAL_STORAGE_KEY, config);
  }, [config]);

  useEffect(() => {
    const headers: HeadersInit = {};
    const { token: proxyAuthToken, header: proxyAuthTokenHeader } =
      getMCPProxyAuthToken(config);
    if (proxyAuthToken) {
      headers[proxyAuthTokenHeader] = `Bearer ${proxyAuthToken}`;
    }

    fetch(`${getMCPProxyAddress(config)}/config`, { headers })
      .then((response) => response.json())
      .then((data) => {
        setEnv(data.defaultEnvironment);
        if (data.defaultCommand) {
          setCommand(data.defaultCommand);
        }
        if (data.defaultArgs) {
          setArgs(data.defaultArgs);
        }
      })
      .catch((error) =>
        console.error("Error fetching default environment:", error),
      );
  }, [config]);

  useEffect(() => {
    if (!window.location.hash) {
      window.location.hash = "resources";
    }
  }, []);

  const sendLogLevelRequest = async (level: LoggingLevel) => {
    await makeRequest(
      {
        method: "logging/setLevel" as const,
        params: { level },
      },
      z.object({}),
    );
    setLogLevel(level);
  };

  const clearStdErrNotifications = () => {
    setStdErrNotifications([]);
  };

  // 隧道控制函数
  const handleStartTunnel = async () => {
    try {
      setTunnelStatus("starting");

      // 根据传输类型确定要暴露的端口和URL
      let targetPort = 6277; // 默认 inspector proxy 端口
      let targetUrl = undefined;

      if (transportType === "stdio") {
        targetPort = 8000; // supergateway 端口
      } else if (
        transportType === "sse" ||
        transportType === "streamable-http"
      ) {
        // 对于 SSE/HTTP，如果是 localhost URL，使用直接映射
        targetUrl = sseUrl;
        // 从 URL 中提取端口
        try {
          const urlObj = new URL(sseUrl);
          if (
            urlObj.hostname === "localhost" ||
            urlObj.hostname === "127.0.0.1"
          ) {
            targetPort =
              parseInt(urlObj.port) ||
              (urlObj.protocol === "https:" ? 443 : 80);
          }
        } catch (error) {
          console.error("解析 SSE URL 失败:", error);
        }
      }

      console.log(
        `启动隧道，传输类型: ${transportType}, 端口: ${targetPort}, URL: ${targetUrl}`,
      );

      // 调用后端 API 启动隧道
      const { token: proxyAuthToken, header: proxyAuthTokenHeader } =
        getMCPProxyAuthToken(config);
      const headers: HeadersInit = {};
      if (proxyAuthToken) {
        headers[proxyAuthTokenHeader] = `Bearer ${proxyAuthToken}`;
      }

      const requestBody: {
        port: number;
        transportType: string;
        url?: string;
      } = {
        port: targetPort,
        transportType: transportType,
      };

      // 为 SSE/HTTP 添加 URL 参数
      if (transportType === "sse" || transportType === "streamable-http") {
        requestBody.url = sseUrl;
      }

      const response = await fetch(
        `${getMCPProxyAddress(config)}/tunnel/start`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...headers,
          },
          body: JSON.stringify(requestBody),
        },
      );

      if (!response.ok) {
        throw new Error(`启动隧道失败: ${response.statusText}`);
      }

      const result = await response.json();
      setPublicUrl(result.publicUrl);
      setTunnelStatus("active");
      console.log(`隧道启动成功: ${result.publicUrl}`);
      if (result.directMapping) {
        console.log(`使用直接URL映射，原始URL: ${result.originalUrl}`);
      }
    } catch (error) {
      console.error("启动隧道失败:", error);
      setTunnelStatus("error");
    }
  };

  const handleStopTunnel = async () => {
    try {
      setTunnelStatus("idle");

      console.log("停止隧道...");

      // 调用后端 API 停止隧道
      const { token: proxyAuthToken, header: proxyAuthTokenHeader } =
        getMCPProxyAuthToken(config);
      const headers: HeadersInit = {};
      if (proxyAuthToken) {
        headers[proxyAuthTokenHeader] = `Bearer ${proxyAuthToken}`;
      }

      const response = await fetch(
        `${getMCPProxyAddress(config)}/tunnel/stop`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...headers,
          },
        },
      );

      if (!response.ok) {
        throw new Error(`停止隧道失败: ${response.statusText}`);
      }

      setPublicUrl("");
      console.log("隧道停止成功");
    } catch (error) {
      console.error("停止隧道失败:", error);
      setTunnelStatus("error");
    }
  };

  const handleDisconnect = () => {
    disconnectMcpServer();
    if (tunnelStatus === "active") {
      handleStopTunnel();
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <div
        style={{
          width: sidebarWidth,
          minWidth: 200,
          maxWidth: 600,
          transition: isSidebarDragging ? "none" : "width 0.15s",
        }}
        className="bg-card border-r border-border flex flex-col h-full relative"
      >
        <Sidebar
          connectionStatus={connectionStatus}
          transportType={transportType}
          setTransportType={setTransportType}
          command={command}
          setCommand={setCommand}
          args={args}
          setArgs={setArgs}
          sseUrl={sseUrl}
          setSseUrl={setSseUrl}
          env={env}
          setEnv={setEnv}
          config={config}
          setConfig={setConfig}
          bearerToken={bearerToken}
          setBearerToken={setBearerToken}
          headerName={headerName}
          setHeaderName={setHeaderName}
          onConnect={connectMcpServer}
          onDisconnect={handleDisconnect}
          stdErrNotifications={stdErrNotifications}
          logLevel={logLevel}
          sendLogLevelRequest={sendLogLevelRequest}
          loggingSupported={!!serverCapabilities?.logging || false}
          clearStdErrNotifications={clearStdErrNotifications}
        />
        {/* Drag handle for resizing sidebar */}
        <div
          onMouseDown={handleSidebarDragStart}
          style={{
            cursor: "col-resize",
            position: "absolute",
            top: 0,
            right: 0,
            width: 6,
            height: "100%",
            zIndex: 10,
            background: isSidebarDragging ? "rgba(0,0,0,0.08)" : "transparent",
          }}
          aria-label="Resize sidebar"
          data-testid="sidebar-drag-handle"
        />
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900">
          <div className="max-w-7xl mx-auto">
            <StatusPanel
            connectionStatus={connectionStatus}
            transportType={transportType}
            command={command}
            args={args}
            sseUrl={sseUrl}
            localUrl={localUrl}
            publicUrl={publicUrl}
            onStartTunnel={handleStartTunnel}
            onStopTunnel={handleStopTunnel}
            tunnelStatus={tunnelStatus}
          />
          </div>
        </div>
        <div
          className="relative border-t border-border"
          style={{
            height: `${historyPaneHeight}px`,
          }}
        >
          <div
            className="absolute w-full h-4 -top-2 cursor-row-resize flex items-center justify-center hover:bg-accent/50 dark:hover:bg-input/40"
            onMouseDown={handleDragStart}
          >
            <div className="w-8 h-1 rounded-full bg-border" />
          </div>
          <div className="h-full overflow-auto">
            {tunnelStatus === "active" ? (
              <NgrokPanel key={publicUrl} />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-muted-foreground">
                  <h3 className="text-lg font-semibold">Ngrok Inspector</h3>
                  <p className="text-sm">
                    {tunnelStatus === "starting"
                      ? "Tunnel is starting..."
                      : "Start the tunnel to inspect traffic."}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
