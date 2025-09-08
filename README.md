# 📌 NF‑e Automation (Jaru/RO)

Automação em **Node.js + Puppeteer** para emissão de **NFS‑e** no portal da Prefeitura de **Jaru (RO)**, lendo uma planilha Excel com dados dos alunos e interagindo no site como um usuário humano.

> **Aviso**: Este projeto automatiza um processo sensível (emissão fiscal). Use credenciais próprias e revise as regras locais antes de utilizar em produção.

---

## 🚀 Tecnologias

- **Node.js** – runtime
- **Puppeteer** – automação do navegador (Chrome/Edge/Chromium)
- **xlsx** – leitura/escrita de planilhas Excel
- **fs-extra** – utilitários de arquivos
- **logger** custom – logs por dia com timestamp e emojis

---

## ✅ Funcionalidades

- Login automático no portal da Prefeitura (com **reuso de cookies** quando possível)
- Detecção idempotente de sessão (evita relogar quando já está autenticado)
- Preenchimento automático de:

  - Tipo de pessoa (Física)
  - **CPF** (com múltiplas tentativas e fallback para **pular o aluno**)
  - **CNAE** fixo do serviço
  - Mensagem/descrição (templates por código de serviço)
  - **Valor** (validação de formato e rejeição de `0` ou inválido)

- Adição de item, salvamento e confirmação da nota (configurável)
- Captura dos dados da NFS‑e emitida (número, código de verificação, etc.)
- Atualização da planilha marcando **PROCESSADO = "SIM"**
- Marcação automática de **DUPLICADOS** (mesmo ALUNO + CPF + valor)
- Logs detalhados e **encerramento seguro** (CTRL+C)

---

## 📂 Estrutura do Projeto

```
📦 NF-E-AUTOMATION
├─ 📁 docs/
│  └─ FATURAMENTO.xlsx          # Planilha de entrada
├─ 📁 logs/                      # Logs rotacionados por data (gerado em runtime)
├─ 📁 modules/
│  ├─ aluno.js                  # Helpers: CPF, CNAE, mensagem, valor, salvar, etc.
│  ├─ controleExecucao.js       # Encerramento seguro (graceful shutdown)
│  ├─ logger.js                 # Logger (arquivo + console)
│  ├─ mensagens.js              # Templates de descrição por serviço
│  ├─ navegador.js              # Inicialização do navegador
│  ├─ notaEmitida.js            # Coleta das informações da NFS-e emitida
│  ├─ planilha.js               # Leitura/atualização da planilha
│  └─ processamento.js          # Fluxo principal por aluno
├─ config.js                    # Configurações gerais (sem segredos)
├─ config.secrets.js            # 🔐 Credenciais (NÃO versionado)
├─ cookies.json                 # Cookies de sessão (gerado)
├─ index.js                     # Script principal (loop de emissão)
├─ package.json
└─ README.md
```

---

## ⚙️ Configuração

### 1) Segredos (não versionado)

Crie **`config.secrets.js`** na raiz e adicione ao `.gitignore`:

```js
// config.secrets.js
export const SECRETS = {
  USERNAME: "seu_usuario",
  PASSWORD: "sua_senha",
};
```

### 2) Configuração geral

Em **`config.js`**, os segredos são consumidos e os demais parâmetros ficam visíveis:

```js
import { SECRETS } from "./config.secrets.js";

export const CONFIG = {
  FATURAMENTO_FIMCA: "docs/FATURAMENTO.xlsx",
  ISS_JARU:
    "https://servicos.jaru.ro.gov.br/issweb/paginas/admin/notafiscal/convencional/emissaopadrao",
  COOKIE_FILE: "cookies.json",

  // 🔐 credenciais vindas dos segredos (não versionados)
  USERNAME: SECRETS.USERNAME,
  PASSWORD: SECRETS.PASSWORD,

  // 📅 data manual ("DD/MM/AAAA"), vazio = usar a do portal
  DATA_EMISSAO_MANUAL: "",

  // 👤 tentativas de CPF antes de pular o aluno
  MAX_TENTATIVAS_CPF: 3,

  // 🔧 modos de execução
  SKIP_CONFIRMATION: false, // true = não clica "SIM" no modal
  TEST_MODE: false, // true = processa só 1 aluno
  VERBOSE: false, // true = logs detalhados
};
```

### 3) `.gitignore` sugerido

```gitignore
# segredos e sessão
config.secrets.js
cookies.json

# planilhas / dados locais
docs/
Docs/

# logs
logs/
```

---

## ▶️ Como rodar

```bash
npm install
node index.js
```

> Coloque sua planilha em `docs/FATURAMENTO.xlsx`. O script abrirá o navegador, restaurará a sessão se possível, fará login quando necessário e seguirá emitindo as notas para os registros elegíveis.

---

## 🔎 Modos & Flags

| Opção                 | Efeito                                                               |
| --------------------- | -------------------------------------------------------------------- |
| `SKIP_CONFIRMATION`   | Simula emissão sem confirmar o modal final (não clica em **SIM**).   |
| `TEST_MODE`           | Processa apenas o primeiro aluno pendente (debug rápido).            |
| `VERBOSE`             | Exibe logs estendidos (tentativas, detalhes do DOM, etc.).           |
| `MAX_TENTATIVAS_CPF`  | Tenta preencher/validar CPF este número de vezes antes de **pular**. |
| `DATA_EMISSAO_MANUAL` | Força a data informada; vazio usa a do portal.                       |

---

## 🧪 Exemplo de saída (logs)

```bash
[08-09-2025 09:08:20] [INFO] 🤖 Iniciando automação...
[08-09-2025 09:08:20] [INFO] 📂 Carregando planilha...
[08-09-2025 09:08:20] [INFO] ✅ Planilha carregada com sucesso!
[08-09-2025 09:08:20] [INFO] 🌐 Abrindo navegador...
[08-09-2025 09:08:36] [INFO] ⏭️ Pulando aluno no índice 0: já processado ou inválido.
[08-09-2025 09:08:36] [INFO] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[08-09-2025 09:08:36] [INFO] 👤 Aluno(a) selecionado(a): AGNES KAROLYNE DA SILVA SOUZA
[08-09-2025 09:08:42] [INFO] ⏳  Buscando cadastro... [Tentativa 1/3]
[08-09-2025 09:18:39] [INFO] ✅ Confirmação realizada, nota salva com sucesso!
[08-09-2025 09:18:59] [INFO] 💾✅ Aluno(a) "FULANO DA SILVA" marcado como PROCESSADO!
[08-09-2025 09:18:59] [INFO] ✅ Processamento do aluno concluído!
```

---

## 🛟 Dicas & Solução de Problemas

- **Sessão já ativa**: o sistema detecta sentinelas da tela de emissão e **pula o login**.
- **Travou na home**: a função `ensurePaginaEmissao` força ida à tela correta e valida por seletores.
- **CPF não encontrado**: após `MAX_TENTATIVAS_CPF`, o aluno é **ignorado** (sem derrubar a automação).
- **Encerramento**: `CTRL+C` realiza **graceful shutdown** (fecha navegador e preserva planilha).

---

## 🤝 Contribuição

Contribuições são bem-vindas via **Issues** e **Pull Requests**. Para novas integrações ou melhorias, abra uma issue descrevendo o caso.
