import Database from "better-sqlite3";
const db = new Database("./mydata.db");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name  TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS products (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name  TEXT NOT NULL,
    price REAL NOT NULL
  );
`);
// Seed some data
const insert = db.prepare("INSERT INTO users (name, email) VALUES (?, ?)");
insert.run("Alice", "alice@example.com");
insert.run("Bob", "bob@example.com");
console.log("Database ready!");
db.close();
