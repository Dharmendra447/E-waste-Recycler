import { ColumnType, Generated } from 'kysely';

export interface UsersTable {
  id: Generated<number>;
  name: string;
  email: string;
  password_hash: string;
  role: 'user' | 'vendor' | 'admin';
  points: ColumnType<number, number | undefined, number>;
  
  // Vendor-specific fields (nullable)
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface PickupTable {
  id: Generated<number>;
  user_id: number;
  vendor_id: number | null;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  email: string;
  items_description: string;
  status: 'pending' | 'scheduled' | 'completed' | 'cancelled';
  requested_at: ColumnType<string, string | undefined, string>;
  assigned_at: ColumnType<string, string | undefined, string> | null;
}

export interface DB {
  users: UsersTable;
  pickups: PickupTable;
}
