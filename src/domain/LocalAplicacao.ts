import { StatusAplicacao, PROXIMA_ACAO_MAP, RegraTransicao } from "./StatusAplicacao.js";

export interface LocalAplicacaoProps {
    id: number;
    concursoId: number;
    codigoEscola: string;
    nomeEscola: string;
    statusAtual?: StatusAplicacao;
}

export class LocalAplicacao {
    readonly id: number;
    readonly concursoId: number;
    readonly codigoEscola: string
    readonly nomeEscola: string;
    private _statusAtual: StatusAplicacao;

    constructor(props: LocalAplicacaoProps) {
        this.id = props.id;
        this.concursoId = props.concursoId;
        this.codigoEscola = props.codigoEscola;
        this.nomeEscola = props.nomeEscola;
        this._statusAtual = props.statusAtual ?? StatusAplicacao.AGUARDANDO_ABERTURA;
    }

    get statusAtual(): StatusAplicacao {
        return this._statusAtual;
    }

    private set statusAtual(value: StatusAplicacao) {
        this._statusAtual = Number(value) as StatusAplicacao;
    }

    /**
     * Retorna a próxima ação possível
     * Retorna null se não houver próxima ação (status atual = PROVAS_ENCERRADAS)
     */
    proximaAcao(): RegraTransicao | null {
        return PROXIMA_ACAO_MAP[this._statusAtual];
    }

    /**
     * Valida a transição de status
     * Lança um erro se a transição não for válida
     */
    validarTransicao(proximoStatus: StatusAplicacao): void {
        const statusDesejado = Number(proximoStatus) as StatusAplicacao;

        if (this._statusAtual === StatusAplicacao.PROVAS_ENCERRADAS) {
            throw new Error(`A aplicação já está encerrada (status atual: ${this._statusAtual})`);
        }

        const regra = PROXIMA_ACAO_MAP[this._statusAtual];

        if (!regra || statusDesejado !== regra.proximoStatus) {
            throw new Error(`A aplicação não pode ir para ${statusDesejado} a partir do status atual ${this._statusAtual}. Próximo status permitido: ${regra?.proximoStatus ?? 'nenhum'}`);
        }
    }

    /**
     * Avança o status da aplicação para o próximo status permitido.
     */
    avancarStatus(status: StatusAplicacao): void {
        this.validarTransicao(status);
        this.statusAtual = Number(status) as StatusAplicacao;
    }
}