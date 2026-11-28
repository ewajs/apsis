/**
 * Opens a USDZ in the iPhone's AR viewer, Quick Look (ADR 0014): Safari answers a click on
 * a link with `rel="ar"` whose only child is an image. Called straight from a tap, so the
 * link's click still counts as the visitor's.
 * @param href The file's URL (a blob, or the file with Quick Look's options after `#`).
 */
export function openInQuickLook(href: string): void {
  // Left in place after the click, in case Safari reads it late; one at a time.
  document.querySelector('a[data-ar="quick-look"]')?.remove();
  const link = document.createElement('a');
  link.rel = 'ar';
  link.href = href;
  link.append(document.createElement('img'));
  link.dataset.ar = 'quick-look';
  link.hidden = true;
  document.body.append(link);
  link.click();
}
