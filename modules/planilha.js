// planilha.js (Carregamento e atualização da planilha)
import xlsx from "xlsx";
import { logger } from "../modules/logger.js";
import { encerrarAutomacao } from "./controleExecucao.js";
import { CONFIG } from "../config.js";

let workbookGlobal;
let caminhoGlobal;
let sheetNameGlobal;

// ✅ Coluna de valor detectada automaticamente (última coluna do cabeçalho)
let colunaValorDetectada = null;

function getHeaderMap(sheet) {
  const rows = xlsx.utils.sheet_to_json(sheet, {
    header: 1,
    blankrows: false,
  });
  const headerRow = rows[0] || [];
  const map = new Map(); // header -> colIndex
  headerRow.forEach((h, i) => map.set(String(h ?? "").trim(), i));
  return { map, headerRow };
}

// ✅ Parser único de moeda/valor (aceita "R$ 1.781,50", "1781,50", "1.781,50", etc.)
function parseMoney(v) {
  if (v === undefined || v === null || v === "") return NaN;

  let s = v.toString().trim();

  // remove "R$", espaços e caracteres não numéricos (mantém . , e -)
  s = s.replace(/[R$\s]/g, "");
  s = s.replace(/[^0-9,.\-]/g, "");

  if (!s) return NaN;

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  // Caso 1: tem vírgula e ponto -> decide decimal pelo último separador
  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");

    if (lastDot > lastComma) {
      // Formato tipo 9,754.71 -> vírgula milhar, ponto decimal
      s = s.replace(/,/g, "");
      // ponto fica como decimal
    } else {
      // Formato tipo 9.754,71 -> ponto milhar, vírgula decimal
      s = s.replace(/\./g, "");
      s = s.replace(/,/g, ".");
    }
  } else if (hasComma && !hasDot) {
    // Caso 2: só vírgula -> assume vírgula decimal (BR)
    s = s.replace(/,/g, ".");
  } else {
    // Caso 3: só ponto ou nenhum -> assume ponto decimal (ok)
    // não mexe
  }

  const n = parseFloat(s);
  return Number.isNaN(n) ? NaN : n;
}

/**
 * ✅ Obtém a última coluna preenchida no cabeçalho da planilha
 * (Regra: a última coluna é a coluna do valor da mensalidade)
 */
function getUltimaColuna(sheet) {
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
  const headerRow = rows[0] || [];

  for (let i = headerRow.length - 1; i >= 0; i--) {
    const h = String(headerRow[i] ?? "").trim();
    if (!h) continue;

    // ✅ nunca usar PROCESSADO como coluna de valor
    if (h.toUpperCase() === "PROCESSADO") continue;

    return h;
  }

  return null;
}

/**
 * 🔢 Extrai e normaliza o valor numérico da planilha (primeira coluna válida)
 * Suporta pontos de milhar e vírgula decimal.
 */
function extrairValorNumerico(aluno) {
  // ✅ Se já temos valor canônico, usa ele
  if (
    typeof aluno?.__VALOR_NUM === "number" &&
    !Number.isNaN(aluno.__VALOR_NUM)
  ) {
    return {
      ok: true,
      valor: aluno.__VALOR_NUM,
      coluna: aluno.__COLUNA_VALOR || "AUTO",
    };
  }

  const colunas = ["B.C NF", "B.C ISS", "VALOR", "VALOR NF", "VALOR ISS"];

  // ✅ conversão mais tolerante: aceita "R$ 1.781,50", espaços, etc.
  const toNumber = (v) => {
    if (v === undefined || v === null || v === "") return NaN;
    const n = parseFloat(
      v
        .toString()
        .replace(/[R$\s]/g, "")
        .replace(/\./g, "")
        .replace(",", "."),
    );
    return Number.isNaN(n) ? NaN : n;
  };

  // ✅ PRIORIDADE: usar a última coluna do cabeçalho (quando detectada)
  if (colunaValorDetectada && colunaValorDetectada in aluno) {
    const bruto = aluno[colunaValorDetectada];
    const numerico = toNumber(bruto);

    if (!Number.isNaN(numerico)) {
      return { ok: true, valor: numerico, coluna: colunaValorDetectada };
    }

    return {
      ok: false,
      motivo: `valor inválido na coluna "${colunaValorDetectada}"`,
      coluna: colunaValorDetectada,
    };
  }

  // Fallback: colunas fixas conhecidas
  for (const c of colunas) {
    const bruto = aluno[c];
    if (bruto !== undefined && bruto !== null && bruto !== "") {
      const numerico = toNumber(bruto);
      if (!Number.isNaN(numerico)) {
        return { ok: true, valor: numerico, coluna: c };
      }
      return {
        ok: false,
        motivo: `valor inválido na coluna "${c}"`,
        coluna: c,
      };
    }
  }

  return { ok: false, motivo: "nenhuma coluna de valor encontrada" };
}

function ensureProcessadoColumn(sheet) {
  const ref = sheet["!ref"];
  const range = xlsx.utils.decode_range(ref);
  const { map } = getHeaderMap(sheet);

  if (map.has("PROCESSADO")) {
    return map.get("PROCESSADO");
  }

  // cria a coluna PROCESSADO ao final
  const newCol = range.e.c + 1;
  const addr = xlsx.utils.encode_cell({ r: range.s.r, c: newCol });
  sheet[addr] = { t: "s", v: "PROCESSADO" };

  // expande o range
  range.e.c = newCol;
  sheet["!ref"] = xlsx.utils.encode_range(range);

  return newCol;
}

function writeProcessadoCell(sheet, rowIndex1Based, value) {
  const col = ensureProcessadoColumn(sheet);
  const addr = xlsx.utils.encode_cell({ r: rowIndex1Based - 1, c: col });
  sheet[addr] = value === "" ? undefined : { t: "s", v: String(value) };
}

/** (opcional) duplicatas — mantenha se fizer sentido no seu fluxo */
function marcarDuplicatas(alunos) {
  const registrosUnicos = new Set();
  let duplicatasEncontradas = false;

  alunos.forEach((aluno, index) => {
    const valor =
      aluno["B.C ISS"] ||
      aluno["VALOR"] ||
      aluno["VALOR NF"] ||
      aluno["VALORORIGINAL"];
    const chave = `${aluno.ALUNO?.trim()}|${aluno.CPF?.trim()}|${valor}`;

    if (registrosUnicos.has(chave)) {
      const statusAtual = aluno.PROCESSADO?.toString().trim().toUpperCase();
      if (statusAtual !== "SIM") {
        aluno.PROCESSADO = "DUPLICADO";
      }
      logger.warn(
        `⚠️ Registro duplicado encontrado no índice ${index}: ${aluno.ALUNO}`,
      );
      duplicatasEncontradas = true;
    } else {
      registrosUnicos.add(chave);
    }
  });

  if (duplicatasEncontradas) {
    logger.warn(
      "⚠️ Alguns registros foram marcados como 'DUPLICADO' e serão ignorados na automação.",
    );
  }
}

/** =========================
 *  Normalização na 1ª execução
 *  ========================= */
function normalizarPrimeiraVez(workbook, sheetName, alunos) {
  // Colunas essenciais definidas no CONFIG (ordem fixa)
  let cols = Array.isArray(CONFIG.COLUNAS_ESSENCIAIS)
    ? CONFIG.COLUNAS_ESSENCIAIS.slice()
    : [];

  // fallback seguro: se não configurar, preserva tudo e só garante PROCESSADO no fim
  if (cols.length === 0) {
    const sheet = workbook.Sheets[sheetName];
    const { headerRow } = getHeaderMap(sheet);
    cols = headerRow.filter(Boolean);
  }

  // garante PROCESSADO no fim e sem duplicar
  cols = cols.filter((h) => h && h !== "PROCESSADO");
  cols.push("PROCESSADO");

  // ✅ Garante que a coluna do valor detectada (ex: "LIQU") não seja perdida na normalização
  if (colunaValorDetectada && !cols.includes(colunaValorDetectada)) {
    // insere antes do PROCESSADO (última coluna)
    cols.splice(cols.length - 1, 0, colunaValorDetectada);
  }

  // monta objetos "enxutos" só com as colunas essenciais, na ordem desejada
  const enxutos = alunos.map((a) => {
    const obj = {};
    for (const h of cols) {
      obj[h] = a[h] ?? "";
    }
    return obj;
  });

  // cria sheet controlada (agora é seguro usar json_to_sheet)
  const newSheet = xlsx.utils.json_to_sheet(enxutos, {
    header: cols,
    skipHeader: false,
  });
  workbook.Sheets[sheetName] = newSheet;

  // retorna os dados já normalizados (útil para manter processamentos posteriores consistentes)
  return enxutos;
}

/** =========================
 *  Carga e classificação
 *  ========================= */
export function carregarPlanilha(caminho) {
  logger.info("📂 Carregando planilha...");

  const workbook = xlsx.readFile(caminho);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // ✅ Detecta a coluna do valor pela última coluna do cabeçalho
  colunaValorDetectada = getUltimaColuna(sheet);
  if (colunaValorDetectada) {
    logger.warn(
      `ℹ️ Coluna de valor definida como última coluna: "${colunaValorDetectada}"`,
    );
  } else {
    logger.error(
      "❌ Não foi possível detectar a coluna de valor (última coluna válida).",
    );
  }

  // Carrega todos os registros, mesmo com campos vazios
  let alunos = xlsx.utils.sheet_to_json(sheet, { defval: "" });

  // Filtra apenas registros com ALUNO e CPF
  alunos = alunos.filter((a) => {
    return (
      typeof a === "object" &&
      a !== null &&
      !Array.isArray(a) &&
      Object.keys(a).length >= 2 &&
      a.ALUNO &&
      a.CPF
    );
  });

  // ✅ Define valor canônico baseado na última coluna detectada (ex: "LIQU")
  for (let aluno of alunos) {
    aluno.__COLUNA_VALOR = colunaValorDetectada;
    aluno.__VALOR_BRUTO = colunaValorDetectada
      ? aluno[colunaValorDetectada]
      : "";
    aluno.__VALOR_NUM = parseMoney(aluno.__VALOR_BRUTO);
  }

  // Persistentes globais
  caminhoGlobal = caminho;
  workbookGlobal = workbook;
  sheetNameGlobal = sheetName;

  // Detecta se a planilha já possuía PROCESSADO no cabeçalho
  const { map } = getHeaderMap(sheet);
  const primeiraVez = !map.has("PROCESSADO");

  // 1) Garante PROCESSADO
  if (primeiraVez) {
    for (let aluno of alunos) {
      aluno.PROCESSADO = "NÃO";
    }
  } else {
    for (let aluno of alunos) {
      if (
        !("PROCESSADO" in aluno) ||
        aluno.PROCESSADO == null ||
        aluno.PROCESSADO === ""
      ) {
        aluno.PROCESSADO = "NÃO";
      }
    }
  }

  // 2) Classifica ZERADO/INVALIDO (sem sobrescrever SIM/DUPLICADO)
  for (let aluno of alunos) {
    const status = aluno.PROCESSADO?.toString().trim().toUpperCase();
    if (status === "SIM" || status === "DUPLICADO") continue;

    const info = extrairValorNumerico(aluno);
    if (!info.ok) {
      aluno.PROCESSADO = "INVALIDO";
      continue;
    }

    if (info.valor === 0) {
      aluno.PROCESSADO = "ZERADO";
    }
  }

  // 3) (Opcional) marca duplicatas
  // marcarDuplicatas(alunos);

  try {
    // ✅ Sempre preserva o layout original.
    // Só garante a coluna PROCESSADO e grava os valores por célula.
    const currentSheet = workbook.Sheets[sheetName];

    // garante a coluna PROCESSADO existir
    ensureProcessadoColumn(currentSheet);

    // escreve PROCESSADO por célula
    for (let i = 0; i < alunos.length; i++) {
      const row1 = 2 + i; // mesma lógica que você já usava
      const v = alunos[i]?.PROCESSADO ?? "";
      writeProcessadoCell(currentSheet, row1, v);
    }

    xlsx.writeFile(workbook, caminho);

    if (CONFIG.VERBOSE) {
      logger.info(
        "✅ Coluna PROCESSADO atualizada (layout original preservado).",
      );
    }
  } catch (e) {
    logger.error("❌ Falha ao salvar a planilha.");
    logger.error(`🔎 Detalhes: ${e.message}`);
    encerrarAutomacao("Falha ao salvar na planilha.");
  }

  logger.info("✅ Planilha carregada com sucesso!");
  return alunos;
}

// 🖊️ Marca um aluno como PROCESSADO
export function atualizarAlunoNaPlanilha(alunos, index) {
  if (!workbookGlobal || !caminhoGlobal || !sheetNameGlobal) {
    logger.error("❌ Workbook/caminho/sheet NÃO definidos.");
    return;
  }

  // Valida índice recebido
  if (typeof index !== "number" || index < 0 || index >= alunos.length) {
    logger.error(
      `❌ Índice ${index} fora dos limites da planilha (tamanho: ${alunos.length}).`,
    );
    return;
  }

  const aluno = alunos[index];

  // Verifica se o registro é um objeto válido
  if (
    typeof aluno !== "object" ||
    aluno === null ||
    Array.isArray(aluno) ||
    Object.keys(aluno).length === 0
  ) {
    logger.error(
      `❌ NÃO foi possível atualizar o aluno no índice ${index}: tipo inválido (${typeof aluno}). Valor: ${JSON.stringify(
        aluno,
      )}`,
    );
    return;
  }

  // Marca o aluno como PROCESSADO
  aluno.PROCESSADO = "SIM";

  try {
    const sheet = workbookGlobal.Sheets[sheetNameGlobal];
    const row1 = 2 + index; // linha 1 = cabeçalho
    writeProcessadoCell(sheet, row1, "SIM");
    xlsx.writeFile(workbookGlobal, caminhoGlobal);

    logger.info(
      `💾 "${aluno.ALUNO || "[sem nome]"}" marcado como PROCESSADO !`,
    );
  } catch (error) {
    logger.error(
      `❌ ERRO ao salvar planilha para aluno "${aluno.ALUNO || "[sem nome]"}"`,
    );
    logger.error(`🔎 Detalhes: ${error.message}`);
    encerrarAutomacao("Falha ao salvar na planilha.");
  }
}
