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

    // 10. Split weather line into separate lines: wind, visibility, clouds, temp, dew, QNH
    // Check if line has multiple weather items separated by spaces
    if (line.match(/WIND AT.*KNOTS.*VISIBILITY/) ||
        line.match(/WIND AT.*KNOTS.*CLOUDS AT/) ||
        line.match(/WIND AT.*KNOTS.*TEMPERATURE/) ||
        line.match(/VISIBILITY.*CLOUDS AT/) ||
        line.match(/VISIBILITY.*TEMPERATURE/) ||
        line.match(/CLOUDS AT.*TEMPERATURE/) ||
        line.match(/QNH.*ONE ZERO/)) {

      // Extract each weather component into its own line
      const windMatch = line.match(/WIND AT [^V]+KNOTS/);
      const visMatch = line.match(/VISIBILITY [^C]+/);
      const cloudsMatch = line.match(/(BROKEN|SCATTERED|OVERCAST|FEW) CLOUDS AT [^\sT]+/);
      const tempMatch = line.match(/TEMPERATURE [^Q]+/);
      const qnhMatch = line.match(/QNH [^\s]+/);

      if (windMatch) lines.push(windMatch[0].trim());
      if (visMatch) lines.push(visMatch[0].trim());
      if (cloudsMatch) lines.push(cloudsMatch[0].trim());
      if (tempMatch) lines.push(tempMatch[0].trim());
      if (qnhMatch) lines.push(qnhMatch[0].trim());

      continue;
    }

    // 11. Break up ARRIVAL RUNWAY from DEPARTURE RUNWAY on separate lines
    if (line.includes("DEPARTURE") && line.includes("ARRIVAL")) {
      const depMatch = line.match(/DEPARTURE RUNWAY [^\s]+/);
      const arrMatch = line.match(/ARRIVAL RUNWAY [^\s]+/);

      if (depMatch && arrMatch) {
        lines.push(depMatch[0].trim());
        lines.push(arrMatch[0].trim());
        continue;
      }
    }

    // 12. Split ATIS INFO line into separate parts: "ISAU ATIS INFO V" and "TIME 1821Z"
    if (line.match(/ATIS INFO [A-Z]+ TIME/)) {
      const atisInfoMatch = line.match(/^[^\s]+ ATIS INFO [A-Z]+/);
      const timeMatch = line.match(/TIME [^\s]+/);

      if (atisInfoMatch && timeMatch) {
        lines.push(atisInfoMatch[0].trim());
        lines.push(timeMatch[0].trim());
        continue;
      }
    }

    // 13. General numbers (for altimeter digits, cloud height, etc.)
    // Reads 1012 as "ONE ZERO ONE TWO" not "ONE THOUSAND"
    line = line.replace(/\b(\d{2,4})\b/g, (match, num) => {
      return num.split("").join(" ");
    });

    // 14. Replace remaining / with SLASH (fallback)
    line = line.replace(/\//g, " SLASH ");

    // 15. Force ATIS to be pronounced as one word: "Atis" (do this LAST, after toUpperCase)
    line = line.replace(/\bATIS\b/g, "Atis");

    lines.push(line);
  }

  return lines;
}
