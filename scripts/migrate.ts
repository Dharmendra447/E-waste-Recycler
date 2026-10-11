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
      .addColumn('accepting_pickups', 'integer', (col) => col.notNull().defaultTo(1))
      .addColumn('pickup_capacity', 'integer')
      .addColumn('active', 'integer', (col) => col.notNull().defaultTo(1))
      .addColumn('buyback_enabled', 'integer', (col) => col.notNull().defaultTo(0))
      .addColumn('is_demo', 'integer', (col) => col.notNull().defaultTo(0))
      .addColumn('service_area', 'text')
      .addColumn('demo_description', 'text')
      .execute();
    if (tableNames.has('users') && !columnsFor('users').has('accepted_categories')) await db.schema.alterTable('users').addColumn('accepted_categories', 'text').execute();
    if (tableNames.has('users') && !columnsFor('users').has('accepting_pickups')) await db.schema.alterTable('users').addColumn('accepting_pickups', 'integer', (col) => col.notNull().defaultTo(1)).execute();
    if (tableNames.has('users') && !columnsFor('users').has('pickup_capacity')) await db.schema.alterTable('users').addColumn('pickup_capacity', 'integer').execute();
    if (tableNames.has('users') && !columnsFor('users').has('active')) await db.schema.alterTable('users').addColumn('active', 'integer', (col) => col.notNull().defaultTo(1)).execute();
    if (tableNames.has('users') && !columnsFor('users').has('buyback_enabled')) await db.schema.alterTable('users').addColumn('buyback_enabled', 'integer', (col) => col.notNull().defaultTo(0)).execute();
    if (tableNames.has('users') && !columnsFor('users').has('is_demo')) await db.schema.alterTable('users').addColumn('is_demo', 'integer', (col) => col.notNull().defaultTo(0)).execute();
    if (tableNames.has('users') && !columnsFor('users').has('service_area')) await db.schema.alterTable('users').addColumn('service_area', 'text').execute();
    if (tableNames.has('users') && !columnsFor('users').has('demo_description')) await db.schema.alterTable('users').addColumn('demo_description', 'text').execute();
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

    if (!tableNames.has('detection_history')) await db.schema
      .createTable('detection_history')
      .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
      .addColumn('user_id', 'integer', (col) => col.references('users.id').notNull())
      .addColumn('device_type', 'text', (col) => col.notNull())
      .addColumn('category', 'text', (col) => col.notNull())
      .addColumn('is_ewaste', 'integer', (col) => col.notNull())
      .addColumn('analyzed_at', 'text', (col) => col.notNull())
      .execute();

    if (!tableNames.has('pickup_status_history')) await db.schema
      .createTable('pickup_status_history')
      .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
      .addColumn('pickup_id', 'integer', (col) => col.references('pickups.id').notNull())
      .addColumn('status', 'text', (col) => col.notNull())
      .addColumn('updated_by', 'integer', (col) => col.references('users.id'))
      .addColumn('updated_at', 'text', (col) => col.notNull())
      .execute();

await db.schema
      .createTable('pickup_verifications')
      .ifNotExists()
      .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
      .addColumn('pickup_id', 'integer', (col) => col.notNull().unique().references('pickups.id').onDelete('cascade'))
      .addColumn('actual_device_type', 'text', (col) => col.notNull())
      .addColumn('quantity', 'integer', (col) => col.notNull())
      .addColumn('condition', 'text', (col) => col.notNull())
      .addColumn('damage_notes', 'text')
      .addColumn('photo_data', 'text')
      .addColumn('photo_mime', 'text')
      .addColumn('verified_by', 'integer', (col) => col.notNull().references('users.id'))
      .addColumn('verified_at', 'text', (col) => col.notNull())
      .execute();

    await db.schema.createTable('buyback_offers')
      .ifNotExists()
      .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
      .addColumn('vendor_id', 'integer', (col) => col.notNull().references('users.id').onDelete('cascade'))
      .addColumn('device_type', 'text', (col) => col.notNull())
      .addColumn('condition', 'text', (col) => col.notNull())
      .addColumn('minimum_price_inr', 'real', (col) => col.notNull().defaultTo(0))
      .addColumn('maximum_price_inr', 'real', (col) => col.notNull().defaultTo(0))
      .addColumn('amount_inr', 'real', (col) => col.notNull())
      .addColumn('terms', 'text', (col) => col.notNull().defaultTo('Final price subject to device inspection and your approval.'))
      .addColumn('pricing_unit', 'text', (col) => col.notNull())
      .addColumn('active', 'integer', (col) => col.notNull().defaultTo(1))
      .addColumn('created_at', 'text', (col) => col.notNull())
      .addColumn('updated_at', 'text', (col) => col.notNull())
      .execute();

    await db.schema.createTable('buyback_requests')
      .ifNotExists()
      .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
      .addColumn('user_id', 'integer', (col) => col.notNull().references('users.id'))
      .addColumn('vendor_id', 'integer', (col) => col.notNull().references('users.id'))
      .addColumn('offer_id', 'integer', (col) => col.notNull().references('buyback_offers.id'))
      .addColumn('device_type', 'text', (col) => col.notNull())
      .addColumn('condition', 'text', (col) => col.notNull())
      .addColumn('quantity', 'real', (col) => col.notNull())
      .addColumn('pricing_unit', 'text', (col) => col.notNull())
      .addColumn('quoted_unit_price', 'real', (col) => col.notNull())
      .addColumn('quoted_minimum_price_inr', 'real', (col) => col.notNull().defaultTo(0))
      .addColumn('quoted_maximum_price_inr', 'real', (col) => col.notNull().defaultTo(0))
      .addColumn('quoted_terms', 'text', (col) => col.notNull().defaultTo('Final price subject to device inspection and your approval.'))
      .addColumn('quoted_amount', 'real', (col) => col.notNull())
      .addColumn('revised_amount', 'real')
      .addColumn('final_agreed_amount', 'real')
      .addColumn('inspected_condition', 'text')
      .addColumn('inspection_notes', 'text')
      .addColumn('status', 'text', (col) => col.notNull().defaultTo('requested'))
      .addColumn('payment_status', 'text', (col) => col.notNull().defaultTo('unpaid'))
      .addColumn('payment_method', 'text')
      .addColumn('payment_reference', 'text')
      .addColumn('created_at', 'text', (col) => col.notNull())
      .addColumn('updated_at', 'text', (col) => col.notNull())
      .addColumn('payment_confirmed_at', 'text')
      .execute();

    await db.schema.createTable('buyback_request_history')
      .ifNotExists()
      .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
      .addColumn('request_id', 'integer', (col) => col.notNull().references('buyback_requests.id').onDelete('cascade'))
      .addColumn('status', 'text', (col) => col.notNull())
      .addColumn('updated_by', 'integer', (col) => col.notNull().references('users.id'))
      .addColumn('note', 'text')
      .addColumn('updated_at', 'text', (col) => col.notNull())
      .execute();

    const migratedTables = await db.introspection.getTables();
    const offerColumns = new Set(migratedTables.find((table) => table.name === 'buyback_offers')?.columns.map((column) => column.name) || []);
    const requestColumns = new Set(migratedTables.find((table) => table.name === 'buyback_requests')?.columns.map((column) => column.name) || []);
    if (!offerColumns.has('minimum_price_inr')) await db.schema.alterTable('buyback_offers').addColumn('minimum_price_inr', 'real', (col) => col.notNull().defaultTo(0)).execute();
    if (!offerColumns.has('maximum_price_inr')) await db.schema.alterTable('buyback_offers').addColumn('maximum_price_inr', 'real', (col) => col.notNull().defaultTo(0)).execute();
    if (!requestColumns.has('quoted_minimum_price_inr')) await db.schema.alterTable('buyback_requests').addColumn('quoted_minimum_price_inr', 'real', (col) => col.notNull().defaultTo(0)).execute();
    if (!requestColumns.has('quoted_maximum_price_inr')) await db.schema.alterTable('buyback_requests').addColumn('quoted_maximum_price_inr', 'real', (col) => col.notNull().defaultTo(0)).execute();
    if (!requestColumns.has('inspected_condition')) await db.schema.alterTable('buyback_requests').addColumn('inspected_condition', 'text').execute();
    if (!requestColumns.has('inspection_notes')) await db.schema.alterTable('buyback_requests').addColumn('inspection_notes', 'text').execute();
    if (!requestColumns.has('payment_method')) await db.schema.alterTable('buyback_requests').addColumn('payment_method', 'text').execute();
    if (!requestColumns.has('payment_reference')) await db.schema.alterTable('buyback_requests').addColumn('payment_reference', 'text').execute();

    await db.updateTable('buyback_offers')
      .set((eb) => ({
        minimum_price_inr: eb.ref('amount_inr'),
        maximum_price_inr: eb.ref('amount_inr'),
      }))
      .where('minimum_price_inr', '=', 0)
      .where('maximum_price_inr', '=', 0)
      .execute();
    await db.updateTable('buyback_requests')
      .set((eb) => ({
        quoted_minimum_price_inr: eb.ref('quoted_unit_price'),
        quoted_maximum_price_inr: eb.ref('quoted_unit_price'),
      }))
      .where('quoted_minimum_price_inr', '=', 0)
      .where('quoted_maximum_price_inr', '=', 0)
      .execute();

    if (!tableNames.has('campaigns')) await db.schema
      .createTable('campaigns')
      .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
      .addColumn('name', 'text', (col) => col.notNull())
      .addColumn('target_kg', 'real', (col) => col.notNull())
      .addColumn('start_date', 'text', (col) => col.notNull())
      .addColumn('end_date', 'text', (col) => col.notNull())
      .addColumn('created_by', 'integer', (col) => col.references('users.id').notNull())
      .addColumn('created_at', 'text', (col) => col.notNull())
      .execute();

    if (!tableNames.has('campaign_participation')) await db.schema
      .createTable('campaign_participation')
      .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
      .addColumn('campaign_id', 'integer', (col) => col.references('campaigns.id').notNull())
      .addColumn('user_id', 'integer', (col) => col.references('users.id').notNull())
      .addColumn('pickup_id', 'integer', (col) => col.references('pickups.id').notNull().unique())
      .addColumn('amount_kg', 'real', (col) => col.notNull())
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
