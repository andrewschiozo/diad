export enum StatusAplicacao {
  AGUARDANDO_ABERTURA = 0,
  PORTOES_ABERTOS = 1,
  PORTOES_FECHADOS = 2,
  PROVAS_INICIADAS = 3,
  PROVAS_ENCERRADAS = 4
}

export const StatusDescricao: Record<StatusAplicacao, string> = {
  [StatusAplicacao.AGUARDANDO_ABERTURA]: 'Aguardando Abertura',
  [StatusAplicacao.PORTOES_ABERTOS]: 'Portões Abertos',
  [StatusAplicacao.PORTOES_FECHADOS]: 'Portões Fechados',
  [StatusAplicacao.PROVAS_INICIADAS]: 'Provas Iniciadas',
  [StatusAplicacao.PROVAS_ENCERRADAS]: 'Provas Encerradas'
};

export interface RegraTransicao {
  proximoStatus: StatusAplicacao;
  label: string;
}

export const PROXIMA_ACAO_MAP: Record<StatusAplicacao, RegraTransicao | null> = {
  [StatusAplicacao.AGUARDANDO_ABERTURA]: {
    proximoStatus: StatusAplicacao.PORTOES_ABERTOS,
    label: '1 - Abrir Portões'
  },
  [StatusAplicacao.PORTOES_ABERTOS]: {
    proximoStatus: StatusAplicacao.PORTOES_FECHADOS,
    label: '2 - Fechar Portões'
  },
  [StatusAplicacao.PORTOES_FECHADOS]: {
    proximoStatus: StatusAplicacao.PROVAS_INICIADAS,
    label: '3 - Iniciar Provas'
  },
  [StatusAplicacao.PROVAS_INICIADAS]: {
    proximoStatus: StatusAplicacao.PROVAS_ENCERRADAS,
    label: '4 - Encerrar Provas'
  },
  [StatusAplicacao.PROVAS_ENCERRADAS]: null
};