import { GoogleGenAI } from "@google/genai";
import { AiInsight } from "../types";

// Note: In a real production app, ensure your API key is secured via a backend proxy or restricted strictly to your domain.
// Since this is a client-side guide, we assume the environment variable or user input.

const getAiClient = () => {
    // Ideally use process.env.API_KEY, but for this demo, we might rely on the user having it in env
    // or prompting (not implemented here per instructions to avoid prompts). 
    // We assume the variable exists.
    const apiKey = process.env.API_KEY || ''; 
    if (!apiKey) {
      console.warn("API Key missing");
      return null;
    }
    return new GoogleGenAI({ apiKey });
};

export const analyzePdfContent = async (textContext: string): Promise<AiInsight | null> => {
  const ai = getAiClient();
  if (!ai) return null;

  try {
    const prompt = `
      Analyze the following text extracted from a PDF document. 
      Provide a concise summary (max 3 sentences) and a list of 5 key topic tags.
      
      Return JSON format:
      {
        "summary": "string",
        "keywords": ["tag1", "tag2", ...]
      }

      Text Content:
      ${textContext.substring(0, 10000)} 
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const text = response.text;
    if (!text) return null;

    return JSON.parse(text) as AiInsight;
  } catch (error) {
    console.error("Gemini Analysis Failed:", error);
    return null;
  }
};