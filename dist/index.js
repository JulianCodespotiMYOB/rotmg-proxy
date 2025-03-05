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
const passthrough_proxy_1 = require("./passthrough-proxy");
// Default configuration
const autoAimConfig = {
    enabled: false, // Disabled by default for safety
    targetingStrategy: 'closest',
    maxRange: 15,
    leadShots: true,
    leadFactor: 0.5
};
// Create and configure the proxy
const proxy = new passthrough_proxy_1.RotmgPassthroughProxy(2050, autoAimConfig);
// Start the proxy
proxy.start();
// Handle command-line input for runtime control
const readline = __importStar(require("readline"));
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'rotmg-proxy> '
});
rl.prompt();
rl.on('line', (line) => {
    const args = line.trim().split(' ');
    const command = args[0].toLowerCase();
    switch (command) {
        case 'help':
            console.log('\nCommands:');
            console.log('  autoaim on/off    - Enable/disable autoaim');
            console.log('  target closest    - Target closest enemy');
            console.log('  target lowest     - Target lowest HP enemy');
            console.log('  target highest    - Target highest HP enemy');
            console.log('  range <number>    - Set autoaim range (tiles)');
            console.log('  lead on/off       - Enable/disable shot leading');
            console.log('  stats             - Show packet statistics');
            console.log('  exit/quit         - Exit the proxy');
            console.log('');
            break;
        case 'autoaim':
            if (args[1] === 'on') {
                proxy.setAutoAimEnabled(true);
                console.log('AutoAim enabled');
            }
            else if (args[1] === 'off') {
                proxy.setAutoAimEnabled(false);
                console.log('AutoAim disabled');
            }
            else {
                console.log('Usage: autoaim on/off');
            }
            break;
        case 'target':
            if (['closest', 'lowest', 'highest'].includes(args[1])) {
                proxy.setTargetingStrategy(args[1]);
                console.log(`Targeting strategy set to: ${args[1]}`);
            }
            else {
                console.log('Usage: target closest|lowest|highest');
            }
            break;
        case 'range':
            const range = parseInt(args[1]);
            if (!isNaN(range) && range > 0) {
                proxy.updateAutoAimConfig({ maxRange: range });
                console.log(`AutoAim range set to: ${range}`);
            }
            else {
                console.log('Usage: range <number>');
            }
            break;
        case 'stats':
            proxy.printStats();
            break;
        case 'exit':
        case 'quit':
            console.log('Exiting proxy...');
            proxy.close();
            rl.close();
            process.exit(0);
            break;
        default:
            if (line.trim()) {
                console.log(`Unknown command: ${command}. Type 'help' for commands.`);
            }
            break;
    }
    rl.prompt();
});
// Handle process exit
process.on('SIGINT', () => {
    console.log('\nShutting down proxy...');
    proxy.close();
    process.exit(0);
});
console.log(`
==========================================================
                ROTMG Proxy with AutoAim
==========================================================
Proxy running on port 2050.
Type 'help' for available commands.
AutoAim is disabled by default. Type 'autoaim on' to enable.
==========================================================
`);
