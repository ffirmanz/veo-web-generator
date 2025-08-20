"use client";

import { useEffect, useRef, useState } from "react";

const MODELS = [
  { id: "veo-3.0-generate-preview", label: "Veo 3 (Preview, 8s, with audio)" },
  { id: "veo-3.0-fast-generate-preview", label: "Veo 3 Fast (Preview)" },
  { id: "veo-2.0-generate-001", label: "Veo 2 (Silent, 5–8s)" }
];

type Job = { prompt: string; status: "queued" | "running" | "done" | "error"; url?: string; error?: string };

export default function Page() {
  const [apiKey, setApiKey] = useState("");
  const [mode, setMode] = useState<"text" | "image" | "json">("text");
  const [model, setModel] = useState(MODELS[0].id);
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("logo, watermark, text");
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16">("16:9");
  const [resolution, setResolution] = useState<"720p" | "1080p">("720p"); // Veo3 only
  const [duration, setDuration] = useState(8); // Veo2 only
  const [sampleCount, setSampleCount] = useState(1);
  const [seed, setSeed] = useState<number | "">("");
  const [personGen, setPersonGen] = useState<"allow_all" | "allow_adult" | "dont_allow">("allow_adult");

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [jsonText, setJsonText] = useState(
    JSON.stringify(
      {
        mode: "json",
        model: "veo-3.0-generate-preview",
        prompt: "Cinematic macro shot of coffee beans tumbling in slow motion, dramatic lighting.",
        aspectRatio: "16:9",
        negativePrompt: "logo, watermark, text",
        personGeneration: "allow_adult",
        sampleCount: 1
      },
      null,
      2
    )
  );

  const [logs, setLogs] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  // Batch
  const [batchJobs, setBatchJobs] = useState<Job[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);

  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [logs]);

  const appendLog = (s: string) => setLogs((p) => [...p, s]);

  const runSingle = async () => {
    if (!apiKey) return appendLog("✖ Missing API key");
    setVideoUrl(null);
    setLogs([]);
    appendLog(`▶ Generating with ${model}…`);

    try {
      let payload: any = {
        mode,
        model,
        prompt,
        negativePrompt,
        aspectRatio,
        personGeneration: personGen,
        sampleCount
      };

      if (String(model).startsWith("veo-3.0")) {
        payload.resolution = resolution; // Veo 3 only
      } else {
        payload.durationSeconds = duration; // Veo 2 only
      }

      if (seed !== "") payload.seed = Number(seed);

      if (mode === "image") {
        if (!imageFile) return appendLog("✖ No image selected");
        const ab = await imageFile.arrayBuffer();
        payload.imageBase64 = Buffer.from(ab).toString("base64");
        payload.imageMimeType = imageFile.type;
      } else if (mode === "json") {
        payload = JSON.parse(jsonText);
      }

      const res = await fetch("/api/veo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, payload })
      });
      if (!res.ok) throw new Error(await res.text());

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
      appendLog("✔ Done");
    } catch (e: any) {
      appendLog(`✖ ${e.message || e}`);
    }
  };

  const handleTxtUpload = async (file: File) => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    setBatchJobs(lines.map((l) => ({ prompt: l, status: "queued" })));
  };

  const runBatch = async () => {
    if (!apiKey) return appendLog("✖ Missing API key");
    if (!batchJobs.length) return;
    setBatchRunning(true);
    const jobs = [...batchJobs];

    for (let i = 0; i < jobs.length; i++) {
      jobs[i].status = "running";
      setBatchJobs([...jobs]);
      setLogs([]);
      setPrompt(jobs[i].prompt);
      appendLog(`▶ [${i + 1}/${jobs.length}] ${jobs[i].prompt}`);

      try {
        const payload: any = {
          mode: "text",
          model,
          prompt: jobs[i].prompt,
          negativePrompt,
          aspectRatio,
          personGeneration: personGen,
          sampleCount
        };

        if (String(model).startsWith("veo-3.0")) payload.resolution = resolution;
        else payload.durationSeconds = duration;

        if (seed !== "") payload.seed = Number(seed);

        const res = await fetch("/api/veo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey, payload })
        });
        if (!res.ok) throw new Error(await res.text());

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        jobs[i].status = "done";
        jobs[i].url = url;
        setBatchJobs([...jobs]);
        appendLog("✔ Done");
      } catch (e: any) {
        jobs[i].status = "error";
        jobs[i].error = e.message || String(e);
        setBatchJobs([...jobs]);
        appendLog(`✖ Error: ${jobs[i].error}`);
      }
    }

    setBatchRunning(false);
  };

  const ratioOptions = String(model).startsWith("veo-3.0") ? ["16:9"] : ["16:9", "9:16"];
  const showDuration = String(model).startsWith("veo-2.0");
  const showResolution = String(model).startsWith("veo-3.0");

  return (
    <main className="min-h-dvh max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold">Veo Web Generator</h1>
      <p className="text-sm text-neutral-600 mb-6">Text / Image / JSON → Video via Google Veo (Gemini API). Multi-user: setiap user pakai API key mereka sendiri.</p>

      {/* Controls */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Left column */}
        <div className="space-y-3">
          <label className="block text-sm font-medium">API Key</label>
          <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Google API Key" className="w-full rounded border px-3 py-2" />

          <label className="block text-sm font-medium">Mode</label>
          <div className="flex gap-2">
            {["text", "image", "json"].map((m) => (
              <button
                key={m}
                onClick={() => setMode(m as any)}
                className={`px-3 py-1 rounded border ${mode === m ? "bg-black text-white" : "bg-white"}`}
              >
                {m.toUpperCase()}
              </button>
            ))}
          </div>

          <label className="block text-sm font-medium">Model</label>
          <select className="w-full rounded border px-3 py-2" value={model} onChange={(e) => setModel(e.target.value)}>
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>

          <label className="block text-sm font-medium">Aspect Ratio</label>
          <select className="w-full rounded border px-3 py-2" value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value as any)}>
            {ratioOptions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>

          {showResolution && (
            <>
              <label className="block text-sm font-medium">Resolution (Veo 3)</label>
              <select className="w-full rounded border px-3 py-2" value={resolution} onChange={(e) => setResolution(e.target.value as any)}>
                <option value="720p">720p</option>
                <option value="1080p">1080p</option>
              </select>
            </>
          )}

          {showDuration && (
            <>
              <label className="block text-sm font-medium">Duration (Veo 2, 5–8)</label>
              <input type="number" min={5} max={8} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="w-full rounded border px-3 py-2" />
            </>
          )}

          <label className="block text-sm font-medium">Negative Prompt</label>
          <input className="w-full rounded border px-3 py-2" value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium">Sample Count (1–4)</label>
              <input type="number" min={1} max={4} value={sampleCount} onChange={(e) => setSampleCount(Number(e.target.value))} className="w-full rounded border px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium">Seed (optional)</label>
              <input type="number" value={seed} onChange={(e) => setSeed(e.target.value ? Number(e.target.value) : "")} className="w-full rounded border px-3 py-2" />
            </div>
          </div>

          <label className="block text-sm font-medium">Person Generation</label>
          <select className="w-full rounded border px-3 py-2" value={personGen} onChange={(e) => setPersonGen(e.target.value as any)}>
            <option value="allow_all">allow_all</option>
            <option value="allow_adult">allow_adult</option>
            <option value="dont_allow">dont_allow</option>
          </select>
        </div>

        {/* Right column */}
        <div className="space-y-3 md:col-span-2">
          {mode === "text" && (
            <>
              <label className="block text-sm font-medium">Prompt</label>
              <textarea rows={6} className="w-full rounded border px-3 py-2" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Cinematic macro shot of roasted coffee beans tumbling…" />
            </>
          )}

          {mode === "image" && (
            <>
              <label className="block text-sm font-medium">Prompt (optional, guidance)</label>
              <textarea rows={4} className="w-full rounded border px-3 py-2" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
              <label className="block text-sm font-medium mt-1">Reference Image (PNG/JPG ≤ 10MB)</label>
              <input type="file" accept="image/png,image/jpeg" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} />
            </>
          )}

          {mode === "json" && (
            <>
              <label className="block text-sm font-medium">JSON Payload</label>
              <textarea rows={14} className="w-full rounded border px-3 py-2" value={jsonText} onChange={(e) => setJsonText(e.target.value)} />
            </>
          )}

          <div className="flex gap-2">
            <button onClick={runSingle} className="px-4 py-2 rounded bg-black text-white">Generate</button>
            <button onClick={() => { setLogs([]); setVideoUrl(null); }} className="px-4 py-2 rounded border">Reset</button>
          </div>

          <div className="h-36 overflow-auto border rounded p-2 text-xs whitespace-pre-wrap bg-black text-green-300 font-mono" ref={logRef}>
            {logs.join("\n") || "No logs yet"}
          </div>

          {/* Batch */}
          <div className="mt-4">
            <label className="block text-sm font-medium">Batch from .txt (prompt per line)</label>
            <input type="file" accept="text/plain" onChange={(e) => e.target.files?.[0] && handleTxtUpload(e.target.files[0])} />
            <div className="mt-2 flex items-center gap-3 text-sm">
              <button disabled={!batchJobs.length || batchRunning} onClick={runBatch} className="px-3 py-1 rounded bg-black text-white disabled:opacity-50">Run Batch</button>
              <div>{batchJobs.filter(j => j.status !== "queued").length}/{batchJobs.length} processed</div>
            </div>
            {batchJobs.length > 0 && (
              <div className="max-h-40 overflow-auto border rounded p-2 text-sm mt-2">
                {batchJobs.map((j, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-8 text-xs">{i + 1}.</span>
                    <span className="flex-1 truncate">{j.prompt}</span>
                    <span className="text-xs">{j.status}</span>
                    {j.url && <a className="underline text-xs" href={j.url} download>download</a>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {videoUrl && (
            <div className="mt-4">
              <video src={videoUrl} controls className="w-full rounded" />
              <div className="mt-2">
                <a href={videoUrl} download className="underline">Download MP4</a>
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="mt-10 text-xs text-neutral-500">
        This app uses the user’s own Google API key. Keys are not logged or stored by the server.
      </footer>
    </main>
  );
}
