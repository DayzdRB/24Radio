let frequencies = [];
let activeFreq = null;
let standbyFreq = null;
async function loadfrequencies()
{
  try
  {
    const response = await fetch("/24Radio/freq.json");
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
updateDisplay();

const activeFreqEl = document.getElementById("active-freq");
const standbyFreqEl = document.getElementById("standby-freq");
const freqInput = document.getElementById("freq-input");
const tuneBtn = document.getElementById("tune-btn");
const swapBtn = document.getElementById("swap-btn");
const resuletEl = document.getElementById("result");

function updateDisplay(){
  activeFreqEl.textContent = activeFreq || "---";
  standbyFreqEl.textConent = standbyFreq || "---";
}

function findFrequencyByNumber(freqStr){
  return frequencies.find(f => f.freq === freqStr);
}

function showMessage(message){
  resultEl.textConent = message;
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
  
)};

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
}};




