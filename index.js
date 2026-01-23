import { abrirNavegador } from "./modules/navegador.js";
import { carregarPlanilha } from "./modules/planilha.js";
import {
  restaurarSessao,
  fazerLogin,
  ensurePaginaEmissao,
} from "./modules/sessao.js";
import { processarAluno } from "./modules/processamento.js";
import { CONFIG as BASE_CONFIG } from "./config.js";
import { logger } from "./modules/logger.js";
import { encerrarAutomacao } from "./modules/controleExecucao.js";

let browser = null;
let running = false; // indica se a automação está rodando
let shouldStop = false; // usado para parar via interface

// ===============================
// Helpers de tempo / estatística
// ===============================
function fmtMs(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  if (s >= 1) return `${s}s`;
  return `${ms}ms`;
}

function avg(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function flushSkipped(range, reason = "já processado(s) ou inválido(s)") {
  if (!range) return;
  const { start, end, count } = range;
  if (count === 1) {
    logger.info(`⏭️  Pulando aluno no índice ${start}: ${reason}.`);
  } else {
    logger.info(
      `⏭️  Pulando alunos do índice ${start} ao ${end} (${count} itens): ${reason}.`,
    );
  }
}

// ===============================
// Função PRINCIPAL (UI chama isso)
// ===============================
export async function startAutomation(overrideConfig = {}) {
  if (running) {
    logger.warn("⚠️ Automação já está em execução.");
    return;
  }

  running = true;
  shouldStop = false;

  // ✅ Config final (base + UI)
  const runtimeConfig = {
    ...BASE_CONFIG,
    ...overrideConfig,
  };

  try {
    logger.info("🤖 Automação iniciada via interface gráfica.");

    // ✅ valida credenciais (agora vêm da interface)
    if (!runtimeConfig.USERNAME || !runtimeConfig.PASSWORD) {
      throw new Error(
        "Credenciais não informadas pela interface (USERNAME/PASSWORD).",
      );
    }

    // ✅ usa a planilha vinda da UI (ou a padrão)
    const alunos = carregarPlanilha(runtimeConfig.FATURAMENTO_FIMCA);

    const { browser: br, page } = await abrirNavegador();
    browser = br;

    // ✅ passa runtimeConfig para as funções de sessão
    const statusSessao = await restaurarSessao(page, runtimeConfig);
    if (statusSessao !== "restaurada") {
      await fazerLogin(page, runtimeConfig);
    }

    // ✅ garante emissão usando runtimeConfig (URL, verbose etc.)
    await ensurePaginaEmissao(page, "início da execução", runtimeConfig);

    const IGNORAR = runtimeConfig.IGNORAR_STATUS ?? ["SIM", "DUPLICADO"];

    const pendentesTotal = alunos.filter((a) => {
      if (!a || typeof a !== "object") return false;
      const st = a.PROCESSADO?.toString().trim().toUpperCase();
      return !IGNORAR.includes(st);
    }).length;

    const stats = {
      startedAt: Date.now(),
      attempted: 0,
      success: 0,
      failure: 0,
      durations: [],
    };

    logger.info(`📊 Pendentes para processar: ${pendentesTotal}`);

    let skipRange = null;

    for (let index = 0; index < alunos.length; index++) {
      if (shouldStop) {
        logger.warn("🛑 Automação interrompida pela interface.");
        break;
      }

      const aluno = alunos[index];
      const status = aluno?.PROCESSADO?.toString().trim().toUpperCase();
      const ignorar = IGNORAR.includes(status);
      const invalido = !aluno || typeof aluno !== "object";

      if (invalido || ignorar) {
        if (!skipRange) {
          skipRange = { start: index, end: index, count: 1 };
        } else if (index === skipRange.end + 1) {
          skipRange.end = index;
          skipRange.count++;
        } else {
          flushSkipped(skipRange);
          skipRange = { start: index, end: index, count: 1 };
        }
        continue;
      } else if (skipRange) {
        flushSkipped(skipRange);
        skipRange = null;
      }

      const t0 = Date.now();
      let ok = false;

      try {
        ok = await processarAluno(
          page,
          aluno,
          index,
          alunos,
          runtimeConfig.FATURAMENTO_FIMCA,
        );
      } catch {
        ok = false;
      }

      const elapsed = Date.now() - t0;
      stats.attempted++;
      ok ? stats.success++ : stats.failure++;
      stats.durations.push(elapsed);

      const media = avg(stats.durations);
      const restantes = Math.max(pendentesTotal - stats.attempted, 0);

      logger.info(
        `⏱️ ${fmtMs(elapsed)} | média ${fmtMs(media)} | restantes ${restantes}`,
      );
    }

    logger.info("🚀 Automação finalizada.");
  } catch (error) {
    logger.error(
      `❌ Erro inesperado: ${error.stack || error.message || error}`,
    );
  } finally {
    if (browser) {
      logger.info("🛑 Fechando navegador...");
      await browser.close();
      browser = null;
    }
    running = false;
    logger.info("✅ Execução encerrada.");

    // ✅ avisa o server para salvar/renomear a planilha final
    try {
      if (typeof global.onAutomationFinished === "function") {
        global.onAutomationFinished();
      }
    } catch {
      // não interrompe encerramento
    }
  }
}

// ===============================
// Função para PARAR via UI
// ===============================
export async function stopAutomation() {
  if (!running) {
    logger.warn("⚠️ Nenhuma automação em execução.");
    return;
  }

  logger.warn("⚠️ Preparando para encerrar a automação com segurança...");
  shouldStop = true;
}

// ===============================
// Segurança extra
// ===============================
process.on("uncaughtException", (error) => {
  logger.error(`❌ Erro fatal não tratado: ${error.stack}`);
  encerrarAutomacao(error.stack);
});
