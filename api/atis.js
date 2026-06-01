export default async function handler(req, res) {
  // Allow CORS from any origin (helpful for testing)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Only allow GET requests
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Fetch ATIS data from 24data
    const response = await fetch("https://24data.ptfs.app/atis");

    if (!response.ok) {
      // If 24data returns an error (e.g., 503), pass that through
      return res.status(response.status).json({
        error: "24data ATIS unavailable",
        status: response.status,
      });
    }

    const atisData = await response.json();
    return res.status(200).json(atisData);
  } catch (err) {
    console.error("Error fetching ATIS:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
