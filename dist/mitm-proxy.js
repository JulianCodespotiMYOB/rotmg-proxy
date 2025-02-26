"use strict";
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
exports.RotmgMitmProxy = void 0;
const net = __importStar(require("net"));
const tls = __importStar(require("tls"));
const build_1 = require("realmlib/build");
const packet_map_1 = require("./packet-map");
const rc4_config_1 = require("./rc4-config");
/**
 * A ROTMG MITM proxy that performs an HTTP CONNECT handshake,
 * then sets up a manual tunnel that buffers full packets before processing.
 */
class RotmgMitmProxy {
    constructor(options) {
        this.options = options;
        // Create a TCP server that will wait for HTTP CONNECT
        this.server = net.createServer((clientSocket) => this.handleConnection(clientSocket));
    }
    start(port) {
        this.server.listen(port, () => {
            console.log(`MITM proxy listening on port ${port}`);
            console.log(`Configure your client to use HTTP proxy at localhost:${port}`);
        });
        this.server.on('error', (err) => {
            console.error('Proxy server error:', err);
        });
    }
    handleConnection(clientSocket) {
        const clientId = `${clientSocket.remoteAddress}:${clientSocket.remotePort}`.split(':').pop();
        console.log(`Client connected: ${clientId}`);
        // Wait for the HTTP CONNECT handshake.
        clientSocket.once('data', (data) => {
            const headerEnd = data.indexOf("\r\n\r\n");
            if (headerEnd === -1) {
                console.error("Invalid HTTP header received.");
                clientSocket.end();
                return;
            }
            const headerBuf = data.subarray(0, headerEnd + 4);
            const leftover = data.subarray(headerEnd + 4);
            const header = headerBuf.toString('utf8');
            console.log(`Received from client: ${header}`);
            // Parse CONNECT request.
            const match = header.match(/CONNECT\s+([^:]+):(\d+)/);
            if (!match) {
                console.error('Invalid CONNECT request format');
                clientSocket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
                return;
            }
            const targetHost = match[1];
            const targetPort = parseInt(match[2], 10);
            console.log(`Client wants to connect to ${targetHost}:${targetPort}`);
            let serverSocket;
            const onConnect = () => {
                console.log(`TCP connection established to ${targetHost}:${targetPort} for client ${clientId}`);
                clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
                if (leftover.length != 0) {
                    clientSocket.unshift(leftover);
                }
                // In this version we immediately start the manual tunnel.
                this.setupTunnel(clientSocket, serverSocket, clientId);
            };
            if (targetPort === 443) {
                serverSocket = tls.connect({
                    host: targetHost,
                    port: targetPort,
                    rejectUnauthorized: true
                }, onConnect);
                console.log(`TLS connection established to ${targetHost}:${targetPort} for client ${clientId}`);
            }
            else {
                console.log(`TCP connection to ${targetHost}:${targetPort} for client ${clientId}`);
                serverSocket = net.connect(targetPort, targetHost, onConnect);
            }
            serverSocket.on('error', (err) => {
                console.error(`Server socket error for client ${clientId}:`, err);
                clientSocket.end();
            });
            serverSocket.on('close', () => {
                console.log(`Server socket for client ${clientId} closed.`);
                clientSocket.end();
            });
        });
        clientSocket.on('error', (err) => {
            console.error(`Client socket error (${clientId}):`, err);
        });
        clientSocket.on('close', () => {
            console.log(`Client socket closed for ${clientId}`);
        });
    }
    /**
     * Sets up the manual tunnel between client and server.
     * This version uses a simple buffering approach similar to KRelay’s.
     */
    setupTunnel(clientSocket, serverSocket, clientId) {
        // Initialize PacketIO instances using realmlib's implementation.
        const clientIO = new build_1.PacketIO({
            socket: clientSocket,
            rc4: rc4_config_1.CLIENT_TO_SERVER_RC4, // Use client-to-server config for data coming from client
            packetMap: packet_map_1.PACKET_MAP
        });
        const serverIO = new build_1.PacketIO({
            socket: serverSocket,
            rc4: rc4_config_1.SERVER_TO_CLIENT_RC4, // Use server-to-client config for data coming from server
            packetMap: packet_map_1.PACKET_MAP
        });
        // Log and forward packets in both directions.
        Object.values(build_1.PacketType).forEach((type) => {
            clientIO.on(type, (packet) => {
                console.log(`[${clientId}] Client -> Server: ${type}`);
                console.log(packet.toString());
                serverIO.send(packet);
            });
            serverIO.on(type, (packet) => {
                console.log(`[${clientId}] Server -> Client: ${type}`);
                console.log(packet.toString());
                clientIO.send(packet);
            });
        });
    }
    close() {
        this.server.close(() => {
            console.log('Proxy server closed');
        });
    }
}
exports.RotmgMitmProxy = RotmgMitmProxy;
