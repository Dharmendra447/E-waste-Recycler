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

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: { message?: string };
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

function parseAdvice(text: string): RecyclingAdvice {
  const withoutCodeFence = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const value = JSON.parse(withoutCodeFence) as Record<string, unknown>;

  const stringFields = ['recommendedAction', 'safetyAdvice', 'recyclingGuidance'];
  for (const field of stringFields) {
    if (typeof value[field] !== 'string' || !value[field].trim()) {
      throw new Error('The AI returned incomplete recycling advice.');
    }
  }

  if (!Array.isArray(value.relevantSources) || value.relevantSources.length === 0 || value.relevantSources.some((source) => typeof source !== 'string' || !source.trim())) {
    throw new Error('The AI returned invalid recycling advice sources.');
  }

  return {
    recommendedAction: value.recommendedAction as string,
    safetyAdvice: value.safetyAdvice as string,
    recyclingGuidance: value.recyclingGuidance as string,
    relevantSources: value.relevantSources as string[],
  };
}

export async function generateRecyclingAdvice(result: DetectionResult): Promise<RecyclingAdvice> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('AI recycling advice is not configured on the server.');
  }

  const documents = retrieveKnowledge(result);
  const knowledgeContext = documents.map((document) => `TOPIC: ${document.topic}\n${document.content}`).join('\n\n');
  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const prompt = `You provide concise recycling advice grounded only in the supplied local knowledge. Return only valid JSON with exactly these fields: recommendedAction, safetyAdvice, recyclingGuidance, relevantSources (an array of topic names). Do not invent legal requirements, collection locations, or hazards. If the item is not e-waste, say that no e-waste recycling action is indicated and recommend ordinary disposal appropriate to the visible item only when supported. Mention that regulatory information is educational and should be verified with current official sources when regulations are relevant.\n\nDETECTION:\n${JSON.stringify(result)}\n\nRETRIEVED KNOWLEDGE:\n${knowledgeContext}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    },
  );

  const responseData = await response.json() as GeminiResponse;
  if (!response.ok) {
    throw new Error(responseData.error?.message || 'The AI provider could not generate recycling advice.');
  }

  const text = responseData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) {
    throw new Error('The AI returned no recycling advice.');
  }

  try {
    const advice = parseAdvice(text);
    return {
      ...advice,
      relevantSources: result.isEWaste ? eWasteTopics : [],
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('The AI returned an invalid recycling advice format.');
    }
    throw error;
  }
}
