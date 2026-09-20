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
  accepted_categories: string | null;
  active: number;
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
  category: string | null;
  condition: string | null;
  hazard: string | null;
  quantity: number;
  preferred_date: string | null;
  preferred_time: string | null;
  notes: string | null;
  status: 'requested' | 'accepted' | 'scheduled' | 'collected' | 'recycled' | 'rejected' | 'pending' | 'completed' | 'cancelled';
  requested_at: ColumnType<string, string | undefined, string>;
  assigned_at: ColumnType<string, string | undefined, string> | null;
  scheduled_at: string | null;
  collected_at: string | null;
  recycled_at: string | null;
  points_awarded: number;
}

export interface RewardHistoryTable {
  id: Generated<number>;
  user_id: number;
  pickup_id: number;
  points: number;
  reason: string;
  created_at: ColumnType<string, string | undefined, string>;
}

export interface DB {
  users: UsersTable;
  pickups: PickupTable;
  reward_history: RewardHistoryTable;
}
