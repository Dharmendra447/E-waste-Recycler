import { db } from '../server/db.js';

async function migrate() {
  console.log('Running migrations...');

  try {
    // Drop old tables if they exist to start fresh
    await db.schema.dropTable('pickups').ifExists().execute();
    await db.schema.dropTable('users').ifExists().execute();
    await db.schema.dropTable('vendors').ifExists().execute();
    await db.schema.dropTable('admins').ifExists().execute();
    console.log('Dropped old tables.');

    // Create the new unified users table
    await db.schema
      .createTable('users')
      .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
      .addColumn('name', 'text', (col) => col.notNull())
      .addColumn('email', 'text', (col) => col.notNull().unique())
      .addColumn('password_hash', 'text', (col) => col.notNull())
      .addColumn('role', 'text', (col) => col.notNull()) // 'user', 'vendor', or 'admin'
      .addColumn('points', 'integer', (col) => col.notNull().defaultTo(0))
      .addColumn('city', 'text')
      .addColumn('address', 'text')
      .addColumn('latitude', 'real')
      .addColumn('longitude', 'real')
      .execute();
    console.log('Created unified users table.');

    // Create the pickups table with foreign keys to the new users table
    await db.schema
      .createTable('pickups')
      .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
      .addColumn('user_id', 'integer', (col) => col.references('users.id').notNull())
      .addColumn('vendor_id', 'integer', (col) => col.references('users.id'))
      .addColumn('name', 'text', (col) => col.notNull())
      .addColumn('address', 'text', (col) => col.notNull())
      .addColumn('latitude', 'real')
      .addColumn('longitude', 'real')
      .addColumn('email', 'text', (col) => col.notNull())
      .addColumn('items_description', 'text', (col) => col.notNull())
      .addColumn('status', 'text', (col) => col.notNull().defaultTo('pending'))
      .addColumn('requested_at', 'text', (col) => col.notNull())
      .addColumn('assigned_at', 'text')
      .execute();
    console.log('Created pickups table.');

    console.log('Migrations completed successfully!');
  } catch (error) {
    console.error('Failed to run migrations:', error);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

migrate();
