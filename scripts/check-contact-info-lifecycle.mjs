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
  popupSource.includes("readEmailViaManagedContactInfoDialog") && popupSource.includes("waitForContactInfoEmail") && popupSource.includes("window.__tagsiloContactInfoJob"),
  "The Contact Info dialog must be coordinated as a single per-tab transaction."
);
assert(
  popupSource.includes("linkPath === expectedPath") && popupSource.includes("!anchor.querySelector(\"img, picture, svg\")"),
  "The modal trigger must target only the exact Contact Info link and never a profile image control."
);
assert(
  popupSource.includes("finally") && popupSource.includes("restoreContactInfoRoute(expectedPath)"),
  "Every Contact Info read must restore the profile route even when the popup closes or the email is absent."
);
assert(
  popupSource.includes("managedEmailLookupCompleted") && popupSource.includes("applyExtractedProfile(extracted, !managedEmailLookupCompleted)"),
  "A completed managed email lookup must resolve the popup UI rather than leaving it in a searching state."
);
assert(
  popupSource.includes("mergeExtractionResults") && popupSource.includes("email: usePrimary(\"email\", placeholderValues)"),
  "A valid email from the page-context extractor must not be overwritten by a fallback result."
);
assert(
  !popupSource.includes("chrome.tabs.create({ url: contactInfoUrl") && !backgroundSource.includes("readContactEmailInInactiveTab"),
  "The Contact Info read must not create a secondary browser tab."
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
assert(manifest.version === "1.3.8", "The manifest version must reflect the lifecycle fix.");

console.log("Contact Info lifecycle checks passed.");
