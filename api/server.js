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
app.use(express.json({ limit: "8mb" }));

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

app.post("/api/ocr", async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "Gemini is not configured on the server yet." });
  const image = typeof req.body?.image === "string" ? req.body.image : "";
  const mode = ["auto", "text", "numbers", "table"].includes(req.body?.mode) ? req.body.mode : "auto";
  const match = image.match(/^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return res.status(400).json({ error: "Please provide a supported JPEG, PNG or WebP image." });
  if (image.length > 7_000_000) return res.status(413).json({ error: "The image is too large for cloud OCR. Try cropping it first." });
  const instructions = {
    auto: "Transcribe the image exactly. Preserve line breaks. If there is a clear table, output each row on a separate line and separate columns with TAB characters. Otherwise keep normal paragraphs and lists.",
    text: "Transcribe all readable text in reading order. Preserve headings, paragraphs and list structure.",
    numbers: "Transcribe numbers and nearby labels as accurately as possible. Preserve signs, decimal points, commas, percentages and currency symbols. Do not calculate or guess missing digits.",
    table: "Transcribe the table row by row. Separate columns with TAB characters and put each row on a new line. Preserve headers and all visible values."
  };
  try {
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const mimeType = match[1] === "jpg" ? "image/jpeg" : "image/" + match[1];
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [
        { text: "You are an OCR transcription engine, not a summariser. " + instructions[mode] + " Preserve recognizable emoji symbols exactly (for example, ❤️, ⭐, ✅, 📌). If an emoji is clearly present but its exact symbol is uncertain, write a short label such as [heart emoji] rather than silently dropping it. Do not invent unreadable text. Use [unclear] where necessary. Return only the transcription, with no introduction or code fences." },
        { inlineData: { mimeType, data: match[2] } }
      ] }], generationConfig: { temperature: 0, maxOutputTokens: 8192 } }),
      signal: AbortSignal.timeout(60_000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const status = response.status === 429 ? 429 : 502;
      return res.status(status).json({ error: response.status === 429 ? "Gemini quota or rate limit reached. Try again later." : "Gemini cloud OCR failed. Check the server model and API configuration." });
    }
    const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("\n").trim();
    if (!text) return res.status(502).json({ error: "Gemini returned no transcription. Please try again." });
    return res.json({ text });
  } catch (_error) {
    return res.status(502).json({ error: "Could not reach Gemini for cloud OCR. Please try again later." });
  }
});

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
