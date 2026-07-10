const YUUKICHIYA_NEWS_API_BASE =
  window.yuukichiyaNewsApiBase || "https://kokotomo-sns.bantex.jp/api/public/hp-news/yuukichiya";
const DEFAULT_NEWS_LIMIT = 3;

const newsFormatDate = (value) => {
  if (!value) return "";
  const date = new Date(String(value).includes("T") ? value : `${value}T00:00:00+09:00`);
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
  const source = Array.isArray(payload)
    ? payload
    : payload.latest || payload.items || payload.posts || [];
  return source
    .filter((item) => !item.status || item.status === "published")
    .sort((first, second) => String(second.publishedAt || "").localeCompare(String(first.publishedAt || "")));
};

const newsFetchJson = async (url) => {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`news feed error: ${response.status}`);
  return response.json();
};

const renderNewsImages = (item) => {
  if (!item.images?.length) return null;
  const media = newsCreateElement(
    "div",
    item.images.length > 2 ? "notice__media notice__media--three" : "notice__media",
  );
  item.images.slice(0, 6).forEach((image) => {
    const url = newsResolveUrl(image.url);
    if (!url) return;
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    const img = document.createElement("img");
    img.src = url;
    img.alt = image.alt || item.title || "勇吉屋のお知らせ画像";
    img.loading = "eager";
    img.fetchPriority = "low";
    img.decoding = "async";
    anchor.append(img);
    media.append(anchor);
  });
  return media.childElementCount ? media : null;
};

const appendNewsParagraphs = (copy, text) => {
  String(text || "")
    .split(/\n{1,}/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => copy.append(newsCreateElement("p", "", line)));
};

const renderNewsItem = (item) => {
  const article = newsCreateElement("article", "notice live-notice");
  const copy = newsCreateElement("div", "notice__copy");
  const metaText = [item.category || "新着情報", newsFormatDate(item.publishedAt)]
    .filter(Boolean)
    .join(" / ");
  if (metaText) copy.append(newsCreateElement("p", "integration-card-meta", metaText));
  copy.append(newsCreateElement("h3", "", item.title || "勇吉屋からのお知らせ"));

  if (item.eventDateText || item.venue) {
    const detail = newsCreateElement("p", "notice__details");
    detail.textContent = [item.eventDateText, item.venue].filter(Boolean).join(" / ");
    copy.append(detail);
  }

  if (item.body) {
    appendNewsParagraphs(copy, item.body);
  } else if (item.excerpt) {
    copy.append(newsCreateElement("p", "", item.excerpt));
  }

  if (item.links?.length) {
    const actions = newsCreateElement("div", "notice-actions");
    item.links.forEach((link) => {
      const url = newsResolveUrl(link.url);
      if (!url) return;
      const anchor = newsCreateElement("a", "text-link", link.label || "詳しく見る");
      anchor.href = url;
      if (/^https?:\/\//.test(url)) {
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
      }
      actions.append(anchor);
    });
    if (actions.childElementCount) copy.append(actions);
  }

  article.append(copy);
  const media = renderNewsImages(item);
  if (media) article.append(media);
  return article;
};

const findFallbackList = (target) => {
  const selector = target.dataset.newsFallback;
  if (selector) return document.querySelector(selector);
  const next = target.nextElementSibling;
  return next?.matches(".notice-list") ? next : null;
};

const renderLatestNewsFeed = async (target) => {
  const feedUrl = target.dataset.newsFeed || `${YUUKICHIYA_NEWS_API_BASE}/latest.json`;
  const fallback = findFallbackList(target);
  const limit = Number.parseInt(target.dataset.newsLimit || `${DEFAULT_NEWS_LIMIT}`, 10) || DEFAULT_NEWS_LIMIT;
  const payload = await newsFetchJson(feedUrl);
  const items = normalizeNewsItems(payload).slice(0, limit);
  if (!items.length) throw new Error("news feed empty");

  target.replaceChildren(...items.map(renderNewsItem));
  target.hidden = false;
  if (fallback) fallback.hidden = true;
};

const archiveUrlWithPage = (url, page) => {
  const parsed = new URL(url, window.location.href);
  parsed.searchParams.set("page", String(page));
  return parsed.toString();
};

const currentArchivePage = () => {
  const page = Number.parseInt(new URLSearchParams(window.location.search).get("page") || "1", 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
};

const archivePageHref = (page) => `news.html?page=${page}`;

const renderArchivePagerControl = ({ label, page, disabled = false, current = false, className = "" }) => {
  const element = newsCreateElement(
    disabled || current ? "span" : "a",
    `${className}${disabled ? " is-disabled" : ""}${current ? " is-current" : ""}`,
    label,
  );
  if (disabled) element.setAttribute("aria-disabled", "true");
  if (current) element.setAttribute("aria-current", "page");
  if (!disabled && !current) element.href = archivePageHref(page);
  return element;
};

const renderArchivePager = (payload, page) => {
  const totalPages = Math.min(10, Math.max(1, Number.parseInt(payload.totalPages || "1", 10) || 1));
  const resolvedPage = Math.min(totalPages, Math.max(1, Number.parseInt(page || "1", 10) || 1));
  if (totalPages <= 1) return null;

  const pager = newsCreateElement("nav", "news-pager");
  pager.setAttribute("aria-label", "過去のお知らせページ");
  const prev = renderArchivePagerControl({
    label: "← 前へ",
    page: resolvedPage - 1,
    disabled: resolvedPage === 1,
    className: "news-pager__control",
  });
  const pages = newsCreateElement("div", "news-pager__pages");
  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    pages.append(renderArchivePagerControl({
      label: String(pageNumber),
      page: pageNumber,
      current: pageNumber === resolvedPage,
      className: "news-pager__page",
    }));
  }
  const next = renderArchivePagerControl({
    label: "次へ →",
    page: resolvedPage + 1,
    disabled: resolvedPage === totalPages,
    className: "news-pager__control",
  });
  pager.append(prev, pages, next);
  return pager;
};

const renderArchiveNewsFeed = async (target) => {
  const requestedPage = currentArchivePage();
  const feedUrl = archiveUrlWithPage(target.dataset.newsArchive || `${YUUKICHIYA_NEWS_API_BASE}/archive.json`, requestedPage);
  const payload = await newsFetchJson(feedUrl);
  const page = Math.max(1, Number.parseInt(payload.page || `${requestedPage}`, 10) || 1);
  const pageSize = Math.max(1, Number.parseInt(payload.pageSize || "3", 10) || 3);
  const items = normalizeNewsItems(payload).slice(0, pageSize);
  if (page !== requestedPage) {
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set("page", String(page));
    window.history.replaceState({}, "", currentUrl);
  }
  if (!items.length) {
    const empty = newsCreateElement("div", "notice news-empty");
    empty.append(
      newsCreateElement("h3", "", page === 1 ? "過去のお知らせはまだありません" : "このページのお知らせはありません"),
      newsCreateElement("p", "", "最新のお知らせはトップページの新着情報に表示されます。"),
    );
    target.replaceChildren(empty);
    target.hidden = false;
    return;
  }

  const children = items.map(renderNewsItem);
  const pager = renderArchivePager(payload, page);
  if (pager) children.push(pager);
  target.replaceChildren(...children);
  target.hidden = false;
};

document.querySelectorAll("[data-hp-news-feed]").forEach((target) => {
  renderLatestNewsFeed(target).catch(() => {
    target.hidden = true;
    const fallback = findFallbackList(target);
    if (fallback) fallback.hidden = false;
  });
});

document.querySelectorAll("[data-hp-news-archive]").forEach((target) => {
  renderArchiveNewsFeed(target).catch(() => {
    target.hidden = false;
    const empty = newsCreateElement("div", "notice news-empty");
    empty.append(
      newsCreateElement("h3", "", "過去のお知らせを読み込めませんでした"),
      newsCreateElement("p", "", "時間をおいて再度ご確認ください。"),
    );
    target.replaceChildren(empty);
  });
});
