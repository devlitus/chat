// src/pages/api/travel.ts

import type { APIRoute } from 'astro';
import Groq from 'groq-sdk';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { destination, budget, days, interests } = body;

    if (!destination || !days) {
      return new Response(JSON.stringify({ error: 'Destination and days are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const apiKey = import.meta.env.GROQ_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'GROQ_API_KEY is not configured' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const groq = new Groq({ apiKey });

    const systemPrompt = `You are an expert travel agent. The user wants to travel to ${destination} for ${days} days, with a budget of ${budget || 'flexible'}. Their interests are: ${interests || 'general tourist attractions'}. 
Provide 3 excellent travel suggestions/itineraries.

Return ONLY a valid JSON object with the following structure:
{
  "suggestions": [
    {
      "id": "1",
      "title": "Short title of the suggestion",
      "description": "2-3 sentences describing the vibe and key activities",
      "estimatedCost": "Approximate cost e.g., $500",
      "highlights": ["highlight 1", "highlight 2", "highlight 3"]
    }
  ]
}

DO NOT wrap the response in markdown blocks like \`\`\`json. Return strictly the JSON.`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: 'Generate exactly 3 suggestions for my trip using the requested JSON format.',
        }
      ],
      model: 'openai/gpt-oss-20b', // or your preferred model
      temperature: 0.7,
      max_completion_tokens: 2048,
    });

    const content = chatCompletion.choices[0]?.message?.content || '{}';
    
    // Parse JSON cleanly in case the model added markdown blocks
    const cleanContent = content.replace(/^```json/g, '').replace(/```$/g, '').trim();
    const result = JSON.parse(cleanContent);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
