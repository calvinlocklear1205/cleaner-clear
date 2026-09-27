/**
 * Full-screen logo on first load: holds ~1s, spins fast, rolls off to the
 * right, revealing the page. Pure CSS (see .intro in globals.css) so it runs
 * from first paint without waiting for JavaScript. Shown once per browser
 * session so repeat submissions stay fast; the inline script hides it on
 * later loads before it paints.
 */
export function IntroSplash() {
  return (
    <>
      <script
        // Runs during HTML parsing, before the overlay below is painted.
        dangerouslySetInnerHTML={{
          __html: `try{if(sessionStorage.getItem("cc.introSeen"))document.documentElement.classList.add("intro-seen");else sessionStorage.setItem("cc.introSeen","1")}catch(e){}`,
        }}
      />
      <div className="intro" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element -- must paint before hydration */}
        <img src="/brand/badge-2026.webp" alt="" fetchPriority="high" />
      </div>
    </>
  );
}
