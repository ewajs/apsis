# 0012. The Glass look

- Status: Accepted; the owner chose direction A on 2026-11-23 from mock-ups of two
  directions over real renders (A, Glass, after gravitas; B, Docked, after Lux Studio).
  Implemented from step 4.0a. Amended 2026-11-23 (4.1): the picker's pill joins the
  top row, and on phones it takes the name's place (kept for screen readers).
- Date: 2026-11-23

## Decision

- **The view fills the screen** (the 2D map or the 3D scene), and every control floats
  over it in small translucent **glass** panels: `--glass-bg` (rgba(12, 20, 34, 0.58)),
  a 14 px blur, a faint line (`--glass-line`). Those who ask for less transparency
  (`prefers-reduced-transparency`) get solid panels. Shared styles live in one module
  (`ui/glass.ts`), icons in another (`ui/icons.ts`, line icons after gravitas's).
- **Where things go:** top left the name, then the picker's pill (on phones, the pill
  alone); top right the view switch, the language
  (a small `ES ▾` pill over a native select) and an "i" for the info panel, which
  replaces the footer (credits, the data date, the version); a notice under them when
  there is something to say; along the right edge a tool column (zoom, the whole map,
  scale); at the bottom the time dock. The picker's list opens under the top row
  (a popover); the mission card (4.2) floats too, a panel on desktop, a sheet on
  phones.
- **The view knows the controls' room** through `--hud-top/right/bottom/left` in
  `styles.css`, and the map centres itself in what's left. On narrow screens the map
  uses the full width (the tool column floats over its edge); on short ones it runs up
  between the top corners' pills.
- **Typefaces, self-hosted:** Inter (text and numbers, with even-width digits) and
  Space Grotesk (names and labels), from `@fontsource-variable/*`, as in gravitas.

## Font dependency

|              |                                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Work saved   | Subsetting, `unicode-range` splitting and variable-font CSS for two families, maintained upstream.                       |
| Alternatives | System fonts (no identity, and digits of uneven width on some systems); Google Fonts at runtime (a third-party request). |
| Licence      | SIL Open Font License 1.1, both packages.                                                                                |
| Cost         | Only the Latin files are fetched and precached: Inter ≈ 48 KB, Space Grotesk ≈ 22 KB.                                    |

## Alternatives

- **Docked (direction B):** a toolbar, side panels and a time strip. Clearer on a
  desktop, but on a phone it leaves the view about as small as before.
- **Keep the system font:** one dependency fewer, but no shared identity with gravitas,
  and numbers that change width as they change.
