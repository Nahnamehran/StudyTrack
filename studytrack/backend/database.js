const initSqlJs = require("sql.js");
const path = require("path");
const fs = require("fs");

const DB_PATH = path.join(__dirname, "studytrack.db");

let db;

async function getDb() {
  if (db) return db;

  const SQL = await initSqlJs();

  // Load existing DB file if it exists, otherwise create fresh
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT    NOT NULL,
      subject     TEXT    NOT NULL,
      deadline    TEXT    NOT NULL,
      priority    TEXT    NOT NULL DEFAULT 'Medium',
      category    TEXT    NOT NULL DEFAULT 'Assignment',
      completed   INTEGER NOT NULL DEFAULT 0,
      completedAt TEXT
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS exam (
      id      INTEGER PRIMARY KEY CHECK (id = 1),
      subject TEXT    NOT NULL DEFAULT '',
      date    TEXT    NOT NULL DEFAULT ''
    );
  `);

  // Seed the single exam row
  db.run(`INSERT OR IGNORE INTO exam (id, subject, date) VALUES (1, '', '')`);

  save();
  return db;
}

// Persist in-memory DB back to disk after every write
function save() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

module.exports = { getDb, save };
