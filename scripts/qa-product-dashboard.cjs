const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const data = JSON.parse(read("assets/data/products.json"));
const productsHtml = read("products.html");
const dashboardHtml = read("product-dashboard.html");
const dashboardJs = read("assets/js/product-dashboard.js");
const workerJs = read("cloudflare/src/index.js");

const failures = [];
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

assert(data.schemaVersion === "2026-07-21.yuukichiya-products.v1", "unexpected schema version");
assert(Array.isArray(data.items) && data.items.length === 8, "expected the fixed 8 product groups");

const ids = new Set();
for (const product of data.items || []) {
  assert(product.id && !ids.has(product.id), `duplicate or missing product id: ${product.id}`);
  ids.add(product.id);
  assert(product.title && product.title.length <= 80, `${product.id}: invalid title`);
  assert(product.lead && product.lead.length <= 220, `${product.id}: invalid lead`);
  assert(Array.isArray(product.features) && product.features.length >= 1 && product.features.length <= 8, `${product.id}: invalid features`);
  assert(Array.isArray(product.images) && product.images.length >= 1 && product.images.length <= 8, `${product.id}: invalid images`);
  assert(["published", "hidden"].includes(product.status), `${product.id}: invalid status`);
  assert(productsHtml.includes(`data-product-id="${product.id}"`), `${product.id}: missing product HTML anchor`);
}

assert(dashboardHtml.includes('name="title" readonly'), "product title must remain read-only");
assert(dashboardHtml.includes('name="baseUrl"'), "BASE URL field is missing");
assert(dashboardHtml.includes('name="targetStores"'), "store selector is missing");
assert(!/ghp_|github_pat|ADMIN_TOKEN\s*=/.test(`${dashboardHtml}\n${dashboardJs}`), "secret-like value found in dashboard source");
assert(dashboardJs.includes("sessionStorage.getItem"), "session-only password storage is missing");
assert(!dashboardJs.includes("localStorage.setItem(storageKeys.token"), "admin password must not use localStorage");
assert(workerJs.includes('url.pathname === "/api/products"'), "public products API is missing");
assert(workerJs.includes('url.pathname === "/api/admin/products"'), "admin products API is missing");
assert(workerJs.includes("MAX_PRODUCT_IMAGE_BYTES"), "product image size limit is missing");

if (failures.length) {
  failures.forEach((failure) => console.error(`FAIL: ${failure}`));
  process.exit(1);
}

console.log(`PASS: ${data.items.length} products, restricted fields, session-only password, public/admin API and image limits verified.`);
