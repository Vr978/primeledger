-- Users table (email-based auth)
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'USER',
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Wallet/Account table
CREATE TABLE IF NOT EXISTS account (
    id BIGSERIAL PRIMARY KEY,
    account_number VARCHAR(20) NOT NULL UNIQUE,
    owner_name VARCHAR(255),
    account_type VARCHAR(20) NOT NULL DEFAULT 'CHECKING',
    balance NUMERIC(19, 4) NOT NULL DEFAULT 0.0000,
    user_id BIGINT NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_user_id ON account(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_account_number ON account(account_number);

-- Refresh tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id BIGSERIAL PRIMARY KEY,
    token VARCHAR(255) NOT NULL UNIQUE,
    user_id BIGINT NOT NULL,
    expiry_date TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_token_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_token_expiry ON refresh_tokens(expiry_date);

-- Seed admin user (password: admin123 bcrypt-encoded)
INSERT INTO users (name, email, password, role, email_verified, created_at, updated_at)
VALUES ('PrimeLedger Admin', 'admin@primeledger.com', '$2b$12$SQ9eFXxtEGHnHIEF/ywd0ucmtlTfA8LY3mLuHoLp.FaVU8Nrcrkou', 'ADMIN', true, NOW(), NOW())
ON CONFLICT (email) DO NOTHING;

-- Seed admin wallet
INSERT INTO account (account_number, owner_name, account_type, balance, user_id, version, created_at, updated_at)
SELECT 'PL-2026-000001', 'PrimeLedger Admin', 'CHECKING', 10000.0000, id, 0, NOW(), NOW()
FROM users WHERE email = 'admin@primeledger.com'
ON CONFLICT (account_number) DO NOTHING;
