import { GoogleGenAI } from '@google/genai';

const PRIMARY_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.5-flash';

function clean(value, max = 4000) {
  return String(value ?? '').trim().slice(0, max);
}

function isRetryable(error) {
  const status = Number(error?.status || error?.code || 0);
  const message = String(error?.message || '').toLowerCase();
  return status === 429 || status === 500 || status === 502 || status === 503 || message.includes('unavailable') || message.includes('high demand') || message.includes('temporarily');
}

async function generate(client, model, prompt) {
  const response = await client.models.generateContent({
    model,
    contents: prompt,
    config: {
      maxOutputTokens: 1800,
      responseMimeType: 'application/json'
    }
  });
  const text = String(response.text || '').trim();
  if (!text) throw new Error(`Gemini ${model} tidak menghasilkan konten.`);
  return text;
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('Respons Gemini bukan JSON yang valid.');
    return JSON.parse(text.slice(start, end + 1));
  }
}

export async function generateWithProvider(input = {}) {
  const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) return { configured: false };

  const topic = clean(input.topic, 1000);
  const goal = clean(input.goal, 200);
  const format = clean(input.format || 'Short Video', 100);
  const platform = clean(input.platform || 'YouTube Shorts', 100);
  if (!topic) throw new Error('Topic wajib diisi.');

  const prompt = `You are GROVIA, an expert social-media content strategist and short-form video scriptwriter.
Create a production-ready content concept for the user.

Topic: ${topic}
Goal: ${goal || 'Grow audience'}
Format: ${format}
Platform: ${platform}

Return ONLY valid JSON with this exact structure:
{
  "title": "...",
  "hook": "...",
  "script": "...",
  "caption": "...",
  "hashtags": ["#...", "#..."],
  "cta": "...",
  "visual_plan": ["shot 1...", "shot 2...", "shot 3..."],
  "duration_seconds": 30
}

Rules:
- Indonesian language unless the topic clearly requires another language.
- Hook must be strong in the first 3 seconds.
- Script must be practical and ready to record.
- Avoid fabricated statistics or claims.
- Hashtags must be relevant, maximum 8.
- Keep the response concise enough for a real creator workflow.`;

  const client = new GoogleGenAI({ apiKey });
  let lastError;

  for (const model of [PRIMARY_MODEL, FALLBACK_MODEL]) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const text = await generate(client, model, prompt);
        return { configured: true, result: parseJson(text), model };
      } catch (error) {
        lastError = error;
        if (!isRetryable(error) || attempt === 2) break;
        await new Promise(resolve => setTimeout(resolve, 700 * attempt));
      }
    }
  }

  throw new Error(`Gemini unavailable setelah retry: ${lastError?.message || 'Unknown Gemini error'}`);
}
