import { CachePort, LocalCacheDTO } from '../ports/CachePort.js';
import { QueuePort } from '../ports/QueuePort.js';
import { DatabasePort } from '../ports/DatabasePort.js';
import { LocalAplicacao } from '../domain/LocalAplicacao.js';
import { StatusAplicacao } from '../domain/StatusAplicacao.js';

export interface RegistrarAvancoInput {
  tokenAcesso: string;
  novoStatus: StatusAplicacao;
  ipOrigem?: string;
  userAgent?: string;
}

export interface RegistrarAvancoOutput {
  sucesso: boolean;
  statusAnterior: StatusAplicacao;
  statusNovo: StatusAplicacao;
  mensagem: string;
}

export class RegistrarAvancoStatusUseCase {
  constructor(
    private readonly cache: CachePort,
    private readonly queue: QueuePort,
    private readonly database: DatabasePort
  ) {}

  async executar(input: RegistrarAvancoInput): Promise<RegistrarAvancoOutput> {
    const { tokenAcesso, novoStatus, ipOrigem, userAgent } = input;

    let dadosSessao = await this.cache.obterSessaoLocal(tokenAcesso);

    if (!dadosSessao) {
      const registroBanco = await this.database.buscarPorToken(tokenAcesso);
      if (!registroBanco) {
        throw new Error('Local de aplicação não encontrado.');
      }

      dadosSessao = {
        id: registroBanco.id,
        concursoId: registroBanco.concursoId,
        concursoCodigo: '0000',
        codigoEscola: registroBanco.codigoEscola,
        nomeEscola: registroBanco.nomeEscola,
        senhaHash: registroBanco.senhaHash,
        statusAtual: registroBanco.statusAtual
      };
    }

    const local = new LocalAplicacao({
      id: dadosSessao.id,
      concursoId: dadosSessao.concursoId,
      codigoEscola: dadosSessao.codigoEscola,
      nomeEscola: dadosSessao.nomeEscola,
      statusAtual: dadosSessao.statusAtual
    });

    const statusAnterior = local.statusAtual;

    local.avancarStatus(novoStatus);

    const dataHoraUtcIso = new Date().toISOString();

    await this.queue.publicar({
      localAplicacaoId: local.id,
      concursoCodigo: dadosSessao.concursoCodigo || '0000',
      statusAnterior,
      statusNovo: local.statusAtual,
      registradoEm: dataHoraUtcIso,
      ipOrigem,
      userAgent
    });

    const sessaoAtualizada: LocalCacheDTO = {
      ...dadosSessao,
      statusAtual: local.statusAtual
    };
    await this.cache.salvarSessaoLocal(tokenAcesso, sessaoAtualizada, 86400);

    return {
      sucesso: true,
      statusAnterior,
      statusNovo: local.statusAtual,
      mensagem: 'Status registrado com sucesso e enfileirado para processamento.'
    };
  }
}