/**
 * DOM-side choreography: chapter activation, the progress rail, the counter
 * and the custom cursor. Kept separate from the WebGL loop so the poem still
 * reads if the canvas fails.
 */
export function initTypography() {
  const sections = Array.from(document.querySelectorAll('.chapter'));
  const railFill = document.querySelector('#railFill');
  const indexEl = document.querySelector('#chapterIndex');
  const cursor = document.querySelector('#cursor');
  const veil = document.querySelector('#veil');
  const toTopLinks = Array.from(document.querySelectorAll('[data-to-top]'));

  let currentIndex = -1;

  function setActive(index) {
    if (index === currentIndex) return;
    currentIndex = index;
    sections.forEach((section, i) => {
      section.classList.toggle('is-active', i === index);
    });
    if (indexEl) indexEl.textContent = String(index).padStart(2, '0');
  }

  function update(progress) {
    if (railFill) railFill.style.height = `${(progress * 100).toFixed(2)}%`;
    const index = Math.round(progress * (sections.length - 1));
    setActive(Math.max(0, Math.min(sections.length - 1, index)));
    document.body.classList.toggle('is-finale', progress > 0.94);
  }

  setActive(0);

  // --- custom cursor -----------------------------------------------------
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (finePointer && cursor && !reduceMotion) {
    document.body.classList.add('has-cursor');

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let x = targetX;
    let y = targetY;

    window.addEventListener(
      'pointermove',
      (event) => {
        targetX = event.clientX;
        targetY = event.clientY;
        cursor.classList.add('is-visible');
      },
      { passive: true },
    );

    document.addEventListener('pointerleave', () => cursor.classList.remove('is-visible'));

    document.addEventListener('pointerover', (event) => {
      if (event.target.closest('a, button')) cursor.classList.add('is-hover');
    });
    document.addEventListener('pointerout', (event) => {
      if (event.target.closest('a, button')) cursor.classList.remove('is-hover');
    });

    const tick = () => {
      x += (targetX - x) * 0.22;
      y += (targetY - y) * 0.22;
      cursor.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      requestAnimationFrame(tick);
    };
    tick();
  }

  // --- both marks return to the noise -----------------------------------
  for (const link of toTopLinks) {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }

  function ready() {
    document.body.classList.add('loaded');
    window.setTimeout(() => veil?.remove(), 1600);
  }

  return { update, ready };
}
