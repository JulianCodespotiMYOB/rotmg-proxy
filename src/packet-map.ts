// packet-map.ts

/**
 * This file defines the packet map used by realmlib’s PacketIO.
 * It maps packet names (e.g., "FAILURE") to their numeric IDs and vice versa.
 * Adjust and extend this map with all packet types you need.
 */

import { PacketType } from "realmlib/build"; // Adjust the import if needed

export const PACKET_MAP = {
  // Forward mapping: packet name to id.
  FAILURE: 0,
  HELLO: 1,
  // Add more packet types as necessary, e.g.:
  // MAPINFO: 2,
  // PLAYER_STATUS: 3,
  // ... etc.

  // Reverse mapping: id to packet type (using the PacketType enum).
  0: PacketType.FAILURE,
  1: PacketType.HELLO,
  // Similarly add reverse mappings for all packet types you include above.
};
