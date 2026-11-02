// Gerador de código de barras Code 128 (o padrão da maioria dos leitores e impressoras de etiqueta).
// Sem dependências. Para textos só com dígitos e tamanho par usa o subconjunto C (2 dígitos por símbolo,
// bem mais compacto, ideal para os 10 dígitos do código da amostra); senão usa o subconjunto B.

// Larguras (barra, espaço, barra, espaço, barra, espaço) de cada símbolo, valores 0..105; o 106 (parada) tem 7 elementos.
const PATTERNS = [
  "212222","222122","222221","121223","121322","131222","122213","122312","132212","221213",
  "221312","231212","112232","122132","122231","113222","123122","123221","223211","221132",
  "221231","213212","223112","312131","311222","321122","321221","312212","322112","322211",
  "212123","212321","232121","111323","131123","131321","112313","132113","132311","211313",
  "231113","231311","112133","112331","132131","113123","113321","133121","313121","211331",
  "231131","213113","213311","213131","311123","311321","331121","312113","312311","332111",
  "314111","221411","431111","111224","111422","121124","121421","141122","141221","112214",
  "112412","122114","122411","142112","142211","241211","221114","413111","241112","134111",
  "111242","121142","121241","114212","124112","124211","411212","421112","421211","212141",
  "214121","412121","111143","111341","131141","114113","114311","411113","411311","113141",
  "114131","311141","411131","211412","211214","211232","2331112",
];

const START_B = 104;
const START_C = 105;
const STOP = 106;

/** Valores (índices) dos símbolos, incluindo início, dígito verificador e parada. */
export function code128Values(text: string): number[] {
  if (!text) throw new Error("Texto vazio");
  const values: number[] = [];
  if (/^\d+$/.test(text) && text.length % 2 === 0) {
    values.push(START_C);
    for (let i = 0; i < text.length; i += 2) values.push(Number(text.slice(i, i + 2)));
  } else {
    values.push(START_B);
    for (const ch of text) {
      const code = ch.charCodeAt(0);
      if (code < 32 || code > 126) throw new Error(`Caractere não suportado no código de barras: "${ch}"`);
      values.push(code - 32);
    }
  }
  let sum = values[0];
  for (let i = 1; i < values.length; i++) sum += values[i] * i;
  values.push(sum % 103);
  values.push(STOP);
  return values;
}

/** Sequência de larguras em módulos, alternando barra/espaço, começando por barra. */
export function code128Modules(text: string): number[] {
  const out: number[] = [];
  for (const v of code128Values(text)) for (const c of PATTERNS[v]) out.push(Number(c));
  return out;
}

/** Largura total do código em módulos (sem a zona de silêncio). */
export function code128Width(text: string): number {
  return code128Modules(text).reduce((a, b) => a + b, 0);
}
