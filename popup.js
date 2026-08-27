/**
 * TagSilo Pro - Popup Application Controller (Manifest V3)
 * Full Production Grade Commercial Controller
 * Connected to Vercel Serverless Backend & Supabase Database Layer
 * 7-Layer Extraction Engine with Hard Timeout Infinite Loop Protection,
 * Live GET /api/profile-status Verification, POST /api/checkout, and Anti-Duplicate Sync.
 */

const DEFAULT_VERCEL_URL = "https://tagsilo.vercel.app";
const DEFAULT_SUPABASE_URL = "https://wrmzlyffpfdnphmqujfe.supabase.co";
const UI_DENSITY_KEY = "tagsilo_ui_density";
const UI_DENSITIES = new Set(["standard", "comfortable"]);

const DEFAULT_TAGS = [
  "High Priority",
  "Executive",
  "Warm Intro",
  "Founder",
  "Technical",
  "Decision Maker"
];

const DEFAULT_GROUPS = [
  "Prospects",
  "Investors & Angels",
  "Talent & Recruiting",
  "Partnerships",
  "Key Accounts"
];

const TAG_COLORS = {
  "high priority": "#ef4444",
  "executive": "#a855f7",
  "warm intro": "#10b981",
  "founder": "#06b6d4",
  "technical": "#3b82f6",
  "decision maker": "#f59e0b"
};

// Helper to clean tags (strip legacy emojis)
function cleanTag(str) {
  if (!str || typeof str !== "string") return "";
  return str.replace(/^[\p{Emoji}\p{Symbol}\s]+/gu, "").trim() || str.trim();
}

document.addEventListener("DOMContentLoaded", async () => {
  // Dynamic Version Injection
  const appVersion = chrome.runtime.getManifest()?.version || "1.2.0";
  const footerVersionText = document.getElementById("footerVersionText");
  if (footerVersionText) footerVersionText.textContent = `v${appVersion}`;

  // DOM References
  const headerTierBadge = document.getElementById("headerTierBadge");
  const dailyCapPill = document.getElementById("dailyCapPill");
  const dailyCapIcon = document.getElementById("dailyCapIcon");
  const dailyCapText = document.getElementById("dailyCapText");
  const openOptionsBtn = document.getElementById("openOptionsBtn");

  function openSettingsPage(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const optionsUrl = chrome.runtime.getURL("options.html");
    try {
      if (chrome.tabs && chrome.tabs.query) {
        chrome.tabs.query({ url: optionsUrl }, (tabs) => {
          if (tabs && tabs.length > 0) {
            chrome.tabs.update(tabs[0].id, { active: true });
            if (tabs[0].windowId && chrome.windows) {
              chrome.windows.update(tabs[0].windowId, { focused: true });
            }
          } else {
            chrome.tabs.create({ url: optionsUrl });
          }
        });
        return;
      }
    } catch (err) {}
    chrome.tabs.create({ url: optionsUrl });
  }

  if (openOptionsBtn) {
    openOptionsBtn.addEventListener("click", openSettingsPage);
  }

  // Google Auth Elements
  const googleSignInBtn = document.getElementById("googleSignInBtn");
  const googleUserBar = document.getElementById("googleUserBar");
  const userAvatarImg = document.getElementById("userAvatarImg");
  const userAvatarPlaceholder = document.getElementById("userAvatarPlaceholder");
  const userEmailText = document.getElementById("userEmailText");
  const disconnectGoogleBtn = document.getElementById("disconnectGoogleBtn");

  // Profile Extraction Elements
  const detectStatusBadge = document.getElementById("detectStatusBadge");
  const detectStatusText = document.getElementById("detectStatusText");
  const refreshMetaBtn = document.getElementById("refreshMetaBtn");
  const leadAvatarImg = document.getElementById("leadAvatarImg");
  const leadAvatarPlaceholder = document.getElementById("leadAvatarPlaceholder");
  const leadNameInput = document.getElementById("leadNameInput");
  const profileJobTitle = document.getElementById("profileJobTitle");
  const leadEmailInput = document.getElementById("leadEmailInput");
  const profileUrlBadge = document.getElementById("profileUrlBadge");
  const profileEmailBadge = document.getElementById("profileEmailBadge");

  // Already Tagged Glass Banner
  const alreadyTaggedBanner = document.getElementById("alreadyTaggedBanner");
  const taggedDateText = document.getElementById("taggedDateText");

  // Pipeline Group Controls
  const groupSelect = document.getElementById("groupSelect");
  const manageGroupsBtn = document.getElementById("manageGroupsBtn");
  const customGroupDropdownWrap = document.getElementById("customGroupDropdownWrap");
  const customGroupTrigger = document.getElementById("customGroupTrigger");
  const customGroupSelectedText = document.getElementById("customGroupSelectedText");
  const customGroupMenu = document.getElementById("customGroupMenu");

  // Tag Management Elements
  const activeTagsBox = document.getElementById("activeTagsBox");
  const activeCountLabel = document.getElementById("activeCountLabel");
  const customActiveTagInput = document.getElementById("customActiveTagInput");
  const addActiveTagBtn = document.getElementById("addActiveTagBtn");
  const quickTagsGrid = document.getElementById("quickTagsGrid");
  const manageTagsBtn = document.getElementById("manageTagsBtn");
  const tagLimitCounter = document.getElementById("tagLimitCounter");
  const inlineTagLimitBanner = document.getElementById("inlineTagLimitBanner");

  // Notes
  const leadNotesInput = document.getElementById("leadNotesInput");
  const charCountLabel = document.getElementById("charCountLabel");

  // Sync Action, Toast & Persistent Shortcut Link
  const primarySyncBtn = document.getElementById("primarySyncBtn");
  const syncBtnSpinner = document.getElementById("syncBtnSpinner");
  const syncBtnIcon = document.getElementById("syncBtnIcon");
  const syncBtnText = document.getElementById("syncBtnText");
  const syncToast = document.getElementById("syncToast");
  const toastMessage = document.getElementById("toastMessage");
  const toastSheetLink = document.getElementById("toastSheetLink");
  const sheetShortcutLink = document.getElementById("sheetShortcutLink");

  // Paywall Modal Elements
  const paywallModalOverlay = document.getElementById("paywallModalOverlay");
  const closePaywallBtn = document.getElementById("closePaywallBtn");
  const paywallDynamicMessage = document.getElementById("paywallDynamicMessage");
  const creemCheckoutBtn = document.getElementById("creemCheckoutBtn");
  const enterLicenseLink = document.getElementById("enterLicenseLink");

  // Error fallback for avatar image
  if (leadAvatarImg) {
    leadAvatarImg.onerror = () => {
      leadAvatarImg.style.display = "none";
      if (leadAvatarPlaceholder) {
        leadAvatarPlaceholder.style.display = "flex";
        leadAvatarPlaceholder.textContent = (leadNameInput?.value || "L").charAt(0).toUpperCase();
      }
    };
  }

  // App State Variables
  let currentAuthToken = null;
  let currentGoogleUser = null;
  let isProUser = false;
  let licenseTier = "free";
  let dailyCount = 0;
  let maxDaily = 3;
  let isCapped = false;
  let activeTags = new Set();
  let quickTags = [...DEFAULT_TAGS];
  let pipelineGroups = [...DEFAULT_GROUPS];
  let currentProfileUrl = "";
  let currentProfileAvatarUrl = "";
  let currentExtractedHeadline = "";
  let currentExtractedEmail = "Cannot Find";
  let isProfileAlreadySaved = false;
  let backendApiUrl = DEFAULT_VERCEL_URL;

  function normalizeUiDensity(value) {
    return UI_DENSITIES.has(value) ? value : "standard";
  }

  async function applySavedDisplayDensity() {
    let savedDensity = "standard";
    let hasSyncedDensity = false;

    try {
      const synced = await chrome.storage.sync.get(UI_DENSITY_KEY);
      if (UI_DENSITIES.has(synced[UI_DENSITY_KEY])) {
        savedDensity = synced[UI_DENSITY_KEY];
        hasSyncedDensity = true;
      }
    } catch (error) {
      console.warn("[TagSilo Pro] Display density sync load note:", error);
    }

    if (!hasSyncedDensity) {
      try {
        const local = await chrome.storage.local.get(UI_DENSITY_KEY);
        if (UI_DENSITIES.has(local[UI_DENSITY_KEY])) {
          savedDensity = local[UI_DENSITY_KEY];
        }
      } catch (error) {
        console.warn("[TagSilo Pro] Display density local load note:", error);
      }
    }

    document.documentElement.dataset.density = normalizeUiDensity(savedDensity);
  }

  chrome.storage.onChanged.addListener((changes) => {
    if (changes[UI_DENSITY_KEY]) {
      document.documentElement.dataset.density = normalizeUiDensity(changes[UI_DENSITY_KEY].newValue);
    }
  });

  // 1. Initial State Load & Cache Hydration
  try {
    await applySavedDisplayDensity();
    await initializeApp();
  } catch (initErr) {
    console.error("[TagSilo Pro] initializeApp error:", initErr);
  }

  async function initializeApp() {
    // Resolve Vercel / backend server endpoint
    try {
      const { vercel_backend_url, backend_server_url } = await chrome.storage.local.get([
        "vercel_backend_url",
        "backend_server_url"
      ]);
      backendApiUrl = vercel_backend_url || backend_server_url || DEFAULT_VERCEL_URL;
    } catch (e) {
      backendApiUrl = DEFAULT_VERCEL_URL;
    }

    // 0. Immediate Pro Status Rehydration & Modal Suppression
    try {
      const { license_tier, is_pro, creem_discount_code, creem_license_key } = await chrome.storage.local.get([
        "license_tier",
        "is_pro",
        "creem_discount_code",
        "creem_license_key"
      ]);

      if (is_pro === true || license_tier === "pro" || (creem_discount_code && creem_discount_code.trim() !== "")) {
        isProUser = true;
        licenseTier = "pro";
        if (headerTierBadge) {
          headerTierBadge.textContent = "PRO";
          headerTierBadge.className = "tier-badge pro";
        }
        if (dailyCapIcon) dailyCapIcon.textContent = "∞";
        if (dailyCapText) dailyCapText.textContent = "Unlimited Sync";
        if (dailyCapPill) dailyCapPill.className = "quota-pill pro-pill";
        if (inlineTagLimitBanner) inlineTagLimitBanner.style.display = "none";
        hidePaywallModal();
      }
    } catch (e) {}

    // A. Instant Rehydrate from Content Script & Storage
    try {
      const [curTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const curUrl = curTab?.url ? curTab.url.split("?")[0].split("#")[0].replace(/\/overlay\/contact-info\/?.*$/i, "").replace(/\/$/, "") : "";
      const { lastCapture, cached_profile_data } = await chrome.storage.local.get(["lastCapture", "cached_profile_data"]);
      const stored = (lastCapture && lastCapture.url === curUrl) ? lastCapture : ((cached_profile_data && cached_profile_data.url === curUrl) ? cached_profile_data : null);
      if (stored && stored.headline && stored.headline !== "No Headline Available" && stored.headline !== "Profile Member") {
        applyExtractedProfile(stored, false);
      }
    } catch (e) {
      console.warn("[TagSilo Pro] Cache load note:", e);
    }

    // B. Rehydrate Persistent Spreadsheet Navigation Shortcut Link
    await refreshSpreadsheetShortcutLink();

    // C. Load Stored Taxonomy and Credentials
    await loadTaxonomyAndSettings();

    // D. Verify Google Identity Auth State
    await checkGoogleAuthState();

    // E. Query GET /api/profile-status from Vercel & Supabase
    await queryUserProfileStatus();

    // F. Pre-Auth Capture Matrix & 7-Layer Profile Extraction
    await executePreAuthProfileCapture();
  }

  async function loadTaxonomyAndSettings() {
    let syncData = {};
    try {
      syncData = await chrome.storage.sync.get([
        "quick_tags",
        "tagsilo_tags",
        "quick_tags_initialized",
        "pipeline_groups",
        "tagsilo_groups",
        "pipeline_groups_initialized",
        "license_tier",
        "is_pro",
        "creem_license_key"
      ]);
    } catch (e) {}

    let localData = {};
    try {
      localData = await chrome.storage.local.get([
        "quick_tags",
        "tagsilo_tags",
        "quick_tags_initialized",
        "pipeline_groups",
        "tagsilo_groups",
        "pipeline_groups_initialized",
        "tagsilo_google_user",
        "tagsilo_google_access_token",
        "creem_license_key",
        "creem_discount_code",
        "license_tier",
        "is_pro"
      ]);
    } catch (e) {}

    if (localData.is_pro === true || localData.license_tier === "pro" || syncData.is_pro === true || syncData.license_tier === "pro" || (localData.creem_license_key && localData.creem_license_key.trim() !== "") || (localData.creem_discount_code && localData.creem_discount_code.trim() !== "")) {
      isProUser = true;
      licenseTier = "pro";
    }

    const isTagsInitialized = syncData.quick_tags_initialized || localData.quick_tags_initialized;
    let rawTags = (syncData.quick_tags !== undefined) ? syncData.quick_tags :
                  (localData.quick_tags !== undefined) ? localData.quick_tags :
                  (syncData.tagsilo_tags !== undefined) ? syncData.tagsilo_tags :
                  (localData.tagsilo_tags !== undefined) ? localData.tagsilo_tags : null;

    if (!Array.isArray(rawTags) && !isTagsInitialized) {
      rawTags = DEFAULT_TAGS;
      try {
        await chrome.storage.local.set({ quick_tags: DEFAULT_TAGS, tagsilo_tags: DEFAULT_TAGS, quick_tags_initialized: true });
        await chrome.storage.sync.set({ quick_tags: DEFAULT_TAGS, tagsilo_tags: DEFAULT_TAGS, quick_tags_initialized: true });
      } catch (e) {}
    } else if (!Array.isArray(rawTags)) {
      rawTags = [];
    }
    quickTags = (rawTags || []).map(cleanTag).filter(Boolean);

    const isGroupsInitialized = syncData.pipeline_groups_initialized || localData.pipeline_groups_initialized;
    let rawGroups = (syncData.pipeline_groups !== undefined) ? syncData.pipeline_groups :
                    (localData.pipeline_groups !== undefined) ? localData.pipeline_groups :
                    (syncData.tagsilo_groups !== undefined) ? syncData.tagsilo_groups :
                    (localData.tagsilo_groups !== undefined) ? localData.tagsilo_groups : null;

    if (!Array.isArray(rawGroups) && !isGroupsInitialized) {
      rawGroups = DEFAULT_GROUPS;
      try {
        await chrome.storage.local.set({ pipeline_groups: DEFAULT_GROUPS, tagsilo_groups: DEFAULT_GROUPS, pipeline_groups_initialized: true });
        await chrome.storage.sync.set({ pipeline_groups: DEFAULT_GROUPS, tagsilo_groups: DEFAULT_GROUPS, pipeline_groups_initialized: true });
      } catch (e) {}
    } else if (!Array.isArray(rawGroups)) {
      rawGroups = [];
    }
    pipelineGroups = rawGroups;

    renderPipelineGroups();
    renderQuickTags();
    renderActiveTags();
  }

  // 2. Query Vercel GET /api/profile-status (Supabase Database Layer)
  async function queryUserProfileStatus() {
    try {
      const stored = await chrome.storage.local.get(["creem_license_key", "tagsilo_google_user", "is_pro", "license_tier"]);
      const userEmail = stored.tagsilo_google_user?.email || currentGoogleUser?.email || "";
      const licenseKey = stored.creem_license_key || "";
      const chromeId = chrome.runtime.id;

      if (stored.is_pro === true || stored.license_tier === "pro" || (licenseKey && licenseKey.trim() !== "")) {
        isProUser = true;
        licenseTier = "pro";
        renderPipelineGroups();
      }

      const params = new URLSearchParams({
        email: userEmail,
        chrome_id: chromeId,
        license_key: licenseKey
      });

      const response = await fetch(`${backendApiUrl}/api/profile-status?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        if (data.isPro || data.status === "active") {
          isProUser = true;
          licenseTier = data.tier || "pro";
          headerTierBadge.textContent = licenseTier.toUpperCase();
          headerTierBadge.className = "tier-badge pro";
          dailyCapIcon.textContent = "∞";
          dailyCapText.textContent = "Unlimited Sync";
          dailyCapPill.className = "quota-pill pro-pill";
          updateTagCounterLabel();
          renderPipelineGroups();
          return;
        }
      }
    } catch (err) {
      console.warn("[TagSilo Pro] /api/profile-status check note:", err.message);
    }

    // Fallback to local 24-hour freemium rolling cap
    await refreshTierAndCapStatus();
  }

  // 3. Profile Extraction Loop (Promise-based matching LinkTag Pro)
  async function executePreAuthProfileCapture() {
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTab || !activeTab.id || !activeTab.url) {
        setScanStatus("Ready (Manual Entry)", false);
        return;
      }

      const rawUrl = activeTab.url.split("?")[0].split("#")[0];
      const cleanUrl = rawUrl.replace(/\/overlay\/contact-info\/?.*$/i, "").replace(/\/$/, "");
      currentProfileUrl = cleanUrl;
      if (profileUrlBadge) profileUrlBadge.textContent = cleanUrl;

      if (!activeTab.url.includes("linkedin.com")) {
        setScanStatus("Ready (Manual Entry)", false);
        return;
      }

      setScanStatus("Scanning...", true);
      if (profileJobTitle) profileJobTitle.textContent = "Scanning Headline...";

      let extracted = null;

      // Tier 1: Injected In-Page Extractor (Directly pops up Contact Info modal & captures Name, Headline, Avatar, Email)
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          func: extractLinkedInMetadataInPage
        });
        if (results && results[0] && results[0].result) {
          extracted = results[0].result;
        }
      } catch (execErr) {
        console.warn("[TagSilo Pro] Injected scraper note:", execErr);
      }

      // Tier 2: Content script runtime message fallback
      if (!extracted || !extracted.headline || extracted.headline === "Profile Member") {
        try {
          const resp = await chrome.tabs.sendMessage(activeTab.id, { action: "GET_LINKEDIN_METADATA" });
          if (resp && resp.data) {
            extracted = resp.data;
          }
        } catch (msgErr) {}
      }

      // Tier 3: Local Storage cache fallback
      if (!extracted) {
        try {
          const { lastCapture, cached_profile_data } = await chrome.storage.local.get(["lastCapture", "cached_profile_data"]);
          const matched = (lastCapture && lastCapture.url === cleanUrl) ? lastCapture : ((cached_profile_data && cached_profile_data.url === cleanUrl) ? cached_profile_data : null);
          if (matched) {
            extracted = matched;
          }
        } catch (stErr) {}
      }

      if (extracted) {
        extracted.url = cleanUrl;

        console.log("[TagSilo Pro] Extracted profile data:", JSON.stringify(extracted, null, 2));

        // Apply extracted fields onto UI grid
        applyExtractedProfile(extracted, true);

        // Save dataset immediately to browser local memory
        if (extracted.fullName || extracted.name) {
          await cacheProfileData(extracted);
        }

        // Check if this profile URL is already saved via Backend API
        await checkDuplicateProfile(cleanUrl);

        // If email was not located via in-page scan, trigger secondary background overlay fetcher
        if (!extracted.email || extracted.email === "Cannot Find" || extracted.email === "Unavailable") {
          if (cleanUrl.includes("/in/")) {
            fetchOverlayContactEmail(cleanUrl);
          }
        }
      } else {
        setScanStatus("LinkedIn Page", false);
        if (profileJobTitle && profileJobTitle.textContent === "Scanning Headline...") {
          profileJobTitle.textContent = "No Headline Available";
        }
      }
    } catch (err) {
      console.warn("[TagSilo Pro] Extraction error:", err);
      setScanStatus("Ready (Manual Entry)", false);
      if (profileJobTitle && profileJobTitle.textContent === "Scanning Headline...") {
        profileJobTitle.textContent = "No Headline Available";
      }
    }
  }

  // 4. Anti-Duplicate Check in Google Sheets via Background Service Worker & Cloud Sync API
  async function checkDuplicateProfile(profileUrl) {
    if (!profileUrl || !profileUrl.includes("linkedin.com")) return;

    try {
      const { active_google_sheet_id, tagsilo_google_access_token } = await chrome.storage.local.get([
        "active_google_sheet_id",
        "tagsilo_google_access_token"
      ]);

      const token = currentAuthToken || tagsilo_google_access_token;
      if (!token) return;

      let response = null;

      // 1. Direct Background Worker Check (with Google Drive Auto-Discovery)
      try {
        response = await chrome.runtime.sendMessage({
          action: "CHECK_EXISTING_PROFILE",
          profileUrl: profileUrl,
          googleAuthToken: token
        });
      } catch (e) {}

      // 2. Fallback to Cloud Backend Check
      if ((!response || !response.exists) && active_google_sheet_id) {
        try {
          const res = await fetch(`${backendApiUrl}/api/sync/check`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              authToken: token,
              profileUrl: profileUrl,
              sheetId: active_google_sheet_id
            })
          });
          if (res.ok) {
            const json = await res.json();
            if (json && json.exists) response = json;
          }
        } catch (beErr) {
          console.warn("[TagSilo Pro] Backend check note:", beErr.message);
        }
      }

      if (response && response.success && response.exists && response.data) {
        isProfileAlreadySaved = true;
        const rec = response.data;

        // Show Already Saved Glass Banner
        if (alreadyTaggedBanner && taggedDateText) {
          taggedDateText.textContent = `Saved on ${rec.date || 'Google Sheet'} in group "${rec.group || 'Prospects'}"`;
          alreadyTaggedBanner.style.setProperty("display", "flex", "important");
          alreadyTaggedBanner.classList.add("visible");
        }

        // Pre-populate fields with existing record
        if (rec.group) {
          const matchOpt = Array.from(groupSelect.options).find(o => o.value === rec.group);
          if (matchOpt) {
            selectPipelineGroup(rec.group, matchOpt.textContent, false);
          } else {
            const opt = document.createElement("option");
            opt.value = rec.group;
            opt.textContent = rec.group;
            groupSelect.appendChild(opt);
            selectPipelineGroup(rec.group, rec.group, false);
          }
        }

        if (rec.tags && rec.tags !== "No Tags") {
          const savedTags = rec.tags.split(",").map(t => t.trim()).filter(Boolean);
          savedTags.forEach(t => activeTags.add(t));
          renderActiveTags();
          updateQuickTagButtons();
        }

        if (rec.notes && rec.notes !== "No Notes Entered") {
          leadNotesInput.value = rec.notes;
          charCountLabel.textContent = `${rec.notes.length}/500`;
        }

        if (rec.email && rec.email !== "Cannot Find" && rec.email !== "Unavailable") {
          currentExtractedEmail = rec.email;
          updateEmailBadge(rec.email, false);
          if (leadEmailInput) leadEmailInput.value = `Email: ${rec.email}`;
        }

        syncBtnText.textContent = "Update Record in Google Sheets";
        if (syncBtnIcon) syncBtnIcon.textContent = "✓";
      } else {
        isProfileAlreadySaved = false;
        if (alreadyTaggedBanner) {
          alreadyTaggedBanner.style.setProperty("display", "none", "important");
          alreadyTaggedBanner.classList.remove("visible");
        }
        syncBtnText.textContent = "Sync Profile to Cloud Pipeline";
        if (syncBtnIcon) syncBtnIcon.textContent = "⚡";
      }
    } catch (err) {
      console.warn("[TagSilo Pro] Duplicate check note:", err);
    }
  }

  // extractLinkedInMetadataInPage is defined OUTSIDE this closure (at file bottom)
  // so chrome.scripting.executeScript can serialize it properly — matching LinkTag Pro architecture.

  function updateEmailBadge(emailText, isSearching = false) {
    if (!profileEmailBadge) return;
    if (isSearching) {
      profileEmailBadge.textContent = "Email: Searching...";
      profileEmailBadge.className = "meta-pill email-pill";
      return;
    }

    const clean = (emailText || "").replace(/^Email:\s*/i, "").trim();
    if (clean && clean !== "Cannot Find" && clean !== "Unavailable" && clean !== "Searching...") {
      currentExtractedEmail = clean;
      profileEmailBadge.textContent = `Email: ${clean}`;
      profileEmailBadge.className = "meta-pill email-pill";
    } else {
      currentExtractedEmail = "Cannot Find";
      profileEmailBadge.textContent = "Email: Cannot Find";
      profileEmailBadge.className = "meta-pill email-pill not-found";
    }
  }

  function setScanStatus(label, isLive = false) {
    if (detectStatusText) detectStatusText.textContent = label;
    if (!detectStatusBadge) return;
    if (isLive) {
      detectStatusBadge.style.borderColor = "rgba(56, 189, 248, 0.35)";
      detectStatusBadge.style.background = "var(--accent-cyan-dim)";
      detectStatusBadge.style.color = "var(--accent-cyan)";
    } else {
      detectStatusBadge.style.borderColor = "var(--border-outer)";
      detectStatusBadge.style.background = "rgba(15, 23, 42, 0.4)";
      detectStatusBadge.style.color = "var(--text-secondary)";
    }
  }

  function applyExtractedProfile(data, isLiveDetection = true) {
    const pName = data.name || data.fullName || "";
    if (pName) {
      leadNameInput.value = pName;
      setScanStatus("LinkedIn Detected", true);
    } else if (isLiveDetection) {
      setScanStatus(currentProfileUrl.includes("linkedin.com") ? "LinkedIn Page" : "Manual Entry", false);
    }

    // Render Job Title / Profile Headline right below the Full Name
    const titleVal = (data.title || data.headline || data.jobTitle || "").trim();
    if (titleVal) {
      currentExtractedHeadline = titleVal;
      if (profileJobTitle) {
        profileJobTitle.textContent = titleVal;
        profileJobTitle.title = titleVal;
        profileJobTitle.style.display = "block";
      }
    } else {
      currentExtractedHeadline = "";
      if (profileJobTitle) {
        profileJobTitle.textContent = "No Headline Available";
        profileJobTitle.title = "No Headline Available";
        profileJobTitle.style.display = "block";
      }
    }

    if (data.url) {
      currentProfileUrl = data.url;
      if (profileUrlBadge) profileUrlBadge.textContent = data.url;
    }

    // Render Email Badge (searching vs found vs cannot find)
    const rawEmail = (data.email || "").replace(/^Email:\s*/i, "").trim();
    if (rawEmail && rawEmail !== "Cannot Find" && rawEmail !== "Unavailable" && rawEmail !== "Searching...") {
      updateEmailBadge(rawEmail, false);
      if (leadEmailInput) leadEmailInput.value = `Email: ${rawEmail}`;
    } else if (isLiveDetection && currentProfileUrl.includes("linkedin.com")) {
      updateEmailBadge("", true);
      if (leadEmailInput) leadEmailInput.value = "Email: Searching...";
    } else {
      updateEmailBadge("Cannot Find", false);
      if (leadEmailInput) leadEmailInput.value = "Email: Cannot Find";
    }

    // SHOW PROFILE IMAGE (Exact LinkedTag Pro image rendering)
    const imgUrl = data.image || data.avatarUrl || "";
    if (imgUrl && !imgUrl.startsWith("data:image/svg") && !imgUrl.includes("ghost")) {
      currentProfileAvatarUrl = imgUrl;
      leadAvatarImg.src = imgUrl;
      leadAvatarImg.style.display = "block";
      leadAvatarPlaceholder.style.display = "none";
    } else {
      currentProfileAvatarUrl = "";
      leadAvatarImg.style.display = "none";
      leadAvatarPlaceholder.style.display = "flex";
      leadAvatarPlaceholder.textContent = (pName || "L").charAt(0).toUpperCase();
    }
  }

  async function cacheProfileData(data) {
    const packet = {
      fullName: data.fullName || leadNameInput.value || "",
      jobTitle: data.jobTitle || data.headline || currentExtractedHeadline || "",
      headline: data.headline || currentExtractedHeadline || "",
      email: currentExtractedEmail || "Cannot Find",
      avatarUrl: data.avatarUrl || currentProfileAvatarUrl || "",
      url: data.url || currentProfileUrl || "",
      savedAt: new Date().toISOString()
    };
    await chrome.storage.local.set({ cached_profile_data: packet });
  }

  // Overlay Contact Info Email Fetcher via background relay (/overlay/contact-info/)
  async function fetchOverlayContactEmail(profileUrl) {
    if (!profileUrl || !profileUrl.includes("linkedin.com/in/")) {
      updateEmailBadge("Cannot Find", false);
      if (leadEmailInput) leadEmailInput.value = "Email: Cannot Find";
      return "Cannot Find";
    }

    try {
      const response = await chrome.runtime.sendMessage({
        action: "FETCH_EMAIL",
        profileUrl: profileUrl
      });

      if (response && response.success && response.html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(response.html, "text/html");

        const mailtoLink = doc.querySelector('a[href^="mailto:"]');
        if (mailtoLink) {
          const emailText = mailtoLink.innerText.trim() || mailtoLink.getAttribute("href").replace(/^mailto:/i, "").trim();
          if (emailText && emailText.includes("@")) {
            currentExtractedEmail = emailText;
            updateEmailBadge(emailText, false);
            if (leadEmailInput) leadEmailInput.value = `Email: ${emailText}`;
            await cacheProfileData({ email: emailText });
            return emailText;
          }
        }

        const emailMatch = response.html.match(/href=["']mailto:([^"'?]+)["']/i) ||
                           response.html.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
        if (emailMatch && emailMatch[1]) {
          const cleanEmail = emailMatch[1].trim();
          currentExtractedEmail = cleanEmail;
          updateEmailBadge(cleanEmail, false);
          if (leadEmailInput) leadEmailInput.value = `Email: ${cleanEmail}`;
          await cacheProfileData({ email: cleanEmail });
          return cleanEmail;
        }
      }
    } catch (err) {
      console.warn("[TagSilo Pro] Contact email fetch note:", err);
    }

    updateEmailBadge("Cannot Find", false);
    if (leadEmailInput) leadEmailInput.value = "Email: Cannot Find";
    return "Cannot Find";
  }

  // Refresh Metadata Button Click
  if (refreshMetaBtn) {
    refreshMetaBtn.addEventListener("click", () => {
      refreshMetaBtn.style.transform = "rotate(360deg)";
      refreshMetaBtn.style.transition = "transform 0.4s ease";
      executePreAuthProfileCapture();
      setTimeout(() => {
        refreshMetaBtn.style.transform = "none";
        refreshMetaBtn.style.transition = "none";
      }, 400);
    });
  }

  // 5. Pipeline Group Management & Custom Studio Dropdown Renderer
  function renderPipelineGroups() {
    groupSelect.innerHTML = '<option value="">Select target pipeline...</option>';
    if (customGroupMenu) customGroupMenu.innerHTML = "";

    pipelineGroups.forEach((groupName, idx) => {
      const isDefault = idx === 0;
      const isLocked = !isProUser && idx > 0;
      const labelText = isLocked ? `🔒 ${groupName} (Pro)` : (isDefault ? `${groupName} (Default)` : groupName);

      // 1. Native option for background code & form sync
      const option = document.createElement("option");
      option.value = groupName;
      option.textContent = labelText;
      option.dataset.pro = isLocked ? "true" : "false";
      groupSelect.appendChild(option);

      // 2. Custom dropdown item for 100% pixel-perfect font rendering
      if (customGroupMenu) {
        const item = document.createElement("div");
        item.className = "custom-dropdown-item" + (isLocked ? " pro-locked" : "");
        item.dataset.value = groupName;
        item.dataset.pro = isLocked ? "true" : "false";
        item.textContent = labelText;

        item.addEventListener("click", (e) => {
          e.stopPropagation();
          if (isLocked) {
            showPaywallModal("Custom pipeline groups are unlocked exclusively for TagSilo Pro members. Upgrade to manage unlimited segmented tracking lists.");
            closeCustomDropdown();
            return;
          }
          selectPipelineGroup(groupName, labelText);
          closeCustomDropdown();
        });

        customGroupMenu.appendChild(item);
      }
    });

    if (pipelineGroups.length > 0) {
      groupSelect.selectedIndex = 1;
      const firstGroup = pipelineGroups[0];
      selectPipelineGroup(firstGroup, `${firstGroup} (Default)`, false);
    } else {
      selectPipelineGroup("", "Select target pipeline...", false);
    }
  }

  function selectPipelineGroup(value, displayText, triggerChange = true) {
    groupSelect.value = value;
    if (customGroupSelectedText) {
      customGroupSelectedText.textContent = displayText || value || "Select target pipeline...";
    }
    if (customGroupMenu) {
      customGroupMenu.querySelectorAll(".custom-dropdown-item").forEach((item) => {
        item.classList.toggle("selected", item.dataset.value === value);
      });
    }
    if (triggerChange) {
      groupSelect.dispatchEvent(new Event("change"));
    }
  }

  const pipelineGroupCard = document.getElementById("pipelineGroupCard");

  function toggleCustomDropdown(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!customGroupMenu) return;
    const isOpen = customGroupMenu.style.display === "flex";
    if (isOpen) {
      closeCustomDropdown();
    } else {
      customGroupMenu.style.display = "flex";
      if (customGroupTrigger) customGroupTrigger.classList.add("open");
      if (customGroupDropdownWrap) customGroupDropdownWrap.classList.add("open");
      if (pipelineGroupCard) pipelineGroupCard.classList.add("open");
    }
  }

  function closeCustomDropdown() {
    if (customGroupMenu) customGroupMenu.style.display = "none";
    if (customGroupTrigger) customGroupTrigger.classList.remove("open");
    if (customGroupDropdownWrap) customGroupDropdownWrap.classList.remove("open");
    if (pipelineGroupCard) pipelineGroupCard.classList.remove("open");
  }

  if (customGroupTrigger) {
    customGroupTrigger.addEventListener("click", toggleCustomDropdown);
  }

  document.addEventListener("click", (e) => {
    if (customGroupDropdownWrap && !customGroupDropdownWrap.contains(e.target)) {
      closeCustomDropdown();
    }
  });

  groupSelect.addEventListener("change", (e) => {
    const selectedOption = groupSelect.options[groupSelect.selectedIndex];
    if (!isProUser && selectedOption && selectedOption.dataset.pro === "true") {
      groupSelect.selectedIndex = 1;
      showPaywallModal("Custom pipeline groups are unlocked exclusively for TagSilo Pro members. Upgrade to manage unlimited segmented tracking lists.");
    }
  });

  if (manageGroupsBtn) {
    manageGroupsBtn.addEventListener("click", () => {
      openSettingsPage();
    });
  }

  // 6. Active Attached Tags Management (with instant remove & in-popup add)
  function renderActiveTags() {
    if (!activeTagsBox) return;
    activeTagsBox.innerHTML = "";
    const tagsArr = Array.from(activeTags).map(cleanTag).filter(Boolean);
    if (activeCountLabel) activeCountLabel.textContent = tagsArr.length.toString();

    if (tagsArr.length === 0) {
      activeTagsBox.innerHTML = '<span class="empty-tags-hint">No tags applied — select presets below</span>';
    } else {
      tagsArr.forEach((tag) => {
        const pill = document.createElement("span");
        pill.className = "active-tag-pill";

        const dotColor = TAG_COLORS[tag.toLowerCase()] || "var(--accent-cyan)";
        const dot = document.createElement("span");
        dot.className = "tag-dot";
        dot.style.backgroundColor = dotColor;

        const textSpan = document.createElement("span");
        textSpan.textContent = tag;

        const removeBtn = document.createElement("span");
        removeBtn.className = "active-tag-remove";
        removeBtn.innerHTML = "&times;";
        removeBtn.title = `Remove ${tag}`;
        removeBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          activeTags.delete(tag);
          // Also clear raw variant if present
          for (const t of Array.from(activeTags)) {
            if (cleanTag(t) === tag) activeTags.delete(t);
          }
          renderActiveTags();
          updateQuickTagButtons();
          if (inlineTagLimitBanner) inlineTagLimitBanner.classList.remove("visible");
        });

        pill.appendChild(dot);
        pill.appendChild(textSpan);
        pill.appendChild(removeBtn);
        activeTagsBox.appendChild(pill);
      });
    }

    updateTagCounterLabel();
  }

  const handleAddCustomActiveTag = async (e) => {
    if (e) e.preventDefault();
    if (!customActiveTagInput) return;
    const rawText = customActiveTagInput.value.trim();
    const text = cleanTag(rawText);
    if (!text) return;

    if (!isProUser && quickTags.length >= 2 && !quickTags.some((t) => cleanTag(t) === text)) {
      if (inlineTagLimitBanner) {
        inlineTagLimitBanner.textContent = "Free tier is limited to 2 profile tags. Upgrade to Pro for unlimited tags.";
        inlineTagLimitBanner.classList.add("visible");
      }
      return;
    }

    // Add to quick presets list (do NOT auto-select into activeTags)
    if (!quickTags.some((t) => cleanTag(t) === text)) {
      quickTags.push(text);
      await chrome.storage.local.set({ quick_tags: quickTags, tagsilo_tags: quickTags, quick_tags_initialized: true });
      try {
        await chrome.storage.sync.set({ quick_tags: quickTags, tagsilo_tags: quickTags, quick_tags_initialized: true });
      } catch (err) {}
      renderQuickTags();
    }

    customActiveTagInput.value = "";
    updateQuickTagButtons();
    if (inlineTagLimitBanner) inlineTagLimitBanner.classList.remove("visible");
  };

  if (addActiveTagBtn) {
    addActiveTagBtn.addEventListener("click", handleAddCustomActiveTag);
  }
  if (customActiveTagInput) {
    customActiveTagInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddCustomActiveTag(e);
      }
    });
  }

  // 7. Quick Add Tags Grid (Button pills with clean dot accents)
  function renderQuickTags() {
    if (!quickTagsGrid) return;
    quickTagsGrid.innerHTML = "";
    if (!quickTags || quickTags.length === 0) {
      const emptyHint = document.createElement("div");
      emptyHint.className = "empty-presets-hint";
      emptyHint.textContent = "No quick presets. Add custom tags above to create presets.";
      emptyHint.style.cssText = "font-size: 0.66rem; color: var(--text-tertiary); font-style: italic; padding: 2px 0;";
      quickTagsGrid.appendChild(emptyHint);
      updateTagCounterLabel();
      return;
    }

    quickTags.forEach((rawTag) => {
      const tag = cleanTag(rawTag);
      if (!tag) return;
      const isSelected = activeTags.has(tag) || activeTags.has(rawTag);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "quick-tag-btn" + (isSelected ? " active" : "");
      btn.dataset.tag = tag;

      const dotColor = TAG_COLORS[tag.toLowerCase()] || "var(--accent-cyan)";
      const dot = document.createElement("span");
      dot.className = "tag-dot";
      dot.style.backgroundColor = dotColor;

      const textSpan = document.createElement("span");
      textSpan.textContent = tag;

      const delSpan = document.createElement("span");
      delSpan.className = "quick-tag-delete";
      delSpan.innerHTML = "&times;";
      delSpan.title = `Delete "${tag}" preset`;
      delSpan.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        quickTags = quickTags.filter((t) => cleanTag(t) !== tag);
        await chrome.storage.local.set({ quick_tags: quickTags, tagsilo_tags: quickTags, quick_tags_initialized: true });
        try {
          await chrome.storage.sync.set({ quick_tags: quickTags, tagsilo_tags: quickTags, quick_tags_initialized: true });
        } catch (err) {}
        renderQuickTags();
      });

      btn.appendChild(dot);
      btn.appendChild(textSpan);
      btn.appendChild(delSpan);

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        if (activeTags.has(tag) || activeTags.has(rawTag)) {
          activeTags.delete(tag);
          activeTags.delete(rawTag);
          btn.classList.remove("active");
          if (inlineTagLimitBanner) inlineTagLimitBanner.classList.remove("visible");
        } else {
          if (!isProUser && activeTags.size >= 2) {
            if (inlineTagLimitBanner) inlineTagLimitBanner.classList.add("visible");
            return;
          }
          activeTags.add(tag);
          btn.classList.add("active");
          if (inlineTagLimitBanner) inlineTagLimitBanner.classList.remove("visible");
        }
        renderActiveTags();
      });

      quickTagsGrid.appendChild(btn);
    });

    updateTagCounterLabel();
  }

  function updateQuickTagButtons() {
    const buttons = quickTagsGrid.querySelectorAll(".quick-tag-btn");
    buttons.forEach((btn) => {
      const tag = btn.dataset.tag || cleanTag(btn.textContent);
      if (activeTags.has(tag)) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  }

  function updateTagCounterLabel() {
    const count = activeTags.size;
    if (isProUser) {
      tagLimitCounter.textContent = `${count} Applied`;
      tagLimitCounter.style.color = "var(--accent-lime)";
    } else {
      tagLimitCounter.textContent = `${count} of 2 Applied`;
      tagLimitCounter.style.color = count >= 2 ? "#fbbf24" : "var(--text-secondary)";
    }
  }

  if (manageTagsBtn) {
    manageTagsBtn.addEventListener("click", () => {
      openSettingsPage();
    });
  }

  // Persistent Spreadsheet Navigation Link
  async function refreshSpreadsheetShortcutLink() {
    const { active_google_sheet_id } = await chrome.storage.local.get("active_google_sheet_id");
    if (active_google_sheet_id && sheetShortcutLink) {
      sheetShortcutLink.href = `https://docs.google.com/spreadsheets/d/${active_google_sheet_id}/edit`;
      sheetShortcutLink.textContent = "Open Pipeline Sheet ↗";
      sheetShortcutLink.style.display = "inline-block";
    }
  }

  // Local Daily Rolling Cap Check & Pro Tier Sync
  async function refreshTierAndCapStatus() {
    try {
      // 1. Direct local storage check for instantaneous response
      const { license_tier, is_pro, creem_discount_code, creem_license_key } = await chrome.storage.local.get([
        "license_tier",
        "is_pro",
        "creem_discount_code",
        "creem_license_key"
      ]);

      if (is_pro === true || license_tier === "pro" || (creem_discount_code && creem_discount_code.trim() !== "")) {
        isProUser = true;
        licenseTier = "pro";
        headerTierBadge.textContent = "PRO";
        headerTierBadge.className = "tier-badge pro";
        dailyCapIcon.textContent = "∞";
        dailyCapText.textContent = "Unlimited Sync";
        dailyCapPill.className = "quota-pill pro-pill";
        if (inlineTagLimitBanner) {
          inlineTagLimitBanner.classList.remove("visible");
          inlineTagLimitBanner.style.display = "none";
        }
        updateTagCounterLabel();
        renderPipelineGroups();
        return;
      }

      // 2. Query Background Worker Check
      const response = await chrome.runtime.sendMessage({ action: "CHECK_SYNC_CAP" });
      if (response && response.success) {
        const { status } = response;
        isProUser = status.isPro;
        licenseTier = status.tier || (isProUser ? "pro" : "free");
        dailyCount = status.count;
        isCapped = status.isCapped;

        if (isProUser) {
          headerTierBadge.textContent = "PRO";
          headerTierBadge.className = "tier-badge pro";
          dailyCapIcon.textContent = "∞";
          dailyCapText.textContent = "Unlimited Sync";
          dailyCapPill.className = "quota-pill pro-pill";
          if (inlineTagLimitBanner) {
            inlineTagLimitBanner.classList.remove("visible");
            inlineTagLimitBanner.style.display = "none";
          }
          renderPipelineGroups();
        } else {
          headerTierBadge.textContent = "FREE";
          headerTierBadge.className = "tier-badge free";
          dailyCapIcon.textContent = "⚡";
          dailyCapText.textContent = `${dailyCount}/3 Saves`;

          if (dailyCount >= 3) {
            dailyCapPill.className = "quota-pill capped";
          } else if (dailyCount === 2) {
            dailyCapPill.className = "quota-pill near-limit";
          } else {
            dailyCapPill.className = "quota-pill";
          }
        }
        updateTagCounterLabel();
      }
    } catch (e) {
      console.warn("[TagSilo Pro] Cap refresh note:", e);
    }
  }

  // Real-time synchronization across Options & Popup
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" || area === "sync") {
      if (changes.license_tier || changes.is_pro || changes.creem_discount_code || changes.creem_license_key) {
        refreshTierAndCapStatus();
      }
      if (changes.active_google_sheet_id) {
        refreshSpreadsheetShortcutLink();
      }
    }
  });

  // Cross-Browser Silent Token Renewal via Serverless Backend Proxy
  // Cross-Browser Silent Token Renewal via Serverless Backend Proxy
  async function refreshGoogleAccessToken() {
    try {
      const [localData, syncData] = await Promise.all([
        chrome.storage.local.get(["tagsilo_google_refresh_token", "tagsilo_google_user", "tagsilo_token_acquired_at"]),
        chrome.storage.sync.get(["tagsilo_google_refresh_token", "tagsilo_google_user", "tagsilo_token_acquired_at"]).catch(() => ({}))
      ]);

      const refreshToken = localData.tagsilo_google_refresh_token || syncData.tagsilo_google_refresh_token || "";
      const email = localData.tagsilo_google_user?.email || syncData.tagsilo_google_user?.email || "";
      if (!refreshToken && !email) return null;

      const res = await fetch(`${DEFAULT_VERCEL_URL}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refresh_token: refreshToken || "",
          email: email
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.access_token) {
          const freshToken = data.access_token;
          const freshRefreshToken = data.refresh_token || refreshToken;
          const freshAcquiredAt = data.acquired_at || Date.now();

          await Promise.all([
            chrome.storage.local.set({
              tagsilo_google_access_token: freshToken,
              tagsilo_google_refresh_token: freshRefreshToken,
              tagsilo_token_acquired_at: freshAcquiredAt
            }),
            chrome.storage.sync.set({
              tagsilo_google_refresh_token: freshRefreshToken,
              tagsilo_token_acquired_at: freshAcquiredAt
            }).catch(() => {})
          ]);

          currentAuthToken = freshToken;
          return freshToken;
        }
      }
    } catch (err) {
      console.warn("[TagSilo Pro] Silent token refresh notice:", err);
    }
    return null;
  }

  // Cross-Browser Google Authorization (Edge, Chrome, Brave, Arc, Opera, Vivaldi compatible)
  async function authenticateWithGoogle(interactive = true) {
    // 1. For non-interactive (silent) check, always use serverless refresh first
    if (!interactive) {
      const refreshedToken = await refreshGoogleAccessToken();
      if (refreshedToken) {
        const { tagsilo_google_user } = await chrome.storage.local.get("tagsilo_google_user");
        return { token: refreshedToken, user: tagsilo_google_user };
      }

      // Safe check for Chrome Identity API (handles Edge / unsupported gracefully)
      try {
        if (chrome.identity && typeof chrome.identity.getAuthToken === "function") {
          const nativeToken = await new Promise((resolve) => {
            chrome.identity.getAuthToken({ interactive: false }, (tok) => {
              if (chrome.runtime.lastError) {
                const _ignored = chrome.runtime.lastError.message;
                return resolve(null);
              }
              resolve(tok || null);
            });
          });

          if (nativeToken) {
            const { tagsilo_google_user } = await chrome.storage.local.get("tagsilo_google_user");
            currentAuthToken = nativeToken;
            await chrome.storage.local.set({
              tagsilo_google_access_token: nativeToken,
              tagsilo_token_acquired_at: Date.now()
            });
            return { token: nativeToken, user: tagsilo_google_user };
          }
        }
      } catch (e) {}

      throw new Error("Silent authentication token not available.");
    }

    // 2. Interactive Google Authorization via launchWebAuthFlow (Guarantees permanent refresh token with prompt=consent)
    const returnUrl = chrome.identity.getRedirectURL("auth");
    const authEndpoint = `${DEFAULT_VERCEL_URL}/api/auth/google?redirect_to=${encodeURIComponent(returnUrl)}&chrome_id=${encodeURIComponent(chrome.runtime.id)}&prompt=consent%20select_account`;

    return new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        {
          url: authEndpoint,
          interactive: true
        },
        async (responseUrl) => {
          if (chrome.runtime.lastError || !responseUrl) {
            return reject(new Error(chrome.runtime.lastError?.message || "Google authentication was cancelled."));
          }

          try {
            const urlObj = new URL(responseUrl);
            const errParam = urlObj.searchParams.get("error");
            if (errParam) {
              return reject(new Error(urlObj.searchParams.get("error_description") || errParam));
            }

            const accessToken = urlObj.searchParams.get("token") || urlObj.searchParams.get("access_token");
            const refreshToken = urlObj.searchParams.get("refresh_token") || "";
            const userRaw = urlObj.searchParams.get("user");

            if (!accessToken) {
              return reject(new Error("No access token parameter found in OAuth redirect callback."));
            }

            let userProfile = null;
            if (userRaw) {
              try {
                userProfile = JSON.parse(decodeURIComponent(userRaw));
              } catch (e) {}
            }

            if (!userProfile || !userProfile.email) {
              try {
                const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
                  headers: { Authorization: `Bearer ${accessToken}` }
                });
                if (userRes.ok) {
                  userProfile = await userRes.json();
                }
              } catch (e) {}
            }

            const googleUser = {
              email: userProfile?.email || "Google Account Connected",
              name: userProfile?.name || "",
              picture: userProfile?.picture || "",
              lastAuth: new Date().toISOString()
            };

            currentAuthToken = accessToken;
            currentGoogleUser = googleUser;

            await Promise.all([
              chrome.storage.local.set({
                tagsilo_google_access_token: accessToken,
                tagsilo_google_user: googleUser,
                tagsilo_google_refresh_token: refreshToken,
                tagsilo_token_acquired_at: Date.now()
              }),
              chrome.storage.sync.set({
                tagsilo_google_user: googleUser,
                tagsilo_google_refresh_token: refreshToken,
                tagsilo_token_acquired_at: Date.now()
              }).catch(() => {})
            ]);

            // Auto-Ingest / Sync user lead into Supabase database (Free or Pro)
            syncUserToBackend(googleUser);

            resolve({
              token: accessToken,
              user: googleUser
            });
          } catch (parseErr) {
            reject(new Error("Failed to parse token from OAuth callback: " + parseErr.message));
          }
        }
      );
    });
  }

  // 1.1 Auto-Sync / Register user lead into Supabase PostgreSQL (Free or Pro)
  async function syncUserToBackend(googleUser) {
    if (!googleUser || !googleUser.email || googleUser.email.includes("Account Connected")) return;
    try {
      const serverUrl = DEFAULT_VERCEL_URL;
      await fetch(`${serverUrl}/api/user/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: googleUser.email,
          name: googleUser.name || "",
          picture: googleUser.picture || "",
          chromeId: chrome.runtime.id
        })
      });
    } catch (e) {
      console.warn("[TagSilo Pro] Background user sync notice:", e.message);
    }
  }

  // Robust Persistent Auth Check (No unwanted sign-outs!)
  async function checkGoogleAuthState() {
    const { tagsilo_google_access_token, tagsilo_google_user, tagsilo_google_refresh_token } = await chrome.storage.local.get([
      "tagsilo_google_access_token",
      "tagsilo_google_user",
      "tagsilo_google_refresh_token"
    ]);

    // 1. If stored user profile exists, IMMEDIATELY render them as authenticated (persistent session)
    if (tagsilo_google_user && tagsilo_google_user.email) {
      renderAuthenticatedUser(tagsilo_google_user, tagsilo_google_access_token || null);
    } else {
      renderUnauthenticatedUser();
      return;
    }

    // 2. Silently validate or refresh token in background
    let validToken = tagsilo_google_access_token;
    if (validToken) {
      try {
        const checkRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${validToken}` }
        });

        if (checkRes.ok) {
          const userProfile = await checkRes.json();
          currentAuthToken = validToken;
          currentGoogleUser = {
            email: userProfile?.email || tagsilo_google_user.email,
            name: userProfile?.name || tagsilo_google_user.name || "",
            picture: userProfile?.picture || tagsilo_google_user.picture || "",
            lastAuth: new Date().toISOString()
          };
          renderAuthenticatedUser(currentGoogleUser, currentAuthToken);
          return;
        }
      } catch (networkErr) {
        console.warn("[TagSilo Pro] Token verification network note:", networkErr);
      }
    }

    // 3. Token expired or invalid: Silently renew via refresh token in background
    try {
      const refreshedToken = await refreshGoogleAccessToken();
      if (refreshedToken) {
        currentAuthToken = refreshedToken;
        renderAuthenticatedUser(tagsilo_google_user, refreshedToken);
        return;
      }
    } catch (refreshErr) {
      console.warn("[TagSilo Pro] Background refresh note:", refreshErr);
    }

    // 4. Preserve authenticated UI state even if offline
    renderAuthenticatedUser(tagsilo_google_user, null);
  }

  function renderAuthenticatedUser(user, token) {
    currentGoogleUser = user;
    if (token) currentAuthToken = token;

    googleSignInBtn.style.display = "none";
    googleUserBar.style.display = "flex";
    userEmailText.textContent = user.email || "Google Account Connected";

    if (user.picture) {
      userAvatarImg.src = user.picture;
      userAvatarImg.style.display = "block";
      userAvatarPlaceholder.style.display = "none";
    } else {
      userAvatarImg.style.display = "none";
      userAvatarPlaceholder.style.display = "flex";
      userAvatarPlaceholder.textContent = (user.name || user.email || "G").charAt(0).toUpperCase();
    }
  }

  function renderUnauthenticatedUser() {
    currentAuthToken = null;
    currentGoogleUser = null;
    googleSignInBtn.style.display = "flex";
    googleUserBar.style.display = "none";
  }

  googleSignInBtn.addEventListener("click", async () => {
    googleSignInBtn.disabled = true;
    googleSignInBtn.style.opacity = "0.7";

    try {
      const authResult = await authenticateWithGoogle(true);
      renderAuthenticatedUser(authResult.user, authResult.token);
      await queryUserProfileStatus();
    } catch (err) {
      alert(err.message || "Google Sign-In was cancelled or failed.");
      renderUnauthenticatedUser();
    } finally {
      googleSignInBtn.disabled = false;
      googleSignInBtn.style.opacity = "1";
    }
  });

  disconnectGoogleBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (confirm("Disconnect Google Account from TagSilo Pro?")) {
      if (currentAuthToken) {
        try {
          await new Promise((r) => chrome.identity.removeCachedAuthToken({ token: currentAuthToken }, r));
        } catch (e) {}
      }
      await chrome.storage.local.remove(["tagsilo_google_access_token", "tagsilo_google_user"]);
      renderUnauthenticatedUser();
    }
  });

  // Notes Character Counter
  leadNotesInput.addEventListener("input", () => {
    const length = leadNotesInput.value.length;
    charCountLabel.textContent = `${length}/500`;
  });

  // 8. Central Synchronization Execution
  if (primarySyncBtn) {
    primarySyncBtn.addEventListener("click", async () => {
      // 1. Freemium Squeeze Rule: 3 saves per 24 hours
      if (!isProUser && dailyCount >= maxDaily) {
        showPaywallModal("You have reached your 3 daily profile saves on TagSilo Free. Upgrade to Pro for unlimited exports and custom workflows.");
        return;
      }

      // 2. Ensure Google Auth Token is active
      if (!currentAuthToken) {
        const storedTokens = await chrome.storage.local.get(["tagsilo_google_access_token", "tagsilo_google_user"]);
        if (storedTokens.tagsilo_google_access_token) {
          currentAuthToken = storedTokens.tagsilo_google_access_token;
        }
        if (storedTokens.tagsilo_google_user) {
          currentGoogleUser = storedTokens.tagsilo_google_user;
        }
      }

      if (!currentGoogleUser) {
        const confirmSignIn = confirm("Google Workspace is not connected.\n\nConnect your Google account now to synchronize leads directly to your Google Sheets spreadsheet?");
        if (!confirmSignIn) {
          return;
        }
        try {
          const authRes = await authenticateWithGoogle(true);
          currentAuthToken = authRes.token;
          renderAuthenticatedUser(authRes.user, authRes.token);
          await queryUserProfileStatus();
        } catch (authErr) {
          alert("Google Sign-In failed or was cancelled: " + authErr.message);
          return;
        }
      }

      // 3. Lead Name Validation
      const leadName = leadNameInput ? leadNameInput.value.trim() : "";
      if (!leadName) {
        if (leadNameInput) {
          leadNameInput.focus();
          leadNameInput.style.borderBottomColor = "var(--danger)";
          setTimeout(() => {
            leadNameInput.style.borderBottomColor = "";
          }, 2000);
        }
        alert("Please enter a Lead Full Name to synchronize this profile to your spreadsheet.");
        return;
      }

      setSyncLoadingState(true);

    try {
      const stored = await chrome.storage.local.get(["creem_license_key"]);
      let rawManualEmail = leadEmailInput ? leadEmailInput.value.replace(/^Email:\s*/i, "").trim() : "";
      if (rawManualEmail === "Cannot Find" || rawManualEmail === "Searching..." || rawManualEmail === "Unavailable") {
        rawManualEmail = "";
      }
      const finalEmail = rawManualEmail || (currentExtractedEmail && currentExtractedEmail !== "Unavailable" && currentExtractedEmail !== "Searching..." ? currentExtractedEmail : "Cannot Find");

      // Clean active tags for spreadsheet sync
      const cleanedTags = Array.from(activeTags).map(cleanTag).filter(Boolean);

      // 8-Field Data Payload matching exact Google Sheets sequence:
      // Column A: Saved Date | Column B: Full Name | Column C: Job Title | Column D: LinkedIn URL
      // Column E: Contact Email | Column F: Pipeline Group | Column G: Tags | Column H: Context Notes
      const profileData = {
        fullName: leadName,
        jobTitle: currentExtractedHeadline || (profileJobTitle ? profileJobTitle.textContent : "") || "",
        headline: currentExtractedHeadline || "",
        profileUrl: currentProfileUrl,
        email: finalEmail,
        group: groupSelect.value || "Prospects",
        tags: cleanedTags,
        notes: leadNotesInput.value.trim(),
        userEmail: currentGoogleUser?.email || ""
      };

      // 4. Proactive Token Refresh (Renew automatically before expiry to avoid interruptions)
      const { tagsilo_token_acquired_at } = await chrome.storage.local.get("tagsilo_token_acquired_at");
      if (tagsilo_token_acquired_at && (Date.now() - tagsilo_token_acquired_at > 50 * 60 * 1000)) {
        try {
          const freshToken = await refreshGoogleAccessToken();
          if (freshToken) currentAuthToken = freshToken;
        } catch (e) {}
      }

      // Execute Google Sheets Synchronization via Background Service Worker
      let response = await chrome.runtime.sendMessage({
        action: "EXECUTE_SYNC",
        profileData: profileData,
        googleAuthToken: currentAuthToken,
        creemLicenseKey: stored.creem_license_key || ""
      });

      // 5. If Token Expired, Auto-Refresh Google Token Silently and Retry Once
      const isAuthError = response && !response.success && response.error && (
        response.error.toLowerCase().includes("authentication credential") ||
        response.error.toLowerCase().includes("oauth") ||
        response.error.toLowerCase().includes("token") ||
        response.error.toLowerCase().includes("401") ||
        response.error.toLowerCase().includes("unauthorized")
      );

      if (isAuthError) {
        console.warn("[TagSilo Pro] Expired Google OAuth token detected. Attempting automatic recovery...");
        try {
          let freshToken = await refreshGoogleAccessToken();

          if (!freshToken) {
            // Prompt 1-click interactive re-authorization to renew the token seamlessly
            console.log("[TagSilo Pro] Silent token refresh unavailable. Launching Google authorization window...");
            const authResult = await authenticateWithGoogle(true);
            freshToken = authResult?.token || null;
          }

          if (freshToken) {
            currentAuthToken = freshToken;
            if (currentGoogleUser) renderAuthenticatedUser(currentGoogleUser, freshToken);

            response = await chrome.runtime.sendMessage({
              action: "EXECUTE_SYNC",
              profileData: profileData,
              googleAuthToken: freshToken,
              creemLicenseKey: stored.creem_license_key || ""
            });
          }
        } catch (reAuthErr) {
          console.warn("[TagSilo Pro] Automatic re-authentication notice:", reAuthErr);
        }
      }

      if (response && response.success) {
        const receivedSheetId = response.spreadsheetId || response.data?.spreadsheetId || (response.spreadsheetUrl ? response.spreadsheetUrl.split("/d/")[1]?.split("/")[0] : null);
        if (receivedSheetId) {
          await chrome.storage.local.set({ active_google_sheet_id: receivedSheetId });
          await refreshSpreadsheetShortcutLink();
        }

        const toastMsg = response.alreadyExists || response.updated
          ? "Profile was already saved! Updated record in Google Sheets."
          : "Profile Synced to Google Sheet!";

        showSuccessToast(response.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${receivedSheetId || "all"}/edit`, toastMsg);

        // Update Duplicate Banner State
        if (alreadyTaggedBanner && taggedDateText) {
          taggedDateText.textContent = `Saved on ${new Date().toLocaleDateString()} in group "${profileData.group}"`;
          alreadyTaggedBanner.classList.add("visible");
          syncBtnText.textContent = "Update Record in Google Sheets";
        }

        await queryUserProfileStatus();
      } else if (response && response.capped) {
        showPaywallModal("You've reached your 3 free saves today. Upgrade to Pro for instant unlimited saves for $9.99/mth");
      } else {
        const errMsg = response?.error || "Sync failed. Please ensure your Google Account is connected.";
        alert(errMsg);
      }
    } catch (err) {
      console.error("[TagSilo Pro] Sync Execution Error:", err);
      alert("Error during synchronization: " + err.message);
    } finally {
      setSyncLoadingState(false);
    }
  });
}

  function setSyncLoadingState(isLoading) {
    primarySyncBtn.disabled = isLoading;
    if (isLoading) {
      syncBtnSpinner.style.display = "block";
      syncBtnIcon.style.display = "none";
      syncBtnText.textContent = "Syncing Pipeline...";
    } else {
      syncBtnSpinner.style.display = "none";
      syncBtnIcon.style.display = "inline";
      syncBtnText.textContent = isProfileAlreadySaved ? "Update Record in Google Sheets" : "Sync Profile to Cloud Pipeline";
    }
  }

  function showSuccessToast(sheetUrl, customMessage) {
    if (customMessage) toastMessage.textContent = customMessage;
    toastSheetLink.href = sheetUrl;
    syncToast.classList.add("show");
    setTimeout(() => {
      syncToast.classList.remove("show");
    }, 4500);
  }

  // Paywall Slide-Up Modal Handlers (Strictly disabled for Pro users)
  function showPaywallModal(customMessage) {
    if (isProUser) {
      hidePaywallModal();
      return;
    }
    if (customMessage) {
      paywallDynamicMessage.textContent = customMessage;
    }
    paywallModalOverlay.style.display = "flex";
    paywallModalOverlay.classList.add("active");
  }

  function hidePaywallModal() {
    if (paywallModalOverlay) {
      paywallModalOverlay.classList.remove("active");
      paywallModalOverlay.style.display = "none";
    }
  }

  closePaywallBtn.addEventListener("click", hidePaywallModal);
  paywallModalOverlay.addEventListener("click", (e) => {
    if (e.target === paywallModalOverlay) hidePaywallModal();
  });

  // Dynamic Creem Checkout Portal Handler (POST /api/checkout)
  if (creemCheckoutBtn) {
    creemCheckoutBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      creemCheckoutBtn.style.opacity = "0.7";
      creemCheckoutBtn.innerHTML = "<span>Generating Checkout Session...</span>";

      try {
        const userId = currentGoogleUser?.email || "anonymous";
        const stored = await chrome.storage.local.get(["creem_discount_code", "creem_checkout_url"]);
        const discountCode = stored.creem_discount_code || "";

        const res = await fetch(`${backendApiUrl}/api/checkout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: userId,
            productId: "prod_2UzZ3KgIogYrqFFCZ4N9SP",
            userEmail: currentGoogleUser?.email || "",
            discountCode: discountCode,
            chromeId: chrome.runtime.id,
            successUrl: "https://creem.io/checkout/success",
            cancelUrl: "https://creem.io/checkout/cancel"
          })
        });

        if (res.ok) {
          const json = await res.json();
          if (json.checkoutUrl && json.checkoutUrl.startsWith("http")) {
            chrome.tabs.create({ url: json.checkoutUrl });
            hidePaywallModal();
            return;
          }
        }
      } catch (err) {
        console.warn("[TagSilo Pro] Checkout API attempt error:", err);
      } finally {
        creemCheckoutBtn.style.opacity = "1";
        creemCheckoutBtn.innerHTML = "<span>🚀 Upgrade to Pro for $9.99/mo</span>";
      }

      // Direct Test Payment Link Fallback with Parameters
      const { creem_discount_code } = await chrome.storage.local.get("creem_discount_code");
      const checkoutUrlObj = new URL("https://www.creem.io/test/product/prod_2UzZ3KgIogYrqFFCZ4N9SP");
      if (creem_discount_code) {
        checkoutUrlObj.searchParams.set("discount_code", creem_discount_code);
        checkoutUrlObj.searchParams.set("coupon", creem_discount_code);
      }
      if (currentGoogleUser?.email) {
        checkoutUrlObj.searchParams.set("email", currentGoogleUser.email);
        checkoutUrlObj.searchParams.set("user_id", currentGoogleUser.email);
      }

      chrome.tabs.create({ url: checkoutUrlObj.toString() });
      hidePaywallModal();
    });
  }

  if (enterLicenseLink) {
    enterLicenseLink.addEventListener("click", (e) => {
      e.preventDefault();
      hidePaywallModal();
      openSettingsPage();
    });
  }
});

/**
 * Injected script executed inside the active LinkedIn tab context.
 * MUST be defined OUTSIDE the DOMContentLoaded closure so chrome.scripting.executeScript
 * can serialize it as a standalone function.
 *
 * Fully isolated multi-layer extraction engine for Name, Headline, Image Avatar, and Email.
 */
async function extractLinkedInMetadataInPage() {
  const cleanUrl = window.location.href.split('?')[0].split('#')[0].replace(/\/overlay\/contact-info\/?.*$/i, "").replace(/\/$/, "");
  let name = "";
  let title = "";
  let image = "";
  let email = "";

  // -------------------------------------------------------------
  // STEP 1: AVATAR IMAGE EXTRACTION (FROM MAIN PROFILE TOP CARD FIRST)
  // Scraped immediately from main profile DOM before touching any modal.
  // -------------------------------------------------------------
  try {
    // A. Meta tags in main page head
    const ogImg = document.querySelector('meta[property="og:image"]')?.getAttribute("content") ||
                  document.querySelector('meta[name="image"]')?.getAttribute("content") ||
                  document.querySelector('meta[name="twitter:image"]')?.getAttribute("content");
    if (ogImg && !ogImg.includes("static.licdn.com/aero-v1/sc/h/") && !ogImg.includes("ghost") && !ogImg.includes("data:image")) {
      image = ogImg;
    }

    // B. Direct top-card profile image element selectors on main profile page
    if (!image) {
      const isModal = (el) => el.closest(".artdeco-modal") || el.closest("#pv-contact-info") || el.closest(".pv-contact-info") || el.closest("dialog") || el.closest("#global-nav");
      
      const topImg = document.querySelector("img.pv-top-card-profile-picture__image") ||
                     document.querySelector("img.pv-top-card-profile-picture__image--show") ||
                     document.querySelector("button.pv-top-card-profile-picture img") ||
                     document.querySelector("button[aria-label*='profile picture' i] img") ||
                     document.querySelector("button[aria-label*='photo' i] img") ||
                     document.querySelector("img.profile-photo-edit__preview") ||
                     document.querySelector("img.pv-top-card__photo") ||
                     document.querySelector("img.EntityPhoto-profile-3") ||
                     document.querySelector("img.EntityPhoto-profile-4") ||
                     document.querySelector("img.presence-entity__image") ||
                     document.querySelector(".pv-top-card__non-self-photo-wrapper img") ||
                     document.querySelector(".top-card-layout__entity-image") ||
                     document.querySelector("img[alt*='profile' i]") ||
                     document.querySelector("img[alt*='photo' i]");

      if (topImg && !isModal(topImg)) {
        const srcVal = topImg.src || topImg.getAttribute("data-delayed-url") || topImg.getAttribute("data-src") || "";
        if (srcVal && !srcVal.startsWith("data:image/svg") && !srcVal.includes("ghost") && !srcVal.includes("static.licdn.com/aero-v1/sc/h/")) {
          image = srcVal;
        }
      }

      // C. Fallback: Search any image inside the main top-card
      if (!image) {
        const mainCard = document.querySelector("main section.artdeco-card, .pv-top-card, .ph5, .top-card-layout");
        if (mainCard) {
          const imgs = mainCard.querySelectorAll("img");
          for (const imgEl of imgs) {
            if (isModal(imgEl)) continue;
            const srcVal = imgEl.src || imgEl.getAttribute("data-delayed-url") || imgEl.getAttribute("data-src") || "";
            if (srcVal && (srcVal.includes("media.licdn.com/dms/image/") || srcVal.includes("profile-displayphoto")) && !srcVal.includes("ghost")) {
              image = srcVal;
              break;
            }
          }
        }
      }
    }
  } catch (imgErr) {
    console.warn("[TagSilo] Main page avatar extraction note:", imgErr);
  }

  // -------------------------------------------------------------
  // STEP 2: HEADLINE & NAME EXTRACTION (DOM & VISUAL HIERARCHY)
  // -------------------------------------------------------------
  try {
    const nameEl = document.querySelector("h1.text-heading-xlarge") ||
                   document.querySelector(".top-card-layout__title") ||
                   document.querySelector(".pv-text-details__left-panel h1") ||
                   document.querySelector("main h1") ||
                   document.querySelector("section.artdeco-card h1") ||
                   document.querySelector("h1");
    if (nameEl) {
      name = (nameEl.innerText || nameEl.textContent || "").trim();
    }

    // Visual Hierarchy Scan from nameEl
    if (nameEl) {
      const card = nameEl.closest(".pv-text-details__left-panel") ||
                   nameEl.closest("section.artdeco-card") ||
                   nameEl.closest("section") ||
                   nameEl.closest("main") ||
                   document.body;

      const allEls = card.querySelectorAll("div, p, span, h2");
      for (const el of allEls) {
        if (nameEl.contains(el) || el.contains(nameEl) || el === nameEl) continue;
        if (el.closest("button") || el.closest("nav") || el.closest("header") || el.closest("a")) continue;

        const txt = (el.innerText || el.textContent || "").trim();
        if (!txt || txt.length < 8) continue;
        if (name && txt.toLowerCase() === name.toLowerCase()) continue;
        if (txt.toLowerCase().includes("contact info") || txt.toLowerCase().includes("mutual connection") || txt.toLowerCase().includes("follower")) continue;
        if (/^\([a-z\/\s]+\)$/i.test(txt)) continue;
        if (/^(1st|2nd|3rd|verified|premium)$/i.test(txt)) continue;

        title = txt;
        break;
      }
    }

    // Direct Selectors
    if (!title) {
      const headlineSelectors = [
        ".pv-text-details__left-panel div.text-body-medium",
        "div.text-body-medium.break-words",
        ".pv-text-details__left-panel > div:nth-child(2)",
        "div[data-generated-suggestion-target]",
        "div[data-anonymize='headline']",
        "div[data-field='headline']",
        "div.top-card-layout__headline",
        "h2.top-card-layout__headline",
        "p.pv-top-card-section__headline",
        ".artdeco-entity-lockup__subtitle",
        ".ph5 div.text-body-medium",
        "section.artdeco-card div.text-body-medium"
      ];
      for (const sel of headlineSelectors) {
        const el = document.querySelector(sel);
        if (el) {
          const raw = (el.innerText || el.textContent || "").trim();
          if (raw && raw.length > 2 && (!name || raw.toLowerCase() !== name.toLowerCase()) && !raw.toLowerCase().includes("contact info")) {
            title = raw;
            break;
          }
        }
      }
    }
  } catch (e) {
    console.warn("[TagSilo] Headline DOM extraction note:", e);
  }

  // -------------------------------------------------------------
  // LAYER 2: HEADLINE FROM RAW BODY HTML REGEX & TEXT LINES
  // -------------------------------------------------------------
  if (!title) {
    try {
      const html = document.body ? document.body.innerHTML : "";
      const m = html.match(/<div[^>]*class="[^"]*text-body-medium[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                html.match(/<div[^>]*data-generated-suggestion-target[^>]*>([\s\S]*?)<\/div>/i);
      if (m && m[1]) {
        const clean = m[1].replace(/<[^>]+>/g, "").trim();
        if (clean && clean.length > 2 && (!name || clean.toLowerCase() !== name.toLowerCase()) && !clean.toLowerCase().includes("contact info")) {
          title = clean;
        }
      }
    } catch (e) {}
  }

  // -------------------------------------------------------------
  // LAYER 2B: IN-PAGE RENDERED TEXT LINE SCANNING
  // -------------------------------------------------------------
  if (!title && document.body && document.body.innerText) {
    try {
      const lines = document.body.innerText.split("\n").map(l => l.trim()).filter(Boolean);
      let nameIndex = -1;
      if (name) {
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase() === name.toLowerCase() || (lines[i].includes(name) && lines[i].length < name.length + 10)) {
            nameIndex = i;
            break;
          }
        }
      }
      if (nameIndex === -1) {
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes("connections") || lines[i].includes("Contact info") || lines[i].includes("mutual connection")) {
            nameIndex = Math.max(0, i - 4);
            break;
          }
        }
      }
      for (let i = nameIndex + 1; i < Math.min(lines.length, nameIndex + 8); i++) {
        const line = lines[i];
        if (!line || line.length < 8) continue;
        if (/^\([a-z\/\s]+\)$/i.test(line)) continue;
        if (line.includes("degree connection") || line.includes("mutual connection")) continue;
        if (line.includes("Contact info") || line.includes("connections") || line.includes("followers")) continue;
        if (/^(1st|2nd|3rd|verified|premium|message|follow|connect|more)$/i.test(line)) continue;
        if (line.startsWith("View ") && line.includes("profile")) continue;

        title = line;
        break;
      }
    } catch (e) {}
  }

  // -------------------------------------------------------------
  // LAYER 3: JSON-LD STRUCTURED DATA
  // -------------------------------------------------------------
  try {
    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of jsonLdScripts) {
      try {
        const data = JSON.parse(script.textContent);
        const items = Array.isArray(data) ? data : (data["@graph"] || [data]);
        for (const item of items) {
          if (!item) continue;
          if (item["@type"] === "Person" || item["@type"] === "http://schema.org/Person") {
            if (!name) name = item.name || ((item.givenName || "") + " " + (item.familyName || "")).trim();
            if (!title) {
              const h = Array.isArray(item.jobTitle) ? item.jobTitle.join(", ") : (item.jobTitle || item.worksFor?.name || item.description || item.headline);
              if (h && typeof h === "string" && h.trim().length > 2) title = h.trim();
            }
            if (!image && item.image) image = typeof item.image === "string" ? item.image : (item.image.contentUrl || item.image.url || "");
            if (!email && item.email) email = item.email;
          }
        }
      } catch (e) {}
    }
  } catch (e) {}

  // -------------------------------------------------------------
  // LAYER 4: META TAGS & DOCUMENT TITLE (UNIVERSAL UNICODE SPLITTING)
  // -------------------------------------------------------------
  if (!title) {
    try {
      const ogDesc = document.querySelector('meta[property="og:description"]')?.getAttribute("content") ||
                     document.querySelector('meta[name="description"]')?.getAttribute("content") ||
                     document.querySelector('meta[name="twitter:description"]')?.getAttribute("content") || "";
      if (ogDesc) {
        let clean = ogDesc.replace(/^View\s+[^']+'s?\s+profile\s+on\s+LinkedIn[^.]*\.\s*/i, "");
        clean = clean.split(/[\s·•|]\s*(Experience|Education|Location|\d+\+?\s+connection)/i)[0].trim();
        clean = clean.split(" · ")[0].split("Experience:")[0].split("·")[0].replace(/\d+\+?\s+connections.*/i, "").trim();
        if (clean && clean.length > 2 && (!name || clean.toLowerCase() !== name.toLowerCase())) {
          title = clean;
        } else if (ogDesc.trim() && (!name || ogDesc.trim().toLowerCase() !== name.toLowerCase())) {
          title = ogDesc.trim();
        }
      }
    } catch (e) {}
  }

  if (!title) {
    try {
      const rawTitle = document.title || document.querySelector('meta[property="og:title"]')?.getAttribute("content") || "";
      const cleanTitle = rawTitle.replace(/\| LinkedIn$/i, "").replace(/LinkedIn/i, "").trim();
      const parts = cleanTitle.split(/\s*[-–—|:]\s*/);
      if (parts.length >= 2) {
        const candidate = parts.slice(1).join(" - ").trim();
        if (candidate.length > 2 && (!name || candidate.toLowerCase() !== name.toLowerCase())) {
          title = candidate;
        }
      }
    } catch (e) {}
  }

  if (!name) {
    try {
      const rawTitle = document.title || "";
      const cleanTitle = rawTitle.replace(/\| LinkedIn$/i, "").replace(/LinkedIn/i, "").trim();
      const parts = cleanTitle.split(/\s*[-–—|:]\s*/);
      if (parts.length >= 1 && parts[0].trim()) {
        name = parts[0].trim();
      }
    } catch (e) {}
  }

  // -------------------------------------------------------------
  // LAYER 4B: BACKGROUND FETCH OF CANONICAL URL (GUARANTEED BACKSTOP)
  // -------------------------------------------------------------
  if ((!title || title === "Profile Member") && cleanUrl.includes("linkedin.com/in/")) {
    try {
      const res = await fetch(cleanUrl, { credentials: "include" });
      if (res.ok) {
        const html = await res.text();
        const m = html.match(/<div[^>]*class="[^"]*text-body-medium[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                  html.match(/<div[^>]*data-generated-suggestion-target[^>]*>([\s\S]*?)<\/div>/i);
        if (m && m[1]) {
          const stripped = m[1].replace(/<[^>]+>/g, "").trim();
          if (stripped && stripped.length > 2 && (!name || stripped.toLowerCase() !== name.toLowerCase())) title = stripped;
        }

        if (!title) {
          const ogM = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
          if (ogM && ogM[1]) {
            let clean = ogM[1].replace(/^View\s+[^']+'s?\s+profile\s+on\s+LinkedIn[^.]*\.\s*/i, "");
            clean = clean.split(/[\s·•|]\s*(Experience|Education|Location|\d+\+?\s+connection)/i)[0].trim();
            clean = clean.split(" · ")[0].split("Experience:")[0].split("·")[0].replace(/\d+\+?\s+connections.*/i, "").trim();
            if (clean && clean.length > 2 && (!name || clean.toLowerCase() !== name.toLowerCase())) title = clean;
          }
        }

        if (!title) {
          const tM = html.match(/<title>([^<]+)<\/title>/i);
          if (tM && tM[1]) {
            const cleanTitle = tM[1].replace(/\| LinkedIn$/i, "").replace(/LinkedIn/i, "").trim();
            const parts = cleanTitle.split(/\s*[-–—|:]\s*/);
            if (parts.length >= 2) {
              const candidate = parts.slice(1).join(" - ").trim();
              if (candidate.length > 2 && (!name || candidate.toLowerCase() !== name.toLowerCase())) title = candidate;
            }
          }
        }
      }
    } catch (e) {}
  }



  // -------------------------------------------------------------
  // LAYER 6: EMAIL EXTRACTION (SAFE & ISOLATED)
  // -------------------------------------------------------------
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
  const isUserEmail = (eStr) => {
    if (!eStr || typeof eStr !== "string") return false;
    const lower = eStr.trim().toLowerCase();
    if (lower.endsWith("@linkedin.com") || lower.endsWith("@licdn.com") || lower.endsWith("@example.com") || lower.endsWith("@w3.org") || lower.endsWith("@schema.org")) return false;
    if (lower.startsWith("support@") || lower.startsWith("info@") || lower.startsWith("help@") || lower.startsWith("no-reply@") || lower.startsWith("donotreply@")) return false;
    return true;
  };
  const findEmailInText = (text) => {
    if (!text) return "";
    const matches = text.match(emailRegex);
    if (matches) {
      const valid = matches.find(isUserEmail);
      if (valid) return valid.trim();
    }
    return "";
  };

  try {
    const mailtoLinks = document.querySelectorAll('a[href^="mailto:"]');
    for (const a of mailtoLinks) {
      const raw = a.href.replace(/^mailto:/i, "").split("?")[0].trim();
      if (isUserEmail(raw)) { email = raw; break; }
    }
  } catch (e) {}

  if (!email) {
    try {
      const codeTags = document.querySelectorAll("code");
      for (const code of codeTags) {
        const text = code.textContent || "";
        if (text.includes("@")) {
          const found = findEmailInText(text);
          if (found) { email = found; break; }
        }
      }
    } catch (e) {}
  }

  // 6C. Contact Info Modal Laser Trigger (Targets ONLY /overlay/contact-info/ link, excludes photos/avatars)
  if (!email) {
    try {
      // 1. Check if Contact Info modal is already open
      let modal = document.querySelector(".pv-contact-info") ||
                  document.querySelector("section.ci-email") ||
                  document.querySelector("#pv-contact-info") ||
                  document.querySelector(".artdeco-modal");
      if (modal) {
        const mailtoModal = modal.querySelector('a[href^="mailto:"]');
        if (mailtoModal) {
          const raw = mailtoModal.href.replace(/^mailto:/i, "").split("?")[0].trim();
          if (isUserEmail(raw)) email = raw;
        }
        if (!email) {
          const found = findEmailInText(modal.innerText || modal.innerHTML);
          if (found) email = found;
        }
      }

      // 2. If modal not open, find and click ONLY the Contact Info link (strictly excluding photos/avatars)
      if (!email) {
        const isExcluded = (el) => {
          if (!el) return true;
          const cls = (el.className || "").toString().toLowerCase();
          const aria = (el.getAttribute("aria-label") || "").toLowerCase();
          if (cls.includes("photo") || cls.includes("picture") || cls.includes("avatar") || cls.includes("image") || cls.includes("profile-picture")) return true;
          if (aria.includes("photo") || aria.includes("picture") || aria.includes("avatar") || aria.includes("image") || aria.includes("edit profile")) return true;
          if (el.querySelector("img, picture, svg.pv-top-card-profile-picture")) return true;
          return false;
        };

        let contactBtn = document.querySelector('a[href*="/overlay/contact-info/"]') ||
                         document.querySelector('a#top-card-text-details-contact-info') ||
                         document.querySelector('a.ember-view[href*="contact-info"]') ||
                         document.querySelector('a[data-control-name="contact_see_more"]');

        if (!contactBtn || isExcluded(contactBtn)) {
          const candidateLinks = document.querySelectorAll(".pv-text-details__left-panel a, .ph5 a, main a");
          for (const l of candidateLinks) {
            if (isExcluded(l)) continue;
            const href = (l.getAttribute("href") || "").toLowerCase();
            const text = (l.innerText || l.textContent || "").trim().toLowerCase();
            if (href.includes("overlay/contact-info") || text === "contact info" || (text.includes("contact info") && !text.includes("photo"))) {
              contactBtn = l;
              break;
            }
          }
        }

        if (contactBtn && !isExcluded(contactBtn)) {
          contactBtn.click();

          // Wait up to 1200ms for modal content to mount
          const start = Date.now();
          while (Date.now() - start < 1200) {
            await new Promise((r) => setTimeout(r, 100));
            const poppedModal = document.querySelector(".pv-contact-info") ||
                                document.querySelector("section.ci-email") ||
                                document.querySelector("#pv-contact-info") ||
                                document.querySelector(".artdeco-modal");
            if (poppedModal) {
              const mailto = poppedModal.querySelector('a[href^="mailto:"]');
              if (mailto) {
                const raw = mailto.href.replace(/^mailto:/i, "").split("?")[0].trim();
                if (isUserEmail(raw)) { email = raw; break; }
              }
              const found = findEmailInText(poppedModal.innerText || poppedModal.innerHTML);
              if (found) { email = found; break; }
            }
          }

          // Cleanly dismiss the modal after reading to leave page pristine
          const poppedModal = document.querySelector(".artdeco-modal") || document.querySelector(".pv-contact-info");
          if (poppedModal) {
            const dismissBtn = poppedModal.querySelector('button[aria-label="Dismiss"]') ||
                               poppedModal.querySelector('.artdeco-modal__dismiss') ||
                               poppedModal.querySelector('button[data-test-modal-close-btn]');
            if (dismissBtn) {
              try { dismissBtn.click(); } catch (e) {}
            }
          }
        }
      }
    } catch (e) {
      console.warn("[TagSilo] In-page contact-info note:", e);
    }
  }

  // 6D. Asynchronous Background Contact Info Fetch Fallback
  if (!email && location.hostname.includes("linkedin.com") && location.pathname.includes("/in/")) {
    try {
      const baseUrl = location.origin + location.pathname.replace(/\/overlay\/contact-info\/?.*$/i, "").replace(/\/$/, "");
      const contactUrl = baseUrl + "/overlay/contact-info/";
      const response = await fetch(contactUrl, {
        headers: { "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
        credentials: "include"
      });
      if (response.ok) {
        const htmlText = await response.text();
        const mailtoMatch = htmlText.match(/href=["']mailto:([^"'?]+)["']/i);
        if (mailtoMatch && mailtoMatch[1] && isUserEmail(mailtoMatch[1])) {
          email = mailtoMatch[1].trim();
        } else {
          const found = findEmailInText(htmlText);
          if (found) email = found;
        }
      }
    } catch (err) {}
  }

  // 6E. Fallback search in document text
  if (!email && document.body) {
    try {
      const found = findEmailInText(document.body.innerText || document.body.innerHTML || "");
      if (found) email = found;
    } catch (e) {}
  }

  return {
    name: name || "LinkedIn Profile",
    fullName: name || "LinkedIn Profile",
    title: title || "Profile Member",
    headline: title || "Profile Member",
    jobTitle: title || "Profile Member",
    image: image || "",
    avatarUrl: image || "",
    url: cleanUrl,
    email: email || "Cannot Find"
  };
}
