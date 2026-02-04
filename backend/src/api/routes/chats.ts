import { Router } from 'express';
import { SqliteService } from '../services/sqlite.service.js';

export const chatRouter = Router();
const sqliteService = new SqliteService();

// GET /api/v1/chats
chatRouter.get('/', (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const platform = req.query.platform as string | undefined;

    const { threads, total } = sqliteService.getThreads(page, pageSize, platform);

    res.json({
      items: threads,
      page,
      pageSize,
      totalItems: total,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/chats/:threadId
chatRouter.get('/:threadId', (req, res, next) => {
  try {
    const thread = sqliteService.getThreadById(req.params.threadId);

    if (!thread) {
      res.status(404).json({ error: 'Thread not found' });
      return;
    }

    res.json(thread);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/stats
chatRouter.get('/stats/overview', (_req, res, next) => {
  try {
    const stats = sqliteService.getStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});
