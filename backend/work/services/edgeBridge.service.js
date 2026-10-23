import { WebSocketServer } from "ws";

/**
 * Cheeni Duplex Edge Bridge (Phase 2)
 * 
 * Manages WebSocket connections between:
 * 1. Cloud Backend (Render Container)
 * 2. Edge Desktop Daemon (User's Windows Laptop)
 * 3. Browser UI Client (Dashboard)
 * 
 * Enables cloud-to-desktop tool dispatch (JSON-RPC) and real-time telemetry streaming.
 */

class EdgeBridgeHub {
  constructor() {
    this.edgeSockets = new Map(); // deviceId -> ws
    this.pendingCallbacks = new Map(); // requestId -> { resolve, reject, timeout }
    this.requestIdCounter = 1;
  }

  attach(httpServer) {
    this.wss = new WebSocketServer({ server: httpServer, path: "/ws/edge-bridge" });

    this.wss.on("connection", (ws, req) => {
      let registeredDeviceId = null;

      ws.on("message", (raw) => {
        try {
          const msg = JSON.parse(raw.toString());

          // Device Registration
          if (msg.type === "REGISTER_EDGE_DEVICE") {
            registeredDeviceId = msg.deviceId || "default-laptop";
            this.edgeSockets.set(registeredDeviceId, ws);
            console.log(`[EdgeBridge] Registered Desktop Client: ${registeredDeviceId}`);
            ws.send(JSON.stringify({ type: "REGISTERED_OK", deviceId: registeredDeviceId }));
            return;
          }

          // Tool Execution Response from Laptop
          if (msg.type === "RPC_RESPONSE" && msg.requestId) {
            const pending = this.pendingCallbacks.get(msg.requestId);
            if (pending) {
              clearTimeout(pending.timeout);
              this.pendingCallbacks.delete(msg.requestId);
              if (msg.error) {
                pending.reject(new Error(msg.error));
              } else {
                pending.resolve(msg.result);
              }
            }
            return;
          }
        } catch (e) {
          console.error("[EdgeBridge] Failed to parse message:", e);
        }
      });

      ws.on("close", () => {
        if (registeredDeviceId) {
          this.edgeSockets.delete(registeredDeviceId);
          console.log(`[EdgeBridge] Disconnected Desktop Client: ${registeredDeviceId}`);
        }
      });
    });

    console.log("[EdgeBridge] WebSocket Server attached to /ws/edge-bridge");
  }

  isDeviceConnected(deviceId = "default-laptop") {
    const ws = this.edgeSockets.get(deviceId);
    return Boolean(ws && ws.readyState === ws.OPEN);
  }

  /**
   * Dispatches a tool execution to the connected user desktop over WebSocket.
   * @param {string} toolName
   * @param {Object} toolArgs
   * @param {string} deviceId
   * @returns {Promise<any>}
   */
  async dispatchTool(toolName, toolArgs = {}, deviceId = "default-laptop") {
    const ws = this.edgeSockets.get(deviceId);
    if (!ws || ws.readyState !== ws.OPEN) {
      throw new Error(`Desktop Edge Daemon '${deviceId}' is not currently connected.`);
    }

    const requestId = `req_${Date.now()}_${this.requestIdCounter++}`;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingCallbacks.delete(requestId);
        reject(new Error(`Tool execution timed out after 10 seconds: ${toolName}`));
      }, 10000);

      this.pendingCallbacks.set(requestId, { resolve, reject, timeout });

      const payload = {
        type: "RPC_CALL",
        requestId,
        tool: toolName,
        args: toolArgs,
      };

      ws.send(JSON.stringify(payload));
    });
  }
}

export const edgeBridgeHub = new EdgeBridgeHub();
