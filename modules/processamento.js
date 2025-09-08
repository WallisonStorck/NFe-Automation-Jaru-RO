// processamento.js (Processa cada aluno)
import {
  inserirCPF,
  inserirCNAE,
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

// 🧠 Função principal que processa um aluno e tenta emitir a NFS-e
export async function processarAluno(page, aluno, index, alunos) {
  logger.info(
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  );
  logger.info(`👤 Aluno(a) selecionado(a): ${aluno.ALUNO}`);

  try {
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
    await inserirCNAE(page);

    // 📝 Escreve a mensagem de descrição da nota com curso e competência
    await inserirMensagem(page, aluno);

    // 💰 Insere o valor da nota e valida se é aceitável
    const valorOK = await inserirValor(page, aluno);
    if (!valorOK) {
      logger.warn(
        `⏭️ Nota NÃO emitida para ${aluno.ALUNO} devido a valor inválido ou zerado.`
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
        `⚠️ Nota aparentemente não foi emitida corretamente para ${aluno.ALUNO}, não marcando como processado.`
      );
    }

    logger.info("✅ Processamento do aluno concluído!");
    return true; // Tudo OK
  } catch (error) {
    // >>> Mudança mínima: se o erro for o de CPF, não derruba; caso contrário, mantém comportamento original <<<
    const msg = error?.message?.toLowerCase?.() || "";
    const ehFalhaCPF =
      msg.includes("falha ao inserir cpf") || msg.includes("cpf");

    if (ehFalhaCPF) {
      logger.warn(
        `⏭️ Falha de CPF tratada para "${aluno.ALUNO}". Pulando aluno.`
      );
      return false; // NÃO derruba a automação
    }

    logger.error(`❌ Erro ao processar ${aluno.ALUNO}: ${error.message}`);
    throw error; // mantém fatal para outros tipos de erro
  }
}
