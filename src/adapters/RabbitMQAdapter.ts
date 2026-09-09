import amqplib, { ChannelModel, Channel } from 'amqplib';
import { QueuePort, EventoAplicacaoMensagem, ProcessadorMensagem } from '../ports/QueuePort.js';

export interface RabbitMQConfig {
  url: string;
  filaNome?: string;
  prefetch?: number;
}

export class RabbitMQAdapter implements QueuePort {
  private conexao: ChannelModel | null = null;
  private canal: Channel | null = null;
  private readonly filaNome: string;
  private readonly prefetch: number;

  constructor(private readonly config: RabbitMQConfig) {
    this.filaNome = config.filaNome ?? 'fila_eventos_aplicacao';
    this.prefetch = config.prefetch ?? 10;
  }

  async connect(): Promise<void> {
    if (!this.conexao) {
      this.conexao = await amqplib.connect(this.config.url);
      this.canal = await this.conexao.createChannel();

      // garante que a fila exista de forma persistente
      await this.canal.assertQueue(this.filaNome, {
        durable: true
      });

      // limita qtd de mensagens não confirmadas simultâneas com este worker
      await this.canal.prefetch(this.prefetch);
    }
  }

  async disconnect(): Promise<void> {
    if (this.canal) {
      await this.canal.close();
      this.canal = null;
    }
    if (this.conexao) {
      await this.conexao.close();
      this.conexao = null;
    }
  }

  private obterCanal(): Channel {
    if (!this.canal) {
      throw new Error('RabbitMQAdapter não está conectado.');
    }
    return this.canal;
  }

  async publicar(evento: EventoAplicacaoMensagem): Promise<boolean> {
    const canal = this.obterCanal();
    const payloadBuffer = Buffer.from(JSON.stringify(evento));

    return canal.sendToQueue(this.filaNome, payloadBuffer, {
      persistent: true, // grava a mensagem em disco
      contentType: 'application/json'
    });
  }

  async consumir(processador: ProcessadorMensagem): Promise<void> {
    const canal = this.obterCanal();

    await canal.consume(
      this.filaNome,
      async (msg) => {
        if (!msg) return;

        try {
          const conteudoJson = msg.content.toString('utf-8');
          const evento: EventoAplicacaoMensagem = JSON.parse(conteudoJson);

          await processador(evento);

          canal.ack(msg);
        } catch (erro) {
          console.error('[RabbitMQAdapter] Erro ao processar mensagem da fila:', erro);
          canal.nack(msg, false, true);
        }
      },
      {
        noAck: false // confirmação manual para garantir entrega
      }
    );
  }
}