// ===== SCROLL ANIMATIONS =====
const observer = new IntersectionObserver((entries) => {
  entries.forEach((e, i) => {
    if (e.isIntersecting) {
      setTimeout(() => e.target.classList.add('visible'), i * 80);
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('[data-animate]').forEach(el => observer.observe(el));

// ===== NAV SCROLL EFFECT =====
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav?.classList.toggle('scrolled', window.scrollY > 40);
});

// ===== HAMBURGER MENU =====
const hamburger = document.getElementById('hamburger');
const navMobile = document.getElementById('navMobile');
hamburger?.addEventListener('click', () => {
  navMobile?.classList.toggle('open');
  const spans = hamburger.querySelectorAll('span');
  const isOpen = navMobile?.classList.contains('open');
  if (spans[0]) spans[0].style.transform = isOpen ? 'rotate(45deg) translate(5px,5px)' : '';
  if (spans[1]) spans[1].style.opacity = isOpen ? '0' : '1';
  if (spans[2]) spans[2].style.transform = isOpen ? 'rotate(-45deg) translate(5px,-5px)' : '';
});

// ===== COPY CODE =====
function copyCode(btn) {
  const code = btn.dataset.code || btn.closest('.code-card')?.querySelector('.code-body')?.innerText || '';
  navigator.clipboard.writeText(code).then(() => {
    const orig = btn.textContent;
    btn.textContent = '복사됨 ✓';
    btn.style.color = 'var(--green)';
    setTimeout(() => { btn.textContent = orig; btn.style.color = ''; }, 2000);
  });
}

// ===== PAYMENT TAB SWITCHER (demo page) =====
function selectPayTab(el) {
  document.querySelectorAll('.pm-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  const tab = el.dataset.method || '';
  const btn = document.getElementById('payBtn');
  const labels = { kakaopay:'카카오페이로', naverpay:'네이버페이로', tosspay:'토스페이로', bank:'계좌이체로' };
  if (btn) btn.textContent = (labels[tab] || '') + (btn.dataset.amount ? ` ${btn.dataset.amount} 결제하기` : ' 결제하기');
}

// ===== CARD FORMATTING =====
function formatCard(input) {
  let v = input.value.replace(/\D/g, '').slice(0, 16);
  input.value = v.match(/.{1,4}/g)?.join(' ') || v;
}
function formatExp(input) {
  let v = input.value.replace(/\D/g, '').slice(0, 4);
  if (v.length >= 2) v = v.slice(0, 2) + ' / ' + v.slice(2);
  input.value = v;
}

// ===== DEMO PAYMENT SIMULATION =====
function simulatePay(amount) {
  const btn = document.getElementById('payBtn');
  if (!btn) return;
  const orig = btn.textContent;
  btn.textContent = '처리 중...';
  btn.disabled = true;
  btn.style.opacity = '0.7';
  setTimeout(() => {
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.textContent = orig;
    const txId = 'pay_live_' + Math.random().toString(36).slice(2, 18).toUpperCase();
    const overlay = document.getElementById('successOverlay');
    const txEl = document.getElementById('txId');
    if (txEl) txEl.textContent = 'TX: ' + txId;
    if (overlay) overlay.classList.add('show');
  }, 1800);
}

function closeSuccess() {
  document.getElementById('successOverlay')?.classList.remove('show');
}
