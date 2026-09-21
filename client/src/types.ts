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
  status: 'requested' | 'accepted' | 'confirmed' | 'assigned' | 'scheduled' | 'collected' | 'processing' | 'recycled' | 'rejected' | 'pending' | 'completed' | 'cancelled';
  requested_at: string;
  assigned_at?: string | null;
  scheduled_at?: string | null;
  collected_at?: string | null;
  recycled_at?: string | null;
  points_awarded?: number;
  latitude?: number | null;
  longitude?: number | null;
  recyclerName?: string | null;
  lastStatus?: string;
  lastStatusUpdate?: string;
}

export interface Campaign {
  id: number;
  name: string;
  target_kg: number;
  start_date: string;
  end_date: string;
  collectedKg: number;
  participants: number;
  progressPercent: number;
  joinedPickupIds: number[];
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
  active?: number;
  distanceKm?: number | null;
  matchScore?: number;
  specialHandling?: boolean;
}

export interface EcoImpact {
  devices: number;
  landfillKg: number;
  co2Kg: number;
  points: number;
  completedPickups: number;
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
  estimatedValue?: string | null;
  environmentalImpact?: EnvironmentalImpact | null;
}

export interface SmartRecyclingRecommendation {
  action: 'Reuse' | 'Repair' | 'Refurbish' | 'Recycle' | 'Special Handling';
  why: string;
  nextSteps: string[];
  safetyPrecautions: string;
  nextAvailableOption: string;
}

export interface EnvironmentalImpact {
  estimatedWeightKg: number;
  materialRecoveryPotential: string[];
  impactSummary: string;
  recyclingBenefit: string;
  recoveryPercent: number;
}

export interface RecyclingActivity {
  devicesAnalyzed: number;
  pickupsRequested: number;
  itemsRecycled: number;
  rewardPoints: number;
  estimatedEwasteDivertedKg: number;
  recentActivity: Array<{ type: string; detail: string; occurredAt: string }>;
}

export interface RecyclingAdvice {
  recommendedAction: string;
  safetyAdvice: string;
  recyclingGuidance: string;
  relevantSources: string[];
}
