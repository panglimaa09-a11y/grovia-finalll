import { GoogleGenAI } from '@google/genai';

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.7-flash';

function clean(value, max = 4000) {
  return String(value ?? '').trim().slice(0, max);
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

  const response = await client.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      temperature: 0.8,
      maxOutputTokens: 1800,
      responseMimeType: 'application/json'
    }
  });

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
