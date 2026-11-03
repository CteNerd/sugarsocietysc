import type { QueryResultRow } from 'pg';

export interface SqlResult<Row extends QueryResultRow = QueryResultRow> {
  rows: Row[];
  rowCount: number | null;
}

export interface SqlClient {
  query<Row extends QueryResultRow = QueryResultRow>(sql: string, values?: unknown[]): Promise<SqlResult<Row>>;
}

export interface SqlConnection extends SqlClient {
  release(): void | Promise<void>;
}

export interface SqlDatabase extends SqlClient {
  connect(): Promise<SqlConnection>;
  end(): Promise<void>;
}
