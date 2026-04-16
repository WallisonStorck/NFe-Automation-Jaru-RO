# 📌 NFS‑e Automation — ISS Web (Fiorilli)

Automação em **Node.js + Puppeteer** para emissão de **NFS‑e** em portais **ISS Web da Fiorilli**, lendo uma planilha Excel com dados dos tomadores e interagindo no site como um usuário humano.

> **Aviso**: Este projeto automatiza um processo sensível (emissão fiscal). Use credenciais próprias e revise as regras do município antes de utilizar em produção.

---

## 🚀 Tecnologias

- **Node.js** – runtime
- **Puppeteer** – automação do navegador (Chrome/Edge/Chromium)
- **xlsx** – leitura/escrita de planilhas Excel
- **fs-extra** – utilitários de arquivos
- **logger** custom – logs por dia com timestamp e emojis

---

## ✅ Funcionalidades

- Login automático no portal ISS Web (com **reuso de cookies** quando possível)
- Detecção idempotente de sessão (evita relogar quando já está autenticado)
- Preenchimento automático de:
  - Tipo de pessoa (Física)
  - **CPF** (com múltiplas tentativas e fallback para **pular o registro**)
  - Atividade Municipal, NBS, Código Indicador da Operação e Classificação Tributária (configuráveis)
  - Mensagem/descrição (templates por código de serviço)
  - **Valor** (validação de formato e rejeição de `0` ou inválido)

- Adição de item, salvamento e confirmação da nota (configurável)
- Captura dos dados da NFS‑e emitida (número, código de verificação, etc.)
- Atualização da planilha marcando **PROCESSADO = "SIM"**
- Marcação automática de **DUPLICADOS** (mesmo tomador + CPF + valor)
- Logs detalhados e **encerramento seguro** (CTRL+C)

---

## 📂 Estrutura do Projeto

```
📦 NFS-E-AUTOMATION
├─ 📁 logs/                     # Logs rotacionados por data (gerado em runtime)
├─ 📁 modules/
│  ├─ aluno.js                  # Helpers: CPF, mensagem, valor, salvar, etc.
│  ├─ controleExecucao.js       # Encerramento seguro (graceful shutdown)
│  ├─ logger.js                 # Logger (arquivo + console)
│  ├─ mensagens.js              # Templates de descrição por serviço
│  ├─ navegador.js              # Inicialização do navegador
│  ├─ notaEmitida.js            # Coleta das informações da NFS-e emitida
│  ├─ planilha.js               # Leitura/atualização da planilha
│  └─ processamento.js          # Fluxo principal por registro
├─ 📁 ui/
│  ├─ app.js                    # Lógica da interface gráfica
│  ├─ index.html                # Interface web
│  └─ style.css                 # Estilos
├─ config.js                    # Configurações gerais
├─ cookies.json                 # Cookies de sessão (gerado em runtime)
├─ index.js                     # Script principal (loop de emissão)
├─ server.js                    # Servidor da interface gráfica
├─ START.bat                    # Atalho para iniciar no Windows
├─ package.json
└─ README.md
```

---

## ⚙️ Configuração

### 1) Configuração geral

Em **`config.js`** ficam os parâmetros de comportamento da automação. As credenciais e a planilha **não precisam ser editadas aqui** — são informadas diretamente pela interface gráfica.

O único parâmetro que pode precisar de ajuste é a **URL do portal**, que varia conforme o município:

```js
export const CONFIG = {
  // 🌐 URL da página de emissão do portal ISS Web do seu município
  ISS_URL:
    "https://servicos.seumunicipio.gov.br/issweb/paginas/admin/notafiscal/convencional/emissaopadrao",

  COOKIE_FILE: "cookies.json",

  // 📅 data manual ("DD/MM/AAAA"), vazio = usar a do portal
  DATA_EMISSAO_MANUAL: "",

  // 👤 tentativas de CPF antes de pular o registro
  MAX_TENTATIVAS_CPF: 3,

  // 🔧 modos de execução
  SKIP_CONFIRMATION: false, // true = não clica "SIM" no modal
  TEST_MODE: false, // true = processa só 1 registro
  VERBOSE: false, // true = logs detalhados
};
```

### 2) `.gitignore` sugerido

```gitignore
# sessões
cookies.json

# logs
logs/*.log
logs/*.txt

# outros
node_modules/
```

---

## ▶️ Como rodar

```bash
npm install
node server.js
```

Após iniciar, acesse a interface pelo navegador. Por ela você:

- Informa a **URL do portal** ISS Web do seu município
- Informa o **usuário e senha** do portal
- Seleciona a **planilha Excel** com os dados
- Configura os parâmetros e inicia a automação

---

## 🔎 Modos & Flags

| Opção                 | Efeito                                                               |
| --------------------- | -------------------------------------------------------------------- |
| `SKIP_CONFIRMATION`   | Simula emissão sem confirmar o modal final (não clica em **SIM**).   |
| `TEST_MODE`           | Processa apenas o primeiro registro pendente (debug rápido).         |
| `VERBOSE`             | Exibe logs estendidos (tentativas, detalhes do DOM, etc.).           |
| `MAX_TENTATIVAS_CPF`  | Tenta preencher/validar CPF este número de vezes antes de **pular**. |
| `DATA_EMISSAO_MANUAL` | Força a data informada; vazio usa a do portal.                       |

---

## 🧪 Exemplo de saída (logs)

```
[08-09-2025 09:08:20] [INFO] 🤖 Automação iniciada via interface gráfica.
[08-09-2025 09:08:20] [INFO] 📂 Carregando planilha...
[08-09-2025 09:08:20] [INFO] ✅ Planilha carregada com sucesso!
[08-09-2025 09:08:20] [INFO] 🌐 Abrindo navegador...
[08-09-2025 09:08:36] [INFO] ⏭️ Pulando registro no índice 0: já processado ou inválido.
[08-09-2025 09:08:36] [INFO] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[08-09-2025 09:08:36] [INFO] 👤 Aluno(a) selecionado(a): FULANO DA SILVA
[08-09-2025 09:08:42] [INFO] ⏳ Buscando cadastro... [Tentativa 1/3]
[08-09-2025 09:18:39] [INFO] ✅ Confirmação realizada, nota salva com sucesso!
[08-09-2025 09:18:59] [INFO] 💾 Aluno(a) "FULANO DA SILVA" marcado como PROCESSADO!
[08-09-2025 09:18:59] [INFO] ✅ Processamento da nota concluída!
```

---

## 🛟 Dicas & Solução de Problemas

- **Registro não encontrado**: O CPF pode não estar cadastrado no portal. O sistema pula automaticamente após `MAX_TENTATIVAS_CPF` tentativas.
- **Campos dependentes não carregam**: O portal ISS Web usa AJAX para carregar campos em cascata (NBS → Código Indicador → Classificação Tributária). Se algum travar, verifique se os códigos configurados existem no portal do seu município.
- **Sessão expirada**: O sistema detecta automaticamente e refaz o login usando as credenciais informadas na interface.
- **Nota não confirmada**: Verifique se `SKIP_CONFIRMATION` está como `false` no `config.js`.
- **Portal de outro município**: Ajuste a URL em `config.js` e revise os IDs dos campos em `aluno.js` caso o município use uma versão diferente do ISS Web.

---

## 🤝 Contribuição

Contribuições são bem-vindas via **Issues** e **Pull Requests**. Para adaptar a outros municípios ou adicionar novos campos, abra uma issue descrevendo o caso.
