import { db } from '../server/db.js';
import bcrypt from 'bcrypt';

async function seed() {
    console.log('Seeding database...');
    const saltRounds = 10;

    // Clear existing users to avoid duplicates
    await db.deleteFrom('users').execute();
    console.log('Cleared existing users.');

    const accounts = [
        // Vendors
        { name: 'Mumbai E-Waste Recyclers', email: 'mumbai@ewaste.com', password: 'password', role: 'vendor', city: 'Mumbai', address: '123, Marine Drive, Mumbai', latitude: 18.9437, longitude: 72.8258 },
        { name: 'Pune Green Tech', email: 'pune@greentech.com', password: 'password', role: 'vendor', city: 'Pune', address: '456, MG Road, Pune', latitude: 18.5204, longitude: 73.8567 },
        // Admin
        { name: 'Admin User', email: 'admin@ewaste.com', password: 'adminpassword', role: 'admin' },
        // Regular User
        { name: 'Test User', email: 'user@test.com', password: 'password', role: 'user' },
    ];

    for (const account of accounts) {
        const password_hash = await bcrypt.hash(account.password, saltRounds);
        await db.insertInto('users').values({
            name: account.name,
            email: account.email,
            password_hash,
            role: account.role,
            city: account.city || null,
            address: account.address || null,
            latitude: account.latitude || null,
            longitude: account.longitude || null,
        }).execute();
    }

    console.log('Seeding complete!');
    await db.destroy();
}

seed().catch(error => {
    console.error('Seeding failed:', error);
    process.exit(1);
});
