// packet-map.ts
import { PacketMap } from "realmlib/build/packet-map";
import packetsJson from "realmlib/build/packets.json";

/**
 * This file creates a packet map using the existing realmlib packets.json data.
 * It maps packet names (e.g., "FAILURE") to their numeric IDs and vice versa.
 */

export const PACKET_MAP: PacketMap = {
  ...packetsJson
};