// notaEmitida.js
import { logger } from "./logger.js";
import { CONFIG } from "../config.js";

export async function registrarInformacoesNota(page) {
  let sucesso = false;

  try {
    // Aguarda o painel aparecer com os dados da nota emitida
    await page.waitForSelector(
      "#formEmissaoNFConvencional\\:j_idt773_content",
      { timeout: 5000 }
    );

    const dadosNota = await page.evaluate(() => {
      const pegaTexto = (label) => {
        const el = Array.from(document.querySelectorAll("label")).find((l) =>
          l.textContent.trim().startsWith(label)
        );
        return el?.nextSibling?.textContent.trim() || "Não encontrado";
      };

      return {
        numero: pegaTexto("Número:"),
        codigoVerificacao: pegaTexto("Código de Verificação:"),
        chaveSeguranca: pegaTexto("Chave de Segurança:"),
        dataEmissao: pegaTexto("Data de Emissão:"),
        horaEmissao: pegaTexto("Hora de Emissão:"),
      };
    });

    // Validação simples dos dados obtidos
    if (
      dadosNota.numero !== "Não encontrado" &&
      dadosNota.codigoVerificacao !== "Não encontrado"
    ) {
      logger.info("🧾 Dados da NFS-e emitida:");
      logger.info(`   • Número: ${dadosNota.numero}`);
      logger.info(`   • Código de Verificação: ${dadosNota.codigoVerificacao}`);
      logger.info(`   • Chave de Segurança: ${dadosNota.chaveSeguranca}`);
      logger.info(`   • Data de Emissão: ${dadosNota.dataEmissao}`);
      logger.info(`   • Hora de Emissão: ${dadosNota.horaEmissao}`);
      sucesso = true;
    } else {
      logger.warn("⚠️ Alguns dados da nota não foram encontrados.");
    }
  } catch (error) {
    logger.warn("⚠️ Não foi possível capturar os dados da NFS-e emitida.");
  }

  // 🔁 Redirecionar de volta à tela de emissão (caso permitido)
  if (!CONFIG.SKIP_CONFIRMATION && !CONFIG.TEST_MODE) {
    try {
      logger.info("↩️ Retornando para a tela de emissão de notas...");

      await new Promise((resolve) => setTimeout(resolve, 1000));

      await page.goto(CONFIG.ISS_JARU, { waitUntil: "domcontentloaded" });

      await page.waitForSelector("#formEmissaoNFConvencional\\:itCpf", {
        visible: true,
        timeout: 5000,
      });

      logger.info("✅ Tela de emissão recarregada com sucesso.");
    } catch (err) {
      const exists = await page.$("#formEmissaoNFConvencional\\:itCpf");
      if (exists) {
        logger.info(
          "✅ Tela de emissão recarregada com sucesso (detected after timeout)."
        );
      } else {
        logger.warn(
          "⚠️ Não foi possível confirmar visualmente o CPF, mas continuando..."
        );
        // Apenas AVISO, mas continua! Não throw, não aborta
      }
    }
  } else {
    logger.warn(
      "⏹️ SKIP_CONFIRMATION ativado ou TEST_MODE: mantendo na tela da nota emitida."
    );
  }

  return sucesso;
}
