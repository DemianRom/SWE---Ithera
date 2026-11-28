import { useEffectEvent, useLayoutEffect, type RefObject } from "react";

type ModalEntry = {
  layer: HTMLElement;
  panel: HTMLElement;
  initialFocusRef: RefObject<HTMLElement | null>;
  previousFocus: HTMLElement | null;
  onEscape: () => void;
};

const BASE_Z_INDEX = 100;
const TABBABLE_SELECTOR =
  "a[href], area[href], button, input, select, textarea, summary, [contenteditable], [tabindex]";
const modals: ModalEntry[] = [];

function isAvailable(element: HTMLElement) {
  return element.isConnected &&
    !element.matches(":disabled") &&
    !element.closest('[inert], [hidden], [aria-hidden="true"]') &&
    element.getClientRects().length > 0 &&
    getComputedStyle(element).visibility === "visible";
}

function tryFocus(element: HTMLElement | null) {
  if (!element || !isAvailable(element)) return false;
  element.focus();
  return element.ownerDocument.activeElement === element;
}

function focusModal(modal: ModalEntry) {
  if (!tryFocus(modal.initialFocusRef.current)) modal.panel.focus();
}

function updateLayers() {
  modals.forEach(({ layer }, index) => {
    const isTop = index === modals.length - 1;
    layer.style.zIndex = String(BASE_Z_INDEX + index);
    layer.inert = !isTop;
    if (isTop) layer.setAttribute("aria-modal", "true");
    else layer.removeAttribute("aria-modal");
  });
}

function handleKeyDown(event: KeyboardEvent) {
  if (event.defaultPrevented) return;
  const modal = modals.at(-1);
  if (!modal) return;

  if (event.key === "Escape") {
    event.preventDefault();
    modal.onEscape();
    return;
  }
  if (event.key !== "Tab") return;

  const tabbable = Array.from(modal.panel.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR))
    .filter((element) => element.tabIndex >= 0 && isAvailable(element))
    .sort((a, b) => (a.tabIndex || Infinity) - (b.tabIndex || Infinity));
  const first = tabbable[0];
  const last = tabbable.at(-1);
  const active = modal.panel.ownerDocument.activeElement;
  const atBoundary = event.shiftKey ? active === first : active === last;
  if (atBoundary || !tabbable.some((element) => element === active)) {
    event.preventDefault();
    (event.shiftKey ? last ?? modal.panel : first ?? modal.panel).focus();
  }
}

function registerModal(modal: ModalEntry) {
  const { ownerDocument } = modal.layer;
  if (modals.length === 0) ownerDocument.addEventListener("keydown", handleKeyDown);
  modals.push(modal);
  updateLayers();
  focusModal(modal);

  return () => {
    const wasTop = modals.at(-1) === modal;
    modals.splice(modals.indexOf(modal), 1);
    // Keep the original return target if a covered dialog closes before the overlay.
    for (const remaining of modals) {
      if (modal.layer.contains(remaining.previousFocus)) remaining.previousFocus = modal.previousFocus;
    }
    updateLayers();

    const top = modals.at(-1);
    if (!top) ownerDocument.removeEventListener("keydown", handleKeyDown);
    if (!wasTop) return;

    if (top && (!top.panel.contains(modal.previousFocus) || !tryFocus(modal.previousFocus))) {
      focusModal(top);
    } else if (!top) {
      tryFocus(modal.previousFocus);
    }
  };
}

type ModalStackOptions = {
  open: boolean;
  closeBlocked: boolean;
  layerRef: RefObject<HTMLElement | null>;
  panelRef: RefObject<HTMLElement | null>;
  initialFocusRef: RefObject<HTMLElement | null>;
  onClose: () => void;
};

export function useModalStack({
  open,
  closeBlocked,
  layerRef,
  panelRef,
  initialFocusRef,
  onClose,
}: ModalStackOptions) {
  const onEscape = useEffectEvent(() => {
    if (!closeBlocked) onClose();
  });

  useLayoutEffect(() => {
    const layer = layerRef.current;
    const panel = panelRef.current;
    if (!open || !layer || !panel) return;

    const active = panel.ownerDocument.activeElement;
    return registerModal({
      layer,
      panel,
      initialFocusRef,
      previousFocus: active instanceof HTMLElement ? active : null,
      onEscape: () => onEscape(),
    });
  }, [open, layerRef, panelRef, initialFocusRef]);

  useLayoutEffect(() => {
    const modal = modals.at(-1);
    if (!open || !closeBlocked || !modal || modal.layer !== layerRef.current) return;

    const active = modal.panel.ownerDocument.activeElement;
    if (!(active instanceof HTMLElement) || !modal.panel.contains(active) || !isAvailable(active)) {
      focusModal(modal);
    }
  }, [open, closeBlocked, layerRef]);
}
