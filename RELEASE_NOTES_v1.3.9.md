# TagSilo v1.3.9 — Production Release Notes

## Overview

TagSilo v1.3.9 stabilizes LinkedIn profile capture and resolves the Contact Info email workflow that could previously leave LinkedIn on an incorrect overlay after the extension popup was closed and reopened.

## Highlights

| Area | Improvement |
|---|---|
| Contact Info email capture | TagSilo now waits for LinkedIn to render the Contact Info surface, reads the available email from that confirmed surface, and then closes the same view. |
| Popup lifecycle | Contact Info extraction is serialized per LinkedIn tab. Reopening the extension reuses the active capture instead of launching a competing modal action. |
| Profile restoration | Cleanup runs after every Contact Info attempt, returning the tab to the original profile route without requiring a page refresh. |
| Modal targeting | The extension targets only the profile’s exact Contact Info link and rejects controls containing image, picture, SVG, or button content, preventing accidental profile-photo/image-viewer actions. |
| Avatar capture | Profile photos are selected from active-profile content using name and top-card context, avoiding unrelated suggested-profile images. |
| Production cleanup | Temporary response diagnostics, profile data dumps, and unused direct-request fallback code have been removed from the production path. |

## Email Extraction Bug Fix

The email extraction fix addresses a LinkedIn single-page application timing issue. The Contact Info container can appear before its contents are rendered. TagSilo now waits for a valid email inside the confirmed Contact Info surface rather than closing when the first modal frame appears. Once the operation is complete, the popup resolves to the captured email or a final “Cannot Find” state instead of remaining in a perpetual searching state.

## Upgrade Notes

Pull the `production-code` branch or the corresponding v1.3.9 release state, then reload TagSilo from `chrome://extensions`. Existing popup settings, tags, pipeline groups, and local browser data remain unchanged.
