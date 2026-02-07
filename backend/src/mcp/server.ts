import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import { SqliteService } from '../api/services/sqlite.service.js';
import { SearchService } from '../api/services/search.service.js';
import { QdrantService } from '../api/services/qdrant.service.js';
import { config } from '../shared/config.js';

const sqliteService = new SqliteService();
const searchService = new SearchService(sqliteService, new QdrantService());

/**
 * Creates and configures the MCP server with all handlers
 */
function createMcpServer(): Server {
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

  registerResourceHandlers(server);
  registerToolHandlers(server);

  return server;
}

/**
 * Register resource handlers (list and read conversations)
 */
function registerResourceHandlers(server: Server): void {
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
}

/**
 * Register tool handlers (search and fetch)
 */
function registerToolHandlers(server: Server): void {
  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'search',
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
          name: 'fetch',
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
      ],
    };
  });

  // Execute tools
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'search': {
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

      case 'fetch': {
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

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  });
}

/**
 * Start the MCP server with stdio transport (for Claude Desktop)
 */
async function startStdioTransport(server: Server): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Chat Archive MCP server running on stdio');
}

/**
 * Start the MCP server with HTTP transport (for ChatGPT)
 */
async function startHttpTransport(server: Server): Promise<void> {
  const app = express();
  const transports = new Map<string, StreamableHTTPServerTransport>();

  // Handle MCP requests
  app.all(config.mcp.http.path, async (req, res) => {
    const sessionId = (req.headers['mcp-session-id'] as string) || 'default';

    let transport = transports.get(sessionId);
    if (!transport) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // Stateless mode
      });
      await server.connect(transport);
      transports.set(sessionId, transport);
    }

    await transport.handleRequest(req, res);
  });

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', server: 'chat-archive-mcp' });
  });

  const { host, port } = config.mcp.http;
  app.listen(port, host, () => {
    console.log(`MCP HTTP server: http://${host}:${port}${config.mcp.http.path}`);
    console.log(`Health check: http://${host}:${port}/health`);
  });
}

/**
 * Start MCP server with configured transport(s)
 */
export async function startMcpServer(): Promise<void> {
  const server = createMcpServer();

  switch (config.mcp.transport) {
    case 'stdio':
      await startStdioTransport(server);
      break;
    case 'http':
      await startHttpTransport(server);
      break;
    case 'both':
      await Promise.all([startStdioTransport(server), startHttpTransport(server)]);
      break;
    default:
      throw new Error(`Unknown transport: ${config.mcp.transport}`);
  }
}
