import { StatusAplicacao } from "../domain/StatusAplicacao.js";

export interface LocalCacheDTO {
    id: number;
    concursoId: number;
    concursoCodigo: string;
    codigoEscola: string;
    nomeEscola: string;
    senhaHash: string;
    statusAtual: StatusAplicacao;
}

export type CanalNotificacaoCallback = (payload: string) => void;

export interface CachePort {
    connect(): Promise<void>;
    disconnect(): Promise<void>;

    // Coordenador
    obterSessaoLocal(token: string): Promise<LocalCacheDTO | null>;
    salvarSessaoLocal(token: string, dados: LocalCacheDTO, ttlSegundos?: number): Promise<void>;
    invalidarSessaoLocal(token: string): Promise<void>;

    // pub/sub do SSE
    publicarAtualizacao(canal: string, dados: object): Promise<void>;
    inscreverCanal(canal: string, callback: CanalNotificacaoCallback): Promise<void>;
    desinscreverCanal(canal: string): Promise<void>;
}