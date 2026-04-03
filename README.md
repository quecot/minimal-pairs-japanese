# Minimal Pairs Intonation Replica

This app replicates the Kotu pitch-accent minimal pairs perception test flow and adapts the answer mode to per-mora intonation:

- Listen to one randomly selected prompt in the minimal pair set.
- Mark each mora as high (H) or low (L).
- Submit to score against the expected high/low contour.
- Track history and per-pattern statistics.
- Keep pattern filters and audio options from the original test flow.

## Run

1. Install dependencies.

   npm install

2. Start the server.

   npm start

3. Open the app.

   http://localhost:4173

## Notes

- The local server proxies these endpoints from kotu.io:
  - /api/tests/pitchAccent/minimalPairs/random
  - /api/pronunciation/audio/:id
- If the upstream minimal-pairs endpoint is unreachable, the server falls back to a small built-in sample set so the app remains usable.
