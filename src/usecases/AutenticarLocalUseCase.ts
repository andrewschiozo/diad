import bcrypt from 'bcryptjs';
import { DatabasePort } from '../ports/DatabasePort.js';
import { CachePort, LocalCacheDTO } from '../ports/CachePort.js';
import { LocalAplicacao } from '../domain/LocalAplicacao.js';
import { RegraTransicao } from '../domain/StatusAplicacao.js';

export interface AutenticarLocalInput {
  tokenAcesso: string;
  senhaDigitada: string;
}

export interface AutenticarLocalOutput {
  localId: number;
  concursoId: number;
  codigoEscola: string;
  nomeEscola: string;
  statusAtual: number;
  proximaAcao: RegraTransicao | null;
}

export class AutenticarLocalUseCase {
  constructor(
    private readonly database: DatabasePort,
    private readonly cache: CachePort
  ) {}

  async executar(input: AutenticarLocalInput): Promise<AutenticarLocalOutput> {
    const { tokenAcesso, senhaDigitada } = input;

    if (!tokenAcesso || !senhaDigitada) {
      throw new Error('Token de acesso e senha são obrigatórios.');
    }

    let dadosSessao = await this.cache.obterSessaoLocal(tokenAcesso);

    if (!dadosSessao) {
      const registroBanco = await this.database.buscarPorToken(tokenAcesso);

      if (!registroBanco) {
        throw new Error('Local de aplicação não encontrado.');
      }

      dadosSessao = {
        id: registroBanco.id,
        concursoId: registroBanco.concursoId,
        concursoCodigo: '',
        codigoEscola: registroBanco.codigoEscola,
        nomeEscola: registroBanco.nomeEscola,
        senhaHash: registroBanco.senhaHash,
        statusAtual: registroBanco.statusAtual
      };

      await this.cache.salvarSessaoLocal(tokenAcesso, dadosSessao, 86400);
    }

    
    const senhaValida = await bcrypt.compare(senhaDigitada, dadosSessao.senhaHash);

    if (!senhaValida) {
      throw new Error('Credenciais inválidas.');
    }

    const local = new LocalAplicacao({
      id: dadosSessao.id,
      concursoId: dadosSessao.concursoId,
      codigoEscola: dadosSessao.codigoEscola,
      nomeEscola: dadosSessao.nomeEscola,
      statusAtual: dadosSessao.statusAtual
    });

    const proximaAcao = local.proximaAcao();

    return {
      localId: local.id,
      concursoId: local.concursoId,
      codigoEscola: local.codigoEscola,
      nomeEscola: local.nomeEscola,
      statusAtual: local.statusAtual,
      proximaAcao
    };
  }
}