// modules/controleExecucao.js
import { logger } from "./logger.js";

/**
 * Encerra a automação imediatamente por erro crítico.
 * @param {string} motivo - Mensagem explicando o motivo da interrupção.
 */
export function encerrarAutomacao(motivo = "Erro não especificado") {
  logger.error(`🛑🛑🛑 Execução encerrada por erro crítico: ${motivo}`);
  process.exit(1); // Encerra com código de erro
}
