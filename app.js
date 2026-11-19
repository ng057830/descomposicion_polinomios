/**
 * Lógica interactiva de la aplicación: Descomposición de Polinomios por Ruffini.
 */

const STORAGE_KEY = 'ruffini_poly_completed_v1';

const state = {
  currentExIndex: 1, // Empezar en Ejercicio 1 (8x^3 - 12x^2 - 2x + 3)
  completed: new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')),
  soundEnabled: true,
  theme: 'light',
  // Estado de la tabla activa: array de pasos { locked, rootStr, multStrs, resStrs, computed }
  blocks: [],
  conclusionShown: false,
  guideStep: 0,
};

// ---------------- Utilidades UI & Audio ----------------

function renderMath(el = document.body) {
  if (typeof renderMathInElement === 'function') {
    renderMathInElement(el, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
      ],
      throwOnError: false,
    });
  }
}

function playTone(type) {
  if (!state.soundEnabled) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (type === 'ok') {
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.14);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc.start();
      osc.stop(ctx.currentTime + 0.23);
    } else {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(160, ctx.currentTime + 0.16);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.21);
    }
  } catch {
    // Ignorar si el navegador bloquea AudioContext
  }
}

function celebrate() {
  if (typeof confetti === 'function') {
    confetti({ particleCount: 70, spread: 60, origin: { y: 0.7 } });
  }
}

function saveCompleted(exId) {
  if (exId === 0) return; // El ejemplo base no cuenta en los 20
  state.completed.add(exId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...state.completed]));
  updateProgressUI();
  renderSidebar();
}

function updateProgressUI() {
  document.getElementById('completedCount').textContent = state.completed.size;
}

// ---------------- Navegación & Tema ----------------

document.querySelectorAll('.nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
    renderMath();
  });
});

document.getElementById('themeToggleBtn').addEventListener('click', () => {
  state.theme = state.theme === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', state.theme);
  document.getElementById('themeIcon').textContent = state.theme === 'light' ? '🌙' : '☀️';
});

document.getElementById('soundToggleBtn').addEventListener('click', () => {
  state.soundEnabled = !state.soundEnabled;
  document.getElementById('soundIcon').textContent = state.soundEnabled ? '🔊' : '🔇';
});

// ---------------- Sidebar de Ejercicios ----------------

function renderSidebar() {
  const list = document.getElementById('exerciseList');
  list.innerHTML = '';

  EXERCISES.forEach((ex, idx) => {
    const isDone = state.completed.has(ex.id);
    const btn = document.createElement('button');
    btn.className = `ex-item ${idx === state.currentExIndex ? 'active' : ''} ${isDone ? 'done' : ''}`;
    btn.innerHTML = `
      <div class="ex-item-label">
        <span class="ex-item-tag">${ex.tag}</span>
        <span class="ex-item-poly">$${formatPolyLatex(ex.coeffs)}$</span>
      </div>
      <span class="ex-status">${isDone ? '✅' : idx === 0 ? '📘' : '○'}</span>
    `;
    btn.addEventListener('click', () => loadExercise(idx));
    list.appendChild(btn);
  });

  renderMath(list);
}

// ---------------- Carga de Ejercicio & Tabla Interactiva ----------------

function createEmptyBlock(colCount) {
  return {
    locked: false,
    rootStr: '',
    multStrs: Array(colCount).fill(''),
    resStrs: Array(colCount).fill(''),
    computed: null,
  };
}

function loadExercise(idx) {
  state.currentExIndex = idx;
  const ex = EXERCISES[idx];

  document.getElementById('currentExTag').textContent = ex.tag;
  document.getElementById('currentExNote').textContent =
    ex.note || 'Acepta enteros o fracciones (ej: 1/2, -3/2, 2/3)';
  document.getElementById('currentPolyDisplay').innerHTML = `$P(x) = ${formatPolyLatex(ex.coeffs)}$`;

  document.getElementById('prevExBtn').disabled = idx === 0;
  document.getElementById('nextExBtn').disabled = idx === EXERCISES.length - 1;

  // Reiniciar tabla con 1 bloque inicial (4 columnas: x^3, x^2, x^1, x^0)
  state.blocks = [createEmptyBlock(4)];
  state.conclusionShown = false;

  document.getElementById('candidatesBox').classList.remove('hidden');
  document.getElementById('conclusionCard').classList.add('hidden');
  hideFeedback();

  renderCandidates(ex.coeffs);
  renderInteractiveTable();
  renderSidebar();
  renderMath(document.getElementById('tab-practice'));
}

function renderCandidates(coeffs) {
  const lead = coeffs[0] instanceof Frac ? coeffs[0].num : coeffs[0];
  const indep = coeffs[coeffs.length - 1] instanceof Frac ? coeffs[coeffs.length - 1].num : coeffs[coeffs.length - 1];
  const cands = getCandidateRationalRoots(lead, indep);

  document.getElementById('candidatesExplain').innerHTML =
    `<div style="margin-bottom:0.35rem;"><strong>Posibles raíces</strong> $= \\dfrac{\\text{Divisores del término independiente } (D_{${indep}})}{\\text{Divisores del coeficiente líder } (D_{${lead}})}$</div>` +
    `<div style="margin-bottom:0.45rem;">$$${formatDivisorsRatioLatex(indep, lead)}$$</div>` +
    `Haz clic en una posible raíz (puede ser válida o no) o pulsa <strong>«🎲 Proponer posible raíz»</strong> para probarla en la tabla:`;

  const chips = document.getElementById('candidatesChips');
  chips.innerHTML = '';
  cands.forEach((f) => {
    const chip = document.createElement('button');
    chip.className = 'cand-chip';
    chip.textContent = f.toString();
    chip.addEventListener('click', () => {
      const activeIdx = state.blocks.findIndex((b) => !b.locked);
      if (activeIdx === -1) return;
      state.blocks[activeIdx].rootStr = f.toString();
      const rootInput = document.querySelector(`input[data-block="${activeIdx}"][data-role="root"]`);
      if (rootInput) {
        rootInput.value = f.toString();
        rootInput.focus();
      }
    });
    chips.appendChild(chip);
  });
}

function getActiveCoeffsForBlock(blockIdx) {
  const ex = EXERCISES[state.currentExIndex];
  if (blockIdx === 0) return ex.coeffs.map((c) => new Frac(c, 1));
  const prev = state.blocks[blockIdx - 1];
  return prev.computed ? prev.computed.quotient : null;
}

function renderInteractiveTable() {
  const ex = EXERCISES[state.currentExIndex];
  const table = document.getElementById('interactiveRuffiniTable');
  table.innerHTML = '';

  // Fila 1: Potencia
  const powerRow = document.createElement('tr');
  powerRow.className = 'power-row';
  powerRow.innerHTML = `
    <th class="row-label">Potencia</th>
    <th>$x^3$</th>
    <th>$x^2$</th>
    <th>$x^1$</th>
    <th>$x^0$</th>
  `;
  table.appendChild(powerRow);

  // Fila 2: Coeficiente
  const coeffRow = document.createElement('tr');
  coeffRow.className = 'coeff-row';
  coeffRow.innerHTML = `
    <td class="row-label">Coeficiente</td>
    ${ex.coeffs.map((c) => `<td>${c}</td>`).join('')}
  `;
  table.appendChild(coeffRow);

  // Bloques de Ruffini (1, 2 o 3 extensiones)
  state.blocks.forEach((block, bIdx) => {
    const activeCols = 4 - bIdx; // 4 en paso 1, 3 en paso 2, 2 en paso 3

    // Fila de multiplicación (raíz + productos)
    const multRow = document.createElement('tr');
    multRow.className = 'mult-row';

    const rootTd = document.createElement('td');
    rootTd.className = 'root-cell';
    const rootInput = document.createElement('input');
    rootInput.type = 'text';
    rootInput.className = 'cell-input root-input';
    rootInput.placeholder = `r${bIdx + 1}`;
    rootInput.value = block.rootStr;
    rootInput.disabled = block.locked;
    rootInput.dataset.block = bIdx;
    rootInput.dataset.role = 'root';
    if (block.locked) rootInput.classList.add('is-correct');
    rootInput.addEventListener('input', (e) => {
      block.rootStr = e.target.value;
    });
    rootTd.appendChild(rootInput);
    multRow.appendChild(rootTd);

    for (let c = 0; c < 4; c++) {
      const td = document.createElement('td');
      if (c === 0 || c >= activeCols) {
        td.className = 'empty-cell';
      } else {
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.className = 'cell-input';
        inp.placeholder = '?';
        inp.value = block.multStrs[c];
        inp.disabled = block.locked;
        inp.dataset.block = bIdx;
        inp.dataset.role = 'mult';
        inp.dataset.col = c;
        if (block.locked) inp.classList.add('is-correct');
        inp.addEventListener('input', (e) => {
          block.multStrs[c] = e.target.value;
        });
        td.appendChild(inp);
      }
      multRow.appendChild(td);
    }
    table.appendChild(multRow);

    // Fila Cociente/Resto
    const resRow = document.createElement('tr');
    resRow.className = 'result-row';
    const labelTd = document.createElement('td');
    labelTd.className = 'row-label';
    labelTd.textContent = 'Cociente/Resto';
    resRow.appendChild(labelTd);

    for (let c = 0; c < 4; c++) {
      const td = document.createElement('td');
      if (c >= activeCols) {
        td.className = 'empty-cell';
      } else {
        const isRem = c === activeCols - 1;
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.className = 'cell-input';
        inp.placeholder = isRem ? 'Resto' : '?';
        inp.value = block.resStrs[c];
        inp.disabled = block.locked;
        inp.dataset.block = bIdx;
        inp.dataset.role = 'res';
        inp.dataset.col = c;
        if (block.locked) {
          inp.classList.add('is-correct');
          if (isRem) td.classList.add('rem-zero');
        }
        inp.addEventListener('input', (e) => {
          block.resStrs[c] = e.target.value;
        });
        td.appendChild(inp);
      }
      resRow.appendChild(td);
    }
    table.appendChild(resRow);
  });

  // Actualizar badge y botones de extensión
  const lockedCount = state.blocks.filter((b) => b.locked).length;
  const activeBlockIdx = state.blocks.findIndex((b) => !b.locked);

  document.getElementById('extBadge').textContent =
    activeBlockIdx === -1
      ? `Completado (${lockedCount} ${lockedCount === 1 ? 'extensión' : 'extensiones'})`
      : `Extensión: ${activeBlockIdx + 1}.º paso`;

  const checkBtn = document.getElementById('checkActiveStepBtn');
  const extendBtn = document.getElementById('extendTableBtn');
  const finish1Btn = document.getElementById('finishAt1Btn');

  checkBtn.classList.toggle('hidden', activeBlockIdx === -1);
  extendBtn.classList.toggle(
    'hidden',
    !(activeBlockIdx === -1 && state.blocks.length < 3)
  );
  finish1Btn.classList.toggle(
    'hidden',
    !(activeBlockIdx === -1 && state.blocks.length === 1 && !state.conclusionShown)
  );

  renderMath(table);
}

function showFeedback(msg, type = 'info') {
  const el = document.getElementById('stepFeedback');
  el.className = `feedback-banner ${type}`;
  el.innerHTML = msg;
  el.classList.remove('hidden');
  renderMath(el);
}

function hideFeedback() {
  document.getElementById('stepFeedback').classList.add('hidden');
}

// ---------------- Comprobación del Paso Activo ----------------

document.getElementById('checkActiveStepBtn').addEventListener('click', () => {
  const bIdx = state.blocks.findIndex((b) => !b.locked);
  if (bIdx === -1) return;

  const block = state.blocks[bIdx];
  const coeffs = getActiveCoeffsForBlock(bIdx);
  const activeCols = coeffs.length;

  // Limpiar marcas previas
  document.querySelectorAll(`input[data-block="${bIdx}"]`).forEach((inp) => {
    inp.classList.remove('is-correct', 'is-wrong');
  });

  const rootFrac = Frac.parse(block.rootStr);
  const rootInp = document.querySelector(`input[data-block="${bIdx}"][data-role="root"]`);
  if (!rootFrac) {
    rootInp.classList.add('is-wrong');
    playTone('err');
    showFeedback('Ingresa una raíz válida (entero o fracción como <code>1/2</code>).', 'error');
    return;
  }

  const expected = computeRuffiniStep(coeffs, rootFrac);
  let allCorrect = true;

  // Verificar celdas de multiplicación (1 .. activeCols-1)
  for (let c = 1; c < activeCols; c++) {
    const inp = document.querySelector(`input[data-block="${bIdx}"][data-role="mult"][data-col="${c}"]`);
    const userVal = Frac.parse(block.multStrs[c]);
    if (!userVal || !userVal.equals(expected.mults[c])) {
      inp.classList.add('is-wrong');
      allCorrect = false;
    } else {
      inp.classList.add('is-correct');
    }
  }

  // Verificar celdas de Cociente/Resto (0 .. activeCols-1)
  for (let c = 0; c < activeCols; c++) {
    const inp = document.querySelector(`input[data-block="${bIdx}"][data-role="res"][data-col="${c}"]`);
    const userVal = Frac.parse(block.resStrs[c]);
    if (!userVal || !userVal.equals(expected.results[c])) {
      inp.classList.add('is-wrong');
      allCorrect = false;
    } else {
      inp.classList.add('is-correct');
    }
  }

  if (!allCorrect) {
    playTone('err');
    showFeedback(
      'Revisa las celdas en rojo. Recuerda: el primer coeficiente baja igual, luego multiplicas por la raíz y sumas en vertical.',
      'error'
    );
    return;
  }

  // Si todas las cuentas están bien pero el resto != 0
  if (!expected.remainder.isZero()) {
    rootInp.classList.add('is-wrong');
    playTone('err');
    showFeedback(
      `Las cuentas de Ruffini son correctas, pero el resto es $${expected.remainder.toLatex()} \\neq 0$. Prueba con otra raíz candidata.`,
      'error'
    );
    return;
  }

  // ¡Paso correcto y resto = 0!
  block.locked = true;
  block.computed = expected;
  playTone('ok');
  renderInteractiveTable();

  if (state.blocks.length === 1) {
    showFeedback(
      `¡Excelente! $r_1 = ${rootFrac.toLatex()}$ es raíz exacta (Resto $= 0$). Ahora puedes <strong>extender la tabla</strong> para el 2.º paso de Ruffini o dejarlo en 1 extensión.`,
      'success'
    );
  } else if (state.blocks.length >= 2) {
    showFeedback(
      `¡Muy bien! Resto $= 0$ con $r_${bIdx + 1} = ${rootFrac.toLatex()}$. Revisa la sección <strong>"Por lo tanto,"</strong> abajo.`,
      'success'
    );
    showConclusion(state.blocks.length);
  }
});

// ---------------- Extender Tabla (2.º / 3.er paso) ----------------

document.getElementById('extendTableBtn').addEventListener('click', () => {
  const nextCols = 4 - state.blocks.length;
  if (nextCols < 2) return;
  const newBlockIdx = state.blocks.length;
  state.blocks.push(createEmptyBlock(nextCols));
  state.conclusionShown = false;
  document.getElementById('conclusionCard').classList.add('hidden');
  hideFeedback();
  const activeCoeffs = getActiveCoeffsForBlock(newBlockIdx);
  if (activeCoeffs) {
    renderCandidates(activeCoeffs);
    renderMath(document.getElementById('candidatesBox'));
  }
  renderInteractiveTable();
});

document.getElementById('finishAt1Btn').addEventListener('click', () => {
  showConclusion(1);
});

// ---------------- Sección "Por lo tanto," ----------------

function showConclusion(extCount) {
  const ex = EXERCISES[state.currentExIndex];
  const card = document.getElementById('conclusionCard');
  const content = document.getElementById('conclusionContent');
  state.conclusionShown = true;
  card.classList.remove('hidden');

  const polyLatex = formatPolyLatex(ex.coeffs);
  const allRoots = findRationalRoots(ex.coeffs);
  const intFactorLatex = formatIntegerFactorizationLatex(ex.coeffs, allRoots);

  if (extCount === 1) {
    const b0 = state.blocks[0].computed;
    const qLatex = formatPolyLatex(b0.quotient);
    content.innerHTML = `
      <div class="formula-pill">
        $${polyLatex} = ${formatRootFactorLatex(b0.root)}\\left(${qLatex}\\right)$
      </div>
      <p class="subtitle-sm">Con 1 extensión obtienes un factor lineal y un cociente cuadrático. Si extiendes la tabla una 2.ª vez, llegarás directamente a $(x - r_1)(x - r_2)(ax + b)$.</p>
      <div class="formula-pill">
        <strong>Factorización completa en enteros:</strong> $${polyLatex} = ${intFactorLatex}$
      </div>
    `;
    saveCompleted(ex.id);
    celebrate();
  } else if (extCount === 2) {
    const r1 = state.blocks[0].computed.root;
    const r2 = state.blocks[1].computed.root;
    const [a, b] = state.blocks[1].computed.quotient;

    content.innerHTML = `
      <div class="formula-pill">
        $${polyLatex} = ${formatRootFactorLatex(r1)}${formatRootFactorLatex(r2)}(ax + b)$
      </div>
      <div class="factor-check-row">
        <span>Completa el factor final $(ax + b)$ con los coeficientes del último cociente:</span>
        <label>$a =$ <input type="text" id="finalA" class="cell-input" placeholder="a"></label>
        <label>$b =$ <input type="text" id="finalB" class="cell-input" placeholder="b"></label>
        <button id="verifyFinalBtn" class="btn-accent btn-sm">✓ Verificar</button>
      </div>
      <div id="finalResultBox" class="hidden"></div>
    `;

    document.getElementById('verifyFinalBtn').addEventListener('click', () => {
      const ua = Frac.parse(document.getElementById('finalA').value);
      const ub = Frac.parse(document.getElementById('finalB').value);
      const aInp = document.getElementById('finalA');
      const bInp = document.getElementById('finalB');
      aInp.classList.remove('is-correct', 'is-wrong');
      bInp.classList.remove('is-correct', 'is-wrong');

      let ok = true;
      if (!ua || !ua.equals(a)) {
        aInp.classList.add('is-wrong');
        ok = false;
      } else {
        aInp.classList.add('is-correct');
      }
      if (!ub || !ub.equals(b)) {
        bInp.classList.add('is-wrong');
        ok = false;
      } else {
        bInp.classList.add('is-correct');
      }

      const box = document.getElementById('finalResultBox');
      box.classList.remove('hidden');
      if (!ok) {
        playTone('err');
        box.innerHTML = `<div class="feedback-banner error">Revisa $a$ y $b$: son los dos números de la última fila Cociente/Resto.</div>`;
        renderMath(box);
        return;
      }

      playTone('ok');
      celebrate();
      saveCompleted(ex.id);

      const d1Latex = formatDivisorsRatioLatex(ex.coeffs[3], ex.coeffs[0], r1);
      const q1 = state.blocks[0].computed.quotient;
      const d2Latex = formatDivisorsRatioLatex(q1[q1.length - 1].num, q1[0].num, r2);
      const underbraceLines = buildUnderbraceStepsLatex(ex.coeffs, r1, r2, a, b);

      // Factores enteros para ejemplos de división
      const g = Frac.gcd(Math.abs(a.num), Math.abs(b.num));
      const f1Div = formatLinearLatex(r1.den, -r1.num);
      const f2Div = formatLinearLatex(r2.den, -r2.num);
      const f3Div = formatLinearLatex(new Frac(a.num / g, 1), new Frac(b.num / g, 1));
      const divExamples = buildDivisionExamplesLatex(ex.coeffs, f1Div, f2Div, f3Div);

      box.innerHTML = `
        <div class="formula-pill" style="text-align:left; font-size:0.92rem;">
          <strong>Conjuntos de divisores usados:</strong>
          <div style="margin-top:0.4rem;">$$${d1Latex}$$</div>
          <div>$$${d2Latex}$$</div>
        </div>
        <div class="formula-pill" style="border-color: var(--accent);">
          <strong>Desarrollo completo:</strong>
          ${underbraceLines.map((ln) => `<div style="margin:0.35rem 0;">$$${ln}$$</div>`).join('')}
        </div>
        <div class="formula-pill" style="text-align:left; font-size:0.95rem;">
          <strong>Esto nos sirve si queremos hacer la división:</strong>
          ${divExamples.map((dv) => `<div style="margin-top:0.45rem; text-align:center;">$$${dv}$$</div>`).join('')}
        </div>
      `;
      renderMath(box);
    });
  } else {
    const r1 = state.blocks[0].computed.root;
    const r2 = state.blocks[1].computed.root;
    const r3 = state.blocks[2].computed.root;
    const lead = state.blocks[2].computed.quotient[0];
    const leadStr = lead.equals(1) ? '' : lead.toLatex();
    content.innerHTML = `
      <div class="formula-pill" style="border-color: var(--accent);">
        $${polyLatex} = ${leadStr}${formatRootFactorLatex(r1)}${formatRootFactorLatex(r2)}${formatRootFactorLatex(r3)}$
      </div>
      <div class="formula-pill">
        <strong>Forma equivalente con coeficientes enteros:</strong> $${polyLatex} = ${intFactorLatex}$
      </div>
    `;
    saveCompleted(ex.id);
    celebrate();
  }

  renderMath(card);
}

// ---------------- Botones Auxiliares (Pista, Autocompletar, Solución) ----------------

document.getElementById('toggleCandidatesBtn').addEventListener('click', () => {
  document.getElementById('candidatesBox').classList.toggle('hidden');
  renderMath(document.getElementById('candidatesBox'));
});

document.getElementById('proposeRootBtn').addEventListener('click', () => {
  const bIdx = state.blocks.findIndex((b) => !b.locked);
  if (bIdx === -1) return;
  const coeffs = getActiveCoeffsForBlock(bIdx);
  const cands = getCandidateRationalRoots(coeffs[0].num, coeffs[coeffs.length - 1].num);
  const validCands = cands.filter((r) => evalPoly(coeffs, r).isZero());
  const invalidCands = cands.filter((r) => !evalPoly(coeffs, r).isZero());

  const prevRoot = state.blocks[bIdx].rootStr;
  const pickValid = invalidCands.length === 0 || (validCands.length > 0 && Math.random() < 0.5);
  let pool = pickValid ? validCands : invalidCands;
  const filtered = pool.filter((r) => r.toString() !== prevRoot);
  if (filtered.length > 0) pool = filtered;

  const chosen = pool[Math.floor(Math.random() * pool.length)];
  if (!chosen) return;

  state.blocks[bIdx].rootStr = chosen.toString();
  const rootInp = document.querySelector(`input[data-block="${bIdx}"][data-role="root"]`);
  if (rootInp) {
    rootInp.value = chosen.toString();
    rootInp.classList.remove('is-correct', 'is-wrong');
  }
  showFeedback(
    `🎲 Te propongo probar la posible raíz $r = ${chosen.toLatex()}$ (tomada de $\\frac{D_{${coeffs[coeffs.length - 1].num}}}{D_{${coeffs[0].num}}}$). Completa la tabla de Ruffini para descubrir si es <strong>válida</strong> (Resto $= 0$) o <strong>no válida</strong> (Resto $\\neq 0$).`,
    'info'
  );
});

document.getElementById('hintRootBtn').addEventListener('click', () => {
  const bIdx = state.blocks.findIndex((b) => !b.locked);
  if (bIdx === -1) return;
  const coeffs = getActiveCoeffsForBlock(bIdx);
  const cands = getCandidateRationalRoots(coeffs[0].num, coeffs[coeffs.length - 1].num);
  const valid = cands.find((r) => evalPoly(coeffs, r).isZero());
  if (valid) {
    state.blocks[bIdx].rootStr = valid.toString();
    const rootInp = document.querySelector(`input[data-block="${bIdx}"][data-role="root"]`);
    if (rootInp) rootInp.value = valid.toString();
    showFeedback(
      `💡 Pista: prueba con la raíz $${valid.toLatex()}$. Ahora completa la multiplicación y la fila Cociente/Resto.`,
      'info'
    );
  }
});

document.getElementById('autoStepBtn').addEventListener('click', () => {
  const bIdx = state.blocks.findIndex((b) => !b.locked);
  if (bIdx === -1) return;
  const coeffs = getActiveCoeffsForBlock(bIdx);
  let rootFrac = Frac.parse(state.blocks[bIdx].rootStr);
  if (!rootFrac || !evalPoly(coeffs, rootFrac).isZero()) {
    const cands = getCandidateRationalRoots(coeffs[0].num, coeffs[coeffs.length - 1].num);
    rootFrac = cands.find((r) => evalPoly(coeffs, r).isZero());
  }
  if (!rootFrac) return;

  const step = computeRuffiniStep(coeffs, rootFrac);
  state.blocks[bIdx] = {
    locked: true,
    rootStr: rootFrac.toString(),
    multStrs: step.mults.map((m) => (m ? m.toString() : '')),
    resStrs: step.results.map((r) => r.toString()),
    computed: step,
  };
  renderInteractiveTable();
  if (state.blocks.length >= 2) showConclusion(state.blocks.length);
});

document.getElementById('showFullSolBtn').addEventListener('click', () => {
  const ex = EXERCISES[state.currentExIndex];
  const roots = ex.defaultRoots
    ? ex.defaultRoots.map((s) => Frac.parse(s))
    : findRationalRoots(ex.coeffs);

  const b0 = computeRuffiniStep(ex.coeffs, roots[0]);
  const b1 = computeRuffiniStep(b0.quotient, roots[1]);

  state.blocks = [
    {
      locked: true,
      rootStr: roots[0].toString(),
      multStrs: b0.mults.map((m) => (m ? m.toString() : '')),
      resStrs: b0.results.map((r) => r.toString()),
      computed: b0,
    },
    {
      locked: true,
      rootStr: roots[1].toString(),
      multStrs: b1.mults.map((m) => (m ? m.toString() : '')),
      resStrs: b1.results.map((r) => r.toString()),
      computed: b1,
    },
  ];
  renderInteractiveTable();
  showConclusion(2);
  hideFeedback();
});

document.getElementById('resetTableBtn').addEventListener('click', () => {
  loadExercise(state.currentExIndex);
});

document.getElementById('prevExBtn').addEventListener('click', () => {
  if (state.currentExIndex > 0) loadExercise(state.currentExIndex - 1);
});

document.getElementById('nextExBtn').addEventListener('click', () => {
  if (state.currentExIndex < EXERCISES.length - 1) loadExercise(state.currentExIndex + 1);
});

document.getElementById('resetProgressBtn').addEventListener('click', () => {
  state.completed.clear();
  localStorage.removeItem(STORAGE_KEY);
  updateProgressUI();
  renderSidebar();
});

// ---------------- TAB 2: EJEMPLOS PASO A PASO (3 EJEMPLOS BASE) ----------------

const GUIDE_EXAMPLES = [
  {
    badge: 'Ejemplo 1 (Raíces enteras + Divisiones)',
    coeffs: [2, -3, -14, 15],
    r1: '1',
    r2: '3',
    hasDivisions: true,
  },
  {
    badge: 'Ejemplo 2 (Coeficiente principal negativo)',
    coeffs: [-2, -1, 5, -2],
    r1: '1',
    r2: '-2',
    hasDivisions: true,
  },
  {
    badge: 'Ejemplo 3 (Raíces fraccionarias + D_{a0}/D_{an} + llaves)',
    coeffs: [12, 4, -3, -1],
    r1: '1/2',
    r2: '-1/3',
    hasDivisions: true,
  },
];

state.guideExIdx = 0;

function getGuideData(exIdx) {
  const g = GUIDE_EXAMPLES[exIdx];
  const b0 = computeRuffiniStep(g.coeffs, g.r1);
  const b1 = computeRuffiniStep(b0.quotient, g.r2);
  const polyLatex = formatPolyLatex(g.coeffs);

  const steps = [
    `<strong>Paso 0:</strong> Escribimos las potencias ($x^3, x^2, x^1, x^0$) y los coeficientes de $${polyLatex}$.`,
    `<strong>Paso 1 (1.ª extensión):</strong> Calculamos $${formatDivisorsRatioLatex(g.coeffs[3], g.coeffs[0], g.r1)}$. Bajamos el primer coeficiente ($${g.coeffs[0]}$).`,
    `<strong>Paso 2:</strong> Multiplicamos $${b0.root.toLatex()} \\cdot (${b0.results[0].toLatex()}) = ${b0.mults[1].toLatex()}$ y sumamos $${g.coeffs[1]} + (${b0.mults[1].toLatex()}) = ${b0.results[1].toLatex()}$.`,
    `<strong>Paso 3:</strong> Multiplicamos $${b0.root.toLatex()} \\cdot (${b0.results[1].toLatex()}) = ${b0.mults[2].toLatex()}$ y sumamos $${g.coeffs[2]} + (${b0.mults[2].toLatex()}) = ${b0.results[2].toLatex()}$.`,
    `<strong>Paso 4:</strong> Multiplicamos $${b0.root.toLatex()} \\cdot (${b0.results[2].toLatex()}) = ${b0.mults[3].toLatex()}$ y sumamos $${g.coeffs[3]} + (${b0.mults[3].toLatex()}) = 0$. ¡Resto $0$!`,
    `<strong>Paso 5 (2.ª extensión):</strong> Con el nuevo cociente, usamos $${formatDivisorsRatioLatex(b0.quotient[2].num, b0.quotient[0].num, g.r2)}$. Bajamos el $${b1.results[0].toLatex()}$.`,
    `<strong>Paso 6:</strong> Multiplicamos $${b1.root.toLatex()} \\cdot (${b1.results[0].toLatex()}) = ${b1.mults[1].toLatex()}$ y sumamos $${b0.quotient[1].toLatex()} + (${b1.mults[1].toLatex()}) = ${b1.results[1].toLatex()}$.`,
    `<strong>Paso 7:</strong> Multiplicamos $${b1.root.toLatex()} \\cdot (${b1.results[1].toLatex()}) = ${b1.mults[2].toLatex()}$ y sumamos $${b0.quotient[2].toLatex()} + (${b1.mults[2].toLatex()}) = 0$. ¡Resto $0$!`,
  ];

  return { g, b0, b1, polyLatex, steps };
}

function renderGuide() {
  const { g, b0, b1, polyLatex, steps } = getGuideData(state.guideExIdx);
  document.getElementById('guideBadge').textContent = g.badge;
  document.getElementById('guideTitle').innerHTML = `Descomposición de $${polyLatex}$`;
  document.getElementById('guideStepText').innerHTML = steps[state.guideStep];
  const r = state.guideStep;

  const table = document.getElementById('guideRuffiniTable');
  table.innerHTML = `
    <tr class="power-row">
      <th class="row-label">Potencia</th>
      <th>$x^3$</th><th>$x^2$</th><th>$x^1$</th><th>$x^0$</th>
    </tr>
    <tr class="coeff-row">
      <td class="row-label">Coeficiente</td>
      ${g.coeffs.map((c) => `<td>${c}</td>`).join('')}
    </tr>
    ${
      r >= 1
        ? `
      <tr>
        <td class="root-cell ${r === 1 ? 'hl-active' : ''}"><strong>$${b0.root.toLatex()}$</strong></td>
        <td class="empty-cell"></td>
        <td class="${r === 2 ? 'hl-active' : ''}">${r >= 2 ? `$${b0.mults[1].toLatex()}$` : ''}</td>
        <td class="${r === 3 ? 'hl-active' : ''}">${r >= 3 ? `$${b0.mults[2].toLatex()}$` : ''}</td>
        <td class="${r === 4 ? 'hl-active' : ''}">${r >= 4 ? `$${b0.mults[3].toLatex()}$` : ''}</td>
      </tr>
      <tr class="result-row">
        <td class="row-label">Cociente/Resto</td>
        <td class="${r === 1 ? 'hl-active' : ''}">$${b0.results[0].toLatex()}$</td>
        <td class="${r === 2 ? 'hl-active' : ''}">${r >= 2 ? `$${b0.results[1].toLatex()}$` : ''}</td>
        <td class="${r === 3 ? 'hl-active' : ''}">${r >= 3 ? `$${b0.results[2].toLatex()}$` : ''}</td>
        <td class="${r >= 4 ? 'rem-zero' : ''}">${r >= 4 ? '0' : ''}</td>
      </tr>`
        : ''
    }
    ${
      r >= 5
        ? `
      <tr>
        <td class="root-cell ${r === 5 ? 'hl-active' : ''}"><strong>$${b1.root.toLatex()}$</strong></td>
        <td class="empty-cell"></td>
        <td class="${r === 6 ? 'hl-active' : ''}">${r >= 6 ? `$${b1.mults[1].toLatex()}$` : ''}</td>
        <td class="${r === 7 ? 'hl-active' : ''}">${r >= 7 ? `$${b1.mults[2].toLatex()}$` : ''}</td>
        <td class="empty-cell"></td>
      </tr>
      <tr class="result-row">
        <td class="row-label">Cociente/Resto</td>
        <td class="${r === 5 ? 'hl-active' : ''}">$${b1.results[0].toLatex()}$</td>
        <td class="${r === 6 ? 'hl-active' : ''}">${r >= 6 ? `$${b1.results[1].toLatex()}$` : ''}</td>
        <td class="${r >= 7 ? 'rem-zero' : ''}">${r >= 7 ? '0' : ''}</td>
        <td class="empty-cell"></td>
      </tr>`
        : ''
    }
  `;

  const concl = document.getElementById('guideConclusion');
  if (r === 7) {
    const [a, b] = b1.quotient;
    const d1 = formatDivisorsRatioLatex(g.coeffs[3], g.coeffs[0], b0.root);
    const d2 = formatDivisorsRatioLatex(b0.quotient[2].num, b0.quotient[0].num, b1.root);
    const underbraceLines = buildUnderbraceStepsLatex(g.coeffs, b0.root, b1.root, a, b);
    const divFactor = Frac.gcd(Math.abs(a.num), Math.abs(b.num));
    const f1Div = formatLinearLatex(b0.root.den, -b0.root.num);
    const f2Div = formatLinearLatex(b1.root.den, -b1.root.num);
    const f3Div = formatLinearLatex(new Frac(a.num / divFactor, 1), new Frac(b.num / divFactor, 1));
    const divExamples = buildDivisionExamplesLatex(g.coeffs, f1Div, f2Div, f3Div);

    concl.classList.remove('hidden');
    concl.innerHTML = `
      <div>$$${d1}$$</div>
      <div>$$${d2}$$</div>
      <hr style="border:none;border-top:1px solid var(--border);margin:0.6rem 0;">
      <strong>Por lo tanto,</strong>
      ${underbraceLines.map((ln) => `<div>$$${ln}$$</div>`).join('')}
      <hr style="border:none;border-top:1px solid var(--border);margin:0.6rem 0;">
      <strong>Esto nos sirve si queremos hacer la división:</strong>
      ${divExamples.map((dv) => `<div>$$${dv}$$</div>`).join('')}
    `;
  } else {
    concl.classList.add('hidden');
  }

  document.getElementById('guidePrevBtn').disabled = state.guideStep === 0;
  document.getElementById('guideNextBtn').disabled = state.guideStep === steps.length - 1;
  renderMath(document.getElementById('tab-guide'));
}

document.querySelectorAll('.guide-ex-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.guide-ex-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.guideExIdx = Number(btn.dataset.guide);
    state.guideStep = 7; // Mostrar completo al cambiar de ejemplo para inspección rápida
    renderGuide();
  });
});

document.getElementById('guidePrevBtn').addEventListener('click', () => {
  if (state.guideStep > 0) {
    state.guideStep--;
    renderGuide();
  }
});
document.getElementById('guideNextBtn').addEventListener('click', () => {
  if (state.guideStep < 7) {
    state.guideStep++;
    renderGuide();
  }
});
document.getElementById('guideResetBtn').addEventListener('click', () => {
  state.guideStep = 0;
  renderGuide();
});

// ---------------- Inicialización ----------------

window.addEventListener('DOMContentLoaded', () => {
  updateProgressUI();
  loadExercise(1);
  renderGuide();
});
