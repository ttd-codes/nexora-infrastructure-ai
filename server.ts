import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './server/routes/api.ts';

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.set('trust proxy', 1);
  app.use(express.json({ limit: '18mb' }));

  app.use('/api', apiRouter);

  // Guarantee /api/* middleware errors (e.g. malformed JSON or >18MB payloads)
  // always respond with structured JSON rather than falling through to HTML.
  app.use(
    '/api',
    (
      err: Error & { status?: number; statusCode?: number; type?: string },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      if (err.type === 'entity.too.large') {
        res.status(413).json({
          error: 'Uploaded payload exceeds the 18 MB server limit. Please upload a smaller file.',
          code: 'PAYLOAD_TOO_LARGE',
        });
        return;
      }
      if (err instanceof SyntaxError && err.status === 400) {
        res.status(400).json({
          error: 'Malformed JSON request body.',
          code: 'INVALID_JSON_BODY',
        });
        return;
      }
      const rawStatus = err.statusCode || err.status || 500;
      const status = [403, 502, 503, 504].includes(rawStatus) ? 500 : rawStatus;
      console.error('Unhandled /api error:', err);
      res.status(status).json({
        error: err.message || 'Internal server error.',
        code: 'API_ERROR',
      });
    }
  );

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`NEXORA server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start NEXORA server:', err);
  process.exit(1);
});
