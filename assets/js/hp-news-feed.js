const feedTargets = document.querySelectorAll("[data-hp-news-feed]");

const newsFormatDate = (value) => {
  if (!value) return "";
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00+09:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
};

const newsResolveUrl = (url) => {
  if (!url) return "";
  if (/^https?:\/\//.test(url)) return url;
  return url.replace(/^\.\//, "");
};

const newsCreateElement = (tagName, className, text) => {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

const normalizeNewsItems = (payload) => {
  const items = payload.items || payload.posts || [];
  return items
    .filter((item) => item.status === "published")
    .sort((first, second) => String(second.publishedAt || "").localeCompare(String(first.publishedAt || "")));
};

const renderNewsImages = (item) => {
  const media = newsCreateElement("div", item.images?.length > 2 ? "notice__media notice__media--three" : "notice__media");
  (item.images || []).slice(0, 6).forEach((image) => {
    const anchor = document.createElement("a");
    anchor.href = newsResolveUrl(image.url);
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    const img = document.createElement("img");
    img.src = newsResolveUrl(image.url);
    img.alt = image.alt || item.title || "勇吉屋のお知らせ画像";
    img.loading = "lazy";
    img.decoding = "async";
    anchor.append(img);
    media.append(anchor);
  });
  return media;
};

const renderNewsItem = (item) => {
  const article = newsCreateElement("article", "notice live-notice");
  const copy = newsCreateElement("div", "notice__copy");
  copy.append(
    newsCreateElement("p", "integration-card-meta", `${item.category || "新着情報"} / ${newsFormatDate(item.publishedAt)}`),
    newsCreateElement("h3", "", item.title || "勇吉屋からのお知らせ"),
  );

  if (item.excerpt) copy.append(newsCreateElement("p", "", item.excerpt));
  if (item.body) copy.append(newsCreateElement("p", "", item.body));

  if (item.links?.length) {
    const actions = newsCreateElement("div", "notice-actions");
    item.links.forEach((link) => {
      const anchor = newsCreateElement("a", "text-link", link.label);
      anchor.href = newsResolveUrl(link.url);
      if (/^https?:\/\//.test(link.url)) {
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
      }
      actions.append(anchor);
    });
    copy.append(actions);
  }

  article.append(copy);
  if (item.images?.length) article.append(renderNewsImages(item));
  return article;
};

const renderNewsFeed = async (target) => {
  const feedUrl = target.dataset.newsFeed || window.yuukichiyaNewsFeedUrl || "";
  if (!feedUrl) return;

  const response = await fetch(feedUrl, { cache: "no-store" });
  if (!response.ok) throw new Error(`news feed error: ${response.status}`);
  const payload = await response.json();
  const items = normalizeNewsItems(payload);
  if (!items.length) return;

  target.replaceChildren(...items.map(renderNewsItem));
  target.hidden = false;
};

feedTargets.forEach((target) => {
  renderNewsFeed(target).catch(() => {
    target.hidden = true;
  });
});
