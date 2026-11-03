import {
  BeginTransactionCommand, CommitTransactionCommand, ExecuteStatementCommand,
  RollbackTransactionCommand, RDSDataClient,
  type ColumnMetadata, type ExecuteStatementCommandOutput, type Field, type SqlParameter,
} from '@aws-sdk/client-rds-data';
import { types, type QueryResultRow } from 'pg';
import { SqlConnection, SqlDatabase, SqlResult } from '../../ports/database/ISqlDatabase';
import { namedParameters, splitStatements } from './sql-statements';

export interface DataApiConfig {
  resourceArn: string;
  secretArn: string;
  database: string;
}

const oids: Record<string, number> = {
  bool: 16, boolean: 16, int2: 21, smallint: 21, int4: 23, integer: 23,
  int8: 20, bigint: 20, float4: 700, real: 700, float8: 701,
  numeric: 1700, decimal: 1700, date: 1082, timestamp: 1114, timestamptz: 1184,
  json: 114, jsonb: 3802, _text: 1009, _uuid: 2951, _int4: 1007,
};

function fieldValue(field: Field): unknown {
  if (field.isNull) return null;
  if (field.stringValue !== undefined) return field.stringValue;
  if (field.longValue !== undefined) return field.longValue;
  if (field.doubleValue !== undefined) return field.doubleValue;
  if (field.booleanValue !== undefined) return field.booleanValue;
  if (field.blobValue !== undefined) return Buffer.from(field.blobValue);
  if (field.arrayValue) {
    const array = field.arrayValue;
    if (array.stringValues) return array.stringValues;
    if (array.longValues) return array.longValues;
    if (array.doubleValues) return array.doubleValues;
    if (array.booleanValues) return array.booleanValues;
    if (array.arrayValues) return array.arrayValues.map((value) => value === null ? null : fieldValue({ arrayValue: value }));
  }
  throw new Error('Unsupported Data API result field');
}

function decode(field: Field, metadata: ColumnMetadata): unknown {
  const value = fieldValue(field);
  if (value === null) return null;
  const oid = oids[metadata.typeName?.toLowerCase() ?? ''];
  if (Array.isArray(value)) return value;
  if (oid && (typeof value === 'string' || typeof value === 'number')) {
    const text = String(value);
    const timestamp = oid === 1184 && !/(?:Z|[+-]\d\d(?::?\d\d)?)$/.test(text) ? `${text}+00` : text;
    return types.getTypeParser(oid)(timestamp);
  }
  return value;
}

function parameter(index: number, value: unknown): SqlParameter {
  const name = `p${index + 1}`;
  if (value === null || value === undefined) return { name, value: { isNull: true } };
  if (typeof value === 'boolean') return { name, value: { booleanValue: value } };
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Non-finite SQL parameter');
    return { name, value: Number.isSafeInteger(value) ? { longValue: value } : { doubleValue: value } };
  }
  if (value instanceof Date) {
    return { name, value: { stringValue: value.toISOString() } };
  }
  if (Buffer.isBuffer(value)) return { name, value: { blobValue: value } };
  if (Array.isArray(value)) {
    if (!value.every((item) => typeof item === 'string')) throw new Error('Only string array SQL parameters are supported');
    const encoded = `{${value.map((item: string) => `"${item.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(',')}}`;
    return { name, value: { stringValue: encoded } };
  }
  if (typeof value === 'string') return { name, value: { stringValue: value } };
  throw new Error('Unsupported SQL parameter type');
}

export class DataApiDatabase implements SqlDatabase {
  constructor(
    private readonly config: DataApiConfig,
    private readonly client = new RDSDataClient({ maxAttempts: 1 }),
  ) {}

  // Only a resume rejection guarantees execution did not happen. SDK retries are disabled
  // so network failures and ambiguous commits never silently replay a database write.
  private async resume<T>(operation: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      try { return await operation(); }
      catch (error) {
        if (!(error instanceof Error) || error.name !== 'DatabaseResumingException' || attempt >= 5) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  async execute<Row extends QueryResultRow>(
    sql: string, values: unknown[] = [], transactionId?: string,
  ): Promise<SqlResult<Row>> {
    const statements = splitStatements(sql);
    if (statements.length !== 1) throw new Error('Database queries must contain exactly one SQL statement');
    const mapped = namedParameters(statements[0], values.length);
    const result = await this.resume(() => this.client.send(new ExecuteStatementCommand({
      ...this.config, sql: mapped.sql,
      parameters: mapped.used.map((index) => parameter(index, values[index])),
      transactionId, includeResultMetadata: true,
      resultSetOptions: { longReturnType: 'STRING', decimalReturnType: 'STRING' },
    })));
    return this.result<Row>(result);
  }

  private result<Row extends QueryResultRow>(result: ExecuteStatementCommandOutput): SqlResult<Row> {
    const metadata = result.columnMetadata ?? [];
    const rows = (result.records ?? []).map((record) => {
      if (record.length !== metadata.length) throw new Error('Data API result metadata is incomplete');
      const row: QueryResultRow = {};
      record.forEach((field, index) => {
        const column = metadata[index];
        const name = column.label ?? column.name;
        if (!name) throw new Error('Data API column name is missing');
        row[name] = decode(field, column);
      });
      return row as Row;
    });
    return { rows, rowCount: rows.length || result.numberOfRecordsUpdated || 0 };
  }

  query<Row extends QueryResultRow = QueryResultRow>(sql: string, values?: unknown[]): Promise<SqlResult<Row>> {
    return this.execute<Row>(sql, values);
  }

  async connect(): Promise<SqlConnection> {
    let transactionId: string | undefined;
    let released = false;
    let tail: Promise<unknown> = Promise.resolve();
    const enqueue = <T>(work: () => Promise<T>): Promise<T> => {
      const result = tail.then(work);
      tail = result.then(() => undefined, () => undefined);
      return result;
    };
    return {
      query: <Row extends QueryResultRow = QueryResultRow>(sql: string, values?: unknown[]) => enqueue(async () => {
        if (released) throw new Error('Database connection has been released');
        const command = sql.trim().replace(/;$/, '').toUpperCase();
        if (command === 'BEGIN') {
          if (transactionId) throw new Error('Transaction already started');
          const result = await this.resume(() => this.client.send(new BeginTransactionCommand(this.config)));
          if (!result.transactionId) throw new Error('Data API transaction ID is missing');
          transactionId = result.transactionId;
          return { rows: [], rowCount: 0 };
        }
        if (command === 'COMMIT' || command === 'ROLLBACK') {
          // Like PostgreSQL, rollback without an active transaction is harmless. In
          // particular it must not mask a commit failure whose outcome is unknown.
          if (!transactionId && command === 'ROLLBACK') return { rows: [], rowCount: 0 };
          if (!transactionId) throw new Error('No active database transaction');
          const id = transactionId;
          if (command === 'COMMIT') {
            // Clear before committing: a failed response does not prove rollback is safe.
            transactionId = undefined;
            await this.client.send(new CommitTransactionCommand({ ...this.config, transactionId: id }));
          } else {
            transactionId = undefined;
            await this.client.send(new RollbackTransactionCommand({ ...this.config, transactionId: id }));
          }
          return { rows: [], rowCount: 0 };
        }
        return this.execute<Row>(sql, values, transactionId);
      }),
      release: () => enqueue(async () => {
        released = true;
        if (transactionId) {
          const id = transactionId;
          transactionId = undefined;
          await this.client.send(new RollbackTransactionCommand({ ...this.config, transactionId: id }));
        }
      }),
    };
  }

  async end(): Promise<void> {
    this.client.destroy();
  }
}
