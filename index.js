// index.js (Arquivo principal)
import { abrirNavegador } from "./modules/navegador.js";
import {
  carregarPlanilha,
  atualizarAlunoNaPlanilha,
} from "./modules/planilha.js";
import {
  restaurarSessao,
  fazerLogin,
  ensurePaginaEmissao,
} from "./modules/sessao.js";
import { processarAluno } from "./modules/processamento.js";
import { CONFIG } from "./config.js";
import { logger } from "./modules/logger.js";
import { encerrarAutomacao } from "./modules/controleExecucao.js";

let browser; // Variável global para armazenar o navegador

// === Helpers de tempo/estatística ===
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

// 👉 helper para compactar logs de “pulados”
function flushSkipped(
  logger,
  range,
  reason = "já processado(s) ou inválido(s)"
) {
  if (!range) return;
  const { start, end, count } = range;
  if (count === 1) {
    logger.info(`⏭️  Pulando aluno no índice ${start}: ${reason}.`);
  } else {
    logger.info(
      `⏭️  Pulando alunos do índice ${start} ao ${end} (${count} itens): ${reason}.`
    );
  }
}

(async () => {
  try {
    logger.info("🤖 Iniciando automação...");

    // Carregar a planilha
    const alunos = carregarPlanilha(CONFIG.FATURAMENTO_FIMCA);

    // Abrir navegador
    const { browser: br, page } = await abrirNavegador();
    browser = br;

    // Restaurar sessão ou fazer login
    const statusSessao = await restaurarSessao(page);
    if (statusSessao !== "restaurada") {
      await fazerLogin(page);
    }
    // Garante explicitamente a tela certa
    await ensurePaginaEmissao(page, "início da execução");

    if (CONFIG.VERBOSE) {
      logger.info("✅ Página correta carregada para emissão de notas.");
    }

    // === Estatísticas de execução ===
    const IGNORAR = CONFIG.IGNORAR_STATUS ?? ["SIM", "DUPLICADO"];
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
      durations: [], // ms por aluno tentado (sucesso ou falha)
    };

    logger.info(`📊 Pendentes para processar: ${pendentesTotal} registros.`);

    if (CONFIG.TEST_MODE) {
      const index = alunos.findIndex((a) => {
        if (!a || typeof a !== "object") return false;
        const status = a.PROCESSADO?.toString().trim().toUpperCase();
        return !IGNORAR.includes(status);
      });

      if (index === -1) {
        logger.warn("⚠️ Nenhum aluno pendente de processamento encontrado.");
      } else {
        const aluno = alunos[index];
        logger.info(
          `🧪 Modo de Teste Ativado! Processando apenas: ${aluno.ALUNO}`
        );

        const t0 = Date.now();
        let ok = false;
        try {
          ok = await processarAluno(
            page,
            aluno,
            index,
            alunos,
            CONFIG.FATURAMENTO_FIMCA
          );
        } catch {
          ok = false;
        }
        const elapsed = Date.now() - t0;

        stats.attempted += 1;
        if (ok) stats.success += 1;
        else stats.failure += 1;
        stats.durations.push(elapsed);

        logger.info(
          `⏱️  Tempo deste aluno (TEST_MODE): ${fmtMs(
            elapsed
          )} | média: ${fmtMs(avg(stats.durations))} | restantes: 0 | ETA: 0ms`
        );
      }
    } else {
      // ===== Loop padrão para todos os alunos (com compactação de “pulados”) =====
      if (typeof global._skipRange === "undefined") {
        global._skipRange = null; // { start, end, count }
      }

      for (let index = 0; index < alunos.length; index++) {
        const aluno = alunos[index];

        const status = aluno?.PROCESSADO?.toString().trim().toUpperCase();
        const ignorar = IGNORAR.includes(status);
        const invalido = !aluno || typeof aluno !== "object";

        // ---- compactação de logs de pulados ----
        if (invalido || ignorar) {
          if (!global._skipRange) {
            global._skipRange = { start: index, end: index, count: 1 };
          } else if (index === global._skipRange.end + 1) {
            global._skipRange.end = index;
            global._skipRange.count += 1;
          } else {
            // intervalo anterior terminou; registra e inicia um novo
            flushSkipped(logger, global._skipRange);
            global._skipRange = { start: index, end: index, count: 1 };
          }
          continue; // pula este aluno
        } else {
          // ao encontrar um aluno válido, descarrega possíveis pulados anteriores
          if (global._skipRange) {
            flushSkipped(logger, global._skipRange);
            global._skipRange = null;
          }
        }

        // ---- temporizador por aluno válido tentado ----
        const t0 = Date.now();
        let ok = false;
        try {
          ok = await processarAluno(
            page,
            aluno,
            index,
            alunos,
            CONFIG.FATURAMENTO_FIMCA
          );
        } catch {
          ok = false;
        }
        const elapsed = Date.now() - t0;

        stats.attempted += 1;
        if (ok) stats.success += 1;
        else stats.failure += 1;
        stats.durations.push(elapsed);

        // média e ETA (com base nos pendentes restantes)
        const media = avg(stats.durations);
        const restantes = Math.max(pendentesTotal - stats.attempted, 0);
        const etaMs = media * restantes;

        logger.info(
          `⏱️  Tempo deste aluno: ${fmtMs(elapsed)} | ` +
            `média: ${fmtMs(media)} | ` +
            `restantes: ${restantes} | ` +
            `ETA: ${fmtMs(etaMs)}`
        );
      }

      // após o laço, pode ter ficado um range pendente
      if (global._skipRange) {
        flushSkipped(logger, global._skipRange);
        global._skipRange = null;
      }
    }

    // === Resumo final ===
    const totalMs = Date.now() - stats.startedAt;
    const mediaFinal = avg(stats.durations);
    logger.info(
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    );
    logger.info(
      `📈 Resumo: tentados=${stats.attempted}, ✅=${stats.success}, ❌=${stats.failure}`
    );
    logger.info(
      `⏱️  Tempo total: ${fmtMs(totalMs)} | média por aluno: ${fmtMs(
        mediaFinal
      )}`
    );
    logger.info(
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    );

    logger.info("🚀 Automação finalizada!");
  } catch (error) {
    logger.error(`❌ Erro inesperado: ${error.stack}`);
  } finally {
    if (browser) {
      logger.info("🛑 Fechando navegador...");
      await browser.close(); // Fecha o navegador ao finalizar todos os alunos
    }
    logger.info("✅ Execução encerrada.");
  }
})();

// 🔥 Capturar erros fatais
process.on("uncaughtException", (error) => {
  logger.error(`❌ Erro fatal não tratado: ${error.stack}`);
  encerrarAutomacao(error.stack);
});

// 🛑 Capturar interrupção manual (CTRL+C)
process.on("SIGINT", async () => {
  logger.warn("⚠️  Execução interrompida manualmente (CTRL+C)");

  try {
    if (global.ultimoProcessado) {
      const { alunos, index } = global.ultimoProcessado;
      logger.info("📝 Atualizando planilha antes de encerrar...");
      atualizarAlunoNaPlanilha(alunos, index);
    }

    if (browser) {
      logger.info("🛑 Fechando navegador...");
      logger.info(
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      );
      await browser.close();
    }
  } catch (err) {
    logger.error(`❌ Erro ao encerrar com segurança: ${err.message}`);
  }

  logger.info("✅ Execução encerrada com segurança.");
  process.exit(0);
});
