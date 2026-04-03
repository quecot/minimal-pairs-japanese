import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT) || 4173;
const upstreamBaseURL = "https://kotu.io";

const fallbackMinimalPairs = [
  {
    kana: "あら",
    pairs: [
      {
        id: "60051FB6-53C9-494F-B3D0-4F60FDDF9C61",
        pitchAccent: 2,
        entries: [
          {
            id: "60051FB6-53C9-494F-B3D0-4F60FDDF9C61",
            kanji: [],
            kana: "あら",
            pronunciations: [
              {
                id: "F79F8F7D-896F-4131-8949-046875D21556",
                phrases: [
                  {
                    rawPronunciation: "アラ",
                    accentedMora: 2,
                    silencedMoras: [],
                    nasalizedMoras: [],
                    notes: []
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        id: "8AC4A3DE-CD45-4A3D-A40A-4DB33D69949C",
        pitchAccent: 1,
        entries: [
          {
            id: "8AC4A3DE-CD45-4A3D-A40A-4DB33D69949C",
            kanji: [],
            kana: "あら",
            pronunciations: [
              {
                id: "7A162C1C-AFA6-4F87-A137-97B7C98059C4",
                phrases: [
                  {
                    rawPronunciation: "アラ",
                    accentedMora: 1,
                    silencedMoras: [],
                    nasalizedMoras: [],
                    notes: []
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  },
  {
    kana: "はな",
    pairs: [
      {
        id: "fallback-hana-1",
        pitchAccent: 1,
        entries: [
          {
            id: "fallback-hana-1",
            kanji: ["花"],
            kana: "はな",
            pronunciations: [
              {
                id: "fallback-hana-pron-1",
                phrases: [
                  {
                    rawPronunciation: "ハナ",
                    accentedMora: 1,
                    silencedMoras: [],
                    nasalizedMoras: [],
                    notes: []
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        id: "fallback-hana-2",
        pitchAccent: 2,
        entries: [
          {
            id: "fallback-hana-2",
            kanji: ["鼻"],
            kana: "はな",
            pronunciations: [
              {
                id: "fallback-hana-pron-2",
                phrases: [
                  {
                    rawPronunciation: "ハナ",
                    accentedMora: 2,
                    silencedMoras: [],
                    nasalizedMoras: [],
                    notes: []
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
];

app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

app.use(express.static(path.join(__dirname, "public")));

function buildUpstreamURL(pathname, query) {
  const url = new URL(pathname, upstreamBaseURL);
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }
    url.searchParams.set(key, String(value));
  });
  return url;
}

app.get("/api/tests/pitchAccent/minimalPairs/random", async (req, res) => {
  try {
    const upstreamURL = buildUpstreamURL("/api/tests/pitchAccent/minimalPairs/random", req.query);
    const upstream = await fetch(upstreamURL, {
      headers: {
        "User-Agent": "minimal-pairs-intonation-replica"
      }
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      return res.status(upstream.status).json({
        error: "Upstream request failed",
        status: upstream.status,
        detail: text
      });
    }

    const data = await upstream.json();
    return res.json(data);
  } catch (error) {
    console.warn("Falling back to local minimal-pair sample data:", error);
    const sample = fallbackMinimalPairs[Math.floor(Math.random() * fallbackMinimalPairs.length)];
    return res.json(sample);
  }
});

app.get("/api/pronunciation/audio/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const upstreamURL = buildUpstreamURL(`/api/pronunciation/audio/${id}`, req.query);
    const upstream = await fetch(upstreamURL, {
      headers: {
        "User-Agent": "minimal-pairs-intonation-replica"
      }
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      return res.status(upstream.status).json({
        error: "Upstream audio request failed",
        status: upstream.status,
        detail: text
      });
    }

    const contentType = upstream.headers.get("content-type") || "audio/mp4";
    const cacheControl = upstream.headers.get("cache-control");
    const acceptRanges = upstream.headers.get("accept-ranges");
    const contentLength = upstream.headers.get("content-length");

    if (cacheControl) {
      res.set("cache-control", cacheControl);
    }
    if (acceptRanges) {
      res.set("accept-ranges", acceptRanges);
    }
    if (contentLength) {
      res.set("content-length", contentLength);
    }
    res.set("content-type", contentType);

    const buffer = Buffer.from(await upstream.arrayBuffer());
    return res.status(200).send(buffer);
  } catch (error) {
    return res.status(502).json({
      error: "Could not retrieve audio from upstream",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(port, () => {
  console.log(`Replica server running on http://localhost:${port}`);
});
