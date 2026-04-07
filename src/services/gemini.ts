import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function analyzeAttention(imageDataBase64: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: imageDataBase64,
          },
        },
        {
          text: `Analyze the classroom scene for student attention. 
          Return a JSON object with:
          - averageAttentionScore (0-100)
          - focusedCount (number of students looking at front/teacher)
          - distractedCount (number of students looking away, talking, or on phones)
          - awayCount (empty seats or students not visible)
          - summary (brief description of the classroom mood)
          
          Only return the JSON.`,
        },
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Error analyzing attention:", error);
    return null;
  }
}
