import { isAllowedVideoHost } from "./_instagram.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const videoUrl = req.query.url;
  if (!videoUrl || !isAllowedVideoHost(videoUrl)) {
    return res.status(400).json({ error: "無效的影片連結。" });
  }

  try {
    const upstream = await fetch(videoUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
        Referer: "https://www.instagram.com/",
      },
    });

    if (!upstream.ok) {
      return res.status(502).json({ error: "影片下載失敗。" });
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    const filename = `reel-${Date.now()}.mp4`;

    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(buffer);
  } catch {
    return res.status(500).json({ error: "下載時發生錯誤。" });
  }
}