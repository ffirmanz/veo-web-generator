"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Mode = "text" | "image" | "json";
type Ratio = "16:9" | "9:16";
type Res = "720p" | "1080p";
type PersonGen = "allow_all" | "allow_adult" | "dont_allow";

const MODELS = [
  { id: "veo-3.0-generate-preview", label: "Veo 3 (Preview • 8s • with audio)" },
  { id: "veo-3.0-fast-generate-preview", label: "Veo 3 Fast (Preview)" },
  { id: "veo-2.0-generate-001", label: "Veo 2 (Silent • 5–8s)" },
];

function abToBase64(ab: ArrayBuffer) {
  const bytes = new Uint8Array(ab);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return typeof window !== "undefined" ? btoa(binary) : "";
}

export default function Page() {
  // basics
  const [apiKey, setApiKey] = useState("");
  const [mode, setMode] = useState<Mode>("text");
  const [model, setModel] = useState(MODELS[0].id);
  const [aspectRatio, setAspectRatio] = useState<Ratio>("16:9");
  const [resolution, setResolution] = useState<Res>("720p"); // Veo 3 only
  const [duration, setDuration] = useState(8); // Veo 2 only
  const [negativePrompt, setNegativePrompt] = useState("logo, watermark, text");
  const [sampleCount, setSampleCount] = useState(1);
  const [seed, setSeed] = useState<number | "">("");
  const [personGen, setPersonGen] = useState<PersonGen>("allow_adult");

  // content
  const [prompt, setPrompt] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [jsonText, setJsonText] = useState(
`{
  "mode": "json",
  "model": "veo-3.0-generate-preview",
  "prompt": "Cinematic macro shot of coffee beans tumbling in slow motion, dramatic lighting.",
  "aspectRatio": "16:9",
  "negativePrompt": "logo, watermark, text",
  "personGeneration": "allow_adult",
  "sampleCount": 1
}`
  );

  // batch
  type Job = { prompt: string; status: "queued" | "running" | "done" | "error"; url?: string; error?: string };
  const [batchJobs, setBatchJobs] = useState<Job[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);

  // logs & result
  const [logs, setLogs] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight }); }, [logs]);
  const appendLog = (s: string) => setLogs((p) => [...p, s]);

  // remember key (optional)
  useEffect(() => { const s = localStorage.getItem("veo_api_key"); if (s) setApiKey(s); }, []);
  useEffect(() => { if (apiKey) localStorage.setItem("veo_api_key", apiKey); }, [apiKey]);

  const ratioOptions: Ratio[] = useMemo(
    () => (model.startsWith("veo-3.0") ? ["16:9"] : ["16:9", "9:16"]),
    [model]
  );
  const showDuration = model.startsWith("veo-2.0");
  const showResolution = model.startsWith("veo-3.0");

  async function runSingle() {
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
        sampleCount,
      };
      if (model.startsWith("veo-3.0")) payload.resolution = resolution;
      else payload.durationSeconds = duration;
      if (seed !== "") payload.seed = Number(seed);

      if (mode === "image") {
        if (!imageFile) return appendLog("✖ No image selected");
        const ab = await imageFile.arrayBuffer();
        payload.imageBase64 = abToBase64(ab);
        payload.imageMimeType = imageFile.type;
      } else if (mode === "json") {
        payload = JSON.parse(jsonText);
      }

      const res = await fetch("/api/veo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, payload }),
      });
      if (!res.ok) throw new Error(await res.text());

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
      appendLog("✔ Done");
    } catch (e: any) {
      appendLog(`✖ ${e.message || e}`);
    }
  }

  async function handleTxtUpload(file: File) {
    const text = await file.text();
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    setBatchJobs(lines.map((l) => ({ prompt: l, status: "queued" })));
  }

  async function runBatch() {
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
          sampleCount,
        };
        if (model.startsWith("veo-3.0")) payload.resolution = resolution;
        else payload.durationSeconds = duration;
        if (seed !== "") payload.seed = Number(seed);

        const res = await fetch("/api/veo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey, payload }),
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
  }

  const batchProgress = batchJobs.length
    ? (100 * batchJobs.filter((j) => j.status !== "queued").length) / batchJobs.length
    : 0;

  return (
    <main className="mx-auto max-w-6xl p-6">
      {/* Header */}
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Veo Web Generator</h1>
          <p className="text-sm text-neutral-600">
            Text / Image / JSON → Video via Google Veo (Gemini API). Multi-user: setiap user pakai API key mereka sendiri.
          </p>
        </div>
        <a
          className="text-xs underline text-neutral-500 hover:text-neutral-800"
          href="https://aistudio.google.com/app/apikey"
          target="_blank"
        >
          Get Google API Key
        </a>
      </header>

      {/* Main grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Left column */}
        <section className="md:col-span-1 space-y-4">
          <div className="rounded-2xl border bg-white shadow-sm">
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium">API Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Google API Key"
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium">Mode</label>
                <div className="mt-1 flex gap-2">
                  {(["text", "image", "json"] as Mode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={[
                        "rounded-lg px-3 py-1.5 text-sm border transition",
                        mode === m ? "bg-black text-white" : "bg-white hover:bg-neutral-50",
                      ].join(" ")}
                    >
                      {m.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium">Model</label>
                <select
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                >
                  {MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium">Aspect Ratio</label>
                <div className="mt-1 flex gap-2">
                  {ratioOptions.map((r) => (
                    <button
                      key={r}
                      onClick={() => setAspectRatio(r)}
                      className={[
                        "rounded-lg px-3 py-1.5 text-sm border",
                        aspectRatio === r ? "bg-black text-white" : "bg-white hover:bg-neutral-50",
                      ].join(" ")}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {showResolution && (
                <div>
                  <label className="block text-sm font-medium">Resolution (Veo 3)</label>
                  <select
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value as Res)}
                  >
                    <option value="720p">720p</option>
                    <option value="1080p">1080p</option>
                  </select>
                </div>
              )}

              {showDuration && (
                <div>
                  <label className="block text-sm font-medium">Duration (Veo 2, 5–8)</label>
                  <input
                    type="number"
                    min={5}
                    max={8}
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium">Negative Prompt</label>
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium">Sample Count (1–4)</label>
                  <input
                    type="number"
                    min={1}
                    max={4}
                    value={sampleCount}
                    onChange={(e) => setSampleCount(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Seed (optional)</label>
                  <input
                    type="number"
                    value={seed}
                    onChange={(e) => setSeed(e.target.value ? Number(e.target.value) : "")}
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium">Person Generation</label>
                <select
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={personGen}
                  onChange={(e) => setPersonGen(e.target.value as PersonGen)}
                >
                  <option value="allow_all">allow_all</option>
                  <option value="allow_adult">allow_adult</option>
                  <option value="dont_allow">dont_allow</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* Right column */}
        <section className="md:col-span-2 space-y-6">
          {/* Content card */}
          <div className="rounded-2xl border bg-white shadow-sm p-4 space-y-4">
            {mode === "text" && (
              <div>
                <label className="block text-sm font-medium">Prompt</label>
                <textarea
                  rows={6}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Cinematic macro shot of roasted coffee beans tumbling…"
                />
              </div>
            )}

            {mode === "image" && (
              <>
                <div>
                  <label className="block text-sm font-medium">Prompt (optional, guidance)</label>
                  <textarea
                    rows={4}
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Reference Image (PNG/JPG ≤ 10MB)</label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    className="mt-1 block w-full text-sm"
                    onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                  />
                </div>
              </>
            )}

            {mode === "json" && (
              <div>
                <label className="block text-sm font-medium">JSON Payload</label>
                <textarea
                  rows={16}
                  className="mt-1 w-full rounded-lg border px-3 py-2 font-mono text-xs"
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                />
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={runSingle} className="rounded-lg bg-black px-4 py-2 text-white hover:opacity-90">
                Generate
              </button>
              <button
                onClick={() => { setLogs([]); setVideoUrl(null); }}
                className="rounded-lg border px-4 py-2 hover:bg-neutral-50"
              >
                Reset
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium">Logs</label>
              <div
                ref={logRef}
                className="mt-1 h-40 overflow-auto rounded-lg border bg-neutral-900 p-2 font-mono text-xs text-green-300"
              >
                {logs.join("\n") || "No logs yet"}
              </div>
            </div>

            {videoUrl && (
              <div className="rounded-xl border p-3">
                <video src={videoUrl} controls className="w-full rounded-lg" />
                <div className="mt-2">
                  <a href={videoUrl} download className="text-sm underline">
                    Download MP4
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Batch card */}
          <div className="rounded-2xl border bg-white shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Batch Generate</h3>
              <div className="text-xs text-neutral-500">{batchJobs.filter(j => j.status !== "queued").length}/{batchJobs.length} processed</div>
            </div>
            <p className="text-sm text-neutral-600">Upload .txt berisi prompt per baris.</p>
            <input
              type="file"
              accept="text/plain"
              onChange={(e) => e.target.files?.[0] && handleTxtUpload(e.target.files[0])}
              className="block w-full text-sm"
            />
            <div className="flex items-center gap-3">
              <button
                disabled={!batchJobs.length || batchRunning}
                onClick={runBatch}
                className="rounded-lg bg-black px-3 py-1.5 text-white disabled:opacity-50"
              >
                Run Batch
              </button>
              <div className="h-2 w-48 rounded-full bg-neutral-200">
                <div className="h-2 rounded-full bg-neutral-900" style={{ width: `${batchProgress}%` }} />
              </div>
              <span className="text-xs text-neutral-600">{Math.round(batchProgress)}%</span>
            </div>

            {batchJobs.length > 0 && (
              <div className="max-h-48 overflow-auto rounded-lg border p-2 text-sm">
                {batchJobs.map((j, i) => (
                  <div key={i} className="flex items-center gap-2 py-1">
                    <span className="w-8 text-xs text-neutral-500">{i + 1}.</span>
                    <span className="flex-1 truncate">{j.prompt}</span>
                    <span className="text-xs">{j.status}</span>
                    {j.url && (
                      <a className="text-xs underline" href={j.url} download>
                        download
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="text-xs text-neutral-500">
            This app uses the user’s own Google API key. Keys are not logged or stored by the server.
          </p>
        </section>
      </div>
    </main>
  );
}
