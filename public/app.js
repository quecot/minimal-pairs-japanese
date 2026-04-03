const SETTINGS_KEY = "minimal-pairs-intonation.settings";

const COMBINING_KANA = new Set([
  "ァ", "ィ", "ゥ", "ェ", "ォ", "ヵ", "ヶ", "ャ", "ュ", "ョ", "ヮ",
  "ぁ", "ぃ", "ぅ", "ぇ", "ぉ", "ゃ", "ゅ", "ょ", "ゎ", "ゕ", "ゖ"
]);

const state = {
  started: false,
  loading: false,
  history: [],
  statistics: emptyStatistics(),
  currentQuestion: null,
  userPattern: [],
  submitted: false,
  lastResultCorrect: null,
  preloadedMinimalPair: null,
  settings: loadSettings()
};

const dom = {
  startPanel: document.getElementById("startPanel"),
  mainPanel: document.getElementById("mainPanel"),
  startButton: document.getElementById("startButton"),
  loadingNotice: document.getElementById("loadingNotice"),
  statusNotice: document.getElementById("statusNotice"),
  promptBody: document.getElementById("promptBody"),
  kanaHeading: document.getElementById("kanaHeading"),
  promptAudio: document.getElementById("promptAudio"),
  replayButton: document.getElementById("replayButton"),
  moraAnswerArea: document.getElementById("moraAnswerArea"),
  submitButton: document.getElementById("submitButton"),
  continueButton: document.getElementById("continueButton"),
  resultPanel: document.getElementById("resultPanel"),
  referencePanel: document.getElementById("referencePanel"),
  referenceOptions: document.getElementById("referenceOptions"),
  historyList: document.getElementById("historyList"),
  statisticsArea: document.getElementById("statisticsArea"),
  settingInputs: {
    heibanEnabled: document.getElementById("heibanEnabled"),
    atamadakaEnabled: document.getElementById("atamadakaEnabled"),
    secondMoraAccentEnabled: document.getElementById("secondMoraAccentEnabled"),
    secondToLastMoraAccentEnabled: document.getElementById("secondToLastMoraAccentEnabled"),
    otherNakadakaEnabled: document.getElementById("otherNakadakaEnabled"),
    onlyDevoicedWords: document.getElementById("onlyDevoicedWords"),
    lowPassEnabled: document.getElementById("lowPassEnabled"),
    backgroundNoise: document.getElementById("backgroundNoise")
  }
};

function defaultSettings() {
  return {
    heibanEnabled: true,
    atamadakaEnabled: true,
    secondMoraAccentEnabled: true,
    secondToLastMoraAccentEnabled: true,
    otherNakadakaEnabled: true,
    onlyDevoicedWords: false,
    lowPassEnabled: false,
    backgroundNoise: false
  };
}

function emptyStatistics() {
  return {
    all: [],
    allCorrect: [],
    heiban: [],
    heibanCorrect: [],
    atamadaka: [],
    atamadakaCorrect: [],
    nakadaka: [],
    nakadakaCorrect: []
  };
}

function loadSettings() {
  const defaults = defaultSettings();
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      return defaults;
    }
    const parsed = JSON.parse(raw);
    return { ...defaults, ...parsed };
  } catch (_error) {
    return defaults;
  }
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
}

function isValidPatternSelection(settings) {
  const enabledCount =
    Number(settings.heibanEnabled) +
    Number(settings.atamadakaEnabled) +
    Number(settings.secondMoraAccentEnabled) +
    Number(settings.secondToLastMoraAccentEnabled) +
    Number(settings.otherNakadakaEnabled);

  if (enabledCount === 0) {
    return false;
  }

  if (
    enabledCount === 1 &&
    (settings.heibanEnabled ||
      settings.atamadakaEnabled ||
      settings.secondMoraAccentEnabled ||
      settings.secondToLastMoraAccentEnabled)
  ) {
    return false;
  }

  return true;
}

function toMoras(text) {
  const moras = [];
  if (!text) {
    return moras;
  }

  for (const char of Array.from(text)) {
    if (char === "｀") {
      continue;
    }
    if ((char === "・" || char === " ") && moras.length > 0) {
      continue;
    }
    if (COMBINING_KANA.has(char) && moras.length > 0) {
      moras[moras.length - 1] += char;
    } else {
      moras.push(char);
    }
  }
  return moras;
}

function outputAccentPlainText(rawPronunciation, accentedMora) {
  const moras = toMoras(rawPronunciation);
  return moras
    .map((mora, index) => (index + 1 === accentedMora ? `${mora}＼` : mora))
    .join("");
}

function outputAccentPlainTexts(phrases) {
  return phrases
    .map((phrase) => outputAccentPlainText(phrase.rawPronunciation, phrase.accentedMora))
    .join("・");
}

function expectedIntonationForPhrase(phrase) {
  const moras = toMoras(phrase.rawPronunciation);
  const accentedMora = phrase.accentedMora;
  const count = moras.length;

  return moras.map((_mora, index) => {
    const i = index + 1;

    if (accentedMora === 1) {
      return i === 1 ? "H" : "L";
    }

    if (accentedMora === 0 || accentedMora === count) {
      return i === 1 ? "L" : "H";
    }

    if (i === 1) {
      return "L";
    }

    if (i <= accentedMora) {
      return "H";
    }

    return "L";
  });
}

function classifyType(pair, phrases) {
  const firstPhrase = phrases[0];
  const moraCount = toMoras(firstPhrase.rawPronunciation).length;

  if (pair.pitchAccent === 0 || pair.pitchAccent === moraCount) {
    return "Heiban / Odaka";
  }
  if (pair.pitchAccent === 1) {
    return "Atamadaka";
  }
  return "Nakadaka";
}

function buildQuestion(minimalPair, pairIndex) {
  const correctPair = minimalPair.pairs[pairIndex];
  const firstEntry = correctPair.entries[0];
  const firstPronunciation = firstEntry.pronunciations[0];
  const phrases = firstPronunciation.phrases;

  const groups = [];
  const expected = [];
  const groupOffsets = [];

  for (const phrase of phrases) {
    groupOffsets.push(expected.length);
    const moras = toMoras(phrase.rawPronunciation);
    const phrasePattern = expectedIntonationForPhrase(phrase);
    groups.push({ phrase, moras, expected: phrasePattern });
    expected.push(...phrasePattern);
  }

  return {
    kana: minimalPair.kana,
    minimalPair,
    correctPair,
    pairIndex,
    groups,
    groupOffsets,
    expected,
    accentText: outputAccentPlainTexts(phrases),
    type: classifyType(correctPair, phrases)
  };
}

function queryStringForMinimalPairs() {
  const params = new URLSearchParams({
    heibanEnabled: String(state.settings.heibanEnabled),
    atamadakaEnabled: String(state.settings.atamadakaEnabled),
    secondMoraAccentEnabled: String(state.settings.secondMoraAccentEnabled),
    secondToLastMoraAccentEnabled: String(state.settings.secondToLastMoraAccentEnabled),
    otherNakadakaEnabled: String(state.settings.otherNakadakaEnabled),
    onlyDevoicedWords: String(state.settings.onlyDevoicedWords)
  });
  return params.toString();
}

function audioURLForPairID(id) {
  const params = new URLSearchParams({
    lowPass: String(state.settings.lowPassEnabled),
    backgroundNoise: String(state.settings.backgroundNoise)
  });
  return `/api/pronunciation/audio/${encodeURIComponent(id)}?${params.toString()}`;
}

async function fetchMinimalPair() {
  const response = await fetch(`/api/tests/pitchAccent/minimalPairs/random?${queryStringForMinimalPairs()}`);
  if (!response.ok) {
    throw new Error(`Could not load item: ${response.status}`);
  }
  return response.json();
}

async function preloadMinimalPair() {
  try {
    state.preloadedMinimalPair = await fetchMinimalPair();
  } catch (_error) {
    state.preloadedMinimalPair = null;
  }
}

function showStatus(message, tone = "info") {
  dom.statusNotice.textContent = message;
  dom.statusNotice.classList.remove("hidden", "warn", "error", "info");
  dom.statusNotice.classList.add(tone);
}

function hideStatus() {
  dom.statusNotice.classList.add("hidden");
}

function playPromptAudio() {
  if (!state.currentQuestion) {
    return;
  }
  const id = state.currentQuestion.correctPair.id;
  dom.promptAudio.src = audioURLForPairID(id);
  dom.promptAudio.load();
  dom.promptAudio.play().catch(() => {
  });
}

function shouldShowContinue(correct) {
  if (!correct) {
    return true;
  }

  return false;
}

function computeStatistics() {
  const all = state.history;
  const heiban = all.filter((item) => item.type === "Heiban / Odaka");
  const atamadaka = all.filter((item) => item.type === "Atamadaka");
  const nakadaka = all.filter((item) => item.type === "Nakadaka");

  state.statistics = {
    all,
    allCorrect: all.filter((item) => item.correct),
    heiban,
    heibanCorrect: heiban.filter((item) => item.correct),
    atamadaka,
    atamadakaCorrect: atamadaka.filter((item) => item.correct),
    nakadaka,
    nakadakaCorrect: nakadaka.filter((item) => item.correct)
  };
}

function presentQuestion(minimalPair) {
  const pairIndex = Math.floor(Math.random() * minimalPair.pairs.length);
  state.currentQuestion = buildQuestion(minimalPair, pairIndex);
  state.userPattern = state.currentQuestion.expected.map(() => null);
  state.submitted = false;
  state.lastResultCorrect = null;
  state.loading = false;
  render();
  playPromptAudio();
}

async function loadRound() {
  if (!state.started) {
    return;
  }

  hideStatus();
  state.loading = true;
  state.currentQuestion = null;
  state.userPattern = [];
  state.submitted = false;
  state.lastResultCorrect = null;
  render();

  try {
    let minimalPair = state.preloadedMinimalPair;
    state.preloadedMinimalPair = null;

    if (!minimalPair) {
      minimalPair = await fetchMinimalPair();
    }

    presentQuestion(minimalPair);
    preloadMinimalPair();
  } catch (error) {
    state.loading = false;
    render();
    showStatus(error instanceof Error ? error.message : "Failed to load test item", "error");
  }
}

function patternAsText(pattern) {
  return pattern.join(" ");
}

function submitCurrentAnswer() {
  if (!state.currentQuestion || state.submitted) {
    return;
  }

  if (state.userPattern.some((value) => value === null)) {
    showStatus("Mark every mora as H or L before submitting.", "warn");
    return;
  }

  hideStatus();

  const expected = state.currentQuestion.expected;
  const correct = state.userPattern.every((value, index) => value === expected[index]);
  state.submitted = true;
  state.lastResultCorrect = correct;

  state.history.unshift({
    correct,
    kana: state.currentQuestion.kana,
    accentText: state.currentQuestion.accentText,
    type: state.currentQuestion.type,
    expected: [...expected],
    answer: [...state.userPattern]
  });

  computeStatistics();
  render();

  if (!correct) {
    showStatus(
      "Incorrect. Use the reference options below to compare patterns and audio, then click Continue.",
      "info"
    );
  }

  if (!shouldShowContinue(correct)) {
    setTimeout(() => {
      loadRound();
    }, 300);
  }
}

function syncTileButtons(index) {
  const tile = dom.moraAnswerArea.querySelector(`.mora-tile[data-global-index="${index}"]`);
  if (!tile) {
    return;
  }

  const highButton = tile.querySelector('.intonation-btn[data-tone="H"]');
  const lowButton = tile.querySelector('.intonation-btn[data-tone="L"]');
  const selected = state.userPattern[index];

  if (highButton) {
    highButton.classList.toggle("selected-high", selected === "H");
  }
  if (lowButton) {
    lowButton.classList.toggle("selected-low", selected === "L");
  }
}

function updateMoraAnswer(index, value, options = {}) {
  if (state.submitted) {
    return;
  }

  state.userPattern[index] = value;

  if (options.skipRerender) {
    syncTileButtons(index);
  } else {
    renderMoraArea();
  }

  renderSubmitAndContinue();
}

function createGroupGraph(group, groupIndex) {
  const question = state.currentQuestion;
  const groupStart = question.groupOffsets[groupIndex];
  const count = group.moras.length;
  const width = Math.max(250, 60 * count + 40);
  const height = 146;
  const leftPadding = 28;
  const rightPadding = 28;
  const topPadding = 30;
  const bottomPadding = 34;
  const yHigh = topPadding;
  const yLow = height - bottomPadding;
  const yMid = (yHigh + yLow) / 2;
  const step = count > 1 ? (width - leftPadding - rightPadding) / (count - 1) : 0;

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.classList.add("intonation-graph");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `Intonation graph for phrase ${groupIndex + 1}`);

  const makeLine = (x1, y1, x2, y2, className) => {
    const line = document.createElementNS(svgNS, "line");
    line.setAttribute("x1", String(x1));
    line.setAttribute("y1", String(y1));
    line.setAttribute("x2", String(x2));
    line.setAttribute("y2", String(y2));
    line.setAttribute("class", className);
    return line;
  };

  svg.appendChild(makeLine(leftPadding, yHigh, width - rightPadding, yHigh, "graph-guide high"));
  svg.appendChild(makeLine(leftPadding, yLow, width - rightPadding, yLow, "graph-guide low"));

  const highLabel = document.createElementNS(svgNS, "text");
  highLabel.setAttribute("x", "6");
  highLabel.setAttribute("y", String(yHigh + 4));
  highLabel.setAttribute("class", "graph-level-label high");
  highLabel.textContent = "H";
  svg.appendChild(highLabel);

  const lowLabel = document.createElementNS(svgNS, "text");
  lowLabel.setAttribute("x", "8");
  lowLabel.setAttribute("y", String(yLow + 4));
  lowLabel.setAttribute("class", "graph-level-label low");
  lowLabel.textContent = "L";
  svg.appendChild(lowLabel);

  const ghostPolyline = document.createElementNS(svgNS, "polyline");
  ghostPolyline.setAttribute("class", "graph-path graph-path-ghost is-hidden");
  svg.appendChild(ghostPolyline);

  const correctPolyline = document.createElementNS(svgNS, "polyline");
  correctPolyline.setAttribute("class", "graph-path graph-path-correct");
  svg.appendChild(correctPolyline);

  const correctCircles = [];
  const ghostCircles = [];
  const previewYByIndex = new Map();
  let activeDrag = null;

  const valueToY = (value) => {
    if (value === "H") {
      return yHigh;
    }
    if (value === "L") {
      return yLow;
    }
    return yMid;
  };

  const getToneFromY = (localY) => {
    return localY <= yMid ? "H" : "L";
  };

  const clampY = (localY) => {
    return Math.max(yHigh, Math.min(yLow, localY));
  };

  const effectiveYForIndex = (moraIndex) => {
    if (previewYByIndex.has(moraIndex)) {
      return previewYByIndex.get(moraIndex);
    }

    const globalIndex = groupStart + moraIndex;
    return valueToY(state.userPattern[globalIndex]);
  };

  const updateGraphVisuals = () => {
    const correctPoints = [];
    const ghostPoints = [];
    const submitted = state.submitted;
    svg.classList.toggle("is-submitted", submitted);

    correctCircles.forEach((correctCircle, moraIndex) => {
      const globalIndex = groupStart + moraIndex;
      const userTone = state.userPattern[globalIndex];
      const expectedTone = group.expected[moraIndex];
      const x = leftPadding + step * moraIndex;

      const correctY = submitted ? valueToY(expectedTone) : effectiveYForIndex(moraIndex);
      const correctTone = submitted
        ? expectedTone
        : (previewYByIndex.has(moraIndex) ? getToneFromY(correctY) : userTone);

      correctPoints.push(`${x},${correctY}`);
      correctCircle.setAttribute("cx", String(x));
      correctCircle.setAttribute("cy", String(correctY));
      correctCircle.classList.toggle("is-high", correctTone === "H");
      correctCircle.classList.toggle("is-low", correctTone === "L");
      correctCircle.classList.toggle("is-unset", correctTone !== "H" && correctTone !== "L");
      correctCircle.classList.toggle("is-submitted", submitted);

      const ghostCircle = ghostCircles[moraIndex];
      const ghostY = valueToY(userTone);
      ghostPoints.push(`${x},${ghostY}`);
      ghostCircle.setAttribute("cx", String(x));
      ghostCircle.setAttribute("cy", String(ghostY));
      ghostCircle.classList.toggle("is-high", userTone === "H");
      ghostCircle.classList.toggle("is-low", userTone === "L");
      ghostCircle.classList.toggle("is-unset", userTone !== "H" && userTone !== "L");
      ghostCircle.classList.toggle("is-hidden", !submitted);
    });

    correctPolyline.setAttribute("points", correctPoints.join(" "));
    correctPolyline.classList.toggle("is-submitted", submitted);

    ghostPolyline.setAttribute("points", ghostPoints.join(" "));
    ghostPolyline.classList.toggle("is-hidden", !submitted);
  };

  const getLocalPosition = (event) => {
    const rect = svg.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;

    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };
  };

  const commitTone = (moraIndex, localY) => {
    const globalIndex = groupStart + moraIndex;
    const nextTone = getToneFromY(clampY(localY));

    if (state.userPattern[globalIndex] !== nextTone) {
      updateMoraAnswer(globalIndex, nextTone, { skipRerender: true });
    }
  };

  const startInteraction = (moraIndex, event) => {
    if (state.submitted) {
      return;
    }

    event.preventDefault();
    const local = getLocalPosition(event);
    activeDrag = {
      pointerId: event.pointerId,
      moraIndex
    };

    previewYByIndex.set(moraIndex, clampY(local.y));
    updateGraphVisuals();

    try {
      svg.setPointerCapture(event.pointerId);
    } catch (_error) {
    }
  };

  const continueInteraction = (event) => {
    if (!activeDrag || event.pointerId !== activeDrag.pointerId) {
      return;
    }

    const local = getLocalPosition(event);
    previewYByIndex.set(activeDrag.moraIndex, clampY(local.y));
    updateGraphVisuals();
  };

  const finishInteraction = (event) => {
    if (!activeDrag || event.pointerId !== activeDrag.pointerId) {
      return;
    }

    const local = getLocalPosition(event);
    commitTone(activeDrag.moraIndex, local.y);
    previewYByIndex.delete(activeDrag.moraIndex);
    activeDrag = null;

    try {
      svg.releasePointerCapture(event.pointerId);
    } catch (_error) {
    }

    updateGraphVisuals();
  };

  group.moras.forEach((mora, moraIndex) => {
    const x = leftPadding + step * moraIndex;
    const hitWidth = count > 1 ? Math.max(30, Math.min(58, step * 0.9)) : 54;

    const marker = document.createElementNS(svgNS, "line");
    marker.setAttribute("x1", String(x));
    marker.setAttribute("x2", String(x));
    marker.setAttribute("y1", String(yHigh));
    marker.setAttribute("y2", String(yLow));
    marker.setAttribute("class", "graph-vertical-marker");
    svg.appendChild(marker);

    const text = document.createElementNS(svgNS, "text");
    text.setAttribute("x", String(x));
    text.setAttribute("y", String(height - 10));
    text.setAttribute("class", "graph-mora-label");
    text.textContent = mora;
    svg.appendChild(text);

    const hitArea = document.createElementNS(svgNS, "rect");
    hitArea.setAttribute("x", String(x - hitWidth / 2));
    hitArea.setAttribute("y", String(yHigh - 14));
    hitArea.setAttribute("width", String(hitWidth));
    hitArea.setAttribute("height", String(yLow - yHigh + 28));
    hitArea.setAttribute("class", "graph-hit-area");
    hitArea.addEventListener("pointerdown", (event) => startInteraction(moraIndex, event));
    svg.appendChild(hitArea);

    const ghostCircle = document.createElementNS(svgNS, "circle");
    ghostCircle.setAttribute("r", "9");
    ghostCircle.setAttribute("class", "graph-dot graph-dot-ghost is-unset is-hidden");
    ghostCircles.push(ghostCircle);
    svg.appendChild(ghostCircle);

    const circle = document.createElementNS(svgNS, "circle");
    circle.setAttribute("r", "9");
    circle.setAttribute("class", "graph-dot graph-dot-correct is-unset");
    circle.addEventListener("pointerdown", (event) => startInteraction(moraIndex, event));
    correctCircles.push(circle);
    svg.appendChild(circle);
  });

  svg.addEventListener("pointermove", continueInteraction);
  svg.addEventListener("pointerup", finishInteraction);
  svg.addEventListener("pointercancel", finishInteraction);

  updateGraphVisuals();
  return svg;
}

function renderMoraArea() {
  const question = state.currentQuestion;
  dom.moraAnswerArea.innerHTML = "";

  if (!question) {
    return;
  }

  question.groups.forEach((group, groupIndex) => {
    const groupWrap = document.createElement("div");
    groupWrap.className = "mora-group";

    const label = document.createElement("div");
    label.className = "mora-group-label";
    label.textContent = `Phrase ${groupIndex + 1}`;
    groupWrap.appendChild(label);

    const graphWrap = document.createElement("div");
    graphWrap.className = "mora-graph-wrap";
    graphWrap.appendChild(createGroupGraph(group, groupIndex));
    groupWrap.appendChild(graphWrap);

    const grid = document.createElement("div");
    grid.className = "mora-grid";

    group.moras.forEach((mora, moraIndex) => {
      const globalIndex = question.groupOffsets[groupIndex] + moraIndex;
      const selected = state.userPattern[globalIndex];

      const tile = document.createElement("div");
      tile.className = "mora-tile";
      tile.dataset.globalIndex = String(globalIndex);

      const char = document.createElement("div");
      char.className = "mora-char";
      char.textContent = mora;
      tile.appendChild(char);

      const row = document.createElement("div");
      row.className = "intonation-row";

      const highButton = document.createElement("button");
      highButton.className = "intonation-btn";
      highButton.dataset.tone = "H";
      if (selected === "H") {
        highButton.classList.add("selected-high");
      }
      highButton.textContent = "H";
      highButton.addEventListener("click", () => updateMoraAnswer(globalIndex, "H"));

      const lowButton = document.createElement("button");
      lowButton.className = "intonation-btn";
      lowButton.dataset.tone = "L";
      if (selected === "L") {
        lowButton.classList.add("selected-low");
      }
      lowButton.textContent = "L";
      lowButton.addEventListener("click", () => updateMoraAnswer(globalIndex, "L"));

      row.appendChild(highButton);
      row.appendChild(lowButton);
      tile.appendChild(row);
      grid.appendChild(tile);
    });

    groupWrap.appendChild(grid);
    dom.moraAnswerArea.appendChild(groupWrap);
  });
}

function renderResultPanel() {
  const question = state.currentQuestion;

  if (!state.submitted || !question) {
    dom.resultPanel.classList.add("hidden");
    dom.resultPanel.innerHTML = "";
    return;
  }

  const expected = question.expected;
  const answer = state.userPattern;

  const expectedChips = expected
    .map((value) => `<span class="pattern-chip">${value}</span>`)
    .join("");

  const answerChips = answer
    .map((value, index) => {
      const match = value === expected[index] ? "match" : "miss";
      return `<span class="pattern-chip ${match}">${value}</span>`;
    })
    .join("");

  dom.resultPanel.innerHTML = `
    <h4 class="result-title ${state.lastResultCorrect ? "ok" : "bad"}">
      ${state.lastResultCorrect ? "Correct" : "Incorrect"}
    </h4>
    <div class="pattern-line"><strong>Expected:</strong> ${expectedChips}</div>
    <div class="pattern-line"><strong>Your Answer:</strong> ${answerChips}</div>
    <div class="pattern-line"><strong>Reference Accent:</strong> ${question.accentText}</div>
  `;
  dom.resultPanel.classList.remove("hidden");
}

function playReferencePair(id) {
  dom.promptAudio.src = audioURLForPairID(id);
  dom.promptAudio.load();
  dom.promptAudio.play().catch(() => {
  });
}

function renderReferenceOptions() {
  const question = state.currentQuestion;
  dom.referenceOptions.innerHTML = "";

  if (!state.submitted || !question) {
    dom.referencePanel.classList.add("hidden");
    return;
  }

  question.minimalPair.pairs.forEach((pair) => {
    const phrases = pair.entries[0].pronunciations[0].phrases;
    const button = document.createElement("button");
    button.className = "reference-option";
    button.textContent = outputAccentPlainTexts(phrases);
    button.addEventListener("click", () => playReferencePair(pair.id));
    dom.referenceOptions.appendChild(button);
  });

  dom.referencePanel.classList.remove("hidden");
}

function percentage(correct, total) {
  if (!total) {
    return "0";
  }
  return String(Math.round((correct / total) * 100));
}

function renderStatistics() {
  const s = state.statistics;
  dom.statisticsArea.innerHTML = `
    <div><strong>All:</strong> ${s.allCorrect.length} of ${s.all.length} (${percentage(s.allCorrect.length, s.all.length)}%)</div>
    <div><strong>Heiban / Odaka:</strong> ${s.heibanCorrect.length} of ${s.heiban.length} (${percentage(s.heibanCorrect.length, s.heiban.length)}%)</div>
    <div><strong>Atamadaka:</strong> ${s.atamadakaCorrect.length} of ${s.atamadaka.length} (${percentage(s.atamadakaCorrect.length, s.atamadaka.length)}%)</div>
    <div><strong>Nakadaka:</strong> ${s.nakadakaCorrect.length} of ${s.nakadaka.length} (${percentage(s.nakadakaCorrect.length, s.nakadaka.length)}%)</div>
  `;
}

function createHistoryMiniGraph(pattern) {
  const count = Math.max(1, pattern.length);
  const width = Math.max(130, count * 26 + 18);
  const height = 54;
  const leftPadding = 10;
  const rightPadding = 10;
  const yHigh = 14;
  const yLow = 40;
  const yMid = (yHigh + yLow) / 2;
  const step = count > 1 ? (width - leftPadding - rightPadding) / (count - 1) : 0;
  const svgNS = "http://www.w3.org/2000/svg";

  const yForTone = (tone) => {
    if (tone === "H") {
      return yHigh;
    }
    if (tone === "L") {
      return yLow;
    }
    return yMid;
  };

  const svg = document.createElementNS(svgNS, "svg");
  svg.classList.add("history-mini-graph");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.setAttribute("aria-hidden", "true");

  const polyline = document.createElementNS(svgNS, "polyline");
  polyline.setAttribute("class", "history-mini-path");

  const points = [];
  pattern.forEach((tone, index) => {
    const x = leftPadding + step * index;
    const y = yForTone(tone);
    points.push(`${x},${y}`);
  });

  if (points.length === 0) {
    points.push(`${leftPadding},${yMid}`);
  }

  polyline.setAttribute("points", points.join(" "));
  svg.appendChild(polyline);

  pattern.forEach((tone, index) => {
    const x = leftPadding + step * index;
    const y = yForTone(tone);
    const dot = document.createElementNS(svgNS, "circle");
    dot.setAttribute("cx", String(x));
    dot.setAttribute("cy", String(y));
    dot.setAttribute("r", "3.9");
    dot.setAttribute(
      "class",
      `history-mini-dot ${tone === "H" ? "tone-high" : tone === "L" ? "tone-low" : "tone-unknown"}`
    );
    svg.appendChild(dot);
  });

  return svg;
}

function buildHistoryPatternRow(label, pattern, expectedPattern = null) {
  const row = document.createElement("div");
  row.className = "history-pattern-row";

  const labelNode = document.createElement("span");
  labelNode.className = "history-pattern-label";
  labelNode.textContent = label;
  row.appendChild(labelNode);

  pattern.forEach((tone, index) => {
    const chip = document.createElement("span");
    chip.className = `history-tone-chip ${tone === "H" ? "tone-high" : "tone-low"}`;

    if (expectedPattern) {
      chip.classList.add(tone === expectedPattern[index] ? "is-match" : "is-miss");
    }

    chip.textContent = tone;
    row.appendChild(chip);
  });

  return row;
}

function renderHistory() {
  dom.historyList.innerHTML = "";

  state.history.forEach((item) => {
    const li = document.createElement("li");
    li.className = `history-item ${item.correct ? "ok" : "bad"}`;

    const head = document.createElement("div");
    head.className = "history-head";

    const word = document.createElement("div");
    word.className = "history-word";
    word.textContent = item.accentText;

    const outcome = document.createElement("span");
    outcome.className = `history-outcome ${item.correct ? "ok" : "bad"}`;
    outcome.textContent = item.correct ? "Correct" : "Incorrect";

    head.appendChild(word);
    head.appendChild(outcome);

    const graphWrap = document.createElement("div");
    graphWrap.className = "history-graph-wrap";
    graphWrap.appendChild(createHistoryMiniGraph(item.expected));

    const line2 = document.createElement("div");
    line2.className = "history-meta";
    line2.textContent = item.type;

    const patterns = document.createElement("div");
    patterns.className = "history-patterns";
    patterns.appendChild(buildHistoryPatternRow("Correct", item.expected));
    patterns.appendChild(buildHistoryPatternRow("You", item.answer, item.expected));

    li.appendChild(head);
    li.appendChild(line2);
    li.appendChild(graphWrap);
    li.appendChild(patterns);
    dom.historyList.appendChild(li);
  });
}

function renderSubmitAndContinue() {
  if (!state.currentQuestion) {
    dom.submitButton.disabled = true;
    dom.continueButton.classList.add("hidden");
    return;
  }

  const unanswered = state.userPattern.some((value) => value === null);
  dom.submitButton.disabled = state.submitted || unanswered;

  if (state.submitted && shouldShowContinue(Boolean(state.lastResultCorrect))) {
    dom.continueButton.classList.remove("hidden");
  } else {
    dom.continueButton.classList.add("hidden");
  }
}

function renderSettings() {
  Object.entries(dom.settingInputs).forEach(([key, input]) => {
    input.checked = Boolean(state.settings[key]);
  });
}

function renderMainState() {
  dom.loadingNotice.classList.toggle("hidden", !state.loading);
  const showPrompt = Boolean(state.currentQuestion) && !state.loading;
  dom.promptBody.classList.toggle("hidden", !showPrompt);

  if (showPrompt) {
    dom.kanaHeading.textContent = state.currentQuestion.kana;
  }
}

function render() {
  dom.startPanel.classList.toggle("hidden", state.started);
  dom.mainPanel.classList.toggle("hidden", !state.started);

  renderMainState();
  renderHistory();
  renderStatistics();
  renderSettings();
  renderMoraArea();
  renderResultPanel();
  renderReferenceOptions();
  renderSubmitAndContinue();
}

function attachSettingHandlers() {
  Object.entries(dom.settingInputs).forEach(([key, input]) => {
    input.addEventListener("change", async (event) => {
      const previous = state.settings[key];
      state.settings[key] = event.target.checked;

      const changedPatternToggle = [
        "heibanEnabled",
        "atamadakaEnabled",
        "secondMoraAccentEnabled",
        "secondToLastMoraAccentEnabled",
        "otherNakadakaEnabled"
      ].includes(key);

      if (changedPatternToggle && !isValidPatternSelection(state.settings)) {
        state.settings[key] = previous;
        input.checked = previous;
        showStatus(
          "At least two compatible pattern families must stay enabled (or only other internal Nakadaka).",
          "warn"
        );
        return;
      }

      saveSettings();

      if (["lowPassEnabled", "backgroundNoise"].includes(key) && state.currentQuestion) {
        playPromptAudio();
      }

      if (state.started && changedPatternToggle) {
        state.preloadedMinimalPair = null;
        await loadRound();
      } else {
        render();
      }
    });
  });
}

function attachHandlers() {
  dom.startButton.addEventListener("click", async () => {
    state.started = true;
    render();
    await loadRound();
  });

  dom.replayButton.addEventListener("click", () => {
    playPromptAudio();
  });

  dom.submitButton.addEventListener("click", () => {
    submitCurrentAnswer();
  });

  dom.continueButton.addEventListener("click", async () => {
    await loadRound();
  });

  document.addEventListener("keydown", (event) => {
    if (!state.started) {
      return;
    }

    if (event.key === "Enter") {
      if (state.submitted && shouldShowContinue(Boolean(state.lastResultCorrect))) {
        loadRound();
      } else if (!state.submitted) {
        submitCurrentAnswer();
      }
    }
  });
}

attachHandlers();
attachSettingHandlers();
render();
