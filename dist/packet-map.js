"use strict";
// packet-map.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.PACKET_MAP = void 0;
/**
 * This file defines the packet map used by realmlib’s PacketIO.
 * It maps packet names (e.g., "FAILURE") to their numeric IDs and vice versa.
 * Adjust and extend this map with all packet types you need.
 */
const build_1 = require("realmlib/build"); // Adjust the import if needed
exports.PACKET_MAP = {
    // Forward mapping: packet name to id.
    FAILURE: 0,
    HELLO: 1,
    // Add more packet types as necessary, e.g.:
    // MAPINFO: 2,
    // PLAYER_STATUS: 3,
    // ... etc.
    // Reverse mapping: id to packet type (using the PacketType enum).
    0: build_1.PacketType.FAILURE,
    1: build_1.PacketType.HELLO,
    // Similarly add reverse mappings for all packet types you include above.
};
