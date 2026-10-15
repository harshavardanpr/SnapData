import express from "express";
import cors from "cors";

const app = express();
const port = Number(process.env.PORT || 10000);
const allowedOrigins = new Set([
  "https://snapdata.onrender.com",
  "http://localhost:3000",
  "http://127.0.0.1:5500"
]);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error("Origin not allowed"));
  }
}));
app.use(express.json({ limit: "50kb" }));

const requests = new Map();
app.use("/api/", (req, res, next) => {
  const key = req.ip || "unknown";
  const now = Date.now();
  const recent = (requests.get(key) || []).filter(t => now - t < 60_000);
  if (recent.length >= 8) return res.status(429).json({ error: "Too many summary requests. Please wait a minute and try again." });
  recent.push(now);
  requests.set(key, recent);
  next();
});

app.get("/health", (_req, res) => res.json({ ok: true, service: "SnapData summary API" }));

app.post("/api/summarize", async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "Gemini is not configured on the server yet." });
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  const style = ["short", "detailed", "bullets"].includes(req.body?.style) ? req.body.style : "short";
  if (!text) return res.status(400).json({ error: "Add some extracted text first." });
  if (text.length > 40_000) return res.status(413).json({ error: "Please send no more than 40,000 characters at a time." });

  const styleInstructions = {
    short: "Write a concise summary with the most important details.",
    detailed: "Write a well-organised detailed summary. Preserve names, dates, definitions, examples and important facts.",
    bullets: "Return clear bullet-point key notes with headings when useful."
  };
  const prompt = [
    "You are helping a teacher turn their own notebook notes into a useful summary.",
    "Summarise only the supplied text. Do not invent facts or silently correct uncertain names, numbers, dates, or subject-specific terms.",
    "If the source appears incomplete or contains OCR mistakes, mention uncertainty briefly rather than guessing.",
    styleInstructions[style],
    "Keep the language clear and practical.",
    "\nSOURCE NOTES:\n",
    text
  ].join("\n");

  try {
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 4096 }
      }),
      signal: AbortSignal.timeout(45_000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const status = response.status === 429 ? 429 : 502;
      return res.status(status).json({ error: response.status === 429 ? "Gemini free-tier quota or rate limit reached. Try again later." : "Gemini could not create the summary. Check the server model and API configuration." });
    }
    const summary = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("\n").trim();
    if (!summary) return res.status(502).json({ error: "Gemini returned an empty summary. Please try again." });
    return res.json({ summary });
  } catch (_error) {
    return res.status(502).json({ error: "Could not reach Gemini. Please try again later." });
  }
});

app.listen(port, "0.0.0.0", () => console.log("SnapData summary API listening on " + port));
