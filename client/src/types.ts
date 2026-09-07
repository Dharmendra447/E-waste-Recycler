export interface Pickup {
  id: number;
  user_id: number;
  name: string;
  address: string;
  email: string;
  items_description: string;
  status: 'pending' | 'scheduled' | 'completed' | 'cancelled';
  requested_at: string;
  latitude?: number | null;
  longitude?: number | null;
}
