"use strict";
// passthrough-proxy.ts - Simple Passthrough Proxy for ROTMG
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
const custom_rc4_1 = require("./custom-rc4");
const PROXY_PORT = 2050;
const GAME_SERVER_HOST = '51.222.11.213'; // From the Python code
const GAME_SERVER_PORT = 2050;
/**
 * A simplified passthrough proxy for ROTMG
 */
class RotmgPassthroughProxy {
    constructor() {
        this.server = net.createServer(this.handleConnection.bind(this));
    }
    /**
     * Start the proxy server
     */
    start() {
        this.server.listen(PROXY_PORT, () => {
            console.log(`ROTMG Passthrough Proxy listening on port ${PROXY_PORT}`);
            console.log(`Connect your client to localhost:${PROXY_PORT}`);
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
        // Initial state
        let isHttpConnect = false;
        let connectHandled = false;
        let buffer = Buffer.alloc(0);
        // Create RC4 ciphers for later use if needed
        const clientToServerCipher = new custom_rc4_1.CustomRC4(custom_rc4_1.CLIENT_SEND_KEY);
        const serverToClientCipher = new custom_rc4_1.CustomRC4(custom_rc4_1.SERVER_SEND_KEY);
        // Connect to the ROTMG game server directly
        const serverSocket = net.connect({
            host: GAME_SERVER_HOST,
            port: GAME_SERVER_PORT
        }, () => {
            console.log(`Connected to game server at ${GAME_SERVER_HOST}:${GAME_SERVER_PORT}`);
        });
        // Handle client data
        clientSocket.on('data', (data) => {
            try {
                // If we haven't processed a potential HTTP CONNECT yet, check for it
                if (!connectHandled) {
                    // Append to our buffer
                    buffer = Buffer.concat([buffer, data]);
                    // Check if this looks like an HTTP CONNECT
                    const bufferStr = buffer.toString('utf8', 0, Math.min(buffer.length, 100));
                    if (bufferStr.startsWith('CONNECT')) {
                        console.log('HTTP CONNECT request detected:', bufferStr);
                        isHttpConnect = true;
                        connectHandled = true;
                        // Respond with 200 Connection Established
                        clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
                        // Don't forward the CONNECT request to the game server
                        return;
                    }
                    else if (buffer.length >= 5) {
                        // This doesn't look like an HTTP CONNECT, treat as game traffic
                        console.log('Direct game connection detected');
                        connectHandled = true;
                        // Process the buffered data as game data
                        processAndForwardGameData(buffer, true);
                        buffer = Buffer.alloc(0);
                        return;
                    }
                }
                else if (isHttpConnect) {
                    // This is data after the HTTP CONNECT was established
                    processAndForwardGameData(data, true);
                }
                else {
                    // Direct game connection
                    processAndForwardGameData(data, true);
                }
            }
            catch (error) {
                console.error('Error handling client data:', error);
            }
        });
        // Handle server data
        serverSocket.on('data', (data) => {
            try {
                // Always process and forward game data from server to client
                processAndForwardGameData(data, false);
            }
            catch (error) {
                console.error('Error handling server data:', error);
            }
        });
        // Process and forward game data with proper RC4 handling
        function processAndForwardGameData(data, isClientToServer) {
            try {
                // Clone the data so we can modify it
                const processedData = Buffer.from(data);
                // Check if this looks like a game packet (has at least a header)
                if (processedData.length >= 5) {
                    // Log packet info
                    const packetId = processedData[4];
                    console.log(`${isClientToServer ? 'Client → Server' : 'Server → Client'} Packet ID: ${packetId}, Size: ${processedData.length}`);
                    // Process data part (after 5-byte header)
                    if (processedData.length > 5) {
                        const dataToProcess = processedData.subarray(5);
                        // Apply appropriate RC4 encryption/decryption
                        if (isClientToServer) {
                            // Client → Server: decrypt, then re-encrypt
                            clientToServerCipher.decrypt(dataToProcess);
                            // Here you could inspect or modify the packet
                            // Reset cipher state and re-encrypt
                            clientToServerCipher.reset();
                            clientToServerCipher.encrypt(dataToProcess);
                        }
                        else {
                            // Server → Client: decrypt, then re-encrypt
                            serverToClientCipher.decrypt(dataToProcess);
                            // Here you could inspect or modify the packet
                            // Reset cipher state and re-encrypt
                            serverToClientCipher.reset();
                            serverToClientCipher.encrypt(dataToProcess);
                        }
                    }
                }
                else {
                    console.log(`${isClientToServer ? 'Client → Server' : 'Server → Client'} Non-packet data, size: ${processedData.length}`);
                }
                // Forward the processed data
                if (isClientToServer) {
                    serverSocket.write(processedData);
                }
                else {
                    clientSocket.write(processedData);
                }
            }
            catch (error) {
                console.error('Error processing game data:', error);
            }
        }
        // Handle socket errors and closures
        clientSocket.on('error', (err) => {
            console.error('Client socket error:', err);
            if (!serverSocket.destroyed) {
                serverSocket.end();
            }
        });
        serverSocket.on('error', (err) => {
            console.error('Server socket error:', err);
            if (!clientSocket.destroyed) {
                clientSocket.end();
            }
        });
        clientSocket.on('close', () => {
            console.log('Client socket closed');
            if (!serverSocket.destroyed) {
                serverSocket.end();
            }
        });
        serverSocket.on('close', () => {
            console.log('Server socket closed');
            if (!clientSocket.destroyed) {
                clientSocket.end();
            }
        });
    }
}
// Create and start the proxy
const proxy = new RotmgPassthroughProxy();
proxy.start();
console.log('ROTMG Passthrough Proxy started');
console.log('Using RC4 keys from Python implementation:');
console.log(`Client Send Key: ${custom_rc4_1.CLIENT_SEND_KEY}`);
console.log(`Client Receive Key: ${custom_rc4_1.CLIENT_RECEIVE_KEY}`);
console.log(`Server Send Key: ${custom_rc4_1.SERVER_SEND_KEY}`);
console.log(`Server Receive Key: ${custom_rc4_1.SERVER_RECEIVE_KEY}`);
