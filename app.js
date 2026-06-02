let frequencies = [];
let activeFreq = null;
let standbyFreq = null;
let currentAtisLoop = null;
let isAtisLooping = false;

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

loadfrequencies();

const activeFreqEl = document.getElementById("active-freq");
const standbyFreqEl = document.getElementById("standby-freq");
const freqInput = document.getElementById("freq-input");
const tuneBtn = document.getElementById("tune-btn");
const swapBtn = document.getElementById("swap-btn");
const resultEl = document.getElementById("result");

function updateDisplay() {
  activeFreqEl.textContent = activeFreq || "---";
  standbyFreqEl.textContent = standbyFreq || "---";
}

function findFrequencyByNumber(freqStr) {
  return frequencies.find(f => f.freq === freqStr);
}

function showMessage(message) {
  resultEl.textContent = message;
}

function isAtisEntry(entry) {
  return entry && !entry.channelID;
}

function getAirportFromAtisName(name) {
  if (!name) return null;
  const parts = name.split("_");
  return parts[0] || null;
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

    // 1. Expand common abbreviations
    line = line.replace(/\bRWY\b/g, "RUNWAY");
    line = line.replace(/\bDEP\b/g, "DEPARTURE");
    line = line.replace(/\bARR\b/g, "ARRIVAL");
    line = line.replace(/\bAFCT\b/g, "AIRCRAFT");

    // 2. Runway designators: 25R -> TWO FIVE RIGHT
    line = line.replace(/\b(\d{2,3})R\b/g, "$1 RIGHT");
    line = line.replace(/\b(\d{2,3})L\b/g, "$1 LEFT");
    line = line.replace(/\b(\d{2,3})C\b/g, "$1 CENTER");

    // 3. Time: 1821Z -> ONE EIGHT TWO ONE ZULU
    line = line.replace(/\b(\d{4})Z\b/g, "$1 ZULU");
    line = line.replace(/\bZ\b/g, " ZULU ");

    // 4. Altimeter: Q1012 -> QNH 1012 (keep digits for later processing)
    line = line.replace(/\bQ(\d{4})\b/g, "QNH $1");

    // 5. Cloud layers
    line = line.replace(/\bBKN(\d{2,3})\b/g, "BROKEN CLOUDS AT $1");
    line = line.replace(/\bSCT(\d{2,3})\b/g, "SCATTERED CLOUDS AT $1");
    line = line.replace(/\bOVC(\d{2,3})\b/g, "OVERCAST CLOUDS AT $1");
    line = line.replace(/\bFEW(\d{2,3})\b/g, "FEW CLOUDS AT $1");

    // 6. Transition level
    line = line.replace(/\bLEVEL\s+(\d{2,3})\b/g, "LEVEL $1");

    // 7. Replace "INFO X" or "INFORMATION X" with phonetic letter
    line = line.replace(/\bINFO(?:RMATION)?\s+([A-Z])\b/g, (match, letter) => {
      const phoneticLetter = phonetic[letter] || letter;
      return "INFO " + phoneticLetter;
    });

    // 8. Replace "INFORMATION X" explicitly
    line = line.replace(/INFORMATION\s+([A-Z])\b/g, (match, letter) => {
      const phoneticLetter = phonetic[letter] || letter;
      return "INFORMATION " + phoneticLetter;
    });

    // 9. Wind: 316/05 -> WIND AT THREE ONE SIX DEGREES AT ZERO FIVE KNOTS
    line = line.replace(/\b(\d{3})\/(\d{2})\b/g, (match, dir, spd) => {
      const dirDigits = dir.split("").join(" ");
      const spdDigits = spd.split("").join(" ");
      return "WIND AT " + dirDigits + " DEGREES AT " + spdDigits + " KNOTS";
    });

    // Visibility: 9999 -> VISIBILITY NINE NINE NINE NINE
    line = line.replace(/\b9999\b/g, "VISIBILITY NINE NINE NINE NINE");

    // Temperature/dew: 04/09 -> TEMPERATURE ZERO FOUR, DEW POINT ZERO NINE
    line = line.replace(/\b(\d{2})\/(\d{2})\b/g, (match, t1, t2) => {
      const t1Digits = t1.split("").join(" ");
      const t2Digits = t2.split("").join(" ");
      return "TEMPERATURE " + t1Digits + ", DEW POINT " + t2Digits;
    });

    // 10. Break up ARRIVAL RUNWAY from DEPARTURE RUNWAY on separate lines
    if (line.includes("DEPARTURE") && line.includes("ARRIVAL")) {
      const depMatch = line.match(/DEPARTURE RUNWAY [^\s]+/);
      const arrMatch = line.match(/ARRIVAL RUNWAY [^\s]+/);

      if (depMatch && arrMatch) {
        lines.push(depMatch[0].trim());
        lines.push(arrMatch[0].trim());
        continue;
      }
    }

    // 11. General numbers (for altimeter digits, cloud height, etc.)
    // Reads 1012 as "ONE ZERO ONE TWO" not "ONE THOUSAND"
    line = line.replace(/\b(\d{2,4})\b/g, (match, num) => {
      return num.split("").join(" ");
    });

    // 12. Replace remaining / with SLASH (fallback)
    line = line.replace(/\//g, " SLASH ");

    // 13. Force ATIS to be pronounced as one word: "Atis" (do this LAST, after toUpperCase)
    // We replace "ATIS" with "Atis" to force TTS to read it as one word
    line = line.replace(/\bATIS\b/g, "Atis");

    lines.push(line);
  }

  return lines;
}

function speakAtisLoop(airport, atis) {
  stopAtisLoop();

  const atisLines = formatAtisIntoLines(atis.content);
  if (atisLines.length === 0) {
    showMessage("ATIS fetched for " + airport + ", but no content to speak.");
    return;
  }

  let currentIndex = 0;
  isAtisLooping = true;
  currentAtisLoop = { airport, atis, lines: atisLines, index: currentIndex };

  function speakNextLine() {
    if (!isAtisLooping || currentAtisLoop?.airport !== airport) return;

    const line = atisLines[currentIndex];

    const utterance = new SpeechSynthesisUtterance(line);
    utterance.rate = 0.85;  // Slower for better clarity
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onend = function () {
      currentIndex++;
      if (currentIndex < atisLines.length) {
        setTimeout(speakNextLine, 1000); // 1 second pause between lines
      } else {
        setTimeout(() => {
          if (isAtisLooping && currentAtisLoop?.airport === airport) {
            currentIndex = 0;
            speakNextLine();
          }
        }, 3000); // 3 second pause before looping
      }
    };

    utterance.onerror = function (err) {
      console.error("Speech error:", err);
      isAtisLooping = false;
    };

    speechSynthesis.speak(utterance);
  }

  showMessage("ATIS fetched for " + airport + ". Speaking...");
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

tuneBtn.addEventListener("click", async () => {
  const input = freqInput.value.trim();
  const entry = findFrequencyByNumber(input);

  if (!entry) {
    showMessage("Frequency not found: " + input);
    return;
  }

  console.log("Entry:", entry);
  console.log("Is ATIS?", isAtisEntry(entry));
  console.log("Airport:", getAirportFromAtisName(entry.name));

  stopAtisLoop();

  standbyFreq = entry.freq;
  updateDisplay();

  const displayName = entry.name || "Unknown";
  const freqDisplay = entry.freq || input;

  if (isAtisEntry(entry)) {
    const airport = getAirportFromAtisName(entry.name);
    showMessage("Tuned to ATIS: " + displayName + " — " + freqDisplay);

    if (airport) {
      try {
        const allAtis = await fetchAllAtis();
        const atis = getAtisForAirport(allAtis, airport);

        if (atis) {
          speakAtisLoop(airport, atis);
        } else {
          showMessage("ATIS not found for " + airport);
        }
      } catch (err) {
        console.error("Error fetching ATIS:", err);
        showMessage("Failed to fetch ATIS for " + airport);
      }
    }
  } else {
    showMessage("Tuned to: " + displayName + " — " + freqDisplay);
  }
});

swapBtn.addEventListener("click", async () => {
  if (!standbyFreq) {
    showMessage("No standby frequency to swap.");
    return;
  }

  stopAtisLoop();

  const temp = activeFreq;
  activeFreq = standbyFreq;
  standbyFreq = temp;

  updateDisplay();
  showMessage("Swapped. Active: " + activeFreq);

  const activeEntry = frequencies.find(f => f.freq === activeFreq);
  if (activeEntry && isAtisEntry(activeEntry)) {
    const airport = getAirportFromAtisName(activeEntry.name);
    if (airport) {
      try {
        const allAtis = await fetchAllAtis();
        const atis = getAtisForAirport(allAtis, airport);

        if (atis) {
          speakAtisLoop(airport, atis);
        } else {
          showMessage("ATIS not found for " + airport);
        }
      } catch (err) {
        console.error("Error fetching ATIS after swap:", err);
        showMessage("Failed to fetch ATIS for " + airport);
      }
    }
  }
});

updateDisplay();
