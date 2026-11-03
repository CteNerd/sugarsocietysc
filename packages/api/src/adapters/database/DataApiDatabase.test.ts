import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BeginTransactionCommand, CommitTransactionCommand, ExecuteStatementCommand,
  RDSDataClient, RollbackTransactionCommand,
} from '@aws-sdk/client-rds-data';
import { DataApiDatabase } from './DataApiDatabase';
import { namedParameters, splitStatements } from './sql-statements';

const config = { resourceArn: 'cluster', secretArn: 'secret', database: 'test' };

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('SQL transport', () => {
  it('maps positional parameters without touching strings, comments or dollar quotes', () => {
    const sql = `SELECT $1::uuid, '$2', "$3", $$ $4; $$, $tag$ $5; $tag$, $1 -- $6\n/* $7 /* nested */ */`;
    expect(namedParameters(sql, 1)).toEqual({
      sql: `SELECT :p1::uuid, '$2', "$3", $$ $4; $$, $tag$ $5; $tag$, :p1 -- $6\n/* $7 /* nested */ */`,
      used: [0],
    });
    expect(() => namedParameters('SELECT $0', 1)).toThrow('out of range');
    expect(() => namedParameters('SELECT $2', 1)).toThrow('out of range');
    expect(namedParameters('SELECT data$2, $1', 1).sql).toBe('SELECT data$2, :p1');
  });

  it('splits migration statements without splitting quoted function bodies', () => {
    expect(splitStatements(`SELECT ';'; DO $$ BEGIN PERFORM 1; END $$; /* ; */ SELECT 2;`))
      .toEqual([`SELECT ';'`, 'DO $$ BEGIN PERFORM 1; END $$', '/* ; */ SELECT 2']);
    expect(() => splitStatements(`SELECT 'unfinished`)).toThrow('Unterminated');
    expect(() => splitStatements('/* unfinished')).toThrow('Unterminated');
    expect(splitStatements(String.raw`SELECT E'quote\'; $1', $1; SELECT 2;`))
      .toEqual([String.raw`SELECT E'quote\'; $1', $1`, 'SELECT 2']);
  });

  it('preserves PostgreSQL scalar, date, JSON and array result shapes', async () => {
    const client = new RDSDataClient({ maxAttempts: 1 });
    vi.spyOn(client, 'send').mockImplementation(async () => ({
      $metadata: {},
      columnMetadata: [
        { name: 'amount', typeName: 'int4' }, { name: 'count', typeName: 'int8' },
        { name: 'created_at', typeName: 'timestamptz' }, { name: 'colors', typeName: '_text' },
        { name: 'details', typeName: 'jsonb' }, { name: 'price', typeName: 'numeric' },
      ],
      records: [[
        { stringValue: '1400' }, { stringValue: '9007199254740993' },
        { stringValue: '2026-11-02 03:00:00' }, { arrayValue: { stringValues: ['red', 'blue'] } },
        { stringValue: '{"safe":true}' }, { stringValue: '12.50' },
      ]],
    }));
    const result = await new DataApiDatabase(config, client).query('SELECT 1');
    expect(result).toEqual({ rowCount: 1, rows: [{
      amount: 1400, count: '9007199254740993', created_at: new Date('2026-11-02T03:00:00Z'),
      colors: ['red', 'blue'], details: { safe: true }, price: '12.50',
    }] });
  });

  it('binds values rather than interpolating SQL, including string arrays', async () => {
    const client = new RDSDataClient({ maxAttempts: 1 });
    const send = vi.spyOn(client, 'send').mockImplementation(async () => ({ $metadata: {}, numberOfRecordsUpdated: 2 }));
    const db = new DataApiDatabase(config, client);
    const hostile = `'); DROP TABLE orders; --`;
    expect(await db.query('UPDATE cookies SET name=$1, colors=$2::text[]', [hostile, ['a,b', 'a"b', 'a\\b']]))
      .toEqual({ rows: [], rowCount: 2 });
    const command = send.mock.calls[0][0];
    expect(command).toBeInstanceOf(ExecuteStatementCommand);
    if (!(command instanceof ExecuteStatementCommand)) throw new Error('Unexpected command');
    expect(command.input.sql).toBe('UPDATE cookies SET name=:p1, colors=:p2::text[]');
    expect(command.input.parameters).toEqual([
      { name: 'p1', value: { stringValue: hostile } },
      { name: 'p2', value: { stringValue: '{"a,b","a\\"b","a\\\\b"}' } },
    ]);
    await expect(db.query('SELECT 1; SELECT 2')).rejects.toThrow('exactly one');
  });

  it('serializes concurrent transaction calls and uses the same transaction ID', async () => {
    const client = new RDSDataClient({ maxAttempts: 1 });
    let active = 0;
    let peak = 0;
    const send = vi.spyOn(client, 'send').mockImplementation(async (command) => {
      if (command instanceof BeginTransactionCommand) return { $metadata: {}, transactionId: 'txn' };
      if (command instanceof ExecuteStatementCommand) {
        expect(command.input.transactionId).toBe('txn');
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
      }
      return { $metadata: {} };
    });
    const connection = await new DataApiDatabase(config, client).connect();
    await connection.query('BEGIN');
    await Promise.all([connection.query('SELECT 1'), connection.query('SELECT 2')]);
    await connection.query('COMMIT');
    await connection.release();
    expect(peak).toBe(1);
    expect(send.mock.calls.filter(([command]) => command instanceof CommitTransactionCommand)).toHaveLength(1);
    await expect(connection.query('SELECT 1')).rejects.toThrow('released');
  });

  it('never retries ambiguous writes or commits and does not mask their error with rollback', async () => {
    const client = new RDSDataClient({ maxAttempts: 1 });
    const failure = new Error('Connection lost after commit');
    const send = vi.spyOn(client, 'send').mockImplementation(async (command) => {
      if (command instanceof BeginTransactionCommand) return { $metadata: {}, transactionId: 'txn' };
      throw failure;
    });
    const db = new DataApiDatabase(config, client);
    await expect(db.query('UPDATE orders SET total=1')).rejects.toBe(failure);
    const connection = await db.connect();
    await connection.query('BEGIN');
    await expect(connection.query('COMMIT')).rejects.toBe(failure);
    await connection.query('ROLLBACK');
    await connection.release();
    expect(send.mock.calls.filter(([command]) => command instanceof CommitTransactionCommand)).toHaveLength(1);
    expect(send.mock.calls.filter(([command]) => command instanceof RollbackTransactionCommand)).toHaveLength(0);
    expect(send.mock.calls.filter(([command]) => command instanceof ExecuteStatementCommand)).toHaveLength(1);
  });

  it('rolls back an uncommitted transaction when released', async () => {
    const client = new RDSDataClient({ maxAttempts: 1 });
    const send = vi.spyOn(client, 'send').mockImplementation(async () => ({ $metadata: {}, transactionId: 'txn' }));
    const connection = await new DataApiDatabase(config, client).connect();
    await connection.query('BEGIN');
    await connection.release();
    expect(send.mock.calls.at(-1)?.[0]).toBeInstanceOf(RollbackTransactionCommand);
  });

  it('retries only explicit resume rejections and caps the total wait at 15 seconds', async () => {
    vi.useFakeTimers();
    const client = new RDSDataClient({ maxAttempts: 1 });
    const resuming = Object.assign(new Error('Resuming'), { name: 'DatabaseResumingException' });
    let attempts = 0;
    const send = vi.spyOn(client, 'send').mockImplementation(async () => {
      if (++attempts === 1) throw resuming;
      return { $metadata: {}, numberOfRecordsUpdated: 1 };
    });
    const db = new DataApiDatabase(config, client);
    const query = db.query('UPDATE orders SET total=1');
    await vi.advanceTimersByTimeAsync(1000);
    expect(await query).toEqual({ rows: [], rowCount: 1 });
    expect(send).toHaveBeenCalledTimes(2);
    send.mockImplementation(async () => { throw resuming; });
    const rejected = expect(db.query('SELECT 1')).rejects.toBe(resuming);
    await vi.advanceTimersByTimeAsync(15000);
    await rejected;
    expect(send).toHaveBeenCalledTimes(8);
  });

  it('rejects unsupported inputs and malformed responses explicitly', async () => {
    const client = new RDSDataClient({ maxAttempts: 1 });
    const send = vi.spyOn(client, 'send').mockImplementation(async () => ({
      $metadata: {}, records: [[{ stringValue: 'missing column metadata' }]],
    }));
    const db = new DataApiDatabase(config, client);
    for (const value of [Infinity, [1], { object: true }]) {
      await expect(db.query('SELECT $1', [value])).rejects.toThrow();
    }
    expect(send).not.toHaveBeenCalled();
    await expect(db.query('SELECT 1')).rejects.toThrow('metadata is incomplete');
  });
});
