import { Pool, PoolClient, QueryResult } from 'pg';

/**
 * PostgreSQL connection management
 * Handles connection pooling and lifecycle
 */
export class PostgresConnection {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  async connect(): Promise<void> {
    try {
      const client = await this.pool.connect();
      client.release();
      console.log('PostgreSQL connection established');
    } catch (error) {
      console.error('Failed to connect to PostgreSQL', error);
      throw error;
    }
  }

  async query<T = unknown>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
    return this.pool.query(sql, params);
  }

  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  async close(): Promise<void> {
    await this.pool.end();
    console.log('PostgreSQL connection pool closed');
  }

  getPool(): Pool {
    return this.pool;
  }
}
