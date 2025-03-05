import { Entity } from './entity-tracker';
import { Vector2 } from '../utils/vector';

// Interface for target selection strategies
export interface TargetSelectionStrategy {
  selectTarget(entities: Entity[], playerPos: Vector2): Entity | null;
}

// Select the closest entity
export class ClosestTargetStrategy implements TargetSelectionStrategy {
  selectTarget(entities: Entity[], playerPos: Vector2): Entity | null {
    if (entities.length === 0) return null;

    let closestEntity: Entity | null = null;
    let closestDistance = Number.MAX_VALUE;

    for (const entity of entities) {
      const distance = Vector2.distance(playerPos, entity.pos);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestEntity = entity;
      }
    }

    return closestEntity;
  }
}

// Select the entity with the lowest HP
export class LowestHPTargetStrategy implements TargetSelectionStrategy {
  selectTarget(entities: Entity[], playerPos: Vector2): Entity | null {
    if (entities.length === 0) return null;

    let lowestHPEntity: Entity | null = null;
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

// Select the entity with the highest HP
export class HighestHPTargetStrategy implements TargetSelectionStrategy {
  selectTarget(entities: Entity[], playerPos: Vector2): Entity | null {
    if (entities.length === 0) return null;

    let highestHPEntity: Entity | null = null;
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

// Factory to create the right strategy
export function createTargetingStrategy(type: string): TargetSelectionStrategy {
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