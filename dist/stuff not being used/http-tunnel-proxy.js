"use strict";
// http-tunnel-proxy.ts - HTTP Tunnel Proxy for ROTMG
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
const tls = __importStar(require("tls"));
const custom_rc4_1 = require("./custom-rc4");
const PROXY_PORT = 2050;
/**
 * A proxy that handles HTTP CONNECT tunneling for ROTMG
 */
class RotmgHttpTunnelProxy {
    constructor() {
        this.server = net.createServer(this.handleConnection.bind(this));
    }
    /**
     * Start the proxy server
     */
    start() {
        this.server.listen(PROXY_PORT, () => {
            console.log(`ROTMG HTTP Tunnel Proxy listening on port ${PROXY_PORT}`);
            console.log(`Configure your client to use HTTP proxy at localhost:${PROXY_PORT}`);
        });
        this.server.on('error', (err) => {
            console.error('Proxy server error:', err);
        });
    }
    /**
     * Handle a new client connection
     */
    handleConnection(clientSocket) {
        console.log(`Client connected from ${clientSocket.remoteAddress}:${clientSocket.remotePort}`);
        let targetHost = '';
        let targetPort = 443;
        let serverSocket = null;
        let connectEstablished = false;
        let useEncryption = false;
        // Create RC4 ciphers
        const clientToServerCipher = new custom_rc4_1.CustomRC4(custom_rc4_1.CLIENT_SEND_KEY);
        const serverToClientCipher = new custom_rc4_1.CustomRC4(custom_rc4_1.SERVER_SEND_KEY);
        // Handle data from client
        clientSocket.on('data', (data) => {
            try {
                // If we haven't established the tunnel yet, look for CONNECT
                if (!connectEstablished) {
                    const message = data.toString('utf8');
                    console.log('Received from client:', message);
                    if (message.startsWith('CONNECT')) {
                        // Parse the CONNECT request
                        const connectMatch = message.match(/CONNECT ([^:]+):(\d+) /);
                        if (connectMatch) {
                            targetHost = connectMatch[1];
                            targetPort = parseInt(connectMatch[2], 10);
                            console.log(`Client wants to connect to ${targetHost}:${targetPort}`);
                            // Determine if we're connecting to the real ROTMG server
                            if (targetHost.includes('realmofthemadgod.com')) {
                                console.log('This is a ROTMG connection - will apply encryption when needed');
                                useEncryption = true;
                            }
                            // Connect to the target server
                            if (targetPort === 443) {
                                // For HTTPS connections
                                serverSocket = tls.connect({
                                    host: targetHost,
                                    port: targetPort,
                                    rejectUnauthorized: true // Accept self-signed certificates
                                }, () => {
                                    console.log(`TLS connection established to ${targetHost}:${targetPort}`);
                                    // Send success response to client
                                    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
                                    connectEstablished = true;
                                });
                            }
                            else {
                                // For regular TCP connections
                                serverSocket = net.connect({
                                    host: targetHost,
                                    port: targetPort
                                }, () => {
                                    console.log(`TCP connection established to ${targetHost}:${targetPort}`);
                                    // Send success response to client
                                    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
                                    connectEstablished = true;
                                });
                            }
                            // Setup server socket event handlers
                            if (serverSocket) {
                                setupServerSocketHandlers(serverSocket);
                            }
                        }
                        else {
                            console.error('Invalid CONNECT request format');
                            clientSocket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
                        }
                    }
                    else {
                        console.log('Non-CONNECT request received');
                        clientSocket.end('HTTP/1.1 405 Method Not Allowed\r\n\r\n');
                    }
                }
                else {
                    // Tunnel is established, relay data to server
                    if (serverSocket && serverSocket.writable) {
                        // Log data sent from client to server
                        console.log('Data sent from client to server:', data);
                        // If this is a ROTMG connection and we need to apply encryption
                        if (useEncryption && isGamePacket(data)) {
                            // Clone the data so we don't modify the original
                            const processedData = Buffer.from(data);
                            // Only process data part (after header)
                            processGamePacket(processedData, true);
                            // Send the processed data
                            serverSocket.write(processedData);
                        }
                        else {
                            // Regular data - send as is
                            serverSocket.write(data);
                        }
                    }
                }
            }
            catch (error) {
                console.error('Error processing client data:', error);
                if (!clientSocket.destroyed) {
                    clientSocket.end();
                }
            }
        });
        /**
         * Setup event handlers for the server socket
         */
        function setupServerSocketHandlers(socket) {
            socket.on('data', (data) => {
                try {
                    // Log data sent from server to client
                    console.log('Data sent from server to client:', data);
                    // Relay data back to client
                    if (!clientSocket.destroyed) {
                        // If this is a ROTMG connection and we need to apply encryption
                        if (useEncryption && isGamePacket(data)) {
                            // Clone the data so we don't modify the original
                            const processedData = Buffer.from(data);
                            // Process game packet
                            processGamePacket(processedData, false);
                            // Send the processed data
                            clientSocket.write(processedData);
                        }
                        else {
                            // Regular data - send as is
                            clientSocket.write(data);
                        }
                    }
                }
                catch (error) {
                    console.error('Error processing server data:', error);
                }
            });
            socket.on('error', (err) => {
                console.error('Server socket error:', err);
                if (!clientSocket.destroyed) {
                    clientSocket.end();
                }
            });
            socket.on('close', () => {
                console.log('Server socket closed');
                if (!clientSocket.destroyed) {
                    clientSocket.end();
                }
            });
        }
        // Handle client socket events
        clientSocket.on('error', (err) => {
            console.error('Client socket error:', err);
            if (serverSocket && !serverSocket.destroyed) {
                serverSocket.end();
            }
        });
        clientSocket.on('close', () => {
            console.log('Client socket closed');
            if (serverSocket && !serverSocket.destroyed) {
                serverSocket.end();
            }
        });
        /**
         * Check if data appears to be a game packet
         */
        function isGamePacket(data) {
            // Implement logic to detect ROTMG game packets
            // For now, assume data over a certain size after connection establishment is game data
            return data.length > 5;
        }
        /**
         * Process a game packet applying appropriate encryption/decryption
         */
        function processGamePacket(data, isClientToServer) {
            try {
                // Extract header info (first 5 bytes)
                const packetSize = data.readInt32BE(0);
                const packetId = data[4];
                console.log(`${isClientToServer ? 'Client -> Server' : 'Server -> Client'} Packet ID: ${packetId}, Size: ${data.length}`);
                // Only encrypt/decrypt the data part (after 5-byte header)
                if (data.length > 5) {
                    const dataToProcess = data.subarray(5);
                    if (isClientToServer) {
                        // Client to Server: decrypt with clientToServerCipher
                        clientToServerCipher.decrypt(dataToProcess);
                        // ... packet processing logic if needed ...
                        clientToServerCipher.reset();
                        clientToServerCipher.encrypt(dataToProcess);
                    }
                    else {
                        // Server to Client: decrypt with serverToClientCipher
                        serverToClientCipher.decrypt(dataToProcess);
                        // ... packet processing logic if needed ...
                        serverToClientCipher.reset();
                        serverToClientCipher.encrypt(dataToProcess);
                    }
                }
            }
            catch (error) {
                console.error('Error processing game packet:', error);
            }
        }
    }
}
// Create and start the proxy
const proxy = new RotmgHttpTunnelProxy();
proxy.start();
console.log('ROTMG HTTP Tunnel Proxy started');
console.log('Using RC4 keys from Python implementation:');
console.log(`Client Send Key: ${custom_rc4_1.CLIENT_SEND_KEY}`);
console.log(`Client Receive Key: ${custom_rc4_1.CLIENT_RECEIVE_KEY}`);
console.log(`Server Send Key: ${custom_rc4_1.SERVER_SEND_KEY}`);
console.log(`Server Receive Key: ${custom_rc4_1.SERVER_RECEIVE_KEY}`);
