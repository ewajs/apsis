/**
 * Name tags over the 3D canvas, as plain HTML: crisp at any size, in the visitor's
 * language, and placed with the same `placeLabels` as the 2D map so they never overlap
 * each other or the bodies. See docs/guides/scene.md.
 */
import type { BodyKind } from '../core/ephemeris.ts';
import { placeLabels, type LabelRequest } from '../core/labels.ts';

/** Where a body appears on screen this frame, in CSS px from the canvas's top left. */
export type ScreenBody = { id: string; x: number; y: number; radius: number };

/** Label text: 12 px, as on the map. */
const LABEL_HEIGHT = 16;

/** The layer of labels; one per scene. */
export class LabelLayer {
  #root = document.createElement('div');
  #labels = new Map<string, { element: HTMLSpanElement; kind: BodyKind; width: number }>();
  /** What each label showed last frame, so the DOM is only touched on change. */
  #shown = new Map<string, string>();

  constructor(container: HTMLElement) {
    this.#root.style.cssText =
      'position:absolute;inset:0;overflow:hidden;pointer-events:none;font:12px var(--font-ui)';
    // The canvas describes the scene for screen readers; the tags would repeat it.
    this.#root.setAttribute('aria-hidden', 'true');
    container.append(this.#root);
  }

  /** Sets or renames the labels; bodies not listed lose theirs. */
  setNames(bodies: readonly { id: string; name: string; kind: BodyKind }[]): void {
    for (const [id, { element }] of this.#labels) {
      if (!bodies.some((body) => body.id === id)) {
        element.remove();
        this.#labels.delete(id);
      }
    }
    for (const { id, name, kind } of bodies) {
      const label = this.#labels.get(id) ?? this.#create(id, kind);
      label.element.textContent = name;
      label.width = 0; // measured on the next frame it's shown
      this.#shown.delete(id);
    }
  }

  /** Sets the label in bold for the selected body, if any; the others back to normal. */
  emphasise(id: string | null): void {
    for (const [labelId, label] of this.#labels) {
      label.element.style.fontWeight = labelId === id ? '600' : '';
      label.width = 0; // bold is wider: measured again
    }
  }

  /**
   * Places this frame's labels. `bodies` are those on screen, most important first; any
   * label not placed (off screen, or no free spot) hides.
   */
  place(bodies: readonly ScreenBody[], width: number, height: number): void {
    const requests: LabelRequest[] = bodies.map((body) => ({
      ...body,
      width: this.#width(body.id),
      height: LABEL_HEIGHT,
    }));
    const placed = placeLabels(requests, { left: 0, top: 0, width, height });
    for (const [id, { element }] of this.#labels) {
      const box = placed.get(id);
      const state = box ? `${Math.round(box.left)},${Math.round(box.top)}` : 'hidden';
      if (this.#shown.get(id) === state) continue;
      this.#shown.set(id, state);
      element.style.visibility = box ? 'visible' : 'hidden';
      if (box) element.style.transform = `translate(${state.replace(',', 'px,')}px)`;
    }
  }

  /** Removes the layer from the page. */
  dispose(): void {
    this.#root.remove();
  }

  /** A label's width in px, measured once it can be (the view may have been hidden). */
  #width(id: string): number {
    const label = this.#labels.get(id);
    if (!label) return 0;
    if (label.width === 0) label.width = label.element.offsetWidth;
    return label.width;
  }

  #create(id: string, kind: BodyKind) {
    const element = document.createElement('span');
    element.dataset.label = id;
    element.style.cssText = `position:absolute;left:0;top:0;line-height:${LABEL_HEIGHT}px;white-space:nowrap;visibility:hidden;color:var(${kind === 'spacecraft' ? '--color-craft' : '--color-text'})`;
    this.#root.append(element);
    const label = { element, kind, width: 0 };
    this.#labels.set(id, label);
    return label;
  }
}
