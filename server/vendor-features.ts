import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import type { Kysely, Transaction } from 'kysely';
import { db } from './db.js';
import type { DB } from './db-schema.js';
import type { AuthRequest } from './auth.js';
import { supportsRecyclerCategory } from './recycler-matching.js';
import { canonicalRecyclingCategory } from '../shared/recycling-categories.js';

const activePickupStatuses = [
  'requested',
  'accepted',
  'pending',
  'confirmed',
  'assigned',
  'scheduled',
  'collected',
  'processing',
] as const;
const verifiableConditions = ['working', 'partially_working', 'damaged', 'non_functional'] as const;
const acceptedPhotoTypes = ['image/jpeg', 'image/png', 'image/webp'];
const maxPhotoSize = 10 * 1024 * 1024;

const router = Router();

function requireVendor(req: Request, res: Response, next: NextFunction) {
  const authRequest = req as AuthRequest;
  if (authRequest.userRole !== 'vendor') {
    return res.status(403).json({ message: 'Vendor access required.' });
  }
  next();
}

router.use(requireVendor);

class RouteError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export class VendorPickupError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

interface CreateVendorPickupInput {
  userId: number;
  name: string;
  email: string;
  address: string;
  items_description: string;
  latitude: number | null;
  longitude: number | null;
  category: string;
  condition: string | null;
  hazard: string | null;
  quantity: number;
  preferred_date: string | null;
  preferred_time: string | null;
  notes: string | null;
  vendorId: number;
}

export async function createCapacityCheckedPickup(input: CreateVendorPickupInput) {
  return db.transaction().execute(async (trx) => {
    const vendor = await trx
      .selectFrom('users')
      .where('id', '=', input.vendorId)
      .where('role', '=', 'vendor')
      .where('active', '=', 1)
      .select(['accepted_categories', 'accepting_pickups', 'pickup_capacity'])
      .executeTakeFirst();
    if (!vendor || vendor.accepting_pickups !== 1) {
      throw new VendorPickupError(400, 'The selected recycler is unavailable.');
    }

    const accepted = vendor.accepted_categories || '';
    if (!supportsRecyclerCategory(accepted, input.category)) {
      throw new VendorPickupError(400, 'The selected recycler does not support this e-waste category.');
    }

    const quantity = Math.max(1, Number(input.quantity) || 1);
    const activeQuantity = await getActiveQuantity(trx, input.vendorId);
    if (vendor.pickup_capacity !== null && activeQuantity + quantity > vendor.pickup_capacity) {
      throw new VendorPickupError(409, 'The selected recycler has reached its active pickup capacity.');
    }

    const requestedAt = new Date().toISOString();
    const pickup = await trx
      .insertInto('pickups')
      .values({
        user_id: input.userId,
        name: input.name,
        email: input.email,
        address: input.address,
        items_description: input.items_description,
        latitude: input.latitude,
        longitude: input.longitude,
        category: input.category || null,
        condition: input.condition,
        hazard: input.hazard,
        quantity,
        preferred_date: input.preferred_date,
        preferred_time: input.preferred_time,
        notes: input.notes,
        vendor_id: input.vendorId,
        status: 'requested',
        requested_at: requestedAt,
        assigned_at: null,
        scheduled_at: null,
        collected_at: null,
        recycled_at: null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await trx.insertInto('pickup_status_history').values({
      pickup_id: pickup.id,
      status: 'requested',
      updated_by: input.userId,
      updated_at: requestedAt,
    }).execute();

    return pickup;
  });
}

function currentVendorId(req: Request): number {
  return (req as AuthRequest).userId;
}

function parsePickupId(value: string): number | null {
  const pickupId = Number(value);
  return Number.isSafeInteger(pickupId) && pickupId > 0 ? pickupId : null;
}

type Queryable = Kysely<DB> | Transaction<DB>;

export async function getActiveQuantity(queryable: Queryable, vendorId: number): Promise<number> {
  const openPickups = await queryable
    .selectFrom('pickups')
    .where('vendor_id', '=', vendorId)
    .where('status', 'in', [...activePickupStatuses])
    .select('quantity')
    .execute();
  return openPickups.reduce((total, pickup) => total + pickup.quantity, 0);
}

function imageMimeFromContent(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) return 'image/png';
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) return 'image/webp';
  return null;
}

const collectionPhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxPhotoSize, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!acceptedPhotoTypes.includes(file.mimetype)) {
      callback(new Error('Use a JPEG, PNG, or WebP collection photo.'));
      return;
    }
    callback(null, true);
  },
});

function parseCollectionPhoto(req: Request, res: Response, next: NextFunction) {
  collectionPhotoUpload.single('photo')(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }
    const message = error instanceof Error ? error.message : 'The collection photo could not be uploaded.';
    res.status(400).json({ message });
  });
}

router.get('/settings', async (req, res) => {
  try {
    const vendorId = currentVendorId(req);
    const vendor = await db
      .selectFrom('users')
      .where('id', '=', vendorId)
      .where('role', '=', 'vendor')
      .select(['accepted_categories', 'accepting_pickups', 'pickup_capacity'])
      .executeTakeFirst();
    if (!vendor) return res.status(404).json({ message: 'Vendor account not found.' });
    const active_quantity = await getActiveQuantity(db, vendorId);
    res.json({
      ...vendor,
      accepting_pickups: vendor.accepting_pickups === 1,
      active_quantity,
    });
  } catch (error) {
    console.error('Failed to load vendor settings', error);
    res.status(500).json({ message: 'Failed to load vendor settings.' });
  }
});

router.put('/settings', async (req, res) => {
  const categoriesInput = req.body?.accepted_categories;
  const acceptingPickups = req.body?.accepting_pickups;
  const capacityInput = req.body?.pickup_capacity;

  if (typeof categoriesInput !== 'string' || categoriesInput.length > 500) {
    return res.status(400).json({ message: 'Supported categories must be text up to 500 characters.' });
  }
  if (typeof acceptingPickups !== 'boolean') {
    return res.status(400).json({ message: 'Pickup availability must be true or false.' });
  }

  let pickupCapacity: number | null = null;
  if (capacityInput !== null && capacityInput !== undefined && capacityInput !== '') {
    pickupCapacity = Number(capacityInput);
    if (!Number.isSafeInteger(pickupCapacity) || pickupCapacity < 1 || pickupCapacity > 10000) {
      return res.status(400).json({ message: 'Capacity must be a whole number between 1 and 10000, or left blank.' });
    }
  }

  const requestedCategories = categoriesInput.split(',').map((item: string) => item.trim()).filter(Boolean);
  if (requestedCategories.length > 20 || requestedCategories.some((category: string) => category.length > 80)) {
    return res.status(400).json({ message: 'Enter up to 20 categories, each no longer than 80 characters.' });
  }
  const normalizedCategories = requestedCategories.map((category: string) => canonicalRecyclingCategory(category));
  if (normalizedCategories.some((category: string | null) => category === null)) {
    return res.status(400).json({ message: 'Choose supported categories only, such as Mobile Phones, Laptops, Batteries, or IT Equipment.' });
  }
  const categories = [...new Set(normalizedCategories.filter((category: string | null): category is string => category !== null))];

  try {
    const vendorId = currentVendorId(req);
    const { updated, active_quantity } = await db.transaction().execute(async (trx) => {
      const activeQuantity = await getActiveQuantity(trx, vendorId);
      if (pickupCapacity !== null && pickupCapacity < activeQuantity) {
        throw new RouteError(409, `Capacity cannot be lower than the ${activeQuantity} active pickup items already assigned.`);
      }
      const updatedSettings = await trx
        .updateTable('users')
        .set({
          accepted_categories: categories.length > 0 ? categories.join(', ') : null,
          accepting_pickups: acceptingPickups ? 1 : 0,
          pickup_capacity: pickupCapacity,
        })
        .where('id', '=', vendorId)
        .where('role', '=', 'vendor')
        .returning(['accepted_categories', 'accepting_pickups', 'pickup_capacity'])
        .executeTakeFirst();
      return { updated: updatedSettings, active_quantity: activeQuantity };
    });
    if (!updated) return res.status(404).json({ message: 'Vendor account not found.' });
    res.json({
      ...updated,
      accepting_pickups: updated.accepting_pickups === 1,
      active_quantity,
    });
  } catch (error) {
    if (error instanceof RouteError) return res.status(error.status).json({ message: error.message });
    console.error('Failed to save vendor settings', error);
    res.status(500).json({ message: 'Failed to save vendor settings.' });
  }
});

router.get('/pickups/inventory', async (req, res) => {
  try {
    const inventory = await db
      .selectFrom('pickups')
      .where('vendor_id', '=', currentVendorId(req))
      .where('status', 'in', ['collected', 'processing', 'recycled'])
      .selectAll()
      .orderBy('collected_at', 'desc')
      .execute();
    res.json(inventory);
  } catch (error) {
    console.error('Failed to load vendor inventory', error);
    res.status(500).json({ message: 'Failed to load inventory.' });
  }
});

router.get('/pickups/:id/details', async (req, res) => {
  const pickupId = parsePickupId(req.params.id);
  if (pickupId === null) return res.status(400).json({ message: 'Invalid pickup ID.' });

  try {
    const pickup = await db
      .selectFrom('pickups')
      .where('id', '=', pickupId)
      .where('vendor_id', '=', currentVendorId(req))
      .selectAll()
      .executeTakeFirst();
    if (!pickup) return res.status(404).json({ message: 'Assigned pickup not found.' });
    const verification = await db
      .selectFrom('pickup_verifications')
      .where('pickup_id', '=', pickupId)
      .selectAll()
      .executeTakeFirst();
    const [user, vendor, statusHistory] = await Promise.all([
      db.selectFrom('users')
        .where('id', '=', pickup.user_id)
        .select(['id', 'name', 'email'])
        .executeTakeFirst(),
      db.selectFrom('users')
        .where('id', '=', currentVendorId(req))
        .where('role', '=', 'vendor')
        .select(['id', 'name', 'city', 'service_area'])
        .executeTakeFirst(),
      db.selectFrom('pickup_status_history')
        .where('pickup_id', '=', pickupId)
        .select(['status', 'updated_by', 'updated_at'])
        .orderBy('updated_at', 'asc')
        .execute(),
    ]);
    if (!user || !vendor) return res.status(404).json({ message: 'Pickup details are unavailable.' });
    res.json({
      pickup,
      verification: verification ?? null,
      user: { id: user.id, name: user.name, email: user.email },
      vendor: { id: vendor.id, name: vendor.name, city: vendor.city, service_area: vendor.service_area },
      statusHistory,
    });
  } catch (error) {
    console.error('Failed to load assigned pickup details', error);
    res.status(500).json({ message: 'Failed to load pickup details.' });
  }
});

router.post('/pickups/:id/verification', parseCollectionPhoto, async (req, res) => {
  const pickupId = parsePickupId(req.params.id);
  if (pickupId === null) return res.status(400).json({ message: 'Invalid pickup ID.' });

  const actualDeviceType = typeof req.body?.actual_device_type === 'string' ? req.body.actual_device_type.trim() : '';
  const quantity = Number(req.body?.quantity);
  const condition = req.body?.condition;
  const damageNotes = typeof req.body?.damage_notes === 'string' ? req.body.damage_notes.trim() : '';

  if (actualDeviceType.length < 2 || actualDeviceType.length > 120) {
    return res.status(400).json({ message: 'Actual device type must be between 2 and 120 characters.' });
  }
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10000) {
    return res.status(400).json({ message: 'Actual quantity must be a whole number between 1 and 10000.' });
  }
  if (!(verifiableConditions as readonly unknown[]).includes(condition)) {
    return res.status(400).json({ message: 'Select a valid device condition.' });
  }
  if (damageNotes.length > 2000) {
    return res.status(400).json({ message: 'Damage notes must not exceed 2000 characters.' });
  }
  if ((condition === 'damaged' || condition === 'non_functional') && damageNotes.length < 3) {
    return res.status(400).json({ message: 'Add damage notes for damaged or non-functional items.' });
  }

  const photo = req.file;
  const photoMime = photo ? imageMimeFromContent(photo.buffer) : null;
  if (photo && (!photoMime || photoMime !== photo.mimetype)) {
    return res.status(400).json({ message: 'The uploaded file content is not a supported JPEG, PNG, or WebP image.' });
  }

  const verifiedAt = new Date().toISOString();
  try {
    const result = await db.transaction().execute(async (trx) => {
      const pickup = await trx
        .selectFrom('pickups')
        .where('id', '=', pickupId)
        .where('vendor_id', '=', currentVendorId(req))
        .selectAll()
        .executeTakeFirst();
      if (!pickup) throw new RouteError(404, 'Assigned pickup not found.');
      if (pickup.status !== 'scheduled') throw new RouteError(409, 'Only a scheduled pickup can be verified and marked collected.');

      const existing = await trx
        .selectFrom('pickup_verifications')
        .where('pickup_id', '=', pickupId)
        .select('id')
        .executeTakeFirst();
      if (existing) throw new RouteError(409, 'This pickup already has a verification record.');

      const verification = await trx
        .insertInto('pickup_verifications')
        .values({
          pickup_id: pickupId,
          actual_device_type: actualDeviceType,
          quantity,
          condition,
          damage_notes: damageNotes || null,
          photo_data: photo ? photo.buffer.toString('base64') : null,
          photo_mime: photoMime,
          verified_by: currentVendorId(req),
          verified_at: verifiedAt,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      const updatedPickup = await trx
        .updateTable('pickups')
        .set({ status: 'collected', collected_at: verifiedAt })
        .where('id', '=', pickupId)
        .where('vendor_id', '=', currentVendorId(req))
        .where('status', '=', 'scheduled')
        .returningAll()
        .executeTakeFirst();
      if (!updatedPickup) throw new RouteError(409, 'Pickup status changed before verification could be completed.');

      await trx.insertInto('pickup_status_history').values({
        pickup_id: pickupId,
        status: 'collected',
        updated_by: currentVendorId(req),
        updated_at: verifiedAt,
      }).execute();
      return { pickup: updatedPickup, verification };
    });
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof RouteError) return res.status(error.status).json({ message: error.message });
    console.error('Failed to verify pickup', error);
    res.status(500).json({ message: 'Failed to save pickup verification.' });
  }
});

export { router as vendorFeaturesRouter };
