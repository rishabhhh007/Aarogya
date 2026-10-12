import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const pager = await ai.models.list();
for await (const m of pager) {
  const actions = m.supportedActions || [];
  if (!actions.length || actions.includes('generateContent')) console.log(String(m.name).replace('models/', ''));
}