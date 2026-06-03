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
const freqInput = document.getElementById("standby-freq");
const swapBtn = document.getElementById("swap-btn");
const resultEl = document.getElementById("result");

function updateDisplay() {
  activeFreqEl.textContent = activeFreq || "---";
  standbyFreqEl.value = standbyFreq || "---";
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

// Convert digits to aviation pronunciation (9 -> Niner, not Nine)
function digitsToAviation(numStr) {
  const digits = numStr.split("");
  return digits.map(d => {
    if (d === "9") return "NINER";
    return d.split("").join(" ");
  }).join(" ");
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

    // Check if this is a weather line (has raw weather data like 316/05 9999 FEW021 04/09 Q1012)
    const isWeatherLine = line.match(/\d{3}\/\d{2}/) || line.match(/\b9999\b/) || 
                          line.match(/(?:BKN|SCT|OVC|FEW)\d{2,3}/) || 
                          line.match(/\b\d{2}\/\d{2}\b/) || line.match(/\bQ\d{4}\b/);

    if (isWeatherLine) {
      // Extract raw weather components FIRST, before any text replacements
      const windMatch = line.match(/(\d{3}\/\d{2})/);
      const visMatch = line.match(/\b(9999)\b/);
      const cloudsMatch = line.match(/((?:BKN|SCT|OVC|FEW)(\d{2,3}))/);
      const tempDewMatch = line.match(/\b(\d{2}\/\d{2})\b/);
      const qnhMatch = line.match(/\b(Q\d{4})\b/);

      // Process each weather component separately into its own line
      if (windMatch) {
        const [dir, spd] = windMatch[1].split('/');
        const dirDigits = digitsToAviation(dir);
        const spdDigits = digitsToAviation(spd);
        lines.push("WIND AT " + dirDigits + " DEGREES AT " + spdDigits + " KNOTS");
      }

      if (visMatch) {
        lines.push("VISIBILITY NINE NINE NINE NINE");
      }

      if (cloudsMatch) {
        const cloudType = cloudsMatch[1].match(/(BKN|SCT|OVC|FEW)/)[0];
        const cloudHeight = cloudsMatch[2];
        const heightDigits = cloudHeight.split("").join(" ");
        const cloudNames = { "BKN": "BROKEN", "SCT": "SCATTERED", "OVC": "OVERCAST", "FEW": "FEW" };
        lines.push(cloudNames[cloudType] + " CLOUDS AT " + heightDigits);
      }

      if (tempDewMatch) {
        const [t1, t2] = tempDewMatch[1].split('/');
        const t1Digits = digitsToAviation(t1);
        const t2Digits = digitsToAviation(t2);
        lines.push("TEMPERATURE " + t1Digits + " DEW POINT " + t2Digits);
      }

      if (qnhMatch) {
        const qnhDigits = qnhMatch[1].substring(1).split("").join(" ");
        lines.push("QNH " + qnhDigits);
      }

      continue;
    }

    // 1. Expand common abbreviations
    line = line.replace(/\bRWY\b/g, "RUNWAY");
    line = line.replace(/\bDEP\b/g, "DEPARTURE");
    line = line.replace(/\bARR\b/g, "ARRIVAL");
    line = line.replace(/\bAFCT\b/g, "AIRCRAFT");

    // 2. Break up ARRIVAL RUNWAY from DEPARTURE RUNWAY on separate lines FIRST (before runway letter replacement)
    if (line.includes("DEPARTURE RUNWAY") && line.includes("ARRIVAL RUNWAY")) {
      // Split by " ARRIVAL RUNWAY " (with spaces) to get two separate parts
      const splitIndex = line.indexOf(" ARRIVAL RUNWAY ");
      if (splitIndex !== -1) {
        let depLine = line.substring(0, splitIndex).trim();
        let arrLine = line.substring(splitIndex + 1).trim();

        // Apply runway letter replacement with aviation digits (25L -> TWO FIVE LEFT)
        depLine = depLine.replace(/(\d{1,3})(L)/g, (m, num, letter) => {
          return digitsToAviation(num) + " LEFT";
        });
        depLine = depLine.replace(/(\d{1,3})(R)/g, (m, num, letter) => {
          return digitsToAviation(num) + " RIGHT";
        });
        depLine = depLine.replace(/(\d{1,3})(C)/g, (m, num, letter) => {
          return digitsToAviation(num) + " CENTER";
        });

        arrLine = arrLine.replace(/(\d{1,3})(L)/g, (m, num, letter) => {
          return digitsToAviation(num) + " LEFT";
        });
        arrLine = arrLine.replace(/(\d{1,3})(R)/g, (m, num, letter) => {
          return digitsToAviation(num) + " RIGHT";
        });
        arrLine = arrLine.replace(/(\d{1,3})(C)/g, (m, num, letter) => {
          return digitsToAviation(num) + " CENTER";
        });

        lines.push(depLine);
        lines.push(arrLine);
        continue;
      }
    }

    // 3. Runway designators: 25R -> TWO FIVE RIGHT (for single runway lines)
    line = line.replace(/(\d{1,3})R/g, (m, num) => digitsToAviation(num) + " RIGHT");
    line = line.replace(/(\d{1,3})L/g, (m, num) => digitsToAviation(num) + " LEFT");
    line = line.replace(/(\d{1,3})C/g, (m, num) => digitsToAviation(num) + " CENTER");

    // 4. Time: 1821Z -> ONE EIGHT TWO ONE ZULU
    line = line.replace(/\b(\d{4})Z\b/g, "$1 ZULU");
    line = line.replace(/\bZ\b/g, " ZULU ");

    // 5. Altimeter: Q1012 -> QNH 1012 (keep digits for later processing)
    line = line.replace(/\bQ(\d{4})\b/g, "QNH $1");

    // 6. Cloud layers (for non-weather lines)
    line = line.replace(/\bBKN(\d{2,3})\b/g, "BROKEN CLOUDS AT $1");
    line = line.replace(/\bSCT(\d{2,3})\b/g, "SCATTERED CLOUDS AT $1");
    line = line.replace(/\bOVC(\d{2,3})\b/g, "OVERCAST CLOUDS AT $1");
    line = line.replace(/\bFEW(\d{2,3})\b/g, "FEW CLOUDS AT $1");

    // 7. Transition level
    line = line.replace(/\bLEVEL\s+(\d{2,3})\b/g, "LEVEL $1");

    // 8. Replace "INFO X" or "INFORMATION X" with phonetic letter
    line = line.replace(/\bINFO(?:RMATION)?\s+([A-Z])\b/g, (match, letter) => {
      const phoneticLetter = phonetic[letter] || letter;
      return "INFO " + phoneticLetter;
    });

    // 9. Replace "INFORMATION X" explicitly
    line = line.replace(/INFORMATION\s+([A-Z])\b/g, (match, letter) => {
      const phoneticLetter = phonetic[letter] || letter;
      return "INFORMATION " + phoneticLetter;
    });

    // 10. Split ATIS INFO line into separate parts: "ISAU ATIS INFO V" and "TIME 1821Z"
    if (line.match(/ATIS INFO [A-Z]+ TIME/)) {
      const atisInfoMatch = line.match(/^[^\s]+ ATIS INFO [A-Z]+/);
      const timeMatch = line.match(/TIME [^\s]+/);

      if (atisInfoMatch && timeMatch) {
        lines.push(atisInfoMatch[0].trim());
        lines.push(timeMatch[0].trim());
        continue;
      }
    }

    // 11. General numbers (for altimeter digits, cloud height, etc.) - use aviation pronunciation
    line = line.replace(/\b(\d{2,4})\b/g, (match, num) => {
      return digitsToAviation(num);
    });

    // 12. Replace remaining / with SLASH (fallback)
    line = line.replace(/\//g, " SLASH ");

    // 13. Force ATIS to be pronounced as one word: "Atis"
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
    utterance.rate = 0.85;
    utterance.pitch = 1.0;
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

// Knob functionality - starts at 122.800, increments by 0.05
const knob = document.getElementById("freq-knob");
let isDragging = false;
let startAngle = 0;
let totalRotation = 0; // Track total rotation without limits
let currentFreq = 122.800; // Start at UNICOM frequency

// Set initial frequency in input
freqInput.value = currentFreq.toFixed(3);

if (knob) {
  knob.addEventListener("mousedown", startDrag);
  document.addEventListener("mousemove", drag);
  document.addEventListener("mouseup", endDrag);

  // Touch support for mobile
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
    
    // Normalize delta to avoid jump when crossing -180/180 boundary
    if (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
    if (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;
    
    let deltaDegrees = deltaAngle * (180 / Math.PI);
    totalRotation += deltaDegrees;

    knob.style.transform = `rotate(${totalRotation}deg)`;

    // Calculate frequency change based on total rotation (10 degrees = 0.05 MHz)
    const freqIncrement = 0.05;
    const degreesPerStep = 10;
    const steps = Math.round(totalRotation / degreesPerStep);
    
    const newFreq = 122.800 + (steps * freqIncrement);
    
    // Round to 3 decimal places
    const roundedFreq = Math.round(newFreq * 1000) / 1000;
    
    if (roundedFreq !== currentFreq) {
      currentFreq = roundedFreq;
      freqInput.value = currentFreq.toFixed(3);
      showMessage("Frequency: " + currentFreq.toFixed(3));
    }

    startAngle = angle;
  }

  function endDrag() {
    isDragging = false;
    
    // Snap to nearest 0.05 increment (10 degrees per step)
    const degreesPerStep = 10;
    totalRotation = Math.round(totalRotation / degreesPerStep) * degreesPerStep;
    
    knob.style.transform = `rotate(${totalRotation}deg)`;
    
    // Update frequency to match snapped rotation
    const freqIncrement = 0.05;
    const steps = Math.round(totalRotation / degreesPerStep);
    const newFreq = 122.800 + (steps * freqIncrement);
    currentFreq = Math.round(newFreq * 1000) / 1000;
    freqInput.value = currentFreq.toFixed(3);
  }
}

// Stop ATIS loop when page is unloaded/refreshed
window.addEventListener("beforeunload", () => {
  stopAtisLoop();
});

// Stop on page hide (when switching tabs)
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopAtisLoop();
  }
});

// SWAP button functionality - now swaps active with standby input
swapBtn.addEventListener("click", async () => {
  const inputFreq = freqInput.value.trim();
  
  if (!inputFreq) {
    showMessage("No standby frequency to swap.");
    return;
  }

  const standbyEntry = findFrequencyByNumber(inputFreq);

  if (!standbyEntry) {
    showMessage("Frequency not found: " + inputFreq);
    return;
  }

  stopAtisLoop();

  // Swap frequencies
  const temp = activeFreq;
  activeFreq = standbyEntry.freq;
  standbyFreq = temp;

  updateDisplay();
  
  const displayName = standbyEntry.name || "Unknown";
  showMessage("Swapped. Active: " + activeFreq + " - " + displayName);

  // Check if NEW active entry is ATIS (the one we just swapped in)
  if (isAtisEntry(standbyEntry)) {
    const airport = getAirportFromAtisName(standbyEntry.name);
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
