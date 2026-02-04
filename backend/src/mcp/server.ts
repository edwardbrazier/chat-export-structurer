import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { SqliteService } from '../api/services/sqlite.service.js';
import { SearchService } from '../api/services/search.service.js';
import { QdrantService } from '../api/services/qdrant.service.js';

const sqliteService = new SqliteService();
const searchService = new SearchService(sqliteService, new QdrantService());

const server = new Server(
  {
    name: 'chat-archive',
    version: '1.0.0',
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

// List all conversations as resources
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const { threads } = sqliteService.getThreads(1, 100);

  return {
    resources: threads.map((thread) => ({
      uri: `chat://${thread.threadId}`,
      name: thread.title,
      description: `${thread.platform} conversation (${thread.messageCount} messages)`,
      mimeType: 'text/plain',
    })),
  };
});

// Read a specific conversation
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const threadId = request.params.uri.replace('chat://', '');
  const thread = sqliteService.getThreadById(threadId);

  if (!thread) {
    throw new Error(`Thread not found: ${threadId}`);
  }

  let text = `# ${thread.title}\n\n`;
  text += `Platform: ${thread.platform}\n`;
  text += `Messages: ${thread.messageCount}\n`;
  text += `Date Range: ${thread.firstTimestamp} to ${thread.lastTimestamp}\n\n`;
  text += '---\n\n';

  if (thread.messages) {
    for (const msg of thread.messages) {
      text += `**${msg.role.toUpperCase()}** (${msg.timestamp}):\n${msg.text}\n\n`;
    }
  }

  return {
    contents: [
      {
        uri: request.params.uri,
        mimeType: 'text/plain',
        text,
      },
    ],
  };
});

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'search_chats',
        description: 'Search archived AI conversations using keyword, semantic, or hybrid search',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query',
            },
            mode: {
              type: 'string',
              enum: ['keyword', 'semantic', 'hybrid'],
              default: 'hybrid',
              description: 'Search mode: keyword (SQLite FTS), semantic (vector search), or hybrid (both)',
            },
            platforms: {
              type: 'array',
              items: { type: 'string' },
              description: 'Filter by platforms (e.g., ["claude.ai", "chatgpt"])',
            },
            limit: {
              type: 'number',
              default: 5,
              description: 'Maximum number of results',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_chat',
        description: 'Retrieve a specific conversation by thread ID',
        inputSchema: {
          type: 'object',
          properties: {
            threadId: {
              type: 'string',
              description: 'The thread ID to retrieve',
            },
          },
          required: ['threadId'],
        },
      },
      {
        name: 'list_chats',
        description: 'List recent conversations with optional platform filter',
        inputSchema: {
          type: 'object',
          properties: {
            platform: {
              type: 'string',
              description: 'Filter by platform (optional)',
            },
            limit: {
              type: 'number',
              default: 20,
              description: 'Number of conversations to return',
            },
          },
        },
      },
    ],
  };
});

// Execute tools
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'search_chats': {
      const searchRequest = args as any;
      const response = await searchService.search({
        query: searchRequest.query,
        mode: searchRequest.mode || 'hybrid',
        platforms: searchRequest.platforms,
        limit: searchRequest.limit || 5,
      });

      let text = `Found ${response.results.length} conversations (${response.metadata.executionTimeMs}ms):\n\n`;

      for (const result of response.results) {
        text += `**${result.title}** (${result.platform})\n`;
        text += `Score: ${result.score.toFixed(3)} | Source: ${result.matchSource} | Messages: ${result.messageCount}\n`;
        text += `Date: ${result.firstTimestamp} to ${result.lastTimestamp}\n`;
        text += `Preview: ${result.preview.substring(0, 150)}...\n`;
        text += `Thread ID: ${result.threadId}\n\n`;
        text += '---\n\n';
      }

      return {
        content: [{ type: 'text', text }],
      };
    }

    case 'get_chat': {
      const { threadId } = args as any;
      const thread = sqliteService.getThreadById(threadId);

      if (!thread) {
        return {
          content: [{ type: 'text', text: `Thread not found: ${threadId}` }],
          isError: true,
        };
      }

      let text = `# ${thread.title}\n\n`;
      text += `Platform: ${thread.platform}\n`;
      text += `Messages: ${thread.messageCount}\n`;
      text += `Date Range: ${thread.firstTimestamp} to ${thread.lastTimestamp}\n\n`;
      text += '---\n\n';

      if (thread.messages) {
        for (const msg of thread.messages) {
          text += `**${msg.role.toUpperCase()}** (${msg.timestamp}):\n${msg.text}\n\n`;
        }
      }

      return {
        content: [{ type: 'text', text }],
      };
    }

    case 'list_chats': {
      const { platform, limit = 20 } = args as any;
      const { threads } = sqliteService.getThreads(1, limit, platform);

      let text = `Found ${threads.length} conversations:\n\n`;

      for (const thread of threads) {
        text += `**${thread.title}** (${thread.platform})\n`;
        text += `Messages: ${thread.messageCount} | Last: ${thread.lastTimestamp}\n`;
        text += `Thread ID: ${thread.threadId}\n\n`;
      }

      return {
        content: [{ type: 'text', text }],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Start MCP server
export async function startMcpServer(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Chat Archive MCP server running on stdio');
}
