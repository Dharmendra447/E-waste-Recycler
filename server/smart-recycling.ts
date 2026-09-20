import type { DetectionResult } from './ai-detection.js';

export type SmartRecommendationAction = 'Reuse' | 'Donate' | 'Refurbish' | 'Recycle' | 'Special Handling';

export interface SmartRecyclingRecommendation {
  action: SmartRecommendationAction;
  explanation: string;
}

const hazardTerms = /battery|lithium|toxic|chemical|leak|swollen|fire|flammable|explosive|corrosive|exposed wire|sharp/i;
const workingTerms = /working|good|functional|operational|usable|excellent|intact/i;
const refurbishTerms = /damaged|broken|partially working|repairable|repair|minor fault|fixable|upgrade/i;

export function getSmartRecyclingRecommendation(result: DetectionResult): SmartRecyclingRecommendation | null {
  if (!result.isEWaste) {
    return null;
  }

  const condition = result.condition.trim();
  const hazard = result.possibleHazard.trim();

  if (hazardTerms.test(`${hazard} ${condition}`)) {
    return {
      action: 'Special Handling',
      explanation: 'This device has a potential safety hazard. Do not open, crush, burn, or dismantle it. Use an authorized e-waste collection or recycling channel.',
    };
  }

  if (workingTerms.test(condition)) {
    return {
      action: 'Reuse',
      explanation: 'This device appears to be working. Consider continuing to use it instead of replacing it.',
    };
  }

  if (refurbishTerms.test(condition)) {
    return {
      action: 'Refurbish',
      explanation: 'This device may be repairable. Consider having it checked or refurbished before sending it for recycling.',
    };
  }

  return {
    action: 'Recycle',
    explanation: 'This device should be kept out of household waste and taken to an authorized e-waste collection or recycling channel.',
  };
}