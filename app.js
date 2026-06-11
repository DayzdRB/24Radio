let frequencies = [];
let controllers = [];
let controllerStatus = {};
let activeFreq = null;
let standbyFreq = null;
let currentAtisLoop = null;
let isAtisLooping = false;
let GlobalfreqIncrement = 0.050;
// ==== TTS VOICES & PRESETS ==== //
let ttsVoices = [];
let ttsPresets = [];
let currentVoicePreset = null; // global preset used by default

// Load voices and define presets
function initVoices() {
  ttsVoices = window.speechSynthesis.getVoices();

  if (!ttsVoices || ttsVoices.length === 0) {
    console.log("No TTS voices loaded yet.");
    return;
  }

  // Define several presets (you can adjust names after you see your voices)
  ttsPresets = [
    {
      // Preset 1: neutral / slightly lower
      name: "Preset 1",
      pickVoice: () =>
        ttsVoices.find(v => v.name.toLowerCase().includes("male")) ||
        ttsVoices[0],
      rate: 0.9,
      pitch: 0.95
    },
    {
      // Preset 2: slightly higher / more "female-ish"
      name: "Preset 2",
      pickVoice: () =>
        ttsVoices.find(v => v.name.toLowerCase().includes("female")) ||
        ttsVoices[1] ||
        ttsVoices[0],
      rate: 0.95,
      pitch: 1.05
    },
    {
      // Preset 3: higher pitched, faster
      name: "Preset 3",
      pickVoice: () => ttsVoices[2] || ttsVoices[0],
      rate: 1.05,
      pitch: 1.15
    }
  ];

  console.log("TTS voices:", ttsVoices.map(v => v.name));
  console.log("TTS presets ready:", ttsPresets.map(p => p.name));

  // On page load / first time voices are ready, pick a random preset
  currentVoicePreset = getRandomTtsPreset(null);
  console.log("Initial voice preset:", currentVoicePreset && currentVoicePreset.name);
}

window.speechSynthesis.onvoiceschanged = initVoices;
initVoices();

// Pick a random preset, avoiding the same one twice in a row if possible
function getRandomTtsPreset(previousPreset) {
  if (!ttsPresets || ttsPresets.length === 0 || ttsVoices.length === 0) {
    return null;
  }
  if (ttsPresets.length === 1) {
    return ttsPresets[0];
  }

  let candidate;
  do {
    const index = Math.floor(Math.random() * ttsPresets.length);
    candidate = ttsPresets[index];
  } while (previousPreset && candidate === previousPreset);

  return candidate;
}

// ==== CONTROLLER STATUS / DOT LOGIC ==== //

async function loadfrequencies() {
  try {
    const response = await fetch("freq.json");
    if (!response.ok) {
      throw new Error("HTTP error! status: " + response.status);
    } 
    const data = await response.json();
    frequencies = data;
    console.log("frequencies loaded:", frequencies);
    console.log("total entries: ", frequencies.length);
  } catch (error) {
    console.error("Error loading freq.json:", error);
  }
}

function populateFilters() {
  const areaSelect = document.getElementById("filter-area");
  const airportSelect = document.getElementById("filter-airport");

  const areas = [...new Set(frequencies.map(f => f.area).filter(Boolean))].sort();
  const airports = [...new Set(frequencies.map(f => f.airport).filter(Boolean))].sort();

  areas.forEach(area => {
    const opt = document.createElement("option");
    opt.value = area;
    opt.textContent = area;
    areaSelect.appendChild(opt);
  });

  airports.forEach(airport => {
    const opt = document.createElement("option");
    opt.value = airport;
    opt.textContent = airport;
    airportSelect.appendChild(opt);
  });
}

async function loadcontrollers() {
  try {
    const response = await fetch("/api/controllers");

    if (!response.ok) {
      throw new Error("Controller API error: " + response.status);
    }

    const data = await response.json();

    controllers = data;

    

    console.log("Controllers loaded:", controllers);

  } catch(error) {
    console.error("Error loading controllers:", error);
  }
}



function applyFilters() {

  
  
  const searchValue = document.getElementById("search-bar").value.toLowerCase();
  const areaFilter = document.getElementById("filter-area").value;
  const airportFilter = document.getElementById("filter-airport").value;
  const typeFilter = document.getElementById("filter-type").value;

  console.log("Sample types:", [...new Set(frequencies.map(f => f.type))]);
  console.log("Selected type:", typeFilter);
  
  const filtered = frequencies.filter(freq => {

    const matchesSearch =
      !searchValue ||
      freq.name?.toLowerCase().includes(searchValue) ||
      freq.airport?.toLowerCase().includes(searchValue) ||
      freq.freq?.toLowerCase().includes(searchValue) ||
      freq.area?.toLowerCase().includes(searchValue);

    const matchesArea =
      areaFilter === "all" || freq.area === areaFilter;

    const matchesAirport =
      airportFilter === "all" || freq.airport === airportFilter;

    const matchesType =
      typeFilter === "all" || freq.type === typeFilter;

    return matchesSearch && matchesArea && matchesAirport && matchesType;
  });

  renderFrequencyList(filtered);
}

async function initializeApp() {
  await loadfrequencies();
  await loadcontrollers();

  populateFilters();

  processControllerData();   // MUST happen before UI render

  applyFilters();            // this will call renderFrequencyList internally
}
window.addEventListener("DOMContentLoaded", initializeApp);










// Stores controller status by airport_position


function processControllerData() {
  controllerStatus = {};

  controllers.forEach(controller => {
    // Normalize CTR -> CENTER to match freq.json type
    const positionType = controller.position === "CTR" ? "CENTER" : controller.position;

    const key = controller.airport + "_" + positionType;

    controllerStatus[key] = {
      online: !controller.claimable,
      holder: controller.holder
    };
  });

  console.log("Processed controller status:", controllerStatus);
}


function getControllerDot(freqEntry){

  const key = freqEntry.airport + "_" + freqEntry.type;
  const controller = controllerStatus[key];

  // ATIS is always green
  if (freqEntry.type === "ATIS") {
    return "green";
  }

  // CENTER logic fix
  if (freqEntry.type === "CENTER") {
    return controller && controller.online ? "green" : "red";
  }

  if (!controller) {
    return "red";
  }

  return controller.online ? "green" : "red";
}

// ===== DOM ELEMENTS =====

const activeFreqEl = document.getElementById("active-freq");
const standbyFreqEl = document.getElementById("standby-freq");
const swapBtn = document.getElementById("swap-btn");
const resultEl = document.getElementById("result");

const searchBar = document.getElementById("search-bar");
const areaFilter = document.getElementById("filter-area");
const airportFilter = document.getElementById("filter-airport");
const typeFilter = document.getElementById("filter-type");

searchBar?.addEventListener("input", applyFilters);
areaFilter?.addEventListener("change", applyFilters);
airportFilter?.addEventListener("change", applyFilters);
typeFilter?.addEventListener("change", applyFilters);

function updateDisplay() {
  if(!activeFreqEl || !standbyFreqEl) return;
  activeFreqEl.textContent = activeFreq || "---";
  standbyFreqEl.value = standbyFreq ?? "";
}


function renderFrequencyList(filteredList = frequencies) {
  const listEl = document.getElementById("frequency-list");
  listEl.innerHTML = "";

  const grouped = {};

  filteredList.forEach(freq => {
    const area = freq.area || "UNKNOWN AREA";

    if (!grouped[area]) {
      grouped[area] = [];
    }

    grouped[area].push(freq);
  });

  const areaOrder = [];

  filteredList.forEach(freq => {
    const area = freq.area || "UNKNOWN AREA";
    if (!areaOrder.includes(area)) {
      areaOrder.push(area);
    }
  });

  areaOrder.forEach(area => {
    // AREA HEADER
    const header = document.createElement("div");
    header.className = "area-header";
    header.textContent = area;
    listEl.appendChild(header);

    // FREQUENCIES
    grouped[area].forEach(freq => {
      const dotColor = getControllerDot(freq);

      const row = document.createElement("div");
      row.className = "freq-item";

      row.innerHTML = `
      <div class="freq-left">
      <span class="dot" style="color:${dotColor}">●</span>
      <span class="freq">${freq.freq}</span>
      <span class="name">${freq.name || ""}</span>
      <span class="type">${freq.type}</span>
      </div>
      <button class="tune-btn" onclick="tuneFrequency('${freq.freq}')">TUNE</button>
    `;

      listEl.appendChild(row);
    });
  });
}
  

 

function findFrequencyByNumber(freqStr) {
  const normalizedInput = parseFloat(freqStr).toFixed(3);
  return frequencies.find(f => parseFloat(f.freq).toFixed(3) === normalizedInput);
}

function showMessage(message) {
  resultEl.textContent = message;
}

function tuneFrequency(freq) {
  const standby = document.getElementById("standby-freq");

  currentFreq = Number(parseFloat(freq).toFixed(3));

  standby.value = currentFreq.toFixed(3);

  // Force step to 0.005 so any frequency can be reached
  GlobalfreqIncrement = 0.005;
  const stepBtn = document.getElementById("step-btn");
  if (stepBtn) stepBtn.textContent = "STEP: 0.005";

  const freqIncrement = GlobalfreqIncrement;
  const degreesPerStep = 10;

  const steps = Math.round(
    (currentFreq - 122.800) / freqIncrement
  );

  totalRotation = steps * degreesPerStep;

  if (knob) {
    knob.style.transform = `rotate(${totalRotation}deg)`;
  }

  showMessage("Tuned standby to " + currentFreq.toFixed(3));
}

function isAtisEntry(entry){

  return (
    entry &&
    entry.type === "ATIS"
  );

}

function getAirportFromEntry(entry){

  if(!entry)
    return null;


  return entry.airport;

}

async function fetchAllAtis() {
  const res = await fetch("/api/atis");
  if (!res.ok) {
    throw new Error("Failed to fetch ATIS: " + res.status);
  }
  return res.json();
}

function getAtisForAirport(allAtis, airport) {
  return allAtis.find(a => a.airport === airport);
}

function stopAtisLoop() {
  speechSynthesis.cancel();
  isAtisLooping = false;
  currentAtisLoop = null;
}

// Convert digits to aviation pronunciation (9 -> NINER, 0 -> ZERO)
function digitsToAviation(numStr) {
  let result = "";
  for (let i = 0; i < numStr.length; i++) {
    const d = numStr[i];
    if (d === "9") {
      result += "niner";
    } else if (d === "0") {
      result += "zero";
    } else {
      result += d;
    }
    if (i < numStr.length - 1) result += " ";
  }
  return result;
}

function formatAtisIntoLines(text) {
  if (!text) return [];

  const lines = [];
  const phonetic = {
    "A": "Alpha", "B": "Bravo", "C": "Charlie", "D": "Delta",
    "E": "Echo", "F": "Foxtrot", "G": "Golf", "H": "Hotel",
    "I": "India", "J": "Juliet", "K": "Kilo", "L": "Lima",
    "M": "Mike", "N": "November", "O": "Oscar", "P": "Papa",
    "Q": "Quebec", "R": "Romeo", "S": "Sierra", "T": "Tango",
    "U": "Uniform", "V": "Victor", "W": "Whiskey", "X": "X-ray",
    "Y": "Yankee", "Z": "Zulu"
  };

  const rawLines = text.trim().split("\n");

  for (let rawLine of rawLines) {
    let line = rawLine.toUpperCase().trim();
    if (!line) continue;

    const isWeatherLine = line.match(/\d{3}\/\d{2}/) || line.match(/\b9999\b/) || 
                          line.match(/(?:BKN|SCT|OVC|FEW)\d{2,3}/) || 
                          line.match(/\b\d{2}\/\d{2}\b/) || line.match(/\bQ\d{4}\b/);

    if (isWeatherLine) {
      const windMatch = line.match(/(\d{3}\/\d{2})/);
      const visMatch = line.match(/\b(\d{4})\b/);
      const cloudsMatch = line.match(/((?:BKN|SCT|OVC|FEW)(\d{2,3}))/);
      const tempDewMatch = line.match(/\b(\d{2}\/\d{2})\b/);
      const qnhMatch = line.match(/\b(Q\d{4})\b/);

      if (windMatch) {
        const [dir, spd] = windMatch[1].split('/');
        const dirDigits = digitsToAviation(dir);
        const spdDigits = digitsToAviation(spd);
        let windLine = "whinds AT " + dirDigits + " DEGREES AT " + spdDigits + " KNOTS";
        // wind pronunciation fix
        windLine = windLine.replace(/^WIND/, "WhiND");
        lines.push(windLine);
      }

      if (visMatch) {
        const visDigits = digitsToAviation(visMatch[1]);
        lines.push("VISIBILITY " + visDigits);
      }

      if (cloudsMatch) {
        const cloudType = cloudsMatch[1].match(/(BKN|SCT|OVC|FEW)/)[0];
        const cloudHeight = cloudsMatch[2];
        const heightDigits = digitsToAviation(cloudHeight);
        const cloudNames = { "BKN": "BROKEN", "SCT": "SCATTERED", "OVC": "OVERCAST", "FEW": "FEW" };
        lines.push(cloudNames[cloudType] + " CLOUDS AT " + heightDigits);
      }

      if (tempDewMatch) {
        const [t1, t2] = tempDewMatch[1].split('/');
        const t1Digits = digitsToAviation(t1);
        const t2Digits = digitsToAviation(t2);
        lines.push("TEMPERATURE " + t1Digits +"degrees celcius"+ " DEW POINT " + t2Digits);
      }

      if (qnhMatch) {
        const qnhDigits = digitsToAviation(qnhMatch[1].substring(1));
        lines.push("QNH " + qnhDigits);
      }

      continue;
    }

    line = line.replace(/\bRWY\b/g, "runway");
    line = line.replace(/\bDEP\b/g, "DEPARTURE");
    line = line.replace(/\bARR\b/g, "ARRIVAL");
    line = line.replace(/\bAFCT\b/g, "AIRCRAFT");

    // First: Handle runway designators with L/R/C (27L -> 2 7 LEFT, 9R -> NINER RIGHT)
    line = line.replace(/(\d{1,3})(L)/g, (m, num) => digitsToAviation(num) + " LEFT");
    line = line.replace(/(\d{1,3})(R)/g, (m, num) => digitsToAviation(num) + " RIGHT");
    line = line.replace(/(\d{1,3})(C)/g, (m, num) => digitsToAviation(num) + " CENTER");

    // Second: Handle standalone runway numbers (RUNWAY 27 -> RUNWAY 2 7, RUNWAY 9 -> RUNWAY NINER)
    line = line.replace(/RUNWAY\s+(\d{1,2})\b/g, (m, num) => "RUNWAY " + digitsToAviation(num));

    // Third: Handle "DEPARTURE RUNWAY X" and "ARRIVAL RUNWAY X" separately
    line = line.replace(/DEPARTURE RUNWAY\s+(\d{1,2})/g, (m, num) => "DEPARTURE RUNWAY " + digitsToAviation(num));
    line = line.replace(/ARRIVAL RUNWAY\s+(\d{1,2})/g, (m, num) => "ARRIVAL RUNWAY " + digitsToAviation(num));

    if (line.includes("DEPARTURE RUNWAY") && line.includes("ARRIVAL RUNWAY")) {
      const splitIndex = line.indexOf(" ARRIVAL RUNWAY ");
      if (splitIndex !== -1) {
  let depLine = line.substring(0, splitIndex).trim();
  let arrLine = line.substring(splitIndex + " ARRIVAL RUNWAY ".length).trim(); // fixed

  lines.push(depLine);
  lines.push("ARRIVAL RUNWAY " + arrLine);
  continue;
}
    }

    line = line.replace(/\b(\d{4})Z\b/g, (m, num) => digitsToAviation(num) + " ZULU");
    line = line.replace(/\bZ\b/g, " ZULU ");

    line = line.replace(/\bQ(\d{4})\b/g, "QNH $1");

    line = line.replace(/\bBKN(\d{2,3})\b/g, "BROKEN CLOUDS AT $1");
    line = line.replace(/\bSCT(\d{2,3})\b/g, "SCATTERED CLOUDS AT $1");
    line = line.replace(/\bOVC(\d{2,3})\b/g, "OVERCAST CLOUDS AT $1");
    line = line.replace(/\bFEW(\d{2,3})\b/g, "FEW CLOUDS AT $1");

    line = line.replace(/\bLEVEL\s+(\d{2,3})\b/g, "LEVEL $1");

    line = line.replace(/\bINFO(?:RMATION)?\s+([A-Z])\b/g, (match, letter) => {
      const phoneticLetter = phonetic[letter] || letter;
      return "INFO " + phoneticLetter;
    });

    line = line.replace(/INFORMATION\s+([A-Z])\b/g, (match, letter) => {
      const phoneticLetter = phonetic[letter] || letter;
      return "INFORMATION " + phoneticLetter;
    });

    if (line.match(/ATIS INFO [A-Z]+ TIME/)) {
      const atisInfoMatch = line.match(/^[^\s]+ ATIS INFO [A-Z]+/);
      const timeMatch = line.match(/TIME [^\s]+/);

      if (atisInfoMatch && timeMatch) {
        lines.push(atisInfoMatch[0].trim());
        lines.push(timeMatch[0].trim());
        continue;
      }
    }

    // Generic number replacement, but skip numbers that are directly after "RUNWAY "
    line = line.replace(/\b(\d{2,4})\b/g, (match, num, offset, full) => {
      const before = full.slice(0, offset);
      if (/RUNWAY\s+$/.test(before)) {
        return match; // already converted by runway-specific logic
      }
      return digitsToAviation(num);
    });

    line = line.replace(/\//g, " SLASH ");
    line = line.replace(/\bATIS\b/g, "Atis");

    lines.push(line);
  }

  return lines;
}

function speakAtisLoop(airport, atis, freqName) {
  stopAtisLoop();

  const atisLines = formatAtisIntoLines(atis.content);
  if (atisLines.length === 0) {
    showMessage("ATIS fetched for " + airport + ", but no content to speak.");
    return;
  }

  let currentIndex = 0;
  isAtisLooping = true;

  // When starting a new ATIS loop (i.e., after a frequency swap),
  // choose a new global preset, avoiding reusing the last one if possible.
  currentVoicePreset = getRandomTtsPreset(currentVoicePreset);
  console.log("New preset for this ATIS:", currentVoicePreset && currentVoicePreset.name);

  currentAtisLoop = {
    airport,
    atis,
    lines: atisLines,
    index: currentIndex,
    voicePreset: currentVoicePreset   // store which preset this loop is using
  };

  function speakNextLine() {
    if (!isAtisLooping || currentAtisLoop?.airport !== airport) return;

    const line = atisLines[currentIndex];

    const utterance = new SpeechSynthesisUtterance(line);

    const preset = currentAtisLoop.voicePreset || currentVoicePreset;

    if (preset) {
      const voice = preset.pickVoice ? preset.pickVoice() : null;
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      }
      utterance.rate = preset.rate;
      utterance.pitch = preset.pitch;
    } else {
      utterance.rate = 0.85;
      utterance.pitch = 1.0;
    }

    utterance.volume = 1.0;

    utterance.onend = function () {
      currentIndex++;
      if (currentIndex < atisLines.length) {
        setTimeout(speakNextLine, 1000);
      } else {
        setTimeout(() => {
          if (isAtisLooping && currentAtisLoop?.airport === airport) {
            currentIndex = 0;
            speakNextLine();
          }
        }, 3000);
      }
    };

    utterance.onerror = function (err) {
      console.error("Speech error:", err);
      isAtisLooping = false;
    };

    speechSynthesis.speak(utterance);
  }

  showMessage((freqName || "ATIS") + " Connected");
  speakNextLine();
}

function speakText(text) {
  speechSynthesis.cancel();
  isAtisLooping = false;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  speechSynthesis.speak(utterance);
}

const knob = document.getElementById("freq-knob");
let isDragging = false;
let startAngle = 0;
let totalRotation = 0;
let currentFreq = 122.800;

standbyFreqEl.value = currentFreq.toFixed(3);

standbyFreqEl.addEventListener("input", (e) => {
  const typedFreq = parseFloat(e.target.value);
  if (!isNaN(typedFreq)) {
    currentFreq = Number(typedFreq.toFixed(3));
    const freqIncrement = GlobalfreqIncrement;
    const degreesPerStep = 10;
    const steps = Math.round((typedFreq - 122.800) / freqIncrement);
    totalRotation = steps * degreesPerStep;
    knob.style.transform = `rotate(${totalRotation}deg)`;
  }
});

if (knob) {
  knob.addEventListener("mousedown", startDrag);
  document.addEventListener("mousemove", drag);
  document.addEventListener("mouseup", endDrag);

  knob.addEventListener("touchstart", (e) => {
    startDrag(e.touches[0]);
    e.preventDefault();
  });
  document.addEventListener("touchmove", (e) => {
    drag(e.touches[0]);
    e.preventDefault();
  });
  document.addEventListener("touchend", endDrag);

  function startDrag(e) {
    isDragging = true;
    const rect = knob.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
  }

  function drag(e) {
  if (!isDragging) return;

  const rect = knob.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX);

  let deltaAngle = angle - startAngle;
  if (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
  if (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;

  let deltaDegrees = deltaAngle * (180 / Math.PI);
  totalRotation += deltaDegrees;

  knob.style.transform = `rotate(${totalRotation}deg)`;

  const freqIncrement = GlobalfreqIncrement;
  const degreesPerStep = 10;

  const steps = Math.round(totalRotation / degreesPerStep);

  const newFreq = 122.800 + (steps * freqIncrement);
  const roundedFreq = Number(newFreq.toFixed(3));

  if (roundedFreq !== currentFreq) {
    currentFreq = roundedFreq;
    standbyFreqEl.value = currentFreq.toFixed(3);
    showMessage("Frequency: " + currentFreq.toFixed(3));
  }

  startAngle = angle;
}


function endDrag() {
  isDragging = false;

  const degreesPerStep = 10;

  totalRotation =
    Math.round(totalRotation / degreesPerStep) * degreesPerStep;

  knob.style.transform = `rotate(${totalRotation}deg)`;

  const freqIncrement = GlobalfreqIncrement;

  const steps = Math.round(totalRotation / degreesPerStep);

  const newFreq = 122.800 + (steps * freqIncrement);

  currentFreq = Number(newFreq.toFixed(3));

  standbyFreqEl.value = currentFreq.toFixed(3);
}


}

window.addEventListener("beforeunload", () => {
  stopAtisLoop();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopAtisLoop();
  }
});
if (swapBtn) {
  swapBtn.addEventListener("click", async () => {
    const inputFreq = standbyFreqEl.value.trim();

    if (!inputFreq) {
      showMessage("No standby frequency to swap.");
      return;
    }

    const standbyEntry = findFrequencyByNumber(inputFreq);

    console.log("Standby Entry:", standbyEntry);
    console.log("Standby Entry Name:", standbyEntry?.name);

    stopAtisLoop();

    // Swap active and standby
    const temp = activeFreq;
    activeFreq = inputFreq;
    standbyFreq = temp;

    updateDisplay();

    if (!standbyEntry) {
      showMessage("Frequency not found: " + inputFreq);
      return;
    }

    const displayName = standbyEntry.name || "Unknown";

    showMessage(
      "Swapped. Active: " + activeFreq + " - " + displayName
    );

    // Handle ATIS frequencies
    if (isAtisEntry(standbyEntry)) {

      const airport = getAirportFromEntry(standbyEntry);

      console.log("Airport:", airport);
      console.log("Frequency Name:", standbyEntry.name);

      if (!airport) return;

      try {

        const allAtis = await fetchAllAtis();
        const atis = getAtisForAirport(allAtis, airport);

        if (atis) {
          speakAtisLoop(
            airport,
            atis,
            standbyEntry.name
          );
        } else {
          showMessage(
            standbyEntry.name + " - ATIS not found"
          );
        }

      } catch (err) {

        console.error(
          "Error fetching ATIS after swap:",
          err
        );

        showMessage(
          standbyEntry.name + " - Failed to fetch ATIS"
        );
      }
    }
  });
}

updateDisplay();

// ==== STEP SIZE TOGGLE ==== //
window.addEventListener("DOMContentLoaded", () => {
  const stepBtn = document.getElementById("step-btn");
  if (!stepBtn) return;

  const steps = [0.005, 0.05, 0.1];
  let stepIndex = 1; // default = 0.05

  // ensure UI matches initial value
  stepBtn.textContent = `STEP: ${steps[stepIndex].toFixed(3)}`;

  stepBtn.addEventListener("click", () => {
    stepIndex = (stepIndex + 1) % steps.length;
    GlobalfreqIncrement = steps[stepIndex];

    stepBtn.textContent = `STEP: ${GlobalfreqIncrement.toFixed(3)}`;
  });
});
