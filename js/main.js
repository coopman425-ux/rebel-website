// REBEL — nav, toggles, and motion/interaction layer. No dependencies.
(function () {
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var toggle = document.querySelector('.nav-toggle');
  var menu = document.querySelector('.mobile-menu');

  if (toggle && menu) {
    toggle.addEventListener('click', function () {
      var isOpen = menu.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(isOpen));
    });

    menu.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        menu.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // ---- Ambient layer: pause all background animation when tab is hidden ----
  document.documentElement.classList.toggle('page-hidden', document.hidden);
  document.addEventListener('visibilitychange', function () {
    document.documentElement.classList.toggle('page-hidden', document.hidden);
    document.querySelectorAll('video[data-ambient]').forEach(function (v) {
      if (document.hidden) {
        v.pause();
      } else if (v.dataset.inview && !v.hidden && !reduceMotion) {
        v.play().catch(function () {});
      }
    });
  });

  // ---- Booking app warm-up ----
  // The booking system sleeps on its free tier and takes ~50s to cold-start.
  // Ping it once per session, shortly after load, so the dyno is already
  // waking by the time a visitor clicks Book Now.
  try {
    if (!sessionStorage.getItem('rebel-booking-warm')) {
      sessionStorage.setItem('rebel-booking-warm', '1');
      setTimeout(function () {
        fetch('https://rebel-business-app.onrender.com/', { mode: 'no-cors', cache: 'no-store' }).catch(function () {});
      }, 2500);
    }
  } catch (e) { /* sessionStorage unavailable (private mode) — skip */ }

  // ---- Ambient video loops ----
  // No autoplay attribute in markup: loops play only while visible in the
  // viewport, pause off-screen and when the tab hides, and never autoplay
  // under prefers-reduced-motion (poster + manual controls instead).
  var ambientVideos = Array.prototype.slice.call(document.querySelectorAll('video[data-ambient]'));
  if (ambientVideos.length) {
    if (reduceMotion) {
      ambientVideos.forEach(function (v) { v.setAttribute('controls', ''); });
    } else if ('IntersectionObserver' in window) {
      var videoObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            var v = entry.target;
            v.dataset.inview = entry.isIntersecting ? '1' : '';
            if (entry.isIntersecting && !v.hidden && !document.hidden) {
              v.play().catch(function () {});
            } else {
              v.pause();
            }
          });
        },
        { threshold: 0.25 }
      );
      ambientVideos.forEach(function (v) { videoObserver.observe(v); });
    } else {
      ambientVideos.forEach(function (v) { v.play().catch(function () {}); });
    }
  }

  // ---- During / Finish loop toggle ----
  var loopWrap = document.querySelector('.job-loops');
  if (loopWrap) {
    var loopButtons = loopWrap.querySelectorAll('[data-loop-btn]');
    var loopVideos = loopWrap.querySelectorAll('video[data-ambient]');
    loopButtons.forEach(function (btn, i) {
      btn.addEventListener('click', function () {
        loopButtons.forEach(function (b, j) {
          var active = b === btn;
          b.classList.toggle('is-active', active);
          b.setAttribute('aria-pressed', String(active));
          var v = loopVideos[j];
          if (!v) return;
          v.hidden = !active;
          if (active && !reduceMotion) { v.play().catch(function () {}); } else { v.pause(); }
        });
      });
    });
  }

  // ---- Scroll-reveal ----
  var revealTargets = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window && revealTargets.length) {
    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    revealTargets.forEach(function (el) { revealObserver.observe(el); });
  } else {
    revealTargets.forEach(function (el) { el.classList.add('is-visible'); });
  }

  // ---- Drag-to-reveal sliders (native range input drives --reveal) ----
  document.querySelectorAll('.reveal-compare--drag .reveal-input').forEach(function (input) {
    var container = input.closest('.reveal-compare');
    if (!container) return;
    var update = function () { container.style.setProperty('--reveal', input.value + '%'); };
    update();
    input.addEventListener('input', update);
  });

  // ---- Hero: scroll-driven dirty-to-clean reveal ----
  var scrollHero = document.querySelector('.reveal-compare--scroll');
  if (scrollHero && !reduceMotion) {
    var wipeDistance = 480; // px of scroll over which the reveal completes
    var ticking = false;
    var updateHeroReveal = function () {
      ticking = false;
      var progress = Math.min(1, Math.max(0, window.scrollY / wipeDistance));
      scrollHero.style.setProperty('--reveal', (100 - progress * 100) + '%');
    };
    updateHeroReveal();
    window.addEventListener(
      'scroll',
      function () {
        if (!ticking) {
          window.requestAnimationFrame(updateHeroReveal);
          ticking = true;
        }
      },
      { passive: true }
    );
  }

  // ---- Hero parallax (subtle, transform-only) ----
  var parallaxEl = document.querySelector('[data-parallax]');
  if (parallaxEl && !reduceMotion) {
    var pTicking = false;
    var updateParallax = function () {
      pTicking = false;
      var offset = Math.min(60, window.scrollY * 0.12);
      parallaxEl.style.transform = 'translateY(' + offset + 'px)';
    };
    updateParallax();
    window.addEventListener(
      'scroll',
      function () {
        if (!pTicking) {
          window.requestAnimationFrame(updateParallax);
          pTicking = true;
        }
      },
      { passive: true }
    );
  }

  // ---- Count-up stats (once, on viewport entry) ----
  var statEls = document.querySelectorAll('[data-count-to]');
  if (statEls.length) {
    var animateCount = function (el) {
      var target = parseInt(el.getAttribute('data-count-to'), 10);
      var suffix = el.getAttribute('data-count-suffix') || '';
      if (reduceMotion) {
        el.textContent = target + suffix;
        return;
      }
      var start = null;
      var duration = 900;
      var step = function (ts) {
        if (start === null) start = ts;
        var progress = Math.min(1, (ts - start) / duration);
        var eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(eased * target) + suffix;
        if (progress < 1) window.requestAnimationFrame(step);
      };
      window.requestAnimationFrame(step);
    };

    if ('IntersectionObserver' in window) {
      var statObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              animateCount(entry.target);
              statObserver.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.5 }
      );
      statEls.forEach(function (el) { statObserver.observe(el); });
    } else {
      statEls.forEach(animateCount);
    }
  }
})();
