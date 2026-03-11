export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { image } = req.body;
  if (!image) {
    return res.status(400).json({ error: 'Missing "image" field' });
  }

  const API_KEY = process.env.REMOVE_BG_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: "REMOVE_BG_API_KEY not configured" });
  }

  try {
    // Strip data URI prefix to get raw base64
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

    const response = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: {
        "X-Api-Key": API_KEY,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        image_file_b64: base64Data,
        size: "full",
        format: "png",
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("remove.bg API error:", errorData);
      return res.status(response.status).json({ error: "remove.bg API error", details: errorData });
    }

    const data = await response.json();
    // Response contains result_b64 with the PNG as base64
    const resultDataUri = `data:image/png;base64,${data.data.result_b64}`;
    return res.status(200).json({ output: resultDataUri });
  } catch (err) {
    console.error("Error calling remove.bg:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
