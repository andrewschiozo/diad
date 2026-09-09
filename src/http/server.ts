import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import cors from '@fastify/cors';

import { MysqlAdapter } from '../adapters/MysqlAdapter.js';
import { RabbitMQAdapter } from '../adapters/RabbitMQAdapter.js';
import { RedisAdapter } from '../adapters/RedisAdapter.js';

import { AutenticarLocalUseCase } from '../usecases/AutenticarLocalUseCase.js';
import { RegistrarAvancoStatusUseCase } from '../usecases/RegistrarAvancoStatusUseCase.js';
import { ObterDashboardUseCase } from '../usecases/ObterDashboardUseCase.js';
import { StatusAplicacao } from '../domain/StatusAplicacao.js';

async function bootstrap() {
  const app: FastifyInstance = Fastify({
    logger: true
  });

  await app.register(cors, {
    origin: true
  });

  // infra
  const database = new MysqlAdapter({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'secret',
    database: process.env.DB_NAME || 'diad',
    connectionLimit: 20
  });

  const queue = new RabbitMQAdapter({
    url: process.env.RABBITMQ_URL || 'amqp://admin:admin@localhost:5672',
    prefetch: 10
  });

  const cache = new RedisAdapter({
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD
  });

  await database.connect();
  await queue.connect();
  await cache.connect();

  app.log.info('Infraestrutura (MySQL, RabbitMQ, Redis) conectada com sucesso.');

  // usecases
  const autenticarLocalUseCase = new AutenticarLocalUseCase(database, cache);
  const registrarAvancoUseCase = new RegistrarAvancoStatusUseCase(cache, queue, database);
  const obterDashboardUseCase = new ObterDashboardUseCase(database);

  // --- ROTAS HTTP ---

  // Healthcheck
  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Autenticação do coordenador no local de prova
  app.post(
    '/api/auth/login',
    async (
      req: FastifyRequest<{
        Body: { tokenAcesso: string; senhaDigitada: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { tokenAcesso, senhaDigitada } = req.body || {};
        const resultado = await autenticarLocalUseCase.executar({
          tokenAcesso,
          senhaDigitada
        });

        return reply.status(200).send(resultado);
      } catch (erro: any) {
        return reply.status(401).send({ erro: erro.message || 'Falha na autenticação' });
      }
    }
  );

  // Registro de avanço de status do local de prova
  app.post(
    '/api/locais/avancar-status',
    async (
      req: FastifyRequest<{
        Body: { tokenAcesso: string; novoStatus: number };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { tokenAcesso, novoStatus } = req.body || {};
        const ipOrigem = req.ip;
        const userAgent = req.headers['user-agent'];

        const resultado = await registrarAvancoUseCase.executar({
          tokenAcesso,
          novoStatus: Number(novoStatus) as StatusAplicacao,
          ipOrigem,
          userAgent
        });

        return reply.status(202).send(resultado);
      } catch (erro: any) {
        return reply.status(400).send({ erro: erro.message || 'Erro ao processar transição de status' });
      }
    }
  );

  // Dashboard consolidado
  app.get(
    '/api/dashboard/:codigoConcurso',
    async (
      req: FastifyRequest<{
        Params: { codigoConcurso: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { codigoConcurso } = req.params;
        const dados = await obterDashboardUseCase.executar(codigoConcurso);

        return reply.status(200).send(dados);
      } catch (erro: any) {
        return reply.status(404).send({ erro: erro.message || 'Erro ao carregar dashboard' });
      }
    }
  );

  // Server-Sent Events (SSE) para atualização em tempo real do dashboard
  app.get(
    '/api/dashboard/:codigoConcurso/stream',
    async (
      req: FastifyRequest<{
        Params: { codigoConcurso: string };
      }>,
      reply: FastifyReply
    ) => {
      const { codigoConcurso } = req.params;

      // headers SSE
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });

      reply.raw.write(`data: ${JSON.stringify({ tipo: 'CONECTADO', concurso: codigoConcurso })}\n\n`);

      const canal = `dashboard:${codigoConcurso}`;

      const ouvinte = (mensagem: string) => {
        reply.raw.write(`data: ${mensagem}\n\n`);
      };

      await cache.inscreverCanal(canal, ouvinte);

      // limpa a subscrição quando o client desconectar o SSE
      req.raw.on('close', async () => {
        await cache.desinscreverCanal(canal);
      });
    }
  );

  // servidor
  const porta = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || '0.0.0.0';

  try {
    await app.listen({ port: porta, host });
    app.log.info(`🚀 Servidor HTTP rodando em http://${host}:${porta}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  const encerrar = async () => {
    app.log.info('Encerrando servidor...');
    await app.close();
    await database.disconnect();
    await queue.disconnect();
    await cache.disconnect();
    process.exit(0);
  };

  process.on('SIGINT', encerrar);
  process.on('SIGTERM', encerrar);
}

bootstrap();