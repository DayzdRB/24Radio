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


function formatAtisForSpeech(text){
  if(!text) return = "";
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
  result = result.replace(/\bRWY\b/g, "RUNWAY");
  result = result.replace(/\bDEP\b/g, "DEPARTURE");
  result = result.replace(/\bARR\b/g, "ARRIVAL");
  result = result.replace(/\bLEVEL\s+(\d{2,3})\b/g, "LEVEL $1");
  result = result.replace(/\bINFO(?:RMATION)?\s+([A-Z])\b/g, (match, letter) => {
    const phoneticLetter = phonetic[letter] || letter;
    return "INFO " + phoneticLetter;
  });

  result = result.replace(/INFORMATION\s+([A-Z])\b/g, (match, letter) => {
    const phoneticLetter = phonetic[letter] || letter;
    return "INFORMATION " + phoneticLetter;
  });
  result = result.replace(/\b(\d+(?:\.\d+)?)\b/g, (match, num) => {
    const [intPart, decPart] = num.split(".");
    const intDigits = intPart.split("").join(" ");
    if (decPart !== undefined) {
      const decDigits = decPart.split("").join(" ");
      return intDigits + " point " + decDigits;
    }
    return intDigits;
  });
  result = result.replace(/\//g, " SLASH ");
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
          showMessage("ATIS fetched for " + airport + ". Speaking...");
          speakText(atisText);
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
          showMessage("ATIS active on COM1. Speaking...");
          speakText(atisText);
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


