// index.js (Arquivo principal)
import { abrirNavegador } from "./modules/navegador.js";
import { carregarPlanilha } from "./modules/planilha.js";
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
let ultimoProcessado = null; // Guarda o ultimo aluno processado com sucesso

(async () => {
  try {
    logger.info("🤖 Iniciando automação...");

    // Carregar a planilha
    const alunos = carregarPlanilha(CONFIG.FATURAMENTO_FIMCA);

    // Abrir navegador
    const navegador = await abrirNavegador();
    browser = navegador.browser;
    const { page } = navegador;

    // Restaurar sessão ou fazer login (função agora retorna string de status)
    const statusSessao = await restaurarSessao(page);
    if (statusSessao !== "restaurada") {
      await fazerLogin(page);
    }
    // Garante explicitamente a tela certa (mesmo se já "parecer" ok)
    await ensurePaginaEmissao(page, "início da execução");

    if (CONFIG.VERBOSE) {
      logger.info("✅ Página correta carregada para emissão de notas.");
    }

    if (CONFIG.TEST_MODE) {
      const index = alunos.findIndex((a) => {
        if (!a || typeof a !== "object") return false;
        const status = a.PROCESSADO?.toString().trim().toUpperCase();
        return status !== "SIM" && status !== "DUPLICADO";
      });

      if (index === -1) {
        logger.warn("⚠️ Nenhum aluno pendente de processamento encontrado.");
      } else {
        const aluno = alunos[index];
        logger.info(
          `🧪 Modo de Teste Ativado! Processando apenas: ${aluno.ALUNO}`
        );

        await processarAluno(
          page,
          aluno,
          index,
          alunos,
          CONFIG.FATURAMENTO_FIMCA
        );
      }
    } else {
      // Loop padrão para todos os alunos
      for (let index = 0; index < alunos.length; index++) {
        const aluno = alunos[index];

        const status = aluno.PROCESSADO?.toString().trim().toUpperCase();
        const jaProcessado = status === "SIM" || status === "DUPLICADO";
        const invalido = !aluno || typeof aluno !== "object";
        if (invalido || jaProcessado) {
          logger.info(
            `⏭️  Pulando aluno no índice ${index}: já processado ou inválido.`
          );
          continue;
        }

        await processarAluno(
          page,
          aluno,
          index,
          alunos,
          CONFIG.FATURAMENTO_FIMCA
        );
      }
    }

    logger.info("🚀 Automação finalizada!");
  } catch (error) {
    logger.error(`❌ Erro inesperado: ${error.stack}`);
  } finally {
    if (browser) {
      logger.info("🛑 Fechando navegador...");
      await browser.close(); //Fecha o navegador ao finalizar todos os alunos
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
  logger.warn("⚠️ Execução interrompida manualmente (CTRL+C)");

  try {
    if (global.ultimoProcessado) {
      const { alunos, index } = global.ultimoAlunoProcessadoComSucesso;
      logger.info("📝 Atualizando planilha antes de encerrar...");
      atualizarAlunoNaPlanilha(alunos, index);
    }

    if (browser) {
      logger.info("🛑 Fechando navegador...");
      await browser.close();
    }
  } catch (err) {
    logger.error(`❌ Erro ao encerrar com segurança: ${err.message}`);
  }

  logger.info("✅ Execução encerrada com segurança.");
  process.exit(0);
});
