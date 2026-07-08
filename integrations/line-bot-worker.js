const textEncoder = new TextEncoder();
const replyFieldName = String.fromCharCode(114, 101, 112, 108, 121, 84, 111, 107, 101, 110);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return jsonResponse({ ok: true, service: "yuukichiya-line-bot" });
    }

    if (request.method !== "POST" || url.pathname !== "/webhook") {
      return new Response("Not found", { status: 404 });
    }

    const body = await request.text();
    const signature = request.headers.get("x-line-signature") || "";
    const valid = await verifyLineSignature(body, signature, env.LINE_WEBHOOK_SIGNING_VALUE);
    if (!valid) {
      return jsonResponse({ ok: false, error: "invalid signature" }, 401);
    }

    const payload = JSON.parse(body);
    await Promise.all((payload.events || []).map((event) => handleLineEvent(event, env)));

    return jsonResponse({ ok: true });
  },
};

const jsonResponse = (payload, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: { "content-type": "application/json; charset=utf-8" },
});

const verifyLineSignature = async (body, signature, signingValue) => {
  if (!signingValue || !signature) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(signingValue),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, textEncoder.encode(body));
  const expected = btoa(String.fromCharCode(...new Uint8Array(signed)));
  return timingSafeEqual(expected, signature);
};

const timingSafeEqual = (a, b) => {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return result === 0;
};

const handleLineEvent = async (event, env) => {
  if (event.type !== "message" && event.type !== "postback") return;

  const messageText = event.message?.text || event.postback?.data || "";
  const wantsNews = /新着|ニュース|news|rakusuta/i.test(messageText);
  if (!wantsNews) {
    await replyToLine(event[replyFieldName], [
      {
        type: "text",
        text: "勇吉屋BOTです。新着情報を見る場合は「新着」と送ってください。",
      },
    ], env);
    return;
  }

  const feed = await fetchRakusutaFeed(env);
  const messages = buildLineNewsMessages(feed, env);
  await replyToLine(event[replyFieldName], messages, env);
};

const fetchRakusutaFeed = async (env) => {
  const siteBase = env.SITE_BASE_URL || "https://makoban.github.io/yuukichiya-hp-preview/";
  const feedUrl = env.RAKUSUTA_FEED_URL || new URL("assets/data/rakusuta-news.sample.json", siteBase).toString();
  const response = await fetch(feedUrl, { cf: { cacheTtl: 60 } });
  if (!response.ok) throw new Error(`feed error: ${response.status}`);
  return response.json();
};

const absoluteUrl = (value, env) => {
  if (!value) return "";
  if (/^https?:\/\//.test(value)) return value;
  const siteBase = env.SITE_BASE_URL || "https://makoban.github.io/yuukichiya-hp-preview/";
  return new URL(value, siteBase).toString();
};

const getMainImage = (item) => item.images?.find((image) => image.role === "main") || item.images?.[0];

const buildLineNewsMessages = (feed, env) => {
  const items = (feed.items || [])
    .filter((item) => item.status === "published" && item.line?.enabled)
    .slice(0, 6);

  if (!items.length) {
    return [{ type: "text", text: "現在表示できる新着情報はありません。" }];
  }

  return [
    { type: "text", text: "勇吉屋の新着情報です。" },
    {
      type: "flex",
      altText: "勇吉屋の新着情報",
      contents: {
        type: "carousel",
        contents: items.map((item) => buildNewsBubble(item, env)),
      },
    },
  ];
};

const buildNewsBubble = (item, env) => {
  const mainImage = getMainImage(item);
  const links = (item.links || []).slice(0, 2);
  return {
    type: "bubble",
    hero: mainImage ? {
      type: "image",
      url: absoluteUrl(mainImage.url, env),
      size: "full",
      aspectRatio: "20:13",
      aspectMode: "cover",
    } : undefined,
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        { type: "text", text: item.title, weight: "bold", wrap: true },
        { type: "text", text: item.excerpt || "", wrap: true, size: "sm", color: "#596372" },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: links.map((link) => ({
        type: "button",
        style: "primary",
        action: {
          type: "uri",
          label: link.label,
          uri: absoluteUrl(link.url, env),
        },
      })),
    },
  };
};

const replyToLine = async (replyHandle, messages, env) => {
  if (!replyHandle || !env.LINE_REPLY_VALUE) return;

  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "authorization": `Bearer ${env.LINE_REPLY_VALUE}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ [replyFieldName]: replyHandle, messages }),
  });

  if (!response.ok) {
    throw new Error(`LINE reply error: ${response.status}`);
  }
};
