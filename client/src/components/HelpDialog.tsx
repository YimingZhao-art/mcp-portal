import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface HelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const HelpDialog: React.FC<HelpDialogProps> = ({ open, onOpenChange }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>使用说明</DialogTitle>
          <DialogDescription>
            如何使用 MCP Portal 连接和测试 MCP 服务器
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <p className="font-medium mb-1">1. 选择传输类型</p>
            <p className="text-muted-foreground">在左侧选择 STDIO、SSE 或 Streamable HTTP</p>
          </div>
          <div>
            <p className="font-medium mb-1">2. 填写配置信息</p>
            <p className="text-muted-foreground">
              - STDIO: 输入命令和参数<br />
              - SSE/HTTP: 输入服务器 URL
            </p>
          </div>
          <div>
            <p className="font-medium mb-1">3. 连接服务器</p>
            <p className="text-muted-foreground">点击连接按钮启动 MCP 服务器</p>
          </div>
          <div>
            <p className="font-medium mb-1">4. 启动公网隧道（可选）</p>
            <p className="text-muted-foreground">连接成功后可以启动 ngrok 隧道分享访问</p>
          </div>
          <div className="pt-3 border-t">
            <p className="text-xs text-muted-foreground">
              提示：首次使用时，请确保已安装所需依赖（ngrok、supergateway）。
              点击左侧的 Dependency Setup 进行配置。
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};