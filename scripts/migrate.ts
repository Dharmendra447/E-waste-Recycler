import { db } from '../server/db.js';

async function migrate() {
  console.log('Running migrations...');

  try {
    const tables = await db.introspection.getTables();
    const tableNames = new Set(tables.map((table) => table.name));
    const columnsFor = (tableName: string) => new Set(tables.find((table) => table.name === tableName)?.columns.map((column) => column.name) || []);

    // Create the new unified users table
    if (!tableNames.has('users')) await db.schema
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
      .addColumn('accepted_categories', 'text')
      .addColumn('active', 'integer', (col) => col.notNull().defaultTo(1))
      .execute();
    if (tableNames.has('users') && !columnsFor('users').has('accepted_categories')) await db.schema.alterTable('users').addColumn('accepted_categories', 'text').execute();
    if (tableNames.has('users') && !columnsFor('users').has('active')) await db.schema.alterTable('users').addColumn('active', 'integer', (col) => col.notNull().defaultTo(1)).execute();
    await db.updateTable('users')
      .set({ accepted_categories: 'IT Equipment, Consumer Electronics, Batteries, Household Appliances, Special Handling' })
      .where('role', '=', 'vendor')
      .where('accepted_categories', 'is', null)
      .execute();
    console.log('Users table ready.');

    // Create the pickups table with foreign keys to the new users table
    if (!tableNames.has('pickups')) await db.schema
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
      .addColumn('category', 'text')
      .addColumn('condition', 'text')
      .addColumn('hazard', 'text')
      .addColumn('quantity', 'integer', (col) => col.notNull().defaultTo(1))
      .addColumn('preferred_date', 'text')
      .addColumn('preferred_time', 'text')
      .addColumn('notes', 'text')
      .addColumn('status', 'text', (col) => col.notNull().defaultTo('requested'))
      .addColumn('requested_at', 'text', (col) => col.notNull())
      .addColumn('assigned_at', 'text')
      .addColumn('scheduled_at', 'text')
      .addColumn('collected_at', 'text')
      .addColumn('recycled_at', 'text')
      .addColumn('points_awarded', 'integer', (col) => col.notNull().defaultTo(0))
      .execute();
    if (tableNames.has('pickups')) {
      const pickupColumns = columnsFor('pickups');
      if (!pickupColumns.has('category')) await db.schema.alterTable('pickups').addColumn('category', 'text').execute();
      if (!pickupColumns.has('condition')) await db.schema.alterTable('pickups').addColumn('condition', 'text').execute();
      if (!pickupColumns.has('hazard')) await db.schema.alterTable('pickups').addColumn('hazard', 'text').execute();
      if (!pickupColumns.has('quantity')) await db.schema.alterTable('pickups').addColumn('quantity', 'integer', (col) => col.notNull().defaultTo(1)).execute();
      if (!pickupColumns.has('preferred_date')) await db.schema.alterTable('pickups').addColumn('preferred_date', 'text').execute();
      if (!pickupColumns.has('preferred_time')) await db.schema.alterTable('pickups').addColumn('preferred_time', 'text').execute();
      if (!pickupColumns.has('notes')) await db.schema.alterTable('pickups').addColumn('notes', 'text').execute();
      if (!pickupColumns.has('scheduled_at')) await db.schema.alterTable('pickups').addColumn('scheduled_at', 'text').execute();
      if (!pickupColumns.has('collected_at')) await db.schema.alterTable('pickups').addColumn('collected_at', 'text').execute();
      if (!pickupColumns.has('recycled_at')) await db.schema.alterTable('pickups').addColumn('recycled_at', 'text').execute();
      if (!pickupColumns.has('points_awarded')) await db.schema.alterTable('pickups').addColumn('points_awarded', 'integer', (col) => col.notNull().defaultTo(0)).execute();
    }
    console.log('Pickups table ready.');

    if (!tableNames.has('reward_history')) await db.schema
      .createTable('reward_history')
      .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
      .addColumn('user_id', 'integer', (col) => col.references('users.id').notNull())
      .addColumn('pickup_id', 'integer', (col) => col.references('pickups.id').notNull().unique())
      .addColumn('points', 'integer', (col) => col.notNull())
      .addColumn('reason', 'text', (col) => col.notNull())
      .addColumn('created_at', 'text', (col) => col.notNull())
      .execute();

    console.log('Migrations completed successfully!');
  } catch (error) {
    console.error('Failed to run migrations:', error);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

migrate();
