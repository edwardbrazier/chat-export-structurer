import Database from 'better-sqlite3';
import { config } from '../../shared/config.js';
import type { Thread, Message, SearchRequest, ThreadResult, ArchiveStats } from '../models/index.js';

export class SqliteService {
  private db: Database.Database;

  constructor() {
    this.db = new Database(config.database.path, { readonly: true });
  }

  getThreads(page = 1, pageSize = 20, platform?: string): { threads: Thread[]; total: number } {
    let query = `
      SELECT
        canonical_thread_id as threadId,
        title,
        platform,
        account_id as accountId,
        MIN(ts) as firstTimestamp,
        MAX(ts) as lastTimestamp,
        COUNT(*) as messageCount
      FROM messages
    `;

    const params: any[] = [];
    if (platform) {
      query += ' WHERE platform = ?';
      params.push(platform);
    }

    query += `
      GROUP BY canonical_thread_id
      ORDER BY MAX(ts) DESC
      LIMIT ? OFFSET ?
    `;

    params.push(pageSize, (page - 1) * pageSize);

    const threads = this.db.prepare(query).all(...params) as Thread[];

    const countQuery = platform
      ? 'SELECT COUNT(DISTINCT canonical_thread_id) as total FROM messages WHERE platform = ?'
      : 'SELECT COUNT(DISTINCT canonical_thread_id) as total FROM messages';

    const countParams = platform ? [platform] : [];
    const { total } = this.db.prepare(countQuery).get(...countParams) as { total: number };

    return { threads, total };
  }

  getThreadById(threadId: string): Thread | null {
    const threadQuery = `
      SELECT
        canonical_thread_id as threadId,
        title,
        platform,
        account_id as accountId,
        MIN(ts) as firstTimestamp,
        MAX(ts) as lastTimestamp,
        COUNT(*) as messageCount
      FROM messages
      WHERE canonical_thread_id = ?
      GROUP BY canonical_thread_id
    `;

    const thread = this.db.prepare(threadQuery).get(threadId) as Thread | undefined;
    if (!thread) return null;

    const messagesQuery = `
      SELECT
        message_id as messageId,
        role,
        text,
        ts as timestamp
      FROM messages
      WHERE canonical_thread_id = ?
      ORDER BY ts ASC
    `;

    thread.messages = this.db.prepare(messagesQuery).all(threadId) as Message[];

    return thread;
  }

  keywordSearch(request: SearchRequest): ThreadResult[] {
    let query = `
      SELECT DISTINCT
        m.canonical_thread_id as threadId,
        m.platform,
        m.title,
        COUNT(m.message_id) as messageCount,
        MIN(m.ts) as firstTimestamp,
        MAX(m.ts) as lastTimestamp,
        GROUP_CONCAT(SUBSTR(m.text, 1, 100), ' ') as preview
      FROM messages_fts fts
      JOIN messages_fts_docids d ON fts.rowid = d.rowid
      JOIN messages m ON m.message_id = d.message_id
      WHERE messages_fts MATCH ?
    `;

    const params: any[] = [request.query];

    if (request.platforms?.length) {
      query += ` AND m.platform IN (${request.platforms.map(() => '?').join(',')})`;
      params.push(...request.platforms);
    }

    if (request.startDate) {
      query += ' AND m.ts >= ?';
      params.push(request.startDate);
    }

    if (request.endDate) {
      query += ' AND m.ts <= ?';
      params.push(request.endDate);
    }

    query += `
      GROUP BY m.canonical_thread_id
      ORDER BY COUNT(*) DESC
      LIMIT ?
    `;

    params.push(request.limit || 10);

    const results = this.db.prepare(query).all(...params) as any[];

    return results.map(row => ({
      ...row,
      score: 1.0,
      matchSource: 'keyword' as const,
    }));
  }

  getStats(): ArchiveStats {
    const stats = this.db.prepare(`
      SELECT
        COUNT(DISTINCT canonical_thread_id) as threadCount,
        COUNT(*) as messageCount,
        COUNT(DISTINCT platform) as platformCount
      FROM messages
    `).get() as { threadCount: number; messageCount: number; platformCount: number };

    const platforms = this.db.prepare(`
      SELECT DISTINCT platform FROM messages ORDER BY platform
    `).all() as { platform: string }[];

    return {
      ...stats,
      platforms: platforms.map(p => p.platform),
    };
  }

  close(): void {
    this.db.close();
  }
}
