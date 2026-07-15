/* Cupertino Corp — fluid cross-page transitions.

   The pages are separate documents. A JS fade-out + location change can NEVER be
   seamless, because once you navigate the old DOM is gone and there's a frame where
   neither page is painted — that gap is the "white flash".

   The fix is the browser's native CROSS-DOCUMENT View Transitions: with
   `@view-transition { navigation: auto }` (declared in each page's <head> CSS) the
   browser keeps the old page on screen and crossfades to the new one once it's ready,
   so there is no blank gap at all. When that's supported we do nothing here and let
   the browser drive the whole thing.

   For browsers without cross-document VT (e.g. Firefox today) we fall back to a plain
   fade-in over the already-dark background — no click interception, so navigation is
   instant and the <head> dark background prevents any white. */
(function () {
  if (window.__ccNav) return;
  window.__ccNav = true;

  // Belt-and-braces dark paint (the <head> <style> already does this on frame 1).
  document.documentElement.style.background = '#0b0b0d';

  // Detect support for the View Transitions machinery. Chromium/Safari expose
  // `view-transition-name`; the @view-transition at-rule then handles navigation.
  var nativeVT = false;
  try { nativeVT = window.CSS && CSS.supports && CSS.supports('view-transition-name: none'); } catch (e) {}
  if (nativeVT) return; // native crossfade — nothing more to do.

  // ---------- Fallback: fade each page in on arrival ----------
  function fadeIn() {
    var b = document.body;
    if (!b || b.dataset.ccIn) return;
    b.dataset.ccIn = '1';
    b.style.transition = 'opacity 240ms ease';
    b.style.opacity = '1';
  }
  function prep() {
    var b = document.body;
    if (!b) return;
    b.style.opacity = '0';
    requestAnimationFrame(function () { requestAnimationFrame(fadeIn); });
    setTimeout(fadeIn, 800); // safety net
  }
  if (document.body) prep();
  else document.addEventListener('DOMContentLoaded', prep);

  // Restore instantly on back/forward (bfcache).
  window.addEventListener('pageshow', function (e) {
    var b = document.body;
    if (!b) return;
    if (e.persisted) { b.style.transition = 'none'; b.style.opacity = '1'; b.dataset.ccIn = '1'; }
  });
})();
