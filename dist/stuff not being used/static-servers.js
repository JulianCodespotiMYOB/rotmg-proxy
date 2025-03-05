"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KNOWN_SERVERS = void 0;
exports.getStaticServer = getStaticServer;
exports.KNOWN_SERVERS = [
    { name: "USEast", host: "54.86.47.176", port: 2050 },
    { name: "USWest", host: "54.176.148.149", port: 2050 },
    { name: "EUWest", host: "54.195.33.57", port: 2050 },
    { name: "Australia", host: "52.63.175.117", port: 2050 },
    { name: "Asia", host: "13.229.118.195", port: 2050 }
    // Add more servers as needed
];
function getStaticServer(preferredName) {
    if (preferredName) {
        const preferred = exports.KNOWN_SERVERS.find(s => s.name.toLowerCase() === preferredName.toLowerCase());
        if (preferred) {
            return { host: preferred.host, port: preferred.port };
        }
    }
    // Default to USEast if no preference or not found
    return { host: "54.86.47.176", port: 2050 };
}
