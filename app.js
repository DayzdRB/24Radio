let frequencies = [];

async function loadfrequencies()
{
  try
  {
    const response = await fetch("freq.json");
    const data = await response.json();
    frequencies = data;
    console.log("frequencies loaded:", frequencies);
    console.log("total entries: ", frequencies.length);
    
  }catch(error){
    console.error("Error loading freq.json:", error);
  }
}
