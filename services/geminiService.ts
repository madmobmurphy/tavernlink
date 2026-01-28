import { GoogleGenAI } from "@google/genai";

// NOTE: In a real app, this key should come from the backend or user input to avoid exposing it.
// For this demo, we assume process.env.API_KEY is available or the user will be prompted.
const getClient = () => {
    const key = process.env.API_KEY;
    if (!key) throw new Error("No API Key");
    return new GoogleGenAI({ apiKey: key });
};

export const generateCampaignHook = async (theme: string): Promise<string> => {
  try {
    const ai = getClient();
    const model = "gemini-3-flash-preview";
    
    const response = await ai.models.generateContent({
      model,
      contents: `You are a Dungeon Master. Create a short, 2-sentence mysterious plot hook for a fantasy campaign based on the theme: "${theme}".`,
    });
    
    return response.text || "The mists obscure the future...";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "The spirits are silent (Check API Key).";
  }
};

export const generateNPC = async (): Promise<string> => {
    try {
        const ai = getClient();
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: "Generate a random fantasy NPC. Name, Race, Class, and one quirk. Format as a short paragraph.",
        });
        return response.text || "An unknown stranger appears.";
    } catch (error) {
        return "A shadowed figure stands silently.";
    }
};