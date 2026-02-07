import { SqliteService } from './sqlite.service.js';
import { QdrantService } from './qdrant.service.js';
import type { SearchRequest, SearchResponse, ThreadResult } from '../models/index.js';

export class SearchService {
  constructor(
    private sqliteService: SqliteService,
    private qdrantService: QdrantService
  ) {}

  async search(request: SearchRequest): Promise<SearchResponse> {
    const startTime = Date.now();

    let results: ThreadResult[];

    switch (request.mode) {
      case 'keyword':
        results = this.sqliteService.keywordSearch(request);
        break;
      case 'semantic':
        results = await this.qdrantService.semanticSearch(request);
        break;
      case 'hybrid':
      default:
        results = await this.hybridSearch(request);
        break;
    }

    const executionTimeMs = Date.now() - startTime;

    return {
      results,
      metadata: {
        totalResults: results.length,
        executionTimeMs,
        searchMode: request.mode,
      },
    };
  }

  private async hybridSearch(request: SearchRequest): Promise<ThreadResult[]> {
    // Run both searches in parallel, with error handling
    const [keywordResults, semanticResults] = await Promise.allSettled([
      Promise.resolve(this.sqliteService.keywordSearch(request)),
      this.qdrantService.semanticSearch(request),
    ]);

    // Extract successful results
    const keywordData = keywordResults.status === 'fulfilled' ? keywordResults.value : [];
    const semanticData = semanticResults.status === 'fulfilled' ? semanticResults.value : [];

    // Log if semantic search failed (for debugging)
    if (semanticResults.status === 'rejected') {
      console.warn('Semantic search failed, falling back to keyword-only:', semanticResults.reason);
    }

    // If both failed, return empty array
    if (keywordData.length === 0 && semanticData.length === 0) {
      return [];
    }

    // Merge using Reciprocal Rank Fusion (RRF)
    return this.mergeWithRRF(keywordData, semanticData, request.limit || 10);
  }

  private mergeWithRRF(
    keywordResults: ThreadResult[],
    semanticResults: ThreadResult[],
    limit: number
  ): ThreadResult[] {
    const k = 60; // RRF constant
    const scores = new Map<string, { score: number; result: ThreadResult; source: string }>();

    // Score keyword results
    keywordResults.forEach((result, index) => {
      const score = 1 / (index + k);
      scores.set(result.threadId, { score, result, source: 'keyword' });
    });

    // Score semantic results
    semanticResults.forEach((result, index) => {
      const score = 1 / (index + k);
      const existing = scores.get(result.threadId);

      if (existing) {
        scores.set(result.threadId, {
          score: existing.score + score,
          result,
          source: 'both',
        });
      } else {
        scores.set(result.threadId, { score, result, source: 'semantic' });
      }
    });

    // Sort by combined score and return top results
    return Array.from(scores.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ score, result, source }) => ({
        ...result,
        score,
        matchSource: source as 'keyword' | 'semantic' | 'both',
      }));
  }
}
