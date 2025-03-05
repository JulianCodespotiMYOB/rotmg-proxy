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
                if (leftover.length > 0) {
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
    // Modified version of mitm-proxy.ts
    setupTunnel(clientSocket, serverSocket, clientId) {
        // We'll still use PacketIO but we'll add better error handling
        try {
            const clientIO = new build_1.PacketIO({
                socket: clientSocket,
                rc4: rc4_config_1.CLIENT_TO_SERVER_RC4,
                packetMap: packet_map_1.PACKET_MAP
            });
            const serverIO = new build_1.PacketIO({
                socket: serverSocket,
                rc4: rc4_config_1.SERVER_TO_CLIENT_RC4,
                packetMap: packet_map_1.PACKET_MAP
            });
            // Add error handlers to prevent crashes
            clientIO.on('error', (err) => {
                console.error(`[${clientId}] Client PacketIO error:`, err);
                // Just log and continue, don't crash
            });
            serverIO.on('error', (err) => {
                console.error(`[${clientId}] Server PacketIO error:`, err);
                // Just log and continue, don't crash
            });
            // Register for all packet types
            Object.values(build_1.PacketType).forEach((type) => {
                try {
                    clientIO.on(type, (packet) => {
                        try {
                            console.log(`[${clientId}] Client -> Server: ${type}`);
                            console.log(packet.toString());
                            serverIO.send(packet);
                        }
                        catch (error) {
                            console.error(`Error handling client packet of type ${type}:`, error);
                            // Just forward the raw data if parsing fails
                            if (serverSocket.writable) {
                                serverSocket.write(clientSocket.read());
                            }
                        }
                    });
                    serverIO.on(type, (packet) => {
                        try {
                            console.log(`[${clientId}] Server -> Client: ${type}`);
                            console.log(packet.toString());
                            clientIO.send(packet);
                        }
                        catch (error) {
                            console.error(`Error handling server packet of type ${type}:`, error);
                            // Just forward the raw data if parsing fails
                            if (clientSocket.writable) {
                                clientSocket.write(serverSocket.read());
                            }
                        }
                    });
                }
                catch (error) {
                    console.error(`Error registering handler for packet type ${type}:`, error);
                }
            });
        }
        catch (error) {
            console.error(`Error setting up packet handling for client ${clientId}:`, error);
            // Fall back to simple pass-through if PacketIO setup fails
            console.log(`Falling back to simple pass-through for client ${clientId}`);
            clientSocket.on('data', (data) => {
                if (serverSocket.writable) {
                    serverSocket.write(data);
                }
            });
            serverSocket.on('data', (data) => {
                if (clientSocket.writable) {
                    clientSocket.write(data);
                }
            });
        }
    }
    close() {
        this.server.close(() => {
            console.log('Proxy server closed');
        });
    }
}
exports.RotmgMitmProxy = RotmgMitmProxy;
