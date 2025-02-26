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
exports.PacketLogger = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * A utility class for logging packets to files for analysis
 */
class PacketLogger {
    constructor(logDirName = 'packet_logs') {
        // Create the logging directory
        this.logDir = path.join(process.cwd(), logDirName);
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
        // Create log timestamp
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        // Create the log files
        this.clientToServerLog = fs.createWriteStream(path.join(this.logDir, `client_to_server_${timestamp}.log`), { flags: 'a' });
        this.serverToClientLog = fs.createWriteStream(path.join(this.logDir, `server_to_client_${timestamp}.log`), { flags: 'a' });
        console.log(`Packet logging enabled. Logs will be saved to: ${this.logDir}`);
    }
    /**
     * Log a packet from client to server
     */
    logClientToServer(packet, rawData) {
        try {
            const timestamp = new Date().toISOString();
            const packetInfo = this.formatPacketInfo(packet, rawData);
            this.clientToServerLog.write(`[${timestamp}] CLIENT -> SERVER | ${packetInfo}\n`);
        }
        catch (error) {
            console.error('Error logging client packet:', error);
        }
    }
    /**
     * Log a packet from server to client
     */
    logServerToClient(packet, rawData) {
        try {
            const timestamp = new Date().toISOString();
            const packetInfo = this.formatPacketInfo(packet, rawData);
            this.serverToClientLog.write(`[${timestamp}] SERVER -> CLIENT | ${packetInfo}\n`);
        }
        catch (error) {
            console.error('Error logging server packet:', error);
        }
    }
    /**
     * Format packet information for logging
     */
    formatPacketInfo(packet, rawData) {
        let packetStr = `Type: ${packet.type}`;
        // Add packet properties
        const packetObj = packet;
        const properties = Object.keys(packetObj)
            .filter(key => key !== 'type' && key !== 'propagate')
            .map(key => {
            let value = packetObj[key];
            // Handle special cases
            if (Buffer.isBuffer(value)) {
                value = `<Buffer: ${value.length} bytes>`;
            }
            else if (Array.isArray(value)) {
                value = `<Array: ${value.length} items>`;
            }
            else if (typeof value === 'object' && value !== null) {
                try {
                    value = JSON.stringify(value);
                }
                catch (e) {
                    value = `<Object>`;
                }
            }
            return `${key}: ${value}`;
        })
            .join(', ');
        if (properties) {
            packetStr += ` | ${properties}`;
        }
        // Add raw data if available
        if (rawData) {
            const hexData = rawData.toString('hex');
            packetStr += ` | Raw: ${hexData}`;
        }
        return packetStr;
    }
    /**
     * Close the log files
     */
    close() {
        this.clientToServerLog.end();
        this.serverToClientLog.end();
        console.log('Packet logs closed.');
    }
}
exports.PacketLogger = PacketLogger;
exports.default = PacketLogger;
