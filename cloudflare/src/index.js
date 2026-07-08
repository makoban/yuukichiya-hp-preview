const textEncoder = new TextEncoder();
const MAX_JSON_BYTES = 1024 * 1024;
const SESSION_TTL_MS = 3 * 60 * 60 * 1000;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(env) });
    }

    try {
      if (request.method === "GET" && url.pathname === "/health") {
        return jsonResponse({ ok: true, service: "yuukichiya-hp-news-bot" }, 200, env);
      }

      if (request.method === "GET" && url.pathname === "/api/news") {
        const posts = await listPosts(env, request.url, "published");
        return jsonResponse({
          schemaVersion: "2026-07-09.yuukichiya-news-feed.v1",
          source: {
            name: "勇吉屋HP更新管理Bot",
            mode: "worker",
            updatedAt: new Date().toISOString(),
          },
          items: posts,
        }, 200, env);
      }

      if (request.method === "GET" && url.pathname.startsWith("/media/")) {
        return serveMedia(url.pathname.replace(/^\/media\//, ""), env);
      }

      if (request.method === "POST" && url.pathname === "/webhook") {
        return handleLineWebhook(request, env);
      }

      if (url.pathname.startsWith("/api/admin/")) {
        const authorized = await isAuthorized(request, env);
        if (!authorized) {
          return jsonResponse({ ok: false, error: "unauthorized" }, 401, env);
        }
        return handleAdminRequest(request, env);
      }

      return jsonResponse({ ok: false, error: "not found" }, 404, env);
    } catch (error) {
      console.error(JSON.stringify({
        level: "error",
        message: error.message,
        path: url.pathname,
        stack: error.stack,
      }));
      return jsonResponse({ ok: false, error: "internal error" }, 500, env);
    }
  },
};

const corsHeaders = (env) => ({
  "access-control-allow-origin": env.CORS_ORIGIN || "*",
  "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "access-control-allow-headers": "authorization,content-type,x-line-signature",
  "access-control-max-age": "86400",
});

const jsonResponse = (payload, status = 200, env = {}) => new Response(JSON.stringify(payload), {
  status,
  headers: {
    ...corsHeaders(env),
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  },
});

const readJson = async (request) => {
  const length = Number(request.headers.get("content-length") || "0");
  if (length > MAX_JSON_BYTES) throw new Error("request body too large");
  return request.json();
};

const readTextBody = async (request) => {
  const length = Number(request.headers.get("content-length") || "0");
  if (length > MAX_JSON_BYTES) throw new Error("request body too large");
  return request.text();
};

const sha256 = async (value) => {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(value || ""));
  return new Uint8Array(digest);
};

const timingSafeEqualBytes = (first, second) => {
  if (first.length !== second.length) return false;
  let result = 0;
  for (let index = 0; index < first.length; index += 1) {
    result |= first[index] ^ second[index];
  }
  return result === 0;
};

const safeCompare = async (first, second) => timingSafeEqualBytes(await sha256(first), await sha256(second));

const isAuthorized = async (request, env) => {
  if (!env.ADMIN_TOKEN) return false;
  const header = request.headers.get("authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "");
  return safeCompare(token, env.ADMIN_TOKEN);
};

const verifyLineSignature = async (body, signature, channelSecret) => {
  if (!channelSecret || !signature) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(channelSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, textEncoder.encode(body));
  const expected = btoa(String.fromCharCode(...new Uint8Array(signed)));
  return safeCompare(expected, signature);
};

const nowIso = () => new Date().toISOString();
const todayKey = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
const publicBaseUrl = (requestUrl) => new URL(requestUrl).origin;

const parseJsonArray = (value, fallback = []) => {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const truncate = (value, max) => {
  const text = String(value || "").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

const getSourceUser = (source = {}) => (
  source.userId || source.groupId || source.roomId || "unknown-line-source"
);

const detectCategory = (text) => {
  if (/採寸|予約|入学|入学準備/.test(text)) return "採寸";
  if (/セール|割引|OFF|お得/.test(text)) return "セール";
  if (/レンタル|卒業式/.test(text)) return "レンタル";
  if (/休業|営業時間|営業日|定休日/.test(text)) return "営業案内";
  if (/制服|体操服|バッグ|靴|商品/.test(text)) return "商品案内";
  return "新着情報";
};

const detectStores = (text) => {
  const stores = [];
  if (/本店/.test(text)) stores.push("本店");
  if (/髙橋|高橋/.test(text)) stores.push("髙橋店");
  return stores.length ? stores : ["本店", "髙橋店"];
};

const extractLinks = (text) => {
  const urls = text.match(/https?:\/\/[^\s　]+/g) || [];
  return urls.slice(0, 4).map((url, index) => ({
    label: index === 0 ? "詳細を見る" : `関連リンク${index + 1}`,
    url,
  }));
};

const composeDraftFromText = (text) => {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const rawTitle = lines[0] || "勇吉屋からのお知らせ";
  const body = lines.join("\n") || text.trim();
  const excerptSeed = lines.length > 1 ? lines.slice(1).join(" ") : body;

  return {
    title: truncate(rawTitle.replace(/^タイトル[:：]\s*/, ""), 42),
    excerpt: truncate(excerptSeed.replace(/https?:\/\/[^\s　]+/g, "").trim(), 86),
    body,
    category: detectCategory(text),
    targetStores: detectStores(text),
    links: extractLinks(text),
  };
};

const rowToPost = (row) => ({
  id: row.id,
  source: row.source,
  sourceUser: row.source_user,
  sourceDisplayName: row.source_display_name || "",
  status: row.status,
  category: row.category,
  title: row.title,
  excerpt: row.excerpt,
  body: row.body,
  targetStores: parseJsonArray(row.target_stores, ["本店", "髙橋店"]),
  publishedAt: row.published_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at || "",
  images: [],
  links: [],
});

const mediaUrl = (urlBase, row) => {
  if (!row.url) return "";
  if (/^https?:\/\//.test(row.url)) return row.url;
  return new URL(row.url, urlBase).toString();
};

const hydratePosts = async (rows, env, requestUrl) => {
  const posts = rows.map(rowToPost);
  if (!posts.length) return posts;

  const ids = posts.map((post) => post.id);
  const placeholders = ids.map(() => "?").join(",");
  const imagesResult = await env.DB.prepare(
    `SELECT * FROM post_images WHERE post_id IN (${placeholders}) ORDER BY sort_order ASC, created_at ASC`,
  ).bind(...ids).all();
  const linksResult = await env.DB.prepare(
    `SELECT * FROM post_links WHERE post_id IN (${placeholders}) ORDER BY sort_order ASC, created_at ASC`,
  ).bind(...ids).all();
  const base = publicBaseUrl(requestUrl);
  const postsById = new Map(posts.map((post) => [post.id, post]));

  (imagesResult.results || []).forEach((row) => {
    const post = postsById.get(row.post_id);
    if (!post) return;
    post.images.push({
      id: row.id,
      url: mediaUrl(base, row),
      alt: row.alt,
      sortOrder: row.sort_order,
    });
  });

  (linksResult.results || []).forEach((row) => {
    const post = postsById.get(row.post_id);
    if (!post) return;
    post.links.push({
      id: row.id,
      label: row.label,
      url: row.url,
      sortOrder: row.sort_order,
    });
  });

  return posts;
};

const listPosts = async (env, requestUrl, status = "all") => {
  const query = status === "all"
    ? "SELECT * FROM posts ORDER BY updated_at DESC LIMIT 100"
    : "SELECT * FROM posts WHERE status = ? ORDER BY published_at DESC, updated_at DESC LIMIT 100";
  const result = status === "all"
    ? await env.DB.prepare(query).all()
    : await env.DB.prepare(query).bind(status).all();
  return hydratePosts(result.results || [], env, requestUrl);
};

const getPost = async (env, requestUrl, postId) => {
  const row = await env.DB.prepare("SELECT * FROM posts WHERE id = ?").bind(postId).first();
  if (!row) return null;
  const posts = await hydratePosts([row], env, requestUrl);
  return posts[0] || null;
};

const upsertPost = async (env, post) => {
  const timestamp = nowIso();
  const postId = post.id || `post-${crypto.randomUUID()}`;
  const createdAt = post.createdAt || timestamp;
  const updatedAt = timestamp;
  const targetStores = JSON.stringify(post.targetStores?.length ? post.targetStores : ["本店", "髙橋店"]);

  await env.DB.prepare(`
    INSERT INTO posts (
      id, source, source_user, source_display_name, status, category, title, excerpt, body,
      target_stores, published_at, created_at, updated_at, deleted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      source = excluded.source,
      source_user = excluded.source_user,
      source_display_name = excluded.source_display_name,
      status = excluded.status,
      category = excluded.category,
      title = excluded.title,
      excerpt = excluded.excerpt,
      body = excluded.body,
      target_stores = excluded.target_stores,
      published_at = excluded.published_at,
      updated_at = excluded.updated_at,
      deleted_at = excluded.deleted_at
  `).bind(
    postId,
    post.source || "dashboard",
    post.sourceUser || "",
    post.sourceDisplayName || "",
    post.status || "draft",
    post.category || "新着情報",
    truncate(post.title || "勇吉屋からのお知らせ", 80),
    truncate(post.excerpt || "", 220),
    post.body || "",
    targetStores,
    post.publishedAt || todayKey(),
    createdAt,
    updatedAt,
    post.status === "deleted" ? (post.deletedAt || timestamp) : "",
  ).run();

  await replacePostLinks(env, postId, post.links || []);
  return postId;
};

const replacePostLinks = async (env, postId, links) => {
  await env.DB.prepare("DELETE FROM post_links WHERE post_id = ?").bind(postId).run();
  await Promise.all(links.slice(0, 8).map((link, index) => (
    env.DB.prepare(`
      INSERT INTO post_links (id, post_id, label, url, sort_order, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      `link-${crypto.randomUUID()}`,
      postId,
      truncate(link.label || "詳細を見る", 24),
      link.url || "",
      index + 1,
      nowIso(),
    ).run()
  )));
};

const setDraftSession = async (env, sourceUser, postId) => {
  await env.DB.prepare(`
    INSERT INTO draft_sessions (source_user, post_id, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(source_user) DO UPDATE SET post_id = excluded.post_id, updated_at = excluded.updated_at
  `).bind(sourceUser, postId, nowIso()).run();
};

const getActiveDraftForSource = async (env, requestUrl, sourceUser) => {
  const row = await env.DB.prepare(`
    SELECT p.* FROM draft_sessions s
    JOIN posts p ON p.id = s.post_id
    WHERE s.source_user = ? AND p.status = 'draft'
  `).bind(sourceUser).first();
  if (!row) return null;

  const updatedAt = new Date(row.updated_at).getTime();
  if (Number.isNaN(updatedAt) || Date.now() - updatedAt > SESSION_TTL_MS) return null;
  return getPost(env, requestUrl, row.id);
};

const addImageToPost = async (env, postId, image) => {
  const countRow = await env.DB.prepare("SELECT COUNT(*) AS count FROM post_images WHERE post_id = ?").bind(postId).first();
  const sortOrder = Number(countRow?.count || 0) + 1;
  await env.DB.prepare(`
    INSERT INTO post_images (id, post_id, r2_key, url, content_type, alt, sort_order, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    image.id,
    postId,
    image.r2Key || "",
    image.url,
    image.contentType || "",
    image.alt || "",
    sortOrder,
    nowIso(),
  ).run();
};

const serveMedia = async (key, env) => {
  if (!key || !env.MEDIA) return new Response("Not found", { status: 404 });
  const object = await env.MEDIA.get(key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  return new Response(object.body, { headers });
};

const fetchLineContent = async (messageId, env) => {
  if (!env.LINE_CHANNEL_ACCESS_TOKEN) {
    throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not configured");
  }
  const response = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
    headers: { authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}` },
  });
  if (!response.ok) throw new Error(`LINE content error: ${response.status}`);
  return {
    bytes: await response.arrayBuffer(),
    contentType: response.headers.get("content-type") || "application/octet-stream",
  };
};

const extensionForContentType = (contentType) => {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  return "jpg";
};

const storeLineImage = async (event, env, postId) => {
  const content = await fetchLineContent(event.message.id, env);
  const extension = extensionForContentType(content.contentType);
  const key = `line/${postId}/${crypto.randomUUID()}.${extension}`;
  await env.MEDIA.put(key, content.bytes, {
    httpMetadata: { contentType: content.contentType },
    customMetadata: { postId, source: "line" },
  });
  return {
    id: `image-${crypto.randomUUID()}`,
    r2Key: key,
    url: `/media/${key}`,
    contentType: content.contentType,
    alt: "LINEから届いた投稿画像",
  };
};

const replyToLine = async (replyToken, messages, env) => {
  if (!replyToken || !env.LINE_CHANNEL_ACCESS_TOKEN) return;
  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ replyToken, messages }),
  });
  if (!response.ok) {
    console.error(JSON.stringify({ level: "error", message: "LINE reply failed", status: response.status }));
  }
};

const buildDashboardMessage = (post, env) => {
  const dashboardUrl = env.DASHBOARD_URL || env.PUBLIC_SITE_BASE_URL || "";
  const lines = [
    "HP更新用の下書きに保存しました。",
    `タイトル: ${post.title}`,
    `状態: ${post.status === "published" ? "公開中" : "下書き"}`,
  ];
  if (post.images?.length) lines.push(`写真: ${post.images.length}枚`);
  if (dashboardUrl) lines.push(`確認: ${dashboardUrl}`);
  return { type: "text", text: lines.join("\n") };
};

const handleTextMessage = async (event, env, requestUrl) => {
  const sourceUser = getSourceUser(event.source);
  const draft = composeDraftFromText(event.message.text || "");
  const postId = `line-${crypto.randomUUID()}`;
  await upsertPost(env, {
    ...draft,
    id: postId,
    source: "LINE",
    sourceUser,
    sourceDisplayName: "LINE投稿",
    status: "draft",
    publishedAt: todayKey(),
  });
  await setDraftSession(env, sourceUser, postId);
  const post = await getPost(env, requestUrl, postId);
  await replyToLine(event.replyToken, [buildDashboardMessage(post, env)], env);
};

const handleImageMessage = async (event, env, requestUrl) => {
  const sourceUser = getSourceUser(event.source);
  let post = await getActiveDraftForSource(env, requestUrl, sourceUser);
  if (!post) {
    const postId = `line-${crypto.randomUUID()}`;
    await upsertPost(env, {
      id: postId,
      source: "LINE",
      sourceUser,
      sourceDisplayName: "LINE投稿",
      status: "draft",
      category: "新着情報",
      title: `LINE画像投稿 ${todayKey()}`,
      excerpt: "LINEから写真が届きました。内容を確認して公開してください。",
      body: "LINEから写真が届きました。管理画面で本文を整えてから公開してください。",
      targetStores: ["本店", "髙橋店"],
      publishedAt: todayKey(),
      links: [],
    });
    await setDraftSession(env, sourceUser, postId);
    post = await getPost(env, requestUrl, postId);
  }

  const image = await storeLineImage(event, env, post.id);
  await addImageToPost(env, post.id, image);
  await setDraftSession(env, sourceUser, post.id);
  const nextPost = await getPost(env, requestUrl, post.id);
  await replyToLine(event.replyToken, [buildDashboardMessage(nextPost, env)], env);
};

const handleLineEvent = async (event, env, requestUrl) => {
  if (event.type !== "message") return;
  if (event.message?.type === "text") {
    await handleTextMessage(event, env, requestUrl);
    return;
  }
  if (event.message?.type === "image") {
    await handleImageMessage(event, env, requestUrl);
    return;
  }
  await replyToLine(event.replyToken, [{
    type: "text",
    text: "HP更新用BOTです。文章または写真を送ると、ダッシュボードに下書き保存します。",
  }], env);
};

const handleLineWebhook = async (request, env) => {
  const body = await readTextBody(request);
  const signature = request.headers.get("x-line-signature") || "";
  const valid = await verifyLineSignature(body, signature, env.LINE_CHANNEL_SECRET);
  if (!valid) {
    return jsonResponse({ ok: false, error: "invalid signature" }, 401, env);
  }

  const payload = JSON.parse(body);
  for (const event of payload.events || []) {
    await handleLineEvent(event, env, request.url);
  }
  return jsonResponse({ ok: true }, 200, env);
};

const handleAdminRequest = async (request, env) => {
  const url = new URL(request.url);
  const postMatch = url.pathname.match(/^\/api\/admin\/posts\/([^/]+)$/);
  const imageMatch = url.pathname.match(/^\/api\/admin\/posts\/([^/]+)\/images\/([^/]+)$/);

  if (request.method === "GET" && url.pathname === "/api/admin/posts") {
    const status = url.searchParams.get("status") || "all";
    const posts = await listPosts(env, request.url, status);
    return jsonResponse({ ok: true, posts }, 200, env);
  }

  if (request.method === "POST" && url.pathname === "/api/admin/posts") {
    const payload = await readJson(request);
    const postId = await upsertPost(env, payload);
    const post = await getPost(env, request.url, postId);
    return jsonResponse({ ok: true, post }, 201, env);
  }

  if (request.method === "PATCH" && postMatch) {
    const payload = await readJson(request);
    payload.id = decodeURIComponent(postMatch[1]);
    const postId = await upsertPost(env, payload);
    const post = await getPost(env, request.url, postId);
    return jsonResponse({ ok: true, post }, 200, env);
  }

  if (request.method === "DELETE" && postMatch) {
    const postId = decodeURIComponent(postMatch[1]);
    const existing = await getPost(env, request.url, postId);
    if (!existing) return jsonResponse({ ok: false, error: "post not found" }, 404, env);
    await upsertPost(env, { ...existing, status: "deleted", deletedAt: nowIso() });
    const post = await getPost(env, request.url, postId);
    return jsonResponse({ ok: true, post }, 200, env);
  }

  if (request.method === "DELETE" && imageMatch) {
    const postId = decodeURIComponent(imageMatch[1]);
    const imageId = decodeURIComponent(imageMatch[2]);
    const image = await env.DB.prepare(
      "SELECT * FROM post_images WHERE id = ? AND post_id = ?",
    ).bind(imageId, postId).first();
    if (image?.r2_key && env.MEDIA) {
      await env.MEDIA.delete(image.r2_key);
    }
    await env.DB.prepare("DELETE FROM post_images WHERE id = ? AND post_id = ?").bind(imageId, postId).run();
    const post = await getPost(env, request.url, postId);
    return jsonResponse({ ok: true, post }, 200, env);
  }

  return jsonResponse({ ok: false, error: "admin route not found" }, 404, env);
};
