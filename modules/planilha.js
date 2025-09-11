// planilha.js (Carregamento e atualização da planilha)
import xlsx from "xlsx";
import { logger } from "../modules/logger.js";
import readline from "readline";
import path from "path";
import { encerrarAutomacao } from "./controleExecucao.js";
import { CONFIG } from "../config.js";

let workbookGlobal;
let caminhoGlobal;

/**
 * 🔍 Verifica duplicatas na planilha com base nos campos relevantes
 * Compara ALUNO, CPF e VALOR/B.C ISS
 */
function marcarDuplicatas(alunos) {
  const registrosUnicos = new Set();
  let duplicatasEncontradas = false;

  alunos.forEach((aluno, index) => {
    // Cria uma chave única com os campos usados na emissão
    const valor =
      aluno["B.C ISS"] ||
      aluno["VALOR"] ||
      aluno["VALOR NF"] ||
      aluno["VALORORIGINAL"];
    const chave = `${aluno.ALUNO?.trim()}|${aluno.CPF?.trim()}|${valor}`;

    if (registrosUnicos.has(chave)) {
      aluno.PROCESSADO = "DUPLICADO";
      logger.warn(
        `⚠️ Registro duplicado encontrado no índice ${index}: ${aluno.ALUNO}`
      );
      duplicatasEncontradas = true;
    } else {
      registrosUnicos.add(chave);
    }
  });

  if (duplicatasEncontradas) {
    logger.warn(
      "⚠️ Alguns registros foram marcados como 'DUPLICADO' e serão ignorados na automação."
    );
  }
}

// 📥 Carrega e processa a planilha
export function carregarPlanilha(caminho) {
  logger.info("📂 Carregando planilha...");

  // Lê o arquivo da planilha com base no caminho fornecido
  const workbook = xlsx.readFile(caminho);

  // Obtém a primeira aba da planilha
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  // Carrega todos os registros, mesmo com campos vazios
  let alunos = xlsx.utils.sheet_to_json(sheet, { defval: "" });

  // Filtra apenas registros válidos que possuam ALUNO e CPF
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

  // Salva caminho e referência da planilha em variáveis globais
  caminhoGlobal = caminho;
  workbookGlobal = workbook;

  // Verifica se é necessário adicionar coluna 'PROCESSADO'
  let planilhaAtualizada = false;

  // Garante a existência da coluna PROCESSADO
  for (let aluno of alunos) {
    if (!("PROCESSADO" in aluno)) {
      aluno.PROCESSADO = "NÃO";
      planilhaAtualizada = true;
    }
  }

  // Marca duplicatas com base nos campos relevantes
  // marcarDuplicatas(alunos);

  // Reescreve a planilha se tiver sido modificada
  if (planilhaAtualizada) {
    marcarDuplicatas(alunos);
    const newSheet = xlsx.utils.json_to_sheet(alunos, { skipHeader: false });
    workbook.Sheets[workbook.SheetNames[0]] = newSheet;
    xlsx.writeFile(workbook, caminho);
    if (CONFIG.VERBOSE) {
      logger.info("✅ Coluna 'PROCESSADO' adicionada na planilha.");
    }
  }

  logger.info("✅ Planilha carregada com sucesso!");

  return alunos;
}

// 🖊️ Marca um aluno como PROCESSADO
export function atualizarAlunoNaPlanilha(alunos, index) {
  if (!workbookGlobal || !caminhoGlobal) {
    logger.error("❌ Workbook ou caminho da planilha NÃO definidos.");
    return;
  }

  // Valida índice recebido
  if (typeof index !== "number" || index < 0 || index >= alunos.length) {
    logger.error(
      `❌ Índice ${index} fora dos limites da planilha (tamanho: ${alunos.length}).`
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
        aluno
      )}`
    );
    return;
  }

  // Marca o aluno como PROCESSADO
  aluno.PROCESSADO = "SIM";

  try {
    const newSheet = xlsx.utils.json_to_sheet(alunos, { skipHeader: false });
    workbookGlobal.Sheets[workbookGlobal.SheetNames[0]] = newSheet;
    xlsx.writeFile(workbookGlobal, caminhoGlobal);

    logger.info(
      `💾 Aluno(a) "${
        aluno.ALUNO || "[sem nome]"
      }" marcado como PROCESSADO na planilha!`
    );
  } catch (error) {
    // ❌ Destaque visual para erro

    logger.error(
      `💾❌ ERRO ao salvar planilha para aluno "${aluno.ALUNO || "[sem nome]"}"`
    );
    logger.error(`🔎 Detalhes: ${error.message}`);

    encerrarAutomacao("Falha ao salvar na planilha.");
  }
}

// 🔧 Modo de teste interativo
if (process.argv[1].endsWith("planilha.js")) {
  const caminho = path.resolve("./Docs/TestePlanilhaJS.xlsx");
  const alunos = carregarPlanilha(caminho);

  console.log("\n✅ Alunos carregados:");
  alunos.forEach((aluno, i) => {
    console.log(
      `${i.toString().padStart(3, "0")} - ${aluno.ALUNO} (${aluno.CPF}) - ${
        aluno.PROCESSADO
      }`
    );
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question(
    "\nDigite o índice do aluno que deseja marcar como PROCESSADO: ",
    (indice) => {
      const idx = parseInt(indice);
      if (!isNaN(idx)) {
        atualizarAlunoNaPlanilha(alunos, idx);
      } else {
        console.error("❌ Índice inválido.");
      }
      rl.close();
    }
  );
}
