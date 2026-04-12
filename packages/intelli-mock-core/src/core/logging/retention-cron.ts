import { injectable, inject } from 'tsyringe';
import { Repository } from 'typeorm';
import { getDataSource } from '../../database/data-source.js';
import { TrafficService } from '../../modules/mock/traffic.service.js';
import { Tenant } from '../../entities/tenant.entity.js';
import { DEFAULT_RETENTION_DAYS } from './traffic-logger.js';

/**
 * How often the retention cron runs (in milliseconds).
 * Default: once per day (24 hours).
 */
export const RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * RetentionCron periodically deletes old traffic logs to enforce
 * the 1-month retention policy. It runs on a daily schedule and
 * can be started/stopped alongside the server lifecycle.
 */
@injectable()
export class RetentionCron {
  private timerId: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private tenantRepo: Repository<Tenant>;

  constructor(
    @inject(TrafficService) private trafficService: TrafficService,
  ) {
    const ds = getDataSource();
    this.tenantRepo = ds.getRepository(Tenant);
  }

  /**
   * Starts the retention cron schedule. Runs cleanup once immediately,
   * then schedules daily execution.
   *
   * @param retentionDays - Number of days to retain logs (default: 30).
   */
  start(retentionDays: number = DEFAULT_RETENTION_DAYS): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    // Run immediately on start
    this.runCleanup(retentionDays).catch((err) => {
      console.error('[RetentionCron] Error during initial cleanup:', err);
    });

    // Schedule daily cleanup
    this.timerId = setInterval(() => {
      this.runCleanup(retentionDays).catch((err) => {
        console.error('[RetentionCron] Error during scheduled cleanup:', err);
      });
    }, RETENTION_INTERVAL_MS);

    // Unref to prevent the timer from keeping the process alive
    if (this.timerId && typeof this.timerId === 'object' && 'unref' in this.timerId) {
      (this.timerId as NodeJS.Timeout).unref();
    }

    console.log(`[RetentionCron] Started. Retention: ${retentionDays} days`);
  }

  /**
   * Stops the retention cron schedule.
   */
  stop(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.isRunning = false;
    console.log('[RetentionCron] Stopped.');
  }

  /**
   * Returns whether the cron is currently running.
   */
  get running(): boolean {
    return this.isRunning;
  }

  /**
   * Runs the actual cleanup logic: deletes logs older than the retention period
   * for each tenant. Returns total number of deleted logs.
   */
  async runCleanup(retentionDays: number): Promise<number> {
    const tenants = await this.tenantRepo.find({ select: ['id'] });
    if (tenants.length === 0) {
      return 0;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    let totalDeleted = 0;

    for (const tenant of tenants) {
      try {
        const deleted = await this.trafficService.deleteOlderThan(tenant.id, cutoffDate);
        totalDeleted += deleted;
        if (deleted > 0) {
          console.log(`[RetentionCron] Deleted ${deleted} logs for tenant ${tenant.id} (older than ${cutoffDate.toISOString()})`);
        }
      } catch (error) {
        console.error(`[RetentionCron] Failed to delete old logs for tenant ${tenant.id}:`, error);
      }
    }

    return totalDeleted;
  }
}
