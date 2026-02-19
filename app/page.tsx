"use client";

import { useState } from "react";

type FormState = {
  formFactor: "desktop" | "laptop";
  currentGpu: string;
  vramGb: number | "";
  budget: number | "";
  cores: number | "";
  resolution: "1080p" | "1440p" | "4K";
  games: string;
};

type AffiliateUrls = {
  amazon?: string | null;
  newegg?: string | null;
  ebay?: string | null;
  canonical?: string;
};

type Recommendation = {
  name: string;
  price: number;
  estFpsGainPercent: number;
  costPerFpsPoint?: number | null;
  affiliateUrls?: AffiliateUrls;
};

export default function Home() {
  const [form, setForm] = useState<FormState>({
    formFactor: "desktop",
    currentGpu: "",
    vramGb: "",
    budget: "",
    cores: "",
    resolution: "1080p",
    games: "",
  });

  const [loading, setLoading] = useState(false);
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]:
        name === "vramGb" || name === "budget" || name === "cores"
          ? value === ""
            ? ""
            : Number(value)
          : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setRec(null);

    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Request failed");
      }

      setRec(data.recommendation);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ padding: "2rem", maxWidth: 800, margin: "0 auto", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: "2rem", marginBottom: "1rem" }}>GPU Upgrade Advisor</h1>
      <p style={{ marginBottom: "1.5rem" }}>Get a hyper-focused GPU recommendation based on your rig, budget, and games.</p>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem" }}>
        <label>
          Form factor:
          <select name="formFactor" value={form.formFactor} onChange={handleChange}>
            <option value="desktop">Desktop</option>
            <option value="laptop">Laptop</option>
          </select>
        </label>

        <label>
          Current GPU:
          <input name="currentGpu" value={form.currentGpu} onChange={handleChange} placeholder="e.g. RTX 2060" />
        </label>

        <label>
          GPU VRAM (GB):
          <input type="number" name="vramGb" value={form.vramGb} onChange={handleChange} min={0} />
        </label>

        <label>
          Budget (USD):
          <input type="number" name="budget" value={form.budget} onChange={handleChange} min={0} />
        </label>

        <label>
          Target core count (optional):
          <input type="number" name="cores" value={form.cores} onChange={handleChange} min={0} placeholder="CUDA cores / shaders" />
        </label>

        <label>
          Target resolution:
          <select name="resolution" value={form.resolution} onChange={handleChange}>
            <option value="1080p">1080p</option>
            <option value="1440p">1440p</option>
            <option value="4K">4K</option>
          </select>
        </label>

        <label>
          Main games you play:
          <textarea name="games" value={form.games} onChange={handleChange} placeholder="e.g. Cyberpunk 2077, Valorant" rows={3} />
        </label>

        <button type="submit" disabled={loading}>{loading ? "Calculating..." : "Get Recommendation"}</button>
      </form>

      {error && <p style={{ color: "red", marginTop: "1rem" }}>{error}</p>}

      {rec && (
        <section style={{ marginTop: "2rem", padding: "1rem", border: "1px solid #ccc" }}>
          <h2>Recommended GPU</h2>
          <p><strong>{rec.name}</strong> – ${rec.price.toFixed(2)}</p>
          <p>Estimated FPS gain: {rec.estFpsGainPercent}%</p>
          <p>Cost per FPS improvement point: ${rec.costPerFpsPoint != null ? rec.costPerFpsPoint.toFixed(2) : "N/A"}</p>

          {rec.affiliateUrls ? (
            <div style={{ marginTop: "1rem" }}>
              <p>Buy links:</p>
              <ul>
                {rec.affiliateUrls.amazon && (
                  <li><a href={rec.affiliateUrls.amazon} target="_blank" rel="noreferrer">Amazon</a></li>
                )}
                {rec.affiliateUrls.newegg && (
                  <li><a href={rec.affiliateUrls.newegg} target="_blank" rel="noreferrer">Newegg</a></li>
                )}
                {rec.affiliateUrls.ebay && (
                  <li><a href={rec.affiliateUrls.ebay} target="_blank" rel="noreferrer">eBay</a></li>
                )}
                {rec.affiliateUrls.canonical && (
                  <li><a href={rec.affiliateUrls.canonical} target="_blank" rel="noreferrer">Canonical</a></li>
                )}
              </ul>
            </div>
          ) : (
            <p>
              <a href={rec.affiliateUrls?.canonical || "#"} target="_blank" rel="noreferrer">Buy link</a>
            </p>
          )}
        </section>
      )}
    </main>
  );
}
