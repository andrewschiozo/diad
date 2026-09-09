import { createPool } from 'mysql2/promise';
import type { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import {
  DatabasePort,
  LocalAplicacaoRecord,
  RegistrarEventoDTO,
  EstatisticasConcursoDTO
} from '../ports/DatabasePort.js';
import { StatusAplicacao } from '../domain/StatusAplicacao.js';

export interface MysqlConfig {
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
  connectionLimit?: number;
}

export class MysqlAdapter implements DatabasePort {
  private pool: Pool | null = null;

  constructor(private readonly config: MysqlConfig) {}

  async connect(): Promise<void> {
    if (!this.pool) {
      this.pool = createPool({
        host: this.config.host,
        port: this.config.port,
        user: this.config.user,
        password: this.config.password,
        database: this.config.database,
        waitForConnections: true,
        connectionLimit: this.config.connectionLimit ?? 20,
        queueLimit: 0,
        timezone: '+00:00',
        dateStrings: false
      });

      const conexao: PoolConnection = await this.pool.getConnection();
      conexao.release();
    }
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  private obterPool(): Pool {
    if (!this.pool) {
      throw new Error('MysqlAdapter não está conectado. Execute conectar() antes.');
    }
    return this.pool;
  }

  async buscarPorToken(tokenAcesso: string): Promise<LocalAplicacaoRecord | null> {
    const pool = this.obterPool();
    const query = `
      SELECT id, concurso_id, codigo_escola, nome_escola, token_acesso, senha_hash, status_atual, updated_at, created_at
      FROM locais_aplicacao
      WHERE token_acesso = ?
      LIMIT 1
    `;

    const [rows] = (await pool.query(query, [tokenAcesso])) as unknown as [RowDataPacket[], unknown];

    if (!rows.length) {
      return null;
    }

    return this.mapearLinhaParaRecord(rows[0]);
  }

  async buscarPorId(id: number): Promise<LocalAplicacaoRecord | null> {
    const pool = this.obterPool();
    const query = `
      SELECT id, concurso_id, codigo_escola, nome_escola, token_acesso, senha_hash, status_atual, updated_at, created_at
      FROM locais_aplicacao
      WHERE id = ?
      LIMIT 1
    `;

    const [rows] = (await pool.query(query, [id])) as unknown as [RowDataPacket[], unknown];

    if (!rows.length) {
      return null;
    }

    return this.mapearLinhaParaRecord(rows[0]);
  }

  async atualizarStatusTransacao(
    localAplicacaoId: number,
    statusNovo: StatusAplicacao,
    evento: RegistrarEventoDTO
  ): Promise<void> {
    const pool = this.obterPool();
    const conexao: PoolConnection = await pool.getConnection();

    try {
      await conexao.beginTransaction();

      const updateQuery = `
        UPDATE locais_aplicacao
        SET status_atual = ?, updated_at = UTC_TIMESTAMP()
        WHERE id = ?
      `;
      await conexao.query(updateQuery, [statusNovo, localAplicacaoId]);

      const insertQuery = `
        INSERT INTO eventos_aplicacao (
          local_aplicacao_id,
          status_anterior,
          status_novo,
          registrado_em,
          ip_origem,
          user_agent
        ) VALUES (?, ?, ?, ?, ?, ?)
      `;
      await conexao.query(insertQuery, [
        evento.localAplicacaoId,
        evento.statusAnterior,
        evento.statusNovo,
        evento.registradoEm,
        evento.ipOrigem ?? null,
        evento.userAgent ?? null
      ]);

      await conexao.commit();
    } catch (erro) {
      await conexao.rollback();
      throw erro;
    } finally {
      conexao.release();
    }
  }

  async obterEstatisticasConcurso(concursoCodigo: string): Promise<EstatisticasConcursoDTO | null> {
    const pool = this.obterPool();

    const query = `
      SELECT l.status_atual, COUNT(l.id) as total
      FROM locais_aplicacao l
      INNER JOIN concursos c ON c.id = l.concurso_id
      WHERE c.codigo = ?
      GROUP BY l.status_atual
    `;

    const [rows] = (await pool.query(query, [concursoCodigo])) as unknown as [RowDataPacket[], unknown];

    const totalPorStatus: Record<StatusAplicacao, number> = {
      [StatusAplicacao.AGUARDANDO_ABERTURA]: 0,
      [StatusAplicacao.PORTOES_ABERTOS]: 0,
      [StatusAplicacao.PORTOES_FECHADOS]: 0,
      [StatusAplicacao.PROVAS_INICIADAS]: 0,
      [StatusAplicacao.PROVAS_ENCERRADAS]: 0
    };

    let totalLocais = 0;

    for (const row of rows) {
      const status = row.status_atual as StatusAplicacao;
      const qtd = Number(row.total);
      totalPorStatus[status] = qtd;
      totalLocais += qtd;
    }

    if (totalLocais === 0 && rows.length === 0) {
      const [concursoRows] = (await pool.query(
        'SELECT id FROM concursos WHERE codigo = ? LIMIT 1',
        [concursoCodigo]
      )) as unknown as [RowDataPacket[], unknown];

      if (!concursoRows.length) return null;
    }

    return {
      concursoCodigo,
      totalLocais,
      totalPorStatus
    };
  }

  async listarLocaisPorConcurso(concursoCodigo: string): Promise<LocalAplicacaoRecord[]> {
    const pool = this.obterPool();
    const query = `
      SELECT l.id, l.concurso_id, l.codigo_escola, l.nome_escola, l.token_acesso, l.senha_hash, l.status_atual, l.updated_at, l.created_at
      FROM locais_aplicacao l
      INNER JOIN concursos c ON c.id = l.concurso_id
      WHERE c.codigo = ?
      ORDER BY l.codigo_escola ASC
    `;

    const [rows] = (await pool.query(query, [concursoCodigo])) as unknown as [RowDataPacket[], unknown];
    return rows.map((linha) => this.mapearLinhaParaRecord(linha));
  }

  private mapearLinhaParaRecord(linha: RowDataPacket): LocalAplicacaoRecord {
    return {
      id: Number(linha.id),
      concursoId: Number(linha.concurso_id),
      codigoEscola: String(linha.codigo_escola),
      nomeEscola: String(linha.nome_escola),
      tokenAcesso: String(linha.token_acesso),
      senhaHash: String(linha.senha_hash),
      statusAtual: Number(linha.status_atual) as StatusAplicacao,
      updatedAt: new Date(linha.updated_at),
      createdAt: new Date(linha.created_at)
    };
  }
}