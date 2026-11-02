// Fórmulas de campos calculados (ex.: bilirrubina indireta = TOTAL - DIRETA).
//
// Avaliador próprio, sem eval/Function: só números, operadores, parênteses,
// funções da lista abaixo e variáveis (códigos dos parâmetros do mesmo exame).
//
// Precedência matemática padrão: ^ antes de * e /, e estes antes de + e -.
// (O XLAB7 antigo calculava da esquerda para a direita; aqui 2 + 3 * 4 = 14.)

export type FormulaResult = { value: number | null; error?: string };

type Token =
  | { t: "num"; v: number }
  | { t: "id"; v: string }
  | { t: "op"; v: "+" | "-" | "*" | "/" | "^" }
  | { t: "lp" }
  | { t: "rp" }
  | { t: "comma" };

type Node =
  | { k: "num"; v: number }
  | { k: "var"; name: string }
  | { k: "neg"; a: Node }
  | { k: "bin"; op: "+" | "-" | "*" | "/" | "^"; a: Node; b: Node }
  | { k: "fn"; name: string; args: Node[] };

const FUNCTIONS: Record<string, { min: number; max: number; fn: (...a: number[]) => number }> = {
  sqrt: { min: 1, max: 1, fn: Math.sqrt }, // raiz quadrada
  ln: { min: 1, max: 1, fn: Math.log }, // logaritmo natural
  log: { min: 1, max: 1, fn: Math.log10 }, // logaritmo base 10
  exp: { min: 1, max: 1, fn: Math.exp }, // e elevado a x
  abs: { min: 1, max: 1, fn: Math.abs },
  min: { min: 2, max: 8, fn: Math.min },
  max: { min: 2, max: 8, fn: Math.max },
};

const norm = (s: string) => s.trim().toUpperCase();

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
    } else if (/[0-9.,]/.test(c)) {
      const m = /^(\d+([.,]\d+)?|[.,]\d+)/.exec(src.slice(i));
      if (!m) throw new Error(`Número inválido em "${src.slice(i, i + 6)}"`);
      out.push({ t: "num", v: Number(m[0].replace(",", ".")) });
      i += m[0].length;
    } else if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i))!;
      out.push({ t: "id", v: m[0] });
      i += m[0].length;
    } else if ("+-*/^".includes(c)) {
      out.push({ t: "op", v: c as "+" | "-" | "*" | "/" | "^" });
      i++;
    } else if (c === "(") {
      out.push({ t: "lp" });
      i++;
    } else if (c === ")") {
      out.push({ t: "rp" });
      i++;
    } else if (c === ";") {
      out.push({ t: "comma" });
      i++;
    } else {
      throw new Error(`Caractere não permitido: "${c}"`);
    }
  }
  return out;
}

// Descida recursiva: expr → termo (+|- termo)* ; termo → fator (*|/ fator)* ; fator → unário (^ fator)?
function parse(src: string): Node {
  const toks = tokenize(src);
  if (toks.length === 0) throw new Error("Fórmula vazia");
  let p = 0;
  const peek = () => toks[p];

  const expr = (): Node => {
    let left = term();
    for (let t = peek(); t && t.t === "op" && (t.v === "+" || t.v === "-"); t = peek()) {
      p++;
      left = { k: "bin", op: t.v, a: left, b: term() };
    }
    return left;
  };
  const term = (): Node => {
    let left = unary();
    for (let t = peek(); t && t.t === "op" && (t.v === "*" || t.v === "/"); t = peek()) {
      p++;
      left = { k: "bin", op: t.v, a: left, b: unary() };
    }
    return left;
  };
  const unary = (): Node => {
    const t = peek();
    if (t && t.t === "op" && (t.v === "-" || t.v === "+")) {
      p++;
      const a = unary();
      return t.v === "-" ? { k: "neg", a } : a;
    }
    return power();
  };
  const power = (): Node => {
    const base = atom();
    const t = peek();
    if (t && t.t === "op" && t.v === "^") {
      p++;
      return { k: "bin", op: "^", a: base, b: unary() }; // associa à direita
    }
    return base;
  };
  const atom = (): Node => {
    const t = toks[p++];
    if (!t) throw new Error("Fórmula incompleta");
    if (t.t === "num") return { k: "num", v: t.v };
    if (t.t === "lp") {
      const e = expr();
      if (toks[p++]?.t !== "rp") throw new Error('Falta fechar parêntese ")"');
      return e;
    }
    if (t.t === "id") {
      if (peek()?.t === "lp") {
        const name = t.v.toLowerCase();
        const spec = FUNCTIONS[name];
        if (!spec) throw new Error(`Função desconhecida: ${t.v}`);
        p++;
        const args: Node[] = [];
        if (peek()?.t !== "rp") {
          args.push(expr());
          while (peek()?.t === "comma") {
            p++;
            args.push(expr());
          }
        }
        if (toks[p++]?.t !== "rp") throw new Error(`Falta fechar parêntese em ${t.v}(...)`);
        if (args.length < spec.min || args.length > spec.max) throw new Error(`${t.v}() recebe ${spec.min === spec.max ? spec.min : `${spec.min} a ${spec.max}`} argumento(s)`);
        return { k: "fn", name, args };
      }
      return { k: "var", name: norm(t.v) };
    }
    throw new Error("Fórmula inválida");
  };

  const tree = expr();
  if (p < toks.length) throw new Error("Fórmula inválida: sobrou texto no final");
  return tree;
}

function collectVars(n: Node, acc: Set<string>) {
  if (n.k === "var") acc.add(n.name);
  else if (n.k === "neg") collectVars(n.a, acc);
  else if (n.k === "bin") {
    collectVars(n.a, acc);
    collectVars(n.b, acc);
  } else if (n.k === "fn") n.args.forEach((a) => collectVars(a, acc));
}

/** Códigos (em maiúsculas) usados pela fórmula. Lança erro se a sintaxe for inválida. */
export function formulaVariables(formula: string): string[] {
  const s = new Set<string>();
  collectVars(parse(formula), s);
  return Array.from(s);
}

/** Retorna mensagem de erro, ou null se a fórmula é válida e só usa códigos conhecidos. */
export function validateFormula(formula: string, knownCodes: string[], selfCode?: string | null): string | null {
  try {
    const vars = formulaVariables(formula);
    const known = new Set(knownCodes.map(norm));
    const self = selfCode ? norm(selfCode) : null;
    for (const v of vars) {
      if (self && v === self) return `A fórmula não pode usar o próprio campo (${v})`;
      if (!known.has(v)) return `Código desconhecido: ${v}. Use o código de outro parâmetro do mesmo exame.`;
    }
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "Fórmula inválida";
  }
}

function run(n: Node, vars: Record<string, number | null | undefined>): number | null {
  switch (n.k) {
    case "num":
      return n.v;
    case "var": {
      const v = vars[n.name];
      return v == null || !Number.isFinite(v) ? null : v;
    }
    case "neg": {
      const a = run(n.a, vars);
      return a == null ? null : -a;
    }
    case "bin": {
      const a = run(n.a, vars);
      const b = run(n.b, vars);
      if (a == null || b == null) return null;
      switch (n.op) {
        case "+": return a + b;
        case "-": return a - b;
        case "*": return a * b;
        case "/": return b === 0 ? null : a / b;
        case "^": return Math.pow(a, b);
      }
      return null;
    }
    case "fn": {
      const args: number[] = [];
      for (const a of n.args) {
        const v = run(a, vars);
        if (v == null) return null;
        args.push(v);
      }
      return FUNCTIONS[n.name].fn(...args);
    }
  }
}

/**
 * Calcula a fórmula. `vars` usa os códigos dos parâmetros (qualquer caixa).
 * Devolve value=null quando falta algum valor, há divisão por zero ou o resultado não é um número real.
 */
export function evaluateFormula(formula: string, vars: Record<string, number | null | undefined>): FormulaResult {
  try {
    const upper: Record<string, number | null | undefined> = {};
    for (const [k, v] of Object.entries(vars)) upper[norm(k)] = v;
    const v = run(parse(formula), upper);
    return { value: v != null && Number.isFinite(v) ? v : null };
  } catch (e) {
    return { value: null, error: e instanceof Error ? e.message : "Fórmula inválida" };
  }
}

/** Formata com N casas decimais (ponto decimal, igual ao restante do sistema). */
export function formatCalculated(n: number, decimals: number | null | undefined): string {
  const d = decimals == null ? 2 : Math.min(6, Math.max(0, Math.round(decimals)));
  const out = n.toFixed(d);
  return out === "-0" || /^-0(\.0+)?$/.test(out) ? out.slice(1) : out;
}

/**
 * Procura dependência circular entre campos calculados (A usa B e B usa A).
 * Retorna os códigos do ciclo, ou null se não houver.
 */
export function findFormulaCycle(params: { code: string | null; formula: string | null }[]): string[] | null {
  const deps = new Map<string, string[]>();
  for (const p of params) {
    if (!p.code || !p.formula?.trim()) continue;
    try {
      deps.set(norm(p.code), formulaVariables(p.formula));
    } catch {
      /* fórmula inválida: tratada em validateFormula */
    }
  }
  const state = new Map<string, 1 | 2>(); // 1 = visitando, 2 = concluído
  const stack: string[] = [];
  const visit = (c: string): string[] | null => {
    if (state.get(c) === 2) return null;
    if (state.get(c) === 1) return [...stack.slice(stack.indexOf(c)), c];
    state.set(c, 1);
    stack.push(c);
    for (const d of deps.get(c) ?? []) {
      const cyc = visit(d);
      if (cyc) return cyc;
    }
    stack.pop();
    state.set(c, 2);
    return null;
  };
  for (const c of deps.keys()) {
    const cyc = visit(c);
    if (cyc) return cyc;
  }
  return null;
}
