
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- CUSTOMERS
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- VPS PLANS
CREATE TABLE IF NOT EXISTS plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    ram_gb INTEGER NOT NULL,
    storage_gb INTEGER NOT NULL,
    cpu_cores INTEGER NOT NULL,
    price NUMERIC(12,2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

-- CUSTOMER ORDERS
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id),
    plan_id UUID NOT NULL REFERENCES plans(id),
    amount NUMERIC(12,2) NOT NULL,
    status VARCHAR(30) DEFAULT 'pending'
        CHECK (status IN ('pending', 'paid', 'failed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PAYMENTS
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id),
    provider VARCHAR(50) NOT NULL,
    provider_reference VARCHAR(150) UNIQUE,
    amount NUMERIC(12,2) NOT NULL,
    status VARCHAR(30) DEFAULT 'pending'
        CHECK (status IN ('pending', 'successful', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- VPS SERVERS
CREATE TABLE IF NOT EXISTS vps_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id),
    order_id UUID UNIQUE NOT NULL REFERENCES orders(id),
    aws_instance_id VARCHAR(100) UNIQUE,
    public_ip VARCHAR(45),
    region VARCHAR(50),
    status VARCHAR(30) DEFAULT 'creating'
        CHECK (status IN ('creating', 'running', 'stopped', 'terminated', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_orders_customer
ON orders(customer_id);

CREATE INDEX IF NOT EXISTS idx_payments_order
ON payments(order_id);

CREATE INDEX IF NOT EXISTS idx_vps_customer
ON vps_instances(customer_id);
