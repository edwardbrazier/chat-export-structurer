export interface Message {
  messageId: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
}

export interface Thread {
  threadId: string;
  title: string;
  platform: string;
  accountId: string;
  firstTimestamp: string;
  lastTimestamp: string;
  messageCount: number;
  messages?: Message[];
}

export interface SearchRequest {
  query: string;
  mode: 'keyword' | 'semantic' | 'hybrid';
  platforms?: string[];
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export interface ThreadResult {
  threadId: string;
  title: string;
  platform: string;
  firstTimestamp: string;
  lastTimestamp: string;
  messageCount: number;
  preview: string;
  score: number;
  matchSource: 'keyword' | 'semantic' | 'both';
}

export interface SearchResponse {
  results: ThreadResult[];
  metadata: {
    totalResults: number;
    executionTimeMs: number;
    searchMode: string;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface ArchiveStats {
  threadCount: number;
  messageCount: number;
  platformCount: number;
  platforms: string[];
}
