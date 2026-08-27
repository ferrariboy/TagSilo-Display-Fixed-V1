# TagSilo — Display Fixed V1

## Purpose

Display Fixed V1 removes the global `zoom: 0.70` rule that reduced the entire TagSilo popup to 70% of its designed size while preserving the outer 380 × 520 popup frame. The extension now uses native CSS sizing, readable type and control floors, a scrollable content deck, and an optional persisted **Comfortable** display-density mode.

## Version

The extension manifest version is **1.3.0**. The repository and release line are named **Display Fixed V1**.

## Installation for testing

1. Download or clone this repository.
2. In Chrome, open `chrome://extensions` and turn on **Developer mode**.
3. Select **Load unpacked** and choose the repository root, the folder containing `manifest.json`.
4. Open TagSilo on a LinkedIn profile and test at Windows scaling of 100%, 125%, and 150%.
5. Open **Settings** from the popup and choose **Comfortable** if you prefer larger labels and controls. This is intentionally an explicit user preference; it does not modify Windows display scaling or Chrome zoom.

## Validation

Run `npm run check:popup-ui` before release. The guard verifies that the global UI scale, root popup `zoom`, and disabled text-size adjustment do not return, and that the density preference remains wired between Settings and the popup.

## Local visual verification

The popup and Settings page were opened from the updated source on August 27, 2026. The popup now renders at its native 380 × 520 CSS-pixel size with a separately scrollable content deck, and the Settings page exposes clear Standard and Comfortable display-density choices without disturbing the existing account, sheet, license, tag, or group controls. Browser-file preview cannot simulate Chrome extension storage or a physical Windows monitor, so final verification remains required after loading the unpacked extension on the affected Lenovo at 125% Windows display scale.

## Release acceptance

The popup must remain readable and functional on FHD at 100%, 125%, and 150% Windows scale, and on QHD/4K at their recommended scales. Content may scroll within the popup deck, but controls, labels, focus states, and the primary sync action must never be clipped or reduced below the declared readable token floor.
