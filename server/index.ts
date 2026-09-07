import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import { setupStaticServing } from './static-serve.js';
import { db } from './db.js';
import { createAuthMiddleware, AuthRequest } from './auth.js';

// Load environment variables
dotenv.config();

// --- CONFIG ---
const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key';

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
      })
      .returning(['id', 'name', 'email', 'points', 'role', 'city'])
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

    const { password_hash, ...userWithoutPassword } = user;
    res.status(200).json(userWithoutPassword);
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
      .select(['id', 'name', 'email', 'points', 'role', 'city', 'address'])
      .executeTakeFirst();

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json(user);
  } catch {
    res.status(500).json({ message: 'Failed to fetch user profile' });
  }
});

// --- PICKUP ROUTES ---
app.get('/api/pickups', authenticateToken, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const pickups = await db
      .selectFrom('pickups')
      .where('user_id', '=', req.userId)
      .selectAll()
      .orderBy('requested_at', 'desc')
      .execute();

    res.json(pickups);
  } catch {
    res.status(500).json({ message: 'Failed to fetch pickups' });
  }
});

app.post('/api/pickups', authenticateToken, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ message: 'Unauthorized' });

  const { address, items_description, latitude, longitude } = req.body;

  if (!address || !items_description)
    return res.status(400).json({ message: 'Missing required fields' });

  try {
    const user = await db
      .selectFrom('users')
      .where('id', '=', req.userId)
      .select(['name', 'email'])
      .executeTakeFirstOrThrow();

    const newPickup = await db
      .insertInto('pickups')
      .values({
        user_id: req.userId,
        name: user.name,
        email: user.email,
        address,
        items_description,
        latitude,
        longitude,
        status: 'pending',
        requested_at: new Date().toISOString(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await db
      .updateTable('users')
      .set((eb) => ({ points: eb('points', '+', 10) }))
      .where('id', '=', req.userId)
      .execute();

    res.status(201).json(newPickup);
  } catch (err) {
    console.error('Failed to create pickup', err);
    res.status(500).json({ message: 'Failed to create pickup' });
  }
});

// --- VENDOR ROUTES ---
app.get('/api/vendor/pickups/assigned', authenticateToken, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ message: 'Unauthorized' });

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

  try {
    const pickups = await db
      .selectFrom('pickups')
      .where('status', '=', 'pending')
      .selectAll()
      .orderBy('requested_at', 'desc')
      .execute();

    res.json(pickups);
  } catch {
    res.status(500).json({ message: 'Failed to fetch available pickups' });
  }
});

app.put('/api/pickups/:id/assign', authenticateToken, async (req: AuthRequest, res) => {
  if (req.userRole !== 'vendor')
    return res.status(403).json({ message: 'Only vendors can assign pickups.' });

  if (!req.userId)
    return res.status(401).json({ message: 'Unauthorized' });

  const pickupId = parseInt(req.params.id, 10);

  try {
    const updatedPickup = await db
      .updateTable('pickups')
      .set({
        vendor_id: req.userId,
        status: 'scheduled',
        assigned_at: new Date().toISOString(),
      })
      .where('id', '=', pickupId)
      .where('status', '=', 'pending')
      .returningAll()
      .executeTakeFirstOrThrow();

    res.json(updatedPickup);
  } catch (err) {
    console.error('Failed to assign pickup', err);
    res.status(500).json({ message: 'Failed to assign pickup. It may have already been taken.' });
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
      .select(['id', 'name', 'email', 'city', 'address'])
      .execute();

    res.json(vendors);
  } catch {
    res.status(500).json({ message: 'Failed to fetch vendors' });
  }
});

// --- START SERVER ---
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
