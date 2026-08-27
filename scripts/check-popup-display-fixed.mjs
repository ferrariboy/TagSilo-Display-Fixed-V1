import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const [manifestRaw, popupCss, popupJs, optionsHtml, optionsJs] = await Promise.all([
  readFile(resolve(root, "manifest.json"), "utf8"),
  readFile(resolve(root, "popup.css"), "utf8"),
  readFile(resolve(root, "popup.js"), "utf8"),
  readFile(resolve(root, "options.html"), "utf8"),
  readFile(resolve(root, "options.js"), "utf8"),
]);

const failures = [];
const manifest = JSON.parse(manifestRaw);

if (manifest.version !== "1.3.7") {
  failures.push(`Expected manifest version 1.3.7, received ${manifest.version}.`);
}

const forbiddenPopupPatterns = [
  ["legacy global UI scale", /--ui-scale\s*:/i],
  ["global CSS zoom", /\.popup-container\s*\{[^}]*\bzoom\s*:/is],
  ["disabled text-size adjustment", /text-size-adjust\s*:\s*none/i],
];

for (const [label, pattern] of forbiddenPopupPatterns) {
  if (pattern.test(popupCss)) failures.push(`Popup CSS contains ${label}.`);
}

const requiredPopupPatterns = [
  ["readable size tokens", /--text-label\s*:\s*0\.8125rem/i],
  ["comfortable density tokens", /:root\[data-density="comfortable"\]/i],
  ["popup density hydration", /applySavedDisplayDensity/i],
];

for (const [label, pattern] of requiredPopupPatterns) {
  if (!pattern.test(`${popupCss}\n${popupJs}`)) failures.push(`Missing ${label}.`);
}

if (!/name="uiDensity"/i.test(optionsHtml) || !/saveDisplayDensity/i.test(optionsJs)) {
  failures.push("Options page does not provide a persisted display-density control.");
}

if (failures.length) {
  console.error("Display Fixed V1 validation failed:\n- " + failures.join("\n- "));
  process.exit(1);
}

console.log("Display Fixed V1 validation passed: popup uses native CSS sizing and persisted density preferences.");
