import SQLite from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import { DB } from './db-schema.js';
import path from 'path';
import fs from 'fs'; // Import the file system module

// Define the directory path for the database
const dataDir = path.join(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'database.sqlite');

// --- NEW CODE ---
// This will automatically create the 'data' folder if it doesn't exist.
// This is the key fix for the problem you are facing.
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log(`Created data directory at: ${dataDir}`);
}
// --- END NEW CODE ---

const dialect = new SqliteDialect({
  // This will now successfully create the database file inside the 'data' folder
  database: new SQLite(dbPath),
});

// This is the database instance used by the application
export const db = new Kysely<DB>({
  dialect,
  log: (event) => {
    // This will help us see database queries and errors in the terminal
    if (event.level === 'error') {
      console.error(event.error);
    }
  },
});