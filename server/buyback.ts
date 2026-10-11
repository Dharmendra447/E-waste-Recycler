import { Router, type Request, type Response } from 'express';
import type { AuthRequest } from './auth.js';
import { db } from './db.js';

export const buybackRouter = Router();

const conditions = ['working', 'repairable', 'damaged', 'scrap'] as const;
const pricingUnits = ['per_device', 'per_kg'] as const;
const paymentMethods = ['cash', 'upi', 'bank_transfer', 'other'] as const;
const openStatuses = ['requested', 'offer_confirmed', 'inspection_pending', 'revised_offer', 'price_accepted', 'collected', 'payment_pending'] as const;
const terminalStatuses = ['paid', 'rejected'] as const;
type BuybackCondition = (typeof conditions)[number];
type PricingUnit = (typeof pricingUnits)[number];
type PaymentMethod = (typeof paymentMethods)[number];

class BuybackError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function auth(req: Request) {
  return req as AuthRequest;
}

function roleError(req: Request, res: Response, role: 'user' | 'vendor') {
  if (auth(req).userRole !== role) {
    res.status(403).json({ message: `Only ${role}s can access this buyback feature.` });
    return true;
  }
  return false;
}

function normalizeDeviceType(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function isCondition(value: unknown): value is BuybackCondition {
  return typeof value === 'string' && conditions.includes(value as BuybackCondition);
}

function isPricingUnit(value: unknown): value is PricingUnit {
  return typeof value === 'string' && pricingUnits.includes(value as PricingUnit);
}

function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === 'string' && (paymentMethods as readonly string[]).includes(value);
}

function validAmount(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isFinite(value)
    && value >= 0
    && value <= 10_000_000
    && Math.abs(Math.round(value * 100) - value * 100) < 1e-8;
}

function validPriceRange(minimum: unknown, maximum: unknown): boolean {
  return validAmount(minimum) && validAmount(maximum) && maximum >= minimum;
}

function validQuantity(value: unknown, unit: PricingUnit) {
  return typeof value === 'number'
    && Number.isFinite(value)
    && value > 0
    && value <= 10_000
    && (unit === 'per_device'
      ? Number.isSafeInteger(value)
      : Math.abs(Math.round(value * 1000) - value * 1000) < 1e-8);
}

function roundedAmount(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function parseId(value: string) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function distanceKm(latitude: number, longitude: number, vendorLatitude: number | null, vendorLongitude: number | null) {
  if (vendorLatitude === null || vendorLongitude === null
    || !Number.isFinite(vendorLatitude) || !Number.isFinite(vendorLongitude)
    || Math.abs(vendorLatitude) > 90 || Math.abs(vendorLongitude) > 180
    || (vendorLatitude === 0 && vendorLongitude === 0)) return null;
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const deltaLatitude = radians(vendorLatitude - latitude);
  const deltaLongitude = radians(vendorLongitude - longitude);
  const value = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(radians(latitude)) * Math.cos(radians(vendorLatitude)) * Math.sin(deltaLongitude / 2) ** 2;
  return Number((6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))).toFixed(1));
}

function logFailure(label: string, error: unknown, res: Response) {
  if (error instanceof BuybackError) {
    res.status(error.status).json({ message: error.message });
    return;
  }
  console.error(label, error);
  res.status(500).json({ message: 'The buyback request could not be completed. Please try again.' });
}

buybackRouter.get('/buyback/offers', async (req, res) => {
  if (roleError(req, res, 'user')) return;
  const deviceType = typeof req.query.device_type === 'string' ? req.query.device_type.trim() : '';
  const condition = req.query.condition;
  const unit = req.query.pricing_unit;
  const city = typeof req.query.city === 'string' ? req.query.city.trim() : '';
  if (!deviceType || deviceType.length > 100 || !city || !isCondition(condition) || !isPricingUnit(unit)) {
    return res.status(400).json({ message: 'Choose a service city, device type, accepted condition, and pricing unit to compare offers.' });
  }
  const latitude = req.query.latitude === undefined ? null : Number(req.query.latitude);
  const longitude = req.query.longitude === undefined ? null : Number(req.query.longitude);
  if ((latitude === null) !== (longitude === null)
    || (latitude !== null && (!Number.isFinite(latitude) || Math.abs(latitude) > 90))
    || (longitude !== null && (!Number.isFinite(longitude) || Math.abs(longitude) > 180))) {
    return res.status(400).json({ message: 'Provide a valid latitude and longitude pair to sort by distance.' });
  }

  try {
    const offers = await db.selectFrom('buyback_offers as offer')
      .innerJoin('users as vendor', 'vendor.id', 'offer.vendor_id')
      .where('offer.active', '=', 1)
      .where('vendor.role', '=', 'vendor')
      .where('vendor.active', '=', 1)
      .where('vendor.buyback_enabled', '=', 1)
      .where('offer.condition', '=', condition)
      .where('offer.pricing_unit', '=', unit)
      .select([
        'offer.id',
        'offer.vendor_id',
        'offer.device_type',
        'offer.condition',
        'offer.minimum_price_inr',
        'offer.maximum_price_inr',
        'offer.amount_inr',
        'offer.terms',
        'offer.pricing_unit',
        'offer.updated_at',
        'vendor.name as vendor_name',
        'vendor.city as city',
        'vendor.service_area as service_area',
        'vendor.is_demo as is_demo',
        'vendor.latitude as vendor_latitude',
        'vendor.longitude as vendor_longitude',
      ])
      .orderBy('offer.maximum_price_inr', 'desc')
      .execute();

    const normalizedSearch = normalizeDeviceType(deviceType);
    res.json(offers
      .filter((offer) => normalizeDeviceType(offer.device_type) === normalizedSearch
        && normalizeDeviceType(offer.service_area || offer.city || '') === normalizeDeviceType(city))
      .map((offer) => ({
        ...offer,
        service_area: offer.service_area || offer.city,
        distance_km: latitude === null || longitude === null ? null : distanceKm(latitude, longitude, offer.vendor_latitude, offer.vendor_longitude),
        vendor_latitude: undefined,
        vendor_longitude: undefined,
      })));
  } catch (error) {
    logFailure('Failed to load buyback offers', error, res);
  }
});

buybackRouter.get('/vendor/buyback/settings', async (req, res) => {
  if (roleError(req, res, 'vendor')) return;
  try {
    const vendor = await db.selectFrom('users')
      .where('id', '=', auth(req).userId)
      .where('role', '=', 'vendor')
      .select('buyback_enabled')
      .executeTakeFirst();
    if (!vendor) return res.status(404).json({ message: 'Vendor account not found.' });
    res.json({ buyback_enabled: vendor.buyback_enabled === 1 });
  } catch (error) {
    logFailure('Failed to load buyback settings', error, res);
  }
});

buybackRouter.put('/vendor/buyback/settings', async (req, res) => {
  if (roleError(req, res, 'vendor')) return;
  if (typeof req.body?.buyback_enabled !== 'boolean') {
    return res.status(400).json({ message: 'Choose whether your business is buying used electronics.' });
  }
  try {
    const updated = await db.updateTable('users')
      .set({ buyback_enabled: req.body.buyback_enabled ? 1 : 0 })
      .where('id', '=', auth(req).userId)
      .where('role', '=', 'vendor')
      .returning('buyback_enabled')
      .executeTakeFirst();
    if (!updated) return res.status(404).json({ message: 'Vendor account not found.' });
    res.json({ buyback_enabled: updated.buyback_enabled === 1 });
  } catch (error) {
    logFailure('Failed to update buyback settings', error, res);
  }
});

buybackRouter.get('/vendor/buyback/offers', async (req, res) => {
  if (roleError(req, res, 'vendor')) return;
  try {
    const offers = await db.selectFrom('buyback_offers')
      .where('vendor_id', '=', auth(req).userId)
      .selectAll()
      .orderBy('updated_at', 'desc')
      .execute();
    res.json(offers);
  } catch (error) {
    logFailure('Failed to load vendor buyback offers', error, res);
  }
});

function validateOffer(body: Record<string, unknown>) {
  const deviceType = typeof body.device_type === 'string' ? body.device_type.trim() : '';
  if (!deviceType || deviceType.length > 100) throw new BuybackError(400, 'Device type is required and must be 100 characters or fewer.');
  if (!isCondition(body.condition)) throw new BuybackError(400, 'Choose a valid device condition.');
  if (!isPricingUnit(body.pricing_unit)) throw new BuybackError(400, 'Choose per device or per kilogram pricing.');
  const minimumPrice = body.minimum_price_inr ?? body.amount_inr;
  const maximumPrice = body.maximum_price_inr ?? body.amount_inr;
  if (!validAmount(minimumPrice) || !validAmount(maximumPrice) || maximumPrice < minimumPrice || maximumPrice > 10_000_000) {
    throw new BuybackError(400, 'Enter valid non-negative minimum and maximum prices up to ₹10,000,000; maximum must be at least the minimum.');
  }
  const terms = body.terms === undefined ? 'Final price subject to device inspection and your approval.' : body.terms;
  if (typeof terms !== 'string' || terms.trim().length > 300) throw new BuybackError(400, 'Offer conditions must be text up to 300 characters.');
  if (body.active !== undefined && typeof body.active !== 'boolean') throw new BuybackError(400, 'Offer availability must be true or false.');
  return {
    device_type: deviceType,
    condition: body.condition,
    pricing_unit: body.pricing_unit,
    minimum_price_inr: minimumPrice,
    maximum_price_inr: maximumPrice,
    amount_inr: maximumPrice,
    terms: terms.trim() || 'Final price subject to device inspection and your approval.',
    active: body.active === false ? 0 : 1,
  };
}

buybackRouter.post('/vendor/buyback/offers', async (req, res) => {
  if (roleError(req, res, 'vendor')) return;
  try {
    const body = req.body || {};
    const deviceTypes = Array.isArray(body.device_types)
      ? body.device_types
      : [{ device_type: body.device_type, minimum_price_inr: body.minimum_price_inr, maximum_price_inr: body.maximum_price_inr, amount_inr: body.amount_inr }];
    if (deviceTypes.length < 1 || deviceTypes.length > 20) {
      throw new BuybackError(400, 'Select between 1 and 20 device types.');
    }
    const normalizedDeviceTypes = deviceTypes.map((item: unknown) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new BuybackError(400, 'Each device type must have its own valid price range.');
      }
      return validateOffer({ ...body, ...(item as Record<string, unknown>) });
    });
    const uniqueDeviceTypes = new Set(normalizedDeviceTypes.map((offer: ReturnType<typeof validateOffer>) => offer.device_type.toLocaleLowerCase()));
    if (uniqueDeviceTypes.size !== normalizedDeviceTypes.length) {
      throw new BuybackError(400, 'Device types in an offer must be unique.');
    }
    const now = new Date().toISOString();
    const created = await db.transaction().execute(async (trx) => Promise.all(normalizedDeviceTypes.map((values: ReturnType<typeof validateOffer>) => trx.insertInto('buyback_offers')
      .values({ vendor_id: auth(req).userId, ...values, created_at: now, updated_at: now })
      .returningAll()
      .executeTakeFirstOrThrow())));
    res.status(201).json(Array.isArray(body.device_types) ? created : created[0]);
  } catch (error) {
    logFailure('Failed to create buyback offer', error, res);
  }
});

buybackRouter.put('/vendor/buyback/offers/:id', async (req, res) => {
  if (roleError(req, res, 'vendor')) return;
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid offer ID.' });
  try {
    const values = validateOffer(req.body || {});
    const offer = await db.updateTable('buyback_offers')
      .set({ ...values, updated_at: new Date().toISOString() })
      .where('id', '=', id)
      .where('vendor_id', '=', auth(req).userId)
      .returningAll()
      .executeTakeFirst();
    if (!offer) return res.status(404).json({ message: 'Buyback offer not found.' });
    res.json(offer);
  } catch (error) {
    logFailure('Failed to update buyback offer', error, res);
  }
});

buybackRouter.delete('/vendor/buyback/offers/:id', async (req, res) => {
  if (roleError(req, res, 'vendor')) return;
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid offer ID.' });
  try {
    const offer = await db.updateTable('buyback_offers')
      .set({ active: 0, updated_at: new Date().toISOString() })
      .where('id', '=', id)
      .where('vendor_id', '=', auth(req).userId)
      .returning(['id', 'active'])
      .executeTakeFirst();
    if (!offer) return res.status(404).json({ message: 'Buyback offer not found.' });
    res.json({ ...offer, removed: true });
  } catch (error) {
    logFailure('Failed to remove buyback offer', error, res);
  }
});

buybackRouter.get('/vendor/buyback/requests', async (req, res) => {
  if (roleError(req, res, 'vendor')) return;
  try {
    const requests = await db.selectFrom('buyback_requests')
      .where('vendor_id', '=', auth(req).userId)
      .selectAll()
      .orderBy('created_at', 'desc')
      .execute();
    const histories = requests.length
      ? await db.selectFrom('buyback_request_history')
        .where('request_id', 'in', requests.map((request) => request.id))
        .selectAll()
        .orderBy('updated_at', 'asc')
        .execute()
      : [];
    res.json(requests.map((request) => ({
      ...request,
      status_history: histories.filter((entry) => entry.request_id === request.id),
    })));
  } catch (error) {
    logFailure('Failed to load vendor buyback requests', error, res);
  }
});

buybackRouter.post('/vendor/buyback/requests/:id/action', async (req, res) => {
  if (roleError(req, res, 'vendor')) return;
  const id = parseId(req.params.id);
  const action = req.body?.action;
  if (!id) return res.status(400).json({ message: 'Invalid buyback request ID.' });
  try {
    await db.transaction().execute(async (trx) => {
      const buyback = await trx.selectFrom('buyback_requests')
        .where('id', '=', id)
        .where('vendor_id', '=', auth(req).userId)
        .selectAll()
        .executeTakeFirst();
      if (!buyback) throw new BuybackError(404, 'Buyback request not found.');
      if ((terminalStatuses as readonly string[]).includes(buyback.status)) throw new BuybackError(409, 'This buyback request is already closed.');

      let nextStatus: (typeof openStatuses)[number] | (typeof terminalStatuses)[number];
      let note: string | null = null;
      let update: {
        status: typeof nextStatus;
        updated_at: string;
        revised_amount?: number;
        inspected_condition?: BuybackCondition;
        inspection_notes?: string | null;
        payment_status?: 'pending' | 'paid';
        payment_confirmed_at?: string;
        payment_method?: PaymentMethod;
        payment_reference?: string | null;
      };
      const now = new Date().toISOString();
      if (action === 'confirm' && buyback.status === 'requested') {
        nextStatus = 'offer_confirmed';
        update = { status: nextStatus, updated_at: now };
      } else if (action === 'inspect' && buyback.status === 'offer_confirmed') {
        nextStatus = 'inspection_pending';
        update = { status: nextStatus, updated_at: now };
      } else if (action === 'revise' && buyback.status === 'inspection_pending') {
        const revisedAmount = req.body?.revised_amount;
        if (!validAmount(revisedAmount) || revisedAmount * buyback.quantity > 1_000_000_000) {
          throw new BuybackError(400, 'The revised total offer must be a valid amount up to ₹1,000,000,000.');
        }
        const inspectedCondition = req.body?.inspected_condition;
        if (!isCondition(inspectedCondition)) {
          throw new BuybackError(400, 'Select the device condition found during inspection.');
        }
        const inspectionNotes = typeof req.body?.inspection_notes === 'string' ? req.body.inspection_notes.trim() : '';
        if (inspectionNotes.length > 500) {
          throw new BuybackError(400, 'Inspection notes must be 500 characters or fewer.');
        }
        nextStatus = 'revised_offer';
        note = `Inspection recorded (${inspectedCondition}). Revised total offer: ₹${revisedAmount.toFixed(2)}.${inspectionNotes ? ` ${inspectionNotes}` : ''}`;
        update = {
          status: nextStatus,
          updated_at: now,
          revised_amount: revisedAmount,
          inspected_condition: inspectedCondition,
          inspection_notes: inspectionNotes || null,
        };
      } else if (action === 'collect' && buyback.status === 'price_accepted') {
        nextStatus = 'collected';
        update = { status: nextStatus, updated_at: now };
      } else if (action === 'payment_pending' && buyback.status === 'collected') {
        nextStatus = 'payment_pending';
        update = { status: nextStatus, updated_at: now, payment_status: 'pending' };
      } else if (action === 'paid' && buyback.status === 'payment_pending') {
        const paymentMethod = req.body?.payment_method;
        if (!isPaymentMethod(paymentMethod)) {
          throw new BuybackError(400, 'Choose the method used to complete this payment.');
        }
        const paymentReference = typeof req.body?.payment_reference === 'string' ? req.body.payment_reference.trim() : '';
        if (paymentReference.length > 100) {
          throw new BuybackError(400, 'Payment reference must be 100 characters or fewer.');
        }
        nextStatus = 'paid';
        note = `Vendor confirmed payment via ${paymentMethod}${paymentReference ? ` (reference: ${paymentReference})` : ''}.`;
        update = {
          status: nextStatus,
          updated_at: now,
          payment_status: 'paid',
          payment_confirmed_at: now,
          payment_method: paymentMethod,
          payment_reference: paymentReference || null,
        };
      } else if (action === 'reject'
        && ['requested', 'offer_confirmed', 'inspection_pending', 'revised_offer'].includes(buyback.status)) {
        nextStatus = 'rejected';
        update = { status: nextStatus, updated_at: now };
      } else {
        throw new BuybackError(409, 'That action is not valid for the current buyback request status.');
      }

      await trx.updateTable('buyback_requests').set(update).where('id', '=', id).execute();
      await trx.insertInto('buyback_request_history').values({
        request_id: id,
        status: nextStatus,
        updated_by: auth(req).userId,
        note,
        updated_at: now,
      }).execute();
    });
    const updated = await db.selectFrom('buyback_requests').where('id', '=', id).selectAll().executeTakeFirstOrThrow();
    res.json(updated);
  } catch (error) {
    logFailure('Failed to update buyback request', error, res);
  }
});

buybackRouter.get('/buyback/requests', async (req, res) => {
  if (roleError(req, res, 'user')) return;
  try {
    const requests = await db.selectFrom('buyback_requests as request')
      .innerJoin('users as vendor', 'vendor.id', 'request.vendor_id')
      .where('request.user_id', '=', auth(req).userId)
      .select([
        'request.id',
        'request.vendor_id',
        'request.offer_id',
        'request.device_type',
        'request.condition',
        'request.quantity',
        'request.pricing_unit',
        'request.quoted_unit_price',
        'request.quoted_minimum_price_inr',
        'request.quoted_maximum_price_inr',
        'request.quoted_terms',
        'request.quoted_amount',
        'request.revised_amount',
        'request.final_agreed_amount',
        'request.inspected_condition',
        'request.inspection_notes',
        'request.status',
        'request.payment_status',
        'request.payment_method',
        'request.payment_reference',
        'request.created_at',
        'request.updated_at',
        'request.payment_confirmed_at',
        'vendor.name as vendor_name',
        'vendor.city as service_area',
        'vendor.is_demo as is_demo',
      ])
      .orderBy('request.created_at', 'desc')
      .execute();
    const histories = requests.length
      ? await db.selectFrom('buyback_request_history')
        .where('request_id', 'in', requests.map((request) => request.id))
        .selectAll()
        .orderBy('updated_at', 'asc')
        .execute()
      : [];
    res.json(requests.map((request) => ({
      ...request,
      status_history: histories.filter((entry) => entry.request_id === request.id),
    })));
  } catch (error) {
    logFailure('Failed to load buyback requests', error, res);
  }
});

buybackRouter.post('/buyback/requests', async (req, res) => {
  if (roleError(req, res, 'user')) return;
  const offerId = typeof req.body?.offer_id === 'number' ? req.body.offer_id : Number(req.body?.offer_id);
  const quantity = req.body?.quantity;
  const expectedMinimumPrice = req.body?.expected_minimum_price_inr ?? req.body?.expected_unit_price;
  const expectedMaximumPrice = req.body?.expected_maximum_price_inr ?? req.body?.expected_unit_price;
  if (!Number.isSafeInteger(offerId) || offerId < 1) return res.status(400).json({ message: 'Select a current buyback offer.' });
  try {
    const created = await db.transaction().execute(async (trx) => {
      const offer = await trx.selectFrom('buyback_offers as offer')
        .innerJoin('users as vendor', 'vendor.id', 'offer.vendor_id')
        .where('offer.id', '=', offerId)
        .where('offer.active', '=', 1)
        .where('vendor.role', '=', 'vendor')
        .where('vendor.active', '=', 1)
        .where('vendor.buyback_enabled', '=', 1)
        .select([
          'offer.vendor_id',
          'offer.device_type',
          'offer.condition',
          'offer.minimum_price_inr',
          'offer.maximum_price_inr',
          'offer.amount_inr',
          'offer.terms',
          'offer.pricing_unit',
        ])
        .executeTakeFirst();
      if (!offer) throw new BuybackError(400, 'This buyback offer is no longer available.');
      if (!validPriceRange(expectedMinimumPrice, expectedMaximumPrice)
        || expectedMinimumPrice !== offer.minimum_price_inr
        || expectedMaximumPrice !== offer.maximum_price_inr) {
        throw new BuybackError(409, 'This offer price has changed. Refresh the comparison and review the current amount.');
      }
      if (!validQuantity(quantity, offer.pricing_unit)) {
        throw new BuybackError(400, offer.pricing_unit === 'per_kg'
          ? 'Weight must be greater than 0 and no more than 10000 kg, up to three decimal places.'
          : 'Device quantity must be a whole number between 1 and 10000.');
      }
      const total = roundedAmount(offer.maximum_price_inr * quantity);
      if (total > 1_000_000_000) throw new BuybackError(400, 'The calculated buyback total exceeds the allowed limit.');

      const duplicate = await trx.selectFrom('buyback_requests')
        .where('user_id', '=', auth(req).userId)
        .where('offer_id', '=', offerId)
        .where('status', 'in', [...openStatuses])
        .select('id')
        .executeTakeFirst();
      if (duplicate) throw new BuybackError(409, 'You already have an active request for this offer.');

      const now = new Date().toISOString();
      const buyback = await trx.insertInto('buyback_requests')
        .values({
          user_id: auth(req).userId,
          vendor_id: offer.vendor_id,
          offer_id: offerId,
          device_type: offer.device_type,
          condition: offer.condition,
          quantity,
          pricing_unit: offer.pricing_unit,
          quoted_unit_price: offer.maximum_price_inr,
          quoted_minimum_price_inr: offer.minimum_price_inr,
          quoted_maximum_price_inr: offer.maximum_price_inr,
          quoted_terms: offer.terms,
          quoted_amount: total,
          revised_amount: null,
          final_agreed_amount: null,
          inspected_condition: null,
          inspection_notes: null,
          status: 'requested',
          payment_status: 'unpaid',
          payment_method: null,
          payment_reference: null,
          created_at: now,
          updated_at: now,
          payment_confirmed_at: null,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await trx.insertInto('buyback_request_history').values({
        request_id: buyback.id,
        status: 'requested',
        updated_by: auth(req).userId,
        note: 'Initial quoted price recorded from active offer.',
        updated_at: now,
      }).execute();
      return buyback;
    });
    res.status(201).json(created);
  } catch (error) {
    logFailure('Failed to create buyback request', error, res);
  }
});

buybackRouter.post('/buyback/requests/:id/accept', async (req, res) => {
  if (roleError(req, res, 'user')) return;
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid buyback request ID.' });
  try {
    const updated = await db.transaction().execute(async (trx) => {
      const buyback = await trx.selectFrom('buyback_requests')
        .where('id', '=', id)
        .where('user_id', '=', auth(req).userId)
        .selectAll()
        .executeTakeFirst();
      if (!buyback) throw new BuybackError(404, 'Buyback request not found.');
      if (buyback.status !== 'revised_offer' || buyback.revised_amount === null) {
        throw new BuybackError(409, 'There is no buyback price awaiting your acceptance.');
      }
      const finalAmount = buyback.revised_amount;
      const now = new Date().toISOString();
      const result = await trx.updateTable('buyback_requests')
        .set({ status: 'price_accepted', final_agreed_amount: finalAmount, updated_at: now })
        .where('id', '=', id)
        .where('user_id', '=', auth(req).userId)
        .returningAll()
        .executeTakeFirstOrThrow();
      await trx.insertInto('buyback_request_history').values({
        request_id: id,
        status: 'price_accepted',
        updated_by: auth(req).userId,
        note: `User accepted total price ₹${finalAmount.toFixed(2)}.`,
        updated_at: now,
      }).execute();
      return result;
    });
    res.json(updated);
  } catch (error) {
    logFailure('Failed to accept buyback price', error, res);
  }
});

buybackRouter.post('/buyback/requests/:id/reject-price', async (req, res) => {
  if (roleError(req, res, 'user')) return;
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid buyback request ID.' });
  try {
    const rejected = await db.transaction().execute(async (trx) => {
      const request = await trx.selectFrom('buyback_requests')
        .where('id', '=', id)
        .where('user_id', '=', auth(req).userId)
        .selectAll()
        .executeTakeFirst();
      if (!request) throw new BuybackError(404, 'Buyback request not found.');
      if (request.status !== 'revised_offer') {
        throw new BuybackError(409, 'There is no revised buyback price awaiting your decision.');
      }
      const now = new Date().toISOString();
      const result = await trx.updateTable('buyback_requests')
        .set({ status: 'rejected', updated_at: now })
        .where('id', '=', id)
        .where('user_id', '=', auth(req).userId)
        .returningAll()
        .executeTakeFirstOrThrow();
      await trx.insertInto('buyback_request_history').values({
        request_id: id,
        status: 'rejected',
        updated_by: auth(req).userId,
        note: 'User declined the vendor’s revised final price.',
        updated_at: now,
      }).execute();
      return result;
    });
    res.json(rejected);
  } catch (error) {
    logFailure('Failed to reject buyback price', error, res);
  }
});
