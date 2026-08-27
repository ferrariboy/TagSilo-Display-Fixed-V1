import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const popupSource = readFileSync(path.join(projectRoot, "popup.js"), "utf8");
const contentSource = readFileSync(path.join(projectRoot, "content.js"), "utf8");
const backgroundSource = readFileSync(path.join(projectRoot, "background.js"), "utf8");
const manifest = JSON.parse(readFileSync(path.join(projectRoot, "manifest.json"), "utf8"));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  popupSource.includes("closeStaleTagSiloContactInfoOverlay"),
  "The popup injector must recover from a stale Contact Info route before extracting profile metadata."
);
assert(
  popupSource.includes("window.history.back()"),
  "The stale overlay recovery must include a route-level fallback when LinkedIn does not respond to its dismiss control."
);
assert(
  !popupSource.includes("contactControl.click()") && !popupSource.includes("openedByTagSilo"),
  "The active LinkedIn tab must not reopen the visible Contact Info dialog."
);
assert(
  popupSource.includes("mergeExtractionResults") && popupSource.includes("email: usePrimary(\"email\", placeholderValues)"),
  "A valid email from the page-context extractor must not be overwritten by a fallback result."
);
assert(
  popupSource.includes("Contact Info request diagnostics") && popupSource.includes("Background Contact Info diagnostics") && backgroundSource.includes("responseLength"),
  "Both direct and background Contact Info requests must emit privacy-preserving response diagnostics."
);
assert(
  popupSource.includes('action: "FETCH_EMAIL"'),
  "The popup must retain the background email-fetch fallback."
);
assert(
  backgroundSource.includes("handleFetchContactEmail") && backgroundSource.includes("/overlay/contact-info/"),
  "The service worker must retain the silent Contact Info endpoint fetcher."
);
assert(
  backgroundSource.includes("findContactEmailInHtml") && popupSource.includes("world: \"MAIN\"") && popupSource.includes("response.email"),
  "The non-visual Contact Info path must parse direct responses and run the primary request in LinkedIn's page context."
);
assert(
  !backgroundSource.includes("readContactEmailInInactiveTab") && !backgroundSource.includes("chrome.tabs.create({ url: contactInfoUrl"),
  "The contact-email retrieval path must not open an additional browser tab."
);
assert(
  popupSource.includes("const getProfileAvatarUrl") && popupSource.includes("bestCandidate") && contentSource.includes("bestCandidate"),
  "Avatar extraction must score candidates against the active profile's context."
);
assert(
  !popupSource.includes('document.querySelector(\'meta[property="og:image"]\')') && !popupSource.includes('document.querySelector("img[alt*='),
  "Avatar extraction must avoid global metadata and unscoped image selectors."
);
assert(manifest.version === "1.3.6", "The manifest version must reflect the lifecycle fix.");

console.log("Contact Info lifecycle checks passed.");
