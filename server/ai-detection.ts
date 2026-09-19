export interface DetectionResult {
  deviceType: string;
  category: string;
  condition: string;
  possibleHazard: string;
  isEWaste: boolean;
  confidence: number;
  description: string;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

const analysisPrompt = `Classify only what is visibly present in the uploaded image and return only a valid JSON object with exactly these fields:
{
  "deviceType": "The visible object or device type, or Not applicable when no relevant object can be identified",
  "category": "An accurate category for the visible object or content, or Not applicable when appropriate",
  "condition": "Working, Damaged, Broken, Partially Working, or Unknown",
  "possibleHazard": "A hazard visibly present, or none detected",
  "isEWaste": false,
  "confidence": 20,
  "description": "A concise explanation of what is visible"
}

Set isEWaste to true only when clear physical electronic or electrical equipment or components are visibly identifiable and appear to be discarded or intended for disposal. Examples include laptops, computers, phones, monitors, televisions, printers, circuit boards, hard drives, electronic appliances, and clearly identifiable electronic cables or components.

Set isEWaste to false when no electronic/electrical equipment is visibly present, the image shows ordinary objects, food, clothing, furniture, people, animals, nature, buildings, vehicles, or when the image is ambiguous. Also set it to false for screenshots, documents, webpages, code, or software interfaces unless physical electronic waste is visibly shown in the image itself.

Do not infer e-waste from words, captions, recycling context, a waste-like scene, or uncertainty. When uncertain, always choose false and use a lower confidence estimate. For false results, do not invent an electronic device type or e-waste hazard: describe the visible object/content or use "Not applicable", and use "none detected" for possibleHazard unless a genuinely visible non-e-waste hazard matters. Confidence is an estimate from 0 to 100. Do not include markdown, code fences, or any additional fields.`;

const electronicDeviceTerms = /laptop|computer|phone|mobile|monitor|television|tv|printer|refrigerator|circuit board|hard drive|electronic|electrical|cable|component|appliance|tablet|keyboard|router|server/i;
const eWasteCategoryTerms = /it equipment|consumer electronics|household appliance|battery|electrical component|e-waste/i;
const eWasteHazardTerms = /lithium|battery|sharp component|toxic material|exposed wire|circuit/i;

function getText(response: GeminiResponse): string | null {
  return response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
}

function parseJson(text: string): unknown {
  const withoutCodeFence = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  return JSON.parse(withoutCodeFence);
}

function normalizeAnalysis(analysis: DetectionResult): DetectionResult {
  if (analysis.isEWaste) {
    return analysis;
  }

  return {
    ...analysis,
    deviceType: electronicDeviceTerms.test(analysis.deviceType) ? 'Not applicable' : analysis.deviceType,
    category: eWasteCategoryTerms.test(analysis.category) ? 'Not applicable' : analysis.category,
    possibleHazard: eWasteHazardTerms.test(analysis.possibleHazard) ? 'none detected' : analysis.possibleHazard,
  };
}

function validateAnalysis(value: unknown): DetectionResult {
  if (!value || typeof value !== 'object') {
    throw new Error('The AI returned an invalid analysis.');
  }

  const analysis = value as Record<string, unknown>;
  const stringFields = ['deviceType', 'category', 'condition', 'possibleHazard', 'description'];
  for (const field of stringFields) {
    if (typeof analysis[field] !== 'string' || !analysis[field].trim()) {
      throw new Error('The AI returned an incomplete analysis.');
    }
  }

  if (typeof analysis.isEWaste !== 'boolean') {
    throw new Error('The AI returned an invalid e-waste status.');
  }

  if (typeof analysis.confidence !== 'number' || !Number.isFinite(analysis.confidence)) {
    throw new Error('The AI returned an invalid confidence estimate.');
  }

  return normalizeAnalysis({
    deviceType: analysis.deviceType as string,
    category: analysis.category as string,
    condition: analysis.condition as string,
    possibleHazard: analysis.possibleHazard as string,
    isEWaste: analysis.isEWaste,
    confidence: Math.round(Math.max(0, Math.min(100, analysis.confidence))),
    description: analysis.description as string,
  });
}

export async function analyzeEWasteImage(image: Buffer, mimeType: string): Promise<DetectionResult> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('AI detection is not configured on the server.');
  }

  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: analysisPrompt },
            { inlineData: { data: image.toString('base64'), mimeType } },
          ],
        }],
        generationConfig: {
          responseMimeType: 'application/json',
        },
      }),
    },
  );

  const responseData = await response.json() as GeminiResponse & {
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(responseData.error?.message || 'The AI provider could not analyze the image.');
  }

  const text = getText(responseData);
  if (!text) {
    throw new Error('The AI returned no analysis.');
  }

  try {
    return validateAnalysis(parseJson(text));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('The AI returned an invalid analysis format.');
    }
    throw error;
  }
}
