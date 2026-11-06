import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

// Idempotent schema creation — safe to run on every startup
export async function ensureSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY, uid TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL DEFAULT '',
      role_code TEXT NOT NULL DEFAULT 'STAFF', department_id INTEGER,
      is_active BOOLEAN NOT NULL DEFAULT TRUE, is_demo BOOLEAN NOT NULL DEFAULT FALSE,
      last_login_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS roles (
      id SERIAL PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      description TEXT NOT NULL, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS permissions (
      id SERIAL PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      module TEXT NOT NULL, role_codes TEXT NOT NULL, created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS user_roles (
      id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, role_id INTEGER NOT NULL,
      assigned_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS departments (
      id SERIAL PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      description TEXT NOT NULL, is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS letter_types (
      id SERIAL PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      allowed_categories TEXT NOT NULL, description TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS letter_classifications (
      id SERIAL PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      confidentiality_level TEXT NOT NULL, description TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS numbering_rules (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL,
      format_template TEXT NOT NULL, scope_type TEXT NOT NULL, reset_period TEXT NOT NULL,
      digit_padding INTEGER NOT NULL DEFAULT 3, separator TEXT NOT NULL DEFAULT '/',
      date_source TEXT NOT NULL DEFAULT 'LETTER_DATE', is_active BOOLEAN NOT NULL DEFAULT TRUE,
      effective_date TEXT NOT NULL, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS numbering_counters (
      id SERIAL PRIMARY KEY, counter_key TEXT NOT NULL UNIQUE, rule_id INTEGER NOT NULL,
      scope_key TEXT NOT NULL, period_year INTEGER NOT NULL, period_month INTEGER NOT NULL,
      last_sequence INTEGER NOT NULL DEFAULT 0, updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS letters (
      id SERIAL PRIMARY KEY, letter_code TEXT NOT NULL UNIQUE, category TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'DRAFT', official_number TEXT UNIQUE,
      external_original_number TEXT, letter_type_id INTEGER NOT NULL,
      department_id INTEGER NOT NULL, classification_id INTEGER NOT NULL,
      letter_date TEXT NOT NULL, registration_date TEXT NOT NULL,
      subject TEXT NOT NULL, sender TEXT NOT NULL, recipient TEXT NOT NULL,
      destination TEXT NOT NULL, summary TEXT NOT NULL, admin_notes TEXT NOT NULL DEFAULT '',
      numbering_rule_id INTEGER, sequence_number INTEGER, numbering_components_json TEXT,
      cancelled_at TIMESTAMP, cancelled_by TEXT, cancellation_reason TEXT,
      created_by_uid TEXT NOT NULL, created_by_name TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS letter_attachments (
      id SERIAL PRIMARY KEY, letter_id INTEGER NOT NULL, file_name TEXT NOT NULL,
      stored_name TEXT NOT NULL, mime_type TEXT NOT NULL, file_size INTEGER NOT NULL,
      uploaded_by_name TEXT NOT NULL, created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY, user_uid TEXT NOT NULL, user_name TEXT NOT NULL,
      user_role TEXT NOT NULL, action TEXT NOT NULL, entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL, description TEXT NOT NULL,
      before_value_json TEXT, after_value_json TEXT, reason TEXT, metadata_json TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS company_settings (
      id SERIAL PRIMARY KEY, company_name TEXT NOT NULL, company_code TEXT NOT NULL,
      logo_url TEXT NOT NULL DEFAULT '', address TEXT NOT NULL, phone TEXT NOT NULL,
      email TEXT NOT NULL, website TEXT NOT NULL, npwp_or_reg_number TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);
}

declare global {
  var _postgresPool: Pool | undefined;
}

export const createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: parseInt(process.env.DB_POOL_MAX || '10'),
      connectionTimeoutMillis: 15000,
      idleTimeoutMillis: 30000,
    });

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

export const pool = createPool();
export const db = drizzle(pool, { schema });
