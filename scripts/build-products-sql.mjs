import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const payload = JSON.parse(await readFile(path.join(root, "assets/data/products.json"), "utf8"));
const timestamp = new Date().toISOString();

const sqlText = (value) => `'${String(value ?? "").replaceAll("'", "''")}'`;
const statements = [
  "PRAGMA foreign_keys = ON;",
];

for (const product of payload.items || []) {
  statements.push(`
INSERT INTO products (
  id, status, title, lead, features, target_stores, base_url,
  sort_order, created_at, updated_at
) VALUES (
  ${sqlText(product.id)},
  ${sqlText(product.status === "hidden" ? "hidden" : "published")},
  ${sqlText(product.title)},
  ${sqlText(product.lead)},
  ${sqlText(JSON.stringify(product.features || []))},
  ${sqlText(JSON.stringify(product.targetStores || []))},
  ${sqlText(product.baseUrl || "")},
  ${Number(product.sortOrder || 0)},
  ${sqlText(timestamp)},
  ${sqlText(timestamp)}
)
ON CONFLICT(id) DO NOTHING;`.trim());

  for (const image of product.images || []) {
    statements.push(`
INSERT INTO product_images (
  id, product_id, r2_key, url, content_type, alt, sort_order, created_at
) VALUES (
  ${sqlText(image.id)},
  ${sqlText(product.id)},
  '',
  ${sqlText(image.url)},
  '',
  ${sqlText(image.alt || product.title)},
  ${Number(image.sortOrder || 0)},
  ${sqlText(timestamp)}
)
ON CONFLICT(id) DO NOTHING;`.trim());
  }
}

process.stdout.write(`${statements.join("\n\n")}\n`);
