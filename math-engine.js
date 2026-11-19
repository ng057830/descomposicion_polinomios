/**
 * Motor matemático exacto para descomposición de polinomios cúbicos por Ruffini.
 * Soporta aritmética exacta con fracciones (p/q), enteros y decimales.
 */

class Frac {
  constructor(num, den = 1) {
    if (den === 0) throw new Error('Denominador no puede ser 0');
    if (den < 0) {
      num = -num;
      den = -den;
    }
    if (num === 0) {
      this.num = 0;
      this.den = 1;
    } else {
      const g = Frac.gcd(Math.abs(num), Math.abs(den));
      this.num = num / g;
      this.den = den / g;
    }
  }

  static gcd(a, b) {
    a = Math.round(Math.abs(a));
    b = Math.round(Math.abs(b));
    while (b !== 0) {
      const t = b;
      b = a % b;
      a = t;
    }
    return a || 1;
  }

  static parse(input) {
    if (input instanceof Frac) return input;
    if (typeof input === 'number') {
      if (!Number.isFinite(input)) return null;
      if (Number.isInteger(input)) return new Frac(input, 1);
      const s = input.toString();
      if (s.includes('.')) {
        const [, dec] = s.split('.');
        const den = Math.pow(10, dec.length);
        return new Frac(Math.round(input * den), den);
      }
      return null;
    }
    if (typeof input !== 'string') return null;
    let s = input.trim().replace(/\s+/g, '').replace(',', '.');
    if (!s) return null;

    if (s.includes('/')) {
      const parts = s.split('/');
      if (parts.length !== 2) return null;
      const n = Number(parts[0]);
      const d = Number(parts[1]);
      if (!Number.isInteger(n) || !Number.isInteger(d) || d === 0) return null;
      return new Frac(n, d);
    }

    const val = Number(s);
    if (!Number.isFinite(val)) return null;
    if (Number.isInteger(val)) return new Frac(val, 1);
    if (s.includes('.')) {
      const [, dec] = s.split('.');
      const den = Math.pow(10, dec.length);
      return new Frac(Math.round(val * den), den);
    }
    return null;
  }

  add(other) {
    const o = Frac.parse(other);
    return new Frac(this.num * o.den + o.num * this.den, this.den * o.den);
  }

  sub(other) {
    const o = Frac.parse(other);
    return new Frac(this.num * o.den - o.num * this.den, this.den * o.den);
  }

  mul(other) {
    const o = Frac.parse(other);
    return new Frac(this.num * o.num, this.den * o.den);
  }

  div(other) {
    const o = Frac.parse(other);
    if (o.num === 0) throw new Error('División por cero');
    return new Frac(this.num * o.den, this.den * o.num);
  }

  neg() {
    return new Frac(-this.num, this.den);
  }

  equals(other) {
    const o = Frac.parse(other);
    if (!o) return false;
    return this.num === o.num && this.den === o.den;
  }

  isZero() {
    return this.num === 0;
  }

  toString() {
    if (this.den === 1) return `${this.num}`;
    return `${this.num}/${this.den}`;
  }

  toLatex() {
    if (this.den === 1) return `${this.num}`;
    if (this.num < 0) return `-\\dfrac{${Math.abs(this.num)}}{${this.den}}`;
    return `\\dfrac{${this.num}}{${this.den}}`;
  }
}

/**
 * Formatea un polinomio cúbico [a, b, c, d] en LaTeX.
 */
function formatPolyLatex(coeffs) {
  const deg = coeffs.length - 1;
  const terms = [];
  coeffs.forEach((raw, idx) => {
    const c = Frac.parse(raw);
    if (!c || c.isZero()) return;
    const p = deg - idx;
    const absC = c.num < 0 ? c.neg() : c;
    let coeffStr = '';
    if (p === 0 || !absC.equals(1)) {
      coeffStr = absC.toLatex();
    }
    const varStr = p === 0 ? '' : p === 1 ? 'x' : `x^${p}`;
    const sign = c.num < 0 ? '-' : terms.length > 0 ? '+' : '';
    terms.push(`${sign}${coeffStr}${varStr}`);
  });
  return terms.length ? terms.join(' ') : '0';
}

/**
 * Formatea un factor lineal (x - r) en LaTeX.
 */
function formatRootFactorLatex(r) {
  const f = Frac.parse(r);
  if (f.isZero()) return 'x';
  if (f.num > 0) return `(x - ${f.toLatex()})`;
  return `(x + ${f.neg().toLatex()})`;
}

/**
 * Formatea un factor lineal (ax + b) en LaTeX.
 */
function formatLinearLatex(a, b) {
  const fa = Frac.parse(a);
  const fb = Frac.parse(b);
  let aPart = '';
  if (fa.equals(1)) aPart = 'x';
  else if (fa.equals(-1)) aPart = '-x';
  else aPart = `${fa.toLatex()}x`;

  if (fb.isZero()) return `(${aPart})`;
  const bSign = fb.num > 0 ? '+' : '-';
  const bAbs = fb.num > 0 ? fb : fb.neg();
  return `(${aPart} ${bSign} ${bAbs.toLatex()})`;
}

/**
 * Evalúa un paso de Ruffini para coeficientes dados y raíz r.
 * Devuelve { mults: Frac[], results: Frac[], remainder: Frac, quotient: Frac[] }
 */
function computeRuffiniStep(coeffs, root) {
  const r = Frac.parse(root);
  const cList = coeffs.map((c) => Frac.parse(c));
  const mults = [null];
  const results = [cList[0]];

  for (let i = 1; i < cList.length; i++) {
    const m = results[i - 1].mul(r);
    mults.push(m);
    results.push(cList[i].add(m));
  }

  return {
    root: r,
    mults,
    results,
    quotient: results.slice(0, results.length - 1),
    remainder: results[results.length - 1],
  };
}

/**
 * Calcula divisores positivos de un entero.
 */
function getDivisors(n) {
  const val = Math.abs(Math.round(n));
  if (val === 0) return [1];
  const divs = [];
  for (let i = 1; i <= val; i++) {
    if (val % i === 0) divs.push(i);
  }
  return divs;
}

/**
 * Calcula todas las posibles raíces racionales p/q (Teorema de la Raíz Racional).
 */
function getCandidateRationalRoots(a3, a0) {
  const pDivs = getDivisors(a0);
  const qDivs = getDivisors(a3);
  const seen = new Set();
  const candidates = [];

  for (const p of pDivs) {
    for (const q of qDivs) {
      const pos = new Frac(p, q);
      const neg = new Frac(-p, q);
      if (!seen.has(pos.toString())) {
        seen.add(pos.toString());
        candidates.push(pos);
      }
      if (!seen.has(neg.toString())) {
        seen.add(neg.toString());
        candidates.push(neg);
      }
    }
  }
  candidates.sort((a, b) => a.num / a.den - b.num / b.den);
  return candidates;
}

/**
 * Evalúa P(r) para verificar si r es raíz.
 */
function evalPoly(coeffs, r) {
  const fr = Frac.parse(r);
  let acc = new Frac(0, 1);
  for (const c of coeffs) {
    acc = acc.mul(fr).add(Frac.parse(c));
  }
  return acc;
}

/**
 * Encuentra las raíces racionales de un polinomio cúbico [a, b, c, d].
 */
function findRationalRoots(coeffs) {
  if (coeffs[3] === 0) return [new Frac(0, 1)];
  const candidates = getCandidateRationalRoots(coeffs[0], coeffs[3]);
  const roots = [];
  let current = coeffs.map((c) => new Frac(c, 1));

  for (const cand of candidates) {
    while (current.length > 1 && evalPoly(current, cand).isZero()) {
      roots.push(cand);
      const step = computeRuffiniStep(current, cand);
      current = step.quotient;
    }
  }
  return roots;
}

/**
 * Convierte raíces racionales [r1, r2, r3] y coef principal A en factores primitivos (qx - p).
 */
function formatIntegerFactorizationLatex(coeffs, roots) {
  if (roots.length !== 3) return null;
  let remLead = new Frac(coeffs[0], 1);
  const factors = [];

  for (const r of roots) {
    // x - p/q = (qx - p)/q
    const q = r.den;
    const p = r.num;
    remLead = remLead.div(new Frac(q, 1));
    factors.push({ a: q, b: -p });
  }

  // Ordenar por a ascendente y luego -b/a
  factors.sort((u, v) => u.a - v.a || u.b / u.a - v.b / v.a);

  let prefix = '';
  if (!remLead.equals(1)) {
    prefix = remLead.equals(-1) ? '-' : remLead.toLatex();
  }
  return (
    prefix +
    factors.map((f) => formatLinearLatex(f.a, f.b)).join('')
  );
}

/**
 * Formatea D_{a0}/D_{an} = {±...}/{±...} en LaTeX.
 */
function formatDivisorsRatioLatex(a0, an, chosenRoot = null) {
  const pDivs = getDivisors(a0).map((d) => `\\pm ${d}`).join(', ');
  const qDivs = getDivisors(an).map((d) => `\\pm ${d}`).join(', ');
  const rootSuffix = chosenRoot ? ` \\;\\longrightarrow\\; r = ${Frac.parse(chosenRoot).toLatex()}` : '';
  return `\\dfrac{D_{${a0}}}{D_{${an}}} = \\dfrac{\\{${pDivs}\\}}{\\{${qDivs}\\}}${rootSuffix}`;
}

/**
 * Genera los pasos con \\underbrace para pasar de (x - r1)(x - r2)(ax + b) a factores enteros.
 */
function buildUnderbraceStepsLatex(coeffs, r1, r2, a, b) {
  const f1 = Frac.parse(r1);
  const f2 = Frac.parse(r2);
  const fa = Frac.parse(a);
  const fb = Frac.parse(b);
  const polyLatex = formatPolyLatex(coeffs);

  const aInt = fa.num; // fa, fb son enteros cuando coeffs son enteros y r1, r2 racionales? Ojo: si r1=p1/q1, a = A (entero), b puede ser entero si q1 | ...
  // En general, g = gcd(|a|, |b|) si ambos son enteros
  if (fa.den !== 1 || fb.den !== 1) {
    return [`${polyLatex} = ${formatRootFactorLatex(f1)}${formatRootFactorLatex(f2)}${formatLinearLatex(fa, fb)}`];
  }

  const g = Frac.gcd(Math.abs(fa.num), Math.abs(fb.num));
  const ap = new Frac(fa.num / g, 1);
  const bp = new Frac(fb.num / g, 1);
  const q1 = f1.den;
  const q2 = f2.den;
  const k = g / (q1 * q2);

  const rf1 = formatRootFactorLatex(f1);
  const rf2 = formatRootFactorLatex(f2);
  const linOrig = formatLinearLatex(fa, fb);
  const linSimp = formatLinearLatex(ap, bp);

  const lines = [];
  if (g === 1 && q1 === 1 && q2 === 1) {
    lines.push(`${polyLatex} = ${rf1}${rf2}${linOrig}`);
    return lines;
  }

  lines.push(`${rf1}${rf2}\\underbrace{${linOrig}}`);
  if (g !== 1) {
    lines.push(`${rf1}${rf2} \\cdot ${g}${linSimp}`);
    lines.push(`${g}${rf1}${rf2}${linSimp}`);
  }

  if (q1 > 1 || q2 > 1) {
    const parts = [];
    if (k !== 1) parts.push(`${k}`);
    if (q1 > 1) parts.push(`${q1}`);
    if (q2 > 1) parts.push(`${q2}`);
    if (parts.length > 1) {
      lines.push(`${parts.join(' \\cdot ')}${rf1}${rf2}${linSimp}`);
    }
    const left1 = q1 > 1 ? `\\underbrace{${q1}${rf1}}` : rf1;
    const left2 = q2 > 1 ? `\\underbrace{${q2}${rf2}}` : rf2;
    const kPrefix = k !== 1 ? `${k}` : '';
    lines.push(`${kPrefix}${left1} \\cdot ${left2}${linSimp}`);
  }

  const fac1 = formatLinearLatex(q1, -f1.num);
  const fac2 = formatLinearLatex(q2, -f2.num);
  const kPrefix = k !== 1 ? `${k}` : '';
  lines.push(`${polyLatex} = ${kPrefix}${fac1}${fac2}${linSimp}`);
  return lines;
}

/**
 * Genera ejemplos de división exacta a partir de 3 factores lineales.
 */
function buildDivisionExamplesLatex(coeffs, f1Latex, f2Latex, f3Latex) {
  const polyLatex = formatPolyLatex(coeffs);
  return [
    `\\dfrac{${polyLatex}}{${f3Latex.replace(/^\(|\)$/g, '')}} = ${f1Latex}${f2Latex}`,
    `\\dfrac{${polyLatex}}{${f2Latex.replace(/^\(|\)$/g, '')}} = ${f1Latex}${f3Latex}`,
  ];
}

/**
 * Lista de ejercicios: Ejemplo 1 (del enunciado) + los 20 polinomios solicitados.
 */
const EXERCISES = [
  {
    id: 0,
    tag: 'Ejemplo Guía',
    title: 'Ejercicio 1 (Ejemplo Base)',
    coeffs: [2, -3, -14, 15],
    defaultRoots: ['1', '3'],
    note: 'Ejemplo del desarrollo original con raíces enteras 1 y 3.',
  },
  { id: 1, tag: 'Ejercicio 1', title: 'Polinomio 1', coeffs: [8, -12, -2, 3] },
  { id: 2, tag: 'Ejercicio 2', title: 'Polinomio 2', coeffs: [8, 12, -2, -3] },
  { id: 3, tag: 'Ejercicio 3', title: 'Polinomio 3', coeffs: [12, -16, -5, 3] },
  { id: 4, tag: 'Ejercicio 4', title: 'Polinomio 4', coeffs: [12, 20, 1, -3] },
  { id: 5, tag: 'Ejercicio 5', title: 'Polinomio 5', coeffs: [12, 8, -23, -12] },
  { id: 6, tag: 'Ejercicio 6', title: 'Polinomio 6', coeffs: [12, -4, -25, 12] },
  { id: 7, tag: 'Ejercicio 7', title: 'Polinomio 7', coeffs: [16, -28, 4, 3] },
  { id: 8, tag: 'Ejercicio 8', title: 'Polinomio 8', coeffs: [16, 28, 4, -3] },
  { id: 9, tag: 'Ejercicio 9', title: 'Polinomio 9', coeffs: [16, 4, -24, 9] },
  { id: 10, tag: 'Ejercicio 10', title: 'Polinomio 10', coeffs: [16, 12, -4, -3] },
  { id: 11, tag: 'Ejercicio 11', title: 'Polinomio 11', coeffs: [18, -9, -8, 4] },
  { id: 12, tag: 'Ejercicio 12', title: 'Polinomio 12', coeffs: [18, 15, -1, -2] },
  { id: 13, tag: 'Ejercicio 13', title: 'Polinomio 13', coeffs: [18, 9, -23, 6] },
  { id: 14, tag: 'Ejercicio 14', title: 'Polinomio 14', coeffs: [18, 3, -7, -2] },
  { id: 15, tag: 'Ejercicio 15', title: 'Polinomio 15', coeffs: [24, -2, -27, -10] },
  { id: 16, tag: 'Ejercicio 16', title: 'Polinomio 16', coeffs: [24, 22, -19, 3] },
  { id: 17, tag: 'Ejercicio 17', title: 'Polinomio 17', coeffs: [24, 26, 9, 1] },
  { id: 18, tag: 'Ejercicio 18', title: 'Polinomio 18', coeffs: [24, 10, -13, -6] },
  { id: 19, tag: 'Ejercicio 19', title: 'Polinomio 19', coeffs: [27, 18, -3, -2] },
  { id: 20, tag: 'Ejercicio 20', title: 'Polinomio 20', coeffs: [27, -18, -3, 2] },
];
