import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  const { prompt, platform } = await req.json();

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const result = await model.generateContent(
      `Generate exactly 3 social media captions for ${platform} about: "${prompt}".
      Each caption should be engaging, include 3-5 relevant hashtags, and be ready to post.
      Format your response as a JSON array of 3 strings ONLY, no extra text.
      Example: ["Caption 1 #tag1 #tag2", "Caption 2 #tag1 #tag2", "Caption 3 #tag1 #tag2"]`
    );

    const text = result.response.text().trim();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('Invalid response format');
    const captions = JSON.parse(jsonMatch[0]);

    return NextResponse.json({ captions });
  } catch (error) {
    console.error('Gemini error:', error);
    return NextResponse.json({ error: 'Failed to generate captions' }, { status: 500 });
  }
}
