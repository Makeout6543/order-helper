import initSqlJs, { type Database as SqlJsDatabase } from "sql.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "..", "data.db");

let _db: SqlJsDatabase | null = null;
let _inTransaction = false;

async function getRawDb(): Promise<SqlJsDatabase> {
  if (_db) return _db;
  const SQL = await initSqlJs();
  if (fs.existsSync(dbPath)) {
    _db = new SQL.Database(fs.readFileSync(dbPath));
  } else {
    _db = new SQL.Database();
  }
  return _db;
}

export function saveDB() {
  if (_db) {
    fs.writeFileSync(dbPath, Buffer.from(_db.export()));
  }
}

class Statement {
  constructor(private db: SqlJsDatabase, private sql: string) {}

  run(...params: any[]): { changes: number; lastInsertRowid: number } {
    const sql = this.bindParams(params);
    this.db.run(sql);
    const r = this.db.exec("SELECT last_insert_rowid() as id");
    const rowid = r[0]?.values[0]?.[0] as number ?? 0;
    const changes = this.db.getRowsModified();
    if (!_inTransaction) saveDB();
    return { changes, lastInsertRowid: rowid };
  }

  get(...params: any[]): any {
    const stmt = this.db.prepare(this.bindParams(params));
    const row = stmt.step() ? stmt.getAsObject() : undefined;
    stmt.free();
    return row;
  }

  all(...params: any[]): any[] {
    const stmt = this.db.prepare(this.bindParams(params));
    const rows: any[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  }

  private bindParams(params: any[]): string {
    let sql = this.sql;
    for (const p of params) {
      const v = p === null ? "NULL"
        : typeof p === "number" ? String(p)
        : typeof p === "boolean" ? (p ? "1" : "0")
        : `'${String(p).replace(/'/g, "''")}'`;
      sql = sql.replace("?", v);
    }
    return sql;
  }
}

class DB {
  async init() { await getRawDb(); }

  prepare(sql: string) { return new Statement(_db!, sql); }

  exec(sql: string) { _db!.run(sql); saveDB(); }

  transaction(fn: () => void) {
    return () => {
      _inTransaction = true;
      try {
        _db!.run("BEGIN");
        fn();
        _db!.run("COMMIT");
        _inTransaction = false;
        saveDB();
      } catch (e) {
        try { _db!.run("ROLLBACK"); } catch {}
        _inTransaction = false;
        throw e;
      }
    };
  }
}

const db = new DB();

export async function initDB() {
  await db.init();
  db.exec(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      spec TEXT DEFAULT '',
      unit TEXT NOT NULL DEFAULT '斤',
      price REAL DEFAULT 0,
      sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER NOT NULL,
      supplier_name TEXT NOT NULL,
      items TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

export async function getDB() { if (!_db) await db.init(); return db; }
export default db;
