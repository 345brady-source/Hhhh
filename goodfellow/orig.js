(function () {
  /* menus: hover or click to open, Esc or outside click to close */
  var header = document.querySelector('.site-header');
  var drops = Array.prototype.slice.call(document.querySelectorAll('.has-drop'));
  var desktop = window.matchMedia('(min-width: 901px)');
  function setOpen(li, open) {
    if (open) drops.forEach(function (o) { if (o !== li) setOpen(o, false); });
    li.classList.toggle('open', open);
    li.querySelector('.nav-link').setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  drops.forEach(function (li) {
    var btn = li.querySelector('.nav-link'), t = null;
    btn.addEventListener('click', function () {
      if (desktop.matches && Date.now() - (li._hoverAt || 0) < 700) { li._hoverAt = 0; setOpen(li, true); return; }
      setOpen(li, !li.classList.contains('open'));
    });
    li.addEventListener('mouseenter', function () { if (!desktop.matches) return; clearTimeout(t); if (!li.classList.contains('open')) li._hoverAt = Date.now(); setOpen(li, true); });
    li.addEventListener('mouseleave', function () { if (!desktop.matches) return; t = setTimeout(function () { setOpen(li, false); }, 180); });
    li.addEventListener('keydown', function (e) { if (e.key === 'Escape') { setOpen(li, false); btn.focus(); } });
  });
  document.addEventListener('click', function (e) { drops.forEach(function (li) { if (!li.contains(e.target)) setOpen(li, false); }); });
  var menuBtn = document.querySelector('.menu-btn');
  if (menuBtn) menuBtn.addEventListener('click', function () {
    var open = !header.classList.contains('menu-open');
    header.classList.toggle('menu-open', open); menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  document.querySelectorAll('.primary a').forEach(function (a) {
    a.addEventListener('click', function () { header.classList.remove('menu-open'); if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false'); drops.forEach(function (li) { setOpen(li, false); }); });
  });

  /* hero slides */
  var hero = document.querySelector('.home-hero');
  if (hero) {
    var slides = hero.querySelectorAll('.hs-slide'), dots = hero.querySelectorAll('.hs-dot'), count = hero.querySelector('.hs-count');
    var pauseBtn = hero.querySelector('.hs-pause'), i = 0, timer = null;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches, playing = !reduce;
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function go(n) {
      i = (n + slides.length) % slides.length;
      slides.forEach(function (s, k) { var on = k === i; s.hidden = !on; s.classList.toggle('is-on', on); });
      dots.forEach(function (d, k) { d.classList.toggle('is-on', k === i); if (k === i) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current'); });
      if (count) count.textContent = pad(i + 1) + ' / ' + pad(slides.length);
    }
    function start() { stop(); if (playing) timer = setInterval(function () { go(i + 1); }, 7000); }
    function stop() { if (timer) clearInterval(timer); timer = null; }
    hero.querySelector('.hs-prev').addEventListener('click', function () { go(i - 1); start(); });
    hero.querySelector('.hs-next').addEventListener('click', function () { go(i + 1); start(); });
    dots.forEach(function (d, k) { d.addEventListener('click', function () { go(k); start(); }); });
    pauseBtn.textContent = playing ? 'Pause' : 'Play';
    pauseBtn.setAttribute('aria-label', playing ? 'Pause slides' : 'Play slides');
    pauseBtn.addEventListener('click', function () {
      playing = !playing; pauseBtn.textContent = playing ? 'Pause' : 'Play'; pauseBtn.setAttribute('aria-label', playing ? 'Pause slides' : 'Play slides'); start();
    });
    hero.addEventListener('mouseenter', stop); hero.addEventListener('mouseleave', start);
    hero.addEventListener('focusin', stop); hero.addEventListener('focusout', start);
    hero.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight') { go(i + 1); } if (e.key === 'ArrowLeft') { go(i - 1); } });
    start();
  }

  /* fund pages: section tabs scroll smoothly (without touching the URL hash) and track the section in view */
  var tabLinks = Array.prototype.slice.call(document.querySelectorAll('[data-scroll]'));
  tabLinks.forEach(function (a) {
    a.addEventListener('click', function (e) {
      var t = document.getElementById(a.getAttribute('data-scroll')); if (!t) return;
      e.preventDefault(); t.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    });
  });
  var snTabs = Array.prototype.slice.call(document.querySelectorAll('.sn-tabs a[data-scroll]'));
  if (snTabs.length && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        snTabs.forEach(function (a) { a.classList.toggle('is-on', a.getAttribute('data-scroll') === en.target.id); });
      });
    }, { rootMargin: '-210px 0px -60% 0px' });
    snTabs.forEach(function (a) { var s = document.getElementById(a.getAttribute('data-scroll')); if (s) io.observe(s); });
  }

  /* executive bios */
  document.querySelectorAll('.person-open').forEach(function (b) {
    b.addEventListener('click', function () { var d = document.getElementById(b.getAttribute('data-bio')); if (d && d.showModal) d.showModal(); });
  });
  document.querySelectorAll('dialog.bio').forEach(function (d) {
    d.querySelector('.bio-close').addEventListener('click', function () { d.close(); });
    d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
  });

  /* resume uploads: check the file, then send as a normal upload (FormSubmit emails it as an attachment) */
  document.querySelectorAll('form[data-resume-form]').forEach(function (form) {
    var status = form.querySelector('.status'), btn = form.querySelector('button[type="submit"]');
    form.addEventListener('submit', function (e) {
      var f = form.querySelector('input[type=file]').files[0];
      var okType = f && /\.(pdf|docx?)$/i.test(f.name);
      if (!f) { e.preventDefault(); status.className = 'status err'; status.textContent = 'Please choose your resume file.'; return; }
      if (!okType) { e.preventDefault(); status.className = 'status err'; status.textContent = 'Please upload a PDF or Word document.'; return; }
      if (f.size > 10 * 1024 * 1024) { e.preventDefault(); status.className = 'status err'; status.textContent = 'That file is over 10 MB. Please upload a smaller version or email it to us.'; return; }
      btn.disabled = true; status.className = 'status'; status.textContent = 'Uploading\u2026';
    });
  });
  (function () {
    var m = /[?&]sent=([a-z0-9-]+)/.exec(location.search); if (!m) return;
    var job = document.getElementById(m[1]); if (!job) return;
    job.open = true;
    var st = job.querySelector('.resume-form .status');
    if (st) { st.className = 'status ok'; st.textContent = 'Thanks. Your resume was sent to our team, and we will be in touch.'; }
    job.scrollIntoView();
  })();

  /* forms: emailed to the firm through FormSubmit */
  var FORM_EMAIL = 'Bsmith@goodfellowcm.com';
  document.querySelectorAll('form[data-gf-form]').forEach(function (form) {
    var status = form.querySelector('.status'), btn = form.querySelector('button[type="submit"]');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = {};
      new FormData(form).forEach(function (v, k) {
        if (k === 'form-name') data.Form = v; else if (k === 'subject') data._subject = v; else if (k === 'bot-field') data._honey = v; else data[k] = v;
      });
      data._template = 'table'; data._captcha = 'false';
      btn.disabled = true; status.className = 'status'; status.textContent = 'Sending\u2026';
      fetch('https://formsubmit.co/ajax/' + FORM_EMAIL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(data) })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (j) {
            if (!res.ok || String(j.success) !== 'true') { var err = new Error(j.message || ('HTTP ' + res.status)); err.fs = true; throw err; }
          });
        })
        .then(function () { status.className = 'status ok'; status.textContent = form.getAttribute('data-success'); form.reset(); })
        .catch(function (err) {
          status.className = 'status err'; var m = (err && err.message) || '';
          if (/activat/i.test(m)) status.textContent = 'Almost there: this form needs a one-time activation. Check ' + FORM_EMAIL + ' (and spam) for an email from FormSubmit and click Activate Form, then send again.';
          else if (err && err.fs) status.textContent = 'Your request did not go through (' + m + '). Please email ' + FORM_EMAIL + ' directly.';
          else status.textContent = 'Your request did not go through. Check your connection and send it again, or email ' + FORM_EMAIL + ' directly.';
        })
        .then(function () { btn.disabled = false; });
    });
  });
})();
