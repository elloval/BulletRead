document.addEventListener("DOMContentLoaded", function () {
  // DOMContentLoaded: DOM pronto prima di getElementById. [web:136]
  var els = {
    wpm: document.getElementById("wpm"),
    wpmVal: document.getElementById("wpmVal"),
    play: document.getElementById("play"),
    pause: document.getElementById("pause"),
    back: document.getElementById("back"),
    forward: document.getElementById("forward"),
    load: document.getElementById("load"),
    text: document.getElementById("text"),
    bigWord: document.getElementById("bigWord"),
    context: document.getElementById("context")
  };

  // Fail-fast su id mancanti
  for (var k in els) {
    if (Object.prototype.hasOwnProperty.call(els, k) && !els[k]) {
      throw new Error("Elemento DOM non trovato: " + k);
    }
  }

  var tokens = [];
  var index = 0;
  var playing = false;

  var nextAt = 0;
  var rafId = null;

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (m) {
      return ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      })[m];
    });
  }

  function tokenize(input) {
    var text = String(input || "").trim().replace(/\s+/g, " ");
    if (!text) return [];
    // Tokenizza separando parole e punteggiatura
    return text
      .split(/(\s+|[,.!?;:()"“”'’—-])/)
      .filter(function (t) { return t && !/^\s+$/.test(t); });
  }

  function isPunctuation(t) {
    return /^[,.!?;:()"“”'’—-]$/.test(t);
  }

  // Euristica ORP
  function orpIndex(word) {
    var w = String(word).replace(/[^A-Za-zÀ-ÖØ-öø-ÿ0-9]/g, "");
    var n = Math.max(w.length, 1);
    if (n <= 1) return 0;
    if (n <= 5) return 1;
    if (n <= 9) return 2;
    if (n <= 13) return 3;
    return 4;
  }

  function renderWord(token) {
    var t = (token !== undefined && token !== null) ? String(token) : "";
    var idx = orpIndex(t);

    var a = t.slice(0, idx);
    var b = t.slice(idx, idx + 1);
    var c = t.slice(idx + 1);

    els.bigWord.innerHTML =
      escapeHtml(a) + '<span class="orp">' + escapeHtml(b) + "</span>" + escapeHtml(c);
  }

  function renderContext() {
    var before = 6, after = 6;
    var start = Math.max(0, index - before);
    var end = Math.min(tokens.length, index + after + 1);

    var parts = [];
    for (var i = start; i < end; i++) {
      var t = tokens[i];
      var cls = (i === index) ? "cur" : "";
      parts.push('<span class="' + cls + '">' + escapeHtml(t) + "</span>");
    }
    els.context.innerHTML = parts.join(" ");
  }

  function baseMsPerWord() {
    var wpm = Number(els.wpm.value || 300);
    if (!wpm || wpm <= 0) wpm = 300;
    return 60000 / wpm;
  }

  // Tempo extra: anche se “salti” la punteggiatura, serve una pausa
  function multiplierForToken(t) {
    if (/^[.!?]$/.test(t)) return 2.2;
    if (/^[,;:]$/.test(t)) return 1.5;
    if (/^[-—]$/.test(t)) return 1.3;
    if (/^[()"'“”'’]$/.test(t)) return 1.1;

    var len = String(t).replace(/[^A-Za-zÀ-ÖØ-öø-ÿ0-9]/g, "").length;
    if (len >= 12) return 1.35;
    if (len >= 8) return 1.15;
    return 1.0;
  }

  function toggleButtons() {
    els.play.disabled = playing;
    els.pause.disabled = !playing;
  }

  function tick(now) {
    if (!playing) return;

    if (!nextAt) nextAt = now;

    if (now >= nextAt) {
      if (!tokens.length) {
        playing = false;
        toggleButtons();
        return;
      }

      var t = (tokens[index] !== undefined && tokens[index] !== null) ? tokens[index] : "";

      // PUNTEGGIATURA: non mostrare nel word box, ma fai pausa + avanza
      if (isPunctuation(t)) {
        nextAt += baseMsPerWord() * multiplierForToken(t);
        // aggiorna solo il contesto (così vedi comunque virgole/punti sotto)
        renderContext();

        index = Math.min(index + 1, tokens.length - 1);

        // se siamo arrivati in fondo, stop
        if (index === tokens.length - 1) {
          playing = false;
          toggleButtons();
          return;
        }
      } else {
        // PAROLA: mostra parola grande e contesto
        renderWord(t);
        renderContext();

        nextAt += baseMsPerWord() * multiplierForToken(t);

        index = Math.min(index + 1, tokens.length - 1);

        if (index === tokens.length - 1) {
          // mostra l'ultima parola e stop
          var last = tokens[index];
          if (!isPunctuation(last)) renderWord(last);
          renderContext();
          playing = false;
          toggleButtons();
          return;
        }
      }
    }

    // requestAnimationFrame per scheduling. [web:131]
    rafId = window.requestAnimationFrame(tick);
  }

  function play() {
    if (!tokens.length) return;
    playing = true;
    nextAt = 0;
    toggleButtons();
    rafId = window.requestAnimationFrame(tick);
  }

  function pause() {
    playing = false;
    toggleButtons();
    if (rafId) window.cancelAnimationFrame(rafId); // cancella frame schedulato. [web:177]
    rafId = null;
  }

  function jump(delta) {
    if (!tokens.length) return;
    index = Math.max(0, Math.min(tokens.length - 1, index + delta));

    // se finisci su punteggiatura, non mostrarla grande (mostra vuoto o parola successiva)
    if (isPunctuation(tokens[index])) {
      els.bigWord.textContent = "";
    } else {
      renderWord(tokens[index]);
    }
    renderContext();
  }

  function loadText() {
    tokens = tokenize(els.text.value);
    index = 0;
    // prima render
    if (tokens.length && !isPunctuation(tokens[0])) renderWord(tokens[0]);
    else els.bigWord.textContent = "";
    renderContext();
  }

  // Eventi
  els.wpm.addEventListener("input", function () {
    els.wpmVal.textContent = els.wpm.value;
  });

  els.load.addEventListener("click", loadText);
  els.play.addEventListener("click", play);
  els.pause.addEventListener("click", pause);
  els.back.addEventListener("click", function () { jump(-1); });
  els.forward.addEventListener("click", function () { jump(+1); });

  window.addEventListener("keydown", function (e) {
    if (e.code === "Space") {
      e.preventDefault();
      if (playing) pause(); else play();
    }
    if (e.code === "ArrowLeft") jump(-1);
    if (e.code === "ArrowRight") jump(+1);
  });

  // Stato iniziale
  els.wpmVal.textContent = els.wpm.value;
  els.bigWord.textContent = "";
  renderContext();
});
