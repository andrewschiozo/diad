import { LocalAplicacao } from "../domain/LocalAplicacao.js"
import { StatusAplicacao } from "../domain/StatusAplicacao.js"

export interface LocalAplicacaoRecord {
    id: number;
    concursoId: number;
    codigoEscola: string;
    nomeEscola: string;
    tokenAcesso: string;
    senhaHash: string;
    statusAtual: StatusAplicacao;
    updatedAt: Date;
    createdAt: Date;
}

export interface RegistrarEventoDTO {
    localAplicacaoId: number;
    statusAnterior: StatusAplicacao;
    statusNovo: StatusAplicacao;
    registradoEm: Date;
    ipOrigem?: string;
    userAgent?: string;
}

export interface EstatisticasConcursoDTO {
    concursoCodigo: string;
    totalLocais: number;
    totalPorStatus: Record<StatusAplicacao, number>;
}

export interface DatabasePort {
    connect(): Promise<void>,
    disconnect(): Promise<void>,

    // Coordenador
    buscarPorToken(tokenAcesso: string): Promise<LocalAplicacaoRecord | null>;
    buscarPorId(id: number): Promise<LocalAplicacaoRecord | null>;

    // Auditoria
    atualizarStatusTransacao(
        localAplicacaoId: number,
        statusNovo: StatusAplicacao,
        evento: RegistrarEventoDTO
    ): Promise<void>;

    // Dashboard
    obterEstatisticasConcurso(concursoCodigo: string): Promise<EstatisticasConcursoDTO | null>;
    listarLocaisPorConcurso(concursoCodigo: string): Promise<LocalAplicacaoRecord[]>;
}