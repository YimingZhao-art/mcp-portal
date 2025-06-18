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
            <label className="text-sm font-medium text-muted-foreground">传输类型</label>
            <p className="text-sm">{transportType.toUpperCase()}</p>
          </div>
          {transportType === "stdio" ? (
            <>
              <div>
                <label className="text-sm font-medium text-muted-foreground">命令</label>
                <p className="text-sm font-mono bg-muted p-2 rounded">{command || "未设置"}</p>
              </div>
              {args && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">参数</label>
                  <p className="text-sm font-mono bg-muted p-2 rounded">{args}</p>
                </div>
              )}
            </>
          ) : (
            <div>
              <label className="text-sm font-medium text-muted-foreground">URL</label>
              <p className="text-sm font-mono bg-muted p-2 rounded break-all">{sseUrl || "未设置"}</p>
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
                  本地地址 {transportType === "stdio" ? "(Supergateway SSE)" : ""}
                </label>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-mono bg-muted p-2 rounded flex-1 break-all">{localUrl}</p>
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
                  <p className="text-sm font-mono bg-muted p-2 rounded flex-1 break-all">{publicUrl}</p>
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
                  <RefreshCw className={`h-4 w-4 mr-2 ${tunnelStatus === "starting" ? "animate-spin" : ""}`} />
                  停止隧道
                </Button>
              )}
              
            </div>
          </CardContent>
        </Card>
      )}

      {/* 连接说明 */}
      {connectionStatus === "disconnected" && (
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
      )}
    </div>
  );
};

export default StatusPanel; 