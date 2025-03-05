"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PacketModifier = void 0;
class PacketModifier {
    constructor(autoAim) {
        this.autoAim = autoAim;
    }
    // Modify outgoing player shoot packet
    modifyPlayerShootPacket(data) {
        // Only modify if autoaim is enabled and we have a target
        const aimAngle = this.autoAim.calculateAimAngle();
        if (aimAngle === null)
            return data;
        // Clone the buffer - don't modify the original
        const modifiedData = Buffer.from(data);
        try {
            // In a real PlayerShoot packet:
            // - Header is 5 bytes
            // - Time is next 4 bytes
            // - BulletId is next 1 byte
            // - Item type is next X bytes (depends on protocol)
            // - Angle is a float (4 bytes)
            // This is an example - you'd need to determine the exact packet format
            const angleOffset = 14; // This would be the position where the angle is stored
            // Write the new angle to the packet
            modifiedData.writeFloatBE(aimAngle, angleOffset);
            return modifiedData;
        }
        catch (err) {
            console.error("Error modifying PlayerShoot packet:", err);
            return data; // Return original data on error
        }
    }
}
exports.PacketModifier = PacketModifier;
