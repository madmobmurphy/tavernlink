import { AIConfig } from "../types";

// Default prompts
export const DEFAULT_PROMPTS = {
    npc: "Generate a random fantasy NPC for a D&D 5e campaign. Include Name, Race, Class, Appearance, Personality, and one Secret. Format as a concise Markdown list.",
    plot: "You are a Dungeon Master. Create a short, mysterious plot hook for a fantasy campaign. Keep it under 50 words."
};

// Now calls the backend proxy so the key remains hidden from the client
export const generateContent = async (
    type: 'npc' | 'plot', 
    config: AIConfig
): Promise<string> => {
    const prompt = type === 'npc' ? config.prompts.npc : config.prompts.plot;
    
    const token = localStorage.getItem('tavern_token');
    if (!token) return "Authentication error.";

    try {
        const res = await fetch('/api/ai/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ prompt, type })
        });

        const data = await res.json();
        
        if (!res.ok) {
            throw new Error(data.error || "AI Generation Failed");
        }

        return data.text || "The oracles are silent.";
    } catch (e: any) {
        console.error("AI Service Error:", e);
        return `Error: ${e.message}`;
    }
};