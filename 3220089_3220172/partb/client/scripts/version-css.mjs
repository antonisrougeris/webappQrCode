import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

/**
 * Production static CSS is cached for a long time by the web server.
 * Never recycle a URL for different stylesheet bytes.
 *
 * Vite fingerprints imported CSS already. This script handles the separate
 * public/assets/css/*.css files, AFTER prerendering and Greek page generation.
 */
export function fingerprintedStylesheetName(fileName, cssBytes) {
  const hash = createHash("sha256").update(cssBytes).digest("hex").slice(0, 12);
  return fileName.replace(/\.css$/i, `.${hash}.css`);
}

/**
 * Rewrites local /assets/css/ URLs to physical fingerprinted file paths.
 * All old ?v= query strings are removed. Works with either link-attribute order.
 * External CSS and Vite-generated /assets/*.css URLs stay untouched.
 */
export function versionStylesheetLinks(html, fingerprints) {
  return html.replace(/<link\b[^>]*>/gi, (linkTag) => {
    if (!/\brel\s*=\s*["']stylesheet["']/i.test(linkTag)) return linkTag;
    return linkTag.replace(/(\bhref\s*=\s*["'])([^"']+)(["'])/i, (whole, before, url, after) => {
      if (!url.startsWith("/assets/css/")) return whole;
      const [pathAndQuery, fragment] = url.split("#", 2);
      const file = pathAndQuery.slice("/assets/css/".length).split("?")[0];
      if (!/^[a-z0-9_-]+\.css$/i.test(file)) return whole;
      const replacement = fingerprints[file];
      return replacement
        ? before + "/assets/css/" + replacement + (fragment ? "#" + fragment : "") + after
        : whole;
    });
  });
}

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(file));
    else if (entry.isFile() && file.endsWith(".html")) files.push(file);
  }
  return files;
}

export async function fingerprintBuiltCss(dist) {
  const cssDir = path.join(dist, "assets/css");
  const entries = await fs.readdir(cssDir, { withFileTypes: true });
  const fingerprints = {};
  for (const entry of entries) {
    if (!entry.isFile() || !/^[a-z0-9_-]+\.css$/i.test(entry.name)) continue;
    const bytes = await fs.readFile(path.join(cssDir, entry.name));
    const name = fingerprintedStylesheetName(entry.name, bytes);
    await fs.writeFile(path.join(cssDir, name), bytes);
    fingerprints[entry.name] = name;
  }
  if (!fingerprints["components.css"]) {
    throw new Error("Missing built components.css: cannot safely deploy cached styles");
  }
  return fingerprints;
}

async function main() {
  const dist = path.resolve("dist");
  const htmlFiles = await walk(dist);
  if (!htmlFiles.length) throw new Error("No built HTML files found");
  const fingerprints = await fingerprintBuiltCss(dist);
  let changed = 0;
  for (const file of htmlFiles) {
    const previous = await fs.readFile(file, "utf8");
    const next = versionStylesheetLinks(previous, fingerprints);
    if (next !== previous) {
      await fs.writeFile(file, next, "utf8");
      changed++;
    }
  }
  // Both English and Greek homepages must point to a physical new filename.
  for (const htmlPath of ["index.html", "el/index.html"]) {
    const html = await fs.readFile(path.join(dist, htmlPath), "utf8");
    if (!html.includes("/assets/css/" + fingerprints["components.css"])) {
      throw new Error(`Missing fingerprinted components CSS in ${htmlPath}`);
    }
  }
  console.log("Immutable CSS assets:", fingerprints);
  console.log(`Fingerprinted public CSS in ${changed}/${htmlFiles.length} HTML pages`);
  if (!changed) throw new Error("No CSS references were refreshed");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
