/**
 * display.js — Timer display & fullscreen animations (display window only)
 */

const DOM = {
  timer: document.getElementById('floating-timer'),
  speaker: document.getElementById('speaker-name'),
  clock: document.getElementById('clock'),
  moneyCounter: document.getElementById('money-counter'),
  moneyValue: document.getElementById('money-value'),
  overlay: document.getElementById('fullscreen-overlay'),
  envelope: document.getElementById('envelope'),
  envelopeFlap: document.getElementById('envelope-flap'),
  envelopeCost: document.getElementById('envelope-cost'),
  billsContainer: document.getElementById('bills-container'),
  thankyou: document.getElementById('thankyou-msg'),
  tyCost: document.getElementById('ty-cost'),
  confettiCanvas: document.getElementById('confetti-canvas'),
  animationQuote: document.getElementById('animation-quote'),
};

let prevPhase = 'idle';
let animating = false;



/* ═══════ STATE POLLING (JS → Python) ═══════ */

window.addEventListener('pywebviewready', () => {
  setInterval(pollState, 150);
});

async function pollState() {
  if (animating) return;
  try {
    const state = await pywebview.api.get_state();
    renderState(state);
  } catch (e) { /* pywebview not ready */ }
}

function renderState(state) {
  if (animating) return;

  const phase = state.phase;

  // Phase class on floating timer
  DOM.timer.className = '';
  if (phase === 'idle') {
    DOM.timer.classList.add('idle');
  } else {
    DOM.timer.classList.add(`phase-${phase}`);
  }

  // Speaker name
  DOM.speaker.textContent = state.speaker || '';

  // Clock
  if (phase === 'overtime') {
    const otMin = Math.floor(state.overtime_seconds / 60);
    const otSec = Math.floor(state.overtime_seconds % 60);
    DOM.clock.textContent = `+${String(otMin).padStart(2, '0')}:${String(otSec).padStart(2, '0')}`;
  } else if (phase === 'idle' || phase === 'collecting' || phase === 'thankyou') {
    DOM.clock.textContent = '00:00';
  } else {
    DOM.clock.textContent = state.remaining_display;
  }

  // Money counter — visible only during overtime, shown beside the clock
  if (phase === 'overtime') {
    DOM.moneyCounter.classList.remove('hidden');
    DOM.moneyValue.textContent = `￥${Math.floor(state.cost)}`;
  } else {
    DOM.moneyCounter.classList.add('hidden');
  }

  // ═══════ ALARM TRIGGERS ═══════
  // Alarms are played natively via Python (winsound) — no JS audio needed.

  // Trigger animation on STOP → collecting
  if (phase === 'collecting' && prevPhase !== 'collecting' && prevPhase !== 'thankyou' && prevPhase !== 'idle') {
    if (state.cost > 0) {
      playEnvelopeAnimation(state.cost, state.quote);
    } else {
      playOnTimeAnimation(state.speaker, state.quote);
    }
  }

  prevPhase = phase;
}



/* ═══════ RED ENVELOPE ANIMATION ═══════ */

async function playEnvelopeAnimation(cost, quote) {
  if (animating) return;
  animating = true;

  try {
    try { await pywebview.api.go_fullscreen(); } catch (e) { }

    DOM.overlay.classList.remove('hidden');
    DOM.envelopeCost.textContent = `￥${Math.floor(cost)}`;

    DOM.envelope.style.animation = 'none';
    DOM.envelopeFlap.classList.remove('opened');
    DOM.thankyou.classList.add('hidden');
    DOM.billsContainer.innerHTML = '';

    // Show quote below envelope
    if (quote && DOM.animationQuote) {
      DOM.animationQuote.textContent = quote;
      DOM.animationQuote.classList.remove('hidden');
      DOM.animationQuote.style.animation = 'quoteReveal 1s ease 0.3s forwards';
      DOM.animationQuote.style.opacity = '0';
    }

    await sleep(50);
    DOM.envelope.style.animation = 'envelopeSlideUp 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
    await sleep(900);

    spawnBills(8);
    await sleep(1800);

    DOM.envelopeFlap.classList.add('opened');
    await sleep(600);

    DOM.envelope.style.opacity = '0';
    DOM.envelope.style.transition = 'opacity 0.4s';
    DOM.thankyou.classList.remove('hidden');
    DOM.tyCost.textContent = `￥${Math.floor(cost)}`;
    await sleep(200);

    launchConfetti();
    await sleep(3000);

    try { await pywebview.api.finish_animation(); } catch (e) { }
    await sleep(300);

  } catch (err) {
    console.error("Envelope animation error:", err);
  } finally {
    // Cleanup and reset
    DOM.overlay.classList.add('hidden');
    DOM.envelope.style.opacity = '1';
    DOM.envelope.style.display = '';
    DOM.envelope.style.transition = '';

    if (DOM.animationQuote) {
      DOM.animationQuote.classList.add('hidden');
      DOM.animationQuote.style.animation = '';
      DOM.animationQuote.style.opacity = '';
    }

    try { await pywebview.api.go_floating(); } catch (e) { }
    animating = false;
  }
}

/* ═══════ ON-TIME CONGRATULATION ANIMATION ═══════ */

async function playOnTimeAnimation(speaker, quote) {
  if (animating) return;
  animating = true;

  try {
    try { await pywebview.api.go_fullscreen(); } catch (e) { }

    DOM.overlay.classList.remove('hidden');

    DOM.envelope.style.display = 'none';
    DOM.billsContainer.innerHTML = '';

    DOM.thankyou.classList.remove('hidden');
    DOM.thankyou.classList.add('on-time');
    document.getElementById('ty-text').textContent = '准时完成!';
    document.getElementById('ty-sub').textContent = 'Finished on time — well done!';
    DOM.tyCost.textContent = ''; // Clear cost display


    // Show quote below congratulation
    if (quote && DOM.animationQuote) {
      DOM.animationQuote.textContent = quote;
      DOM.animationQuote.classList.remove('hidden');
      DOM.animationQuote.style.animation = 'quoteReveal 1s ease 0.3s forwards';
      DOM.animationQuote.style.opacity = '0';
    }

    await sleep(400);
    launchConfetti();
    await sleep(3000);

    try { await pywebview.api.finish_animation(); } catch (e) { }
    await sleep(300);

  } catch (err) {
    console.error("OnTime animation error:", err);
  } finally {
    // Cleanup
    DOM.overlay.classList.add('hidden');
    DOM.envelope.style.display = '';
    DOM.thankyou.classList.remove('on-time');
    DOM.tyCost.style.color = '';

    if (DOM.animationQuote) {
      DOM.animationQuote.classList.add('hidden');
      DOM.animationQuote.style.animation = '';
      DOM.animationQuote.style.opacity = '';
    }

    document.getElementById('ty-text').textContent = '感谢您的贡献';
    document.getElementById('ty-sub').textContent = 'Thank you for your contribution';

    try { await pywebview.api.go_floating(); } catch (e) { }
    animating = false;
  }
}

function spawnBills(count) {
  const bills = ['💵', '💴', '💶', '💷', '💰'];
  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight / 2;

  for (let i = 0; i < count; i++) {
    const bill = document.createElement('div');
    bill.className = 'bill';
    bill.textContent = bills[i % bills.length];

    const startX = Math.random() * window.innerWidth;
    const startY = Math.random() * window.innerHeight;
    const tx = centerX - startX;
    const ty = centerY - startY;
    const rot = (Math.random() - 0.5) * 360;

    bill.style.left = `${startX}px`;
    bill.style.top = `${startY}px`;
    bill.style.setProperty('--tx', `${tx}px`);
    bill.style.setProperty('--ty', `${ty}px`);
    bill.style.setProperty('--rot', `${rot}deg`);
    bill.style.animationDelay = `${i * 0.15}s`;

    DOM.billsContainer.appendChild(bill);
  }
}

/* ═══════ CONFETTI ═══════ */

function launchConfetti() {
  const canvas = DOM.confettiCanvas;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = ['#f1c40f', '#e74c3c', '#2ecc71', '#3498db', '#e67e22', '#9b59b6', '#1abc9c'];
  const particles = [];

  for (let i = 0; i < 150; i++) {
    particles.push({
      x: canvas.width / 2 + (Math.random() - 0.5) * 200,
      y: canvas.height / 2,
      vx: (Math.random() - 0.5) * 16,
      vy: -Math.random() * 18 - 4,
      w: Math.random() * 10 + 4,
      h: Math.random() * 6 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * 360,
      rv: (Math.random() - 0.5) * 12,
      gravity: 0.25 + Math.random() * 0.15,
    });
  }

  let frame = 0;
  const maxFrames = 180;

  function draw() {
    if (frame++ > maxFrames) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.rot += p.rv;
      p.vx *= 0.98;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, 1 - frame / maxFrames);
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    requestAnimationFrame(draw);
  }
  draw();
}

/* ═══════ KEYBOARD SHORTCUT ═══════ */

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    pywebview.api.stop_timer().catch(() => { });
  }
});

/* ═══════ DRAG SUPPORT ═══════ */

/* ═══════ DRAG SUPPORT ═══════ */

const dragBar = document.getElementById('drag-bar');
if (dragBar) {
  let isDragging = false;
  let startScreenX, startScreenY;

  dragBar.addEventListener('mousedown', (e) => {
    // Only allow left click
    if (e.button !== 0) return;
    isDragging = true;
    startScreenX = e.screenX;
    startScreenY = e.screenY;
    document.body.style.cursor = 'move';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    const dx = e.screenX - startScreenX;
    const dy = e.screenY - startScreenY;

    if (dx !== 0 || dy !== 0) {
      pywebview.api.move_window(dx, dy).catch(() => { });
      startScreenX = e.screenX;
      startScreenY = e.screenY;
    }
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
    document.body.style.cursor = '';
  });

  // Also stop dragging if mouse leaves window (optional, but safer)
  // document.addEventListener('mouseleave', () => isDragging = false);
}

/* ═══════ UTIL ═══════ */

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
