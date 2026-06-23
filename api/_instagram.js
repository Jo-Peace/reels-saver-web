const USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const IG_APP_ID = "936619743392459";
const GRAPHQL_DOC_ID = "10015901848480474";

export function extractShortcode(urlString) {
  const trimmed = urlString.trim();
  const pattern =
    /instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(?:p|reels?|tv)\/([A-Za-z0-9_-]+)/;
  const match = trimmed.match(pattern);
  return match?.[1] ?? null;
}

function firstMatch(text, pattern) {
  const match = text.match(pattern);
  return match?.[1] ?? null;
}

async function fetchViaGraphQL(shortcode) {
  const params = new URLSearchParams({
    variables: JSON.stringify({ shortcode }),
    doc_id: GRAPHQL_DOC_ID,
    lsd: "AVqbxe3J_YA",
  });

  const response = await fetch(
    `https://www.instagram.com/api/graphql?${params}`,
    {
      method: "POST",
      headers: {
        "User-Agent": USER_AGENT,
        "X-IG-App-ID": IG_APP_ID,
        "X-FB-LSD": "AVqbxe3J_YA",
        "X-ASBD-ID": "129477",
        "Content-Type": "application/x-www-form-urlencoded",
        "Sec-Fetch-Site": "same-origin",
      },
    }
  );

  if (!response.ok) return null;

  const text = await response.text();
  if (!text.startsWith("{")) return null;

  const json = JSON.parse(text);
  const media = json?.data?.xdt_shortcode_media;
  if (!media) return null;

  if (media.is_private) {
    throw new Error("此內容來自私人帳號，無法下載。");
  }

  if (media.video_url) {
    return {
      videoUrl: media.video_url,
      thumbnailUrl: media.thumbnail_src ?? null,
      caption: media.edge_media_to_caption?.edges?.[0]?.node?.text ?? null,
      username: media.owner?.username ?? null,
    };
  }

  return null;
}

async function fetchViaEmbedPage(shortcode) {
  const response = await fetch(
    `https://www.instagram.com/reel/${shortcode}/embed/`,
    { headers: { "User-Agent": USER_AGENT } }
  );

  if (!response.ok) return null;

  const html = await response.text();
  const thumbnailUrl = firstMatch(
    html,
    /property="og:image" content="([^"]+)"/
  );

  const patterns = [
    /"video_url":"([^"]+)"/,
    /video_url\\":\\"([^"]+)"/,
    /property="og:video" content="([^"]+)"/,
    /property="og:video:secure_url" content="([^"]+)"/,
    /(https:\\\/\\\/[^"\\]+\.mp4[^"\\]*)/,
    /(https:\/\/[^"\\]+\.mp4[^"\\]*)/,
  ];

  for (const pattern of patterns) {
    const raw = firstMatch(html, pattern);
    if (raw) {
      const videoUrl = decodeEscapedUrl(raw);
      if (videoUrl.includes(".mp4")) {
        return { videoUrl, thumbnailUrl, caption: null, username: null };
      }
    }
  }

  return null;
}

function decodeEscapedUrl(raw) {
  return raw
    .replace(/\\u0026/g, "&")
    .replace(/\\u00253D/g, "=")
    .replace(/\\\//g, "/")
    .replace(/\\"/g, '"');
}

export async function resolveInstagramMedia(urlString) {
  const shortcode = extractShortcode(urlString);
  if (!shortcode) {
    throw new Error("無效的 Instagram 連結，請貼上 Reel 或貼文網址。");
  }

  const graphql = await fetchViaGraphQL(shortcode);
  if (graphql) return graphql;

  const embed = await fetchViaEmbedPage(shortcode);
  if (embed) return embed;

  throw new Error("找不到影片，此 Reel 可能已刪除或無法存取。");
}

export function isAllowedVideoHost(urlString) {
  try {
    const host = new URL(urlString).hostname;
    return (
      host.endsWith("cdninstagram.com") ||
      host.endsWith("fbcdn.net") ||
      host === "instagram.com" ||
      host.endsWith(".instagram.com")
    );
  } catch {
    return false;
  }
}