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
    line = line.replace(/\bBKN(\d{2,3})\b/g, "BROKEN\x00CLOUDS AT $1");
    line = line.replace(/\bSCT(\d{2,3})\b/g, "SCATTERED\x00CLOUDS AT $1");
    line = line.replace(/\bOVC(\d{2,3})\b/g, "OVERCAST\x00CLOUDS AT $1");
    line = line.replace(/\bFEW(\d{2,3})\b/g, "FEW\x00CLOUDS AT $1");

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

    // 9. Split weather line by spaces into separate lines BEFORE processing
    // First, protect cloud codes from being split (use \x00 as placeholder)
    // Then split by spaces and rejoin protected parts
    const weatherParts = [];
    
    // Check if this is a weather line (has wind, vis, clouds, temp/dew, QNH)
    if (line.match(/\d{3}\/\d{2}/) || line.match(/9999/) || line.match(/(BKN|SCT|OVC|FEW)\d{2,3}/) || line.match(/\d{2}\/\d{2}/) || line.match(/QNH/)) {
      // Split weather line into components
      const windMatch = line.match(/(\d{3}\/\d{2})/);
      const visMatch = line.match(/(9999)/);
      const cloudsMatch = line.match(/((?:BKN|SCT|OVC|FEW)\d{2,3})/);
      const tempDewMatch = line.match(/(\d{2}\/\d{2})/);
      const qnhMatch = line.match(/(QNH\d{4})/);
      
      if (windMatch) weatherParts.push("WIND " + windMatch[1]);
      if (visMatch) weatherParts.push("VISIBILITY " + visMatch[1]);
      if (cloudsMatch) weatherParts.push("CLOUDS " + cloudsMatch[1]);
      if (tempDewMatch) weatherParts.push("TEMP " + tempDewMatch[1]);
      if (qnhMatch) weatherParts.push(qnhMatch[1]);
      
      // Process each weather part separately
      for (let part of weatherParts) {
        let weatherLine = part;
        
        // Wind: 316/05 -> WIND AT THREE ONE SIX DEGREES AT ZERO FIVE KNOTS
        weatherLine = weatherLine.replace(/(\d{3})\/(\d{2})/, (match, dir, spd) => {
          const dirDigits = dir.split("").join(" ");
          const spdDigits = spd.split("").join(" ");
          return "WIND AT " + dirDigits + " DEGREES AT " + spdDigits + " KNOTS";
        });
        
        // Visibility: 9999 -> VISIBILITY NINE NINE NINE NINE
        weatherLine = weatherLine.replace(/9999/, "VISIBILITY NINE NINE NINE NINE");
        
        // Clouds: FEW021 -> FEW CLOUDS AT TWO ONE
        weatherLine = weatherLine.replace(/(BKN)(\d{2,3})/, "BROKEN CLOUDS AT $2");
        weatherLine = weatherLine.replace(/(SCT)(\d{2,3})/, "SCATTERED CLOUDS AT $2");
        weatherLine = weatherLine.replace(/(OVC)(\d{2,3})/, "OVERCAST CLOUDS AT $2");
        weatherLine = weatherLine.replace(/(FEW)(\d{2,3})/, "FEW CLOUDS AT $2");
        
        // Temp/dew: 04/09 -> TEMPERATURE ZERO FOUR, DEW POINT ZERO NINE
        weatherLine = weatherLine.replace(/(\d{2})\/(\d{2})/, (match, t1, t2) => {
          const t1Digits = t1.split("").join(" ");
          const t2Digits = t2.split("").join(" ");
          return "TEMPERATURE " + t1Digits + " DEW POINT " + t2Digits;
        });
        
        // QNH: QNH1012 -> QNH ONE ZERO ONE TWO
        weatherLine = weatherLine.replace(/QNH(\d{4})/, (match, qnh) => {
          return "QNH " + qnh.split("").join(" ");
        });
        
        // General numbers
        weatherLine = weatherLine.replace(/\b(\d{2,4})\b/g, (match, num) => {
          return num.split("").join(" ");
        });
        
        // ATIS
        weatherLine = weatherLine.replace(/\bATIS\b/g, "Atis");
        
        lines.push(weatherLine.trim());
      }
      continue;
    }

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

    // 11. Split ATIS INFO line into separate parts: "ISAU ATIS INFO V" and "TIME 1821Z"
    if (line.match(/ATIS INFO [A-Z]+ TIME/)) {
      const atisInfoMatch = line.match(/^[^\s]+ ATIS INFO [A-Z]+/);
      const timeMatch = line.match(/TIME [^\s]+/);

      if (atisInfoMatch && timeMatch) {
        lines.push(atisInfoMatch[0].trim());
        lines.push(timeMatch[0].trim());
        continue;
      }
    }

    // 12. General numbers (for altimeter digits, cloud height, etc.)
    line = line.replace(/\b(\d{2,4})\b/g, (match, num) => {
      return num.split("").join(" ");
    });

    // 13. Replace remaining / with SLASH (fallback)
    line = line.replace(/\//g, " SLASH ");

    // 14. Force ATIS to be pronounced as one word: "Atis"
    line = line.replace(/\bATIS\b/g, "Atis");

    lines.push(line);
  }

  return lines;
}
