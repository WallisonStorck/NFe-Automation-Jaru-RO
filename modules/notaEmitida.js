// // notaEmitida.js
// import { logger } from "./logger.js";
// import { CONFIG } from "../config.js";

// export async function registrarInformacoesNota(page) {
//   let sucesso = false;

//   try {
//     // Aguarda o painel aparecer com os dados da nota emitida
//     await page.waitForSelector(
//       "#formEmissaoNFConvencional\\:j_idt773_content",
//       { timeout: 5000 },
//     );

//     const dadosNota = await page.evaluate(() => {
//       const pegaTexto = (label) => {
//         const el = Array.from(document.querySelectorAll("label")).find((l) =>
//           l.textContent.trim().startsWith(label),
//         );
//         return el?.nextSibling?.textContent.trim() || "Não encontrado";
//       };

//       return {
//         numero: pegaTexto("Número:"),
//         codigoVerificacao: pegaTexto("Código de Verificação:"),
//         chaveSeguranca: pegaTexto("Chave de Segurança:"),
//         dataEmissao: pegaTexto("Data de Emissão:"),
//         horaEmissao: pegaTexto("Hora de Emissão:"),
//       };
//     });

//     // Validação simples dos dados obtidos
//     if (
//       dadosNota.numero !== "Não encontrado" &&
//       dadosNota.codigoVerificacao !== "Não encontrado"
//     ) {
//       logger.info("🧾 Dados da NFS-e emitida:");
//       logger.info(`   • Número: ${dadosNota.numero}`);
//       logger.info(`   • Código de Verificação: ${dadosNota.codigoVerificacao}`);
//       logger.info(`   • Chave de Segurança: ${dadosNota.chaveSeguranca}`);
//       logger.info(`   • Data de Emissão: ${dadosNota.dataEmissao}`);
//       logger.info(`   • Hora de Emissão: ${dadosNota.horaEmissao}`);
//       sucesso = true;
//     } else {
//       logger.warn("⚠️ Alguns dados da nota não foram encontrados.");
//     }
//   } catch (error) {
//     // Verifica se existe alguma mensagem de erro no DOM
//     const erroSistema = await page.$(".ui-messages-error, .alert-error");
//     if (erroSistema) {
//       logger.error(
//         "❌ A emissão da nota falhou (erro reportado pelo sistema).",
//       );
//     } else {
//       logger.warn(
//         "⚠️ Nenhum dado da NFS-e encontrado, pode ser atraso ou falha na emissão!",
//       );
//     }
//   }

//   // 🔁 Redirecionar de volta à tela de emissão (caso permitido)
//   if (!CONFIG.SKIP_CONFIRMATION && !CONFIG.TEST_MODE) {
//     try {
//       logger.info("↩️ Retornando para a tela de emissão de notas...");

//       await new Promise((resolve) => setTimeout(resolve, 1000));

//       await page.goto(CONFIG.ISS_JARU, { waitUntil: "domcontentloaded" });

//       await page.waitForSelector("#formEmissaoNFConvencional\\:itCpf", {
//         visible: true,
//         timeout: 5000,
//       });

//       logger.info("✅ Tela de emissão recarregada com sucesso!");
//     } catch (err) {
//       const exists = await page.$("#formEmissaoNFConvencional\\:itCpf");
//       if (exists) {
//         logger.info(
//           "✅ Tela de emissão recarregada com sucesso (detected after timeout).",
//         );
//       } else {
//         if (CONFIG.VERBOSE) {
//           logger.warn(
//             "⚠️ Não foi possível confirmar visualmente o CPF, mas continuando...",
//           );
//         }
//         // Apenas AVISO, mas continua! Não throw, não aborta
//       }
//     }
//   } else {
//     logger.warn(
//       "⏹️ SKIP_CONFIRMATION ativado ou TEST_MODE: mantendo na tela da nota emitida.",
//     );
//   }

//   return sucesso;
// }

// notaEmitida.js
import { logger } from "./logger.js";
import { CONFIG } from "../config.js";

export async function registrarInformacoesNota(page) {
  let sucesso = false;

  try {
    if (CONFIG.VERBOSE) {
      logger.info("⏳ Aguardando dados da NFS-e emitida aparecerem na tela...");
    }

    // Aguarda até aparecerem os dados essenciais (número e código de verificação)
    await page.waitForFunction(
      () => {
        const getValue = (label) => {
          // procura elementos que começam com "Número:" etc.
          const nodes = Array.from(
            document.querySelectorAll("label, span, td, th, div"),
          ).filter((el) => (el.textContent || "").trim().startsWith(label));

          for (const el of nodes) {
            // tenta pegar o valor ao lado
            const v1 = el.nextElementSibling?.textContent?.trim();
            if (v1) return v1;

            // tenta pegar dentro do mesmo container
            const parent = el.parentElement;
            const v2 = parent
              ?.querySelector("span, strong, b")
              ?.textContent?.trim();
            if (v2 && !v2.startsWith(label)) return v2;

            // tenta pegar no próximo elemento do pai (layout em linhas/colunas)
            const v3 = parent?.nextElementSibling?.textContent?.trim();
            if (v3) return v3;
          }

          return null;
        };

        const numero = getValue("Número:");
        const codigo = getValue("Código de Verificação:");

        return (
          numero &&
          codigo &&
          numero !== "Não encontrado" &&
          codigo !== "Não encontrado"
        );
      },
      { timeout: 30000 },
    ); // ⏱️ mais tempo (o portal pode demorar)

    const dadosNota = await page.evaluate(() => {
      const pegaTexto = (label) => {
        const nodes = Array.from(
          document.querySelectorAll("label, span, td, th, div"),
        ).filter((el) => (el.textContent || "").trim().startsWith(label));

        for (const el of nodes) {
          const v1 = el.nextElementSibling?.textContent?.trim();
          if (v1) return v1;

          const parent = el.parentElement;
          const v2 = parent
            ?.querySelector("span, strong, b")
            ?.textContent?.trim();
          if (v2 && !v2.startsWith(label)) return v2;

          const v3 = parent?.nextElementSibling?.textContent?.trim();
          if (v3) return v3;
        }

        return "Não encontrado";
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
      // ✅ Se chegou aqui, é bem provável que emitiu, mas mudou layout.
      // Mantemos sucesso=false para você decidir o que fazer no fluxo.
    }
  } catch (error) {
    // Verifica se existe alguma mensagem de erro no DOM
    const erroSistema = await page.$(".ui-messages-error, .alert-error");
    if (erroSistema) {
      logger.error(
        "❌ A emissão da nota falhou (erro reportado pelo sistema).",
      );
    } else {
      logger.warn(
        `⚠️ Nenhum dado da NFS-e encontrado, pode ser atraso ou mudança de layout! (${error.message})`,
      );
    }
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

      logger.info("✅ Tela de emissão recarregada com sucesso!");
    } catch (err) {
      const exists = await page.$("#formEmissaoNFConvencional\\:itCpf");
      if (exists) {
        logger.info(
          "✅ Tela de emissão recarregada com sucesso (detected after timeout).",
        );
      } else {
        if (CONFIG.VERBOSE) {
          logger.warn(
            "⚠️ Não foi possível confirmar visualmente o CPF, mas continuando...",
          );
        }
        // Apenas AVISO, mas continua! Não throw, não aborta
      }
    }
  } else {
    logger.warn(
      "⏹️ SKIP_CONFIRMATION ativado ou TEST_MODE: mantendo na tela da nota emitida.",
    );
  }

  return sucesso;
}
