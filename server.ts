import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

// Try to load .env manually if process.env.GEMINI_API_KEY is not set
if (!process.env.GEMINI_API_KEY && fs.existsSync(".env")) {
  try {
    const envContent = fs.readFileSync(".env", "utf-8");
    envContent.split("\n").forEach(line => {
      const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1].trim();
        let val = (match[2] || "").trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.substring(1, val.length - 1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.substring(1, val.length - 1);
        process.env[key] = val;
      }
    });
    console.log("[server] Environment variables loaded manually from .env");
  } catch (err) {
    console.error("[server] Error parsing .env file manually:", err);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API route for barcode lookup
  app.post("/api/barcode-lookup", async (req, res) => {
    try {
      const { barcode } = req.body;
      if (!barcode) {
        return res.status(400).json({ error: "Barcode is required" });
      }

      console.log(`[API] Resolving barcode: ${barcode}`);
      let fetchedName = "";

      // 1. First robust fallback: Open Food Facts free public EAN/UPC database
      // This works instantly with zero API keys and covers millions of groceries, drinks, and snacks
      try {
        console.log(`[API] Querying Open Food Facts for: ${barcode}`);
        const offRes = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`, {
          headers: { 'User-Agent': 'LaCantinaDigitalPOS/1.0' }
        });
        if (offRes.ok) {
          const offData = await offRes.json();
          if (offData.status === 1 && offData.product) {
            const prod = offData.product;
            const brand = prod.brands || "";
            const nameEs = prod.product_name_es || prod.product_name;
            const qty = prod.quantity || "";
            
            if (nameEs) {
              const assembled = `${brand ? brand + ' ' : ''}${nameEs}${qty ? ' ' + qty : ''}`.trim();
              if (assembled.length > 3) {
                console.log(`[API] Open Food Facts matched successfully: ${assembled}`);
                fetchedName = assembled;
              }
            }
          }
        }
      } catch (offErr) {
        console.warn("[API] Open Food Facts check failed or timed out:", offErr);
      }

      // 2. Second fallback: Gemini AI with Google Search Grounding if OFF was empty or failed
      if (!fetchedName) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          console.warn("[API] GEMINI_API_KEY is not defined. Skipping AI fallback.");
        } else {
          try {
            console.log("[API] Querying Gemini with Google Search grounding");
            const ai = new GoogleGenAI({
              apiKey: apiKey,
              httpOptions: {
                headers: {
                  'User-Agent': 'aistudio-build',
                }
              }
            });

            const response = await ai.models.generateContent({
              model: "gemini-3.5-flash",
              contents: `What is the commercial product name (including brand, variant, and format/weight/volume if any) associated with the barcode "${barcode}"? Search the web to find the match. Keep the output clean and concise for a retail store POS database, e.g., "Coca-Cola Original 355ml" or "Jarritos Mandarina 370ml". Return ONLY a valid JSON object matching the schema: {"name": string}. If nothing is found, return {"name": ""}.`,
              config: {
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    name: {
                      type: Type.STRING,
                      description: "The product name with brand and volume/size.",
                    }
                  },
                  required: ["name"]
                }
              },
            });

            const rawText = response.text || "{}";
            console.log(`[API] Raw response from Gemini: ${rawText}`);
            const data = JSON.parse(rawText);
            fetchedName = data.name || "";
          } catch (aiErr: any) {
            console.error("[API] Gemini barcode lookup failed:", aiErr);
          }
        }
      }

      res.json({ name: fetchedName });
    } catch (error: any) {
      console.error("[API] Error resolving barcode:", error);
      res.status(500).json({ error: error.message || "Internal server error during lookup" });
    }
  });

  // Vite development middleware vs Static Production files
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
