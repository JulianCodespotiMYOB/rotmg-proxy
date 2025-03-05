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
exports.RotmgPassthroughProxy = void 0;
const net = __importStar(require("net"));
const autoaim_1 = require("./modules/autoaim");
const entity_tracker_1 = require("./modules/entity-tracker");
const packet_modifier_1 = require("./modules/packet-modifier");
const logger_1 = require("./utils/logger");
class RotmgPassthroughProxy {
    constructor(port = 2050, autoAimConfig) {
        this.packetSequence = [];
        this.serverSocket = null;
        this.packetStats = new Map();
        this.port = port;
        this.server = net.createServer(this.handleConnection.bind(this));
        // Initialize modules
        this.entityTracker = new entity_tracker_1.EntityTracker();
        this.autoAim = new autoaim_1.AutoAim(this.entityTracker, autoAimConfig);
        this.packetModifier = new packet_modifier_1.PacketModifier(this.autoAim);
    }
    start() {
        this.server.listen(this.port, () => {
            console.log(`ROTMG Passthrough Proxy listening on port ${this.port}`);
        });
        this.server.on('error', (err) => {
            console.error('Proxy server error:', err);
        });
    }
    close() {
        if (this.server) {
            this.server.close(() => {
                console.log('Proxy server closed');
            });
        }
    }
    // Show packet statistics
    printStats() {
        console.log("\n--- Packet Statistics ---");
        // Sort by frequency
        const sortedStats = [...this.packetStats.entries()]
            .sort((a, b) => b[1] - a[1]);
        for (const [type, count] of sortedStats) {
            console.log(`${type}: ${count}`);
        }
        console.log("------------------------\n");
    }
    handleConnection(clientSocket) {
        const clientId = `${clientSocket.remoteAddress}:${clientSocket.remotePort}`.split(':').pop();
        console.log(`Client connected: ${clientId}`);
        // Reset state for new connection
        this.packetSequence = [];
        this.packetStats.clear();
        // Wait for initial data
        clientSocket.once('data', (data) => {
            const header = data.toString('utf8', 0, Math.min(data.length, 200));
            // Check if it's an HTTP CONNECT request
            if (header.startsWith('CONNECT')) {
                this.handleHttpConnect(clientSocket, data);
            }
            else {
                this.handleDirectConnection(clientSocket, data);
            }
        });
        clientSocket.on('error', (err) => {
            console.error(`Client socket error (${clientId}):`, err);
        });
        clientSocket.on('close', () => {
            console.log(`Client socket closed for ${clientId}`);
            this.printStats(); // Print stats on disconnect
            this.cleanup();
        });
    }
    handleHttpConnect(clientSocket, initialData) {
        const header = initialData.toString('utf8', 0, Math.min(initialData.length, 200));
        const match = header.match(/CONNECT\s+([^:]+):(\d+)/);
        if (!match) {
            console.error('Invalid CONNECT request format');
            clientSocket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
            return;
        }
        const targetHost = match[1];
        const targetPort = parseInt(match[2], 10);
        console.log(`Client wants to connect to ${targetHost}:${targetPort}`);
        // Connect to the target server
        const serverSocket = net.connect(targetPort, targetHost, () => {
            console.log(`Connected to game server at ${targetHost}:${targetPort}`);
            // Send success response to client
            clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
            // Setup direct proxy without any packet processing
            this.setupDirectProxy(clientSocket, serverSocket);
        });
        serverSocket.on('error', (err) => {
            console.error('Server socket error:', err);
            if (!clientSocket.destroyed) {
                clientSocket.end();
            }
        });
        serverSocket.on('close', () => {
            console.log('Server socket closed');
            this.cleanup();
            if (!clientSocket.destroyed) {
                clientSocket.end();
            }
        });
    }
    handleDirectConnection(clientSocket, initialData) {
        // For direct connections, connect to a known game server
        const targetHost = '54.79.72.84'; // Default to a known server IP
        const targetPort = 2050;
        console.log(`Direct connection detected, connecting to ${targetHost}:${targetPort}`);
        const serverSocket = net.connect(targetPort, targetHost, () => {
            console.log(`Connected to game server at ${targetHost}:${targetPort}`);
            // If we have initial data, send it to the server
            if (initialData.length > 0) {
                serverSocket.write(initialData);
                (0, logger_1.logPacket)(initialData, true, this.packetStats, this.packetSequence);
            }
            // Setup direct proxy without any packet processing
            this.setupDirectProxy(clientSocket, serverSocket);
        });
        serverSocket.on('error', (err) => {
            console.error('Server socket error:', err);
            if (!clientSocket.destroyed) {
                clientSocket.end();
            }
        });
        serverSocket.on('close', () => {
            console.log('Server socket closed');
            this.cleanup();
            if (!clientSocket.destroyed) {
                clientSocket.end();
            }
        });
    }
    setupDirectProxy(clientSocket, serverSocket) {
        // Store server socket for potential auto-responses
        this.serverSocket = serverSocket;
        // Handle client to server data - process and potentially modify
        clientSocket.on('data', (data) => {
            try {
                // Extract packet info
                const packetId = data.length >= 5 ? data[4] : -1;
                // Log the original packet
                (0, logger_1.logPacket)(data, true, this.packetStats, this.packetSequence);
                // Pass to entity tracker for processing
                this.entityTracker.processPacket(packetId, data, false);
                // Apply autoaim if it's a PLAYERSHOOT packet (ID 30)
                let processedData = data;
                if (packetId === 30) { // PLAYERSHOOT
                    processedData = this.packetModifier.modifyPlayerShootPacket(data);
                }
                // Forward the possibly modified data
                if (serverSocket.writable) {
                    serverSocket.write(processedData);
                }
            }
            catch (error) {
                console.error('Error processing client data:', error);
                // Forward the original unmodified data as fallback
                if (serverSocket.writable) {
                    serverSocket.write(data);
                }
            }
        });
        // Handle server to client data - process for entity tracking
        serverSocket.on('data', (data) => {
            try {
                // Extract packet info for logging
                const packetId = data.length >= 5 ? data[4] : -1;
                // Log the packet
                (0, logger_1.logPacket)(data, false, this.packetStats, this.packetSequence);
                // Pass to entity tracker for processing
                this.entityTracker.processPacket(packetId, data, true);
                // Forward unchanged
                if (clientSocket.writable) {
                    clientSocket.write(data);
                }
            }
            catch (error) {
                console.error('Error processing server data:', error);
                // Forward the original data as fallback
                if (clientSocket.writable) {
                    clientSocket.write(data);
                }
            }
        });
        // Handle socket closures
        clientSocket.on('close', () => {
            console.log('Client socket closed');
            this.cleanup();
            if (!serverSocket.destroyed) {
                serverSocket.end();
            }
        });
        serverSocket.on('close', () => {
            console.log('Server socket closed');
            this.cleanup();
            if (!clientSocket.destroyed) {
                clientSocket.end();
            }
        });
    }
    cleanup() {
        // Keep the packet sequence and stats for debugging
    }
    // Update autoaim configuration
    updateAutoAimConfig(config) {
        this.autoAim.updateConfig(config);
    }
    // Enable/disable autoaim
    setAutoAimEnabled(enabled) {
        this.autoAim.updateConfig({ enabled });
    }
    // Change targeting strategy
    setTargetingStrategy(strategy) {
        this.autoAim.updateConfig({ targetingStrategy: strategy });
    }
}
exports.RotmgPassthroughProxy = RotmgPassthroughProxy;
