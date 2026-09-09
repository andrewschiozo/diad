import { MysqlAdapter } from '../adapters/MysqlAdapter.js';
import { RabbitMQAdapter } from '../adapters/RabbitMQAdapter.js';
import { RedisAdapter } from '../adapters/RedisAdapter.js';
import { EventoAplicacaoMensagem } from '../ports/QueuePort.js';

async function iniciarWorker() {
  console.log('[Worker] Inicializando Processador de Eventos de Aplicação...');

  const database = new MysqlAdapter({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'secret',
    database: process.env.DB_NAME || 'diad',
    connectionLimit: 10
  });

  const queue = new RabbitMQAdapter({
    url: process.env.RABBITMQ_URL || 'amqp://admin:admin@localhost:5672',
    prefetch: 15 // puxa em lote
  });

  const cachePubSub = new RedisAdapter({
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD
  });

  try {

    await database.connect();
    await queue.connect();
    await cachePubSub.connect();

    console.log('[Worker] Conectado ao MySQL, RabbitMQ e Redis.');
    console.log('[Worker] Aguardando mensagens na fila...');

    await queue.consumir(async (evento: EventoAplicacaoMensagem) => {
      const inicio = Date.now();
      console.log(`\n [Worker] Processando evento para Local ID: ${evento.localAplicacaoId}`);
      console.log(`   Transição: ${evento.statusAnterior} -> ${evento.statusNovo}`);

      try {

        await database.atualizarStatusTransacao(
          evento.localAplicacaoId,
          evento.statusNovo,
          {
            localAplicacaoId: evento.localAplicacaoId,
            statusAnterior: evento.statusAnterior,
            statusNovo: evento.statusNovo,
            registradoEm: new Date(evento.registradoEm),
            ipOrigem: evento.ipOrigem,
            userAgent: evento.userAgent
          }
        );

        // Notifica o Pub/Sub para atualizar os dashboards abertos
        const payloadNotificacao = {
          evento: 'STATUS_ATUALIZADO',
          concursoCodigo: evento.concursoCodigo,
          localId: evento.localAplicacaoId,
          novoStatus: evento.statusNovo,
          timestampUtc: evento.registradoEm
        };

        await cachePubSub.publicarAtualizacao(
          `dashboard:${evento.concursoCodigo}`,
          payloadNotificacao
        );

        const duracao = Date.now() - inicio;
        console.log(`[Worker] Evento persistido com sucesso em ${duracao}ms`);

      } catch (erro) {
        console.error(`[Worker] Falha ao persistir evento no banco de dados:`, erro);

        // nack() com requeue
        throw erro;
      }
    });

  } catch (erro) {
    console.error('[Worker] Falha fatal na inicialização:', erro);
    process.exit(1);
  }

  process.on('SIGTERM', encerrarProcesso);
  process.on('SIGINT', encerrarProcesso);

  async function encerrarProcesso() {
    console.log('\n[Worker] Encerrando conexões...');
    try {
      await queue.disconnect();
      await database.disconnect();
      await cachePubSub.disconnect();
      process.exit(0);
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  }
}

iniciarWorker();