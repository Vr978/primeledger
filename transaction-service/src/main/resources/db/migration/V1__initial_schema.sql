-- Transaction table
CREATE TABLE IF NOT EXISTS transaction (
    id BIGSERIAL PRIMARY KEY,
    account_id BIGINT NOT NULL,
    amount NUMERIC(19, 4) NOT NULL,
    type VARCHAR(50) NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'OTHER',
    description VARCHAR(500),
    counterparty_account_number VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transaction_account_id ON transaction(account_id);
CREATE INDEX IF NOT EXISTS idx_transaction_created_at ON transaction(created_at);
CREATE INDEX IF NOT EXISTS idx_transaction_type ON transaction(type);
