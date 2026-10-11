import { randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../server/db.js';

type OfferSeed = {
  device_type: string;
  condition: 'working' | 'repairable' | 'damaged' | 'scrap';
  minimum_price_inr: number;
  maximum_price_inr: number;
  pricing_unit: 'per_device' | 'per_kg';
};

type VendorSeed = {
  slug: string;
  name: string;
  city: string;
  latitude: number;
  longitude: number;
  accepted_categories: string;
  offers: OfferSeed[];
};

const vendor = (
  slug: string,
  name: string,
  city: string,
  latitude: number,
  longitude: number,
  accepted_categories: string,
  offers: OfferSeed[],
): VendorSeed => ({ slug, name, city, latitude, longitude, accepted_categories, offers });

const offer = (
  device_type: string,
  condition: OfferSeed['condition'],
  minimum_price_inr: number,
  maximum_price_inr: number,
  pricing_unit: OfferSeed['pricing_unit'] = 'per_device',
): OfferSeed => ({ device_type, condition, minimum_price_inr, maximum_price_inr, pricing_unit });

const demoVendors: VendorSeed[] = [
  vendor('thane-electronics-recovery', 'Thane Loopback Electronics Demo', 'Thane', 19.2183, 72.9781,
    'Consumer Electronics, Mobile phones, smartphones, chargers, cables, small electronics', [
      offer('Smartphone', 'working', 1000, 5000), offer('Smartphone', 'damaged', 100, 1500),
    ]),
  vendor('thane-battery-safety', 'Thane Battery and Board Lab Demo', 'Thane', 19.2074, 72.9721,
    'Batteries, circuit boards, electrical components, Consumer Electronics', [
      offer('Circuit Board', 'scrap', 50, 500, 'per_kg'), offer('Batteries', 'damaged', 100, 700),
    ]),
  vendor('thane-computer-recycling', 'Thane Bytecycle Computers Demo', 'Thane', 19.2312, 72.9912,
    'IT Equipment, laptops, desktops, computer components, keyboards, mice, Consumer Electronics', [
      offer('Laptop', 'working', 4000, 15000), offer('Desktop Computer', 'working', 2000, 8000),
    ]),
  vendor('mumbai-mobile-reuse', 'Mumbai Pocket Circuit Demo', 'Mumbai', 19.0760, 72.8777,
    'Consumer Electronics, mobile phones, smartphones, tablets, reusable electronics', [
      offer('Smartphone', 'working', 1300, 4800), offer('Tablet', 'working', 2200, 6200),
    ]),
  vendor('mumbai-it-equipment-recycling', 'Mumbai Office Reboot Demo', 'Mumbai', 19.0650, 72.8790,
    'IT Equipment, laptops, desktops, monitors, office computers, Consumer Electronics', [
      offer('Laptop', 'working', 5000, 14500), offer('Monitor', 'working', 500, 3000),
    ]),
  vendor('mumbai-ewaste-components', 'Mumbai Circuit Orchard Demo', 'Mumbai', 19.0880, 72.8670,
    'Circuit boards, cables, electronic components, chargers, accessories, Electrical Component', [
      offer('Circuit Board', 'scrap', 70, 420, 'per_kg'), offer('Chargers and Cables', 'scrap', 20, 180),
    ]),
  vendor('navi-mumbai-battery-collection', 'Navi Mumbai Cellcycle Demo', 'Navi Mumbai', 19.0330, 73.0297,
    'Household electronic batteries, batteries, battery-containing devices, Consumer Electronics', [
      offer('Batteries', 'scrap', 30, 160, 'per_kg'), offer('Smartphone', 'damaged', 150, 1200),
    ]),
  vendor('navi-mumbai-computer-recovery', 'Navi Mumbai Reboot Works Demo', 'Navi Mumbai', 19.0470, 73.0200,
    'IT Equipment, laptops, desktops, computer components, peripherals, Consumer Electronics', [
      offer('Laptop', 'working', 4500, 15500), offer('Laptop', 'damaged', 600, 4700),
    ]),
  vendor('navi-mumbai-general-ewaste', 'Navi Mumbai Everyday E Demo', 'Navi Mumbai', 19.0200, 73.0400,
    'Small household electronics, chargers, cables, supported electronic devices, batteries, Consumer Electronics', [
      offer('Other Electronics', 'working', 100, 900), offer('Chargers and Cables', 'scrap', 15, 160),
    ]),
  vendor('bhiwandi-circuit-circular', 'Bhiwandi Circuit Circular Demo', 'Bhiwandi', 19.2967, 73.0631,
    'Circuit boards, electrical components, scrap electronics, Consumer Electronics', [
      offer('Circuit Board', 'scrap', 55, 360, 'per_kg'), offer('Other Electronics', 'scrap', 25, 220, 'per_kg'),
    ]),
  vendor('bhiwandi-mobile-second-life', 'Bhiwandi Second-Life Mobiles Demo', 'Bhiwandi', 19.2890, 73.0720,
    'Mobile phones, smartphones, tablets, Consumer Electronics', [
      offer('Smartphone', 'working', 1100, 4300), offer('Smartphone', 'repairable', 400, 2100),
    ]),
  vendor('bhiwandi-printer-peripheral-loop', 'Bhiwandi Peripheral Loop Demo', 'Bhiwandi', 19.3100, 73.0500,
    'Printers, keyboards, mice, computer peripherals, office electronics, Consumer Electronics', [
      offer('Printer', 'working', 300, 2200), offer('Keyboard and Mouse', 'working', 50, 500),
    ]),
  vendor('kalyan-laptop-renewal', 'Kalyan Laptop Renewal Demo', 'Kalyan', 19.2437, 73.1355,
    'IT Equipment, laptops, desktops, computer components, Consumer Electronics', [
      offer('Laptop', 'working', 4200, 14200), offer('Laptop', 'repairable', 900, 5200),
    ]),
  vendor('kalyan-phone-rescue', 'Kalyan Phone Rescue Demo', 'Kalyan', 19.2500, 73.1300,
    'Mobile phones, smartphones, tablets, Consumer Electronics', [
      offer('Smartphone', 'working', 900, 4600), offer('Smartphone', 'damaged', 120, 1350),
    ]),
  vendor('kalyan-scrap-electronics-circle', 'Kalyan Scrap Electronics Circle Demo', 'Kalyan', 19.2310, 73.1480,
    'Scrap electronics, batteries, circuit boards, Electrical Component', [
      offer('Circuit Board', 'scrap', 65, 480, 'per_kg'), offer('Batteries', 'scrap', 25, 145, 'per_kg'),
    ]),
  vendor('dombivli-desktop-cycle', 'Dombivli Desktop Cycle Demo', 'Dombivli', 19.2183, 73.0867,
    'IT Equipment, desktop computers, monitors, keyboards, mice, Consumer Electronics', [
      offer('Desktop Computer', 'working', 2300, 7600), offer('Monitor', 'damaged', 250, 1400),
    ]),
  vendor('dombivli-tablet-tradein', 'Dombivli Tablet Trade-In Demo', 'Dombivli', 19.2250, 73.0900,
    'Tablets, smartphones, mobile phones, Consumer Electronics', [
      offer('Tablet', 'working', 1800, 5800), offer('Tablet', 'damaged', 250, 1800),
    ]),
  vendor('vashi-mobile-and-more', 'Vashi Mobile and More Demo', 'Vashi', 19.0770, 72.9980,
    'Mobile phones, smartphones, tablets, chargers, Consumer Electronics', [
      offer('Smartphone', 'working', 1400, 5100), offer('Chargers and Cables', 'working', 25, 240),
    ]),
  vendor('vashi-screen-circuit-reuse', 'Vashi Screen and Circuit Reuse Demo', 'Vashi', 19.0710, 73.0010,
    'Monitors, circuit boards, electrical components, scrap electronics', [
      offer('Monitor', 'working', 600, 3300), offer('Circuit Board', 'scrap', 80, 450, 'per_kg'),
    ]),
  vendor('panvel-computer-return', 'Panvel Computer Return Demo', 'Panvel', 18.9894, 73.1175,
    'IT Equipment, laptops, desktops, printers, office computers, Consumer Electronics', [
      offer('Laptop', 'working', 3900, 13800), offer('Printer', 'repairable', 150, 1250),
    ]),
  vendor('panvel-battery-care', 'Panvel Battery Care Demo', 'Panvel', 18.9950, 73.1050,
    'Batteries, battery-containing devices, chargers, cables, Electrical Component', [
      offer('Batteries', 'scrap', 35, 175, 'per_kg'), offer('Chargers and Cables', 'scrap', 10, 130),
    ]),
  vendor('andheri-phone-reboot', 'Andheri Phone Reboot Demo', 'Andheri', 19.1197, 72.8464,
    'Mobile phones, smartphones, tablets, Consumer Electronics', [
      offer('Smartphone', 'working', 1250, 4900), offer('Smartphone', 'repairable', 450, 2300),
    ]),
  vendor('andheri-office-device-loop', 'Andheri Office Device Loop Demo', 'Andheri', 19.1250, 72.8500,
    'IT Equipment, laptops, monitors, printers, keyboards, mice, Consumer Electronics', [
      offer('Laptop', 'damaged', 700, 4900), offer('Monitor', 'working', 550, 2900),
    ]),
  vendor('borivali-household-electronics', 'Borivali Household Electronics Demo', 'Borivali', 19.2307, 72.8567,
    'Small household electronics, printers, chargers, cables, Consumer Electronics', [
      offer('Printer', 'working', 350, 2100), offer('Other Electronics', 'working', 80, 750),
    ]),
  vendor('borivali-board-and-battery-loop', 'Borivali Board and Battery Loop Demo', 'Borivali', 19.2400, 72.8500,
    'Circuit boards, batteries, electronic components, scrap electronics', [
      offer('Circuit Board', 'scrap', 60, 400, 'per_kg'), offer('Batteries', 'damaged', 80, 650),
    ]),
];

const demoUsers = [
  { slug: 'thane', name: 'Aarav Demo User', city: 'Thane' },
  { slug: 'mumbai', name: 'Mira Demo User', city: 'Mumbai' },
  { slug: 'navi-mumbai', name: 'Ishaan Demo User', city: 'Navi Mumbai' },
  { slug: 'kalyan', name: 'Anaya Demo User', city: 'Kalyan' },
  { slug: 'vashi', name: 'Reyansh Demo User', city: 'Vashi' },
  { slug: 'andheri', name: 'Sana Demo User', city: 'Andheri' },
] as const;

const acceptedCondition: OfferSeed['condition'][] = ['working', 'repairable', 'damaged', 'scrap'];
const pricingUnits: OfferSeed['pricing_unit'][] = ['per_device', 'per_kg'];
const credentialsPath = path.join(process.cwd(), 'demo-credentials.local.json');

interface DemoCredential {
  accountType: 'vendor' | 'user';
  displayName: string;
  email: string;
  password: string;
  serviceLocation: string;
  supportedCategories?: string;
}

function readExistingCredentials(): Map<string, DemoCredential> {
  if (!fs.existsSync(credentialsPath)) return new Map();
  const parsed: unknown = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { accounts?: unknown }).accounts)) {
    throw new Error(`${credentialsPath} is not a valid demo credential manifest.`);
  }
  const result = new Map<string, DemoCredential>();
  for (const item of (parsed as { accounts: unknown[] }).accounts) {
    if (!item || typeof item !== 'object') throw new Error('The demo credential manifest contains an invalid account.');
    const credential = item as Partial<DemoCredential>;
    if (typeof credential.email !== 'string' || typeof credential.password !== 'string' || !credential.password) {
      throw new Error('The demo credential manifest contains an account without a password.');
    }
    result.set(credential.email, credential as DemoCredential);
  }
  return result;
}

async function seed() {
  if (demoVendors.length !== 25 || demoUsers.length !== 6) {
    throw new Error('Demo seed data must contain exactly 25 vendors and 6 users.');
  }

  const tables = await db.introspection.getTables();
  const columns = new Set(tables.find((table) => table.name === 'buyback_offers')?.columns.map((column) => column.name) || []);
  if (!tables.some((table) => table.name === 'buyback_offers')
    || !columns.has('minimum_price_inr')
    || !columns.has('maximum_price_inr')) {
    throw new Error('Buyback price-range schema is missing. Run `npm run migrate` before seeding demo accounts.');
  }

  const existingCredentials = readExistingCredentials();
  const vendorAccounts = demoVendors.map((item) => ({
    type: 'vendor' as const,
    slug: item.slug,
    name: item.name,
    city: item.city,
    email: `${item.slug}@vendors.ecocycle.invalid`,
    categories: item.accepted_categories,
  }));
  const userAccounts = demoUsers.map((item) => ({
    type: 'user' as const,
    slug: item.slug,
    name: item.name,
    city: item.city,
    email: `demo-${item.slug}@users.ecocycle.invalid`,
  }));
  const accountDetails = [...vendorAccounts, ...userAccounts];
  const credentialByEmail = new Map<string, DemoCredential>();
  for (const account of accountDetails) {
    const credential = existingCredentials.get(account.email) || {
      accountType: account.type,
      displayName: account.name,
      email: account.email,
      password: randomBytes(18).toString('base64url'),
      serviceLocation: account.city,
      ...('categories' in account ? { supportedCategories: account.categories } : {}),
    };
    credentialByEmail.set(account.email, {
      ...credential,
      accountType: account.type,
      displayName: account.name,
      serviceLocation: account.city,
      ...('categories' in account ? { supportedCategories: account.categories } : {}),
    });
  }

  const passwordHashByEmail = new Map<string, string>();
  for (const account of accountDetails) {
    passwordHashByEmail.set(account.email, await bcrypt.hash(credentialByEmail.get(account.email)!.password, 10));
  }

  const now = new Date().toISOString();
  await db.transaction().execute(async (trx) => {
    const existingAccounts = new Map<string, { id: number; is_demo: number }>();
    for (const account of accountDetails) {
      const existing = await trx.selectFrom('users')
        .where('email', '=', account.email)
        .select(['id', 'is_demo'])
        .executeTakeFirst();
      if (existing && existing.is_demo !== 1) {
        throw new Error(`Refusing to modify a non-demo account using reserved demo email ${account.email}.`);
      }
      if (existing) existingAccounts.set(account.email, existing);
    }

    for (const item of demoVendors) {
      const email = `${item.slug}@vendors.ecocycle.invalid`;
      const account = vendorAccounts.find((entry) => entry.email === email)!;
      const index = demoVendors.indexOf(item);
      const available = index !== 9 && index !== 16 && index !== 24;
      const profile = {
        name: item.name,
        email,
        password_hash: passwordHashByEmail.get(email)!,
        role: 'vendor' as const,
        points: 0,
        city: item.city,
        address: `DEMO service point near ${item.city} centre`,
        latitude: item.latitude,
        longitude: item.longitude,
        accepted_categories: item.accepted_categories,
        accepting_pickups: available && index % 5 !== 1 ? 1 : 0,
        pickup_capacity: 12 + index % 10,
        active: available ? 1 : 0,
        buyback_enabled: 1,
        is_demo: 1,
        service_area: item.city,
        demo_description: 'Fictional demonstration vendor and illustrative prices only; this is not a verified business or market quote.',
      };
      const existing = existingAccounts.get(email);
      const vendorId = existing
        ? (await trx.updateTable('users').set(profile).where('id', '=', existing.id).where('is_demo', '=', 1).returning('id').executeTakeFirstOrThrow()).id
        : (await trx.insertInto('users').values(profile).returning('id').executeTakeFirstOrThrow()).id;

      for (const vendorOffer of item.offers) {
        if (!acceptedCondition.includes(vendorOffer.condition) || !pricingUnits.includes(vendorOffer.pricing_unit)
          || !Number.isFinite(vendorOffer.minimum_price_inr) || vendorOffer.minimum_price_inr < 0
          || !Number.isFinite(vendorOffer.maximum_price_inr) || vendorOffer.maximum_price_inr < vendorOffer.minimum_price_inr) {
          throw new Error(`Invalid demonstration offer configured for ${item.name}: ${vendorOffer.device_type}.`);
        }
        const values = {
          vendor_id: vendorId,
          ...vendorOffer,
          amount_inr: vendorOffer.maximum_price_inr,
          terms: 'Illustrative demonstration range only. Final amount depends on vendor inspection and confirmation.',
          active: 1,
          updated_at: now,
        };
        const existingOffer = await trx.selectFrom('buyback_offers')
          .where('vendor_id', '=', vendorId)
          .where('device_type', '=', vendorOffer.device_type)
          .where('condition', '=', vendorOffer.condition)
          .where('pricing_unit', '=', vendorOffer.pricing_unit)
          .select('id')
          .executeTakeFirst();
        if (existingOffer) {
          await trx.updateTable('buyback_offers').set(values).where('id', '=', existingOffer.id).execute();
        } else {
          await trx.insertInto('buyback_offers').values({ ...values, created_at: now }).execute();
        }
      }
    }

    for (const item of demoUsers) {
      const email = `demo-${item.slug}@users.ecocycle.invalid`;
      const profile = {
        name: item.name,
        email,
        password_hash: passwordHashByEmail.get(email)!,
        role: 'user' as const,
        points: 0,
        city: item.city,
        address: null,
        latitude: null,
        longitude: null,
        accepted_categories: null,
        accepting_pickups: 1,
        pickup_capacity: null,
        active: 1,
        buyback_enabled: 0,
        is_demo: 1,
        service_area: null,
        demo_description: null,
      };
      const existing = existingAccounts.get(email);
      if (existing) {
        await trx.updateTable('users').set(profile).where('id', '=', existing.id).where('is_demo', '=', 1).execute();
      } else {
        await trx.insertInto('users').values(profile).execute();
      }
    }

    const demoVendorCount = await trx.selectFrom('users')
      .where('role', '=', 'vendor')
      .where('is_demo', '=', 1)
      .select(({ fn }) => fn.countAll<number>().as('count'))
      .executeTakeFirstOrThrow();
    const demoUserCount = await trx.selectFrom('users')
      .where('role', '=', 'user')
      .where('is_demo', '=', 1)
      .select(({ fn }) => fn.countAll<number>().as('count'))
      .executeTakeFirstOrThrow();
    if (Number(demoVendorCount.count) !== 25 || Number(demoUserCount.count) !== 6) {
      throw new Error(`Expected exactly 25 demo vendors and 6 demo users; found ${demoVendorCount.count} vendors and ${demoUserCount.count} users. No accounts were removed.`);
    }
  });

  const credentialManifest = {
    warning: 'LOCAL DEMONSTRATION ONLY. Change or remove these accounts and passwords before production deployment. Prices are fictional examples, not verified market prices.',
    generatedAt: now,
    accounts: accountDetails.map((account) => credentialByEmail.get(account.email)),
  };
  const temporaryManifest = `${credentialsPath}.tmp`;
  fs.writeFileSync(temporaryManifest, `${JSON.stringify(credentialManifest, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temporaryManifest, credentialsPath);

  console.log('Seeded 25 fictional demo vendors and 6 demo users.');
  console.log(`Local credentials saved to ${credentialsPath}`);
  console.log('Demo passwords are not printed to the terminal or stored in the database as plaintext.');
}

seed()
  .catch((error) => {
    console.error('Demo account seeding failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.destroy();
  });
