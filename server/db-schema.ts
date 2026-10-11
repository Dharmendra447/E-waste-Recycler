import { ColumnType, Generated } from 'kysely';

export interface UsersTable {
  id: Generated<number>;
  name: string;
  email: string;
  password_hash: string;
  role: 'user' | 'vendor' | 'admin';
  points?: ColumnType<number, number | undefined, number>;
  
  // Vendor-specific fields (nullable)
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  accepted_categories: string | null;
  accepting_pickups: ColumnType<number, number | undefined, number>;
  pickup_capacity: ColumnType<number | null, number | null | undefined, number | null>;
  active: number;
  buyback_enabled: ColumnType<number, number | undefined, number>;
  is_demo: ColumnType<number, number | undefined, number>;
  service_area: string | null;
  demo_description: string | null;
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
  status: 'requested' | 'accepted' | 'confirmed' | 'assigned' | 'scheduled' | 'collected' | 'processing' | 'recycled' | 'rejected' | 'pending' | 'completed' | 'cancelled';
  requested_at: ColumnType<string, string | undefined, string>;
  assigned_at: ColumnType<string, string | undefined, string> | null;
  scheduled_at: string | null;
  collected_at: string | null;
  recycled_at: string | null;
  points_awarded?: number;
}

export interface HistoricalRewardHistoryTable {
  id: Generated<number>;
  user_id: number;
  pickup_id: number;
  points: number;
  reason: string;
  created_at: ColumnType<string, string | undefined, string>;
}

export interface DetectionHistoryTable {
  id: Generated<number>;
  user_id: number;
  device_type: string;
  category: string;
  is_ewaste: number;
  analyzed_at: ColumnType<string, string | undefined, string>;
}

export interface PickupVerificationTable {
  id: Generated<number>;
  pickup_id: number;
  actual_device_type: string;
  quantity: number;
  condition: 'working' | 'partially_working' | 'damaged' | 'non_functional';
  damage_notes: string | null;
  photo_data: string | null;
  photo_mime: string | null;
  verified_by: number;
  verified_at: ColumnType<string, string | undefined, string>;
}

export interface PickupStatusHistoryTable {
  id: Generated<number>;
  pickup_id: number;
  status: string;
  updated_by: number | null;
  updated_at: ColumnType<string, string | undefined, string>;
}

export interface BuybackOfferTable {
  id: Generated<number>;
  vendor_id: number;
  device_type: string;
  condition: 'working' | 'repairable' | 'damaged' | 'scrap';
  minimum_price_inr: number;
  maximum_price_inr: number;
  amount_inr: number;
  terms: string;
  pricing_unit: 'per_device' | 'per_kg';
  active: ColumnType<number, number | undefined, number>;
  created_at: ColumnType<string, string | undefined, string>;
  updated_at: ColumnType<string, string | undefined, string>;
}

export interface BuybackRequestTable {
  id: Generated<number>;
  user_id: number;
  vendor_id: number;
  offer_id: number;
  device_type: string;
  condition: 'working' | 'repairable' | 'damaged' | 'scrap';
  quantity: number;
  pricing_unit: 'per_device' | 'per_kg';
  quoted_unit_price: number;
  quoted_minimum_price_inr: number;
  quoted_maximum_price_inr: number;
  quoted_terms: string;
  quoted_amount: number;
  revised_amount: number | null;
  final_agreed_amount: number | null;
  inspected_condition: 'working' | 'repairable' | 'damaged' | 'scrap' | null;
  inspection_notes: string | null;
  status: 'requested' | 'offer_confirmed' | 'inspection_pending' | 'revised_offer' | 'price_accepted' | 'collected' | 'payment_pending' | 'paid' | 'rejected';
  payment_status: 'unpaid' | 'pending' | 'paid';
  payment_method: 'cash' | 'upi' | 'bank_transfer' | 'other' | null;
  payment_reference: string | null;
  created_at: ColumnType<string, string | undefined, string>;
  updated_at: ColumnType<string, string | undefined, string>;
  payment_confirmed_at: string | null;
}

export interface BuybackRequestHistoryTable {
  id: Generated<number>;
  request_id: number;
  status: string;
  updated_by: number;
  note: string | null;
  updated_at: ColumnType<string, string | undefined, string>;
}

export interface CampaignTable {
  id: Generated<number>;
  name: string;
  target_kg: number;
  start_date: string;
  end_date: string;
  created_by: number;
  created_at: ColumnType<string, string | undefined, string>;
}

export interface CampaignParticipationTable {
  id: Generated<number>;
  campaign_id: number;
  user_id: number;
  pickup_id: number;
  amount_kg: number;
  created_at: ColumnType<string, string | undefined, string>;
}

export interface DB {
  users: UsersTable;
  pickups: PickupTable;
  reward_history: HistoricalRewardHistoryTable;
  detection_history: DetectionHistoryTable;
  pickup_status_history: PickupStatusHistoryTable;
  pickup_verifications: PickupVerificationTable;
  buyback_offers: BuybackOfferTable;
  buyback_requests: BuybackRequestTable;
  buyback_request_history: BuybackRequestHistoryTable;
  campaigns: CampaignTable;
  campaign_participation: CampaignParticipationTable;
}
