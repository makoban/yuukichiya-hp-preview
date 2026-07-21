(() => {
  const root = document.querySelector("[data-product-dashboard]");
  if (!root) return;

  const apiBase = document.body.dataset.productsApiBase || "";
  const fallbackUrl = document.body.dataset.productsFallback || "assets/data/products.json";
  const storageKeys = {
    token: "yuukichiyaProductAdminSessionToken",
    draft: "yuukichiyaProductDashboardDraft",
  };
  const state = {
    token: sessionStorage.getItem(storageKeys.token) || "",
    products: [],
    baseline: [],
    selectedId: "",
    sampleMode: true,
    busy: false,
  };

  const query = (selector, parent = document) => parent.querySelector(selector);
  const queryAll = (selector, parent = document) => [...parent.querySelectorAll(selector)];
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const selectedProduct = () => state.products.find((product) => product.id === state.selectedId) || state.products[0] || null;
  const imageUrl = (url) => /^(https?:|data:|blob:)/.test(url || "") ? url : String(url || "").replace(/^\.\//, "");

  const setStatus = (message, tone = "info") => {
    const target = query("[data-product-status]");
    target.textContent = message;
    target.dataset.tone = tone;
  };

  const setBusy = (busy) => {
    state.busy = busy;
    queryAll("button, input[type='file']").forEach((control) => {
      if (control.matches("[data-product-token]")) return;
      control.disabled = busy;
    });
  };

  const normalizeProducts = (payload) => {
    const products = Array.isArray(payload) ? payload : payload.products || payload.items || [];
    return products
      .filter((product) => product?.id)
      .map((product, index) => ({
        id: product.id,
        status: product.status === "hidden" ? "hidden" : "published",
        sortOrder: Number(product.sortOrder || index + 1),
        title: String(product.title || "商品名未設定"),
        lead: String(product.lead || ""),
        features: Array.isArray(product.features) ? product.features.filter(Boolean).slice(0, 8) : [],
        targetStores: Array.isArray(product.targetStores) ? product.targetStores : ["本店", "髙橋店"],
        baseUrl: String(product.baseUrl || ""),
        images: (product.images || []).filter((image) => image?.url).map((image, imageIndex) => ({
          id: image.id || `image-${product.id}-${imageIndex + 1}`,
          url: image.url,
          alt: image.alt || product.title || "商品写真",
          sortOrder: Number(image.sortOrder || imageIndex + 1),
        })).sort((first, second) => first.sortOrder - second.sortOrder),
      }))
      .sort((first, second) => first.sortOrder - second.sortOrder);
  };

  const requestApi = async (path, options = {}) => {
    if (!apiBase) throw new Error("APIの接続先がありません");
    const headers = new Headers(options.headers || {});
    headers.set("accept", "application/json");
    if (!(options.body instanceof FormData)) headers.set("content-type", "application/json");
    if (state.token) headers.set("authorization", `Bearer ${state.token}`);
    const response = await fetch(`${apiBase.replace(/\/$/, "")}${path}`, { ...options, headers });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `接続エラー: ${response.status}`);
    return payload;
  };

  const loadFallback = async () => {
    const response = await fetch(fallbackUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`商品データを読み込めません: ${response.status}`);
    const payload = await response.json();
    const storedDraft = localStorage.getItem(storageKeys.draft);
    state.products = storedDraft ? normalizeProducts(JSON.parse(storedDraft)) : normalizeProducts(payload);
    state.baseline = clone(normalizeProducts(payload));
    state.sampleMode = true;
    if (!state.selectedId) state.selectedId = state.products[0]?.id || "";
    setStatus(storedDraft ? "この端末に保存した下書きを表示しています。" : "確認モードです。管理パスワードを入力すると公開できます。", "warn");
  };

  const loadRemote = async () => {
    const payload = await requestApi("/api/admin/products?status=all");
    state.products = normalizeProducts(payload);
    state.baseline = clone(state.products);
    state.sampleMode = false;
    if (!state.products.some((product) => product.id === state.selectedId)) state.selectedId = state.products[0]?.id || "";
    localStorage.removeItem(storageKeys.draft);
    setStatus("管理画面に接続しました。公開ボタンでHPへ反映できます。", "ok");
  };

  const updateSortOrders = () => {
    state.products.forEach((product, index) => { product.sortOrder = index + 1; });
  };

  const productFromForm = () => {
    const form = query("[data-product-form]");
    const product = selectedProduct();
    if (!form || !product) return product;
    const formData = new FormData(form);
    return {
      ...product,
      status: formData.get("status") === "hidden" ? "hidden" : "published",
      lead: String(formData.get("lead") || "").trim(),
      features: String(formData.get("features") || "")
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 8),
      targetStores: formData.getAll("targetStores"),
      baseUrl: String(formData.get("baseUrl") || "").trim(),
      images: product.images.map((image, index) => ({ ...image, sortOrder: index + 1 })),
    };
  };

  const applyFormToState = () => {
    const product = productFromForm();
    if (!product) return;
    const index = state.products.findIndex((item) => item.id === product.id);
    state.products[index] = product;
  };

  const renderProductList = () => {
    const target = query("[data-product-list]");
    target.replaceChildren();
    query("[data-product-count]").textContent = `${state.products.length}商品`;
    state.products.forEach((product, index) => {
      const item = document.createElement("article");
      item.className = "product-admin-list-item";
      item.classList.toggle("is-selected", product.id === state.selectedId);

      const select = document.createElement("button");
      select.type = "button";
      select.className = "product-admin-list-item__select";
      select.setAttribute("aria-label", `${product.title}を編集`);
      const image = document.createElement("img");
      image.src = imageUrl(product.images[0]?.url);
      image.alt = "";
      const copy = document.createElement("span");
      copy.className = "product-admin-list-item__copy";
      const title = document.createElement("strong");
      title.textContent = product.title;
      const meta = document.createElement("small");
      meta.textContent = `${product.status === "hidden" ? "非表示" : "表示中"}・写真${product.images.length}枚`;
      copy.append(title, meta);
      select.append(image, copy);
      select.addEventListener("click", () => {
        applyFormToState();
        state.selectedId = product.id;
        renderAll();
      });

      const actions = document.createElement("div");
      actions.className = "product-admin-list-item__actions";
      const up = document.createElement("button");
      up.type = "button";
      up.className = "product-admin-mini-button";
      up.textContent = "1つ上へ";
      up.disabled = index === 0;
      up.addEventListener("click", () => moveProduct(index, -1));
      const down = document.createElement("button");
      down.type = "button";
      down.className = "product-admin-mini-button";
      down.textContent = "1つ下へ";
      down.disabled = index === state.products.length - 1;
      down.addEventListener("click", () => moveProduct(index, 1));
      actions.append(up, down);
      item.append(select, actions);
      target.append(item);
    });
  };

  const fillForm = () => {
    const form = query("[data-product-form]");
    const product = selectedProduct();
    if (!form || !product) return;
    form.elements.id.value = product.id;
    form.elements.title.value = product.title;
    form.elements.status.value = product.status;
    form.elements.lead.value = product.lead;
    form.elements.features.value = product.features.join("\n");
    form.elements.baseUrl.value = product.baseUrl;
    queryAll("[name='targetStores']", form).forEach((input) => {
      input.checked = product.targetStores.includes(input.value);
    });
    query("[data-lead-count]").textContent = product.lead.length;
  };

  const renderImageList = () => {
    const target = query("[data-product-images]");
    const product = selectedProduct();
    target.replaceChildren();
    if (!product?.images.length) {
      const empty = document.createElement("p");
      empty.className = "product-admin-help";
      empty.textContent = "写真がありません。写真を追加してください。";
      target.append(empty);
      return;
    }

    product.images.forEach((item, index) => {
      const card = document.createElement("figure");
      card.className = "product-admin-image-card";
      const image = document.createElement("img");
      image.src = imageUrl(item.url);
      image.alt = item.alt || product.title;
      const alt = document.createElement("input");
      alt.type = "text";
      alt.value = item.alt || "";
      alt.maxLength = 80;
      alt.setAttribute("aria-label", `${index + 1}枚目の写真説明`);
      alt.addEventListener("input", () => {
        item.alt = alt.value;
        renderPreview(productFromForm());
      });
      const actions = document.createElement("div");
      actions.className = "product-admin-image-card__actions";
      const up = document.createElement("button");
      up.type = "button";
      up.className = "product-admin-image-button";
      up.textContent = "前へ";
      up.disabled = index === 0;
      up.addEventListener("click", () => moveImage(index, -1));
      const down = document.createElement("button");
      down.type = "button";
      down.className = "product-admin-image-button";
      down.textContent = "後ろへ";
      down.disabled = index === product.images.length - 1;
      down.addEventListener("click", () => moveImage(index, 1));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "product-admin-image-button is-danger";
      remove.textContent = "外す";
      remove.disabled = product.images.length === 1;
      remove.addEventListener("click", () => removeImage(item));
      actions.append(up, down, remove);
      card.append(image, alt, actions);
      target.append(card);
    });
  };

  const renderPreview = (product = productFromForm()) => {
    const target = query("[data-product-preview]");
    if (!product) return;
    target.replaceChildren();
    query("[data-preview-state]").textContent = product.status === "hidden" ? "非表示" : "表示する";

    const gallery = document.createElement("div");
    gallery.className = "product-admin-preview-card__gallery";
    product.images.slice(0, 4).forEach((item) => {
      const image = document.createElement("img");
      image.src = imageUrl(item.url);
      image.alt = item.alt || product.title;
      gallery.append(image);
    });

    const body = document.createElement("div");
    body.className = "product-admin-preview-card__body";
    const title = document.createElement("h3");
    title.textContent = product.title;
    const lead = document.createElement("p");
    lead.className = "product-admin-preview-card__lead";
    lead.textContent = product.lead || "短い紹介文が入ります。";
    const features = document.createElement("ul");
    features.className = "product-admin-preview-card__features";
    (product.features.length ? product.features : ["商品の特長が入ります。"]).forEach((feature) => {
      const item = document.createElement("li");
      item.textContent = feature;
      features.append(item);
    });
    const stores = document.createElement("p");
    stores.className = "product-admin-preview-card__stores";
    stores.textContent = product.targetStores.length ? `取扱店舗：${product.targetStores.join("・")}` : "取扱店舗：未選択";
    body.append(title, lead, features, stores);
    if (product.baseUrl) {
      const link = document.createElement("a");
      link.className = "product-admin-preview-card__link";
      link.href = product.baseUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "勇吉屋ネットで見る";
      body.append(link);
    }
    target.append(gallery, body);
  };

  const renderAll = () => {
    renderProductList();
    fillForm();
    renderImageList();
    renderPreview(selectedProduct());
  };

  const moveProduct = (index, direction) => {
    applyFormToState();
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= state.products.length) return;
    [state.products[index], state.products[nextIndex]] = [state.products[nextIndex], state.products[index]];
    updateSortOrders();
    renderAll();
    setStatus("並び順を変更しました。公開するまでHPは変わりません。", "info");
  };

  const moveImage = (index, direction) => {
    applyFormToState();
    const product = selectedProduct();
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= product.images.length) return;
    [product.images[index], product.images[nextIndex]] = [product.images[nextIndex], product.images[index]];
    product.images.forEach((item, imageIndex) => { item.sortOrder = imageIndex + 1; });
    renderImageList();
    renderPreview(product);
  };

  const removeImage = async (image) => {
    applyFormToState();
    const product = selectedProduct();
    if (!window.confirm("この写真を商品から外しますか？")) return;
    if (!state.sampleMode && !image.localOnly) {
      setBusy(true);
      try {
        const payload = await requestApi(`/api/admin/products/${encodeURIComponent(product.id)}/images/${encodeURIComponent(image.id)}`, { method: "DELETE" });
        const updated = normalizeProducts({ products: [payload.product] })[0];
        state.products[state.products.findIndex((item) => item.id === product.id)] = updated;
        state.baseline = clone(state.products);
        setStatus("写真を外しました。", "ok");
      } catch (error) {
        setStatus(`写真を外せませんでした：${error.message}`, "warn");
      } finally {
        setBusy(false);
      }
    } else {
      product.images = product.images.filter((item) => item.id !== image.id);
      setStatus("確認画面から写真を外しました。公開データは変わっていません。", "warn");
    }
    renderAll();
  };

  const fileToDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", reject);
    reader.readAsDataURL(file);
  });

  const addImages = async (files) => {
    applyFormToState();
    const product = selectedProduct();
    const available = 8 - product.images.length;
    const selected = [...files].slice(0, Math.max(0, available));
    if (!selected.length) {
      setStatus("写真は1商品につき最大8枚です。", "warn");
      return;
    }
    const invalid = selected.find((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024);
    if (invalid) {
      setStatus("写真はJPEG・PNG・WebP、1枚5MB以内にしてください。", "warn");
      return;
    }

    setBusy(true);
    try {
      if (state.sampleMode) {
        for (const file of selected) {
          product.images.push({
            id: `local-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            url: await fileToDataUrl(file),
            alt: `${product.title} 商品写真`,
            sortOrder: product.images.length + 1,
            localOnly: true,
          });
        }
        setStatus("写真を確認画面へ追加しました。管理画面へ接続すると本番保存できます。", "warn");
      } else {
        for (const file of selected) {
          const formData = new FormData();
          formData.append("image", file);
          formData.append("alt", `${product.title} 商品写真`);
          const payload = await requestApi(`/api/admin/products/${encodeURIComponent(product.id)}/images`, { method: "POST", body: formData });
          const updated = normalizeProducts({ products: [payload.product] })[0];
          state.products[state.products.findIndex((item) => item.id === product.id)] = updated;
        }
        state.baseline = clone(state.products);
        setStatus("写真を追加しました。", "ok");
      }
    } catch (error) {
      setStatus(`写真を追加できませんでした：${error.message}`, "warn");
    } finally {
      setBusy(false);
      query("[data-product-image-input]").value = "";
      renderAll();
    }
  };

  const validateProducts = () => {
    applyFormToState();
    for (const product of state.products) {
      if (!product.lead) return `${product.title}の紹介文を入力してください。`;
      if (!product.features.length) return `${product.title}の特長を1つ以上入力してください。`;
      if (!product.images.length) return `${product.title}の写真を1枚以上残してください。`;
      if (product.baseUrl && !/^https:\/\//.test(product.baseUrl)) return `${product.title}のBASE URLはhttps://から入力してください。`;
    }
    return "";
  };

  const saveDraft = () => {
    const error = validateProducts();
    if (error) return setStatus(error, "warn");
    try {
      localStorage.setItem(storageKeys.draft, JSON.stringify(state.products));
      setStatus("この端末に下書きを保存しました。HPはまだ変わっていません。", "ok");
    } catch {
      setStatus("下書き容量を超えました。追加した写真を減らしてください。", "warn");
    }
  };

  const publishProducts = async () => {
    const error = validateProducts();
    if (error) return setStatus(error, "warn");
    if (state.sampleMode) {
      setStatus("確認モードのため公開していません。管理パスワードで接続してください。", "warn");
      return;
    }
    if (!window.confirm("現在の内容を勇吉屋HPの商品一覧へ公開しますか？")) return;

    setBusy(true);
    try {
      for (const product of state.products) {
        await requestApi(`/api/admin/products/${encodeURIComponent(product.id)}`, {
          method: "PATCH",
          body: JSON.stringify(product),
        });
      }
      await loadRemote();
      renderAll();
      setStatus("商品一覧を公開しました。HPを再読み込みして確認してください。", "ok");
    } catch (publishError) {
      setStatus(`公開できませんでした：${publishError.message}`, "warn");
    } finally {
      setBusy(false);
    }
  };

  const resetChanges = () => {
    if (!window.confirm("保存していない変更を取り消しますか？")) return;
    state.products = clone(state.baseline);
    localStorage.removeItem(storageKeys.draft);
    if (!state.products.some((product) => product.id === state.selectedId)) state.selectedId = state.products[0]?.id || "";
    renderAll();
    setStatus("保存していない変更を取り消しました。", "info");
  };

  const connect = async () => {
    const token = query("[data-product-token]").value.trim();
    if (!token) return setStatus("管理パスワードを入力してください。", "warn");
    state.token = token;
    sessionStorage.setItem(storageKeys.token, token);
    setBusy(true);
    try {
      await loadRemote();
      renderAll();
      query("[data-product-token]").value = "";
    } catch (error) {
      sessionStorage.removeItem(storageKeys.token);
      state.token = "";
      setStatus(`接続できませんでした：${error.message}`, "warn");
    } finally {
      setBusy(false);
    }
  };

  const reload = async () => {
    setBusy(true);
    try {
      if (state.token) await loadRemote();
      else await loadFallback();
      renderAll();
    } catch (error) {
      setStatus(error.message, "warn");
    } finally {
      setBusy(false);
    }
  };

  query("[data-product-form]").addEventListener("input", () => {
    query("[data-lead-count]").textContent = query("[name='lead']").value.length;
    renderPreview(productFromForm());
  });
  query("[data-product-connect]").addEventListener("click", connect);
  query("[data-product-reload]").addEventListener("click", reload);
  query("[data-product-reset]").addEventListener("click", resetChanges);
  query("[data-product-draft]").addEventListener("click", saveDraft);
  query("[data-product-publish]").addEventListener("click", publishProducts);
  query("[data-product-image-input]").addEventListener("change", (event) => addImages(event.target.files));

  reload();
})();
