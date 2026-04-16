// processamento.js (Processa cada aluno)
import {
  inserirCPF,
  // inserirCNAE,
  inserirAtividadeMunicipal,
  inserirNBS,
  inserirCodigoIndicadorOperacao,
  inserirClassificacaoTributaria,
  inserirMensagem,
  inserirValor,
  inserirDataEmissao,
  selecionarTipoPessoa,
  clicarSalvarNota,
  clicarAdicionarItem,
} from "./aluno.js";
import { logger } from "../modules/logger.js";
import { registrarInformacoesNota } from "./notaEmitida.js";
import { atualizarAlunoNaPlanilha } from "./planilha.js";
import { ensurePaginaEmissao } from "./sessao.js";

// 🧠 Função principal que processa um aluno e tenta emitir a NFS-e
export async function processarAluno(page, aluno, index, alunos) {
  logger.info(
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
  );
  logger.info(`👤 Aluno(a) selecionado(a): ${aluno.ALUNO}`);

  try {
    // ✅ Garante que está na tela correta antes de iniciar o processamento do aluno
    await ensurePaginaEmissao(page, "início do processamento do aluno");

    // 🗓️ Insere a data de emissão (automático)
    await inserirDataEmissao(page);

    // 👤 Define como pessoa física (ou jurídica se alterado no futuro)
    await selecionarTipoPessoa(page);

    // 🧾 Insere o CPF do aluno
    // >>> Mudança mínima: se falhar (após as tentativas internas), apenas pula o aluno <<<
    try {
      await inserirCPF(page, aluno.CPF);
    } catch (err) {
      return false; // NÃO lança — permite o loop continuar para o próximo aluno
    }

    // 💼 Seleciona o código CNAE (fixo no sistema atual)
    // await inserirCNAE(page);

    // 💼 Seleciona a Atividade Municipal (fixo no sistema atual)
    await inserirAtividadeMunicipal(page);

    // 💼 Seleciona o NBS
    await inserirNBS(page);

    // 💼 Seleciona o Código Indicador da Operação
    await inserirCodigoIndicadorOperacao(page);

    // 💼 Seleciona a Classificação Tributária
    await inserirClassificacaoTributaria(page);

    // 📝 Escreve a mensagem de descrição da nota com curso e competência
    await inserirMensagem(page, aluno);

    // 💰 Insere o valor da nota e valida se é aceitável
    const valorOK = await inserirValor(page, aluno);
    if (!valorOK) {
      logger.warn(
        `⏭️ Nota NÃO emitida para ${aluno.ALUNO} devido a valor inválido ou zerado.`,
      );
      return false; // Impede avanço no processamento, mas NÃO derruba a automação
    }

    // ➕ Adiciona o item e salva a nota
    await clicarAdicionarItem(page);
    await clicarSalvarNota(page);

    // 🧾 Captura os dados da nota emitida (se possível)
    const notaEmitida = await registrarInformacoesNota(page);

    if (notaEmitida) {
      // Atualiza a planilha com status "SIM"
      atualizarAlunoNaPlanilha(alunos, index);

      // Guarda o último aluno marcado com sucesso, para garantir que seja salvo se o usuário interromper
      global.ultimoProcessado = { alunos, index };
    } else {
      logger.warn(
        `⚠️ Falha na emissão para ${aluno.ALUNO}. Registro pendente!`,
      );
    }

    logger.info("✅ Processamento da nota concluída!");
    return true; // Tudo OK
  } catch (error) {
    // ✅ Tenta recuperar a tela de emissão antes de seguir
    try {
      await ensurePaginaEmissao(page, "recuperação após erro no aluno");
    } catch {
      // não impede o tratamento do erro original
    }

    // >>> Mudança mínima: se o erro for o de CPF, não derruba; caso contrário, mantém comportamento original <<<
    const msg = error?.message?.toLowerCase?.() || "";
    const ehFalhaCPF =
      msg.includes("falha ao inserir cpf") || msg.includes("cpf");

    if (ehFalhaCPF) {
      logger.warn(
        `⏭️ Falha de CPF tratada para "${aluno.ALUNO}". Pulando aluno.`,
      );
      return false; // NÃO derruba a automação
    }

    logger.error(`❌ Erro ao processar ${aluno.ALUNO}: ${error.message}`);
    throw error; // mantém fatal para outros tipos de erro
  }
}
