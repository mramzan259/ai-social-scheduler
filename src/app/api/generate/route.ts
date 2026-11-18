import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Try multiple models in order
const MODELS = ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.0-flash-exp', 'gemini-1.5-flash-latest'];

export async function POST(req: NextRequest) {
  const { prompt, platform } = await req.json();

  const promptText = `Generate exactly 3 social media captions for ${platform} about: "${prompt}".
Each caption should be engaging, include 3-5 relevant hashtags, and be ready to post.
Format your response as a JSON array of 3 strings ONLY, no extra text, no markdown.
Example: ["Caption 1 #tag1 #tag2", "Caption 2 #tag1 #tag2", "Caption 3 #tag1 #tag2"]`;

  for (const modelName of MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(promptText);
      const text = result.response.text().trim();
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('Invalid response format');
      const captions = JSON.parse(jsonMatch[0]);
      console.log(`✅ Success with model: ${modelName}`);
      return NextResponse.json({ captions, model: modelName });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`❌ Model ${modelName} failed: ${msg}`);
      // If 503 or 404, try next model; otherwise break
      if (!msg.includes('503') && !msg.includes('404') && !msg.includes('429')) {
        break;
      }
      // small wait before trying next
      await new Promise(r => setTimeout(r, 500));
    }
  }

  return NextResponse.json({ error: 'All models failed. Try again in a moment.' }, { status: 500 });
}
