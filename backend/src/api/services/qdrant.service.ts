import { spawn } from 'child_process';
import { config } from '../../shared/config.js';
import type { SearchRequest, ThreadResult } from '../models/index.js';

export class QdrantService {
  async semanticSearch(request: SearchRequest): Promise<ThreadResult[]> {
    return new Promise((resolve, reject) => {
      const args = [
        'query_with_context.py',
        request.query,
        '--db', config.database.path,
        '--collection', config.qdrant.collection,
        '--limit', String(request.limit || 10),
        '--format', 'json',
      ];

      // Add platform filter if specified
      if (request.platforms && request.platforms.length > 0) {
        args.push('--platforms', ...request.platforms);
      }

      const childProcess = spawn('python3', args, {
        cwd: config.pythonScripts.path,
        env: {
          ...process.env,
          QDRANT_HOST: config.qdrant.host,
          QDRANT_PORT: String(config.qdrant.port),
        },
      });

      let stdout = '';
      let stderr = '';

      childProcess.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      childProcess.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      childProcess.on('close', (code: number | null) => {
        if (code !== 0) {
          reject(new Error(`Python script exited with code ${code}: ${stderr}`));
          return;
        }

        try {
          const results = JSON.parse(stdout);
          // Ensure matchSource is set
          const formattedResults = results.map((r: ThreadResult) => ({
            ...r,
            matchSource: r.matchSource || 'semantic',
          }));
          resolve(formattedResults);
        } catch (error) {
          reject(new Error(`Failed to parse Python output: ${error}`));
        }
      });

      childProcess.on('error', (error: Error) => {
        reject(new Error(`Failed to spawn Python process: ${error.message}`));
      });
    });
  }
}
