"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoAim = void 0;
const target_selectoin_1 = require("./target-selectoin");
const vector_1 = require("../utils/vector");
class AutoAim {
    constructor(entityTracker, config) {
        this.currentTarget = null;
        this.entityTracker = entityTracker;
        this.config = config;
        this.targetingStrategy = (0, target_selectoin_1.createTargetingStrategy)(config.targetingStrategy);
    }
    // Update configuration
    updateConfig(config) {
        this.config = { ...this.config, ...config };
        if (config.targetingStrategy) {
            this.targetingStrategy = (0, target_selectoin_1.createTargetingStrategy)(config.targetingStrategy);
        }
    }
    // Calculate aim angle for player shoot packet
    calculateAimAngle() {
        if (!this.config.enabled)
            return null;
        const playerPos = this.entityTracker.getPlayerPosition();
        const enemies = this.entityTracker.getEnemiesInRange(this.config.maxRange);
        if (enemies.length === 0)
            return null;
        this.currentTarget = this.targetingStrategy.selectTarget(enemies, playerPos);
        if (!this.currentTarget)
            return null;
        // Calculate the angle to the target
        let targetPos = this.currentTarget.pos;
        // Apply shot leading if enabled
        if (this.config.leadShots && this.currentTarget.lastUpdated) {
            // This is a very simple prediction - a real implementation would track velocity over time
            // For now, we just assume the entity keeps moving in the same direction
            const now = Date.now();
            const timeDelta = now - this.currentTarget.lastUpdated;
            // We'd need to track previous positions to calculate this properly
        }
        return vector_1.Vector2.angleTo(playerPos, targetPos);
    }
    // Get current target (for debugging)
    getCurrentTarget() {
        return this.currentTarget;
    }
}
exports.AutoAim = AutoAim;
