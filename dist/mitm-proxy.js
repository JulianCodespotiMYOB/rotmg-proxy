"use strict";
// mitm-proxy.ts
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const net = __importStar(require("net"));
const https = __importStar(require("https"));
const xml2js_1 = require("xml2js");
const build_1 = require("realmlib/build"); // Adjust import paths as necessary
const rc4keys_1 = require("./rc4keys");
const packet_map_1 = require("./packet-map");
// --- Fetching the server list ---
async function fetchServerList() {
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
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = "";
            res.on("data", (chunk) => { data += chunk; });
            res.on("end", async () => {
                try {
                    const result = await (0, xml2js_1.parseStringPromise)(data, { explicitArray: false });
                    // Expecting XML structure: <Servers><Server>...</Server><Server>...</Server></Servers>
                    const servers = result.Servers.Server;
                    const serverList = Array.isArray(servers) ? servers : [servers];
                    resolve(serverList);
                }
                catch (e) {
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
async function getPreferredServer() {
    try {
        const servers = await fetchServerList();
        // For example, choose the server with Name "Australia" if available
        let preferred = servers.find(s => s.Name === "Australia") || servers[0];
        console.log("Fetched server list. Preferred server:", preferred);
        return { host: preferred.DNS, port: 2050 }; // Game traffic uses port 2050
    }
    catch (e) {
        console.error("Error fetching server list, using fallback.", e);
        return { host: "54.86.47.176", port: 2050 }; // Fallback values
    }
}
// --- MITM Proxy using PacketIO ---
class RotmgMitmProxy {
    constructor() {
        this.preferredServer = { host: "", port: 2050 };
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
    start() {
        this.server.listen(MITM_PORT, () => {
            console.log(`MITM proxy listening on port ${MITM_PORT}`);
        });
        this.server.on("error", (err) => {
            console.error("Server error:", err);
        });
    }
    handleConnection(clientSocket) {
        console.log(`Client connected: ${clientSocket.remoteAddress}:${clientSocket.remotePort}`);
        const { host, port } = this.preferredServer;
        const serverSocket = net.connect(port, host, () => {
            console.log(`Connected to real server at ${host}:${port}`);
        });
        // Create PacketIO for client → server traffic using OUTGOING key.
        const clientConfig = {
            incomingKey: rc4keys_1.OUTGOING_KEY,
            outgoingKey: rc4keys_1.OUTGOING_KEY,
        };
        const clientIO = new build_1.PacketIO({
            socket: clientSocket,
            rc4: clientConfig,
        });
        clientIO.packetMap = packet_map_1.PACKET_MAP;
        clientIO.on("error", (err) => {
            console.error("Client PacketIO error:", err);
        });
        // Create PacketIO for server → client traffic using INCOMING key.
        const serverConfig = {
            incomingKey: rc4keys_1.INCOMING_KEY,
            outgoingKey: rc4keys_1.INCOMING_KEY,
        };
        const serverIO = new build_1.PacketIO({
            socket: serverSocket,
            rc4: serverConfig,
        });
        serverIO.packetMap = packet_map_1.PACKET_MAP;
        serverIO.on("error", (err) => {
            console.error("Server PacketIO error:", err);
        });
        // Forward packets from client to server.
        clientIO.on("packet", (packet) => {
            console.log("Client → Server packet:", packet.toString());
            try {
                serverIO.send(packet);
            }
            catch (e) {
                console.error("Error forwarding packet from client to server:", e);
            }
        });
        // Forward packets from server to client.
        serverIO.on("packet", (packet) => {
            console.log("Server → Client packet:", packet.toString());
            try {
                clientIO.send(packet);
            }
            catch (e) {
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
