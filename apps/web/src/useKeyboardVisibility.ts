// SPDX-License-Identifier: MPL-2.0
import { useEffect } from "react";

/** Keep manual entry visible when a mobile keyboard reduces the visual viewport. */
export function useKeyboardVisibility() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const root = document.documentElement;
    let frame = 0;
    let settleTimer = 0;
    let baseline = window.innerHeight;
    const editable = () => {
      const element = document.activeElement;
      return element instanceof HTMLElement && element.matches(
        'textarea, select, input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="hidden"])',
      ) ? element : null;
    };
    const reset = () => {
      root.classList.remove("entry-keyboard-open");
      root.style.removeProperty("--entry-keyboard-space");
    };
    const reveal = () => {
      const field = editable();
      // Pinch zoom also reduces the viewport; leave zoom/panning to the browser.
      const reducedBy = Math.max(baseline, window.innerHeight) - viewport.height;
      if (!field || viewport.scale > 1.05 || reducedBy < 120) {
        reset();
        if (!field) baseline = window.innerHeight;
        return;
      }
      root.classList.add("entry-keyboard-open");
      root.style.setProperty("--entry-keyboard-space", `${Math.ceil(reducedBy)}px`);
      const bounds = field.getBoundingClientRect();
      const label = field.closest("label")?.getBoundingClientRect();
      const top = viewport.offsetTop + 16;
      // Allow space for the native input accessory bar as well as the keyboard.
      const bottom = viewport.offsetTop + viewport.height - 64;
      const groupTop = label && bounds.bottom - label.top < bottom - top ? label.top : bounds.top;
      let delta = 0;
      if (bounds.bottom > bottom) delta = bounds.bottom - bottom;
      if (groupTop - delta < top) delta = groupTop - top;
      if (Math.abs(delta) > 1) window.scrollBy({ top: delta, behavior: "instant" });
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(reveal);
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(reveal, 350);
    };
    document.addEventListener("focusin", schedule);
    document.addEventListener("focusout", schedule);
    viewport.addEventListener("resize", schedule);
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settleTimer);
      document.removeEventListener("focusin", schedule);
      document.removeEventListener("focusout", schedule);
      viewport.removeEventListener("resize", schedule);
      window.removeEventListener("resize", schedule);
      reset();
    };
  }, []);
}
