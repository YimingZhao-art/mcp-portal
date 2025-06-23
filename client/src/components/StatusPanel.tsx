import React from "react";
import { ConnectionStatus } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Copy, ExternalLink, RefreshCw } from "lucide-react";
import { useToast } from "@/lib/hooks/useToast";

interface StatusPanelProps {
  connectionStatus: ConnectionStatus;
  transportType: "stdio" | "sse" | "streamable-http";
  command: string;
  args: string;
  sseUrl: string;
  localUrl?: string;
  publicUrl?: string;
  onStartTunnel?: () => void;
  onStopTunnel?: () => void;
  tunnelStatus?: "idle" | "starting" | "active" | "error";
}

const StatusPanel: React.FC<StatusPanelProps> = ({
  connectionStatus,
  transportType,
  command,
  args,
  sseUrl,
  localUrl,
  publicUrl,
  onStartTunnel,
  onStopTunnel,
  tunnelStatus = "idle",
}) => {
  const { toast } = useToast();

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "已复制",
        description: `${label}已复制到剪贴板`,
      });
    });
  };

  const getStatusBadge = () => {
    switch (connectionStatus) {
      case "connected":
        return <Badge className="bg-green-500">已连接</Badge>;
      case "disconnected":
        return <Badge variant="secondary">未连接</Badge>;
      case "error":
        return <Badge variant="destructive">连接错误</Badge>;
      case "error-connecting-to-proxy":
        return <Badge variant="destructive">代理连接错误</Badge>;
      default:
        return <Badge variant="outline">未知状态</Badge>;
    }
  };

  const getTunnelStatusBadge = () => {
    switch (tunnelStatus) {
      case "active":
        return <Badge className="bg-blue-500">隧道活跃</Badge>;
      case "starting":
        return <Badge variant="secondary">启动中...</Badge>;
      case "error":
        return <Badge variant="destructive">隧道错误</Badge>;
      default:
        return <Badge variant="outline">隧道未启动</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">服务状态</h2>
        {getStatusBadge()}
      </div>

      {/* 当前配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">当前配置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              传输类型
            </label>
            <p className="text-sm">{transportType.toUpperCase()}</p>
          </div>
          {transportType === "stdio" ? (
            <>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  命令
                </label>
                <p className="text-sm font-mono bg-muted p-2 rounded">
                  {command || "未设置"}
                </p>
              </div>
              {args && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    参数
                  </label>
                  <p className="text-sm font-mono bg-muted p-2 rounded">
                    {args}
                  </p>
                </div>
              )}
            </>
          ) : (
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                URL
              </label>
              <p className="text-sm font-mono bg-muted p-2 rounded break-all">
                {sseUrl || "未设置"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 服务地址 */}
      {connectionStatus === "connected" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">服务地址</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {localUrl && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  本地地址{" "}
                  {transportType === "stdio" ? "(Supergateway SSE)" : ""}
                </label>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-mono bg-muted p-2 rounded flex-1 break-all">
                    {localUrl}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(localUrl, "本地地址")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(localUrl, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {publicUrl && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  公网地址 (Ngrok 隧道)
                </label>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-mono bg-muted p-2 rounded flex-1 break-all">
                    {publicUrl}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(publicUrl, "公网地址")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(publicUrl, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
                {transportType === "stdio" && (
                  <p className="text-xs text-muted-foreground">
                    注意：访问时需要在URL后添加 /sse 路径，如: {publicUrl}/sse
                  </p>
                )}
                {(transportType === "sse" ||
                  transportType === "streamable-http") && (
                  <p className="text-xs text-muted-foreground">
                    注意：此URL已包含完整路径，可直接访问
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Ngrok 隧道控制 */}
      {connectionStatus === "connected" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">公网隧道</CardTitle>
              {getTunnelStatusBadge()}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              {tunnelStatus === "idle" || tunnelStatus === "error" ? (
                <Button onClick={onStartTunnel} disabled={!onStartTunnel}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  启动隧道
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={onStopTunnel}
                  disabled={!onStopTunnel || tunnelStatus === "starting"}
                >
                  <RefreshCw
                    className={`h-4 w-4 mr-2 ${tunnelStatus === "starting" ? "animate-spin" : ""}`}
                  />
                  停止隧道
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 连接说明 */}
      {connectionStatus === "disconnected" && (
        <>
          {/* Ngrok 配置指南 */}
          <Card className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="text-orange-600 dark:text-orange-400">⚠️ 重要：配置 Ngrok</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm font-medium">
                  要使用公网隧道功能，请先配置 Ngrok：
                </p>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-sm font-bold text-orange-600 dark:text-orange-400">1.</span>
                    <div className="flex-1">
                      <p className="text-sm">
                        访问 Ngrok 官网注册并获取 authtoken：
                      </p>
                      <a
                        href="https://dashboard.ngrok.com/get-started/setup/macos"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline dark:text-blue-400 flex items-center gap-1 mt-1"
                      >
                        https://dashboard.ngrok.com/get-started/setup/macos
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-sm font-bold text-orange-600 dark:text-orange-400">2.</span>
                    <div className="flex-1">
                      <p className="text-sm">安装 Ngrok：</p>
                      <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded font-mono block mt-1">
                        brew install ngrok
                      </code>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-sm font-bold text-orange-600 dark:text-orange-400">3.</span>
                    <div className="flex-1">
                      <p className="text-sm">配置您的 authtoken：</p>
                      <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded font-mono block mt-1">
                        ngrok config add-authtoken YOUR_AUTH_TOKEN
                      </code>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  配置完成后，您就可以使用公网隧道功能将本地服务暴露到互联网。
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">使用说明</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>1. 在左侧选择传输类型（STDIO 或 SSE/HTTP）</p>
                <p>2. 填写相应的配置信息</p>
                <p>3. 点击连接按钮启动服务</p>
                <p>4. 连接成功后可以启动公网隧道分享访问</p>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default StatusPanel;
