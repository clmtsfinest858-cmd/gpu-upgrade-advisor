import { NextRequest, NextResponse } from "next/server";

// Lightweight GPU dataset — extend as needed
type GpuOption = {
  id: string;
  name: string;
  price: number;
  perfScore: number; // synthetic baseline performance score
  formFactor: "desktop" | "laptop" | "both";
  productUrl: string; // canonical product/search URL
};

const GPU_OPTIONS: GpuOption[] = [
  {
    id: "rtx-4060",
    name: "NVIDIA GeForce RTX 4060",
    price: 299,
    perfScore: 100,
    formFactor: "desktop",
    productUrl: "https://www.newegg.com/p/pl?d=rtx+4060",
  },
  {
    id: "rtx-4070",
    name: "NVIDIA GeForce RTX 4070",
    price: 549,
    perfScore: 145,
    formFactor: "desktop",
    productUrl: "https://www.newegg.com/p/pl?d=rtx+4070",
  },
  {
    id: "rx-7800-xt",
    name: "AMD Radeon RX 7800 XT",
    price: 499,
    perfScore: 140,
    formFactor: "desktop",
    productUrl: "https://www.newegg.com/p/pl?d=rx+7800+xt",
  },
  {
    id: "laptop-rtx-4060",
    name: "Laptop RTX 4060 (various OEMs)",
    price: 1299,
    perfScore: 110,
    formFactor: "laptop",
    productUrl: "https://www.amazon.com/s?k=laptop+rtx+4060",
  },
];

const GAME_WEIGHTS: Record<string, number> = {
  "cyberpunk 2077": 1.1,
  "valorant": 0.6,
  "fortnite": 0.7,
  "elderscrolls": 1.0,
  "call of duty": 0.95,
};

type Payload = {
  formFactor: "desktop" | "laptop";
  currentGpu: string;
  vramGb?: number;
  budget: number;
  cores?: number;
  resolution: "1080p" | "1440p" | "4K";
  games?: string;
};

function parseGames(text?: string) {
  if (!text) return [];
  return text
    .toLowerCase()
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function estimateCurrentPerf(form: Payload): number {
  const name = (form.currentGpu || "").toLowerCase();
  if (!name) {
    if ((form.vramGb || 0) >= 12) return 100;
    if ((form.vramGb || 0) >= 8) return 70;
    if ((form.vramGb || 0) >= 6) return 55;
    return 35;
  }

  if (name.includes("1050") || name.includes("rx 570")) return 40;
  if (name.includes("1060") || name.includes("1660") || name.includes("rx 580")) return 55;
  if (name.includes("2060") || name.includes("2070") || name.includes("rx 5600")) return 75;
  if (name.includes("3060") || name.includes("6700")) return 90;
  if (name.includes("3070") || name.includes("6800")) return 110;
  if (name.includes("4060")) return 100;
  if (name.includes("4070")) return 145;

  if ((form.vramGb || 0) >= 12) return 100;
  if ((form.vramGb || 0) >= 8) return 70;
  if ((form.vramGb || 0) >= 6) return 55;
  return 35;
}

function resolutionMultiplier(res: Payload["resolution"]) {
  switch (res) {
    case "1080p":
      return 1;
    case "1440p":
      return 0.8;
    case "4K":
      return 0.6;
  }
}

function cpuBottleneckFactor(cores?: number) {
  if (!cores) return 1;
  if (cores <= 4) return 0.8;
  if (cores <= 6) return 0.92;
  return 1;
}

// returns affiliate URLs object for supported retailers
function buildAffiliateUrls(productUrl: string) {
  const tag = process.env.AFFILIATE_TAG || "";

  const urls: Record<string, string | null> = {
    amazon: null,
    newegg: null,
    ebay: null,
    canonical: productUrl,
  };

  try {
    const url = new URL(productUrl);
    const host = url.hostname;

    // Amazon
    if (host.includes("amazon.")) {
      const a = new URL(productUrl);
      if (tag) a.searchParams.set("tag", tag);
      urls.amazon = a.toString();
    } else {
      const s = new URL("https://www.amazon.com/s");
      s.searchParams.set("k", productUrl);
      if (tag) s.searchParams.set("tag", tag);
      urls.amazon = s.toString();
    }

    // Newegg
    if (host.includes("newegg.")) {
      const n = new URL(productUrl);
      if (tag) n.searchParams.set("clickTrack", tag);
      urls.newegg = n.toString();
    } else {
      const n = new URL("https://www.newegg.com/p/pl");
      n.searchParams.set("d", productUrl);
      if (tag) n.searchParams.set("clickTrack", tag);
      urls.newegg = n.toString();
    }

    // eBay
    if (host.includes("ebay.")) {
      const e = new URL(productUrl);
      if (tag) e.searchParams.set("campid", tag);
      urls.ebay = e.toString();
    } else {
      const e = new URL("https://www.ebay.com/sch/i.html");
      e.searchParams.set("_nkw", productUrl);
      if (tag) e.searchParams.set("campid", tag);
      urls.ebay = e.toString();
    }
  } catch (e) {
    // fallback: leave canonical only
  }

  return urls;
}

export async function POST(req: NextRequest) {
  try {
    const data = (await req.json()) as Partial<Payload>;
    if (!data.budget || !data.currentGpu || !data.formFactor || !data.resolution) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const payload: Payload = {
      formFactor: data.formFactor,
      currentGpu: data.currentGpu,
      vramGb: Number(data.vramGb || 0),
      budget: Number(data.budget),
      cores: data.cores ? Number(data.cores) : undefined,
      resolution: data.resolution,
      games: data.games || "",
    };

    const currentPerf = estimateCurrentPerf(payload);
    const resMult = resolutionMultiplier(payload.resolution);
    const gameList = parseGames(payload.games);

    const gameMultiplier =
      gameList.length === 0
        ? 1
        : Math.max(...gameList.map((g) => GAME_WEIGHTS[g] ?? 1));

    const cpuFactor = cpuBottleneckFactor(payload.cores);

    const candidates = GPU_OPTIONS.filter((g) => {
      if (g.price > payload.budget) return false;
      if (g.formFactor !== "both" && g.formFactor !== payload.formFactor) return false;
      return true;
    });

    if (candidates.length === 0) {
      return NextResponse.json({ error: "No GPUs found under your budget for this form factor." }, { status: 200 });
    }

    const scored = candidates.map((g) => {
      const effectivePerf = g.perfScore * resMult * gameMultiplier * cpuFactor;
      const gain = Math.max(effectivePerf - currentPerf, 0);
      const estFpsGainPercent = currentPerf > 0 ? (gain / currentPerf) * 100 : 0;
      const costPerFpsPoint = estFpsGainPercent > 0 ? g.price / estFpsGainPercent : Infinity;

      return {
        gpu: g,
        effectivePerf,
        estFpsGainPercent,
        costPerFpsPoint,
      };
    });

    scored.sort((a, b) => a.costPerFpsPoint - b.costPerFpsPoint);

    const best = scored[0];

    return NextResponse.json({
      recommendation: {
        name: best.gpu.name,
        price: best.gpu.price,
        estFpsGainPercent: Math.round(best.estFpsGainPercent),
        costPerFpsPoint: Math.round(best.costPerFpsPoint * 100) / 100,
        affiliateUrls: buildAffiliateUrls(best.gpu.productUrl),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
