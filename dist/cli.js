"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProxyCliInterface = void 0;
// cli.ts
const readline_1 = __importDefault(require("readline"));
const build_1 = require("realmlib/build");
/**
 * This class provides a simple command-line interface for interacting with
 * the proxy while it's running.
 */
class ProxyCliInterface {
    constructor() {
        this.clientIOs = new Map(); // Store active client connections
        this.rl = readline_1.default.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: 'rotmg-proxy> '
        });
        this.setupCommandHandlers();
    }
    registerClient(clientId, clientIO) {
        this.clientIOs.set(clientId, clientIO);
        console.log(`Client ${clientId} registered with CLI`);
    }
    unregisterClient(clientId) {
        this.clientIOs.delete(clientId);
        console.log(`Client ${clientId} unregistered from CLI`);
    }
    setupCommandHandlers() {
        this.rl.prompt();
        this.rl.on('line', (line) => {
            const trimmedLine = line.trim();
            const [command, ...args] = trimmedLine.split(' ');
            switch (command.toLowerCase()) {
                case 'help':
                    this.showHelp();
                    break;
                case 'clients':
                    this.listClients();
                    break;
                case 'inject':
                    this.injectPacket(args);
                    break;
                case 'disconnect':
                    this.disconnectClient(args[0]);
                    break;
                case 'exit':
                case 'quit':
                    console.log('Exiting proxy...');
                    process.exit(0);
                    break;
                default:
                    if (trimmedLine) {
                        console.log(`Unknown command: ${command}. Type 'help' for available commands.`);
                    }
            }
            this.rl.prompt();
        });
        this.rl.on('close', () => {
            console.log('Exiting proxy...');
            process.exit(0);
        });
    }
    showHelp() {
        console.log('\nAvailable commands:');
        console.log('  help                  - Show this help');
        console.log('  clients               - List connected clients');
        console.log('  inject <client> <type> - Inject a packet to a client');
        console.log('  disconnect <client>   - Disconnect a client');
        console.log('  exit, quit            - Exit the proxy\n');
    }
    listClients() {
        if (this.clientIOs.size === 0) {
            console.log('No clients connected.');
            return;
        }
        console.log('\nConnected clients:');
        for (const clientId of this.clientIOs.keys()) {
            console.log(`  ${clientId}`);
        }
        console.log('');
    }
    injectPacket(args) {
        if (args.length < 2) {
            console.log('Usage: inject <client> <packet-type>');
            return;
        }
        const clientId = args[0];
        const packetType = args[1].toUpperCase();
        const clientIO = this.clientIOs.get(clientId);
        if (!clientIO) {
            console.log(`No client found with ID: ${clientId}`);
            return;
        }
        if (!build_1.PacketType[packetType]) {
            console.log(`Unknown packet type: ${packetType}`);
            return;
        }
        try {
            // Create and send the packet
            const packet = (0, build_1.createPacket)(build_1.PacketType[packetType]);
            // You might want to set some properties on the packet here
            // For example: packet.someProperty = someValue;
            clientIO.send(packet);
            console.log(`Injected ${packetType} packet to client ${clientId}`);
        }
        catch (error) {
            console.error(`Error injecting packet:`, error);
        }
    }
    disconnectClient(clientId) {
        if (!clientId) {
            console.log('Usage: disconnect <client>');
            return;
        }
        const clientIO = this.clientIOs.get(clientId);
        if (!clientIO) {
            console.log(`No client found with ID: ${clientId}`);
            return;
        }
        try {
            // Assuming clientIO has a socket property
            if (clientIO.socket) {
                clientIO.socket.end();
                console.log(`Disconnected client ${clientId}`);
            }
        }
        catch (error) {
            console.error(`Error disconnecting client:`, error);
        }
    }
}
exports.ProxyCliInterface = ProxyCliInterface;
