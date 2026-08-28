# Poster QR Replacement Design

## Goal

Add a QR replacement workflow to the existing image processing page. Users upload one poster image and up to two QR images, place the QR images over the original QR areas, fine tune coordinates, and export a PNG.

## Scope

- Add a new `二维码替换` tab in `/tools/image`.
- Keep all image handling in the browser.
- Export PNG at the poster's original pixel size.
- Support drag positioning, corner resizing, and numeric `X/Y/宽/高` editing for two QR layers.
- Do not generate QR codes in this workflow.

## Interaction

The user uploads a poster as the base image, then uploads QR 1 and QR 2. The preview displays the poster scaled to fit the editor, with each uploaded QR shown as a selectable overlay. Selecting an overlay exposes numeric position fields. Dragging an overlay moves it; dragging the lower-right handle resizes it. Numeric fields stay synchronized with the selected overlay.

## Architecture

`ImageTool.tsx` keeps the existing tabbed layout and adds one tab for poster QR replacement. A small pure helper module under `src/lib/image/` owns layer clamping and PNG composition so coordinate behavior is testable without depending on the full React component.

## Error Handling

The export button is disabled until a poster and at least one QR layer are present. Invalid numeric values are clamped to the poster bounds, and QR layers cannot be resized below a small usable minimum.

## Testing

Unit tests cover layer clamping and original-size PNG composition. Component tests verify the new tab appears and exposes the expected upload/fine-tuning controls.
