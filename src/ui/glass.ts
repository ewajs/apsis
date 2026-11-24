/**
 * The glass look shared by every floating control (as in gravitas, ADR-style note in
 * docs/guides/ui-shell.md): one home for panels, pills and icon buttons, so components
 * don't each carry their own copy.
 */
import { css } from 'lit';

/** Styles for `.glass` panels, `.pill`s and round `.icon-button`s. */
export const glass = css`
  .glass {
    background: var(--glass-bg);
    -webkit-backdrop-filter: var(--glass-blur);
    backdrop-filter: var(--glass-blur);
    border: 1px solid var(--glass-line);
    border-radius: var(--radius);
    color: var(--color-text);
  }
  .pill {
    border-radius: 999px;
  }
  .icon-button {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    padding: 0;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: var(--color-text);
    cursor: pointer;
    transition: background var(--dur-fast);
  }
  .icon-button:hover {
    background: var(--glass-press);
  }
  .icon-button[aria-pressed='true'] {
    color: var(--color-craft);
  }
  /* A free-standing round button keeps the glass. */
  .glass.icon-button {
    background: var(--glass-bg);
    border: 1px solid var(--glass-line);
  }
  button:focus-visible,
  select:focus-visible,
  input:focus-visible,
  a:focus-visible {
    outline: 2px solid var(--color-craft);
    outline-offset: 2px;
  }
`;
