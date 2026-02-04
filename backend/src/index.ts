import { config } from './shared/config.js';

async function main() {
  if (config.mode === 'mcp') {
    const { startMcpServer } = await import('./mcp/server.js');
    await startMcpServer();
  } else {
    const { startApiServer } = await import('./api/server.js');
    startApiServer();
  }
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
