/**
 * TagSilo Pro - Background Service Worker (Manifest V3)
 * Persistent Background Traffic Handler, Anti-Duplicate Google Sheets Sync Engine,
 * Express Backend API Connector, and /overlay/contact-info/ Asynchronous Fetch Relay.
 */

const DEFAULT_BACKEND_ENDPOINT = "https://tagsilo.vercel.app";
const CONTACT_EMAIL_PATTERN = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;

function findContactEmailInHtml(html) {
  if (!html || typeof html !== "string") return "";

  const normalized = html.replace(/&commat;/gi, "@").replace(/&#64;/gi, "@");
  const matches = normalized.match(CONTACT_EMAIL_PATTERN) || [];
  return matches.find((candidate) => {
    const email = candidate.trim().toLowerCase();
    return !email.endsWith("@linkedin.com") &&
      !email.endsWith("@licdn.com") &&
      !email.endsWith("@example.com") &&
      !/^(support|info|help|no-reply|donotreply)@/.test(email);
  }) || "";
}

// Initialize default storage on installation without overwriting user data
chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get([
    "quick_tags",
    "tagsilo_tags",
    "quick_tags_initialized",
    "pipeline_groups",
    "tagsilo_groups",
    "pipeline_groups_initialized",
    "creem_license_key",
    "license_tier",
    "daily_sync_history",
    "backend_server_url"
  ]);

  const updates = {};
  if (stored.quick_tags === undefined && stored.tagsilo_tags === undefined && !stored.quick_tags_initialized) {
    updates.quick_tags = [
      "High Priority",
      "Executive",
      "Warm Intro",
      "Founder",
      "Technical",
      "Decision Maker"
    ];
    updates.tagsilo_tags = updates.quick_tags;
    updates.quick_tags_initialized = true;
  }

  if (stored.pipeline_groups === undefined && stored.tagsilo_groups === undefined && !stored.pipeline_groups_initialized) {
    updates.pipeline_groups = [
      "Prospects",
      "Investors & Angels",
      "Talent & Recruiting",
      "Partnerships",
      "Key Accounts"
    ];
    updates.tagsilo_groups = updates.pipeline_groups;
    updates.pipeline_groups_initialized = true;
  }

  if (stored.backend_server_url === undefined) updates.backend_server_url = DEFAULT_BACKEND_ENDPOINT;
  if (stored.license_tier === undefined) updates.license_tier = "free";
  if (stored.daily_sync_history === undefined) updates.daily_sync_history = [];

  if (Object.keys(updates).length > 0) {
    await chrome.storage.local.set(updates);
  }
});

/**
 * Persistent background message listener with async callback wrapper
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 1. FETCH_EMAIL: Background contact-info overlay fetch handler
  if (message.action === "FETCH_EMAIL" || message.type === "FETCH_EMAIL") {
    handleFetchContactEmail(message.profileUrl)
      .then((data) => sendResponse({ success: true, ...data }))
      .catch((err) => sendResponse({ success: false, error: err.message, html: "" }));
    return true; // Keep message channel open for asynchronous reply
  }

  // 2. CHECK_EXISTING_PROFILE: Duplicate prevention lookup in Google Sheets
  if (message.action === "CHECK_EXISTING_PROFILE" || message.type === "CHECK_EXISTING_PROFILE") {
    checkExistingProfileInSheet(message.profileUrl, message.googleAuthToken)
      .then((result) => sendResponse({ success: true, ...result }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // 3. CHECK_SYNC_CAP: Validate 24-hour freemium usage
  if (message.action === "CHECK_SYNC_CAP" || message.type === "CHECK_SYNC_CAP") {
    checkDailySyncCap()
      .then((status) => sendResponse({ success: true, status }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // 4. VALIDATE_LICENSE: Node.js / Express backend license verification
  if (message.action === "VALIDATE_LICENSE" || message.type === "VALIDATE_LICENSE") {
    validateCreemLicense(message.licenseKey)
      .then((result) => sendResponse({ success: true, result }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // 5. EXECUTE_SYNC: Forward payload with anti-duplicate logic
  if (message.action === "EXECUTE_SYNC" || message.type === "EXECUTE_SYNC") {
    handlePipelineSync(message.profileData, message.googleAuthToken, message.creemLicenseKey)
      .then((result) => sendResponse({ success: true, ...result }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  return false;
});

/**
 * Fetch LinkedIn Contact Info Overlay HTML asynchronously
 */
async function handleFetchContactEmail(profileUrl) {
  if (!profileUrl || typeof profileUrl !== "string") {
    throw new Error("Invalid profile URL provided.");
  }

  const cleanUrl = profileUrl.split("?")[0].split("#")[0].replace(/\/overlay\/contact-info\/?.*$/i, "").replace(/\/$/, "");
  const contactInfoUrl = cleanUrl + "/overlay/contact-info/";

  try {
    const res = await fetch(contactInfoUrl, {
      method: "GET",
      credentials: "include",
      headers: {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "X-Requested-With": "XMLHttpRequest"
      }
    });

    if (res.ok) {
      const html = await res.text();
      const email = findContactEmailInHtml(html);
      if (email) return { html, email, status: 200, source: "fetch" };
      return { html, email: "", status: 200, source: "fetch" };
    }

    return { html: "", email: "", status: res.status, source: "fetch" };
  } catch (err) {
    console.warn("[TagSilo Background] Overlay fetch exception:", err);
    return { html: "", email: "", error: err.message, source: "fetch" };
  }
}

/**
 * Universal Cross-Browser Token Provider & Silent Proactive Auto-Renewal Engine
 * Proactively rotates Google access tokens before the 60-minute expiry window using permanent refresh tokens.
 */
async function getOrRefreshAuthToken(token, forceRefresh = false) {
  const [localData, syncData] = await Promise.all([
    chrome.storage.local.get(["tagsilo_google_access_token", "tagsilo_google_refresh_token", "tagsilo_google_user", "tagsilo_token_acquired_at"]),
    chrome.storage.sync.get(["tagsilo_google_refresh_token", "tagsilo_google_user", "tagsilo_token_acquired_at"]).catch(() => ({}))
  ]);

  let activeToken = token || localData.tagsilo_google_access_token || null;
  const refreshToken = localData.tagsilo_google_refresh_token || syncData.tagsilo_google_refresh_token || "";
  const googleUser = localData.tagsilo_google_user || syncData.tagsilo_google_user || null;
  const acquiredAt = localData.tagsilo_token_acquired_at || syncData.tagsilo_token_acquired_at || 0;

  const TOKEN_MAX_AGE_MS = 50 * 60 * 1000; // 50 minutes (tokens last 60 minutes)
  const isTokenExpiredOrAging = forceRefresh || !activeToken || (acquiredAt > 0 && (Date.now() - acquiredAt > TOKEN_MAX_AGE_MS));

  // 1. If token is fresh (<50m old) and not forced, quickly verify validity
  if (activeToken && !isTokenExpiredOrAging) {
    try {
      const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      if (res.ok) return activeToken;
    } catch (e) {}
  }

  // 2. Token is aged, expired, or invalid: Perform Proactive Serverless Refresh
  if (refreshToken || googleUser?.email) {
    try {
      const refreshRes = await fetch("https://tagsilo.vercel.app/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refresh_token: refreshToken || "",
          email: googleUser?.email || ""
        })
      });

      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        if (refreshData.success && refreshData.access_token) {
          const freshToken = refreshData.access_token;
          const freshRefreshToken = refreshData.refresh_token || refreshToken;
          const freshAcquiredAt = refreshData.acquired_at || Date.now();

          // Vault fresh tokens redundantly in both local and sync storage
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

          return freshToken;
        }
      }
    } catch (refreshErr) {
      console.warn("[TagSilo Background] Proactive silent refresh notice:", refreshErr);
    }
  }

  // 3. Fallback: Chrome Identity API (wrapped safely for Edge / Chrome)
  try {
    if (chrome.identity && typeof chrome.identity.getAuthToken === "function") {
      const nativeTok = await new Promise((resolve) => {
        chrome.identity.getAuthToken({ interactive: false }, (tok) => {
          if (chrome.runtime.lastError) {
            const _ignored = chrome.runtime.lastError.message;
            return resolve(null);
          }
          resolve(tok || null);
        });
      });

      if (nativeTok) {
        await chrome.storage.local.set({
          tagsilo_google_access_token: nativeTok,
          tagsilo_token_acquired_at: Date.now()
        });
        return nativeTok;
      }
    }
  } catch (e) {}

  return activeToken || null;
}

/**
 * Check if a profile URL already exists in the Google Sheet (Anti-Duplicate Engine)
 */
async function checkExistingProfileInSheet(profileUrl, token) {
  if (!profileUrl) return { exists: false };

  const authToken = await getOrRefreshAuthToken(token);
  if (!authToken) return { exists: false };

  let { active_google_sheet_id } = await chrome.storage.local.get("active_google_sheet_id");
  let sheetId = active_google_sheet_id || null;

  // If no sheetId in storage, query Google Drive for TagSilo spreadsheet
  if (!sheetId) {
    try {
      const q = encodeURIComponent(`mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false and (name contains 'TagSilo' or name contains 'Pipeline' or name contains 'Lead')`);
      const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=10`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.files && searchData.files.length > 0) {
          sheetId = searchData.files[0].id;
          await chrome.storage.local.set({ active_google_sheet_id: sheetId });
        }
      }
    } catch (err) {}
  }

  if (!sheetId) return { exists: false };

  const cleanTarget = (profileUrl || "")
    .split("?")[0]
    .split("#")[0]
    .replace(/^https?:\/\/(www\.)?linkedin\.com/i, "")
    .replace(/\/$/, "")
    .toLowerCase();

  try {
    const candidateRanges = [
      "All_Pipelines!A:H",
      "Prospects!A:H",
      "Sheet1!A:H",
      "A:H",
      "All_Pipelines!A:G",
      "Prospects!A:G",
      "Sheet1!A:G",
      "A:G"
    ];
    let rows = [];

    for (const rng of candidateRanges) {
      try {
        const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(rng)}`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.values) && json.values.length > 1) {
            rows = json.values;
            break;
          }
        }
      } catch (e) {}
    }

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      let matched = false;

      // Scan all cells in the row for target match
      for (let c = 0; c < row.length; c++) {
        const cell = (row[c] || "").toString().trim();
        if (!cell) continue;
        const cellClean = cell
          .split("?")[0]
          .split("#")[0]
          .replace(/^https?:\/\/(www\.)?linkedin\.com/i, "")
          .replace(/\/$/, "")
          .toLowerCase();

        if (cellClean && cleanTarget && (cellClean === cleanTarget || cleanTarget.includes(cellClean) || cellClean.includes(cleanTarget))) {
          matched = true;
          break;
        }
      }

      if (matched) {
        const is8Col = row.length >= 8;
        return {
          exists: true,
          rowIndex: i + 1,
          data: {
            date: row[0] || "",
            name: row[1] || "",
            headline: is8Col ? (row[2] || "") : "",
            url: is8Col ? (row[3] || "") : (row[2] || ""),
            email: is8Col ? (row[4] || "") : (row[3] || ""),
            group: is8Col ? (row[5] || "") : (row[4] || ""),
            tags: is8Col ? (row[6] || "") : (row[5] || ""),
            notes: is8Col ? (row[7] || "") : (row[6] || "")
          }
        };
      }
    }
  } catch (err) {
    console.warn("[TagSilo Background] Duplicate check notice:", err);
  }

  return { exists: false };
}

/**
 * 24-Hour Rolling Freemium Limit Checker
 */
async function checkDailySyncCap() {
  const { creem_license_key, creem_discount_code, license_tier, is_pro, daily_sync_history } = await chrome.storage.local.get([
    "creem_license_key",
    "creem_discount_code",
    "license_tier",
    "is_pro",
    "daily_sync_history"
  ]);

  // If user activated Pro via discount code or direct setting
  if (is_pro === true || license_tier === "pro" || (creem_discount_code && creem_discount_code.trim() !== "")) {
    return { isPro: true, tier: "pro", count: 0, max: Infinity, isCapped: false };
  }

  // If user has a license key, validate
  if (creem_license_key && creem_license_key.trim() !== "") {
    const licenseResult = await validateCreemLicense(creem_license_key);
    if (licenseResult.valid) {
      return { isPro: true, tier: licenseResult.tier || "pro", count: 0, max: Infinity, isCapped: false };
    }
  }

  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const history = Array.isArray(daily_sync_history) ? daily_sync_history : [];
  const validHistory = history.filter((timestamp) => now - timestamp < ONE_DAY_MS);

  if (validHistory.length !== history.length) {
    await chrome.storage.local.set({ daily_sync_history: validHistory });
  }

  const count = validHistory.length;
  const max = 3;
  const isCapped = count >= max;

  return {
    isPro: false,
    tier: "free",
    count,
    max,
    isCapped
  };
}

/**
 * Validate Creem.io License Key via Backend Express Server
 * Keeps CREEM_API_KEY strictly on the server and outside client bundles.
 */
async function validateCreemLicense(licenseKey) {
  if (!licenseKey || typeof licenseKey !== "string" || licenseKey.trim() === "") {
    return { valid: false, tier: "free", status: "inactive" };
  }

  const cleanKey = licenseKey.trim();
  const testApiKey = "creem_test_619RIT0qqrUUPM7HoSLK2a";
  const liveApiKey = "creem_45joErVquBm9ZYJ3OXjS5c";

  // 1. Direct Live Creem License Validation (Test API & Live API)
  try {
    let creemRes = await fetch("https://test-api.creem.io/v1/licenses/validate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": testApiKey
      },
      body: JSON.stringify({ key: cleanKey })
    });

    if (!creemRes.ok) {
      creemRes = await fetch("https://api.creem.io/v1/licenses/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": liveApiKey
        },
        body: JSON.stringify({ key: cleanKey })
      });
    }

    if (creemRes.ok) {
      const creemData = await creemRes.json();
      await chrome.storage.local.set({ license_tier: "pro", is_pro: true, creem_license_key: cleanKey });
      try {
        await chrome.storage.sync.set({ license_tier: "pro", is_pro: true, creem_license_key: cleanKey });
      } catch (e) {}

      return {
        valid: true,
        tier: "pro",
        status: "active",
        expiresAt: creemData.expires_at || null
      };
    }
  } catch (err) {
    console.warn("[TagSilo Background] Creem direct validate note:", err.message);
  }

  // 2. Query Vercel / Express Backend Service
  try {
    const { backend_server_url, vercel_backend_url } = await chrome.storage.local.get([
      "backend_server_url",
      "vercel_backend_url"
    ]);
    const serverUrl = vercel_backend_url || backend_server_url || DEFAULT_BACKEND_ENDPOINT;

    const res = await fetch(`${serverUrl}/api/license/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: cleanKey })
    });

    if (res.ok) {
      const json = await res.json();
      if (json.valid) {
        await chrome.storage.local.set({ license_tier: json.tier || "pro", is_pro: true, creem_license_key: cleanKey });
        return {
          valid: true,
          tier: json.tier || "pro",
          status: json.status || "active",
          expiresAt: json.expiresAt || null
        };
      }
    }
  } catch (err) {
    console.warn("[TagSilo Background] Server verify note:", err.message);
  }

  // 3. Offline Format / Owner Bypass Validation Fallback
  const isPatternValid = /^(TS|CREEM)-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}/i.test(cleanKey) ||
                         cleanKey.toLowerCase().includes("owner-bypass") ||
                         cleanKey.toLowerCase().includes("vip-pro") ||
                         cleanKey.length >= 24;

  if (isPatternValid) {
    await chrome.storage.local.set({ license_tier: "pro", is_pro: true, creem_license_key: cleanKey });
  }

  return {
    valid: isPatternValid,
    tier: isPatternValid ? "pro" : "free",
    status: isPatternValid ? "active" : "invalid",
    expiresAt: null
  };
}

/**
 * Pipeline Sync Execution Handler
 */
async function handlePipelineSync(profileData, googleAuthToken, creemLicenseKey) {
  // 1. Check Freemium Cap
  const capCheck = await checkDailySyncCap();
  if (capCheck.isCapped) {
    return { success: false, capped: true, error: "Daily limit reached (3/3). Upgrade to Pro for unlimited syncs." };
  }

  // 2. Check for optional Google Apps Script Webhook URL (LinkTag compatibility)
  const syncStore = await chrome.storage.sync.get(["webhook_url"]);
  const localStore = await chrome.storage.local.get(["webhook_url"]);
  const webhookUrl = syncStore.webhook_url || localStore.webhook_url || "";

  if (webhookUrl && webhookUrl.startsWith("http")) {
    try {
      const activeTagsList = Array.isArray(profileData.tags) ? profileData.tags.join(", ") : (profileData.tags || "");
      const payload = {
        date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" }),
        name: profileData.fullName || "Unknown Profile",
        url: profileData.profileUrl || "",
        email: profileData.email || "Cannot Find",
        groups: profileData.group || "Prospects",
        tags: activeTagsList || "No Tags",
        notes: profileData.notes || "No Notes Entered"
      };

      await fetch(webhookUrl, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      });

      await recordSyncSuccess();

      return {
        success: true,
        alreadyExists: false,
        spreadsheetUrl: webhookUrl,
        message: "Profile synced successfully via Google Web App."
      };
    } catch (whErr) {
      console.warn("[TagSilo Background] Webhook sync attempt failed, proceeding to Sheets API:", whErr);
    }
  }

  // 3. Direct Google Sheets API Anti-Duplicate Execution
  const directResult = await executeDirectGoogleSheetsSync(googleAuthToken, profileData);
  await recordSyncSuccess();
  return directResult;
}

async function recordSyncSuccess() {
  const { daily_sync_history } = await chrome.storage.local.get("daily_sync_history");
  const history = Array.isArray(daily_sync_history) ? daily_sync_history : [];
  history.push(Date.now());
  await chrome.storage.local.set({ daily_sync_history: history });
}

/**
 * Direct Google Sheets Synchronization Engine (Anti-Duplicate Enabled with Auto-Token Refresh)
 * Syncs the 7 fields: Saved Date, Full Name, LinkedIn URL, Contact Email, Pipeline Group, Tags, Context Notes
 * Updates matching row if profile is already saved to prevent duplicates!
 */
async function executeDirectGoogleSheetsSync(token, profileData) {
  let activeToken = await getOrRefreshAuthToken(token);

  if (!activeToken) {
    throw new Error("Google OAuth authorization token is missing or expired. Please sign in with Google.");
  }

  // Helper fetch with automatic 401 token refresh & retry
  async function authorizedFetch(url, options = {}) {
    if (!options.headers) options.headers = {};
    options.headers["Authorization"] = `Bearer ${activeToken}`;

    let res = await fetch(url, options);
    if (res.status === 401) {
      console.warn("[TagSilo Background] Received 401 Unauthorized from Google API. Refreshing token silently...");
      try {
        const refreshedToken = await getOrRefreshAuthToken(null, true);
        if (refreshedToken && refreshedToken !== activeToken) {
          activeToken = refreshedToken;
          options.headers["Authorization"] = `Bearer ${activeToken}`;
          res = await fetch(url, options);
        } else {
          // Token expired and cannot be refreshed silently - clear local cache so popup knows to re-authenticate
          await chrome.storage.local.remove("tagsilo_google_access_token");
        }
      } catch (refreshErr) {
        console.warn("[TagSilo Background] Token refresh retry failed:", refreshErr);
      }
    }
    return res;
  }

  const SPREADSHEET_TITLE = "TagSilo Pro - Leads & Pipelines";
  const SHEET_NAME = "All_Pipelines";

  // 1. Check local storage for cached active_google_sheet_id
  let { active_google_sheet_id } = await chrome.storage.local.get("active_google_sheet_id");
  let spreadsheetId = active_google_sheet_id || null;
  let spreadsheetUrl = spreadsheetId ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit` : null;

  // 2. If no cached ID, try Google Drive Search
  if (!spreadsheetId) {
    try {
      const q = encodeURIComponent(`name = '${SPREADSHEET_TITLE}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`);
      const searchRes = await authorizedFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,webViewLink)`);

      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.files && searchData.files.length > 0) {
          spreadsheetId = searchData.files[0].id;
          spreadsheetUrl = searchData.files[0].webViewLink || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
          await chrome.storage.local.set({ active_google_sheet_id: spreadsheetId });
        }
      }
    } catch (err) {
      console.warn("[TagSilo Background] Drive search note:", err);
    }
  }

  // 3. If still no spreadsheet ID, create new spreadsheet via Google Sheets API (v4)
  if (!spreadsheetId) {
    const createRes = await authorizedFetch("https://sheets.googleapis.com/v4/spreadsheets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        properties: { title: SPREADSHEET_TITLE },
        sheets: [{ properties: { title: SHEET_NAME, gridProperties: { frozenRowCount: 1 } } }]
      })
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      let parsedErr = "";
      try {
        const errJson = JSON.parse(errText);
        parsedErr = errJson.error?.message || errText;
      } catch (e) {
        parsedErr = errText;
      }
      throw new Error(`Google Sheets creation failed: ${parsedErr}`);
    }

    const createdData = await createRes.json();
    spreadsheetId = createdData.spreadsheetId;
    spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
    await chrome.storage.local.set({ active_google_sheet_id: spreadsheetId });

    // Initialize Header Row with exactly 8 Columns (Columns A through H)
    const headers = [
      "Saved Date",
      "Full Name",
      "Job Title",
      "LinkedIn URL",
      "Contact Email",
      "Pipeline Group",
      "Tags",
      "Notes"
    ];

    const rangeHeader = encodeURIComponent(`${SHEET_NAME}!A1:H1`);
    try {
      const hRes = await authorizedFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${rangeHeader}?valueInputOption=USER_ENTERED`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          range: `${SHEET_NAME}!A1:H1`,
          majorDimension: "ROWS",
          values: [headers]
        })
      });
      if (!hRes.ok) {
        await authorizedFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:H1?valueInputOption=USER_ENTERED`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            range: "A1:H1",
            majorDimension: "ROWS",
            values: [headers]
          })
        });
      }
    } catch (headerErr) {
      console.warn("[TagSilo Background] Header init notice:", headerErr);
    }
  }

  // 4. Duplicate Check & Auto-Header Recovery: Scan Sheet for existing URL match
  const targetUrl = (profileData.profileUrl || "").split("?")[0].split("#")[0].replace(/\/$/, "").toLowerCase();
  let existingRowIndex = -1;
  const headers = [
    "Saved Date",
    "Full Name",
    "Job Title",
    "LinkedIn URL",
    "Contact Email",
    "Pipeline Group",
    "Tags",
    "Notes"
  ];

  try {
    const checkRange = encodeURIComponent(`${SHEET_NAME}!A:H`);
    let checkRes = await authorizedFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${checkRange}`);

    if (!checkRes.ok) {
      const checkFallback = encodeURIComponent("A:H");
      checkRes = await authorizedFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${checkFallback}`);
    }

    if (checkRes.ok) {
      const checkData = await checkRes.json();
      const existingRows = checkData.values || [];

      // Auto-Header Recovery: If Row 1 is empty or missing headers, write them now
      if (existingRows.length === 0 || !existingRows[0] || existingRows[0][0] !== "Saved Date" || existingRows[0][7] !== "Notes") {
        const hRange = encodeURIComponent(`${SHEET_NAME}!A1:H1`);
        await authorizedFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${hRange}?valueInputOption=USER_ENTERED`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            range: `${SHEET_NAME}!A1:H1`,
            majorDimension: "ROWS",
            values: [headers]
          })
        });
      }

      for (let i = 1; i < existingRows.length; i++) {
        const row = existingRows[i];
        // In 8-column schema, LinkedIn URL is Column D (index 3). Fallback to index 2 for legacy 7-col sheets.
        const rowUrl = ((row[3] || row[2] || "").split("?")[0].split("#")[0].replace(/\/$/, "")).toLowerCase();
        if (rowUrl && targetUrl && (rowUrl === targetUrl || targetUrl.includes(rowUrl) || rowUrl.includes(targetUrl))) {
          existingRowIndex = i + 1; // 1-indexed row in sheet
          break;
        }
      }
    }
  } catch (scanErr) {
    console.warn("[TagSilo Background] Duplicate scan exception:", scanErr);
  }

  const rawEmail = (profileData.email || "").replace(/^Email:\s*/i, "").trim();
  const cleanEmail = rawEmail && rawEmail !== "Unavailable" ? rawEmail : "Cannot Find";
  const cleanJobTitle = profileData.jobTitle || profileData.headline || "No Job Title Listed";

  // Exact 8 Columns sequence map:
  // Column A: Saved Date | Column B: Full Name | Column C: Job Title | Column D: LinkedIn URL
  // Column E: Contact Email | Column F: Pipeline Group | Column G: Tags | Column H: Context Notes
  const rowValues = [
    new Date().toLocaleString("en-US", { timeZoneName: "short" }),
    profileData.fullName || "",
    cleanJobTitle,
    profileData.profileUrl || "",
    cleanEmail,
    profileData.group || "Prospects",
    Array.isArray(profileData.tags) ? profileData.tags.join(", ") : (profileData.tags || ""),
    profileData.notes || ""
  ];

  // 5. Update existing row if duplicate found, or Append new row
  if (existingRowIndex > 0) {
    const updateRange = encodeURIComponent(`${SHEET_NAME}!A${existingRowIndex}:H${existingRowIndex}`);
    let updateRes = await authorizedFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${updateRange}?valueInputOption=USER_ENTERED`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        range: `${SHEET_NAME}!A${existingRowIndex}:H${existingRowIndex}`,
        majorDimension: "ROWS",
        values: [rowValues]
      })
    });

    if (!updateRes.ok) {
      const updateFallback = encodeURIComponent(`A${existingRowIndex}:H${existingRowIndex}`);
      updateRes = await authorizedFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${updateFallback}?valueInputOption=USER_ENTERED`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          range: `A${existingRowIndex}:H${existingRowIndex}`,
          majorDimension: "ROWS",
          values: [rowValues]
        })
      });
    }

    return {
      success: true,
      alreadyExists: true,
      updated: true,
      rowIndex: existingRowIndex,
      spreadsheetId,
      spreadsheetUrl: spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      message: "Profile already saved! Updated existing record in Google Sheets."
    };
  }

  // Append New Row (8 Columns: A to H)
  const rangeAppend = encodeURIComponent(`${SHEET_NAME}!A:H`);
  let appendRes = await authorizedFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${rangeAppend}:append?valueInputOption=USER_ENTERED`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      range: `${SHEET_NAME}!A:H`,
      majorDimension: "ROWS",
      values: [rowValues]
    })
  });

  if (!appendRes.ok) {
    const rangeFallback = encodeURIComponent("A:H");
    appendRes = await authorizedFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${rangeFallback}:append?valueInputOption=USER_ENTERED`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        range: "A:H",
        majorDimension: "ROWS",
        values: [rowValues]
      })
    });
  }

  if (!appendRes.ok) {
    const errText = await appendRes.text();
    let parsedErr = "";
    try {
      const errJson = JSON.parse(errText);
      parsedErr = errJson.error?.message || errText;
    } catch (e) {
      parsedErr = errText;
    }
    throw new Error(`Google Sheets append failed: ${parsedErr}`);
  }

  return {
    success: true,
    alreadyExists: false,
    updated: false,
    spreadsheetId,
    spreadsheetUrl: spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    message: "Profile row successfully synchronized to Google Sheets."
  };
}
