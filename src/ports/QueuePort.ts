import { StatusAplicacao } from "../domain/StatusAplicacao.js";

export interface EventoAplicacaoMensagem {
    localAplicacaoId: number;
    concursoCodigo: string;
    statusAnterior: StatusAplicacao;
    statusNovo: StatusAplicacao;
    registradoEm: string;
    ipOrigem?: string;
    userAgent?: string;
}

export type ProcessadorMensagem = (mensagem: EventoAplicacaoMensagem) => Promise<void>;

export interface QueuePort {
    connect(): Promise<void>;
    disconnect(): Promise<void>;

    publicar(evento: EventoAplicacaoMensagem): Promise<boolean>;

    consumir(processador: ProcessadorMensagem): Promise<void>;
}