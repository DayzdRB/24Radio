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

function speakText(text){
  speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  speechSynthesis.speak(utterance);
}






tuneBtn.addEventListener("click", () =>{
  const input = freqInput.value.trim();
  const entry = findFrequencyByNumber(input);

  if(!entry){
    showMessage("Frequency not found: "+ input);
    return;
  }

    standbyFreq = entry.freq;
  updateDisplay();
  showMessage("Tuned to: "+ entry.name + " - "+ entry.freq);
  
});

swapBtn.addEventListener("click", () => {
  if (!standbyFreq){
    showMessage("No standby frequency to swap.");
    return;
  }

  const temp = activeFreq;
  activeFreq = standbyFreq;
  standbyFreq = temp;

  updateDisplay();
  showMessage("Swapped. Active: "+ activeFreq);
});

updateDisplay();


