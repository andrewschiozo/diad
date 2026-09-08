CREATE DATABASE IF NOT EXISTS diad_concursos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE diad_concursos;

-- Concursos ativos
CREATE TABLE IF NOT EXISTS concursos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(64) NOT NULL UNIQUE,
    nome VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Locais de prova
CREATE TABLE IF NOT EXISTS locais_aplicacao (
    id INT AUTO_INCREMENT PRIMARY KEY,
    concurso_id INT NOT NULL,
    codigo_escola VARCHAR(64) NOT NULL,
    nome_escola VARCHAR(255) NOT NULL,
    token_acesso VARCHAR(128) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    
    -- 0 AGUARDANDO
    -- 1 PORTOES_ABERTOS
    -- 2 PORTOES_FECHADOS
    -- 3 PROVAS_INICIADAS
    -- 4 PROVAS_ENCERRADAS
    status_atual TINYINT UNSIGNED NOT NULL DEFAULT 0,
    
    horario_abertura_portao DATETIME NULL,
    horario_fechamento_portao DATETIME NULL,
    horario_inicio_prova DATETIME NULL,
    horario_termino_prova DATETIME NULL,
    
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (concurso_id) REFERENCES concursos(id) ON DELETE CASCADE,
    UNIQUE KEY uq_concurso_escola (concurso_id, codigo_escola),
    INDEX idx_token_lookup (token_acesso),
    INDEX idx_dashboard_status (concurso_id, status_atual)
) ENGINE=InnoDB;

-- Auditoria (event sourcing simplificado)
CREATE TABLE IF NOT EXISTS eventos_aplicacao (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    local_aplicacao_id INT NOT NULL,
    status_anterior TINYINT UNSIGNED NOT NULL,
    status_novo TINYINT UNSIGNED NOT NULL,
    registrado_em DATETIME NOT NULL,
    ip_origem VARCHAR(45) NULL,
    user_agent VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (local_aplicacao_id) REFERENCES locais_aplicacao(id) ON DELETE CASCADE,
    INDEX idx_auditoria_local (local_aplicacao_id, created_at)
) ENGINE=InnoDB;

-- Seed inicial para testes
INSERT INTO concursos (codigo, nome) 
VALUES ('CNU-2026', 'Concurso Nacional Unificado 2026')
ON DUPLICATE KEY UPDATE nome=VALUES(nome);

-- Senha padrão do seed: 'coordenador123' (hash bcrypt)
INSERT INTO locais_aplicacao (concurso_id, codigo_escola, nome_escola, token_acesso, senha_hash, status_atual)
VALUES 
(1, 'ESC-SP-001', 'E.E. Maria Zélia - Sala Central', 'tok_sp_001_abc', '$2b$10$wT0XlTfJm7r5s1f6d9y7veVnK9A2iN6E2m6p4K1y8T7h3s2d1f4g', 0),
(1, 'ESC-RJ-002', 'Colégio Estadual Pedro II', 'tok_rj_002_def', '$2b$10$wT0XlTfJm7r5s1f6d9y7veVnK9A2iN6E2m6p4K1y8T7h3s2d1f4g', 0)
ON DUPLICATE KEY UPDATE token_acesso=VALUES(token_acesso);