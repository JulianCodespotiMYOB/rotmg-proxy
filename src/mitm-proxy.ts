// mitm-proxy.ts

import * as net from "net";
import * as https from "https";
import { parseStringPromise } from "xml2js";
import { PacketIO, RC4Config } from "realmlib/build"; // Adjust import paths as necessary
import { Packet } from "realmlib/build"; // Adjust import paths as necessary
import { INCOMING_KEY, OUTGOING_KEY } from "./rc4keys";
import { PACKET_MAP } from "./packet-map";

// --- Types for the server list ---
interface ServerInfo {
  Name: string;
  DNS: string;
  Lat: string;
  Long: string;
  Usage: string;
}

// --- Fetching the server list ---
async function fetchServerList(): Promise<ServerInfo[]> {
  const postData = "accessToken=Pze7wj7ENd0jrymi%2bUqicn5HJSZQUvR1FS3Ro1ax8HtZ%2bs%2bYKisGwuvt4VcnK%2f6OW%2fWxv2BCy9Bboj5tik%2bb4pnTUQWtx2Y8HBtpzpX5O8%2f6Ff4SiZt2G0GP3qAFRlj2GYV1CUhEwtgIrd%2bfyKpqVteTtzGRLJa3y2GJf03pA%2bLhRC4kX3qGUbZ5jqrQweSfm2xRXSTuqXj6guKEhZ2k1yeu%2fpFT3GcqDgQr4XLjBg8Vl6ApuTbgJMAox6U%2fTRlkuz5raWYsbru2DznQBh9iH1EZbhpVob7dNqTLKek2ej5ULzHFr93DUFJAzrvU2zxoYQEDVwB9DoCQpIYkRziwfA%3d%3d&game_net=Unity&play_platform=Unity&game_net_user_id=";
  const options = {
    hostname: "www.realmofthemadgod.com",
    port: 443,
    path: "/account/servers",
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": Buffer.byteLength(postData),
    },
  };

  return new Promise<ServerInfo[]>((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", async () => {
        try {
          const result = await parseStringPromise(data, { explicitArray: false });
          // Expecting XML structure: <Servers><Server>...</Server><Server>...</Server></Servers>
          const servers = result.Servers.Server;
          const serverList: ServerInfo[] = Array.isArray(servers) ? servers : [servers];
          resolve(serverList);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", (e) => reject(e));
    req.write(postData);
    req.end();
  });
}

// --- Choose a preferred server ---
async function getPreferredServer(): Promise<{ host: string; port: number }> {
  try {
    const servers = await fetchServerList();
    // For example, choose the server with Name "Australia" if available
    let preferred = servers.find(s => s.Name === "Australia") || servers[0];
    console.log("Fetched server list. Preferred server:", preferred);
    return { host: preferred.DNS, port: 2050 }; // Game traffic uses port 2050
  } catch (e) {
    console.error("Error fetching server list, using fallback.", e);
    return { host: "54.86.47.176", port: 2050 }; // Fallback values
  }
}

// --- MITM Proxy using PacketIO ---
class RotmgMitmProxy {
  private server: net.Server;
  private preferredServer: { host: string; port: number } = { host: "", port: 2050 };

  constructor() {
    this.server = net.createServer((clientSocket) => this.handleConnection(clientSocket));
    // Fetch the preferred server on startup.
    getPreferredServer().then((serverInfo) => {
      this.preferredServer = serverInfo;
      console.log("Preferred server set to:", serverInfo);
    }).catch((err) => {
      console.error("Failed to get preferred server:", err);
      this.preferredServer = { host: "54.86.47.176", port: 2050 };
    });
  }

  public start(): void {
    this.server.listen(MITM_PORT, () => {
      console.log(`MITM proxy listening on port ${MITM_PORT}`);
    });
    this.server.on("error", (err) => {
      console.error("Server error:", err);
    });
  }

  private handleConnection(clientSocket: net.Socket): void {
    console.log(`Client connected: ${clientSocket.remoteAddress}:${clientSocket.remotePort}`);

    const { host, port } = this.preferredServer;
    const serverSocket = net.connect(port, host, () => {
      console.log(`Connected to real server at ${host}:${port}`);
    });

    // Create PacketIO for client → server traffic using OUTGOING key.
    const clientConfig: RC4Config = {
      incomingKey: OUTGOING_KEY,
      outgoingKey: OUTGOING_KEY,
    };
    const clientIO = new PacketIO({
      socket: clientSocket,
      rc4: clientConfig,
    });
    clientIO.packetMap = PACKET_MAP;
    clientIO.on("error", (err: Error) => {
      console.error("Client PacketIO error:", err);
    });

    // Create PacketIO for server → client traffic using INCOMING key.
    const serverConfig: RC4Config = {
      incomingKey: INCOMING_KEY,
      outgoingKey: INCOMING_KEY,
    };
    const serverIO = new PacketIO({
      socket: serverSocket,
      rc4: serverConfig,
    });
    serverIO.packetMap = PACKET_MAP;
    serverIO.on("error", (err: Error) => {
      console.error("Server PacketIO error:", err);
    });

    // Forward packets from client to server.
    clientIO.on("packet", (packet: Packet) => {
      console.log("Client → Server packet:", packet.toString());
      try {
        serverIO.send(packet);
      } catch (e) {
        console.error("Error forwarding packet from client to server:", e);
      }
    });

    // Forward packets from server to client.
    serverIO.on("packet", (packet: Packet) => {
      console.log("Server → Client packet:", packet.toString());
      try {
        clientIO.send(packet);
      } catch (e) {
        console.error("Error forwarding packet from server to client:", e);
      }
    });

    clientSocket.on("error", (err) => {
      console.error("Client socket error:", err);
      serverSocket.end();
    });
    serverSocket.on("error", (err) => {
      console.error("Server socket error:", err);
      clientSocket.end();
    });
    clientSocket.on("close", () => {
      console.log("Client socket closed.");
      serverSocket.end();
    });
    serverSocket.on("close", () => {
      console.log("Server socket closed.");
      clientSocket.end();
    });
  }
}

// --- Global error handling ---
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

const MITM_PORT = 2050; // Listen on game port for MITM proxy.
const proxy = new RotmgMitmProxy();
proxy.start();
