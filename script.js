const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// ---------- Sticky "xBoom" label: black over light sections (white product card, cream footer/top bar), white elsewhere ----------
const subnav = document.querySelector('.subnav');
const subnavLabel = subnav.querySelector('span');
const heroEl = document.querySelector('.hero');
let subnavFrame = 0;
function updateSubnavColor() {
  subnavFrame = 0;
  const r = subnavLabel.getBoundingClientRect();
  // what's directly behind the label (the bar itself ignores the pointer, so it isn't hit)
  const under = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  subnav.classList.toggle('is-on-light', !!under?.closest('.headliners, .footer, .gnb, .auracast-band'));
  subnav.classList.toggle('is-frosted', heroEl.getBoundingClientRect().bottom <= subnav.getBoundingClientRect().bottom);
}
const requestSubnavColor = () => { if (!subnavFrame) subnavFrame = requestAnimationFrame(updateSubnavColor); };
window.addEventListener('scroll', requestSubnavColor, { passive: true });
window.addEventListener('resize', requestSubnavColor);
requestSubnavColor();

// ---------- Hero ----------
const hero = document.querySelector('.hero');

// Split the headline into words so they can rise in one at a time (screen readers get the h1's aria-label)
const heroTitle = hero.querySelector('.hero__title');
heroTitle.setAttribute('aria-label', heroTitle.textContent.trim());
heroTitle.innerHTML = heroTitle.textContent.trim().split(/\s+/)
  .map((word, i) => `<span class="hero__word" style="--w:${i}" aria-hidden="true">${word}</span>`)
  .join(' ');

// Start the load-in once the photo is decoded (or after 800ms, whichever comes first)
const heroPhoto = hero.querySelector('.hero__photo img');
Promise.race([
  heroPhoto.decode().catch(() => {}),
  new Promise((resolve) => setTimeout(resolve, 800)),
]).then(() => hero.classList.add('is-ready'));

// Lockup color: a tinted copy of each piece is masked by the photo itself (see styles.css), so the
// color switches exactly at the jacket's edge. Here we line that mask up with the on-screen photo.
const lockup = hero.querySelector('.hero__lockup');
const lockupParts = [...lockup.querySelectorAll('span')];

function alignLockup() {
  // Wait until the photo and lockup have finished their load-in, so the mask matches their resting place
  const moving = [heroPhoto, ...lockupParts].some((el) => el.getAnimations().some((a) => a.playState === 'running'));
  if (moving) return;
  const img = heroPhoto.getBoundingClientRect();
  lockupParts.forEach((part) => {
    const r = part.getBoundingClientRect();
    part.style.setProperty('--photo-x', `${img.left - r.left}px`);
    part.style.setProperty('--photo-y', `${img.top - r.top}px`);
    part.style.setProperty('--photo-w', `${img.width}px`);
    part.style.setProperty('--photo-h', `${img.height}px`);
  });
  lockup.classList.add('is-aligned');
}

[heroPhoto, ...lockupParts].forEach((el) => el.addEventListener('animationend', alignLockup));
heroPhoto.decode().then(alignLockup).catch(() => {});
let lockupFrame = 0;
window.addEventListener('resize', () => {
  cancelAnimationFrame(lockupFrame);
  lockupFrame = requestAnimationFrame(alignLockup);
});

// Pause the idle equalizer while the hero is offscreen
new IntersectionObserver(([entry]) => {
  hero.classList.toggle('is-offscreen', !entry.isIntersecting);
}).observe(hero);

// Scroll parallax: --sp is how far the hero has scrolled away (0..1), written once per frame
let heroFrame = 0;
function requestHeroFrame() {
  if (reduceMotion.matches || heroFrame) return;
  heroFrame = requestAnimationFrame(() => {
    const sp = Math.min(1, Math.max(0, window.scrollY / hero.offsetHeight));
    hero.style.setProperty('--sp', sp.toFixed(4));
    heroFrame = 0;
  });
}
window.addEventListener('scroll', requestHeroFrame, { passive: true });
requestHeroFrame();

// ---------- Section exit fade (same idea as the hero) ----------
// Each section fades out as it scrolls up past the sticky xBoom bar and fades back in on the way down:
// fully visible until its bottom edge passes the middle of the screen, transparent when its bottom
// edge reaches the bar. Driven by scroll position, so it reverses naturally. Off for reduced motion.
const EXIT_TOP = 48; // sticky xBoom bar height
const exitSections = [...document.querySelectorAll('.gallery, .reviews, .faqs')]; // headliners and sign-up stay solid; AI Karaoke, Auracast and FYI RAiDiO have their own enter/exit fade
let exitFrame = 0;
function updateSectionExit() {
  exitFrame = 0;
  if (reduceMotion.matches) {
    exitSections.forEach((section) => { section.style.opacity = ''; });
    return;
  }
  const span = (window.innerHeight - EXIT_TOP) / 2;
  exitSections.forEach((section) => {
    const remaining = section.getBoundingClientRect().bottom - EXIT_TOP;
    const o = Math.min(1, Math.max(0, remaining / span));
    section.style.opacity = o < 1 ? o.toFixed(3) : '';
  });
}
const requestSectionExit = () => { if (!exitFrame) exitFrame = requestAnimationFrame(updateSectionExit); };
window.addEventListener('scroll', requestSectionExit, { passive: true });
window.addEventListener('resize', requestSectionExit);
requestSectionExit();

// Video modal
const videoModal = document.querySelector('.video-modal');
const video = videoModal.querySelector('.video-modal__video');
if (video.dataset.src) video.src = video.dataset.src;

// Opened by the hero's Watch video button and by every gallery photo
document.querySelectorAll('[data-video-open]').forEach((opener) => {
  opener.addEventListener('click', () => {
    videoModal.showModal();
    document.body.classList.add('has-modal');
    if (video.src) video.play().catch(() => {});
  });
});
videoModal.querySelector('[data-video-close]').addEventListener('click', () => videoModal.close());
videoModal.addEventListener('click', (e) => { // click on the backdrop
  if (e.target === videoModal) videoModal.close();
});
videoModal.addEventListener('close', () => {
  document.body.classList.remove('has-modal');
  video.pause();
});

// ---------- Gallery ("Tuned to perfection") ----------
const gallery = document.querySelector('.gallery');
const galleryRow = gallery.querySelector('.gallery__row');
const desktopGallery = window.matchMedia('(min-width: 927px)');

// Equalizer reveal: plays once, when a quarter of the section is on screen
const galleryReveal = new IntersectionObserver(([entry]) => {
  if (!entry.isIntersecting) return;
  gallery.classList.add('is-in');
  galleryReveal.disconnect();
}, { threshold: 0.25 });
galleryReveal.observe(gallery);

// Scroll drift: --gp runs -1 (section entering at the bottom) to 1 (leaving at the top)
let galleryFrame = 0;
function requestGalleryFrame() {
  if (reduceMotion.matches || !desktopGallery.matches || galleryFrame) return;
  galleryFrame = requestAnimationFrame(() => {
    const r = gallery.getBoundingClientRect();
    const p = (window.innerHeight - r.top) / (window.innerHeight + r.height);
    gallery.style.setProperty('--gp', (Math.min(1, Math.max(0, p)) * 2 - 1).toFixed(4));
    galleryFrame = 0;
  });
}
window.addEventListener('scroll', requestGalleryFrame, { passive: true });
requestGalleryFrame();

// Side-by-side layout (>=927px): photos scroll beneath the copy. A photo keeps its full size until its
// edge reaches the copy column, then shrinks (from its bottom-left corner) so its top stays below the
// copy. A 0.3s ease on `scale` (styles.css) turns that switch into a smooth shrink.
// Photos under the copy also stop drifting (--free), so drift can't push them into the text.
// Shrinking leaves a photo's layout box full size, so the photos after it are nudged left (style.left)
// by the width given up: the visible gap between photos stays 24px.
const galleryCopy = gallery.querySelector('.gallery__copy');
const galleryInner = gallery.querySelector('.gallery__inner');
const galleryImgs = [...galleryRow.querySelectorAll('.gallery__img')];
const FIT_GAP = 16;

function fitGalleryUnderCopy() {
  if (!desktopGallery.matches) {
    galleryImgs.forEach((img) => { img.style.scale = ''; img.style.left = ''; img.style.removeProperty('--free'); });
    return;
  }
  const copyRect = galleryCopy.getBoundingClientRect();
  // Resting position of the copy (ignores its reveal offset) and the bottom of the photos
  const copyBottom = galleryInner.getBoundingClientRect().top + galleryCopy.offsetTop + galleryCopy.offsetHeight;
  const rowBottom = galleryRow.getBoundingClientRect().bottom - parseFloat(getComputedStyle(galleryRow).paddingBottom);
  const maxH = rowBottom - copyBottom - FIT_GAP;
  // Layout positions, worked out from the row so the photos' own (animating) scale and nudge don't feed back
  const rowStyle = getComputedStyle(galleryRow);
  const gap = parseFloat(rowStyle.columnGap) || 0;
  let edge = galleryRow.getBoundingClientRect().left + parseFloat(rowStyle.paddingLeft) - galleryRow.scrollLeft;
  let lost = 0; // width given up by the shrunk photos so far, left to right
  galleryImgs.forEach((img) => {
    const w = img.offsetWidth;
    const h = img.offsetHeight;
    const left = edge;
    edge += w + gap;
    // Where the photo sits on screen once the shrunk photos before it have been nudged left
    const shown = left - lost;
    // >0: px of the full-size photo inside the copy column; <=0: it hasn't reached the column yet
    const under = Math.min(shown + w, copyRect.right) - Math.max(shown, copyRect.left);
    const t = under > 0 ? 1 : 0;
    const fitH = h - t * Math.max(0, h - maxH);
    const s = fitH / h;
    const loss = w * (1 - s);
    img.style.scale = s.toFixed(4);
    img.style.left = `${(-lost).toFixed(2)}px`;
    img.style.setProperty('--free', (1 - t).toFixed(3));
    lost += loss;
  });
}

let fitFrame = 0;
function requestGalleryFit() {
  if (fitFrame) return;
  fitFrame = requestAnimationFrame(() => { fitFrame = 0; fitGalleryUnderCopy(); });
}

// Open on the design's arrangement: scrolled to the end, last photo under the copy.
// galleryAtRest is tracked on scroll (not measured during a resize, when the row has already changed
// width), so a resize keeps the design arrangement if that's where the reader left it.
let galleryAtRest = true;
function scrollGalleryToEnd() {
  if (desktopGallery.matches) galleryRow.scrollLeft = galleryRow.scrollWidth;
  galleryAtRest = true;
}

// Click-and-drag scrolling for mice (touch and trackpads scroll natively); a drag never opens the lightbox
let drag = null;
galleryRow.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'mouse' || e.button !== 0) return;
  drag = { x: e.clientX, scroll: galleryRow.scrollLeft, moved: false };
});
window.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x;
  if (!drag.moved && Math.abs(dx) > 5) {
    drag.moved = true;
    galleryRow.classList.add('is-dragging');
  }
  if (drag.moved) galleryRow.scrollLeft = drag.scroll - dx;
});
window.addEventListener('pointerup', () => {
  if (!drag) return;
  const { moved } = drag;
  drag = null;
  galleryRow.classList.remove('is-dragging');
  if (moved) { // swallow the click that follows a drag
    galleryRow.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); }, { capture: true, once: true });
  }
});
galleryRow.addEventListener('dragstart', (e) => e.preventDefault()); // no native image dragging

let galleryResizing = false;
galleryRow.addEventListener('scroll', () => {
  if (!galleryResizing) galleryAtRest = galleryRow.scrollLeft >= galleryRow.scrollWidth - galleryRow.clientWidth - 2;
  requestGalleryFit();
}, { passive: true });

let wasDesktopGallery = desktopGallery.matches;
window.addEventListener('resize', () => {
  galleryResizing = true; // the browser clamps scrollLeft during a resize; don't treat that as the reader scrolling
  if (galleryAtRest || desktopGallery.matches !== wasDesktopGallery) scrollGalleryToEnd();
  requestAnimationFrame(() => { galleryResizing = false; });
  wasDesktopGallery = desktopGallery.matches;
  requestGalleryFrame();
  requestGalleryFit();
});

scrollGalleryToEnd();
fitGalleryUnderCopy();
document.fonts.ready.then(() => { scrollGalleryToEnd(); fitGalleryUnderCopy(); });

// Lightbox: clicking a photo opens it large; swipe, trackpad scroll, arrows or ←/→ move through all five
const lightbox = document.querySelector('.lightbox');
const lightboxTrack = lightbox.querySelector('.lightbox__track');
const lightboxCount = lightbox.querySelector('.lightbox__count');
const lightboxPrev = lightbox.querySelector('.lightbox__btn--prev');
const lightboxNext = lightbox.querySelector('.lightbox__btn--next');
const galleryPhotos = [...gallery.querySelectorAll('[data-lightbox]')];

lightboxTrack.innerHTML = galleryPhotos.map((photo, i) => `
  <figure class="lightbox__slide" aria-roledescription="slide" aria-label="${i + 1} of ${galleryPhotos.length}">
    <img src="${photo.querySelector('img').getAttribute('src')}" alt="${photo.dataset.caption}" loading="lazy">
    <figcaption class="lightbox__caption">${photo.querySelector('.gallery__caption').innerHTML}</figcaption>
  </figure>`).join('');

function lightboxIndex() {
  return Math.round(lightboxTrack.scrollLeft / lightboxTrack.clientWidth);
}
function updateLightbox() {
  const i = lightboxIndex();
  lightboxCount.textContent = `${i + 1} / ${galleryPhotos.length}`;
  lightboxPrev.disabled = i === 0;
  lightboxNext.disabled = i === galleryPhotos.length - 1;
}
function goToSlide(i, behavior = 'smooth') {
  const target = Math.max(0, Math.min(galleryPhotos.length - 1, i));
  lightboxTrack.scrollTo({ left: target * lightboxTrack.clientWidth, behavior: reduceMotion.matches ? 'auto' : behavior });
}

// Opening: the clicked photo flies from its spot in the row into its place in the lightbox. A copy (same
// crop and rounded shape) grows to the big photo's size while its corners ease to 16px and the crop opens
// up to the whole image; the backdrop fades in under it, then the caption and controls.
const ZOOM = { duration: 550, easing: 'cubic-bezier(.16, 1, .3, 1)', fill: 'both' };
// One flight between a gallery frame and a lightbox photo, in either direction. `frame` describes the gallery
// side (its box, the cropped image's box, its corner radius); `big` is the lightbox photo's box.
function flyPhoto(src, frame, big, toLightbox) {
  const fly = document.createElement('div');
  fly.className = 'lightbox__fly';
  fly.setAttribute('aria-hidden', 'true');
  const flyImg = document.createElement('img');
  flyImg.src = src;
  flyImg.alt = '';
  fly.append(flyImg);
  lightbox.append(fly);
  const px = (v) => `${v}px`;
  const small = { left: px(frame.box.left), top: px(frame.box.top), width: px(frame.box.width), height: px(frame.box.height), borderRadius: frame.radius };
  const large = { left: px(big.left), top: px(big.top), width: px(big.width), height: px(big.height), borderRadius: '16px' };
  const crop = { left: px(frame.img.left - frame.box.left), top: px(frame.img.top - frame.box.top), width: px(frame.img.width), height: px(frame.img.height) };
  const whole = { left: '0px', top: '0px', width: px(big.width), height: px(big.height) };
  const box = fly.animate(toLightbox ? [small, large] : [large, small], ZOOM);
  flyImg.animate(toLightbox ? [crop, whole] : [whole, crop], ZOOM);
  return box.finished.catch(() => {}).then(() => fly);
}
const frameOf = (photo) => ({
  box: photo.getBoundingClientRect(),
  img: photo.querySelector('img').getBoundingClientRect(),
  radius: getComputedStyle(photo).borderRadius,
});

async function zoomIntoLightbox(photo, i) {
  const frame = frameOf(photo);
  lightbox.classList.add('is-zooming');
  openLightbox(i);
  const target = lightboxTrack.children[i].querySelector('img');
  target.loading = 'eager';
  if (!target.complete) await target.decode().catch(() => {});
  target.style.visibility = 'hidden';
  const fly = await flyPhoto(target.currentSrc || target.src, frame, target.getBoundingClientRect(), true);
  target.style.visibility = '';
  fly.remove();
}

// Closing: the photo on screen flies back into its spot in the row (scrolled into view there first) while
// the backdrop, caption and controls fade out; the dialog closes as it lands.
let lightboxClosing = false;
async function closeLightbox() {
  if (!lightbox.open || lightboxClosing) return;
  if (reduceMotion.matches) { lightbox.close(); return; }
  lightboxClosing = true;
  const i = lightboxIndex();
  const photo = galleryPhotos[i];
  const target = lightboxTrack.children[i].querySelector('img');
  // Bring the photo into view in the row (sideways only; the page itself stays put)
  const row = photo.parentElement;
  const pr = photo.getBoundingClientRect();
  const rr = row.getBoundingClientRect();
  if (pr.left < rr.left || pr.right > rr.right) {
    row.scrollTo({ left: row.scrollLeft + pr.left - rr.left - (rr.width - pr.width) / 2, behavior: 'instant' });
  }
  const big = target.getBoundingClientRect();
  target.style.visibility = 'hidden';
  lightbox.classList.add('is-closing');
  const backdropFade = lightbox.animate({ opacity: [1, 0] }, { duration: 400, easing: 'ease', fill: 'forwards', pseudoElement: '::backdrop' });
  const fly = await flyPhoto(target.currentSrc || target.src, frameOf(photo), big, false);
  lightbox.close();
  backdropFade.cancel();
  target.style.visibility = '';
  fly.remove();
  lightbox.classList.remove('is-closing');
  lightboxClosing = false;
}
function openLightbox(i) {
  lightbox.showModal();
  document.body.classList.add('has-modal');
  goToSlide(i, 'instant');
  updateLightbox();
}
galleryPhotos.forEach((photo, i) => {
  photo.addEventListener('click', () => {
    if (reduceMotion.matches) openLightbox(i);
    else zoomIntoLightbox(photo, i);
  });
});
lightboxPrev.addEventListener('click', () => goToSlide(lightboxIndex() - 1));
lightboxNext.addEventListener('click', () => goToSlide(lightboxIndex() + 1));
lightbox.querySelector('.lightbox__close').addEventListener('click', closeLightbox);
lightbox.addEventListener('cancel', (e) => { e.preventDefault(); closeLightbox(); }); // Esc
lightbox.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') { e.preventDefault(); goToSlide(lightboxIndex() + 1); }
  if (e.key === 'ArrowLeft') { e.preventDefault(); goToSlide(lightboxIndex() - 1); }
});
lightbox.addEventListener('click', (e) => { // click on the dark area around the photo closes
  if (e.target === lightbox || e.target.classList.contains('lightbox__slide')) closeLightbox();
});
lightboxTrack.addEventListener('scroll', () => requestAnimationFrame(updateLightbox), { passive: true });
lightbox.addEventListener('close', () => {
  document.body.classList.remove('has-modal');
  lightbox.classList.remove('is-zooming');
});
window.addEventListener('resize', () => { if (lightbox.open) goToSlide(lightboxIndex(), 'instant'); });

// ---------- Consumer reviews: fade in once, when half the row is on screen ----------
const reviews = document.querySelector('.reviews');
const reviewsReveal = new IntersectionObserver(([entry]) => {
  if (!entry.isIntersecting) return;
  reviews.classList.add('is-in');
  reviewsReveal.disconnect();
}, { threshold: 0.5 });
reviewsReveal.observe(reviews);

// ---------- AI Karaoke breaker and Auracast: each fades in every time a fifth of it is in view, out when it leaves ----------
const featureFade = new IntersectionObserver((entries) => {
  entries.forEach((entry) => entry.target.classList.toggle('is-in', entry.isIntersecting));
}, { threshold: 0.2 });
document.querySelectorAll('.karaoke-breaker, .auracast').forEach((el) => featureFade.observe(el));

// ---------- FYI RAiDiO: the whole section fades in when it comes into view, out when it leaves ----------
const radio = document.querySelector('.radio');
new IntersectionObserver(([entry]) => {
  if (entry.intersectionRatio >= 0.15) radio.classList.add('is-in');
  else if (!entry.isIntersecting) radio.classList.remove('is-in');
}, { threshold: [0, 0.15] }).observe(radio);

// ---------- Product filters (All / Earbuds / Handhelds / Party Speakers) ----------
const filterBar = document.querySelector('.filters');
const filterBtns = [...filterBar.querySelectorAll('.filters__btn')];
const productsCarousel = document.getElementById('products');
const productsTrack = productsCarousel.querySelector('.carousel__track');
const productCards = [...productsTrack.querySelectorAll('.product-card')];
const SUBNAV_H = 48;

function applyFilter(filter) {
  productCards.forEach((card) => { card.hidden = filter !== 'all' && card.dataset.category !== filter; });
  productsCarousel.dataset.filter = filter;
  productsCarousel.querySelector('.carousel__viewport').scrollTo({ left: 0, behavior: 'instant' }); // no slide while the cards fade back in
  updateCarousel(productsCarousel);
}

const headliners = document.querySelector('.headliners');

function selectFilter(filter) {
  const btn = filterBtns.find((b) => b.dataset.filter === filter);
  if (btn.getAttribute('aria-pressed') === 'true') return;
  filterBtns.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
  // Quick opacity fade: out, swap the cards, back in
  if (reduceMotion.matches) applyFilter(filter);
  else {
    productsTrack.classList.add('is-switching');
    setTimeout(() => {
      applyFilter(filter);
      productsTrack.classList.remove('is-switching');
    }, 200);
  }
  // Filtering from the bar (reader is partway down the section): bring the products' top into view
  if (filterBar.classList.contains('is-docked')) {
    const top = productsCarousel.getBoundingClientRect().top + window.scrollY - SUBNAV_H; // products just under the bar
    window.scrollTo({ top, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
  }
}
filterBtns.forEach((btn) => btn.addEventListener('click', () => selectFilter(btn.dataset.filter)));

// The filters become part of the xBoom bar. The row is position: sticky (styles.css), so the browser itself
// carries it up and pins it in the bar: nothing here has to chase the scroll, so it can't jitter. As the row
// rises the last stretch into the bar, script only shrinks it (around its top-left corner) and slides it
// sideways to its spot (centered, or just right of the "xBoom" label when there isn't room). It fades out
// as the section's bottom edge comes up through the bar.
const BAR_BTN_H = 34; // button height once docked in the 48px bar
const DOCK_TOP = (SUBNAV_H - BAR_BTN_H) / 2; // the row's sticky top (styles.css)
const subnavLabelEl = subnav.querySelector('span');
let filterFrame = 0;
function updateFilterDock() {
  filterFrame = 0;
  const first = filterBtns[0];
  const last = filterBtns[filterBtns.length - 1];
  const hl = headliners.getBoundingClientRect();
  const top = first.getBoundingClientRect().top; // scaling keeps the top edge put, so this is the sticky position
  let p = Math.min(1, Math.max(0, (SUBNAV_H - top) / (SUBNAV_H - DOCK_TOP)));
  if (reduceMotion.matches) p = p > 0 ? 1 : 0;
  if (p === 0) {
    filterBar.style.transform = '';
    filterBar.style.opacity = '';
    filterBar.style.visibility = '';
    filterBar.classList.remove('is-docked', 'is-merging');
    return;
  }
  const ease = p * p * (3 - 2 * p); // smoothstep
  const groupH = first.offsetHeight;
  const groupW = last.offsetLeft + last.offsetWidth - first.offsetLeft;
  const scale = BAR_BTN_H / groupH;
  const groupLeft = hl.left + filterBar.offsetLeft + first.offsetLeft - filterBar.scrollLeft; // untransformed
  const labelRight = subnavLabelEl.getBoundingClientRect().right;
  const targetLeft = Math.max((document.documentElement.clientWidth - groupW * scale) / 2, labelRight + 16);
  const s = 1 + (scale - 1) * ease;
  const dx = (targetLeft - groupLeft) * ease;
  filterBar.style.transformOrigin = `${first.offsetLeft - filterBar.scrollLeft}px ${first.offsetTop}px`;
  filterBar.style.transform = `translateX(${dx.toFixed(1)}px) scale(${s.toFixed(4)})`;
  const fade = Math.min(1, Math.max(0, (hl.bottom - SUBNAV_H) / SUBNAV_H));
  filterBar.style.opacity = String(fade);
  filterBar.style.visibility = fade === 0 ? 'hidden' : '';
  filterBar.classList.toggle('is-docked', p === 1);
  filterBar.classList.toggle('is-merging', p > 0);
}
window.addEventListener('scroll', () => { if (!filterFrame) filterFrame = requestAnimationFrame(updateFilterDock); }, { passive: true });
window.addEventListener('resize', () => { if (!filterFrame) filterFrame = requestAnimationFrame(updateFilterDock); });
updateFilterDock();

// Whole-section fade-in, once, when a fifth of it is on screen
const headlinersWrap = document.querySelector('.headliners-wrap');
const headlinersReveal = new IntersectionObserver(([entry]) => {
  if (!entry.isIntersecting) return;
  headlinersWrap.classList.add('is-in');
  headlinersReveal.disconnect();
}, { threshold: 0.2 });
headlinersReveal.observe(headlinersWrap);

// Carousels (products + review cards): stepper (prev / dots / next) appears only when cards overflow
const carousels = [...document.querySelectorAll('.carousel, [data-carousel]')];
const carouselViewport = (carousel) => carousel.querySelector('.carousel__viewport, [data-carousel-viewport]');

function cardStep(viewport) {
  const cards = [...viewport.firstElementChild.children].filter((card) => !card.hidden);
  if (cards.length < 2) return viewport.clientWidth;
  return cards[1].offsetLeft - cards[0].offsetLeft;
}

function buildStepper(carousel) {
  const stepper = carousel.querySelector('.stepper');
  stepper.innerHTML = `
    <button class="stepper__btn stepper__btn--prev" type="button" aria-label="Previous"><span></span></button>
    <div class="stepper__dots"></div>
    <button class="stepper__btn stepper__btn--next" type="button" aria-label="Next"><span></span></button>`;
  const viewport = carouselViewport(carousel);
  stepper.querySelector('.stepper__btn--prev').addEventListener('click', () => {
    viewport.scrollBy({ left: -cardStep(viewport) });
  });
  stepper.querySelector('.stepper__btn--next').addEventListener('click', () => {
    viewport.scrollBy({ left: cardStep(viewport) });
  });
  let ticking = false;
  viewport.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { syncStepper(carousel); ticking = false; });
  }, { passive: true });
}

function syncStepper(carousel) {
  const viewport = carouselViewport(carousel);
  const stepper = carousel.querySelector('.stepper');
  const maxScroll = viewport.scrollWidth - viewport.clientWidth;
  const overflowing = maxScroll > 1;
  stepper.hidden = !overflowing;
  if (!overflowing) return;

  const step = cardStep(viewport);
  const positions = Math.ceil(maxScroll / step) + 1;
  const current = Math.min(positions - 1, Math.round(viewport.scrollLeft / step));
  const dots = stepper.querySelector('.stepper__dots');
  if (dots.children.length !== positions) {
    dots.innerHTML = '<span class="stepper__dot"></span>'.repeat(positions);
  }
  [...dots.children].forEach((dot, i) => dot.setAttribute('aria-current', String(i === current)));
  stepper.querySelector('.stepper__btn--prev').disabled = viewport.scrollLeft <= 1;
  stepper.querySelector('.stepper__btn--next').disabled = viewport.scrollLeft >= maxScroll - 1;
}

// Product, review and bundle cards: when a row overflows, size the cards so whole cards fill the width and the
// next one peeks in at the right edge. The design width is kept whenever it already leaves a 48–160px
// peek; otherwise the number of whole cards is whichever keeps them closest to the design width. A row
// that would fit with cards up to 20% narrower is shrunk to fit instead.
const DESIGN_CARD_W = { products: 364, reviews: 412, bundles: 400 };
function sizeCards(carousel) {
  const base = DESIGN_CARD_W[carousel.id || carousel.className.split(' ')[0]];
  if (!base) return;
  const viewport = carouselViewport(carousel);
  const track = viewport.firstElementChild;
  track.style.removeProperty('--card-w');
  const n = [...track.children].filter((card) => !card.hidden).length;
  const vs = getComputedStyle(viewport);
  const ts = getComputedStyle(track);
  const W = viewport.clientWidth;
  const padL = parseFloat(vs.paddingLeft) + parseFloat(ts.paddingLeft);
  const padR = parseFloat(vs.paddingRight) + parseFloat(ts.paddingRight);
  const gap = parseFloat(ts.columnGap);
  if (n * base + (n - 1) * gap + padL + padR <= W) return; // everything fits
  // Nearly fits (cards would only need to lose up to 20%): shrink them so the whole row fits, no scrolling
  const fitAll = (W - padL - padR - (n - 1) * gap) / n;
  if (fitAll >= base * 0.8) { track.style.setProperty('--card-w', `${Math.floor(fitAll)}px`); return; }
  const fit = Math.max(1, Math.floor((W - padL - 48 + gap) / (base + gap)));
  const natural = W - padL - fit * (base + gap); // how much of the next card shows at the design width
  if (natural >= 48 && natural <= 160) return;
  const widthFor = (k) => (W - padL - k * gap - (k === 1 ? 40 : 64)) / k;
  let k = 1;
  for (let c = 2; c < n; c++) {
    if (widthFor(c) >= 260 && Math.abs(widthFor(c) - base) < Math.abs(widthFor(k) - base)) k = c;
  }
  track.style.setProperty('--card-w', `${Math.floor(widthFor(k))}px`);
}

function updateCarousel(carousel) {
  if (carousel.hidden) return;
  sizeCards(carousel);
  syncStepper(carousel);
}

carousels.forEach(buildStepper);
carousels.forEach(updateCarousel);
window.addEventListener('resize', () => carousels.forEach(updateCarousel));

// Single-select groups: color swatches and Power series chips
document.querySelectorAll('[role="radiogroup"]').forEach((group) => {
  const options = [...group.querySelectorAll('[role="radio"]')];
  options.forEach((option) => {
    option.addEventListener('click', () => {
      options.forEach((o) => o.setAttribute('aria-checked', String(o === option)));
    });
  });
});

// ---------- Product and FYI RAiDiO videos ----------
// Each video plays through once the first time it scrolls into view, then replays only on hover (mouse)
// or tap (touch). Looping videos (FYI RAiDiO, the Auracast lineup) instead play whenever they're on screen. All of them pause
// when they leave the screen. Always muted, which browsers require to autoplay.
const productVideoInView = new IntersectionObserver((entries) => {
  entries.forEach(({ target: video, isIntersecting }) => {
    if (!isIntersecting) { video.pause(); return; }
    if ((video.loop || !video.dataset.autoplayed) && !reduceMotion.matches) {
      video.dataset.autoplayed = 'true';
      video.play().catch(() => {});
    }
  });
}, { threshold: 0.6 });

function playFromStart(video) {
  if (video.ended || !video.paused) video.currentTime = 0;
  video.play().catch(() => {});
}
function watchProductVideo(video) {
  productVideoInView.observe(video);
}
document.querySelectorAll('.product-video').forEach(watchProductVideo);

// Hover and tap are handled on the media box, so they still work after a swatch swaps the video
document.querySelectorAll('.product-card__media, .radio-card__media').forEach((media) => {
  const current = () => media.querySelector('.product-video:not(.is-leaving)');
  media.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'mouse' && current()?.paused) playFromStart(current());
  });
  media.addEventListener('click', () => { if (current() && !current().loop) playFromStart(current()); });
});

// Product variants: Power series model chips (5000 / 7000 / 9000) and color swatches (Mini, Rock)
// swap the card's product image or video with a crossfade
document.querySelectorAll('.series__chip[data-image], .swatch[data-image], .swatch[data-video]').forEach((chip) => {
  const isVideo = !!chip.dataset.video;
  const src = chip.dataset.video || chip.dataset.image;
  if (!isVideo) new Image().src = src; // preload so the swap is instant
  chip.addEventListener('click', () => {
    const media = chip.closest('.product-card').querySelector('[data-model-media]');
    const current = media.querySelector(':scope > :is(img, video):not(.is-leaving)');
    if (current.getAttribute('src') === src) return;
    const next = current.cloneNode();
    next.removeAttribute('class'); // a mid-fade copy would carry the fade state over
    if (isVideo) {
      next.className = 'product-video';
      delete next.dataset.autoplayed;
      next.muted = true;
      next.setAttribute('aria-label', chip.dataset.alt);
    } else {
      next.alt = chip.dataset.alt;
    }
    next.src = src;
    next.classList.add('is-incoming');
    current.classList.add('is-leaving');
    if (current.tagName === 'VIDEO') { current.pause(); productVideoInView.unobserve(current); }
    media.append(next);
    if (isVideo) { next.dataset.autoplayed = 'true'; watchProductVideo(next); playFromStart(next); }
    const settle = () => {
      media.querySelectorAll('.is-leaving').forEach((el) => el.remove());
      next.classList.remove('is-incoming', 'is-shown');
    };
    if (reduceMotion.matches) { settle(); return; }
    requestAnimationFrame(() => requestAnimationFrame(() => next.classList.add('is-shown')));
    next.addEventListener('transitionend', settle, { once: true });
  });
});

// ---------- FAQs ----------
// Entrance: title, then the questions one at a time. Replays on the next pass down once the section
// has gone fully below the screen again (same rule as FYI RAiDiO); the shared exit fade covers leaving.
const faqs = document.querySelector('.faqs');
new IntersectionObserver(([entry]) => {
  if (entry.intersectionRatio >= 0.15) faqs.classList.add('is-in');
  else if (!entry.isIntersecting && entry.boundingClientRect.top > 0) faqs.classList.remove('is-in');
}, { threshold: [0, 0.15] }).observe(faqs);

// Accordion: answers slide open/closed (height + fade, 0.32s); one question open at a time.
// Built on <details>, so keyboard and screen-reader state still work; we only animate the change.
const faqItems = [...document.querySelectorAll('.accordion')];
const FAQ_ANIM = { duration: 320, easing: 'cubic-bezier(.4, 0, .2, 1)' };

function faqFrames(details) {
  const cs = getComputedStyle(details);
  const closed = { height: '0px', paddingTop: '0px', paddingBottom: '0px', opacity: 0 };
  const open = { height: `${details.offsetHeight}px`, paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom, opacity: 1 };
  return [closed, open];
}
function openFaq(item) {
  item.classList.add('is-open');
  item.open = true;
  if (reduceMotion.matches) return;
  const details = item.querySelector('.accordion__details');
  details.getAnimations().forEach((a) => a.cancel());
  details.animate(faqFrames(details), FAQ_ANIM);
}
function closeFaq(item) {
  item.classList.remove('is-open');
  if (reduceMotion.matches) { item.open = false; return; }
  const details = item.querySelector('.accordion__details');
  details.getAnimations().forEach((a) => a.cancel());
  const anim = details.animate(faqFrames(details).reverse(), FAQ_ANIM);
  anim.onfinish = () => { if (!item.classList.contains('is-open')) item.open = false; };
}
faqItems.forEach((item) => {
  item.classList.toggle('is-open', item.open);
  item.querySelector('.accordion__summary').addEventListener('click', (e) => {
    e.preventDefault();
    if (item.classList.contains('is-open')) { closeFaq(item); return; }
    faqItems.forEach((other) => { if (other !== item && other.classList.contains('is-open')) closeFaq(other); });
    openFaq(item);
  });
});

// ---------- Email sign-up ----------
// No backend yet: a valid submit shows a short loading state, then crossfades to the confirmation.
// Replace the setTimeout in sendSignup() with the real request.
const signup = document.querySelector('.signup');
const signupCard = signup.querySelector('.signup__card');
const form = signup.querySelector('.signup__form');
const signupSubmit = form.querySelector('.signup__submit');
const signupSuccess = signup.querySelector('.signup__success');

// Entrance: the card fades in each time the section is reached scrolling down
new IntersectionObserver(([entry]) => {
  if (entry.intersectionRatio >= 0.15) signup.classList.add('is-in');
  else if (!entry.isIntersecting && entry.boundingClientRect.top > 0) signup.classList.remove('is-in');
}, { threshold: [0, 0.15] }).observe(signup);

// Validation: first name, last name and email are required; phone is optional but must look like a
// phone number (10+ digits) if filled in. Checked only when Sign Up is pressed; after that, a field
// with an error re-checks as you type so it clears as soon as it's fixed. Only a required field left
// empty gets the red outline (data-error="empty"); format problems show the message alone.
const signupRules = {
  firstName: (v) => (v.trim() ? '' : 'Enter your first name'),
  lastName: (v) => (v.trim() ? '' : 'Enter your last name'),
  email: (v) => {
    if (!v.trim()) return 'Enter your email address';
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Enter a valid email address, like name@example.com';
  },
  phone: (v) => {
    if (!v.trim()) return '';
    return v.replace(/\D/g, '').length >= 10 ? '' : 'Enter a 10-digit phone number, or leave this blank';
  },
};

function validateField(input) {
  const message = signupRules[input.name](input.value);
  const error = document.getElementById(input.getAttribute('aria-describedby'));
  if (message) {
    input.setAttribute('aria-invalid', 'true');
    input.dataset.error = input.value.trim() ? 'format' : 'empty';
    error.textContent = message;
    error.classList.add('is-shown');
  } else {
    input.removeAttribute('aria-invalid');
    delete input.dataset.error;
    error.classList.remove('is-shown');
  }
  return !message;
}

// Filled-out check: shows as soon as a field holds a valid value (an empty optional phone doesn't count)
function updateFieldCheck(input) {
  const filled = input.value.trim() !== '' && !signupRules[input.name](input.value);
  input.closest('.field').classList.toggle('is-valid', filled);
}

Object.keys(signupRules).forEach((name) => {
  const input = form.elements[name];
  input.addEventListener('input', () => {
    updateFieldCheck(input);
    if (input.getAttribute('aria-invalid') === 'true') validateField(input);
  });
  input.addEventListener('change', () => updateFieldCheck(input)); // browser autofill
});

function sendSignup() {
  return new Promise((resolve) => setTimeout(resolve, 900)); // stand-in for the real request
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (signupSubmit.classList.contains('is-loading')) return;
  const inputs = Object.keys(signupRules).map((name) => form.elements[name]);
  const invalid = inputs.filter((input) => !validateField(input));
  if (invalid.length) { invalid[0].focus(); return; }

  signupSubmit.classList.add('is-loading');
  signupSubmit.setAttribute('aria-busy', 'true');
  signupSubmit.querySelector('.signup__submit-label').textContent = 'Signing up…';
  await sendSignup();

  // Crossfade: hold the card's height, fade the form out, swap in the confirmation, fade it in
  const first = form.elements.firstName.value.trim();
  signupSuccess.querySelector('.signup__success-name').textContent = first ? `, ${first}` : '';
  signupCard.style.minHeight = `${signupCard.offsetHeight}px`;
  signupCard.classList.add('is-sending');
  await new Promise((r) => setTimeout(r, reduceMotion.matches ? 0 : 350));
  form.hidden = true;
  signupSuccess.hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => signupSuccess.classList.add('is-shown')));
  signupSuccess.querySelector('h2').focus();
});
