import { env } from "../config/env.js";
import { HttpError } from "./http-error.js";

const IMAGE_MODEL = "gemini-2.5-flash-image";

/**
 * Generates an image from a text prompt via the Gemini API ("Nano Banana"
 * image model) and returns the raw bytes. Node 20's built-in fetch is used
 * directly rather than pulling in the Gemini SDK for a single call site.
 *
 * Used only by the admin "Generate with AI" product-image button — the skin
 * analysis feature does not call Gemini or any external AI API at all; see
 * lib/skin-analysis.ts for its self-contained computer-vision pipeline.
 */
export async function generateImageBuffer(prompt: string): Promise<{ buffer: Buffer; mimeType: string }> {
  if (!env.geminiApiKey) {
    throw new HttpError(400, "Gemini API key is not configured. Set GEMINI_API_KEY in the API's .env.");
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent?key=${env.geminiApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );

  const data: any = await res.json();
  if (!res.ok) {
    throw new HttpError(502, data?.error?.message ?? `Gemini API error (${res.status})`);
  }

  const parts: any[] = data?.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p.inlineData?.data);
  if (!imagePart) {
    throw new HttpError(502, "Gemini did not return an image for this prompt.");
  }

  return {
    buffer: Buffer.from(imagePart.inlineData.data, "base64"),
    mimeType: imagePart.inlineData.mimeType ?? "image/png",
  };
}
