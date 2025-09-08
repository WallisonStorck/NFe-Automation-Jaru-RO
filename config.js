// config.js (Configurações gerais da automação)

import { SECRETS } from "./config.secrets";

// Exporta objeto de configuração central usado por toda a aplicação
export const CONFIG = {
  // 📄 Caminho para a planilha Excel com os dados dos alunos
  FATURAMENTO_FIMCA: "docs/FATURAMENTO.xlsx",

  // 🌐 URL da página de emissão de NFS-e (Nota Fiscal de Serviço) de Jaru
  ISS_JARU:
    "https://servicos.jaru.ro.gov.br/issweb/paginas/admin/notafiscal/convencional/emissaopadrao",

  // 🍪 Caminho do arquivo onde os cookies da sessão serão salvos/recarregados
  COOKIE_FILE: "cookies.json",

  // 🔐 Informação sensível que vem de config.secrets.js
  USERNAME: SECRETS.USERNAME,
  PASSWORD: SECRETS.PASSWORD,

  // 🗓️ Data de emissão da nota. Se deixar em branco, será usada a data atual do sistema.
  // Formato: "DD/MM/AAAA" (exemplo: "01/03/2025")
  DATA_EMISSAO_MANUAL: "",

  // O máximo de tentativas de CPF que o sistema vai tentar inserir antes de pular para o próximo...
  MAX_TENTATIVAS_CPF: 3,

  // 🧪⚙️ Modos de teste e depuração

  // 🟡 SKIP_CONFIRMATION:
  // - true: Após clicar em "Salvar", NÃO clica no botão "SIM" do modal de confirmação.
  //         Ideal para depuração, testes manuais ou inspeção do modal.
  //         Também NÃO redireciona automaticamente para nova emissão.
  // - false: Clica no botão "SIM" e redireciona automaticamente para uma nova nota.
  SKIP_CONFIRMATION: false,

  // 🧪 TEST_MODE:
  // - true: Processa apenas 1 aluno — o primeiro que tiver "PROCESSADO" diferente de "SIM" ou "DUPLICADO".
  //         Ideal para rodar testes rápidos e validar comportamento sem processar tudo.
  // - false: Processa todos os alunos válidos da planilha.
  TEST_MODE: false,

  // 🔍 VERBOSE (modo detalhado):
  // - true: Mostra logs adicionais e mensagens informativas mais detalhadas
  //         durante a execução (útil para debug).
  // - false: Mostra apenas os logs principais e essenciais (modo "limpo").
  VERBOSE: false,

  /*
    🔎 RESUMO DOS MODOS:

    SKIP_CONFIRMATION:
      true  => Preenche os campos e clica em "Salvar", mas NÃO confirma a nota
            e NÃO redireciona para nova emissão (permite inspeção manual do modal).
      false => Realiza o processo completo, incluindo a confirmação final da nota
            e o redirecionamento para emissão de nova nota.

    TEST_MODE:
      true  => Processa apenas um aluno (o primeiro com "PROCESSADO" diferente de "SIM"/"DUPLICADO")
            e NÃO redireciona após emissão, permanecendo na tela final.
      false => Itera por todos os alunos válidos da planilha.

    VERBOSE:
      true  => Exibe detalhes como tentativas de inserção, valores lidos do DOM, etc.
      false => Mostra apenas informações essenciais da automação.
  */
};
