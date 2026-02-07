import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const config = {
  mode: process.env.MODE || 'api',
  api: {
    port: parseInt(process.env.API_PORT || '5000', 10),
    host: process.env.API_HOST || '0.0.0.0',
  },
  database: {
    path: process.env.DATABASE_PATH || path.resolve(__dirname, '../../../my_chats.sqlite'),
  },
  qdrant: {
    host: process.env.QDRANT_HOST || 'localhost',
    port: parseInt(process.env.QDRANT_PORT || '6335', 10),
    collection: process.env.QDRANT_COLLECTION || 'chat_messages',
  },
  pythonScripts: {
    path: process.env.PYTHON_SCRIPTS_PATH || path.resolve(__dirname, '../../../src'),
  },
  mcp: {
    transport: (process.env.MCP_TRANSPORT || 'stdio') as 'stdio' | 'http' | 'both',
    http: {
      port: parseInt(process.env.MCP_HTTP_PORT || '3001', 10),
      host: process.env.MCP_HTTP_HOST || '127.0.0.1',
      path: process.env.MCP_HTTP_PATH || '/mcp',
      allowedHosts: process.env.MCP_ALLOWED_HOSTS?.split(','),
    },
  },
};
