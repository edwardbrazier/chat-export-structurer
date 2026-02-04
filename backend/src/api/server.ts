import express from 'express';
import cors from 'cors';
import { chatRouter } from './routes/chats.js';
import { searchRouter } from './routes/search.js';
import { errorHandler } from './middleware/error.js';
import { logger } from './middleware/logger.js';
import { config } from '../shared/config.js';

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(logger);

  // Routes
  app.use('/api/v1/chats', chatRouter);
  app.use('/api/v1/search', searchRouter);

  // Health check
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  // Error handling
  app.use(errorHandler);

  return app;
}

// Start server if running in API mode
export function startApiServer(): void {
  const app = createServer();
  const port = config.api.port;
  const host = config.api.host;

  app.listen(port, host, () => {
    console.log(`API server listening on http://${host}:${port}`);
    console.log(`Health check: http://${host}:${port}/health`);
  });
}
