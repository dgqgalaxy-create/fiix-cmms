/**
 * Traducción de textos existentes sin reescribir cada componente.
 *
 * La aplicación tiene más de mil textos en español escritos directamente en el
 * JSX. En lugar de modificar 100 archivos (frágil y propenso a errores), cuando
 * el idioma es inglés se recorre el DOM y se sustituyen los textos que existen
 * en el diccionario `en-app`, recordando el original para poder volver a
 * español sin recargar.
 *
 * Es una capa temporal: los módulos nuevos deben usar `t('clave')` directamente.
 */
import { enApp } from './en-app';

type Language = 'es' | 'en';

const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'] as const;

const originals = new WeakMap<Node, string>();
const originalAttrs = new WeakMap<Element, Map<string, string>>();

let observer: MutationObserver | null = null;
let active = false;
/** Evita reprocesar lo que nosotros mismos cambiamos. */
let applying = false;

const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();

function translateTextNode(node: Node) {
  const current = node.nodeValue ?? '';
  const key = normalize(current);
  if (!key) return;
  const translation = enApp[key];
  if (!translation) return;
  if (!originals.has(node)) originals.set(node, current);

  // conserva los espacios de los extremos
  const leading = current.match(/^\s*/)?.[0] ?? '';
  const trailing = current.match(/\s*$/)?.[0] ?? '';
  node.nodeValue = `${leading}${translation}${trailing}`;
}

function translateAttributes(element: Element) {
  for (const attr of ATTRS) {
    const value = element.getAttribute(attr);
    if (!value) continue;
    const translation = enApp[normalize(value)];
    if (!translation) continue;
    let stored = originalAttrs.get(element);
    if (!stored) {
      stored = new Map();
      originalAttrs.set(element, stored);
    }
    if (!stored.has(attr)) stored.set(attr, value);
    element.setAttribute(attr, translation);
  }
}

function walk(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return;

  const element = root as Element;
  const tag = element.tagName;
  // no tocar campos de formulario ni contenido editable
  if (tag !== 'SCRIPT' && tag !== 'STYLE' && tag !== 'TEXTAREA') translateAttributes(element);

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null = walker.nextNode();
  while (node) {
    const parent = node.parentElement?.tagName;
    if (parent !== 'SCRIPT' && parent !== 'STYLE' && parent !== 'TEXTAREA') translateTextNode(node);
    node = walker.nextNode();
  }

  if (element.querySelectorAll) {
    element.querySelectorAll('*').forEach((child) => {
      const childTag = child.tagName;
      if (childTag !== 'SCRIPT' && childTag !== 'STYLE') translateAttributes(child);
    });
  }
}

function restore() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes: Node[] = [];
  let node: Node | null = walker.nextNode();
  while (node) {
    nodes.push(node);
    node = walker.nextNode();
  }
  for (const textNode of nodes) {
    const original = originals.get(textNode);
    if (original !== undefined) {
      textNode.nodeValue = original;
      originals.delete(textNode);
    }
  }
  document.body.querySelectorAll('*').forEach((element) => {
    const stored = originalAttrs.get(element);
    if (!stored) return;
    stored.forEach((value, attr) => element.setAttribute(attr, value));
    originalAttrs.delete(element);
  });
}

/** Aplica o retira la traducción del DOM según el idioma activo. */
export function syncDomTranslation(language: Language) {
  if (typeof document === 'undefined' || !document.body) return;

  if (language !== 'en') {
    if (active) {
      applying = true;
      restore();
      active = false;
      observer?.disconnect();
      observer = null;
      applying = false;
    }
    return;
  }

  if (active) return;
  active = true;
  applying = true;
  walk(document.body);
  applying = false;

  observer = new MutationObserver((mutations) => {
    if (applying) return;
    applying = true;
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((added) => walk(added));
      } else if (mutation.type === 'characterData' && mutation.target) {
        translateTextNode(mutation.target);
      }
    }
    applying = false;
  });

  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}
