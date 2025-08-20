export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;      // tingkatkan sesuai plan Vercel
export const preferredRegion = "sin1"; // opsional (Asia Tenggara)

import { NextRequest } from "next/server";
import { getClient } from "@/lib/veo";

/**
 * Request body example:
 * {
 *   "apiKey": "USER_GOOGLE_API_KEY",
 *   "payload": {
 *     "mode": "text" | "json" | "image",
 *     "model": "veo-3.0-generate-preview" | "veo-3.0-fast-generate-preview" | "veo-2.0-generate-001",
 *     "prompt": "....",
 *     "negativePrompt": "logo, watermark, text",
 *     "aspectRatio": "16:9" | "9:16",
 *     "resolution": "720p" | "1080p",
 *     "durationSeconds": 5 | 6 | 7 | 8,
 *     "personGeneration": "allow_all" | "allow_adult" | "dont_allow",
 *     "sampleCount": 1 | 2 | 3 | 4,
 *     "seed": 123,
 *     "imageBase64": "....",   // optional for image mode
 *     "imageMimeType": "image/jpeg" // or image/png
 *   }
 * }
 */

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return new Response(JSON.stringify({ error: "Content-Type must be application/json" }), { status: 415 });
    }

    const { apiKey, payload } = await req.json();

    if (!apiKey) return new Response(JSON.stringify({ error: "Missing API key" }), { status: 400 });
    if (!payload) return new Response(JSON.stringify({ error: "Missing payload" }), { status: 400 });

    const {
      mode = "text",
      model = "veo-3.0-generate-preview",
      prompt = "",
      negativePrompt,
      aspectRatio = "16:9",
      resolution,
      durationSeconds,
      personGeneration = "allow_adult",
      sampleCount = 1,
      seed,
      imageBase64,
      imageMimeType
    } = payload || {};

    if (!prompt || String(prompt).trim().length < 3) {
      return new Response(JSON.stringify({ error: "Prompt too short" }), { status: 400 });
    }

    // Model-specific guards
    let safeAspectRatio = aspectRatio as "16:9" | "9:16";
    if (String(model).startsWith("veo-3.0") && safeAspectRatio === "9:16") {
      safeAspectRatio = "16:9"; // Veo 3 Preview belum dukung 9:16
    }
    const useDuration = String(model).startsWith("veo-2.0") ? durationSeconds : undefined;

    const ai = getClient(apiKey);

    const request: any = {
      model,
      prompt,
      config: {
        aspectRatio: safeAspectRatio,
        negativePrompt,
        personGeneration,
        resolution,
        sampleCount,
        seed,
        durationSeconds: useDuration
      }
    };

    if (mode === "image") {
      if (!imageBase64 || !imageMimeType) {
        return new Response(JSON.stringify({ error: "Missing imageBase64 or imageMimeType for image mode" }), { status: 400 });
      }
      request.image = {
        imageBytes: Buffer.from(imageBase64, "base64"),
        mimeType: imageMimeType
      };
    } else if (mode === "json") {
      // nothing special; fields already mapped from payload
    } else {
      // text mode - already set
    }

    // Start operation
    let op = await ai.models.generateVideos(request);

    // Poll until done
    while (!op.done) {
      await new Promise((r) => setTimeout(r, 8000));
      op = await ai.operations.getVideosOperation({ operation: op });
    }

    const fileRef = op?.response?.generatedVideos?.[0]?.video;
    if (!fileRef) {
      return new Response(JSON.stringify({ error: "No video returned" }), { status: 502 });
    }

    // Download MP4 bytes
    const dl = await ai.files.download({ file: fileRef });
    const bytes = dl.data instanceof Uint8Array ? dl.data : new Uint8Array(dl.data as ArrayBuffer);

    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename=veo_${Date.now()}.mp4`,
        "Cache-Control": "no-store"
      }
    });
  } catch (e: any) {
    // Jangan log apiKey
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), { status: 500 });
  }
}
