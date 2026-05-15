// api/chat.js — Vercel Serverless Function (Gemini Version)
// Secure proxy: your Gemini API key stays on the server, never exposed to browser.

const GEMINI_MODEL = "gemini-2.0-flash";

export default async function handler(req, res) {
  // Allow OPTIONS preflight
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")    return res.status(405).json({ error: { message: "Method not allowed" } });

  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({
      error: { message: "GEMINI_API_KEY not set. Please add it in Vercel Environment Variables." }
    });
  }

  // Destructure body sent from frontend
  const { system_instruction, contents, generationConfig } = req.body || {};

  if (!contents || !Array.isArray(contents)) {
    return res.status(400).json({ error: { message: "Invalid request: 'contents' array required." } });
  }

  const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${API_KEY}`;

  try {
    const geminiRes = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: system_instruction || { parts: [{ text: "You are a helpful assistant." }] },
        contents,
        generationConfig: generationConfig || { maxOutputTokens: 1000, temperature: 0.7 },
      }),
    });

    const data = await geminiRes.json();

    // Forward Gemini's response (including any errors) directly to client
    return res.status(geminiRes.status).json(data);

  } catch (err) {
    console.error("Gemini proxy error:", err);
    return res.status(500).json({
      error: { message: "Failed to reach Gemini API. Please try again." }
    });
  }
}
