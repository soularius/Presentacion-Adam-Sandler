/* =========================================================
   THE SANDLER SHOW — logic
   ========================================================= */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  const stage = $('#stage');
  const slides = $$('.slide');
  const N = slides.length;
  let cur = 0;

  /* ---------- scale stage to window ---------- */
  function fit() {
    const s = Math.min(innerWidth / 1600, innerHeight / 900);
    stage.style.transform = `translate(-50%, -50%) scale(${s})`;
  }
  addEventListener('resize', fit); fit();

  /* ---------- sound (WebAudio, no files) ---------- */
  let muted = false, ac = null;
  function ctx() { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); return ac; }
  function tone(freq, dur, type = 'sine', vol = .18, slideTo = null, delay = 0) {
    if (muted) return;
    try {
      const a = ctx(), t = a.currentTime + delay;
      const o = a.createOscillator(), g = a.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + .02);
    } catch (e) {}
  }
  function noise(dur = .25, vol = .12, hp = 800) {
    if (muted) return;
    try {
      const a = ctx(), len = a.sampleRate * dur, buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
      f.type = 'highpass'; f.frequency.value = hp; g.gain.value = vol;
      src.buffer = buf; src.connect(f).connect(g).connect(a.destination); src.start();
    } catch (e) {}
  }
  const sfx = {
    whoosh: () => noise(.22, .07, 1500),
    boing: () => tone(180, .35, 'triangle', .22, 620),
    pop: () => tone(600, .08, 'square', .08, 900),
    ding: () => { tone(880, .25, 'sine', .2); tone(1320, .4, 'sine', .16, null, .12); },
    buzz: () => tone(140, .45, 'sawtooth', .14, 90),
    swing: () => { noise(.35, .1, 500); tone(300, .3, 'triangle', .1, 1200); },
    tada: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, .35, 'triangle', .14, null, i * .1)); },
  };

  /* ---------- lazy GIFs ---------- */
  function loadGifs(i) {
    [i - 1, i, i + 1].forEach(k => {
      const s = slides[k]; if (!s) return;
      $$('img[data-src]', s).forEach(img => { img.src = img.dataset.src; img.removeAttribute('data-src'); });
    });
  }

  /* ---------- cast (chibis + bubbles) ---------- */
  const chY = $('#chibi-yined'), chM = $('#chibi-majo');
  const bY = $('#bubble-yined'), bM = $('#bubble-majo');
  let bubbleTimer;
  function updateCast(slide) {
    const sp = slide.dataset.speaker || 'both';
    [chY, chM].forEach(c => c.classList.remove('speaking', 'quiet', 'hidden'));
    [bY, bM].forEach(b => b.classList.remove('show'));
    clearTimeout(bubbleTimer);
    if (sp === 'none' || slide.classList.contains('s-cover')) { chY.classList.add('hidden'); chM.classList.add('hidden'); return; }
    if (sp === 'yined') { chY.classList.add('speaking'); chM.classList.add('quiet'); }
    if (sp === 'majo') { chM.classList.add('speaking'); chY.classList.add('quiet'); }
    if (sp === 'both') { chY.classList.add('speaking'); chM.classList.add('speaking'); }
    bubbleTimer = setTimeout(() => {
      if (slide.dataset.yined) { bY.textContent = slide.dataset.yined; bY.classList.add('show'); }
      if (slide.dataset.majo) { bM.textContent = slide.dataset.majo; bM.classList.add('show'); }
      bubbleTimer = setTimeout(() => [bY, bM].forEach(b => b.classList.remove('show')), 5200);
    }, 650);
  }
  const quips = {
    yined: ['Hi! I am Yined! 💖', 'Sandler is the GOAT 🐐', 'Back to school! 🎒', 'It\'s all in the hips! 🏌️‍♀️'],
    majo: ['Hi! I am Majo! ✨', 'High-quality H2O! 💧', 'You can do it! 💪', 'Hoodie + shorts = 😎'],
  };
  [chY, chM].forEach(c => c.addEventListener('click', () => {
    const who = c.dataset.who, b = who === 'yined' ? bY : bM;
    c.classList.remove('jump'); void c.offsetWidth; c.classList.add('jump');
    sfx.boing();
    b.textContent = quips[who][Math.floor(Math.random() * quips[who].length)];
    b.classList.add('show'); clearTimeout(b._t); b._t = setTimeout(() => b.classList.remove('show'), 2200);
  }));

  /* ---------- grammar stickers ---------- */
  let showGrammar = true;
  slides.forEach(s => { if (s.dataset.grammar) { const g = document.createElement('div'); g.className = 'grammar'; g.innerHTML = s.dataset.grammar; s.appendChild(g); } });

  /* ---------- navigation ---------- */
  const ball = $('#ball'), counter = $('#counter');
  function go(i, silent) {
    i = Math.max(0, Math.min(N - 1, i));
    if (i === cur && !silent) return;
    const prev = slides[cur];
    prev.classList.remove('active');
    slides[i].classList.add('active');
    cur = i;
    loadGifs(i);
    updateCast(slides[i]);
    counter.textContent = `${i + 1} / ${N}`;
    stage.classList.toggle('edge', i === 0 || i === N - 1);
    const w = $('#golf').clientWidth - 50;
    ball.style.left = (6 + w * (i / (N - 1))) + 'px';
    ball.classList.remove('roll'); void ball.offsetWidth; ball.classList.add('roll');
    renderNotes();
    if (!silent) sfx.whoosh();
    if (i > 0) startTimer();
    if (i === N - 1) setTimeout(() => { confetti(260); sfx.tada(); }, 400);
    if (slides[i].classList.contains('s-quotes')) showQuote(qi, false);
    try { history.replaceState(null, '', '#' + (i + 1)); } catch (e) {}
  }
  const next = () => go(cur + 1), prev = () => go(cur - 1);

  /* ---------- timer ---------- */
  let t0 = null, timerOn = false, tick;
  const timerEl = $('#timer'), tval = $('#tval');
  function startTimer() {
    if (t0) return;
    t0 = Date.now();
    tick = setInterval(() => {
      const s = Math.floor((Date.now() - t0) / 1000);
      tval.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      timerEl.classList.toggle('ok', s >= 360);
    }, 500);
  }
  function resetTimer() { clearInterval(tick); t0 = null; tval.textContent = '0:00'; timerEl.classList.remove('ok'); if (cur > 0) startTimer(); }

  /* ---------- speaker notes ---------- */
  const NOTES = [
    `<b>YINED:</b> Good morning, teacher and classmates! My name is Yined…<br><b>MAJO:</b> …and my name is María José, but you can call me Majo. Today we are going to talk about a very funny person: <i>Adam Sandler!</i><br><b>YINED:</b> Get ready, because this presentation has a lot of GIFs, memes… and a little game!`,
    `<b>YINED:</b> So, who is Adam Sandler? His full name is Adam Richard Sandler. He was born on September 9th, 1966, in Brooklyn, New York, but he grew up in Manchester, New Hampshire. His nickname is "The Sandman". He is an actor, a comedian, a writer, a producer and a musician. He is married to Jackie, and they have two daughters, Sadie and Sunny.`,
    `<b>MAJO:</b> Why did we choose him? We have three reasons. First, he is hilarious. His movies are funny for everybody: kids, parents and grandparents.<br><b>YINED:</b> Second, he is part of our childhood. We grew up watching Hotel Transylvania and Grown Ups with our families.<br><b>MAJO:</b> And third, he is a good person. He is humble and loyal, and he always works with his friends.`,
    `<b>YINED:</b> Let's talk about his background. When he was a kid, his family moved to New Hampshire. At school, he was the class clown. When he was seventeen, his brother Scott encouraged him to try stand-up comedy in a club in Boston. In 1987 he appeared on The Cosby Show, and in 1988 he graduated from New York University.`,
    `<b>MAJO:</b> In 1990 he started working at Saturday Night Live, a very famous comedy show on TV. First he was a writer, and then he became a cast member. He created funny characters like Opera Man, and he sang "The Chanukah Song", which became a classic. But in 1995… they fired him! Can you believe it? Twenty-four years later, in 2019, he came back to host the show and he sang a song called "I Was Fired". So… I guess you could say he won!`,
    `<b>YINED:</b> After SNL, he became a movie star. He has made more than fifty movies! Some of the most iconic are Billy Madison, Happy Gilmore, The Waterboy, 50 First Dates, Click and Grown Ups. He was also the voice of Dracula in Hotel Transylvania. <i>(flip 2 or 3 posters)</i>`,
    `<b>MAJO:</b> His most iconic character is Happy Gilmore. Happy is a hockey player who can't skate very well, but he can hit a golf ball very, very far. The movie came out in 1996, and it was so popular that, in 2025, Netflix released Happy Gilmore 2! Let's see his famous swing… <i>(press SWING)</i>`,
    `<b>YINED:</b> Adam Sandler has a lot of iconic phrases. For example, in Billy Madison: "Back to school, back to school, to prove to Dad that I'm not a fool!"<br><b>MAJO:</b> In The Waterboy: "Now that's what I call high-quality H2O!"<br><b>YINED:</b> In Happy Gilmore: "Are you too good for your home?!"<br><b>MAJO:</b> And in The Waterboy, his friend always shouts: "You can do it!" 💪 <i>(🎬 WATCH IT opens the clip — optional)</i>`,
    `<b>YINED:</b> Now it's your turn! Let's play "Guess the movie". Look at the GIF and tell us: which movie is it? <i>(4 rounds, fast)</i><br><b>MAJO:</b> Great job, class! You are real Sandler experts!`,
    `<b>YINED:</b> Adam Sandler is also famous for his style. Other celebrities wear suits and elegant dresses on the red carpet, but Adam usually wears an oversized hoodie, basketball shorts and sneakers. He doesn't care! People on the internet love it. <i>(click the 4 boxes)</i>`,
    `<b>YINED:</b> And this is our favorite story! At the Oscars in 2025, everybody wore tuxedos and elegant dresses… but Adam wore a blue hoodie and basketball shorts! The host, Conan O'Brien, made fun of him: "You're dressed like a guy playing video poker at 2 a.m., Adam!" And Adam answered: "Nobody even thought about what I was wearing until you brought it up! I like the way I look, because I'm a good person!"… and he walked out of the theater! Don't worry: it was a comedy bit, and everybody laughed. <i>(optional: click the photo for the video)</i>`,
    `<b>MAJO:</b> Of course, the internet loves him, so there are millions of memes. This one is us after learning the present perfect… <i>(zoom)</i> and this one is us at the end of this presentation! <i>(zoom the last one)</i>`,
    `<b>MAJO:</b> But Adam isn't only a comedian. He is also a great dramatic actor. In Uncut Gems, he was more serious than ever, and he won an Independent Spirit Award for Best Male Lead. In 2023, he received the Mark Twain Prize, one of the most important comedy awards in the United States. And according to Forbes, he was the highest-paid actor of 2025!`,
    `<b>YINED:</b> His secret is friendship and family. His company is called Happy Madison: Happy Gilmore plus Billy Madison. He has worked with the same friends for more than thirty years, like Rob Schneider, David Spade, Kevin James and Chris Rock. His wife and daughters appear in many of his movies, too.`,
    `<b>MAJO:</b> Why does he inspire us? Lesson number one: never give up. They fired him, but he became one of the biggest stars in the world.<br><b>YINED:</b> Lesson two: be loyal to your friends.<br><b>MAJO:</b> Lesson three: be yourself… even in basketball shorts at the Oscars!<br><b>YINED:</b> And lesson four: make people happy. That's what he does every day.`,
    `<b>BOTH:</b> Thank you so much for listening!<br><b>MAJO:</b> Does anyone have any questions? 🙋<br><i>(press C for more confetti)</i>`,
  ];
  const notesEl = $('#notes');
  function renderNotes() { notesEl.innerHTML = `<h4>SCRIPT · SLIDE ${cur + 1}</h4><p>${NOTES[cur] || ''}</p>`; }

  /* ---------- video modal ---------- */
  const vbox = $('#video'), vframe = $('#vframe'), vyt = $('#vyt');
  function openVideo(id, vertical = false) {
    vframe.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&cc_load_policy=1&cc_lang_pref=en&hl=en" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
    vyt.href = vertical ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`;
    vbox.classList.toggle('vertical', vertical);
    vbox.classList.add('on'); sfx.pop();
  }
  function closeVideo() { vframe.innerHTML = ''; vbox.classList.remove('on'); }
  $$('[data-video]').forEach(b => b.addEventListener('click', () => openVideo(b.dataset.video, b.dataset.vertical === 'true')));
  $('#vclose').addEventListener('click', closeVideo);
  vbox.addEventListener('click', e => { if (e.target === vbox) closeVideo(); });

  /* ---------- movies: flip ---------- */
  $$('.poster, .lesson').forEach(p => p.addEventListener('click', () => { p.classList.toggle('flip'); sfx.pop(); }));

  /* ---------- Happy Gilmore swing ---------- */
  const course = $('#course');
  $('#swing').addEventListener('click', () => {
    course.classList.remove('go'); void course.offsetWidth; course.classList.add('go');
    sfx.swing();
    setTimeout(() => { sfx.ding(); confetti(90, 1150, 520); }, 2100);
  });

  /* ---------- quotes machine ---------- */
  const QUOTES = [
    { t: "Back to school, back to school, to prove to Dad that I'm not a fool!", m: 'Billy Madison · 1995', g: 'bm-backtoschool', v: '4DMHbYBeGLY', short: true },
    { t: "Now that's what I call high-quality H2O!", m: 'The Waterboy · 1998', g: 'wb-h2o', v: 'rM24r38L6jM' },
    { t: 'Are you too good for your home?!', m: 'Happy Gilmore · 1996', g: 'hg-home', v: 'WdcvqdFk4nU' },
    { t: 'You can do it!', m: 'The Waterboy · 1998 (Rob Schneider)', g: 'wb-youcandoit', v: 'qztuEucrNBc' },
    { t: 'T-T-T-Today, Junior!', m: 'Billy Madison · 1995', g: 'bm-todayjunior', v: 'xgfXYb7mShE' },
    { t: 'Somebody kill me, please.', m: 'The Wedding Singer · 1998', g: 'ws-killme', v: 'NUq8e33XbJ0' },
    { t: 'This is how I win.', m: 'Uncut Gems · 2019', g: 'ug-win', v: 'Z_0TyDQNg5s' },
  ];
  let qi = 0, typeTimer;
  const qtext = $('#qtext'), qmovie = $('#qmovie'), qgif = $('#qgif'), qcount = $('#qcount');
  function showQuote(i, sound = true) {
    qi = (i + QUOTES.length) % QUOTES.length;
    const q = QUOTES[qi];
    qgif.src = `assets/gifs/${q.g}.gif`;
    qcount.textContent = `${qi + 1}/${QUOTES.length}`;
    qmovie.textContent = '';
    clearInterval(typeTimer);
    let k = 0;
    qtext.innerHTML = '<span class="cursor"></span>';
    typeTimer = setInterval(() => {
      k++;
      qtext.innerHTML = q.t.slice(0, k).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '<span class="cursor"></span>';
      if (k % 3 === 0 && sound) tone(1200 + Math.random() * 300, .03, 'square', .03);
      if (k >= q.t.length) { clearInterval(typeTimer); qmovie.textContent = '🎬 ' + q.m; }
    }, 38);
    if (sound) sfx.pop();
  }
  $('#qnext').addEventListener('click', () => showQuote(qi + 1));
  $('#qprev').addEventListener('click', () => showQuote(qi - 1));
  $('#qsay').addEventListener('click', () => openVideo(QUOTES[qi].v, !!QUOTES[qi].short));

  /* ---------- quiz ---------- */
  const QUIZ = [
    { g: 'hg-runswing', a: 'Happy Gilmore', o: ['Grown Ups', 'Happy Gilmore', 'Click'] },
    { g: 'ht-dance', a: 'Hotel Transylvania', o: ['Hotel Transylvania', 'Leo', 'Little Nicky'] },
    { g: 'bm-penguin', a: 'Billy Madison', o: ['Big Daddy', 'The Wedding Singer', 'Billy Madison'] },
    { g: 'hustle-coach', a: 'Hustle', o: ['Uncut Gems', 'Hustle', 'Click'] },
  ];
  let qr = 0, score = 0, answered = false;
  const opts = $('#opts'), dots = $('#dots'), qnextBtn = $('#quiz-next'), quizQ = $('#quiz-q');
  function renderRound() {
    const r = QUIZ[qr]; answered = false;
    $('#quiz-img').src = `assets/gifs/${r.g}.gif`;
    quizQ.textContent = `Round ${qr + 1}: Which movie is it?`;
    opts.innerHTML = r.o.map((o, i) => `<button class="opt" data-o="${o}"><span class="k">${'ABC'[i]}</span>${o}</button>`).join('');
    dots.innerHTML = QUIZ.map((_, i) => `<i class="${i < qr ? 'done' : i === qr ? 'cur' : ''}"></i>`).join('');
    qnextBtn.style.display = 'none';
    $$('.opt', opts).forEach(b => b.addEventListener('click', () => answer(b)));
  }
  function answer(b) {
    if (answered) return;
    const r = QUIZ[qr];
    if (b.dataset.o === r.a) {
      answered = true; score++;
      b.classList.add('right'); sfx.ding(); confetti(120);
      quizQ.textContent = 'YES! 🎉 Correct!';
      qnextBtn.textContent = qr < QUIZ.length - 1 ? 'NEXT ROUND ▶' : 'FINAL RESULT 🏆';
      qnextBtn.style.display = 'inline-block';
    } else {
      b.classList.add('wrong'); sfx.buzz();
      quizQ.textContent = 'Nope! Try again 😅';
    }
  }
  let finished = false;
  qnextBtn.addEventListener('click', () => {
    if (finished) { finished = false; qr = 0; renderRound(); sfx.pop(); return; }
    if (qr < QUIZ.length - 1) { qr++; renderRound(); sfx.pop(); return; }
    finished = true;
    quizQ.textContent = 'You are Sandler experts! 🏆';
    opts.innerHTML = `<div class="card" style="font-family:var(--f-fun);font-size:40px;text-align:center">4 / 4 movies guessed!<br><span style="font-size:26px;font-family:var(--f-hand)">Now that's what I call high-quality students! 💧</span></div>`;
    dots.innerHTML = QUIZ.map(() => '<i class="done"></i>').join('');
    qnextBtn.textContent = 'PLAY AGAIN ↺';
    sfx.tada(); confetti(220);
  });
  renderRound();

  /* ---------- style checklist ---------- */
  const checks = $$('#check li');
  checks.forEach(li => li.addEventListener('click', () => {
    li.classList.toggle('on'); sfx.pop();
    const all = checks.every(c => c.classList.contains('on'));
    $('#sandlerized').classList.toggle('on', all);
    if (all) { sfx.tada(); confetti(150, 400, 700); }
  }));

  /* ---------- meme zoom ---------- */
  const zoom = $('#zoom');
  $$('.memewall .meme').forEach(m => m.addEventListener('click', () => {
    zoom.innerHTML = ''; zoom.appendChild(m.cloneNode(true)); zoom.classList.add('on'); sfx.boing();
  }));
  zoom.addEventListener('click', () => zoom.classList.remove('on'));

  /* ---------- confetti ---------- */
  const cv = $('#confetti'), cx = cv.getContext('2d');
  let parts = [], raf = null;
  const COLORS = ['#ffd23f', '#ff4d5e', '#3a86ff', '#2ec27e', '#ff86c2', '#8b5cf6', '#ff9f1c', '#ffffff'];
  function confetti(n = 150, x = 800, y = 300) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 6 + Math.random() * 12;
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 8, r: 6 + Math.random() * 8, c: COLORS[i % COLORS.length], rot: Math.random() * 6, vr: (Math.random() - .5) * .4, life: 140 + Math.random() * 80, shape: Math.random() < .25 ? 'c' : 'r' });
    }
    if (!raf) loop();
  }
  function loop() {
    cx.clearRect(0, 0, 1600, 900);
    parts = parts.filter(p => p.life-- > 0 && p.y < 960);
    parts.forEach(p => {
      p.vy += .35; p.vx *= .985; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot); cx.fillStyle = p.c;
      if (p.shape === 'c') { cx.beginPath(); cx.arc(0, 0, p.r / 2, 0, 7); cx.fill(); } else cx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
      cx.restore();
    });
    raf = parts.length ? requestAnimationFrame(loop) : (cx.clearRect(0, 0, 1600, 900), null);
  }
  $('#party').addEventListener('click', () => { confetti(260); sfx.tada(); });

  /* ---------- buttons shouldn't keep focus (so SPACE = next) ---------- */
  document.addEventListener('click', e => { const b = e.target.closest('button'); if (b) b.blur(); });

  /* ---------- keyboard ---------- */
  addEventListener('keydown', e => {
    const k = e.key;
    if (k === 'Escape') { closeVideo(); zoom.classList.remove('on'); $('#help').classList.remove('on'); notesEl.classList.remove('on'); return; }
    if (vbox.classList.contains('on')) return;
    if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(k)) { e.preventDefault(); zoom.classList.remove('on'); next(); }
    else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(k)) { e.preventDefault(); zoom.classList.remove('on'); prev(); }
    else if (k === 'Home') go(0);
    else if (k === 'End') go(N - 1);
    else if (/^[nN]$/.test(k)) notesEl.classList.toggle('on');
    else if (/^[tT]$/.test(k)) { timerOn = !timerOn; timerEl.classList.toggle('on', timerOn); document.body.classList.toggle('timer-on', timerOn); }
    else if (/^[rR]$/.test(k)) resetTimer();
    else if (/^[fF]$/.test(k)) toggleFullscreen();
    else if (/^[mM]$/.test(k)) muted = !muted;
    else if (/^[gG]$/.test(k)) { showGrammar = !showGrammar; $$('.grammar').forEach(g => g.style.display = showGrammar ? '' : 'none'); }
    else if (/^[cC]$/.test(k)) { confetti(220); sfx.tada(); }
    else if (k === 'h' || k === 'H' || k === '?') $('#help').classList.toggle('on');
  });
  $('#help').addEventListener('click', () => $('#help').classList.remove('on'));

  /* ---------- touch buttons (phone / tablet) ---------- */
  function toggleFullscreen() {
    const el = document.documentElement;
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      const p = req ? req.call(el) : null;
      // en Android, con pantalla completa se puede fijar horizontal
      Promise.resolve(p).then(() => screen.orientation?.lock?.('landscape')).catch(() => {});
    } else {
      (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
    }
  }
  $('#tprev').addEventListener('click', e => { e.stopPropagation(); prev(); });
  $('#tnext').addEventListener('click', e => { e.stopPropagation(); next(); });
  $('#tfull').addEventListener('click', e => { e.stopPropagation(); toggleFullscreen(); });
  // iPhone (Safari) no permite pantalla completa en páginas: ocultamos ese botón
  if (!document.documentElement.requestFullscreen && !document.documentElement.webkitRequestFullscreen) $('#tfull').style.display = 'none';
  addEventListener('orientationchange', () => setTimeout(fit, 250));
  const mq = q => window.matchMedia && matchMedia(q).matches;
  if (mq('(pointer: coarse)') || (navigator.maxTouchPoints > 0 && !mq('(hover: hover)'))) document.body.classList.add('touch');

  /* ---------- swipe (tablet / phone) ---------- */
  let sx = null;
  stage.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
  stage.addEventListener('touchend', e => { if (sx === null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 60) dx < 0 ? next() : prev(); sx = null; });

  /* ---------- start ---------- */
  const start = parseInt(location.hash.slice(1), 10);
  cur = 0; slides[0].classList.add('active');
  go(Number.isFinite(start) ? start - 1 : 0, true);
  if (!Number.isFinite(start) || start === 1) { updateCast(slides[0]); }
})();
