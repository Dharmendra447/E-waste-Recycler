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

export interface DetectionResult {
  deviceType: string;
  category: string;
  condition: string;
  possibleHazard: string;
  isEWaste: boolean;
  confidence: number;
  description: string;
  recyclingAdvice?: RecyclingAdvice;
}

export interface RecyclingAdvice {
  recommendedAction: string;
  safetyAdvice: string;
  recyclingGuidance: string;
  relevantSources: string[];
}
