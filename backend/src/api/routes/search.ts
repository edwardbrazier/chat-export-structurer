import { Router } from 'express';
import { SearchService } from '../services/search.service.js';
import { SqliteService } from '../services/sqlite.service.js';
import { QdrantService } from '../services/qdrant.service.js';

export const searchRouter = Router();
const searchService = new SearchService(
  new SqliteService(),
  new QdrantService()
);

// POST /api/v1/search
searchRouter.post('/', async (req, res, next) => {
  try {
    const request = req.body;

    // Set default mode if not specified
    if (!request.mode) {
      request.mode = 'hybrid';
    }

    const response = await searchService.search(request);
    res.json(response);
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/search/keyword
searchRouter.post('/keyword', async (req, res, next) => {
  try {
    const request = { ...req.body, mode: 'keyword' as const };
    const response = await searchService.search(request);
    res.json(response);
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/search/semantic
searchRouter.post('/semantic', async (req, res, next) => {
  try {
    const request = { ...req.body, mode: 'semantic' as const };
    const response = await searchService.search(request);
    res.json(response);
  } catch (error) {
    next(error);
  }
});
