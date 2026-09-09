import { DatabasePort, EstatisticasConcursoDTO } from '../ports/DatabasePort.js';
import { StatusAplicacao } from '../domain/StatusAplicacao.js';

export interface LocalResumoDTO {
  id: number;
  codigoEscola: string;
  nomeEscola: string;
  tokenAcesso: string;
  statusAtual: StatusAplicacao;
  updatedAt: string;
}

export interface DashboardOutput {
  concursoCodigo: string;
  estatisticas: EstatisticasConcursoDTO;
  locais: LocalResumoDTO[];
}

export class ObterDashboardUseCase {
  constructor(private readonly database: DatabasePort) {}

  async executar(concursoCodigo: string): Promise<DashboardOutput> {
    if (!concursoCodigo) {
      throw new Error('Código do concurso é obrigatório.');
    }

    const estatisticas = await this.database.obterEstatisticasConcurso(concursoCodigo);

    if (!estatisticas) {
      throw new Error(`Concurso '${concursoCodigo}' não encontrado.`);
    }

    const registros = await this.database.listarLocaisPorConcurso(concursoCodigo);

    const locais: LocalResumoDTO[] = registros.map((r) => ({
      id: r.id,
      codigoEscola: r.codigoEscola,
      nomeEscola: r.nomeEscola,
      tokenAcesso: r.tokenAcesso,
      statusAtual: r.statusAtual,
      updatedAt: r.updatedAt.toISOString()
    }));

    return {
      concursoCodigo,
      estatisticas,
      locais
    };
  }
}