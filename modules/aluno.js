// aluno.js (Funções auxiliares para processar campos específicos)
import { CONFIG } from "../config.js";
import { logger } from "../modules/logger.js";
import { MENSAGENS } from "./mensagens.js";

export async function inserirDataEmissao(page) {
  if (CONFIG.DATA_EMISSAO_MANUAL) {
    logger.info(
      `🗓️ Alterando data de emissão para: ${CONFIG.DATA_EMISSAO_MANUAL}`,
    );
    await page.waitForSelector(
      "#formEmissaoNFConvencional\\:imDataEmissao_input",
      { visible: true },
    );
    await page.click("#formEmissaoNFConvencional\\:imDataEmissao_input", {
      clickCount: 3,
    });
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Delete");
    await page.type(
      "#formEmissaoNFConvencional\\:imDataEmissao_input",
      CONFIG.DATA_EMISSAO_MANUAL,
    );
    await page.keyboard.press("Tab");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (CONFIG.VERBOSE) {
      logger.info(
        `✅ Data de emissão alterada para: ${CONFIG.DATA_EMISSAO_MANUAL}`,
      );
    }
  }
}

export async function selecionarTipoPessoa(page) {
  if (CONFIG.VERBOSE) {
    logger.info("🔄 Selecionando Tipo de Pessoa...");
  }

  try {
    await page.waitForSelector(
      "#formEmissaoNFConvencional\\:tipoPessoa_input",
      { visible: true },
    );
    await page.select(
      "#formEmissaoNFConvencional\\:tipoPessoa_input",
      "FISICA",
    );
    if (CONFIG.VERBOSE) {
      logger.info("✅ Tipo de pessoa definido como Física");
    }

    // Pequeno delay para garantir que a seleção seja processada
    await new Promise((resolve) => setTimeout(resolve, 1000));
  } catch (error) {
    logger.error("❌ Erro ao selecionar o tipo de pessoa:", error.message);
  }
}

export async function inserirCPF(page, cpf) {
  try {
    // 🔄 Espera o campo CPF aparecer antes de interagir
    await page.waitForSelector("#formEmissaoNFConvencional\\:itCpf", {
      visible: true,
      timeout: 10000,
    });

    let tentativas = 0; // Número de tentativas realizadas
    // let CONFIG.MAX_TENTATIVAS_CPF = 5; // Número máximo de tentativas que irá realizar...
    let nameFilledIn = ""; // Campo que indicará se o CPF foi aceito pelo sistema

    while (tentativas < CONFIG.MAX_TENTATIVAS_CPF) {
      tentativas++;

      // 🔄 Garante que o campo CPF está selecionado corretamente antes de digitar
      await page.click("#formEmissaoNFConvencional\\:itCpf", { clickCount: 3 });
      await page.keyboard.press("Backspace");
      await page.keyboard.press("Delete");

      // 🕒 Aguarda o campo realmente ficar vazio antes de começar a digitar
      await page
        .waitForFunction(
          () => {
            const input = document.querySelector(
              "#formEmissaoNFConvencional\\:itCpf",
            );
            return input && input.value.trim() === "";
          },
          { timeout: 4000 },
        )
        .catch(() => {}); // se não limpar em 2s, segue mesmo assim

      // 🖊️ Digita o CPF lentamente para evitar erro de máscara
      for (let char of cpf) {
        await page.type("#formEmissaoNFConvencional\\:itCpf", char, {
          delay: 200, // digitação ainda mais lenta para evitar problemas
        });
      }

      // 🔄 Pressiona "Tab" para forçar a saída do campo e ativar preenchimento automático
      await page.keyboard.press("Tab");
      logger.info(
        `⏳ Buscando cadastro... [Tentativa ${tentativas}/${CONFIG.MAX_TENTATIVAS_CPF}]`,
      );

      // 🕒 Aguarda a resposta do sistema
      await new Promise((resolve) => setTimeout(resolve, 6000));

      // 🔍 Verifica se o nome foi preenchido corretamente
      nameFilledIn = await page.evaluate(() => {
        return document.querySelector("#formEmissaoNFConvencional\\:razaoNome")
          ?.value;
      });

      if (nameFilledIn && nameFilledIn.trim() !== "") {
        if (CONFIG.VERBOSE) {
          logger.info("✅ CPF inserido corretamente.");
        }
        return; // ✅ CPF foi validado — sai da função!
      }
    }

    // ❌ Se não conseguir após todas tentativas, apenas retorna false
    throw new Error(
      `Falha ao inserir CPF ${cpf} após ${tentativas} tentativas. Talvez o aluno não esteja cadastrado... Pulando para o próximo...`,
    );
  } catch (error) {
    logger.error(`❌ ${error.message}`);
    throw error; // ⛔ Repassa o erro para interromper o fluxo no processarAluno()
  }
}

// export async function inserirCNAE(page) {
//   logger.info("⏳ Inserindo CNAE...");
//   let cnaePreenchido = "";
//   do {
//     if (CONFIG.VERBOSE) {
//       logger.info("🔄 Tentando selecionar CNAE...");
//     }
//     await page.evaluate(() => window.scrollBy(0, 300));
//     await new Promise((resolve) => setTimeout(resolve, 1000));
//     await page.click("#formEmissaoNFConvencional\\:listaAtvCnae_label");
//     await new Promise((resolve) => setTimeout(resolve, 500));
//     await page.evaluate(() => {
//       let opcoes = document.querySelectorAll("li.ui-selectonemenu-item");
//       opcoes.forEach((opcao) => {
//         if (
//           opcao.innerText.includes(
//             "8532500 - Educação superior - graduação e pós-graduação",
//           )
//         ) {
//           opcao.click();
//         }
//       });
//     });
//     await new Promise((resolve) => setTimeout(resolve, 2000));
//     await page.click("body");
//     cnaePreenchido = await page.evaluate(() => {
//       return document
//         .querySelector("#formEmissaoNFConvencional\\:listaAtvCnae_label")
//         ?.textContent.trim();
//     });
//   } while (!cnaePreenchido || !cnaePreenchido.includes("8532500"));
//   if (CONFIG.VERBOSE) {
//     logger.info("✅ CNAE inserido com sucesso!.");
//   }
// }

export async function inserirAtividadeMunicipal(page) {
  logger.info("⏳ Inserindo Atividade Municipal...");

  // ⚠️ Aqui está o campo REAL (select oculto)
  const SELECT_SEL = "#formEmissaoNFConvencional\\:listaAtvAtd_input";
  const LABEL_SEL = "#formEmissaoNFConvencional\\:listaAtvAtd_label";

  const TEXTO_ALVO = "080102 - Ensino regular superior.";
  const CODIGO_ALVO = "080102";

  // 1) Espera o select existir
  await page.waitForSelector(SELECT_SEL, { visible: true, timeout: 30000 });

  // 2) Espera a opção do código aparecer (porque depende do CNAE)
  //    Isso garante que você já selecionou o CNAE antes.
  if (CONFIG.VERBOSE) {
    logger.info(
      "⏳ Aguardando opções da Atividade Municipal carregarem (dependente do CNAE)...",
    );
  }
  await page.waitForFunction(
    (sel, codigo) => {
      const select = document.querySelector(sel);
      if (!select) return false;
      const options = Array.from(select.querySelectorAll("option"));
      return options.some((op) => (op.textContent || "").includes(codigo));
    },
    { timeout: 30000 },
    SELECT_SEL,
    CODIGO_ALVO,
  );

  // 3) Descobre o value exato da opção 080102 e seleciona
  const valueAlvo = await page.evaluate(
    (sel, texto) => {
      const select = document.querySelector(sel);
      const options = Array.from(select.querySelectorAll("option"));
      const opt = options.find((o) => (o.textContent || "").trim() === texto);
      return opt ? opt.value : null;
    },
    SELECT_SEL,
    TEXTO_ALVO,
  );

  if (!valueAlvo) {
    throw new Error(
      `Não encontrou a opção "${TEXTO_ALVO}" no select de Atividade Municipal.`,
    );
  }

  if (CONFIG.VERBOSE) {
    logger.info(`🔎 Value encontrado para "${TEXTO_ALVO}": ${valueAlvo}`);
  }

  // 4) Seleciona no select (isso dispara change no Puppeteer)
  await page.select(SELECT_SEL, valueAlvo);

  // 5) PrimeFaces às vezes precisa de blur/tab para processar
  await page.focus(SELECT_SEL).catch(() => {});
  await page.keyboard.press("Tab");
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // 6) Confirma se o label atualizou
  let atividadePreenchida = await page.evaluate((sel) => {
    return document.querySelector(sel)?.textContent?.trim() || "";
  }, LABEL_SEL);

  if (CONFIG.VERBOSE) {
    logger.info(
      `🔎 Atividade Municipal atual: "${atividadePreenchida || "[vazio]"}"`,
    );
  }

  // 7) Se o label não atualizou ainda, espera mais um pouco (ajax)
  if (!atividadePreenchida.includes(CODIGO_ALVO)) {
    logger.warn(
      "⏳ Atividade Municipal ainda não refletiu no label. Aguardando processamento...",
    );
    await new Promise((resolve) => setTimeout(resolve, 3000));

    atividadePreenchida = await page.evaluate((sel) => {
      return document.querySelector(sel)?.textContent?.trim() || "";
    }, LABEL_SEL);
  }

  if (!atividadePreenchida.includes(CODIGO_ALVO)) {
    throw new Error(
      `Falha ao selecionar Atividade Municipal. Label permaneceu: "${
        atividadePreenchida || "[vazio]"
      }"`,
    );
  }

  if (CONFIG.VERBOSE) {
    logger.info("✅ Atividade Municipal inserida com sucesso!");
  }
}

export async function inserirNBS(page) {
  logger.info("⏳ Inserindo NBS...");

  const SELECT_SEL = "#formEmissaoNFConvencional\\:listaNBS_input";
  const LABEL_SEL = "#formEmissaoNFConvencional\\:listaNBS_label";
  const NEXT_SELECT_SEL = "#formEmissaoNFConvencional\\:listaIndOp_input";

  const VALUE_ALVO = "122041000";
  const TEXTO_ALVO = "122041000 - Serviços educacionais de graduação";

  try {
    // 1) Espera o select existir
    await page.waitForSelector(SELECT_SEL, { timeout: 30000 });

    // 2) Espera a opção correta existir
    await page.waitForFunction(
      (sel, value) => {
        const select = document.querySelector(sel);
        if (!select) return false;
        return Array.from(select.options).some((opt) => opt.value === value);
      },
      { timeout: 30000 },
      SELECT_SEL,
      VALUE_ALVO,
    );

    // 3) Aplica o valor e força o onchange do PrimeFaces
    await page.evaluate(
      ({ selectSel, labelSel, valueAlvo, textoAlvo }) => {
        const select = document.querySelector(selectSel);
        const label = document.querySelector(labelSel);

        if (!select) {
          throw new Error("Select de NBS não encontrado.");
        }

        select.value = valueAlvo;

        if (label) {
          label.textContent = textoAlvo;
        }

        if (typeof select.onchange === "function") {
          select.onchange();
        }

        select.dispatchEvent(new Event("change", { bubbles: true }));
      },
      {
        selectSel: SELECT_SEL,
        labelSel: LABEL_SEL,
        valueAlvo: VALUE_ALVO,
        textoAlvo: TEXTO_ALVO,
      },
    );

    // 4) Aguarda o AJAX terminar — espera listaIndOp ter mais de 1 opção carregada
    await page.waitForFunction(
      (sel) => {
        const select = document.querySelector(sel);
        if (!select) return false;
        return select.options.length > 1;
      },
      { timeout: 15000 },
      NEXT_SELECT_SEL,
    );

    // 5) Aguarda estabilizar antes de avançar
    await new Promise((resolve) => setTimeout(resolve, 1500));

    logger.info("✅ NBS inserido com sucesso!");
  } catch (error) {
    logger.error(`❌ Erro ao inserir NBS: ${error.message}`);
    throw error;
  }
}

export async function inserirCodigoIndicadorOperacao(page) {
  logger.info("⏳ Inserindo Código Indicador da Operação...");

  const LABEL_SEL = "#formEmissaoNFConvencional\\:listaIndOp_label";
  const NEXT_SELECT_SEL = "#formEmissaoNFConvencional\\:listaClassTrib_input";
  const VALUE_ALVO = "030101";

  try {
    // 1) Garante que o label está visível e rola até ele
    await page.waitForSelector(LABEL_SEL, { visible: true, timeout: 15000 });
    await page.evaluate((sel) => {
      document.querySelector(sel)?.scrollIntoView({ block: "center" });
    }, LABEL_SEL);
    await new Promise((resolve) => setTimeout(resolve, 500));

    // 2) Clica no label para abrir o dropdown
    await page.click(LABEL_SEL);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 3) Clica na opção correta
    const clicou = await page.evaluate((value) => {
      // Tenta li padrão do PrimeFaces
      const liItems = document.querySelectorAll("li.ui-selectonemenu-item");
      for (const item of liItems) {
        if (item.textContent?.includes(value)) {
          item.click();
          return true;
        }
      }

      // Tenta linhas de tabela
      const trItems = document.querySelectorAll(
        ".ui-selectonemenu-items-wrapper tr",
      );
      for (const item of trItems) {
        if (item.textContent?.includes(value)) {
          item.click();
          return true;
        }
      }

      // Tenta qualquer elemento com role="option"
      const roleItems = document.querySelectorAll("[role='option']");
      for (const item of roleItems) {
        if (item.textContent?.includes(value)) {
          item.click();
          return true;
        }
      }

      return false;
    }, VALUE_ALVO);

    if (!clicou) {
      throw new Error(
        `Opção ${VALUE_ALVO} não encontrada na lista do dropdown.`,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 4) Aguarda o próximo campo ter opções (AJAX)
    await page.waitForFunction(
      (sel) => {
        const select = document.querySelector(sel);
        return select && select.options.length > 1;
      },
      { timeout: 20000 },
      NEXT_SELECT_SEL,
    );

    await new Promise((resolve) => setTimeout(resolve, 1000));

    logger.info("✅ Código Indicador da Operação inserido com sucesso!");
  } catch (error) {
    logger.error(
      `❌ Erro ao inserir Código Indicador da Operação: ${error.message}`,
    );
    throw error;
  }
}

export async function inserirClassificacaoTributaria(page) {
  logger.info("⏳ Inserindo Classificação Tributária...");

  const LABEL_SEL = "#formEmissaoNFConvencional\\:listaClassTrib_label";
  const VALUE_ALVO = "200028";

  try {
    // 1) Garante que o label está visível e rola até ele
    await page.waitForSelector(LABEL_SEL, { visible: true, timeout: 15000 });
    await page.evaluate((sel) => {
      document.querySelector(sel)?.scrollIntoView({ block: "center" });
    }, LABEL_SEL);
    await new Promise((resolve) => setTimeout(resolve, 500));

    // 2) Clica no label para abrir o dropdown
    await page.click(LABEL_SEL);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 3) Clica na opção correta
    const clicou = await page.evaluate((value) => {
      // Tenta li padrão do PrimeFaces
      const liItems = document.querySelectorAll("li.ui-selectonemenu-item");
      for (const item of liItems) {
        if (item.textContent?.includes(value)) {
          item.click();
          return true;
        }
      }

      // Tenta linhas de tabela
      const trItems = document.querySelectorAll(
        ".ui-selectonemenu-items-wrapper tr",
      );
      for (const item of trItems) {
        if (item.textContent?.includes(value)) {
          item.click();
          return true;
        }
      }

      // Tenta qualquer elemento com role="option"
      const roleItems = document.querySelectorAll("[role='option']");
      for (const item of roleItems) {
        if (item.textContent?.includes(value)) {
          item.click();
          return true;
        }
      }

      return false;
    }, VALUE_ALVO);

    if (!clicou) {
      throw new Error(
        `Opção ${VALUE_ALVO} não encontrada na lista do dropdown.`,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 4) Aguarda label confirmar seleção
    await page.waitForFunction(
      (sel, value) => {
        return document.querySelector(sel)?.textContent?.includes(value);
      },
      { timeout: 15000 },
      LABEL_SEL,
      VALUE_ALVO,
    );

    logger.info("✅ Classificação Tributária inserida com sucesso!");
  } catch (error) {
    logger.error(
      `❌ Erro ao inserir Classificação Tributária: ${error.message}`,
    );
    throw error;
  }
}

export async function inserirMensagem(page, aluno) {
  logger.info(`💬 Inserindo mensagem...`);
  let dataEmissaoFinal = CONFIG.DATA_EMISSAO_MANUAL;

  if (!dataEmissaoFinal) {
    dataEmissaoFinal = await page.evaluate(() => {
      let dataInput = document.querySelector(
        "#formEmissaoNFConvencional\\:imDataEmissao_input",
      );
      return dataInput ? dataInput.value : "";
    });
  }

  // Se não conseguiu capturar a data, loga um erro
  if (!dataEmissaoFinal || !/^\d{2}\/\d{2}\/\d{4}$/.test(dataEmissaoFinal)) {
    logger.error(
      "❌ Erro ao obter a data de emissão. Verifique o campo de data.",
    );
    return; // Não prosseguir sem uma data válida
  }

  const [dia, mes, ano] = dataEmissaoFinal.split("/");
  if (CONFIG.DATA_EMISSAO_MANUAL != "") {
    logger.info(`✅ Data de emissão confirmada: ${dataEmissaoFinal}`);
  }

  // Obtém o código do serviço do aluno e verifica se há uma mensagem configurada
  const CodServico = parseInt(aluno.CODSERVICO, 10);
  let mensagemTemplate = MENSAGENS[CodServico] || MENSAGENS.default;

  // Substituir os placeholders {curso}, {mes} e {ano} pela informação real do aluno
  let mensagem = mensagemTemplate
    .replace("{curso}", aluno.CURSO)
    .replace("{mes}", mes)
    .replace("{ano}", ano);

  // Preencher o textarea com a mensagem correta
  await page.click("#formEmissaoNFConvencional\\:descricaoItem", {
    clickCount: 3,
  });
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Delete");
  await page.type("#formEmissaoNFConvencional\\:descricaoItem", mensagem);

  if (CONFIG.VERBOSE) {
    logger.info(`✅ Mensagem inserida: "${mensagem}"`);
  }
}

export async function inserirValor(page, aluno) {
  // ✅ Valor canônico vindo do planilha.js
  const valorNumerico =
    typeof aluno?.__VALOR_NUM === "number" ? aluno.__VALOR_NUM : NaN;

  if (Number.isNaN(valorNumerico)) {
    logger.error(
      `❌ Valor inválido ou não detectado para ${aluno.ALUNO}. Coluna detectada: "${aluno.__COLUNA_VALOR || "?"}" | Bruto: "${aluno.__VALOR_BRUTO || ""}"`,
    );

    return false;
  }

  if (valorNumerico === 0) {
    logger.warn(
      `⚠️ Valor da nota para o aluno ${aluno.ALUNO} é R$ 0,00. Pulando emissão.`,
    );
    return false;
  }

  // Garante que o valor tem duas casas decimais e formato com vírgula
  const valorFormatado = valorNumerico.toFixed(2).replace(".", ",");

  // Limpa o campo antes de digitar
  await page.click("#formEmissaoNFConvencional\\:vlrUnitario_input", {
    clickCount: 3,
  });
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Delete");

  // Digita o valor lentamente
  for (let char of valorFormatado) {
    await page.type("#formEmissaoNFConvencional\\:vlrUnitario_input", char, {
      delay: 150,
    });
  }

  logger.info(`💵 Valor digitado: R$ ${valorFormatado}`);

  // Dispara evento de mudança
  await page.evaluate(() => {
    const input = document.querySelector(
      "#formEmissaoNFConvencional\\:vlrUnitario_input",
    );
    if (input) {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });

  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Valida o valor final no campo (tratando ponto de milhar)
  const valorNoCampo = await page.evaluate(() => {
    const input = document.querySelector(
      "#formEmissaoNFConvencional\\:vlrUnitario_input",
    );
    return input?.value.trim();
  });

  const esperadoNormalizado = valorFormatado.replace(/\./g, "");
  const campoNormalizado = valorNoCampo.replace(/\./g, "");

  if (campoNormalizado !== esperadoNormalizado) {
    logger.error(
      `❌ Divergência detectada ao digitar valor para ${aluno.ALUNO}: esperado "${valorFormatado}", mas o campo ficou "${valorNoCampo}"`,
    );
    return false;
  }

  return true;
}

export async function clicarAdicionarItem(page) {
  try {
    if (CONFIG.VERBOSE) {
      logger.info("➕ Adicionando item à nota...");
    }

    // Clica no botão de adicionar item
    await page.evaluate(() => {
      const botaoAdicionar = document.querySelector(
        "#formEmissaoNFConvencional\\:btnAddItem",
      );
      if (botaoAdicionar) {
        botaoAdicionar.dispatchEvent(new Event("mouseover", { bubbles: true }));
        botaoAdicionar.dispatchEvent(new Event("mousedown", { bubbles: true }));
        botaoAdicionar.click();
        botaoAdicionar.dispatchEvent(new Event("mouseup", { bubbles: true }));
      }
    });

    // Aguarda o processamento do sistema
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Verifica se o item foi adicionado à tabela
    const itemAdicionado = await page.evaluate(() => {
      const tabela = document.querySelector(
        "#formEmissaoNFConvencional\\:listaItensNota_data",
      );
      if (!tabela) return false;

      const linhas = tabela.querySelectorAll("tr");
      return linhas.length > 0;
    });

    if (!itemAdicionado) {
      logger.error(
        "❌ O item não foi adicionado à tabela de serviços. Verifique os campos.",
      );
      return false;
    }

    if (CONFIG.VERBOSE) {
      logger.info("✅ Item adicionado com sucesso!");
    }
    return true;
  } catch (error) {
    logger.error(`❌ Erro ao clicar em 'Adicionar Item': ${error.message}`);
    return false;
  }
}

export async function clicarSalvarNota(page) {
  try {
    if (CONFIG.VERBOSE) {
      logger.info("💾 Salvando a nota...");
    }

    // Aguarda o botão de salvar ficar visível
    await page.waitForSelector("#frmActions\\:btnDefault", { visible: true });

    // Simula interações humanas antes do clique
    await page.evaluate(() => {
      let botaoSalvar = document.querySelector("#frmActions\\:btnDefault");
      if (botaoSalvar) {
        botaoSalvar.focus();
        botaoSalvar.dispatchEvent(new Event("mouseover", { bubbles: true }));
        botaoSalvar.dispatchEvent(new Event("mousedown", { bubbles: true }));
        botaoSalvar.click();
        botaoSalvar.dispatchEvent(new Event("mouseup", { bubbles: true }));
      }
    });

    // Pequeno delay para garantir que o modal carregue
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const modalVisivel = await page.evaluate(() => {
      return !!document.querySelector(".ui-confirm-dialog");
    });

    if (!modalVisivel) {
      logger.error(
        "❌ Modal de confirmação não apareceu. Verifique os campos.",
      );
      return false;
    }

    const botaoConfirmar = await page.$("#frmActions\\:j_idt480");

    if (botaoConfirmar) {
      if (CONFIG.SKIP_CONFIRMATION) {
        logger.warn(
          "⚠️  SKIP_CONFIRMATION ativado: o script NÃO confirmará a nota.",
        );
        return false; // Modal visível, mas não confirmamos
      }

      // Clica no botão de confirmação normalmente
      await page.evaluate(() => {
        const botao = document.querySelector("#frmActions\\:j_idt480");
        if (botao) {
          botao.dispatchEvent(new Event("mouseover", { bubbles: true }));
          botao.dispatchEvent(new Event("mousedown", { bubbles: true }));
          botao.click();
          botao.dispatchEvent(new Event("mouseup", { bubbles: true }));
        }
      });

      if (CONFIG.VERBOSE) {
        logger.info("✅ Confirmação realizada, nota salva com sucesso!");
      }
      return true;
    } else {
      logger.error("❌ Botão de confirmação não encontrado!");
      return false;
    }
  } catch (error) {
    logger.error(`❌ Erro ao tentar salvar a nota: ${error.message}`);
    return false;
  }
}
