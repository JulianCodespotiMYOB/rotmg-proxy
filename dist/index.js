"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// index.ts - Main entry point
const mitm_proxy_1 = require("./mitm-proxy");
const cli_1 = require("./cli");
const config_1 = __importDefault(require("./config"));
console.log(`
==========================================================
                ROTMG Proxy (TypeScript)
==========================================================
`);
try {
    const proxy = new mitm_proxy_1.RotmgMitmProxy({
        enableLogging: config_1.default.logging.enabled,
        preferredServer: config_1.default.server?.preferred,
        credentials: config_1.default.credentials
    });
    const cli = new cli_1.ProxyCliInterface();
    proxy.start(config_1.default.port);
    process.on('SIGINT', () => {
        console.log('\nShutting down proxy...');
        proxy.close();
        process.exit(0);
    });
    console.log(`
Proxy successfully started!
Listening on: localhost:${config_1.default.port}

To use this proxy:
1. Configure your client to use localhost:${config_1.default.port} as an HTTP proxy.
2. Launch your ROTMG client.
3. All traffic will be intercepted and logged.

Type 'help' for available commands.
==========================================================
`);
}
catch (error) {
    console.error('Failed to start proxy:', error);
    process.exit(1);
}
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
