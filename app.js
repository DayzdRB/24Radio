let frequencies = [];
let activeFreq = null;
let standbyFreq = null;
async function loadfrequencies()
{
  try
  {
    const response = await fetch("freq.json");
    if(!response.ok){
      throw new Error("HTTP error! status: "+response.status);
    }
    const data = await response.json();
    frequencies = data;
    console.log("frequencies loaded:", frequencies);
    console.log("total entries: ", frequencies.length);
    
  }catch(error){
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

function updateDisplay(){
  activeFreqEl.textContent = activeFreq || "---";
  standbyFreqEl.textContent = standbyFreq || "---";
}

function findFrequencyByNumber(freqStr){
  return frequencies.find(f => f.freq === freqStr);
}

function showMessage(message){
  resultEl.textContent = message;
}

function isAtisEntry(entry){
  return entry && !entry.channelID;
}

function getAirportFromAtisName(name){
  if (!name) return null;
  const parts = name.split("_");
  return parts [0] || null;
}

async function fetchAllAtis(){
  const res = await fetch("/api/atis");
  if(!res.ok){
    throw new Error("Failed to fetch ATIS" + res.status);
  }
  return res.json();
}
function getAtisForAirport(allAtis, airport){
  return allAtis.find(a => a.airport === airport);
}

function formatAtisForSpeech(text) {
  if (!text) return "";
  let result = text.toUpperCase();

  const phonetic = {
    "A": "Alpha",
    "B": "Bravo",
    "C": "Charlie",
    "D": "Delta",
    "E": "Echo",
    "F": "Foxtrot",
    "G": "Golf",
    "H": "Hotel",
    "I": "India",
    "J": "Juliet",
    "K": "Kilo",
    "L": "Lima",
    "M": "Mike",
    "N": "November",
    "O": "Oscar",
    "P": "Papa",
    "Q": "Quebec",
    "R": "Romeo",
    "S": "Sierra",
    "T": "Tango",
    "U": "Uniform",
    "V": "Victor",
    "W": "Whiskey",
    "X": "X-ray",
    "Y": "Yankee",
    "Z": "Zulu"
  };

  // 1. Expand common abbreviations
  result = result.replace(/\bRWY\b/g, "RUNWAY");
  result = result.replace(/\bDEP\b/g, "DEPARTURE");
  result = result.replace(/\bARR\b/g, "ARRIVAL");
  result = result.replace(/\bAFCT\b/g, "AIRCRAFT");

  // 2. Runway designators: 25R -> TWO FIVE RIGHT
  result = result.replace(/\b(\d{2,3})R\b/g, "$1 RIGHT");
  result = result.replace(/\b(\d{2,3})L\b/g, "$1 LEFT");
  result = result.replace(/\b(\d{2,3})C\b/g, "$1 CENTER");

  // 3. Time: 1821Z -> ONE EIGHT TWO ONE ZULU
  result = result.replace(/\b(\d{4})Z\b/g, "$1 ZULU");
  result = result.replace(/\bZ\b/g, " ZULU ");

  // 4. Altimeter: Q1012 -> QNH ONE ZERO ONE TWO
  result = result.replace(/\bQ(\d{4})\b/g, "QNH $1");

  // 5. Cloud layers: FEW021 -> FEW CLOUDS AT TWO ONE
  result = result.replace(/\bBKN(\d{2,3})\b/g, "BROKEN CLOUDS AT $1");
  result = result.replace(/\bSCT(\d{2,3})\b/g, "SCATTERED CLOUDS AT $1");
  result = result.replace(/\bOVC(\d{2,3})\b/g, "OVERCAST CLOUDS AT $1");
  result = result.replace(/\bFEW(\d{2,3})\b/g, "FEW CLOUDS AT $1");

  // 6. Transition level: LEVEL 030 -> TRANSITION LEVEL ZERO THREE ZERO
  result = result.replace(/\bLEVEL\s+(\d{2,3})\b/g, "LEVEL $1");

  // 7. Replace "INFO X" or "INFORMATION X" with phonetic letter
  result = result.replace(/\bINFO(?:RMATION)?\s+([A-Z])\b/g, (match, letter) => {
    const phoneticLetter = phonetic[letter] || letter;
    return "INFO " + phoneticLetter;
  });

  // 8. Replace "INFORMATION X" explicitly
  result = result.replace(/INFORMATION\s+([A-Z])\b/g, (match, letter) => {
    const phoneticLetter = phonetic[letter] || letter;
    return "INFORMATION " + phoneticLetter;
  });

  // 9. Weather line formatting for clarity
  // Expecting something like: 316/05 9999 FEW021 04/09 Q1012
  // We'll add labels: WIND, VISIBILITY, CLOUDS, TEMPERATURE

  // First, handle cloud layers again here to ensure they're in the right format
  result = result.replace(/\bBKN(\d{2,3})\b/g, "BROKEN CLOUDS AT $1");
  result = result.replace(/\bSCT(\d{2,3})\b/g, "SCATTERED CLOUDS AT $1");
  result = result.replace(/\bOVC(\d{2,3})\b/g, "OVERCAST CLOUDS AT $1");
  result = result.replace(/\bFEW(\d{2,3})\b/g, "FEW CLOUDS AT $1");

  // Wind: 316/05 -> WIND THREE ONE SIX SLASH ZERO FIVE
  result = result.replace(/\b(\d{3})\/(\d{2})\b/g, (match, dir, spd) => {
    const dirDigits = dir.split("").join(" ");
    const spdDigits = spd.split("").join(" ");
    return "WIND " + dirDigits + " SLASH " + spdDigits;
  });

  // Visibility: 9999 -> VISIBILITY NINE NINE NINE NINE
  result = result.replace(/\b9999\b/g, "VISIBILITY NINE NINE NINE NINE");

  // Temperature/dew: 04/09 -> TEMPERATURE ZERO FOUR SLASH ZERO NINE
  result = result.replace(/\b(\d{2})\/(\d{2})\b/g, (match, t1, t2) => {
    const t1Digits = t1.split("").join(" ");
    const t2Digits = t2.split("").join(" ");
    return "TEMPERATURE ZERO FOUR SLASH ZERO NINE";
  });

  // 10. General numbers (for altimeter, cloud height, etc.)
  result = result.replace(/\b(\d{2,3})\b/g, (match, num) => {
    return num.split("").join(" ");
  });

  // 11. Replace remaining / with SLASH (fallback)
  result = result.replace(/\//g, " SLASH ");

  // 12. Force ATIS to be pronounced as one word: "Atis" (do this LAST)
  result = result.replace(/\bATIS\b/g, "Atis");

  return result;
}





function speakText(text){
  speechSynthesis.cancel();

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
          const atisText = atis.content.trim();
          const atisTextForSpeech = formatAtisForSpeech(atisText);
          showMessage("ATIS fetched for " + airport + ". Speaking...");
          speakText(atisTextForSpeech);
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

  const temp = activeFreq;
  activeFreq = standbyFreq;
  standbyFreq = temp;

  updateDisplay();
  showMessage("Swapped. Active: " + activeFreq);

  // Check if the new active frequency is an ATIS
  const activeEntry = frequencies.find(f => f.freq === activeFreq);
  if (activeEntry && isAtisEntry(activeEntry)) {
    const airport = getAirportFromAtisName(activeEntry.name);
    if (airport) {
      try {
        const allAtis = await fetchAllAtis();
        const atis = getAtisForAirport(allAtis, airport);

        if (atis) {
          const atisText = atis.content.trim();
          const atisTextForSpeech = formatAtisForSpeech(atisText);
          showMessage("ATIS active on COM1. Speaking...");
          speakText(atisTextForSpeech);
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


