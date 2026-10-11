import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import multer from 'multer';

import { setupStaticServing } from './static-serve.js';
import { db } from './db.js';
import { createCapacityCheckedPickup, getActiveQuantity, VendorPickupError, vendorFeaturesRouter } from './vendor-features.js';
import { createAuthMiddleware, AuthRequest } from './auth.js';
import { supportsRecyclerCategory } from './recycler-matching.js';
import { analyzeEWasteImage } from './ai-detection.js';
import { generateRecyclingAdvice } from './recycling-advice.js';
import { getSmartRecyclingRecommendation } from './smart-recycling.js';
import { buybackRouter } from './buyback.js';

// Load root settings first, then preserve the existing client Gemini configuration.
dotenv.config({ path: '.env' });
dotenv.config({ path: 'client/.env' });

// --- CONFIG ---
const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key';
const ECOAI_RAG_SERVICE_URL = process.env.ECOAI_RAG_SERVICE_URL || 'http://127.0.0.1:8000';

const IMPACT_BY_CATEGORY: Record<string, { landfillKg: number; co2Kg: number }> = {
  'IT Equipment': { landfillKg: 8, co2Kg: 12 },
  'Consumer Electronics': { landfillKg: 2, co2Kg: 4 },
  'Household Appliances': { landfillKg: 18, co2Kg: 25 },
  Batteries: { landfillKg: 1, co2Kg: 3 },
  'Electrical Component': { landfillKg: 1, co2Kg: 2 },
};

const EARTH_RADIUS_KM = 6371;
function haversineDistanceKm(latitude1: number, longitude1: number, latitude2: number, longitude2: number) {
  const radians = (value: number) => value * Math.PI / 180;
  const deltaLatitude = radians(latitude2 - latitude1);
  const deltaLongitude = radians(longitude2 - longitude1);
  const value = Math.sin(deltaLatitude / 2) ** 2 + Math.cos(radians(latitude1)) * Math.cos(radians(latitude2)) * Math.sin(deltaLongitude / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function categoryValue(category: unknown): string {
  return typeof category === 'string' && category.trim() ? category.trim() : 'Consumer Electronics';
}

function categoryImpact(category: string) {
  return IMPACT_BY_CATEGORY[category] || IMPACT_BY_CATEGORY['Consumer Electronics'];
}

function environmentalImpact(category: string) {
  const materials: Record<string, string[]> = {
    'IT Equipment': ['Metals', 'Plastics', 'Glass', 'Components'],
    'Consumer Electronics': ['Metals', 'Plastics', 'Glass', 'Components'],
    'Household Appliances': ['Metals', 'Plastics', 'Glass', 'Components'],
    Batteries: ['Metals', 'Battery materials', 'Plastics', 'Components'],
    'Electrical Component': ['Metals', 'Circuit materials', 'Plastics', 'Components'],
  };
  const impact = categoryImpact(category);
  return {
    estimatedWeightKg: impact.landfillKg,
    materialRecoveryPotential: materials[category] || materials['Consumer Electronics'],
    impactSummary: `Estimated based on ${category.toLowerCase()} category.`,
    recyclingBenefit: `May divert approximately ${impact.landfillKg} kg from landfill and avoid an estimated ${impact.co2Kg} kg of CO2 equivalent.`,
    recoveryPercent: Math.min(95, Math.round((impact.landfillKg / 18) * 70)),
  };
}

function estimatedValue(deviceType: string, condition: string, category: string) {
  const device = `${deviceType} ${category}`.toLowerCase();
  const isWorking = /working|functional|good|usable|operational|intact/.test(condition.toLowerCase());
  if (/laptop|computer/.test(device)) return isWorking ? '₹3,000 - ₹7,000' : '₹500 - ₹1,500';
  if (/mobile|phone|tablet/.test(device)) return isWorking ? '₹1,000 - ₹4,000' : '₹200 - ₹800';
  if (/monitor|television|tv|display/.test(device)) return isWorking ? '₹1,500 - ₹4,000' : '₹300 - ₹1,000';
  if (/appliance|refrigerator|printer/.test(device)) return isWorking ? '₹2,000 - ₹8,000' : '₹500 - ₹2,000';
  return isWorking ? '₹500 - ₹2,500' : '₹100 - ₹800';
}

// --- MIDDLEWARE ---
app.use(cors({
  origin: 'http://localhost:3000', // Frontend origin
  credentials: true,               // Allow cookies
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create reusable auth middleware
const authenticateToken = createAuthMiddleware(JWT_SECRET);
const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    callback(null, file.mimetype.startsWith('image/'));
  },
}).single('image');

// --- AUTH ROUTES ---
app.post('/api/register', async (req, res) => {
  const { name, email, password, role, city, address, latitude, longitude } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: 'Name, email, password, and role are required' });
  }

  if (role === 'vendor' && (!city || !address)) {
    return res.status(400).json({ message: 'City and address are required for vendors' });
  }

  try {
    const existingUser = await db.selectFrom('users')
      .where('email', '=', email)
      .select('id')
      .executeTakeFirst();

    if (existingUser) {
      return res.status(409).json({ message: 'User with this email already exists' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const newUser = await db
      .insertInto('users')
      .values({
        name,
        email,
        password_hash,
        role,
        city: role === 'vendor' ? city : null,
        address: role === 'vendor' ? address : null,
        latitude: role === 'vendor' ? (latitude || 0) : null,
        longitude: role === 'vendor' ? (longitude || 0) : null,
        accepted_categories: null,
      })
      .returning(['id', 'name', 'email', 'role', 'city'])
      .executeTakeFirstOrThrow();

    const token = jwt.sign(
      { userId: newUser.id, role: newUser.role },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    res.status(201).json(newUser);
  } catch (err) {
    console.error('Failed to register user:', err);
    res.status(500).json({ message: 'Failed to register user' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ message: 'Email and password are required' });

  try {
    const user = await db
      .selectFrom('users')
      .where('email', '=', email)
      .selectAll()
      .executeTakeFirst();

    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    res.status(200).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      city: user.city,
    });
  } catch (err) {
    console.error('Failed to login:', err);
    res.status(500).json({ message: 'Failed to login' });
  }
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.status(200).json({ message: 'Logged out successfully' });
});

app.get('/api/me', authenticateToken, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ message: 'Not authenticated' });

  try {
    const user = await db
      .selectFrom('users')
      .where('id', '=', req.userId)
      .select(['id', 'name', 'email', 'role', 'city', 'address'])
      .executeTakeFirst();

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json(user);
  } catch {
    res.status(500).json({ message: 'Failed to fetch user profile' });
  }
});

app.post('/api/ecoai-advisor', authenticateToken, async (req: AuthRequest, res) => {
  if (req.userRole !== 'user') {
    return res.status(403).json({ message: 'Only users can use EcoAI Advisor.' });
  }

  const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
  if (!question) {
    return res.status(400).json({ message: 'Please enter a question.' });
  }
  if (question.length > 1000) {
    return res.status(400).json({ message: 'Please keep your question under 1000 characters.' });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35_000);
  try {
    const response = await fetch(`${ECOAI_RAG_SERVICE_URL}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
      signal: controller.signal,
    });

    const responseData = await response.json().catch(() => null);
    if (!response.ok) {
      const message = response.status === 400 ? responseData?.detail : null;
      return res.status(response.status === 400 ? 400 : 502).json({
        message: message || 'EcoAI Advisor is temporarily unavailable.',
      });
    }

    if (typeof responseData?.answer !== 'string' || !Array.isArray(responseData?.sources)) {
      return res.status(502).json({ message: 'EcoAI Advisor returned an invalid response.' });
    }

    res.json(responseData);
  } catch (error) {
    const message = error instanceof Error && error.name === 'AbortError'
      ? 'EcoAI Advisor took too long to respond.'
      : 'EcoAI Advisor is unavailable. Please start the RAG service and try again.';
    res.status(502).json({ message });
  } finally {
    clearTimeout(timeout);
  }
});

app.post('/api/ai-detection', authenticateToken, (req: AuthRequest, res, next) => {
  if (req.userRole !== 'user') {
    return res.status(403).json({ message: 'Only users can use AI detection.' });
  }

  uploadImage(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      return res.status(400).json({ message: 'The image must be 10 MB or smaller.' });
    }
    if (error) {
      return res.status(400).json({ message: 'Please upload a valid image file.' });
    }
    next();
  });
}, async (req: AuthRequest, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Please upload an image to analyze.' });
  }

  try {
    const analysis = await analyzeEWasteImage(req.file.buffer, req.file.mimetype);
    const smartRecommendation = getSmartRecyclingRecommendation(analysis);
    const responseBase = {
      ...analysis,
      ...(smartRecommendation ? { smartRecommendation } : {}),
      estimatedValue: analysis.isEWaste ? estimatedValue(analysis.deviceType, analysis.condition, analysis.category) : null,
      environmentalImpact: analysis.isEWaste ? environmentalImpact(categoryValue(analysis.category)) : null,
    };
    try {
      await db.insertInto('detection_history').values({
        user_id: req.userId!,
        device_type: analysis.deviceType,
        category: categoryValue(analysis.category),
        is_ewaste: analysis.isEWaste ? 1 : 0,
        analyzed_at: new Date().toISOString(),
      }).execute();
    } catch (error) {
      console.error('Failed to record detection history:', error);
    }
    try {
      const recyclingAdvice = await generateRecyclingAdvice(analysis);
      res.json({ ...responseBase, recyclingAdvice });
    } catch (error) {
      console.error('Failed to generate recycling advice:', error);
      res.json(responseBase);
    }
  } catch (error) {
    console.error('Failed to analyze e-waste image:', error);
    const message = error instanceof Error ? error.message : 'Failed to analyze the image.';
    res.status(502).json({ message });
  }
});

// --- RECYCLER AND PICKUP ROUTES ---
app.get('/api/recyclers', authenticateToken, async (req: AuthRequest, res) => {
  if (req.userRole !== 'user') return res.status(403).json({ message: 'Only users can find recyclers.' });

  const search = typeof req.query.category === 'string' ? req.query.category.trim().toLowerCase() : '';
  const requestedCity = typeof req.query.city === 'string' ? req.query.city.trim().toLowerCase() : '';
  const hazardRequested = typeof req.query.hazard === 'string' && /battery|batteries|leak|swollen|chemical|fire|hazard|special/i.test(req.query.hazard);
  const latitude = Number(req.query.latitude);
  const longitude = Number(req.query.longitude);
  try {
      const candidates = await db.selectFrom('users')
      .where('role', '=', 'vendor')
      .where('active', '=', 1)
      .where('accepting_pickups', '=', 1)
      .select(['id', 'name', 'email', 'city', 'address', 'latitude', 'longitude', 'accepted_categories', 'active', 'pickup_capacity', 'is_demo', 'service_area', 'demo_description'])
      .execute();
      const candidatesWithAvailability = await Promise.all(candidates.map(async (recycler) => ({
        ...recycler,
        active_quantity: await getActiveQuantity(db, recycler.id),
      })));
      const recyclers = candidatesWithAvailability.filter((recycler) => {
        const categories = recycler.accepted_categories || '';
        if (search && !supportsRecyclerCategory(categories, search)) return false;
        return recycler.pickup_capacity === null || recycler.active_quantity < recycler.pickup_capacity;
      });
    const ranked = recyclers.map((recycler) => {
      const accepted = (recycler.accepted_categories || '').toLowerCase();
      const categoryMatch = !search ? 20 : supportsRecyclerCategory(accepted, search) ? 40 : 0;
      const handlesHazard = /battery|batteries|special|hazard|safe handling/.test(accepted);
      const hazardMatch = hazardRequested ? (handlesHazard ? 30 : 0) : 30;
      const hasLocation = Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 && (latitude !== 0 || longitude !== 0) && recycler.latitude !== null && recycler.longitude !== null && Math.abs(recycler.latitude) <= 90 && Math.abs(recycler.longitude) <= 180 && (recycler.latitude !== 0 || recycler.longitude !== 0);
      const distance = hasLocation ? haversineDistanceKm(latitude, longitude, recycler.latitude!, recycler.longitude!) : null;
      const proximity = distance === null ? 10 : Math.max(0, Math.round(30 - Math.min(distance, 30)));
      const serviceArea = recycler.service_area || recycler.city;
      const locationMatch = Boolean(requestedCity && serviceArea && serviceArea.trim().toLowerCase() === requestedCity);
      return { ...recycler, service_area: serviceArea, distanceKm: distance === null ? null : Number(distance.toFixed(1)), matchScore: Math.min(100, categoryMatch + hazardMatch + proximity), specialHandling: handlesHazard, locationMatch };
    }).sort((left, right) => {
      if (requestedCity && left.locationMatch !== right.locationMatch) return left.locationMatch ? -1 : 1;
      const hasUserLocation = Number.isFinite(latitude) && Number.isFinite(longitude) && latitude !== 0 && longitude !== 0;
      if (hasUserLocation) {
        if (left.distanceKm !== null && right.distanceKm !== null) return left.distanceKm - right.distanceKm;
        if (left.distanceKm !== null) return -1;
        if (right.distanceKm !== null) return 1;
      }
      return right.matchScore - left.matchScore;
    });
    res.json(ranked);
  } catch {
    res.status(500).json({ message: 'Failed to fetch recyclers' });
  }
});

app.get('/api/pickups', authenticateToken, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const pickups = await db
      .selectFrom('pickups')
      .where('user_id', '=', req.userId)
      .selectAll()
      .orderBy('requested_at', 'desc')
      .execute();
    const enrichedPickups = await Promise.all(pickups.map(async (pickup) => {
      const [recycler, latestStatus] = await Promise.all([
        pickup.vendor_id ? db.selectFrom('users').where('id', '=', pickup.vendor_id).select('name').executeTakeFirst() : Promise.resolve(null),
        db.selectFrom('pickup_status_history').where('pickup_id', '=', pickup.id).select(['status', 'updated_at']).orderBy('updated_at', 'desc').executeTakeFirst(),
      ]);
      return { ...pickup, recyclerName: recycler?.name || null, lastStatus: latestStatus?.status || pickup.status, lastStatusUpdate: latestStatus?.updated_at || pickup.requested_at };
    }));

    res.json(enrichedPickups);
  } catch {
    res.status(500).json({ message: 'Failed to fetch pickups' });
  }
});

app.post('/api/pickups', authenticateToken, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ message: 'Unauthorized' });

  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ message: 'Pickup details must be submitted as a JSON object.' });
  }

  const { address, items_description, latitude, longitude, category, condition, hazard, quantity, preferred_date, preferred_time, vendor_id, notes } = body;
  if (typeof address !== 'string' || !address.trim()) {
    return res.status(400).json({ message: 'Enter a pickup address.' });
  }
  if (typeof items_description !== 'string' || !items_description.trim()) {
    return res.status(400).json({ message: 'Describe the e-waste items for collection.' });
  }
  if (typeof category !== 'string' || !category.trim()) {
    return res.status(400).json({ message: 'Enter an e-waste category.' });
  }
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10000) {
    return res.status(400).json({ message: 'Quantity must be a whole number between 1 and 10000.' });
  }
  if (typeof preferred_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(preferred_date)
    || Number.isNaN(Date.parse(`${preferred_date}T00:00:00.000Z`))
    || new Date(`${preferred_date}T00:00:00.000Z`).toISOString().slice(0, 10) !== preferred_date) {
    return res.status(400).json({ message: 'Choose a valid preferred pickup date.' });
  }
  if (typeof preferred_time !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(preferred_time)) {
    return res.status(400).json({ message: 'Choose a valid preferred pickup time.' });
  }
  if (!Number.isSafeInteger(vendor_id) || vendor_id < 1) {
    return res.status(400).json({ message: 'Select a valid recycler.' });
  }
  const hasLatitude = latitude !== undefined && latitude !== null;
  const hasLongitude = longitude !== undefined && longitude !== null;
  if (hasLatitude !== hasLongitude
    || (hasLatitude && (typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90))
    || (hasLongitude && (typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180))) {
    return res.status(400).json({ message: 'Pickup coordinates must include a valid latitude and longitude.' });
  }
  if (condition !== undefined && condition !== null && typeof condition !== 'string') {
    return res.status(400).json({ message: 'Condition must be text.' });
  }
  if (hazard !== undefined && hazard !== null && typeof hazard !== 'string') {
    return res.status(400).json({ message: 'Hazard information must be text.' });
  }
  if (notes !== undefined && notes !== null && typeof notes !== 'string') {
    return res.status(400).json({ message: 'Pickup notes must be text.' });
  }

  try {
    const user = await db
      .selectFrom('users')
      .where('id', '=', req.userId)
      .select(['name', 'email'])
      .executeTakeFirstOrThrow();

    const newPickup = await createCapacityCheckedPickup({
      userId: req.userId,
      name: user.name,
      email: user.email,
      address: address.trim(),
      items_description: items_description.trim(),
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      category: category.trim(),
      condition: typeof condition === 'string' && condition.trim() ? condition.trim() : null,
      hazard: typeof hazard === 'string' && hazard.trim() ? hazard.trim() : null,
      quantity,
      preferred_date,
      preferred_time,
      notes: typeof notes === 'string' && notes.trim() ? notes.trim() : null,
      vendorId: vendor_id,
    });

    res.status(201).json(newPickup);
  } catch (err) {
    if (err instanceof VendorPickupError) {
      return res.status(err.status).json({ message: err.message });
    }
    console.error('Pickup creation failed', err);
    res.status(500).json({ message: 'Pickup request could not be saved. Please try again.' });
  }
});

// --- VENDOR ROUTES ---
app.get('/api/vendor/pickups/assigned', authenticateToken, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ message: 'Unauthorized' });
  if (req.userRole !== 'vendor') return res.status(403).json({ message: 'Only vendors can view assigned pickups.' });

  try {
    const pickups = await db
      .selectFrom('pickups')
      .where('vendor_id', '=', req.userId)
      .selectAll()
      .orderBy('assigned_at', 'desc')
      .execute();

    res.json(pickups);
  } catch {
    res.status(500).json({ message: 'Failed to fetch assigned pickups' });
  }
});

app.get('/api/vendor/pickups/available', authenticateToken, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ message: 'Unauthorized' });
  if (req.userRole !== 'vendor') return res.status(403).json({ message: 'Only vendors can view available pickups.' });

  try {
    const pickups = await db
      .selectFrom('pickups')
      .where('vendor_id', '=', req.userId)
      .where('status', 'in', ['requested', 'pending'])
      .selectAll()
      .orderBy('requested_at', 'desc')
      .execute();

    res.json(pickups);
  } catch {
    res.status(500).json({ message: 'Failed to fetch available pickups' });
  }
});

app.get('/api/vendor/overview', authenticateToken, async (req: AuthRequest, res) => {
  if (req.userRole !== 'vendor') return res.status(403).json({ message: 'Only vendors can view this overview.' });
  if (!req.userId) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const pickups = await db.selectFrom('pickups').where('vendor_id', '=', req.userId).select(['status']).execute();
    res.json({ newRequests: pickups.filter((pickup) => pickup.status === 'requested' || pickup.status === 'pending').length, scheduled: pickups.filter((pickup) => pickup.status === 'scheduled').length, collected: pickups.filter((pickup) => pickup.status === 'collected').length, completed: pickups.filter((pickup) => pickup.status === 'recycled').length });
  } catch {
    res.status(500).json({ message: 'Failed to fetch vendor overview.' });
  }
});

app.put('/api/pickups/:id/status', authenticateToken, async (req: AuthRequest, res) => {
  if (req.userRole !== 'vendor' && req.userRole !== 'admin')
    return res.status(403).json({ message: 'Only recyclers or admins can update pickup status.' });

  if (!req.userId)
    return res.status(401).json({ message: 'Unauthorized' });

  const pickupId = parseInt(req.params.id, 10);
  const nextStatus = req.body?.status;
  const allowedStatuses = ['accepted', 'confirmed', 'assigned', 'scheduled', 'collected', 'processing', 'recycled', 'rejected'] as const;
  if (!allowedStatuses.includes(nextStatus)) return res.status(400).json({ message: 'Invalid pickup status.' });

  try {
    const pickup = await db.selectFrom('pickups').where('id', '=', pickupId).selectAll().executeTakeFirst();
    if (!pickup) return res.status(404).json({ message: 'Pickup not found.' });
    if (req.userRole === 'vendor' && pickup.vendor_id !== req.userId) return res.status(403).json({ message: 'This pickup belongs to another vendor.' });
    const currentStatus = pickup.status === 'pending' ? 'requested' : pickup.status === 'accepted' ? 'confirmed' : pickup.status;
    const validNextStatuses: Record<string, string[]> = {
      requested: ['accepted', 'confirmed', 'rejected'],
      confirmed: ['assigned', 'scheduled'],
      assigned: ['scheduled'],
      scheduled: ['collected'],
      collected: ['processing'],
      processing: ['recycled'],
    };
    if (!validNextStatuses[currentStatus]?.includes(nextStatus)) {
      return res.status(409).json({ message: `Invalid status transition from ${currentStatus} to ${nextStatus}.` });
    }
    if (req.userRole === 'vendor' && nextStatus === 'collected') {
      return res.status(409).json({ message: 'Complete the pickup verification form to mark this pickup collected.' });
    }

    const now = new Date().toISOString();
    const updatedPickup = await db.transaction().execute(async (trx) => {
      const updateValues = {
        vendor_id: req.userRole === 'vendor' ? req.userId : pickup.vendor_id,
        status: nextStatus,
        assigned_at: pickup.assigned_at || now,
        scheduled_at: nextStatus === 'scheduled' ? now : pickup.scheduled_at,
        collected_at: nextStatus === 'collected' ? now : pickup.collected_at,
        recycled_at: nextStatus === 'recycled' ? now : pickup.recycled_at,
      } as const;
      let updated = await trx.updateTable('pickups').set(updateValues).where('id', '=', pickupId).returningAll().executeTakeFirstOrThrow();
      await trx.insertInto('pickup_status_history').values({ pickup_id: pickupId, status: nextStatus, updated_by: req.userId, updated_at: now }).execute();

      return updated;
    });

    res.json(updatedPickup);
  } catch (err) {
    console.error('Failed to assign pickup', err);
    res.status(500).json({ message: 'Failed to assign pickup. It may have already been taken.' });
  }
});

app.put('/api/pickups/:id/assign', authenticateToken, async (req: AuthRequest, res) => {
  req.body = { status: 'confirmed' };
  return res.redirect(307, `/api/pickups/${req.params.id}/status`);
});

app.get('/api/pickups/:id/certificate', authenticateToken, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ message: 'Unauthorized' });
  const pickupId = Number(req.params.id);
  try {
    const pickup = await db.selectFrom('pickups').where('id', '=', pickupId).selectAll().executeTakeFirst();
    if (!pickup || (pickup.user_id !== req.userId && req.userRole !== 'admin' && req.userRole !== 'vendor')) return res.status(404).json({ message: 'Pickup not found.' });
    if (pickup.status !== 'recycled') return res.status(409).json({ message: 'A certificate is available after recycling is completed.' });
    const [user, recycler] = await Promise.all([
      db.selectFrom('users').where('id', '=', pickup.user_id).select(['name']).executeTakeFirstOrThrow(),
      pickup.vendor_id ? db.selectFrom('users').where('id', '=', pickup.vendor_id).select(['name']).executeTakeFirst() : Promise.resolve(null),
    ]);
    const impact = categoryImpact(categoryValue(pickup.category));
    res.json({ certificateId: `EWR-${pickup.id}-${(pickup.recycled_at || '').slice(0, 10).replace(/-/g, '')}`, userName: user.name, device: pickup.items_description, category: categoryValue(pickup.category), recyclerName: recycler?.name || 'Authorized recycler', recyclingDate: pickup.recycled_at, estimatedEwasteDivertedKg: impact.landfillKg * Math.max(1, pickup.quantity), status: 'Recycled', applicationIssued: true });
  } catch {
    res.status(500).json({ message: 'Failed to generate recycling certificate.' });
  }
});

app.get('/api/campaigns', authenticateToken, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const campaigns = await db.selectFrom('campaigns').selectAll().orderBy('start_date', 'desc').execute();
    const participation = await db.selectFrom('campaign_participation').where('user_id', '=', req.userId).select(['campaign_id', 'pickup_id']).execute();
    const today = new Date().toISOString().slice(0, 10);
    const results = await Promise.all(campaigns.filter((campaign) => campaign.start_date <= today && campaign.end_date >= today).map(async (campaign) => {
      const totals = await db.selectFrom('campaign_participation').where('campaign_id', '=', campaign.id).select(({ fn }) => [fn.sum<number>('amount_kg').as('collectedKg'), fn.countAll<number>().as('participants')]).executeTakeFirstOrThrow();
      const collectedKg = Number(totals.collectedKg || 0);
      return { ...campaign, collectedKg, participants: Number(totals.participants || 0), progressPercent: Math.min(100, Math.round(collectedKg / campaign.target_kg * 100)), joinedPickupIds: participation.filter((item) => item.campaign_id === campaign.id).map((item) => item.pickup_id) };
    }));
    res.json(results);
  } catch {
    res.status(500).json({ message: 'Failed to fetch campaigns.' });
  }
});

app.post('/api/campaigns/:id/participate', authenticateToken, async (req: AuthRequest, res) => {
  if (!req.userId || req.userRole !== 'user') return res.status(403).json({ message: 'Only users can participate in campaigns.' });
  const campaignId = Number(req.params.id);
  const pickupId = Number(req.body?.pickup_id);
  if (!pickupId) return res.status(400).json({ message: 'Select one of your recycled pickups to participate.' });
  try {
    const campaign = await db.selectFrom('campaigns').where('id', '=', campaignId).selectAll().executeTakeFirst();
    const pickup = await db.selectFrom('pickups').where('id', '=', pickupId).where('user_id', '=', req.userId).selectAll().executeTakeFirst();
    if (!campaign || !pickup) return res.status(404).json({ message: 'Campaign or pickup not found.' });
    if (pickup.status !== 'recycled') return res.status(409).json({ message: 'Only recycled pickups can contribute to a campaign.' });
    const amountKg = categoryImpact(categoryValue(pickup.category)).landfillKg * Math.max(1, pickup.quantity);
    await db.insertInto('campaign_participation').values({ campaign_id: campaignId, user_id: req.userId, pickup_id: pickupId, amount_kg: amountKg, created_at: new Date().toISOString() }).execute();
    res.status(201).json({ message: 'Participation recorded.', amountKg });
  } catch {
    res.status(409).json({ message: 'This pickup may already be participating in the campaign.' });
  }
});

app.post('/api/admin/campaigns', authenticateToken, async (req: AuthRequest, res) => {
  if (req.userRole !== 'admin' || !req.userId) return res.status(403).json({ message: 'Admins only.' });
  const { name, target_kg, start_date, end_date } = req.body || {};
  if (!name || !Number(target_kg) || !start_date || !end_date) return res.status(400).json({ message: 'Name, target, start date, and end date are required.' });
  try {
    const campaign = await db.insertInto('campaigns').values({ name, target_kg: Number(target_kg), start_date, end_date, created_by: req.userId, created_at: new Date().toISOString() }).returningAll().executeTakeFirstOrThrow();
    res.status(201).json(campaign);
  } catch {
    res.status(500).json({ message: 'Failed to create campaign.' });
  }
});

app.get('/api/impact', authenticateToken, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const pickups = await db.selectFrom('pickups').where('user_id', '=', req.userId).where('status', '=', 'recycled').select(['category', 'quantity']).execute();
    const impact = pickups.reduce((total, pickup) => {
      const values = categoryImpact(categoryValue(pickup.category));
      const quantity = Math.max(1, pickup.quantity);
      return { devices: total.devices + quantity, landfillKg: total.landfillKg + values.landfillKg * quantity, co2Kg: total.co2Kg + values.co2Kg * quantity };
    }, { devices: 0, landfillKg: 0, co2Kg: 0 });
    res.json({ ...impact, completedPickups: pickups.length });
  } catch {
    res.status(500).json({ message: 'Failed to calculate eco impact' });
  }
});

app.get('/api/activity', authenticateToken, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const [pickups, detections] = await Promise.all([
      db.selectFrom('pickups').where('user_id', '=', req.userId).select(['items_description', 'category', 'quantity', 'status', 'requested_at', 'recycled_at']).orderBy('requested_at', 'desc').execute(),
      db.selectFrom('detection_history').where('user_id', '=', req.userId).selectAll().orderBy('analyzed_at', 'desc').execute(),
    ]);
    const recycledPickups = pickups.filter((pickup) => pickup.status === 'recycled' || pickup.status === 'completed');
    const recentActivity = [
      ...detections.map((detection) => ({ type: 'AI Analysis', detail: `${detection.device_type} analyzed`, occurredAt: detection.analyzed_at })),
      ...pickups.map((pickup) => ({
        type: pickup.status === 'recycled' || pickup.status === 'completed' ? 'Recycling Completed' : 'Pickup Requested',
        detail: pickup.items_description,
        occurredAt: pickup.recycled_at || pickup.requested_at,
      })),
    ].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)).slice(0, 8);
    const diverted = recycledPickups.reduce((total, pickup) => total + categoryImpact(categoryValue(pickup.category)).landfillKg * Math.max(1, pickup.quantity || 1), 0);
    res.json({
      devicesAnalyzed: detections.length,
      pickupsRequested: pickups.length,
      itemsRecycled: recycledPickups.reduce((total, pickup) => total + Math.max(1, pickup.quantity || 1), 0),
      estimatedEwasteDivertedKg: diverted,
      recentActivity,
    });
  } catch (error) {
    console.error('Failed to fetch recycling activity:', error);
    res.status(500).json({ message: 'Failed to fetch recycling activity' });
  }
});

// --- ADMIN ROUTES ---
app.get('/api/admin/vendors', authenticateToken, async (req: AuthRequest, res) => {
  if (req.userRole !== 'admin')
    return res.status(403).json({ message: 'Forbidden: Admins only.' });

  try {
    const vendors = await db
      .selectFrom('users')
      .where('role', '=', 'vendor')
      .select(['id', 'name', 'email', 'city', 'address', 'accepted_categories', 'active'])
      .execute();

    res.json(vendors);
  } catch {
    res.status(500).json({ message: 'Failed to fetch vendors' });
  }
});

app.get('/api/admin/overview', authenticateToken, async (req: AuthRequest, res) => {
  if (req.userRole !== 'admin') return res.status(403).json({ message: 'Forbidden: Admins only.' });
  try {
    const [users, vendors, pickups, recycled, impact] = await Promise.all([
      db.selectFrom('users').where('role', '=', 'user').select(({ fn }) => fn.countAll<number>().as('count')).executeTakeFirstOrThrow(),
      db.selectFrom('users').where('role', '=', 'vendor').select(({ fn }) => fn.countAll<number>().as('count')).executeTakeFirstOrThrow(),
      db.selectFrom('pickups').select(({ fn }) => fn.countAll<number>().as('count')).executeTakeFirstOrThrow(),
      db.selectFrom('pickups').where('status', '=', 'recycled').select(({ fn }) => fn.countAll<number>().as('count')).executeTakeFirstOrThrow(),
      db.selectFrom('pickups').where('status', '=', 'recycled').select(['category', 'quantity']).execute(),
    ]);
    const totalEwasteDivertedKg = impact.reduce((sum, item) => sum + categoryImpact(categoryValue(item.category)).landfillKg * Math.max(1, item.quantity), 0);
    res.json({ totalUsers: Number(users.count), totalVendors: Number(vendors.count), totalPickups: Number(pickups.count), completedRecycling: Number(recycled.count), totalEwasteDivertedKg });
  } catch {
    res.status(500).json({ message: 'Failed to fetch admin overview.' });
  }
});

// --- START SERVER ---
app.use('/api', authenticateToken, buybackRouter);
app.use('/api/vendor', authenticateToken, vendorFeaturesRouter);

export async function startServer(port: number) {
  try {
    if (process.env.NODE_ENV === 'production') {
      setupStaticServing(app);
    }

    app.listen(port, () => {
      console.log(`✅ API Server running on port ${port}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Start immediately if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Starting server...');
  startServer(PORT);
}
