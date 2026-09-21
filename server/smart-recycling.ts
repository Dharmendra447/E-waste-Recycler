import type { DetectionResult } from './ai-detection.js';

export type SmartRecommendationAction = 'Reuse' | 'Repair' | 'Refurbish' | 'Recycle' | 'Special Handling';

export interface SmartRecyclingRecommendation {
  action: SmartRecommendationAction;
  why: string;
  nextSteps: string[];
  safetyPrecautions: string;
  nextAvailableOption: string;
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
      why: 'The detected hazard could make normal reuse, repair, or recycling unsafe.',
      nextSteps: [
        'Stop using the device and keep it away from heat, water, and flammable materials.',
        'Do not open, crush, burn, or dismantle it.',
        'Contact an authorized recycler that accepts hazardous e-waste.',
      ],
      safetyPrecautions: 'Do not handle a swollen, leaking, hot, or damaged battery unnecessarily. Seek specialist guidance.',
      nextAvailableOption: 'Find a recycler with special-handling capability.',
    };
  }

  if (workingTerms.test(condition)) {
    return {
      action: 'Reuse',
      why: 'The device appears to be working and may have useful life remaining.',
      nextSteps: [
        'Continue using it or pass it to someone who can use it.',
        'Back up and remove personal data before donation or handover.',
        'Recycle it through an authorized channel when it is no longer usable.',
      ],
      safetyPrecautions: 'Keep the device intact and stop using it if heat, swelling, leakage, or exposed wiring appears.',
      nextAvailableOption: 'Reuse, donate, or find a recycler when end-of-life handling is needed.',
    };
  }

  if (/partially working|repairable|repair/i.test(condition)) {
    return {
      action: 'Repair',
      why: 'The device may be recoverable with a targeted repair rather than immediate disposal.',
      nextSteps: [
        'Get the device inspected by a qualified technician.',
        'Repair it if the cost and safety assessment are practical.',
        'Reuse or donate it after repair, or send it to an authorized recycler if repair is not practical.',
      ],
      safetyPrecautions: 'Do not attempt repairs involving batteries, power supplies, or exposed wiring unless qualified.',
      nextAvailableOption: 'Find a qualified repair service or authorized recycler.',
    };
  }

  if (refurbishTerms.test(condition)) {
    return {
      action: 'Refurbish',
      why: 'The device appears damaged but does not show a critical safety hazard.',
      nextSteps: [
        'Get the device inspected by a qualified technician.',
        'Refurbish or repair it if economically practical.',
        'Reuse or donate it after refurbishment, or recycle it if recovery is not practical.',
      ],
      safetyPrecautions: 'Keep the device dry and intact. Do not dismantle damaged electronics at home.',
      nextAvailableOption: 'Find a refurbishment service or authorized recycler.',
    };
  }

  return {
    action: 'Recycle',
    why: 'The device is confirmed as e-waste but its condition does not support a safer reuse path from the available information.',
    nextSteps: [
      'Back up and remove personal data when applicable.',
      'Keep the device and components together; do not dismantle it.',
      'Take it to an authorized e-waste collection or recycling channel.',
    ],
    safetyPrecautions: 'Keep the device dry and away from heat. Do not place it in household waste.',
    nextAvailableOption: 'Find an authorized e-waste recycler.',
  };
}