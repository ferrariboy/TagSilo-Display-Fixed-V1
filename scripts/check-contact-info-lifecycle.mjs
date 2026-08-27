import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const popupSource = readFileSync(path.join(projectRoot, "popup.js"), "utf8");
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
  popupSource.includes("openedByTagSilo") && popupSource.includes("finally"),
  "The managed Contact Info fallback must always close the dialog it opens."
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
  backgroundSource.includes("findContactEmailInHtml") && popupSource.includes("response.email"),
  "The silent Contact Info path must parse visible email text, not only mailto links."
);
assert(
  popupSource.includes("const getProfileAvatarUrl") && popupSource.includes("const profileRoot = document.querySelector"),
  "Avatar extraction must be constrained to the active profile card."
);
assert(
  !popupSource.includes('document.querySelector(\'meta[property="og:image"]\')') && !popupSource.includes('document.querySelector("img[alt*='),
  "Avatar extraction must avoid global metadata and unscoped image selectors."
);
assert(manifest.version === "1.3.2", "The manifest version must reflect the lifecycle fix.");

console.log("Contact Info lifecycle checks passed.");
