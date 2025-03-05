"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONFIG = void 0;
/**
 * Application configuration
 *
 * Copy this file to config.ts and add your account credentials
 */
exports.CONFIG = {
    // The port to run the proxy on
    port: 2050,
    // ROTMG account credentials (required for server list fetching)
    credentials: {
        email: "julian77codespoti@gmail.com",
        password: "Abc1230404!!"
    },
    // Logging settings
    logging: {
        enabled: true,
        directory: "packet_logs"
    },
    // Server preferences (optional)
    server: {
        // Preferred server name (e.g., "USEast", "EUWest", etc.)
        // If not specified or unavailable, the server with lowest usage will be selected
        preferred: "Australia"
    }
};
exports.default = exports.CONFIG;
