/**
 * Traducción de los textos que todavía están escritos en español dentro del JSX.
 *
 * Cuando el idioma es inglés se recorre el DOM y se sustituyen los textos que
 * existen en el diccionario `en-app`, guardando el original para poder volver a
 * español sin recargar. Es una capa temporal: lo nuevo debe usar `t('clave')`.
 *
 * Reglas importantes (evitan un bucle infinito):
 *  - Nunca se escribe el mismo valor que ya está puesto (una escritura idéntica
 *    genera otra mutación del DOM y volvería a disparar el observador).
 *  - Las traducciones idénticas al original (`Offline` → `Offline`) se ignoran.
 *  - El observador se desconecta mientras aplicamos cambios y se reconecta al
 *    terminar, así no procesamos nuestras propias mutaciones.
 *  - Las mutaciones se agrupan y aplican una sola vez por turno.
 */
import { enApp } from './en-app';

type Language = 'es' | 'en';

const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'] as const;

const originals = new WeakMap<Node, string>();
const originalAttrs = new WeakMap<Element, Map<string, string>>();
/** Elementos ya traducidos: evita reescribir en cada pasada. */
const doneText = new WeakSet<Node>();

let observer: MutationObserver | null = null;
let active = false;
let scheduled = false;

const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();

/** Devuelve la traducción o null si no aplica (sin entrada o idéntica). */
function translate(value: string): string | null {
  const key = normalize(value);
  if (!key) return null;
  const translation = enApp[key];
  if (!translation || translation === key) return null;
  return translation;
}

function translateTextNode(node: Node) {
  if (doneText.has(node)) return;
  const current = node.nodeValue ?? '';
  const translation = translate(current);
  if (translation === null) return;

  const leading = current.match(/^\s*/)?.[0] ?? '';
  const trailing = current.match(/\s*$/)?.[0] ?? '';
  const next = `${leading}${translation}${trailing}`;
  if (next === current) return;

  if (!originals.has(node)) originals.set(node, current);
  doneText.add(node);
  node.nodeValue = next;
}

function translateAttributes(element: Element) {
  for (const attr of ATTRS) {
    const value = element.getAttribute(attr);
    if (!value) continue;
    const translation = translate(value);
    if (translation === null || translation === value) continue;

    let stored = originalAttrs.get(element);
    if (!stored) {
      stored = new Map();
      originalAttrs.set(element, stored);
    }
    if (!stored.has(attr)) stored.set(attr, value);
    element.setAttribute(attr, translation);
  }
}

function applyTo(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return;

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
  );

  let node: Node | null = walker.currentNode;
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const parent = node.parentElement?.tagName;
      if (parent !== 'SCRIPT' && parent !== 'STYLE' && parent !== 'TEXTAREA') {
        translateTextNode(node);
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      const tag = element.tagName;
      if (tag !== 'SCRIPT' && tag !== 'STYLE' && tag !== 'TEXTAREA') {
        translateAttributes(element);
      }
    }
    node = walker.nextNode();
  }
}

/** Aplica los cambios con el observador desconectado. */
function applySafely(root: Node) {
  if (!active) return;
  observer?.disconnect();
  try {
    applyTo(root);
  } finally {
    if (active && observer) {
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
  }
}

const pendingRoots = new Set<Node>();
/** Freno de seguridad: si algo entrara en ciclo, la traducción se apaga sola. */
const MAX_PASSES = 600;
let passes = 0;

function scheduleApply(root: Node) {
  if (!active) return;
  pendingRoots.add(root);
  if (scheduled) return;
  scheduled = true;
  window.setTimeout(() => {
    scheduled = false;
    if (passes >= MAX_PASSES) {
      console.warn('[i18n] se desactiva la traducción del DOM tras demasiadas pasadas');
      active = false;
      observer?.disconnect();
      observer = null;
      return;
    }
    passes += 1;
    const roots = [...pendingRoots];
    pendingRoots.clear();
    for (const target of roots) {
      try {
        applySafely(target);
      } catch (error) {
        console.warn('[i18n] error al traducir un nodo', error);
      }
    }
  }, 0);
}

function restore() {
  observer?.disconnect();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes: Node[] = [];
  let node: Node | null = walker.nextNode();
  while (node) {
    nodes.push(node);
    node = walker.nextNode();
  }
  for (const textNode of nodes) {
    const original = originals.get(textNode);
    if (original === undefined) continue;
    if (textNode.nodeValue !== original) textNode.nodeValue = original;
    originals.delete(textNode);
    doneText.delete(textNode);
  }
  document.body.querySelectorAll('*').forEach((element) => {
    const stored = originalAttrs.get(element);
    if (!stored) return;
    stored.forEach((value, attr) => {
      if (element.getAttribute(attr) !== value) element.setAttribute(attr, value);
    });
    originalAttrs.delete(element);
  });
}

/** Aplica o retira la traducción del DOM según el idioma activo. */
export function syncDomTranslation(language: Language) {
  if (typeof document === 'undefined' || !document.body) return;

  if (language !== 'en') {
    if (!active) return;
    active = false;
    restore();
    observer = null;
    return;
  }

  if (active) return;
  active = true;
  passes = 0;
  applySafely(document.body);

  observer = new MutationObserver((mutations) => {
    if (!active) return;
    for (const mutation of mutations) {
      if (mutation.type === 'characterData') {
        // texto nuevo (React volvió a pintar): limpia la marca y reintenta
        doneText.delete(mutation.target);
        scheduleApply(mutation.target);
      } else if (mutation.type === 'childList') {
        for (const added of Array.from(mutation.addedNodes)) scheduleApply(added);
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}
