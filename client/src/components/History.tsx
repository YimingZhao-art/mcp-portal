import React from "react";

const NgrokPanel = () => {
  return (
    <div className="bg-card flex flex-col h-full">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">Ngrok Inspector</h2>
        <p className="text-sm text-muted-foreground">
          Real-time traffic inspection from the ngrok Web UI.
        </p>
      </div>
      <div className="flex-1 overflow-hidden">
        <iframe
          src="http://127.0.0.1:4040/inspect/http"
          className="w-full h-full border-0"
          title="Ngrok Inspector"
        />
      </div>
    </div>
  );
};

export default NgrokPanel;
