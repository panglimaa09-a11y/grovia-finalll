import { GoogleGenAI } from '@google/genai';

const PRIMARY_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || 'gemini-2.5-flash-lite';

function clean(value, max = 4000) {
  return String(value ?? '').trim().slice(0, max);
}

function isTransient(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return /503|unavailable|high demand|temporarily|resource exhausted/.test(message);
}

async function generate(client, model, prompt) {
  return client.models.generateContent({
    model,
    contents: prompt,
    config: {
      temperature: 0.8,
      maxOutputTokens: 1800,
      responseMimeType: 'application/json'
    }
  });
}

export async function generateWithProvider(input = {}) {
  const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) return { configured: false };

  const topic = clean(input.topic, 1000);
  const goal = clean(input.goal, 200);
  const format = clean(input.format || 'Short Video', 100);
  const platform = clean(input.platform || 'YouTube Shorts', 100);

  if (!topic) throw new Error('Topic wajib diisi.');

  const client = new GoogleGenAI({ apiKey });
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

  let response;
  let lastError;

  for (const model of [PRIMARY_MODEL, FALLBACK_MODEL]) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        response = await generate(client, model, prompt);
        if (response) break;
      } catch (error) {
        lastError = error;
        if (!isTransient(error) || attempt === 1) break;
        await new Promise(resolve => setTimeout(resolve, 1200));
      }
    }
    if (response) break;
  }

  if (!response) {
    const message = String(lastError?.message || 'Gemini tidak tersedia.');
    throw new Error(`Gemini unavailable setelah retry: ${message}`);
  }

  const text = String(response.text || '').trim();
  if (!text) throw new Error('Gemini tidak menghasilkan konten.');

  let result;
  try {
    result = JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('Respons Gemini bukan JSON yang valid.');
    result = JSON.parse(text.slice(start, end + 1));
  }

  return { configured: true, result };
}
