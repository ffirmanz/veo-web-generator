// src/app/api/veo/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest } from "next/server";
import { getClient } from "@/lib/veo";
import { promises as fs } from "fs";
import path from "path";

/**
 * Request body (JSON):
 * {
 *   "apiKey": "USER_GOOGLE_API_KEY",
 *   "payload": {
 *     "mode": "text" | "json" | "image",
 *     "model": "veo-3.0-generate-preview" | "veo-3.0-fast-generate-preview" | "veo-2.0-generate-001",
 *     "prompt": "....",
 *     "negativePrompt": "logo, watermark, text",
 *     "aspectRatio": "16:9" | "9:16",
 *     "resolution": "720p" | "1080p",      // Veo 3 only
 *     "durationSeconds": 5 | 6 | 7 | 8,    // Veo 2 only
 *     "personGeneration": "allow_all" | "allow_adult" | "dont_allow",
 *     "sampleCount": 1 | 2 | 3 | 4,
 *     "seed": 123,
 *     "imageBase64": "....",               // mode=image
 *     "imageMimeType": "image/jpeg"        // mode=image
 *   }
 * }
 */

export async function POST(req: NextRequest) {
  try {
    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      return new Response(JSON.stringify({ error: "Content-Type must be application/json" }), { status: 415 });
    }

    const { apiKey, payload } = (await req.json()) as {
      apiKey?: string;
      payload?: any;
    };

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
      imageMimeType,
    } = payload || {};

    if (!prompt || String(prompt).trim().length < 3) {
      return new Response(JSON.stringify({ error: "Prompt too short" }), { status: 400 });
    }

    // Normalisasi opsi model
    let safeAspectRatio: "16:9" | "9:16" = aspectRatio;
    if (String(model).startsWith("veo-3.0") && safeAspectRatio === "9:16") {
      safeAspectRatio = "16:9"; // Veo 3 preview belum dukung 9:16
    }
    const useDuration = String(model).startsWith("veo-2.0") ? durationSeconds : undefined;

    // Client Gemini (pakai key milik user)
    const ai = getClient(apiKey);

    // Susun request generate
    const request: any = {
      model,
      prompt,
      config: {
        aspectRatio: safeAspectRatio,
        negativePrompt,
        personGeneration,
        resolution,       // diabaikan oleh Veo 2
        sampleCount,
        seed,
        durationSeconds: useDuration, // hanya Veo 2
      },
    };

    if (mode === "image") {
      if (!imageBase64 || !imageMimeType) {
        return new Response(JSON.stringify({ error: "Missing imageBase64 or imageMimeType for image mode" }), { status: 400 });
      }
      request.image = {
        imageBytes: Buffer.from(imageBase64, "base64"),
        mimeType: imageMimeType,
      };
    } else if (mode === "json") {
      // payload sudah berisi field yang sama; tidak perlu apa-apa
    }

    // 1) Mulai operasi
    let op = await ai.models.generateVideos(request);

    // 2) Poll sampai selesai
    while (!op.done) {
      await new Promise((r) => setTimeout(r, 8000));
      op = await ai.operations.getVideosOperation({ operation: op });
    }

    // 3) Ambil fileRef video
    const fileRef = op?.response?.generatedVideos?.[0]?.video;
    if (!fileRef) {
      return new Response(JSON.stringify({ error: "No video returned" }), { status: 502 });
    }

    // 4) Download ke disk (WAJIB pakai downloadPath di @google/genai v1.x)
    const outPath = path.join("/tmp", `veo_${Date.now()}.mp4`);
    await ai.files.download({
      file: fileRef,
      downloadPath: outPath,
    });

    // 5) Baca file & kirim ke klien
    const bytes = await fs.readFile(outPath);

    return new Response(bytes, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename=${path.basename(outPath)}`,
        "Cache-Control": "no-store",
      },
    });

    // (opsional) hapus file setelah dikirim:
    // await fs.unlink(outPath).catch(() => {});
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), { status: 500 });
  }
}
