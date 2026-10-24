import path from 'node:path';
import fs from 'node:fs';
import { buildApp } from './app.ts';

const port = Number(process.env.PORT ?? 9000);
const host = process.env.HOST ?? '127.0.0.1';
const { app } = await buildApp();

const dist = path.resolve('dist/web');
if (fs.existsSync(dist)) {
  const fastifyStatic = (await import('@fastify/static')).default;
  await app.register(fastifyStatic, { root: dist, prefix: '/' });
  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/')) return reply.status(404).send({ error: { code: 'not_found', message: '接口不存在' } });
    return reply.sendFile('index.html');
  });
}

await app.listen({ port, host });
console.log(`AI Factory clone listening on http://${host}:${port}`);
