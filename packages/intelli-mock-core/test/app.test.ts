import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

describe('attachErrorHandler', () => {
  it('should return 500 when error is thrown', async () => {
    const { attachErrorHandler } = await import('@src/app.js');

    const app = express();
    app.get('/error', () => {
      throw new Error('Test error');
    });
    attachErrorHandler(app);

    const response = await request(app).get('/error');
    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Internal Server Error');
  });

  it('should include message in development mode', async () => {
    process.env.NODE_ENV = 'development';
    const { attachErrorHandler } = await import('@src/app.js');

    const app = express();
    app.get('/error', () => {
      throw new Error('Specific test error');
    });
    attachErrorHandler(app);

    const response = await request(app).get('/error');
    expect(response.status).toBe(500);
    expect(response.body.message).toBe('Specific test error');
  });

  it('should hide message in production mode', async () => {
    process.env.NODE_ENV = 'production';
    const { attachErrorHandler } = await import('@src/app.js');

    const app = express();
    app.get('/error', () => {
      throw new Error('Secret error');
    });
    attachErrorHandler(app);

    const response = await request(app).get('/error');
    expect(response.status).toBe(500);
    expect(response.body.message).toBeUndefined();
  });
});

describe('createApp', () => {
  it('should be a function', async () => {
    const { createApp } = await import('@src/app.js');
    expect(typeof createApp).toBe('function');
  });
});
