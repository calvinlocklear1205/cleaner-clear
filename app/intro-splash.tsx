/**
 * Full-screen logo that holds ~1s, spins up and rolls off to the right.
 * Pure CSS (see .intro in globals.css) so it runs from first paint.
 *
 * Lives in the root layout, which stays mounted across client-side
 * navigation, so going Back never replays it. The inline script (runs once
 * per full page load, before paint) decides whether to show it:
 *   - shown on a fresh visit, or after 30+ minutes of inactivity;
 *   - never on judge pages or the TV wall.
 * Activity (taps, switching away, closing) refreshes the timestamp.
 */
const IDLE_MINUTES = 30;

const script = `(function(){var h=document.documentElement,K="cc.lastActive";
function seen(){h.classList.add("intro-seen")}
try{
  if(/^\\/(judge|wall)/.test(location.pathname)){seen();return}
  var last=+localStorage.getItem(K)||0;
  if(Date.now()-last<${IDLE_MINUTES * 60_000})seen();else setTimeout(seen,2400);
  var touch=function(){try{localStorage.setItem(K,String(Date.now()))}catch(e){}};
  touch();
  addEventListener("pointerdown",touch,{passive:true});
  addEventListener("pagehide",touch);
  document.addEventListener("visibilitychange",touch);
}catch(e){seen()}})()`;

export function IntroSplash() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: script }} />
      <div className="intro" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element -- must paint before hydration */}
        <img src="/brand/badge-2026.webp" alt="" fetchPriority="high" />
      </div>
    </>
  );
}
