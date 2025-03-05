import { EntityTracker, Entity } from './entity-tracker';
import { TargetSelectionStrategy, createTargetingStrategy } from './target-selectoin';
import { Vector2 } from '../utils/vector';

export interface AutoAimConfig {
  enabled: boolean;
  targetingStrategy: string;  // 'closest', 'lowest', 'highest'
  maxRange: number;
  leadShots: boolean;         // Whether to aim ahead of moving targets
  leadFactor: number;         // How much to lead shots (0-1)
}

export class AutoAim {
  private config: AutoAimConfig;
  private entityTracker: EntityTracker;
  private targetingStrategy: TargetSelectionStrategy;
  private currentTarget: Entity | null = null;

  constructor(entityTracker: EntityTracker, config: AutoAimConfig) {
    this.entityTracker = entityTracker;
    this.config = config;
    this.targetingStrategy = createTargetingStrategy(config.targetingStrategy);
  }

  // Update configuration
  updateConfig(config: Partial<AutoAimConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.targetingStrategy) {
      this.targetingStrategy = createTargetingStrategy(config.targetingStrategy);
    }
  }

  // Calculate aim angle for player shoot packet
  calculateAimAngle(): number | null {
    if (!this.config.enabled) return null;

    const playerPos = this.entityTracker.getPlayerPosition();
    const enemies = this.entityTracker.getEnemiesInRange(this.config.maxRange);

    if (enemies.length === 0) return null;

    this.currentTarget = this.targetingStrategy.selectTarget(enemies, playerPos);
    if (!this.currentTarget) return null;

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

    return Vector2.angleTo(playerPos, targetPos);
  }

  // Get current target (for debugging)
  getCurrentTarget(): Entity | null {
    return this.currentTarget;
  }
}