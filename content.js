/**
 * TagSilo Pro - In-Page Content Script
 * Runs at document_idle on all https://*.linkedin.com/in/* pages.
 * Actively monitors DOM mutations and SPA route changes to capture
 * Name, Headline, Avatar, and Email without modifying the page or triggering navigation loops.
 */

const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;

function isUserEmail(eStr) {
  if (!eStr || typeof eStr !== 'string') return false;
  const lower = eStr.trim().toLowerCase();
  if (lower.endsWith('@linkedin.com') || lower.endsWith('@licdn.com') || lower.endsWith('@example.com') || lower.endsWith('@w3.org') || lower.endsWith('@schema.org')) return false;
  if (lower.startsWith('support@') || lower.startsWith('info@') || lower.startsWith('help@') || lower.startsWith('no-reply@') || lower.startsWith('donotreply@')) return false;
  return true;
}

function findEmailInText(text) {
  if (!text) return '';
  const matches = text.match(emailRegex);
  if (matches) {
    const valid = matches.find(isUserEmail);
    if (valid) return valid.trim();
  }
  return '';
}

function extractHeadlineFromTextLines(text, personName) {
  if (!text) return null;
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let nameIndex = -1;

  if (personName) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase() === personName.toLowerCase() || (lines[i].includes(personName) && lines[i].length < personName.length + 10)) {
        nameIndex = i;
        break;
      }
    }
  }

  if (nameIndex === -1) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('connections') || lines[i].includes('Contact info') || lines[i].includes('mutual connection')) {
        nameIndex = Math.max(0, i - 4);
        break;
      }
    }
  }

  for (let i = nameIndex + 1; i < Math.min(lines.length, nameIndex + 8); i++) {
    const line = lines[i];
    if (!line || line.length < 8) continue;
    if (/^\([a-z\/\s]+\)$/i.test(line)) continue;
    if (line.includes('degree connection') || line.includes('mutual connection')) continue;
    if (line.includes('Contact info') || line.includes('connections') || line.includes('followers')) continue;
    if (/^(1st|2nd|3rd|verified|premium|message|follow|connect|more)$/i.test(line)) continue;
    if (line.startsWith('View ') && line.includes('profile')) continue;

    return line;
  }
  return null;
}

function extractHeadline(name) {
  // Method 1: Targeted DOM Selectors
  const selectors = [
    'div.text-body-medium.break-words',
    '.pv-text-details__left-panel .text-body-medium',
    '.pv-text-details__left-panel div.text-body-medium',
    '[data-generated-suggestion-target]',
    'div.top-card-layout__headline',
    'h2.top-card-layout__headline',
    'p.pv-top-card-section__headline',
    '[data-anonymize="headline"]',
    '[data-field="headline"]',
    '.artdeco-entity-lockup__subtitle',
    '.ph5 div.text-body-medium'
  ];

  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) {
      const txt = (el.innerText || el.textContent || '').trim();
      if (txt && txt.length > 2 && !txt.toLowerCase().includes('contact info')) {
        return txt;
      }
    }
  }

  // Method 2: Visual Hierarchy scan from h1
  const h1 = document.querySelector('h1.text-heading-xlarge') || document.querySelector('h1');
  if (h1) {
    const nameTxt = (h1.innerText || h1.textContent || '').trim();
    const card = h1.closest('.pv-text-details__left-panel') || h1.closest('section') || h1.closest('main') || document.body;
    const candidates = card.querySelectorAll('div, p, span, h2');
    for (const c of candidates) {
      if (h1.contains(c) || c.contains(h1) || c === h1) continue;
      if (c.closest('button') || c.closest('nav') || c.closest('header') || c.closest('a')) continue;
      const txt = (c.innerText || c.textContent || '').trim();
      if (!txt || txt.length < 8) continue;
      if (nameTxt && txt.toLowerCase() === nameTxt.toLowerCase()) continue;
      if (txt.toLowerCase().includes('contact info') || txt.toLowerCase().includes('connection') || txt.toLowerCase().includes('follower')) continue;
      if (/^\([a-z\/\s]+\)$/i.test(txt)) continue;
      if (/^(1st|2nd|3rd|verified|premium)$/i.test(txt)) continue;
      return txt;
    }
  }

  // Method 3: In-page Text Line Scanning
  if (document.body && document.body.innerText) {
    const lineRes = extractHeadlineFromTextLines(document.body.innerText, name);
    if (lineRes) return lineRes;
  }

  // Method 4: OpenGraph Description
  const ogDesc = document.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
                 document.querySelector('meta[name="description"]')?.getAttribute('content') ||
                 document.querySelector('meta[name="twitter:description"]')?.getAttribute('content');
  if (ogDesc) {
    let clean = ogDesc.replace(/^View\s+[^']+'s?\s+profile\s+on\s+LinkedIn[^.]*\.\s*/i, '');
    clean = clean.split(/[\s·•|]\s*(Experience|Education|Location|\d+\+?\s+connection)/i)[0].trim();
    clean = clean.split(' · ')[0].split('Experience:')[0].split('·')[0].replace(/\d+\+?\s+connections.*/i, '').trim();
    if (clean && clean.length > 2) return clean;
  }

  // Method 5: Document Title Universal Split
  const rawTitle = document.title || document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
  const cleanTitle = rawTitle.replace(/\| LinkedIn$/i, '').replace(/LinkedIn/i, '').trim();
  const parts = cleanTitle.split(/\s*[-–—|:]\s*/);
  if (parts.length >= 2) {
    const candidate = parts.slice(1).join(' - ').trim();
    if (candidate.length > 2) return candidate;
  }

  return null;
}

async function extractEmail() {
  let email = '';

  // 1. Check existing mailto links in DOM immediately
  const mailtoLinks = document.querySelectorAll('a[href^="mailto:"]');
  for (const a of mailtoLinks) {
    const raw = a.href.replace(/^mailto:/i, '').split('?')[0].trim();
    if (isUserEmail(raw)) return raw;
  }

  // 2. Check currently open Contact Info modal / overlay section in DOM
  const modal = document.querySelector('.pv-contact-info') ||
                document.querySelector('section.ci-email') ||
                document.querySelector('#pv-contact-info') ||
                document.querySelector('.artdeco-modal');
  if (modal) {
    const mailtoModal = modal.querySelector('a[href^="mailto:"]');
    if (mailtoModal) {
      const raw = mailtoModal.href.replace(/^mailto:/i, '').split('?')[0].trim();
      if (isUserEmail(raw)) return raw;
    }
    const found = findEmailInText(modal.innerText || modal.innerHTML);
    if (found) return found;
  }

  // 3. Search all <code> tags
  const codeTags = document.querySelectorAll('code');
  for (const code of codeTags) {
    const text = code.textContent || '';
    if (text.includes('@')) {
      const found = findEmailInText(text);
      if (found) return found;
    }
  }

  // 4. Fetch /overlay/contact-info/ directly in background (Zero UI click, Zero navigation loop)
  if (!email && location.hostname.includes('linkedin.com') && location.pathname.includes('/in/')) {
    try {
      const baseUrl = location.origin + location.pathname.replace(/\/overlay\/contact-info\/?.*$/i, '').replace(/\/$/, '');
      const contactUrl = baseUrl + '/overlay/contact-info/';
      const response = await fetch(contactUrl, {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'include'
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

  // 5. Search full document body text
  if (!email && document.body) {
    const found = findEmailInText(document.body.innerText || document.body.innerHTML || '');
    if (found) email = found;
  }

  return email || 'Cannot Find';
}

function getProfileAvatarUrl(profileName) {
  try {
    const normalizedName = (profileName || '').trim().toLowerCase();
    if (!normalizedName) return '';

    const imageCandidates = document.querySelectorAll([
      'img.pv-top-card-profile-picture__image',
      'img.pv-top-card-profile-picture__image--show',
      'button.pv-top-card-profile-picture img',
      "button[aria-label*='profile picture' i] img",
      "button[aria-label*='photo' i] img",
      'img.pv-top-card__photo',
      'img.profile-photo-edit__preview',
      '.pv-top-card__non-self-photo-wrapper img',
      '.top-card-layout__entity-image',
      'img.EntityPhoto-circle-8',
      'img.EntityPhoto-circle-7',
      "img[src*='profile-displayphoto']",
      "img[class*='profile-photo']",
      "img[class*='profile-picture']"
    ].map(selector => `main ${selector}`).join(', '));

    let bestCandidate = { source: '', score: 0 };
    for (const imageElement of imageCandidates) {
      if (imageElement.closest('.artdeco-modal, #pv-contact-info, .pv-contact-info, dialog, #global-nav, nav, header, footer')) continue;

      const source = imageElement.currentSrc || imageElement.src || imageElement.getAttribute('data-delayed-url') || imageElement.getAttribute('data-src') || '';
      if (!source || source.startsWith('data:image/svg') || source.includes('ghost') || source.includes('static.licdn.com/aero-v1/sc/h/')) continue;

      const alt = (imageElement.getAttribute('alt') || '').trim().toLowerCase();
      const label = (imageElement.closest('[aria-label]')?.getAttribute('aria-label') || '').trim().toLowerCase();
      let score = 0;
      if (alt.includes(normalizedName) || label.includes(normalizedName)) score += 100;
      if (source.includes('profile-displayphoto') || source.includes('/dms/image/')) score += 20;

      let ancestor = imageElement.parentElement;
      for (let depth = 0; ancestor && depth < 8; depth += 1, ancestor = ancestor.parentElement) {
        const className = (ancestor.className || '').toString().toLowerCase();
        const context = (ancestor.innerText || '').slice(0, 800).toLowerCase();
        if (className.includes('pv-top-card') || className.includes('top-card-layout') || className.includes('profile-topcard')) score += 60;
        if (context.includes(normalizedName)) score += 35;
      }

      if (score > bestCandidate.score) bestCandidate = { source, score };
    }

    return bestCandidate.score >= 35 ? bestCandidate.source : '';
  } catch (error) {
    console.warn('[TagSilo] Profile avatar extraction note:', error);
  }

  return '';
}

async function extractProfileDetails() {
  const cleanUrl = location.href.split('?')[0].split('#')[0].replace(/\/overlay\/contact-info\/?.*$/i, '').replace(/\/$/, '');
  
  const nameEl = document.querySelector('h1.text-heading-xlarge') ||
                 document.querySelector('.top-card-layout__title') ||
                 document.querySelector('.pv-text-details__left-panel h1') ||
                 document.querySelector('main h1') ||
                 document.querySelector('section.artdeco-card h1') ||
                 document.querySelector('h1');
  const name = nameEl ? (nameEl.innerText || nameEl.textContent || '').trim() : '';

  const headline = extractHeadline(name) || '';

  // Do not use global Open Graph or generic profile-image selectors here: both can
  // belong to a recommendation card or a previously opened LinkedIn overlay.
  const image = getProfileAvatarUrl(name);

  const email = await extractEmail();

  return {
    name: name || 'LinkedIn Profile',
    fullName: name || 'LinkedIn Profile',
    title: headline || '',
    headline: headline || '',
    jobTitle: headline || '',
    image: image || '',
    avatarUrl: image || '',
    url: cleanUrl,
    email: email || 'Cannot Find',
    ts: Date.now()
  };
}

let isCapturing = false;

async function tryCapture(retries = 10) {
  if (isCapturing) return;
  if (!location.pathname.includes('/in/') || /\/overlay\/contact-info\/?$/i.test(location.pathname)) return;

  isCapturing = true;
  try {
    const data = await extractProfileDetails();
    if (data.name && data.name !== 'LinkedIn Profile') {
      chrome.storage.local.set({
        lastCapture: data,
        cached_profile_data: data
      });
    } else if (retries > 0) {
      setTimeout(() => {
        isCapturing = false;
        tryCapture(retries - 1);
      }, 500);
      return;
    }
  } catch (e) {
    console.warn('[TagSilo] Capture note:', e);
  } finally {
    isCapturing = false;
  }
}

// Initial capture on document idle
tryCapture();

// Observe SPA navigation and DOM changes (only on clean /in/ path changes)
let lastPath = location.pathname.replace(/\/overlay\/contact-info\/?.*$/i, '').replace(/\/$/, '');
const observer = new MutationObserver(() => {
  const currentPath = location.pathname.replace(/\/overlay\/contact-info\/?.*$/i, '').replace(/\/$/, '');
  if (currentPath !== lastPath) {
    lastPath = currentPath;
    if (currentPath.includes('/in/')) {
      tryCapture(10);
    }
  }
});

if (document.body) {
  observer.observe(document.body, { childList: true, subtree: true });
}

// Listen for direct scan requests from popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'GET_LINKEDIN_METADATA') {
    extractProfileDetails().then((data) => {
      sendResponse({ success: true, data: data });
    });
    return true; // Keep message channel open for async response
  }
  if (request.action === 'GET_CONTACT_INFO_EMAIL') {
    extractEmail().then((email) => {
      sendResponse({ success: true, email: email || 'Cannot Find' });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message, email: 'Cannot Find' });
    });
    return true;
  }
  return true;
});
