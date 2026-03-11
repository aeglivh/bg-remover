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

  const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
  if (!REPLICATE_API_TOKEN) {
    return res.status(500).json({ error: "REPLICATE_API_TOKEN not configured" });
  }

  try {
    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
        Prefer: "wait",
      },
      body: JSON.stringify({
        version: "95fcc2a26d3899cd6c2691c900465aaeff466285a65c14638cc5f36f34befaf1",
        input: { image },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Replicate API error:", errorData);
      return res.status(response.status).json({ error: "Replicate API error", details: errorData });
    }

    const prediction = await response.json();

    if (prediction.status === "failed") {
      return res.status(500).json({ error: "Prediction failed", details: prediction.error });
    }

    return res.status(200).json({ output: prediction.output });
  } catch (err) {
    console.error("Error calling Replicate:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
