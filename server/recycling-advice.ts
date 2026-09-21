import type { DetectionResult } from './ai-detection.js';

export interface RecyclingAdvice {
  recommendedAction: string;
  safetyAdvice: string;
  recyclingGuidance: string;
  relevantSources: string[];
}

interface KnowledgeDocument {
  topic: string;
  keywords: string[];
  content: string;
}

const knowledgeBase: KnowledgeDocument[] = [
  {
    topic: 'E-Waste Safety Guidelines',
    keywords: ['battery', 'lithium', 'damaged', 'broken', 'sharp', 'hazard', 'unknown', 'phone', 'laptop'],
    content: 'Do not open, crush, burn, or place suspected batteries in household waste. Keep damaged electronics dry and away from heat. Avoid touching exposed wires or sharp parts. If a battery is swollen, leaking, hot, or damaged, isolate it from flammable materials and seek guidance from an authorized collection point.',
  },
  {
    topic: 'Recycling Procedures',
    keywords: ['recycle', 'recycling', 'it equipment', 'consumer electronics', 'appliance', 'printer', 'monitor', 'television', 'laptop', 'phone'],
    content: 'Back up and remove personal data before handing over a device when possible. Keep components together, do not dismantle the item, and use an authorized e-waste collection centre, producer take-back programme, or registered recycler. Reusable devices may be repaired or refurbished before recycling.',
  },
  {
    topic: 'Device Information',
    keywords: ['laptop', 'mobile', 'phone', 'monitor', 'television', 'printer', 'refrigerator', 'computer', 'device', 'electronics'],
    content: 'Laptops and mobile devices can contain rechargeable batteries and valuable recoverable materials. Displays, printers, and appliances may contain electronic components that should be handled through dedicated e-waste channels rather than mixed household waste.',
  },
  {
    topic: 'Indian E-Waste Regulations',
    keywords: ['india', 'indian', 'regulation', 'regulations', 'authorized', 'producer', 'recycler', 'collection'],
    content: 'India has e-waste rules and an extended producer responsibility framework for covered electronic and electrical equipment. This project provides general educational information only; check current CPCB guidance and use registered or authorized channels for local compliance requirements.',
  },
];

const eWasteTopics = [
  'E-Waste Safety Guidelines',
  'Recycling Procedures',
  'Indian E-Waste Regulations',
];

function retrieveKnowledge(result: DetectionResult): KnowledgeDocument[] {
  if (!result.isEWaste) {
    return [];
  }

  const query = `${result.deviceType} ${result.category} ${result.condition} ${result.possibleHazard} ${result.isEWaste ? 'e-waste' : 'not e-waste'}`.toLowerCase();
  const ranked = knowledgeBase.map((document) => ({
    document,
    score: document.keywords.reduce((score, keyword) => score + (query.includes(keyword) ? 1 : 0), 0),
  }));

  const selected = ranked
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map(({ document }) => document);

  return eWasteTopics
    .map((topic) => selected.find((document) => document.topic === topic) || knowledgeBase.find((document) => document.topic === topic))
    .filter((document): document is KnowledgeDocument => Boolean(document));
}

export async function generateRecyclingAdvice(result: DetectionResult): Promise<RecyclingAdvice> {
  const documents = retrieveKnowledge(result);
  const hasHazard = result.possibleHazard.toLowerCase() !== 'none detected';
  const advice = result.isEWaste
    ? {
      recommendedAction: 'Use an authorized e-waste collection centre or registered recycler; do not place this item in household waste.',
      safetyAdvice: hasHazard
        ? `Handle the item carefully and avoid contact with the visible hazard: ${result.possibleHazard}. Keep it dry and away from heat.`
        : 'Keep the item dry, avoid dismantling it, and keep it away from heat until it reaches an authorized collection point.',
      recyclingGuidance: `Keep the ${result.deviceType.toLowerCase()} and its components together. ${documents[1]?.content || 'Use an authorized e-waste collection channel.'}`,
    }
    : {
      recommendedAction: 'No e-waste recycling action is indicated for the visible item.',
      safetyAdvice: 'No e-waste-specific hazard was identified in the image.',
      recyclingGuidance: 'Dispose of or reuse the visible item through the ordinary channel appropriate for that item.',
    };

  return { ...advice, relevantSources: result.isEWaste ? eWasteTopics : [] };
}
