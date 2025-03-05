import { PACKET_MAP } from "../stuff not being used/packet-map";

const IMPORTANT_PACKET_IDS = new Set([30]);

export function logPacket(data: Buffer, isClientToServer: boolean, packetStats: Map<string, number>, packetSequence: any[]) {
  try {
    // Only log properly formatted packets
    if (data.length >= 5) {
      const packetSize = data.readInt32BE(0);
      const packetId = data[4];
      const packetType = PACKET_MAP[packetId] || 'Unknown';

      // Update packet statistics
      const key = `${packetType}(${packetId})`;
      packetStats.set(key, (packetStats.get(key) || 0) + 1);

      // Log packet info only if it's an important packet
      if (IMPORTANT_PACKET_IDS.has(packetId)) {
        const direction = isClientToServer ? 'Client → Server' : 'Server → Client';
        const dataHex = data.toString('hex', 0, Math.min(data.length, 200));

        // Add timestamp
        const timestamp = new Date().toISOString();

        console.log(`
          [${timestamp}]
          Direction: ${direction}
          Packet ID: ${packetId}
          Packet Type: ${packetType}
          Packet Size: ${packetSize}
          Data Size: ${data.length}
          Header Size: ${packetSize}
          Data (hex): ${dataHex}
        `);

        // Track packet sequence for debugging
        packetSequence.push({
          time: timestamp,
          direction: isClientToServer ? 'C->S' : 'S->C',
          id: packetId,
          type: packetType,
          size: data.length
        });

        // Special handling for important packets
        if (packetId === 0) { // FAILURE
          console.log("⚠️ FAILURE packet detected!");
          console.log("Packet sequence leading to failure:",
            JSON.stringify(packetSequence.slice(-20), null, 2)); // Show last 20 packets
        }

        if (packetId === 74) { // RECONNECT
          console.log("🔄 RECONNECT packet detected");
        }

        if (packetId === 101) { // CREATE_SUCCESS
          console.log("✅ CREATE_SUCCESS: Character successfully loaded");
        }
      }
    }
  } catch (error) {
    console.error('Error logging packet:', error);
  }
}