export interface Pickup {
  id: number;
  user_id: number;
  name: string;
  address: string;
  email: string;
  items_description: string;
  vendor_id?: number | null;
  category?: string | null;
  condition?: string | null;
  hazard?: string | null;
  quantity?: number;
  preferred_date?: string | null;
  preferred_time?: string | null;
  notes?: string | null;
  status: 'requested' | 'accepted' | 'scheduled' | 'collected' | 'recycled' | 'rejected' | 'pending' | 'completed' | 'cancelled';
  requested_at: string;
  assigned_at?: string | null;
  scheduled_at?: string | null;
  collected_at?: string | null;
  recycled_at?: string | null;
  points_awarded?: number;
  latitude?: number | null;
  longitude?: number | null;
}

export interface Recycler {
  id: number;
  name: string;
  email: string;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  accepted_categories: string | null;
}

export interface DetectionResult {
  deviceType: string;
  category: string;
  condition: string;
  possibleHazard: string;
  isEWaste: boolean;
  confidence: number;
  description: string;
  recyclingAdvice?: RecyclingAdvice;
  smartRecommendation?: SmartRecyclingRecommendation;
}

export interface SmartRecyclingRecommendation {
  action: 'Reuse' | 'Donate' | 'Refurbish' | 'Recycle' | 'Special Handling';
  explanation: string;
}

export interface RecyclingAdvice {
  recommendedAction: string;
  safetyAdvice: string;
  recyclingGuidance: string;
  relevantSources: string[];
}
