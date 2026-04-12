import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RetentionCron, RETENTION_INTERVAL_MS } from '@src/core/logging/retention-cron.js';
import { TrafficService } from '@src/modules/mock/traffic.service.js';

// Mock the data source
const mockTenantRepo = {
  find: vi.fn(),
};

const mockDataSource = {
  getRepository: vi.fn(() => mockTenantRepo),
};

vi.mock('@src/database/data-source.js', () => ({
  getDataSource: vi.fn(() => mockDataSource),
}));

// Mock TrafficService
const mockTrafficService = {
  deleteOlderThan: vi.fn(),
};

describe('RetentionCron', () => {
  let cron: RetentionCron;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    cron = new RetentionCron(mockTrafficService as unknown as TrafficService);
  });

  afterEach(() => {
    vi.useRealTimers();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should initialize with tenant repository', () => {
      expect(mockDataSource.getRepository).toHaveBeenCalled();
      expect(cron).toBeDefined();
    });
  });

  describe('start', () => {
    it('should set isRunning to true', () => {
      mockTenantRepo.find.mockResolvedValue([]);

      cron.start();

      expect(cron.running).toBe(true);
    });

    it('should run cleanup immediately on start', async () => {
      mockTenantRepo.find.mockResolvedValue([{ id: 't1' }]);
      mockTrafficService.deleteOlderThan.mockResolvedValue(0);

      cron.start();

      // Wait for the async cleanup to complete (microtask queue)
      await vi.advanceTimersByTimeAsync(1);

      expect(mockTenantRepo.find).toHaveBeenCalledWith({ select: ['id'] });
      expect(mockTrafficService.deleteOlderThan).toHaveBeenCalled();
    });

    it('should schedule daily cleanup interval', () => {
      mockTenantRepo.find.mockResolvedValue([]);

      const setIntervalSpy = vi.spyOn(global, 'setInterval');

      cron.start();

      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        RETENTION_INTERVAL_MS
      );

      setIntervalSpy.mockRestore();
    });

    it('should not start if already running', () => {
      mockTenantRepo.find.mockResolvedValue([]);

      cron.start();
      cron.start();

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    });

    it('should log startup message', () => {
      mockTenantRepo.find.mockResolvedValue([]);

      cron.start();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[RetentionCron] Started')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Retention: 30 days')
      );
    });

    it('should use custom retention days when provided', () => {
      mockTenantRepo.find.mockResolvedValue([]);

      cron.start(60);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Retention: 60 days')
      );
    });
  });

  describe('stop', () => {
    it('should set isRunning to false', () => {
      mockTenantRepo.find.mockResolvedValue([]);
      cron.start();
      expect(cron.running).toBe(true);

      cron.stop();

      expect(cron.running).toBe(false);
    });

    it('should clear the interval timer', () => {
      mockTenantRepo.find.mockResolvedValue([]);
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      cron.start();
      cron.stop();

      expect(clearIntervalSpy).toHaveBeenCalled();

      clearIntervalSpy.mockRestore();
    });

    it('should log shutdown message', () => {
      mockTenantRepo.find.mockResolvedValue([]);

      cron.start();
      cron.stop();

      expect(consoleLogSpy).toHaveBeenCalledWith('[RetentionCron] Stopped.');
    });

    it('should handle stop when not started', () => {
      expect(() => cron.stop()).not.toThrow();
      expect(cron.running).toBe(false);
    });
  });

  describe('runCleanup', () => {
    it('should return 0 when no tenants exist', async () => {
      mockTenantRepo.find.mockResolvedValue([]);

      const result = await cron.runCleanup(30);

      expect(result).toBe(0);
      expect(mockTrafficService.deleteOlderThan).not.toHaveBeenCalled();
    });

    it('should delete old logs for each tenant', async () => {
      mockTenantRepo.find.mockResolvedValue([{ id: 't1' }, { id: 't2' }]);
      mockTrafficService.deleteOlderThan.mockResolvedValue(5);

      const result = await cron.runCleanup(30);

      expect(mockTrafficService.deleteOlderThan).toHaveBeenCalledTimes(2);
      expect(result).toBe(10);
    });

    it('should calculate correct cutoff date based on retention days', async () => {
      const now = new Date('2024-01-15');
      vi.setSystemTime(now);

      mockTenantRepo.find.mockResolvedValue([{ id: 't1' }]);
      mockTrafficService.deleteOlderThan.mockResolvedValue(0);

      await cron.runCleanup(30);

      const expectedCutoff = new Date('2023-12-16');
      expect(mockTrafficService.deleteOlderThan).toHaveBeenCalledWith(
        't1',
        expectedCutoff
      );
    });

    it('should log deletion count when logs are deleted', async () => {
      mockTenantRepo.find.mockResolvedValue([{ id: 't1' }]);
      mockTrafficService.deleteOlderThan.mockResolvedValue(15);

      await cron.runCleanup(30);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[RetentionCron] Deleted 15 logs')
      );
    });

    it('should not log when no logs are deleted', async () => {
      mockTenantRepo.find.mockResolvedValue([{ id: 't1' }]);
      mockTrafficService.deleteOlderThan.mockResolvedValue(0);

      await cron.runCleanup(30);

      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('[RetentionCron] Deleted')
      );
    });

    it('should handle errors during tenant cleanup gracefully', async () => {
      mockTenantRepo.find.mockResolvedValue([{ id: 't1' }, { id: 't2' }]);
      mockTrafficService.deleteOlderThan
        .mockResolvedValueOnce(5)
        .mockRejectedValueOnce(new Error('Database error'));

      const result = await cron.runCleanup(30);

      expect(result).toBe(5);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[RetentionCron] Failed to delete old logs for tenant t2'),
        expect.any(Error)
      );
    });

    it('should continue cleanup for remaining tenants after error', async () => {
      mockTenantRepo.find.mockResolvedValue([{ id: 't1' }, { id: 't2' }, { id: 't3' }]);
      mockTrafficService.deleteOlderThan
        .mockResolvedValueOnce(5)
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce(10);

      const result = await cron.runCleanup(30);

      expect(mockTrafficService.deleteOlderThan).toHaveBeenCalledTimes(3);
      expect(result).toBe(15);
    });
  });

  describe('running getter', () => {
    it('should return false initially', () => {
      expect(cron.running).toBe(false);
    });

    it('should return true after start', () => {
      mockTenantRepo.find.mockResolvedValue([]);

      cron.start();

      expect(cron.running).toBe(true);
    });

    it('should return false after stop', () => {
      mockTenantRepo.find.mockResolvedValue([]);

      cron.start();
      cron.stop();

      expect(cron.running).toBe(false);
    });
  });
});
