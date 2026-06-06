export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const response = await fetch("https://24data.ptfs.app/controllers");

    if (!response.ok) {
      return res.status(response.status).json({
        error: "24data controllers unavailable",
        status: response.status,
      });
    }

    const data = await response.json();

    return res.status(200).json(data);
  } catch (err) {
    console.error("Error fetching controllers:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
