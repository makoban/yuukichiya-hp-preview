(() => {
  const list = document.querySelector(".product-list");
  if (!list) return;

  const apiUrl = document.body.dataset.productsApi || "";
  const fallbackUrl = document.body.dataset.productsFallback || "assets/data/products.json";

  const fetchJson = async (url) => {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`product feed error: ${response.status}`);
    return response.json();
  };

  const normalizeItems = (payload) => {
    const items = Array.isArray(payload) ? payload : payload.items || payload.products || [];
    return items
      .filter((item) => item && item.id && item.status !== "hidden")
      .sort((first, second) => Number(first.sortOrder || 0) - Number(second.sortOrder || 0));
  };

  const resolveImageUrl = (url) => {
    if (!url) return "";
    if (/^(https?:|data:|blob:)/.test(url)) return url;
    return url.replace(/^\.\//, "");
  };

  const createImage = (image, fallbackAlt) => {
    const img = document.createElement("img");
    img.src = resolveImageUrl(image.url);
    img.alt = image.alt || fallbackAlt;
    img.loading = "lazy";
    img.decoding = "async";
    return img;
  };

  const renderGallery = (target, product) => {
    const images = (product.images || [])
      .filter((image) => image?.url)
      .sort((first, second) => Number(first.sortOrder || 0) - Number(second.sortOrder || 0));
    if (!images.length) return;

    target.className = `product-gallery${images.length === 1 ? " product-gallery--single" : ""}${images.length > 6 ? " product-gallery--wide" : ""}`;
    target.setAttribute("aria-label", `${product.title}の写真`);
    target.replaceChildren();

    const mainFigure = document.createElement("figure");
    mainFigure.className = "product-gallery__main";
    const mainImage = createImage(images[0], product.title);
    mainImage.loading = "eager";
    mainFigure.append(mainImage);
    target.append(mainFigure);

    if (images.length < 2) return;
    const thumbs = document.createElement("div");
    thumbs.className = "product-gallery__thumbs";
    images.slice(1).forEach((image) => {
      const button = document.createElement("button");
      button.className = "product-gallery__thumb";
      button.type = "button";
      button.setAttribute("aria-label", `${image.alt || product.title}を大きく表示`);
      button.append(createImage(image, product.title));
      button.addEventListener("click", () => {
        const previous = { src: mainImage.src, alt: mainImage.alt };
        mainImage.src = resolveImageUrl(image.url);
        mainImage.alt = image.alt || product.title;
        const thumbImage = button.querySelector("img");
        thumbImage.src = previous.src;
        thumbImage.alt = previous.alt;
        button.setAttribute("aria-label", `${previous.alt}を大きく表示`);
      });
      thumbs.append(button);
    });
    target.append(thumbs);
  };

  const renderProduct = (article, product) => {
    const gallery = article.querySelector(".product-gallery");
    const title = article.querySelector("h2");
    const lead = article.querySelector(".lead");
    const featureList = article.querySelector(".clean-list");
    if (gallery) renderGallery(gallery, product);
    if (title) {
      title.replaceChildren();
      const phrase = document.createElement("span");
      phrase.className = "phrase-title";
      phrase.textContent = product.title;
      title.append(phrase);
    }
    if (lead) lead.textContent = product.lead || "";
    if (featureList) {
      featureList.replaceChildren();
      (product.features || []).filter(Boolean).forEach((feature) => {
        const item = document.createElement("li");
        item.textContent = feature;
        featureList.append(item);
      });
    }

    article.querySelector(".product-item__meta")?.remove();
    if ((product.targetStores || []).length || product.baseUrl) {
      const meta = document.createElement("div");
      meta.className = "product-item__meta";
      if ((product.targetStores || []).length) {
        const stores = document.createElement("p");
        stores.className = "product-item__stores";
        stores.textContent = `取扱店舗：${product.targetStores.join("・")}`;
        meta.append(stores);
      }
      if (product.baseUrl) {
        const link = document.createElement("a");
        link.className = "button product-item__base-link";
        link.href = product.baseUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "勇吉屋ネットで見る";
        meta.append(link);
      }
      article.lastElementChild.append(meta);
    }
  };

  const applyProducts = (items) => {
    const articles = new Map(
      [...list.querySelectorAll("[data-product-id]")].map((article) => [article.dataset.productId, article]),
    );
    items.forEach((product) => {
      const article = articles.get(product.id);
      if (!article) return;
      renderProduct(article, product);
      list.append(article);
      articles.delete(product.id);
    });
    articles.forEach((article) => { article.hidden = true; });
  };

  const loadProducts = async () => {
    let payload;
    try {
      payload = apiUrl ? await fetchJson(apiUrl) : null;
      if (!normalizeItems(payload).length) throw new Error("empty product feed");
    } catch {
      payload = await fetchJson(fallbackUrl);
    }
    applyProducts(normalizeItems(payload));
  };

  loadProducts().catch(() => {
    // The static HTML remains visible if both live and fallback feeds are unavailable.
  });
})();
