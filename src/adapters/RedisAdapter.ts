import { Redis } from 'ioredis';
import { CachePort, LocalCacheDTO, CanalNotificacaoCallback } from '../ports/CachePort.js';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
}

export class RedisAdapter implements CachePort {
  private cliente: Redis | null = null;
  private subCliente: Redis | null = null;
  private inscricoes: Map<string, CanalNotificacaoCallback[]> = new Map();

  constructor(private readonly config: RedisConfig) {}

  async connect(): Promise<void> {
    if (!this.cliente) {
      this.cliente = new Redis({
        host: this.config.host,
        port: this.config.port,
        password: this.config.password,
        db: this.config.db ?? 0,
        keyPrefix: this.config.keyPrefix ?? 'diad:',
        lazyConnect: true,
        maxRetriesPerRequest: 3
      });

      await this.cliente.connect();
    }
  }

  async disconnect(): Promise<void> {
    if (this.subCliente) {
      await this.subCliente.quit();
      this.subCliente = null;
    }

    if (this.cliente) {
      await this.cliente.quit();
      this.cliente = null;
    }

    this.inscricoes.clear();
  }

  private obterCliente(): Redis {
    if (!this.cliente) {
      throw new Error('RedisAdapter não está conectado.');
    }
    return this.cliente;
  }

  private async obterOuCriarSubCliente(): Promise<Redis> {
    if (!this.subCliente) {
      this.subCliente = new Redis({
        host: this.config.host,
        port: this.config.port,
        password: this.config.password,
        db: this.config.db ?? 0,
        lazyConnect: true,
        maxRetriesPerRequest: 3
      });

      await this.subCliente.connect();

      // Roteia mensagens recebidas para os callbacks inscritos
      this.subCliente.on('message', (canalRecebido: string, mensagem: string) => {
        const callbacks = this.inscricoes.get(canalRecebido);
        if (callbacks && callbacks.length > 0) {
          for (const callback of callbacks) {
            callback(mensagem);
          }
        }
      });
    }

    return this.subCliente;
  }

  // Cache de Sessão

  async obterSessaoLocal(token: string): Promise<LocalCacheDTO | null> {
    const redis = this.obterCliente();
    const chave = `sessao:${token}`;
    const valor = await redis.get(chave);

    if (!valor) {
      return null;
    }

    try {
      return JSON.parse(valor) as LocalCacheDTO;
    } catch {
      return null;
    }
  }

  async salvarSessaoLocal(token: string, dados: LocalCacheDTO, ttlSegundos: number = 86400): Promise<void> {
    const redis = this.obterCliente();
    const chave = `sessao:${token}`;
    const valorJson = JSON.stringify(dados);

    await redis.set(chave, valorJson, 'EX', ttlSegundos);
  }

  async invalidarSessaoLocal(token: string): Promise<void> {
    const redis = this.obterCliente();
    const chave = `sessao:${token}`;
    await redis.del(chave);
  }

  // Pub/Sub em Tempo Real

  async publicarAtualizacao(canal: string, dados: object): Promise<void> {
    const redis = this.obterCliente();
    const canalFormatado = `canal:${canal}`;
    const payloadJson = JSON.stringify(dados);

    await redis.publish(canalFormatado, payloadJson);
  }

  async inscreverCanal(canal: string, callback: CanalNotificacaoCallback): Promise<void> {
    const sub = await this.obterOuCriarSubCliente();
    const canalFormatado = `canal:${canal}`;

    const callbacksAtuais = this.inscricoes.get(canalFormatado) ?? [];
    callbacksAtuais.push(callback);
    this.inscricoes.set(canalFormatado, callbacksAtuais);

    if (callbacksAtuais.length === 1) {
      await sub.subscribe(canalFormatado);
    }
  }

  async desinscreverCanal(canal: string): Promise<void> {
    const canalFormatado = `canal:${canal}`;
    this.inscricoes.delete(canalFormatado);

    if (this.subCliente) {
      await this.subCliente.unsubscribe(canalFormatado);
    }
  }
}