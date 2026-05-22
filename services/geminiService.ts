
import { GoogleGenAI, Type } from "@google/genai";
import { CartItem, Product } from "../types";

export const getUpsellSuggestions = async (cart: CartItem[], menu: Product[]): Promise<string> => {
  if (cart.length === 0) return "Add some delicious tacos to start!";
  
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const cartNames = cart.map(item => item.nombre).join(", ");
  const menuSummary = menu.map(item => `${item.nombre} (${item.categoria})`).join(", ");

  const prompt = `You are an AI waiter at 'La Cantina Digital', a Mexican restaurant. 
  Current cart: [${cartNames}]. 
  Available items to suggest from: [${menuSummary}].
  
  Based on what the customer has in their cart, suggest ONE or TWO items they might want to add (e.g. if they have tacos, suggest a drink or dessert). 
  Keep it short, friendly, and persuasive. Max 20 words.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        temperature: 0.7,
      }
    });
    return response.text || "Would you like some fresh chips and guacamole with that?";
  } catch (error) {
    console.error("AI Error:", error);
    return "Complete your meal with a refreshing Horchata!";
  }
};
