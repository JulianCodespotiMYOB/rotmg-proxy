import { Vector2 } from '../utils/vector';

export interface Entity {
  objectId: number;
  objectType: number;
  pos: Vector2;
  hp?: number;
  maxHp?: number;
  def?: number;
  name?: string;
  lastUpdated: number;
  isEnemy: boolean;
}

export class EntityTracker {
  private entities: Map<number, Entity> = new Map();
  private playerObjectId: number | null = null;
  private playerPos: Vector2 = new Vector2(0, 0);

  constructor() {}

  // Called when packets are received
  processPacket(packetId: number, packetData: Buffer, isFromServer: boolean): void {
    // These are simplified implementations - real ones would need to parse actual game packets

    // Process NewTick packet (ID 10) to update entity positions
    if (isFromServer && packetId === 10) {
      this.processNewTickPacket(packetData);
    }

    // Process Update packet (ID 42) to track new entities
    if (isFromServer && packetId === 42) {
      this.processUpdatePacket(packetData);
    }

    // Process Create Success packet (ID 101) to identify our player
    if (isFromServer && packetId === 101) {
      this.processCreateSuccessPacket(packetData);
    }
  }

  // Parse NewTick packet to update entity positions
  private processNewTickPacket(data: Buffer): void {
    // In a real implementation, you would:
    // 1. Decrypt the packet data if needed
    // 2. Extract the list of object status data
    // 3. Update the positions of known entities

    // This is an example placeholder based on the packet format
    try {
      // Skip the header (5 bytes)
      let index = 5;

      // Skip tickId and serverTime
      index += 8;

      // Read the status count (would need proper parsing in real implementation)
      const statusCount = data.readInt16BE(index);
      index += 2;

      // Process each status update
      for (let i = 0; i < statusCount; i++) {
        // This is simplified - you'd need to implement the actual parsing logic
        const objectId = this.parseObjectId(data, index);
        index += 4; // Skip past objectId

        // Parse position
        const x = data.readFloatBE(index);
        index += 4;
        const y = data.readFloatBE(index);
        index += 4;

        // Update the entity if we know about it
        const entity = this.entities.get(objectId);
        if (entity) {
          entity.pos = new Vector2(x, y);
          entity.lastUpdated = Date.now();
        }

        // Skip other stats we don't care about for now
        // In a real implementation, you'd parse HP, etc.
      }
    } catch (err) {
      console.error("Error processing NewTick packet:", err);
    }
  }

  // Parse Update packet to track new entities
  private processUpdatePacket(data: Buffer): void {
    // Similar to NewTick but would add new entities to our tracker
    // In real implementation, you'd extract entity types and determine if they're enemies
  }

  // Parse CreateSuccess to identify our player
  private processCreateSuccessPacket(data: Buffer): void {
    try {
      // Skip the header (5 bytes)
      const objectId = data.readInt32BE(5);
      this.playerObjectId = objectId;
      console.log(`Identified player object ID: ${objectId}`);
    } catch (err) {
      console.error("Error processing CreateSuccess packet:", err);
    }
  }

  // Helper to parse object IDs (simplified)
  private parseObjectId(data: Buffer, index: number): number {
    return data.readInt32BE(index);
  }

  // Get player position
  getPlayerPosition(): Vector2 {
    return this.playerPos;
  }

  // Get all enemies within range
  getEnemiesInRange(range: number): Entity[] {
    if (!this.playerObjectId) return [];

    const results: Entity[] = [];
    const playerPos = this.playerPos;

    for (const entity of this.entities.values()) {
      if (entity.isEnemy && Vector2.distance(playerPos, entity.pos) <= range) {
        results.push(entity);
      }
    }

    return results;
  }

  // Get player entity
  getPlayer(): Entity | null {
    if (!this.playerObjectId) return null;
    return this.entities.get(this.playerObjectId) || null;
  }

  // Clear all entities (e.g., when changing maps)
  clearEntities(): void {
    this.entities.clear();
  }
}