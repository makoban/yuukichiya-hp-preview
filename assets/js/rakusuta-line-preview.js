const feedUrl = document.body.dataset.rakusutaFeed || "assets/data/rakusuta-news.sample.json";
const siteBaseUrl = "https://makoban.github.io/yuukichiya-hp-preview/";

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00+09:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const resolveUrl = (url) => {
  if (!url) return "";
  if (/^https?:\/\//.test(url)) return url;
  return url.replace(/^\.\//, "");
};

const absoluteUrl = (url) => {
  if (!url) return "";
  if (/^https?:\/\//.test(url)) return url;
  return new URL(resolveUrl(url), siteBaseUrl).toString();
};

const createElement = (tagName, className, text) => {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
};

const getMainImage = (item) => item.images?.find((image) => image.role === "main") || item.images?.[0];

const renderImageStrip = (item) => {
  const strip = createElement("div", "integration-image-strip");
  (item.images || []).slice(0, 4).forEach((image) => {
    const img = document.createElement("img");
    img.src = resolveUrl(image.url);
    img.alt = image.alt || item.title;
    img.loading = "eager";
    img.decoding = "async";
    strip.append(img);
  });
  return strip;
};

const renderHpNewsPreview = (feed) => {
  const target = document.querySelector("[data-rakusuta-hp-preview]");
  if (!target) return;
  target.replaceChildren();

  feed.items
    .filter((item) => item.status === "published")
    .forEach((item) => {
      const article = createElement("article", "notice integration-news-card");

      const copy = createElement("div", "notice__copy");
      const meta = createElement("p", "integration-card-meta", `${item.category} / ${formatDate(item.publishedAt)}`);
      const title = createElement("h3", "", item.title);
      const excerpt = createElement("p", "", item.excerpt);
      const body = createElement("p", "", item.body);
      copy.append(meta, title, excerpt, body);

      if (item.links?.length) {
        const actions = createElement("div", "notice-actions");
        item.links.forEach((link) => {
          const anchor = createElement("a", "text-link", link.label);
          anchor.href = link.url;
          if (/^https?:\/\//.test(link.url)) {
            anchor.target = "_blank";
            anchor.rel = "noopener noreferrer";
          }
          actions.append(anchor);
        });
        copy.append(actions);
      }

      article.append(copy, renderImageStrip(item));
      target.append(article);
    });
};

const renderLineBubble = (item) => {
  const bubble = createElement("article", "line-bubble-card");
  const mainImage = getMainImage(item);
  if (mainImage) {
    const img = document.createElement("img");
    img.src = resolveUrl(mainImage.url);
    img.alt = mainImage.alt || item.title;
    img.loading = "eager";
    img.decoding = "async";
    bubble.append(img);
  }

  const body = createElement("div", "line-bubble-card__body");
  body.append(
    createElement("p", "line-bubble-card__date", formatDate(item.publishedAt)),
    createElement("h4", "", item.title),
    createElement("p", "", item.excerpt),
  );

  if (item.links?.length) {
    const actions = createElement("div", "line-bubble-card__actions");
    item.links.slice(0, 2).forEach((link) => {
      const anchor = createElement("a", "", link.label);
      anchor.href = link.url;
      if (/^https?:\/\//.test(link.url)) {
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
      }
      actions.append(anchor);
    });
    body.append(actions);
  }

  bubble.append(body);
  return bubble;
};

const renderLinePreview = (feed) => {
  const target = document.querySelector("[data-line-chat-preview]");
  if (!target) return;
  target.replaceChildren();

  const intro = createElement("div", "line-message line-message--bot");
  intro.textContent = "勇吉屋の新着情報です。楽スタHPの投稿画像をLINEにも同じ内容で表示できます。";
  target.append(intro);

  feed.items
    .filter((item) => item.status === "published" && item.line?.enabled)
    .forEach((item, index) => {
      const image = getMainImage(item);
      if (image && index === 0) {
        const imageMessage = createElement("figure", "line-image-message");
        const img = document.createElement("img");
        img.src = resolveUrl(image.url);
        img.alt = image.alt || item.title;
        img.loading = "eager";
        img.decoding = "async";
        imageMessage.append(img, createElement("figcaption", "", "画像メッセージとして大きく表示"));
        target.append(imageMessage);
      }

      target.append(renderLineBubble(item));
    });
};

const buildLineFlexSample = (feed) => {
  const bubbles = feed.items
    .filter((item) => item.status === "published" && item.line?.enabled)
    .slice(0, 3)
    .map((item) => {
      const image = getMainImage(item);
      return {
        type: "bubble",
        hero: image ? {
          type: "image",
          url: absoluteUrl(image.url),
          size: "full",
          aspectRatio: "20:13",
          aspectMode: "cover",
        } : undefined,
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            { type: "text", text: item.title, weight: "bold", wrap: true },
            { type: "text", text: item.excerpt, wrap: true, size: "sm", color: "#596372" },
          ],
        },
        footer: {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: (item.links || []).slice(0, 2).map((link) => ({
            type: "button",
            style: "primary",
            action: {
              type: "uri",
              label: link.label,
              uri: absoluteUrl(link.url),
            },
          })),
        },
      };
    });

  return {
    type: "flex",
    altText: "勇吉屋の新着情報",
    contents: {
      type: "carousel",
      contents: bubbles,
    },
  };
};

const renderPayloadPreview = (feed) => {
  const target = document.querySelector("[data-line-payload-preview]");
  if (!target) return;
  target.textContent = JSON.stringify(buildLineFlexSample(feed), null, 2);
};

const renderSourceSummary = (feed) => {
  const target = document.querySelector("[data-feed-summary]");
  if (!target) return;
  target.textContent = `${feed.source.name} / ${feed.source.mode} / ${feed.items.length}件 / ${feed.source.updatedAt}`;
};

fetch(feedUrl, { cache: "no-store" })
  .then((response) => {
    if (!response.ok) throw new Error(`feed error: ${response.status}`);
    return response.json();
  })
  .then((feed) => {
    renderSourceSummary(feed);
    renderHpNewsPreview(feed);
    renderLinePreview(feed);
    renderPayloadPreview(feed);
  })
  .catch((error) => {
    document.querySelectorAll("[data-integration-error]").forEach((target) => {
      target.hidden = false;
      target.textContent = `連携プレビューを読み込めませんでした: ${error.message}`;
    });
  });
