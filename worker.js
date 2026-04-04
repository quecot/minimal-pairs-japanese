const upstreamBaseURL = "https://kotu.io";
const workerUserAgent = "minimal-pairs-intonation-replica-worker";
const COMBINING_DAKUTEN = "\u3099";
const COMBINING_HANDAKUTEN = "\u309A";

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
                    notes: [],
                  },
                ],
              },
            ],
          },
        ],
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
                    notes: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
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
                    notes: [],
                  },
                ],
              },
            ],
          },
        ],
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
                    notes: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];

function buildUpstreamURL(pathname, requestURL) {
  const upstreamURL = new URL(pathname, upstreamBaseURL);
  const incomingURL = new URL(requestURL);
  incomingURL.searchParams.forEach((value, key) => {
    upstreamURL.searchParams.append(key, value);
  });
  return upstreamURL;
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function normalizePronunciationText(text) {
  let value = text
    .replaceAll("\u309B", COMBINING_DAKUTEN)
    .replaceAll("\u309C", COMBINING_HANDAKUTEN)
    .replaceAll("\uFF9E", COMBINING_DAKUTEN)
    .replaceAll("\uFF9F", COMBINING_HANDAKUTEN);

  const chars = Array.from(value);
  for (let i = 1; i < chars.length; i += 1) {
    if (chars[i] !== COMBINING_HANDAKUTEN) {
      continue;
    }

    const base = chars[i - 1];
    const handakutenPair = `${base}${COMBINING_HANDAKUTEN}`;
    const dakutenPair = `${base}${COMBINING_DAKUTEN}`;
    const canComposeHandakuten =
      handakutenPair.normalize("NFC") !== handakutenPair;
    const canComposeDakuten = dakutenPair.normalize("NFC") !== dakutenPair;

    if (!canComposeHandakuten && canComposeDakuten) {
      chars[i] = COMBINING_DAKUTEN;
    }
  }

  value = chars.join("");
  return value.normalize("NFKC").normalize("NFC");
}

function sanitizePhrase(phrase) {
  if (!phrase || typeof phrase !== "object") {
    return phrase;
  }
  if (typeof phrase.rawPronunciation !== "string") {
    return phrase;
  }
  return {
    ...phrase,
    rawPronunciation: normalizePronunciationText(phrase.rawPronunciation),
  };
}

function sanitizePronunciation(pronunciation) {
  if (!pronunciation || typeof pronunciation !== "object") {
    return pronunciation;
  }
  if (!Array.isArray(pronunciation.phrases)) {
    return pronunciation;
  }
  return {
    ...pronunciation,
    phrases: pronunciation.phrases.map(sanitizePhrase),
  };
}

function sanitizeEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return entry;
  }
  if (!Array.isArray(entry.pronunciations)) {
    return entry;
  }
  return {
    ...entry,
    pronunciations: entry.pronunciations.map(sanitizePronunciation),
  };
}

function sanitizePair(pair) {
  if (!pair || typeof pair !== "object") {
    return pair;
  }
  if (!Array.isArray(pair.entries)) {
    return pair;
  }
  return {
    ...pair,
    entries: pair.entries.map(sanitizeEntry),
  };
}

function sanitizeMinimalPairData(data) {
  if (!data || typeof data !== "object") {
    return data;
  }
  if (!Array.isArray(data.pairs)) {
    return data;
  }
  return {
    ...data,
    pairs: data.pairs.map(sanitizePair),
  };
}

function pickFallbackMinimalPair() {
  const index = Math.floor(Math.random() * fallbackMinimalPairs.length);
  return fallbackMinimalPairs[index];
}

async function proxyRandomMinimalPair(request) {
  try {
    const upstreamURL = buildUpstreamURL(
      "/api/tests/pitchAccent/minimalPairs/random",
      request.url,
    );

    const upstream = await fetch(upstreamURL, {
      headers: {
        "User-Agent": workerUserAgent,
        Accept: "application/json",
      },
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      return jsonResponse(upstream.status, {
        error: "Upstream request failed",
        status: upstream.status,
        detail,
      });
    }

    if (request.method === "HEAD") {
      return upstream;
    }

    const data = await upstream.json();
    return jsonResponse(upstream.status, sanitizeMinimalPairData(data));
  } catch (error) {
    console.warn("Falling back to local minimal-pair sample data", error);
    return jsonResponse(
      200,
      sanitizeMinimalPairData(pickFallbackMinimalPair()),
    );
  }
}

async function proxyPronunciationAudio(request, id) {
  try {
    const upstreamURL = buildUpstreamURL(
      `/api/pronunciation/audio/${id}`,
      request.url,
    );

    const headers = new Headers({
      "User-Agent": workerUserAgent,
    });

    const range = request.headers.get("range");
    if (range) {
      headers.set("range", range);
    }

    const upstream = await fetch(upstreamURL, { headers });

    if (!upstream.ok) {
      const detail = await upstream.text();
      return jsonResponse(upstream.status, {
        error: "Upstream audio request failed",
        status: upstream.status,
        detail,
      });
    }

    const responseHeaders = new Headers();
    [
      "content-type",
      "cache-control",
      "accept-ranges",
      "content-length",
      "content-range",
      "etag",
      "last-modified",
    ].forEach((headerName) => {
      const value = upstream.headers.get(headerName);
      if (value) {
        responseHeaders.set(headerName, value);
      }
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    return jsonResponse(502, {
      error: "Could not retrieve audio from upstream",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

async function serveStaticAsset(request, env) {
  const assetResponse = await env.ASSETS.fetch(request);
  if (assetResponse.status !== 404) {
    return assetResponse;
  }

  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) {
    return new Response("Not Found", { status: 404 });
  }

  const indexRequest = new Request(
    new URL("/index.html", request.url),
    request,
  );
  return env.ASSETS.fetch(indexRequest);
}

export default {
  async fetch(request, env) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const url = new URL(request.url);

    if (url.pathname === "/api/tests/pitchAccent/minimalPairs/random") {
      return proxyRandomMinimalPair(request);
    }

    if (url.pathname.startsWith("/api/pronunciation/audio/")) {
      const id = decodeURIComponent(
        url.pathname.replace("/api/pronunciation/audio/", ""),
      );
      if (!id) {
        return jsonResponse(400, { error: "Missing audio id" });
      }
      return proxyPronunciationAudio(request, id);
    }

    return serveStaticAsset(request, env);
  },
};
