"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HighestHPTargetStrategy = exports.LowestHPTargetStrategy = exports.ClosestTargetStrategy = void 0;
exports.createTargetingStrategy = createTargetingStrategy;
const vector_1 = require("../utils/vector");
// Select the closest entity
class ClosestTargetStrategy {
    selectTarget(entities, playerPos) {
        if (entities.length === 0)
            return null;
        let closestEntity = null;
        let closestDistance = Number.MAX_VALUE;
        for (const entity of entities) {
            const distance = vector_1.Vector2.distance(playerPos, entity.pos);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestEntity = entity;
            }
        }
        return closestEntity;
    }
}
exports.ClosestTargetStrategy = ClosestTargetStrategy;
// Select the entity with the lowest HP
class LowestHPTargetStrategy {
    selectTarget(entities, playerPos) {
        if (entities.length === 0)
            return null;
        let lowestHPEntity = null;
        let lowestHP = Number.MAX_VALUE;
        for (const entity of entities) {
            if (entity.hp !== undefined && entity.hp < lowestHP) {
                lowestHP = entity.hp;
                lowestHPEntity = entity;
            }
        }
        return lowestHPEntity || new ClosestTargetStrategy().selectTarget(entities, playerPos);
    }
}
exports.LowestHPTargetStrategy = LowestHPTargetStrategy;
// Select the entity with the highest HP
class HighestHPTargetStrategy {
    selectTarget(entities, playerPos) {
        if (entities.length === 0)
            return null;
        let highestHPEntity = null;
        let highestHP = -1;
        for (const entity of entities) {
            if (entity.hp !== undefined && entity.hp > highestHP) {
                highestHP = entity.hp;
                highestHPEntity = entity;
            }
        }
        return highestHPEntity || new ClosestTargetStrategy().selectTarget(entities, playerPos);
    }
}
exports.HighestHPTargetStrategy = HighestHPTargetStrategy;
// Factory to create the right strategy
function createTargetingStrategy(type) {
    switch (type.toLowerCase()) {
        case 'lowest':
            return new LowestHPTargetStrategy();
        case 'highest':
            return new HighestHPTargetStrategy();
        case 'closest':
        default:
            return new ClosestTargetStrategy();
    }
}
