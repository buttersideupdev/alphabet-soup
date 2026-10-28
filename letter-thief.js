/*
 * Letter Thief
 * © 2026 Michael Phillipps / Butter Side Up (https://buttersideup.dev). MIT License.
 *
 * A chef who pops up over whichever text box you click, sets a soup pot down on its edge,
 * and steals the first of every letter and number you type, leaving a space where each one
 * was. Click another box and the chef
 * follows you there. Once all 36 are in the pot, the chef packs up and leaves for good.
 *
 * Add it to any page:   <script src="letter-thief.js"></script>
 *
 * - Works on <textarea> and on <input> boxes of type text, search, url and tel.
 *   Password, email and number boxes are left alone, and so is any box with
 *   data-letter-thief="off".
 * - Size: by default the chef grows with the box's text (16px text gets the drawing at 60%)
 *   and shrinks to fit narrow boxes. To choose a size, add
 *   data-size="0.7" to the script tag (1 is the full drawing, 0.5 half, 1.5 bigger),
 *   or data-letter-thief-size="1.4" to one box. LetterThief.setSize(0.7) or
 *   LetterThief.setSize('auto') changes it while the page is open.
 * - LetterThief.reset() hires a new chef with an empty pot, even after the last one left.
 * - Each theft is announced with a normal "input" event, so pages built with React,
 *   Vue and the like see the change. Screen readers hear it too ("The chef stole the letter E").
 * - Respects "reduce motion", and goes quiet when idle: no animation loop runs unless the
 *   chef is busy or their box has focus.
 * - Everything is drawn in its own shadow DOM, so the page's CSS can't bend the chef
 *   and the chef's CSS can't leak onto the page.
 */
(() => {
  'use strict';

  const WANTED = 'abcdefghijklmnopqrstuvwxyz0123456789';   // upper and lower case count as the same
  const BOX_TYPES = ['text', 'search', 'url', 'tel'];
  const HEAD_W = 140;
  const SPAN_W = 200;                  // head plus pot
  const SHOULDER_X = 102;              // the reaching hand, in head coordinates
  const EYES = [{ x: 54, y: 96 }, { x: 86, y: 96 }];
  const POT_HANDLE = { x: 4.5, y: 61.5 };   // left handle, in pot coordinates
  const POT_HIDDEN = 110;              // px below its spot on the edge, out of sight
  const POT_LIFT = -26;                // how high it's lifted before being set down
  const QUIPS = ['oui!', 'magnifique!', 'for the soup!', 'ooh, a fresh one!', '*chef\'s kiss*',
                 'into the pot!', 'just what I needed', 'bon appétit!', 'délicieux!', 'merci!'];
  // With size "auto" the chef grows with the box's text: 16px text gets the drawing at 60%.
  const AUTO_TEXT_SIZE = 16, AUTO_SIZE_AT_TEXT_SIZE = .6;
  const MIN_AUTO_SIZE = .3, MAX_AUTO_SIZE = 1.5;

  // Read now: the browser only says which script is running while this file first runs.
  let defaultSize = document.currentScript?.dataset.size || 'auto';
  let hireNewChef = () => {};          // set up once the page is ready
  window.LetterThief = {
    // 'auto', or a number where 1 is the normal size. A box's own data-letter-thief-size still wins.
    setSize(size) { defaultSize = String(size); },
    // A fresh chef with an empty pot, even after the last one left for good.
    reset() { hireNewChef(); },
  };

  const STYLE = `
    :host { all: initial; }
    .stage {
      --x: 40px;
      position: fixed; left: 0; top: 0; width: 0; height: 0; display: none;
      font-family: ui-rounded, "SF Pro Rounded", system-ui, sans-serif;
    }
    .stage.jump * { transition: none !important; }
    /* Everything below is laid out at normal size, then scaled from the box's top-left corner. */
    .rig { position: absolute; left: 0; top: 0; transform: scale(var(--s, 1)); transform-origin: 0 0; }
    .chef, .grips, .pot-slot {
      position: absolute;
      transition: left .4s cubic-bezier(.34, 1.56, .64, 1), opacity .2s, transform .2s;
    }
    /* Head and pot are cut off at the box's top edge, so they look like they're behind it. */
    .chef { left: var(--x); bottom: 0; width: 140px; height: 170px; overflow: hidden; pointer-events: auto; }
    .pot-slot { left: calc(var(--x) + 131px); bottom: 0; width: 70px; height: 150px; overflow: hidden; }
    .grips { left: var(--x); top: -11px; width: 140px; height: 22px; }

    .bob { position: absolute; left: 0; bottom: -10px; width: 100%; height: 150px; transition: transform .28s cubic-bezier(.34, 1.56, .64, 1); }
    .face { display: block; width: 100%; height: 100%; overflow: visible; }
    .stage.eager .bob { transform: translateY(-14px); }
    .stage.away .bob, .stage.ducking .bob { transform: translateY(160px); }
    .stage.ducking .bob { transition-duration: .18s; }
    .stage.away .grips, .stage.ducking .grips { opacity: 0; transform: translateY(6px); }
    .grip-right { transition: opacity .1s; }
    .stage.reaching .grip-right { opacity: 0; }

    .eye { transform-box: fill-box; transform-origin: center; animation: blink 4.5s infinite; }
    .pupil { transition: transform .12s ease-out; }
    .mouth-open { opacity: 0; }
    .stage.eager .mouth-open { opacity: 1; }
    .stage.eager .mouth-closed { opacity: 0; }
    @keyframes blink { 0%, 94%, 100% { transform: scaleY(1); } 97% { transform: scaleY(.1); } }

    .pot { position: absolute; left: 3px; bottom: -2px; width: 64px; height: 90px; transform: translateY(${POT_HIDDEN}px); transform-origin: 50% 100%; }
    .soup { transform-box: fill-box; transform-origin: center; }
    .steam path { fill: none; stroke: #9a90a0; stroke-width: 2.5; stroke-linecap: round; opacity: 0; }
    .pot.cooking .steam path { animation: steam 2.4s ease-out infinite; }
    .pot.cooking .steam path:nth-child(2) { animation-delay: .8s; }
    .pot.cooking .steam path:nth-child(3) { animation-delay: 1.6s; }
    @keyframes steam {
      0% { opacity: 0; transform: translateY(6px); }
      30% { opacity: .6; }
      100% { opacity: 0; transform: translateY(-10px); }
    }

    /* Undoes the chef's scaling so the words stay readable at any size. */
    .bubble {
      position: absolute; left: calc(var(--x) + 70px); bottom: 146px;
      padding: calc(6px / var(--s, 1)) calc(12px / var(--s, 1));
      border: calc(2.5px / var(--s, 1)) solid #2a2233; border-radius: calc(14px / var(--s, 1));
      background: #fff; color: #2a2233; font-size: calc(16px / var(--s, 1)); font-weight: 700; white-space: nowrap;
      opacity: 0; transform: translateX(-50%) scale(.8);
      transition: left .4s cubic-bezier(.34, 1.56, .64, 1), opacity .15s, transform .15s;
    }
    .bubble.show { opacity: 1; transform: translateX(-50%) scale(1); }

    /* The reaching arm is drawn over the whole window so it can go anywhere in the box. */
    .reach { position: fixed; left: 0; top: 0; width: 100vw; height: 100vh; overflow: visible; display: none; }
    .reach.on { display: block; }
    .sleeve-outline { fill: none; stroke: #3a2f3f; stroke-width: calc(14px * var(--s, 1)); stroke-linecap: round; }
    .sleeve { fill: none; stroke: #fff; stroke-width: calc(9.5px * var(--s, 1)); stroke-linecap: round; }
    .hand circle, .grips circle { fill: #f4c9a4; stroke: #3a2f3f; stroke-width: 2; }

    .loot { position: fixed; left: 0; top: 0; color: #e4572e; white-space: pre; transform-origin: 50% 40%; will-change: transform; }

    /* Read out by screen readers, invisible on screen. */
    .announcer { position: fixed; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  `;

  const SKIN = '#f4c9a4', LINE = '#3a2f3f';
  const MARKUP = `
    <div class="stage away">
     <div class="rig">
      <div class="chef">
        <div class="bob">
          <svg class="face" viewBox="0 0 140 150">
            <ellipse cx="26" cy="104" rx="7" ry="9" fill="${SKIN}" stroke="${LINE}" stroke-width="2.5"/>
            <ellipse cx="114" cy="104" rx="7" ry="9" fill="${SKIN}" stroke="${LINE}" stroke-width="2.5"/>
            <ellipse cx="70" cy="104" rx="44" ry="44" fill="${SKIN}" stroke="${LINE}" stroke-width="2.5"/>
            <!-- toque, pulled down so the band sits just above the eyebrows -->
            <g transform="translate(0 10)">
              <g fill="#fff" stroke="${LINE}" stroke-width="2.5">
                <circle cx="45" cy="32" r="20"/><circle cx="95" cy="32" r="20"/><circle cx="70" cy="22" r="24"/>
                <rect x="38" y="38" width="64" height="26" rx="5"/>
              </g>
              <path d="M54 44 V60 M70 44 V60 M86 44 V60" stroke="#d9d4de" stroke-width="2" stroke-linecap="round"/>
            </g>
            <circle cx="44" cy="112" r="7" fill="#ff8a8a" opacity=".4"/>
            <circle cx="96" cy="112" r="7" fill="#ff8a8a" opacity=".4"/>
            <path d="M45 82 Q54 76 62 81 M78 81 Q86 76 95 82" stroke="#5a3a22" stroke-width="3" fill="none" stroke-linecap="round"/>
            <g class="eye">
              <ellipse cx="54" cy="96" rx="8.5" ry="9.5" fill="#fff" stroke="${LINE}" stroke-width="1.5"/>
              <g class="pupil"><circle cx="54" cy="97" r="4.5" fill="#2a2233"/><circle cx="55.8" cy="95.2" r="1.5" fill="#fff"/></g>
            </g>
            <g class="eye">
              <ellipse cx="86" cy="96" rx="8.5" ry="9.5" fill="#fff" stroke="${LINE}" stroke-width="1.5"/>
              <g class="pupil"><circle cx="86" cy="97" r="4.5" fill="#2a2233"/><circle cx="87.8" cy="95.2" r="1.5" fill="#fff"/></g>
            </g>
            <ellipse cx="70" cy="108" rx="6.5" ry="5.5" fill="#e8a888"/>
            <path class="mouth-closed" d="M63 128 Q70 133 77 128" stroke="${LINE}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
            <ellipse class="mouth-open" cx="70" cy="128" rx="6" ry="5" fill="#6b2b2b"/>
            <!-- mustache -->
            <path d="M70 114 C62 109 52 111 48 118 C46 121 42 120 41 116 C42 124 54 127 62 122 C66 120 69 119 70 118 C71 119 74 120 78 122 C86 127 98 124 99 116 C98 120 94 121 92 118 C88 111 78 109 70 114 Z" fill="#5a3a22"/>
          </svg>
        </div>
      </div>
      <div class="pot-slot">
        <svg class="pot" viewBox="0 0 64 90">
          <g class="steam">
            <path d="M22 44 q-5 -7 0 -14 q5 -7 0 -14"/>
            <path d="M32 42 q-5 -7 0 -14 q5 -7 0 -14 q-5 -6 0 -12"/>
            <path d="M42 44 q-5 -7 0 -14 q5 -7 0 -14"/>
          </g>
          <rect x="0" y="58" width="9" height="7" rx="3.5" fill="#3b404c" stroke="${LINE}" stroke-width="2"/>
          <rect x="55" y="58" width="9" height="7" rx="3.5" fill="#3b404c" stroke="${LINE}" stroke-width="2"/>
          <path d="M6 52 H58 V78 Q58 88 48 88 H16 Q6 88 6 78 Z" fill="#5b6272" stroke="${LINE}" stroke-width="2.5"/>
          <ellipse cx="32" cy="52" rx="27" ry="6" fill="#3b404c" stroke="${LINE}" stroke-width="2.5"/>
          <ellipse class="soup" cx="32" cy="52" rx="22" ry="3.5" fill="#e8833a"/>
        </svg>
      </div>
      <div class="bubble"></div>
      <svg class="grips" viewBox="0 0 140 22">
        <g class="grip-left"><circle cx="26" cy="11" r="6.5"/><circle cx="38" cy="9" r="6.5"/><circle cx="50" cy="11" r="6.5"/></g>
        <g class="grip-right"><circle cx="90" cy="11" r="6.5"/><circle cx="102" cy="9" r="6.5"/><circle cx="114" cy="11" r="6.5"/></g>
      </svg>
     </div>
    </div>
    <div class="loot-layer"></div>
    <svg class="reach">
      <path class="sleeve-outline"/>
      <path class="sleeve"/>
      <g class="hand">
        <circle cx="0" cy="0" r="7.5"/>
        <circle class="finger" r="3.6"/><circle class="finger" r="3.6"/><circle class="finger" r="3.6"/>
      </g>
    </svg>
    <div class="announcer" role="status" aria-live="polite"></div>
  `;

  // Text styles copied onto the hidden measuring copy of a box, and onto a stolen character.
  const MIRRORED = ['boxSizing', 'width', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth',
    'borderLeftWidth', 'borderStyle', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontVariant', 'fontStretch',
    'fontFeatureSettings', 'fontKerning', 'lineHeight', 'letterSpacing', 'wordSpacing',
    'textIndent', 'textTransform', 'tabSize'];
  const LOOT_FONT = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing'];

  const wait = n => new Promise(done => setTimeout(done, n));
  const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const easeOut = t => 1 - (1 - t) ** 3;
  const easeInOut = t => t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;

  function tween(duration, step) {
    return new Promise(done => {
      const start = performance.now();
      requestAnimationFrame(function frame(now) {
        const t = Math.min(1, (now - start) / duration);
        step(t);
        t < 1 ? requestAnimationFrame(frame) : done();
      });
    });
  }

  function isTextBox(el) {
    if (!el || el.readOnly || el.disabled || el.dataset.letterThief === 'off') return false;
    if (el instanceof HTMLTextAreaElement) return true;
    return el instanceof HTMLInputElement && BOX_TYPES.includes(el.type);
  }

  // Sets a box's value the way the browser does, so frameworks that watch `value` notice.
  function setNativeValue(box, value) {
    const proto = box instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(box, value);
  }

  function start() {
    if (document.getElementById('letter-thief')) return;     // script included twice

    const host = document.createElement('div');
    host.id = 'letter-thief';
    host.setAttribute('style', 'all: initial; position: fixed; left: 0; top: 0; width: 0; height: 0; z-index: 2147483000; pointer-events: none;');
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${STYLE}</style>${MARKUP}`;
    document.body.append(host);

    const $ = selector => root.querySelector(selector);
    const stage = $('.stage');
    const chef = $('.chef');
    const face = $('.face');
    const pupils = [...root.querySelectorAll('.pupil')];
    const pot = $('.pot');
    const soup = $('.soup');
    const bubble = $('.bubble');
    const lootLayer = $('.loot-layer');
    const reach = $('.reach');
    const sleeves = [...reach.querySelectorAll('path')];
    const hand = reach.querySelector('.hand');
    const fingers = [...reach.querySelectorAll('.finger')];
    const announcer = $('.announcer');
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

    let home = null;                   // the box the chef is on
    let nextHome = null;               // the box the chef should go to next
    let lastValue = '';
    let targets = [];                  // characters waiting in the box, oldest first: { index, key, gone }
    const claimed = new Set();         // what the chef is going for or already has
    const collected = new Set();
    let busy = false, finished = false;
    let introduced = false;            // screen readers hear who the chef is on the first arrival
    let scale = 1;                     // the chef's size on the current box
    let lastQuip = '', bubbleTimer, duckTimer;

    // Animations speed up when there's a backlog to collect.
    const ms = n => reduceMotion ? 1 : n * Math.min(1, Math.max(.35, 1 - (targets.length - 1) * .12));

    // --- the chef does one thing at a time: move, collect, leave ------------

    let chain = Promise.resolve(), queued = 0, moveQueued = false, workQueued = false;

    function schedule(task) {
      queued++;
      busy = true;
      startTracking();
      chain = chain.then(async () => {
        try { await task(); }
        catch (err) { console.error('[letter-thief]', err); }
        finally {
          busy = --queued > 0;
          if (!busy && home && !finished) followCaret();
        }
      });
    }

    function requestMove(box) {
      nextHome = box;
      if (moveQueued || finished) return;
      moveQueued = true;
      schedule(async () => {
        moveQueued = false;
        if (finished || nextHome === home) return;
        if (home) await duckAway();
        settleOn(nextHome);
        await arrive();
      });
    }

    function requestWork() {
      if (workQueued) return;
      workQueued = true;
      schedule(async () => {
        workQueued = false;
        await collectAll();
      });
    }

    // --- where things are ---------------------------------------------------

    // A number from the box or the script tag wins. Otherwise the chef is sized to the box's text,
    // and shrunk if the box is too narrow for chef and pot.
    function sizeFor(box, width) {
      const chosen = parseFloat(box.dataset.letterThiefSize || defaultSize);
      if (chosen > 0) return chosen;
      // A box removed from the page has no font size; keep the usual size until the chef moves on.
      const text = parseFloat(getComputedStyle(box).fontSize) || AUTO_TEXT_SIZE;
      const byText = text / AUTO_TEXT_SIZE * AUTO_SIZE_AT_TEXT_SIZE;
      return Math.max(MIN_AUTO_SIZE, Math.min(MAX_AUTO_SIZE, byText, width / SPAN_W));
    }

    // Pins the chef to the box's top edge. While the chef is busy or the box has focus this runs
    // every frame; otherwise only when something could have moved the box, so an idle page
    // costs nothing.
    function pinToBox() {
      if (!home) return;
      const r = home.getBoundingClientRect();
      scale = sizeFor(home, r.width);
      host.style.setProperty('--s', scale);
      stage.style.display = r.width || r.height ? 'block' : 'none';
      stage.style.transform = `translate(${r.left}px, ${r.top}px)`;
      stage.style.width = r.width + 'px';
    }

    let tracking = false, pinQueued = false;

    function startTracking() {
      if (tracking) return;
      tracking = true;
      requestAnimationFrame(function track() {
        pinToBox();
        if (home && (busy || document.activeElement === home)) requestAnimationFrame(track);
        else tracking = false;
      });
    }

    // One re-pin on the next frame, for anything that could move the box while the chef is idle.
    function requestPin() {
      if (tracking || pinQueued || !home) return;
      pinQueued = true;
      requestAnimationFrame(() => { pinQueued = false; pinToBox(); });
    }
    addEventListener('scroll', requestPin, { capture: true, passive: true });
    addEventListener('resize', requestPin, { passive: true });
    visualViewport?.addEventListener('resize', requestPin);    // phones: the keyboard opening or closing
    visualViewport?.addEventListener('scroll', requestPin);
    const boxWatcher = new ResizeObserver(requestPin);           // the box, or the page around it, changing size

    const edgeTop = () => home.getBoundingClientRect().top;

    function charPoint(text, index) {
      const cs = getComputedStyle(home);
      const singleLine = home instanceof HTMLInputElement;
      const mirror = document.createElement('div');
      for (const p of MIRRORED) mirror.style[p] = cs[p];
      Object.assign(mirror.style, {
        position: 'absolute', top: '0', left: '-9999px', visibility: 'hidden',
        whiteSpace: singleLine ? 'pre' : 'pre-wrap', overflowWrap: 'break-word', overflow: 'hidden',
      });
      const marker = document.createElement('span');
      marker.style.display = 'inline-block';
      marker.textContent = text[index] || '';
      mirror.append(text.slice(0, index), marker, text.slice(index + 1));
      root.append(mirror);
      const rect = home.getBoundingClientRect();
      // A one-line box centres its text vertically and scrolls sideways instead of wrapping.
      const centring = singleLine
        ? (home.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - marker.offsetHeight) / 2
        : 0;
      const point = {
        x: rect.left + home.clientLeft + marker.offsetLeft - home.scrollLeft,
        y: rect.top + home.clientTop + marker.offsetTop + centring - home.scrollTop,
        w: marker.offsetWidth,
        h: marker.offsetHeight,
      };
      mirror.remove();
      return point;
    }

    // `left` is in screen pixels from the box's left edge; --x is in normal-size chef units.
    function placeChef(left) {
      const width = home.getBoundingClientRect().width / scale;
      stage.style.setProperty('--x', Math.max(-10, Math.min(width - SPAN_W, left / scale)) + 'px');
    }

    function lookAt(cx, cy) {
      const r = face.getBoundingClientRect();
      pupils.forEach((pupil, i) => {
        const dx = cx - (r.left + EYES[i].x * scale), dy = cy - (r.top + EYES[i].y * scale);
        const d = Math.hypot(dx, dy) || 1, reach = Math.min(4, d / 20);
        pupil.style.transform = `translate(${dx / d * reach}px, ${dy / d * reach}px)`;
      });
    }

    function followCaret() {
      const p = charPoint(home.value, home.selectionStart ?? home.value.length);
      placeChef(p.x - home.getBoundingClientRect().left - HEAD_W * scale / 2);
      lookAt(p.x, p.y);
    }

    function say(text, duration = 1100) {
      if (text || !bubble.classList.contains('show')) {
        if (!text) {
          do text = QUIPS[Math.floor(Math.random() * QUIPS.length)]; while (text === lastQuip);
          lastQuip = text;
        }
        bubble.textContent = text;
        bubble.classList.add('show');
      }
      clearTimeout(bubbleTimer);
      bubbleTimer = setTimeout(() => bubble.classList.remove('show'), duration);
    }

    // What a screen reader user hears. Emptied first so the same words are read again.
    function announce(text) {
      announcer.textContent = '';
      setTimeout(() => { announcer.textContent = text; }, 50);
    }

    // --- the arm ------------------------------------------------------------

    function shoulder() {
      return { x: chef.getBoundingClientRect().left + SHOULDER_X * scale, y: edgeTop() + 2 };
    }

    function potRim() {
      const r = pot.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + 52 * r.height / 90 };
    }

    // Fingertips go to the top of the character.
    function target(job) {
      const p = charPoint(home.value, job.index);
      return { x: p.x + p.w / 2, y: p.y + p.h * .4 };
    }

    function aboveThePot(letter) {
      const rim = potRim();
      return { x: rim.x, y: rim.y - 6 * scale - letter.h * .6 };
    }

    // A bendy sleeve from the shoulder to the hand; grip 0 is open, 1 is pinched shut.
    function drawArm(from, pinch, grip) {
      const dx = pinch.x - from.x, dy = pinch.y - from.y, len = Math.hypot(dx, dy) || 1;
      const bend = Math.min(40 * scale, len * .35) * (dy < 0 ? -1 : 1);
      const elbow = { x: (from.x + pinch.x) / 2 + dy / len * bend, y: (from.y + pinch.y) / 2 - dx / len * bend };
      const ex = pinch.x - elbow.x, ey = pinch.y - elbow.y, elen = Math.hypot(ex, ey) || 1;
      const palm = { x: pinch.x - ex / elen * 7 * scale, y: pinch.y - ey / elen * 7 * scale };
      const d = `M${from.x} ${from.y} Q${elbow.x} ${elbow.y} ${palm.x} ${palm.y}`;
      for (const path of sleeves) path.setAttribute('d', d);
      hand.setAttribute('transform',
        `translate(${palm.x} ${palm.y}) rotate(${Math.atan2(ey, ex) * 180 / Math.PI}) scale(${scale})`);
      fingers.forEach((finger, i) => {
        finger.setAttribute('cx', (i === 1 ? 9 : 7) - 3 * grip);
        finger.setAttribute('cy', (i - 1) * (6.5 - 3 * grip));
      });
    }

    function holdLetter(letter, at, t) {
      letter.pos = { x: at.x - letter.w / 2, y: at.y - letter.h * .4 };
      letter.tilt = Math.sin(t * Math.PI * 2) * 14;
      letter.el.style.transform = `translate(${letter.pos.x}px, ${letter.pos.y}px) rotate(${letter.tilt}deg)`;
    }

    // Leaves a space where the character was, so the text doesn't shift and the gap shows.
    function blankCharAt(index) {
      const v = home.value;
      const { selectionStart, selectionEnd } = home;
      setNativeValue(home, v.slice(0, index) + ' ' + v.slice(index + 1));
      home.setSelectionRange(selectionStart, selectionEnd);
      lastValue = home.value;
      home.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Take the character out of the box and put it in the chef's hand.
    function pluck(job) {
      const ch = home.value[job.index];
      if (!ch || ch.toLowerCase() !== job.key) return null;
      const p = charPoint(home.value, job.index);
      const cs = getComputedStyle(home);
      const el = document.createElement('span');
      el.className = 'loot';
      el.textContent = ch;
      for (const prop of LOOT_FONT) el.style[prop] = cs[prop];
      lootLayer.append(el);
      blankCharAt(job.index);
      announce(`The chef stole the ${/\d/.test(ch) ? 'number ' + ch : 'letter ' + ch.toUpperCase()}.`);
      const letter = { el, key: job.key, w: p.w, h: p.h };
      holdLetter(letter, { x: p.x + p.w / 2, y: p.y + p.h * .4 }, 0);
      return letter;
    }

    function dropInPot(letter) {
      const { x, y } = letter.pos;
      const fall = potRim().y - (y + letter.h * .5);
      return letter.el.animate([
        { transform: `translate(${x}px, ${y}px) rotate(${letter.tilt}deg)`, opacity: 1 },
        { transform: `translate(${x}px, ${y + fall}px) scale(.3)`, opacity: 0 },
      ], { duration: ms(220), easing: 'ease-in', fill: 'forwards' }).finished.then(() => {
        letter.el.remove();
        soup.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.12, 1.8)' }, { transform: 'scale(1)' }],
                     { duration: 300 });
        collected.add(letter.key);
        if (collected.size < WANTED.length) say();
      });
    }

    async function reachFor(job) {
      placeChef(target(job).x - home.getBoundingClientRect().left - (SHOULDER_X - 14) * scale);
      stage.classList.add('reaching');
      reach.classList.add('on');

      // Down to the character, following it if the text shifts.
      let handAt = shoulder();
      await tween(ms(320), t => {
        if (job.gone) return;
        const to = target(job);
        handAt = lerp(shoulder(), to, easeOut(t));
        drawArm(shoulder(), handAt, 0);
        lookAt(to.x, to.y);
      });

      let letter = null;
      if (!job.gone) {
        await tween(ms(100), t => { if (!job.gone) drawArm(shoulder(), handAt = target(job), t); });
        if (!job.gone) {
          letter = pluck(job);
          if (!letter) claimed.delete(job.key);     // it isn't where it should be; wait for the next one
        }
      }
      targets = targets.filter(j => j !== job);
      if (!letter) say('hey!');             // you deleted it before the chef got there

      // Up to the pot, or back empty-handed.
      const from = handAt;
      await tween(ms(letter ? 360 : 220), t => {
        const to = letter ? aboveThePot(letter) : shoulder();
        handAt = lerp(from, to, easeInOut(t));
        drawArm(shoulder(), handAt, letter ? 1 : 0);
        if (letter) holdLetter(letter, handAt, t);
        lookAt(handAt.x, handAt.y);
      });

      if (letter) {
        const released = handAt;
        await Promise.all([
          dropInPot(letter),
          tween(ms(160), t => drawArm(shoulder(), lerp(released, shoulder(), easeInOut(t)), 0)),
        ]);
      }
      reach.classList.remove('on');
      stage.classList.remove('reaching');
    }

    async function collectAll() {
      if (!targets.length || finished) return;
      clearTimeout(duckTimer);
      stage.classList.remove('ducking');
      stage.classList.add('eager');
      while (targets.length) await reachFor(targets[0]);
      stage.classList.remove('eager');
      if (collected.size === WANTED.length) {
        finished = true;
        await leaveForGood();
      }
    }

    // --- arriving, following and leaving ------------------------------------

    // Moves the pot up past the edge and on to `to`, the chef's right hand on its handle
    // whenever the handle is above the box (below it, the hand is "behind" the box too).
    async function carryPot(from, to) {
      stage.classList.add('reaching');
      let handle = shoulder();
      const hold = y => {
        pot.style.transform = `translateY(${y}px)`;
        const r = pot.getBoundingClientRect();
        handle = { x: r.left + POT_HANDLE.x * scale, y: r.top + POT_HANDLE.y * scale };
        const visible = handle.y < edgeTop();
        reach.classList.toggle('on', visible);
        if (visible) drawArm(shoulder(), handle, 1);
      };
      await tween(ms(460), t => hold(from + (POT_LIFT - from) * easeOut(t)));
      await tween(ms(280), t => hold(POT_LIFT + (to - POT_LIFT) * easeInOut(t)));
      return handle;
    }

    async function letGo(from) {
      if (reach.classList.contains('on')) {
        await tween(ms(180), t => drawArm(shoulder(), lerp(from, shoulder(), easeInOut(t)), 0));
      }
      reach.classList.remove('on');
      stage.classList.remove('reaching');
    }

    // Start fresh on a new box: only what's typed from now on counts.
    function settleOn(box) {
      for (const job of targets) claimed.delete(job.key);
      targets = [];
      home = box;
      lastValue = box.value;
      boxWatcher.disconnect();
      boxWatcher.observe(box);
      boxWatcher.observe(document.body);
      stage.classList.add('jump');                 // appear in place rather than sliding over
      pinToBox();
      followCaret();
      stage.getBoundingClientRect();
      stage.classList.remove('jump');
    }

    async function arrive() {
      stage.classList.remove('away');              // pop up from behind the box
      if (!introduced) {
        introduced = true;
        announce('A chef has appeared on this text box and will steal the first of every letter and number you type.');
      }
      await wait(ms(350));
      say('bonjour!');
      await wait(ms(250));
      const handle = await carryPot(POT_HIDDEN, 0);
      pot.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.08, .9)' }, { transform: 'scale(1)' }],
                  { duration: ms(220) });
      pot.classList.add('cooking');
      await letGo(handle);
    }

    // Quick exit when following you to another box: duck, taking the pot along.
    async function duckAway() {
      bubble.classList.remove('show');
      pot.classList.remove('cooking');
      stage.classList.add('away');
      await tween(ms(260), t => { pot.style.transform = `translateY(${POT_HIDDEN * t * t}px)`; });
      await wait(ms(120));
    }

    async function leaveForGood() {
      say('soup\'s ready! au revoir!', 2400);
      await wait(ms(1600));
      pot.classList.remove('cooking');
      await letGo(await carryPot(0, POT_HIDDEN));
      stage.classList.add('away');
      announce('The chef has every letter and number, and has left.');
      await wait(ms(300));                         // let the duck-down finish
      stage.style.display = 'none';
      boxWatcher.disconnect();
      home = null;                                 // nothing left to follow, so the frame loop stops
    }

    // --- watching the box ---------------------------------------------------

    // Work out what changed since last time so queued characters keep pointing at the right spot.
    function onEdit() {
      const before = lastValue, now = home.value;
      if (before === now) return;
      let start = 0;
      while (start < before.length && start < now.length && before[start] === now[start]) start++;
      let endBefore = before.length, endNow = now.length;
      while (endBefore > start && endNow > start && before[endBefore - 1] === now[endNow - 1]) {
        endBefore--; endNow--;
      }
      for (const job of targets) {
        if (job.index >= endBefore) job.index += endNow - endBefore;
        else if (job.index >= start) { job.gone = true; claimed.delete(job.key); }
      }
      targets = targets.filter(job => !job.gone);
      let added = 0;
      for (let i = start; i < endNow; i++) {
        const key = now[i].toLowerCase();
        if (WANTED.includes(key) && !claimed.has(key)) {
          claimed.add(key);
          targets.push({ index: i, key, gone: false });
          added++;
        }
      }
      lastValue = now;

      if (added) requestWork();
      else if (!busy) followCaret();
    }

    const onHome = e => e.target === home && !finished;
    document.addEventListener('focusin', e => { if (isTextBox(e.target)) requestMove(e.target); });
    document.addEventListener('input', e => { if (onHome(e) && !e.isComposing) onEdit(); }, true);
    document.addEventListener('compositionend', e => { if (onHome(e)) onEdit(); }, true);
    document.addEventListener('click', e => { if (onHome(e) && !busy) followCaret(); }, true);
    document.addEventListener('keyup', e => {
      if (onHome(e) && !busy && e.key?.startsWith('Arrow')) followCaret();
    }, true);
    document.addEventListener('pointermove', e => { if (home && !busy && !finished) lookAt(e.clientX, e.clientY); });

    // Waits for anything the chef is doing to finish, then starts over with an empty pot.
    // A focused text box gets the new chef straight away; otherwise the next box clicked does.
    hireNewChef = () => schedule(async () => {
      if (home && !finished) await duckAway();
      targets = [];
      claimed.clear();
      collected.clear();
      finished = introduced = false;
      home = nextHome = null;
      boxWatcher.disconnect();
      stage.classList.remove('eager', 'reaching', 'ducking');
      stage.classList.add('away');
      stage.style.display = 'none';
      reach.classList.remove('on');
      pot.classList.remove('cooking');
      pot.style.transform = '';
      if (isTextBox(document.activeElement)) requestMove(document.activeElement);
    });

    // Poke the chef and they duck.
    chef.addEventListener('pointerenter', () => {
      if (!home || busy || finished || stage.classList.contains('ducking')) return;
      stage.classList.add('ducking');
      duckTimer = setTimeout(() => stage.classList.remove('ducking'), 1400);
    });

    if (isTextBox(document.activeElement)) requestMove(document.activeElement);
  }

  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);
})();
