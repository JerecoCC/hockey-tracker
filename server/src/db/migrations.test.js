const { ensureMigrationLedger } = require('./migrations');

describe('ensureMigrationLedger', () => {
  it('creates the one-time migration ledger idempotently', async () => {
    const sql = jest.fn().mockResolvedValue([]);

    await ensureMigrationLedger(sql);

    expect(sql).toHaveBeenCalledTimes(1);
    const [strings] = sql.mock.calls[0];
    expect(strings.join(' ')).toContain('CREATE TABLE IF NOT EXISTS _migrations');
    expect(strings.join(' ')).toContain('name       TEXT PRIMARY KEY');
  });
});
