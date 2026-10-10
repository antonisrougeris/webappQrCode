import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const CSS_VERSION = "20261010-qr-ui-2";

export function versionStylesheetLinks(html, version = CSS_VERSION) {
  return html.replace(
    /(<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["'])([^"']+)(["'][^>]*>)/gi,
    (whole, opening, href, closing) => {
      if (!/\.css(?:[?#]|$)/i.test(href) || /^(?:https?:)?\/\//i.test(href)) {
        return whole;
      }
      const [pathname, fragment = ""] = href.split("#", 2);
      const clean = pathname.split("?")[0];
      return `${opening}${clean}?v=${version}${fragment ? `#${fragment}` : ""}${closing}`;
    }
  );
}

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const name = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(name));
    else if (entry.isFile() && name.endsWith(".html")) files.push(name);
  }
  return files;
}

async function main() {
  const dist = path.resolve("dist");
  const htmlFiles = await walk(dist);
  if (!htmlFiles.length) throw new Error("No built HTML files found");
  let changed = 0;
  for (const file of htmlFiles) {
    const previous = await fs.readFile(file, "utf8");
    const next = versionStylesheetLinks(previous);
    if (next !== previous) {
      await fs.writeFile(file, next, "utf8");
      changed++;
    }
  }
  console.log(`CSS cache-buster ${CSS_VERSION}: updated ${changed}/${htmlFiles.length} HTML pages`);
  if (!changed) throw new Error("No CSS references were refreshed");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
