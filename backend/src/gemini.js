// The one adapter to the external AI service. Returns null on any failure, so callers fall back.
const TIMEOUT_MS = 4000;

export const aiMode = () =>
  process.env.SERVER_AI_API_KEY && process.env.GEMINI_MODEL ? "gemini" : "template";

export async function geminiRewrite(prompt) {
  if (aiMode() !== "gemini") return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.SERVER_AI_API_KEY },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2 },
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("").trim() || null;
  } catch {
    return null;
  }
}
