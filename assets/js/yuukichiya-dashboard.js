const dashboardRoot = document.querySelector("[data-dashboard-root]");
const sampleUrl = document.body.dataset.dashboardSample || "assets/data/dashboard-posts.sample.json";
const defaultApiBase = document.body.dataset.apiBase || "";
const storageKeys = {
  apiBase: "yuukichiyaDashboardApiBase",
  token: "yuukichiyaDashboardToken",
};

const state = {
  apiBase: localStorage.getItem(storageKeys.apiBase) || defaultApiBase,
  token: localStorage.getItem(storageKeys.token) || "",
  posts: [],
  selectedId: "",
  currentStatus: "draft",
  sampleMode: false,
};

const selectors = {
  apiBase: "[data-config-api-base]",
  token: "[data-config-token]",
  saveConfig: "[data-config-save]",
  testConfig: "[data-config-test]",
  reload: "[data-dashboard-reload]",
  status: "[data-dashboard-status]",
  tabs: "[data-dashboard-tab]",
  list: "[data-post-list]",
  empty: "[data-post-empty]",
  form: "[data-editor-form]",
  newPost: "[data-new-post]",
  savePost: "[data-save-post]",
  publishPost: "[data-publish-post]",
  deletePost: "[data-delete-post]",
  imageList: "[data-editor-images]",
  hpPreview: "[data-dashboard-hp-preview]",
  linePreview: "[data-dashboard-line-preview]",
  stats: "[data-dashboard-stats]",
};

const query = (selector) => document.querySelector(selector);
const queryAll = (selector) => [...document.querySelectorAll(selector)];

const createElement = (tagName, className, text) => {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00+09:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
};

const normalizeUrl = (value) => {
  if (!value) return "";
  if (/^https?:\/\//.test(value)) return value;
  return value.replace(/^\.\//, "");
};

const getStatusLabel = (status) => ({
  draft: "下書き",
  published: "公開中",
  deleted: "削除済み",
}[status] || status);

const getStoreLabels = (post) => (post.targetStores || []).join("・") || "全店舗";

const getPostsForTab = () => {
  if (state.currentStatus === "all") return state.posts;
  return state.posts.filter((post) => post.status === state.currentStatus);
};

const setStatusMessage = (message, tone = "info") => {
  const target = query(selectors.status);
  if (!target) return;
  target.textContent = message;
  target.dataset.tone = tone;
};

const parseLinks = (value) => value
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => {
    const [label, ...rest] = line.split("|");
    return {
      label: (label || "").trim(),
      url: rest.join("|").trim(),
    };
  })
  .filter((link) => link.label && link.url);

const stringifyLinks = (links = []) => links
  .map((link) => `${link.label}|${link.url}`)
  .join("\n");

const getSelectedPost = () => state.posts.find((post) => post.id === state.selectedId) || state.posts[0] || null;

const updatePostInState = (nextPost) => {
  const index = state.posts.findIndex((post) => post.id === nextPost.id);
  if (index >= 0) {
    state.posts[index] = nextPost;
  } else {
    state.posts.unshift(nextPost);
  }
  state.selectedId = nextPost.id;
};

const removePostFromState = (postId) => {
  state.posts = state.posts.map((post) => (
    post.id === postId
      ? { ...post, status: "deleted", deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      : post
  ));
};

const requestApi = async (path, options = {}) => {
  if (!state.apiBase) {
    throw new Error("API URLが未設定です");
  }

  const headers = new Headers(options.headers || {});
  headers.set("accept", "application/json");
  if (!(options.body instanceof FormData)) {
    headers.set("content-type", "application/json");
  }
  if (state.token) headers.set("authorization", `Bearer ${state.token}`);

  const response = await fetch(`${state.apiBase.replace(/\/$/, "")}${path}`, {
    ...options,
    headers,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `API error: ${response.status}`);
  }
  return payload;
};

const loadSamplePosts = async () => {
  const response = await fetch(sampleUrl, { cache: "no-store" });
  if (!response.ok) throw new Error(`sample error: ${response.status}`);
  const payload = await response.json();
  state.sampleMode = true;
  state.posts = payload.posts || [];
  setStatusMessage("API未接続のため、サンプルデータで表示しています。", "warn");
};

const loadPosts = async () => {
  try {
    if (!state.apiBase || !state.token) {
      await loadSamplePosts();
      return;
    }

    const payload = await requestApi("/api/admin/posts?status=all");
    state.sampleMode = false;
    state.posts = payload.posts || [];
    setStatusMessage("管理APIに接続しています。", "ok");
  } catch (error) {
    await loadSamplePosts();
    setStatusMessage(`API接続不可: ${error.message}。サンプル表示に切り替えました。`, "warn");
  }
};

const renderStats = () => {
  const target = query(selectors.stats);
  if (!target) return;
  const counts = state.posts.reduce((memo, post) => {
    memo[post.status] = (memo[post.status] || 0) + 1;
    return memo;
  }, {});

  target.replaceChildren(
    createElement("span", "", `下書き ${counts.draft || 0}`),
    createElement("span", "", `公開中 ${counts.published || 0}`),
    createElement("span", "", `削除済み ${counts.deleted || 0}`),
  );
};

const renderTabs = () => {
  queryAll(selectors.tabs).forEach((button) => {
    button.classList.toggle("is-active", button.dataset.dashboardTab === state.currentStatus);
  });
};

const renderPostList = () => {
  const target = query(selectors.list);
  const empty = query(selectors.empty);
  if (!target) return;

  const posts = getPostsForTab();
  target.replaceChildren();
  if (empty) empty.hidden = posts.length > 0;

  posts.forEach((post) => {
    const button = createElement("button", "dashboard-post-list__item");
    button.type = "button";
    button.classList.toggle("is-selected", post.id === state.selectedId);
    button.innerHTML = `
      <span class="dashboard-post-list__meta">${getStatusLabel(post.status)} / ${formatDate(post.publishedAt)}</span>
      <strong></strong>
      <span class="dashboard-post-list__excerpt"></span>
      <span class="dashboard-post-list__foot">${getStoreLabels(post)} / 画像 ${(post.images || []).length}枚</span>
    `;
    button.querySelector("strong").textContent = post.title || "無題の投稿";
    button.querySelector(".dashboard-post-list__excerpt").textContent = post.excerpt || post.body || "";
    button.addEventListener("click", () => {
      state.selectedId = post.id;
      renderDashboard();
    });
    target.append(button);
  });
};

const fillEditor = (post) => {
  const form = query(selectors.form);
  if (!form || !post) return;

  form.elements.id.value = post.id || "";
  form.elements.title.value = post.title || "";
  form.elements.category.value = post.category || "新着情報";
  form.elements.publishedAt.value = (post.publishedAt || "").slice(0, 10);
  form.elements.status.value = post.status || "draft";
  form.elements.excerpt.value = post.excerpt || "";
  form.elements.body.value = post.body || "";
  form.elements.links.value = stringifyLinks(post.links || []);
  form.querySelectorAll("[name='targetStores']").forEach((input) => {
    input.checked = (post.targetStores || []).includes(input.value);
  });
};

const renderImages = (post) => {
  const target = query(selectors.imageList);
  if (!target) return;
  target.replaceChildren();

  const images = post?.images || [];
  if (!images.length) {
    target.append(createElement("p", "dashboard-empty-note", "LINEから写真が届くとここに並びます。"));
    return;
  }

  images
    .slice()
    .sort((first, second) => (first.sortOrder || 0) - (second.sortOrder || 0))
    .forEach((image) => {
      const card = createElement("figure", "dashboard-image-card");
      const anchor = document.createElement("a");
      anchor.href = normalizeUrl(image.url);
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      const img = document.createElement("img");
      img.src = normalizeUrl(image.url);
      img.alt = image.alt || post.title || "投稿画像";
      img.loading = "lazy";
      img.decoding = "async";
      anchor.append(img);

      const caption = createElement("figcaption", "", image.alt || "投稿画像");
      const remove = createElement("button", "dashboard-link-button", "画像を外す");
      remove.type = "button";
      remove.addEventListener("click", async () => {
        await removeImage(post.id, image.id);
      });

      card.append(anchor, caption, remove);
      target.append(card);
    });
};

const renderHpPreview = (post) => {
  const target = query(selectors.hpPreview);
  if (!target || !post) return;
  target.replaceChildren();

  const article = createElement("article", "notice dashboard-preview-notice");
  const copy = createElement("div", "notice__copy");
  copy.append(
    createElement("p", "integration-card-meta", `${post.category || "新着情報"} / ${formatDate(post.publishedAt)}`),
    createElement("h3", "", post.title || "無題の投稿"),
    createElement("p", "", post.excerpt || ""),
    createElement("p", "", post.body || ""),
  );

  if (post.links?.length) {
    const actions = createElement("div", "notice-actions");
    post.links.forEach((link) => {
      const anchor = createElement("a", "text-link", link.label);
      anchor.href = normalizeUrl(link.url);
      if (/^https?:\/\//.test(link.url)) {
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
      }
      actions.append(anchor);
    });
    copy.append(actions);
  }

  const media = createElement("div", post.images?.length > 2 ? "notice__media notice__media--three" : "notice__media");
  (post.images || []).slice(0, 6).forEach((image) => {
    const anchor = document.createElement("a");
    anchor.href = normalizeUrl(image.url);
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    const img = document.createElement("img");
    img.src = normalizeUrl(image.url);
    img.alt = image.alt || post.title || "投稿画像";
    img.loading = "lazy";
    img.decoding = "async";
    anchor.append(img);
    media.append(anchor);
  });

  article.append(copy, media);
  target.append(article);
};

const renderLinePreview = (post) => {
  const target = query(selectors.linePreview);
  if (!target || !post) return;
  target.replaceChildren();

  const intro = createElement("div", "line-message line-message--bot", "LINEから届いた内容を下書きにしました。");
  const card = createElement("article", "line-bubble-card");
  const mainImage = post.images?.[0];
  if (mainImage) {
    const img = document.createElement("img");
    img.src = normalizeUrl(mainImage.url);
    img.alt = mainImage.alt || post.title || "投稿画像";
    img.loading = "lazy";
    img.decoding = "async";
    card.append(img);
  }

  const body = createElement("div", "line-bubble-card__body");
  body.append(
    createElement("p", "line-bubble-card__date", formatDate(post.publishedAt)),
    createElement("h4", "", post.title || "無題の投稿"),
    createElement("p", "", post.excerpt || post.body || ""),
  );
  card.append(body);

  const imageCount = createElement("div", "line-message line-message--bot", `画像 ${(post.images || []).length}枚 / ${getStatusLabel(post.status)}`);
  target.append(intro, card, imageCount);
};

const getPostFromForm = () => {
  const form = query(selectors.form);
  const formData = new FormData(form);
  const stores = formData.getAll("targetStores");
  const current = getSelectedPost() || {};

  return {
    ...current,
    id: formData.get("id") || current.id,
    title: formData.get("title").trim(),
    category: formData.get("category"),
    publishedAt: formData.get("publishedAt"),
    status: formData.get("status"),
    excerpt: formData.get("excerpt").trim(),
    body: formData.get("body").trim(),
    targetStores: stores.length ? stores : ["本店", "髙橋店"],
    links: parseLinks(formData.get("links") || ""),
    updatedAt: new Date().toISOString(),
  };
};

const savePost = async (statusOverride = "") => {
  const nextPost = getPostFromForm();
  if (statusOverride) nextPost.status = statusOverride;

  if (!nextPost.title || !nextPost.body) {
    setStatusMessage("タイトルと本文を入力してください。", "warn");
    return;
  }

  if (state.sampleMode) {
    updatePostInState(nextPost);
    setStatusMessage("サンプル表示のため、画面上だけで保存しました。", "warn");
    renderDashboard();
    return;
  }

  try {
    const payload = await requestApi(`/api/admin/posts/${encodeURIComponent(nextPost.id)}`, {
      method: "PATCH",
      body: JSON.stringify(nextPost),
    });
    updatePostInState(payload.post);
    setStatusMessage(statusOverride === "published" ? "HP公開用フィードへ反映しました。" : "下書きを保存しました。", "ok");
    renderDashboard();
  } catch (error) {
    setStatusMessage(`保存できませんでした: ${error.message}`, "warn");
  }
};

const deletePost = async () => {
  const post = getSelectedPost();
  if (!post) return;

  if (state.sampleMode) {
    removePostFromState(post.id);
    setStatusMessage("サンプル表示のため、画面上だけで削除扱いにしました。", "warn");
    renderDashboard();
    return;
  }

  try {
    const payload = await requestApi(`/api/admin/posts/${encodeURIComponent(post.id)}`, { method: "DELETE" });
    updatePostInState(payload.post);
    setStatusMessage("投稿を削除済みにしました。", "ok");
    renderDashboard();
  } catch (error) {
    setStatusMessage(`削除できませんでした: ${error.message}`, "warn");
  }
};

const removeImage = async (postId, imageId) => {
  if (state.sampleMode) {
    const post = getSelectedPost();
    updatePostInState({ ...post, images: (post.images || []).filter((image) => image.id !== imageId) });
    setStatusMessage("サンプル表示のため、画面上だけで画像を外しました。", "warn");
    renderDashboard();
    return;
  }

  try {
    const payload = await requestApi(`/api/admin/posts/${encodeURIComponent(postId)}/images/${encodeURIComponent(imageId)}`, {
      method: "DELETE",
    });
    updatePostInState(payload.post);
    setStatusMessage("画像を外しました。", "ok");
    renderDashboard();
  } catch (error) {
    setStatusMessage(`画像を外せませんでした: ${error.message}`, "warn");
  }
};

const createNewPost = async () => {
  const now = new Date();
  const newPost = {
    id: `manual-${now.getTime()}`,
    source: "dashboard",
    sourceDisplayName: "管理画面",
    status: "draft",
    category: "新着情報",
    publishedAt: now.toISOString().slice(0, 10),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    title: "新しいお知らせ",
    excerpt: "",
    body: "本文を入力してください。",
    targetStores: ["本店", "髙橋店"],
    images: [],
    links: [],
  };

  if (!state.sampleMode && state.apiBase && state.token) {
    try {
      const payload = await requestApi("/api/admin/posts", {
        method: "POST",
        body: JSON.stringify(newPost),
      });
      updatePostInState(payload.post);
    } catch (error) {
      updatePostInState(newPost);
      setStatusMessage(`API作成不可: ${error.message}`, "warn");
    }
  } else {
    updatePostInState(newPost);
  }

  state.currentStatus = "draft";
  renderDashboard();
};

const saveConfig = () => {
  state.apiBase = query(selectors.apiBase).value.trim();
  state.token = query(selectors.token).value.trim();
  localStorage.setItem(storageKeys.apiBase, state.apiBase);
  localStorage.setItem(storageKeys.token, state.token);
  setStatusMessage("接続設定を保存しました。", "ok");
};

const testConfig = async () => {
  saveConfig();
  try {
    const payload = await requestApi("/health");
    setStatusMessage(`接続OK: ${payload.service || "yuukichiya-dashboard-api"}`, "ok");
  } catch (error) {
    setStatusMessage(`接続NG: ${error.message}`, "warn");
  }
};

const renderDashboard = () => {
  if (!state.selectedId && state.posts.length) state.selectedId = state.posts[0].id;
  const selected = getSelectedPost();

  renderStats();
  renderTabs();
  renderPostList();
  fillEditor(selected);
  renderImages(selected);
  renderHpPreview(selected);
  renderLinePreview(selected);
};

const bindEvents = () => {
  query(selectors.apiBase).value = state.apiBase;
  query(selectors.token).value = state.token;

  query(selectors.saveConfig)?.addEventListener("click", saveConfig);
  query(selectors.testConfig)?.addEventListener("click", testConfig);
  query(selectors.reload)?.addEventListener("click", async () => {
    saveConfig();
    await loadPosts();
    renderDashboard();
  });
  query(selectors.newPost)?.addEventListener("click", createNewPost);
  query(selectors.savePost)?.addEventListener("click", () => savePost());
  query(selectors.publishPost)?.addEventListener("click", () => savePost("published"));
  query(selectors.deletePost)?.addEventListener("click", deletePost);

  queryAll(selectors.tabs).forEach((button) => {
    button.addEventListener("click", () => {
      state.currentStatus = button.dataset.dashboardTab;
      const posts = getPostsForTab();
      state.selectedId = posts[0]?.id || state.posts[0]?.id || "";
      renderDashboard();
    });
  });

  query(selectors.form)?.addEventListener("input", () => {
    const post = getPostFromForm();
    renderHpPreview(post);
    renderLinePreview(post);
  });
};

if (dashboardRoot) {
  bindEvents();
  loadPosts().then(renderDashboard).catch((error) => {
    setStatusMessage(`読み込みできませんでした: ${error.message}`, "warn");
  });
}
