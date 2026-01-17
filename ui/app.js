// Lida com a interface: configurações, status e logs

// Atualiza o texto de status
function setStatus(msg) {
  const status = document.getElementById("status");
  if (status) status.innerText = msg;
}

// Adiciona linhas ao box de log
function addLog(msg) {
  const log = document.getElementById("log");
  if (!log) return;

  log.textContent += `\n${msg}`;
  log.scrollTop = log.scrollHeight; // rolagem automática para o fim
}

// Converte "SIM, ZERADO, INVALIDO" => ["SIM", "ZERADO", "INVALIDO"]
function parseIgnorarStatus(value) {
  if (!value) return ["SIM", "ZERADO", "INVALIDO"];

  return value
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

// Salva as configurações no localStorage
function saveConfig() {
  const cfg = {
    USERNAME: document.getElementById("cfgUser").value.trim(),
    PASSWORD: document.getElementById("cfgPass").value.trim(),

    // UI salva como string para o usuário editar fácil
    IGNORAR_STATUS: document.getElementById("cfgIgnorar").value.trim(),

    DATA_EMISSAO_MANUAL: document.getElementById("cfgData").value.trim() || "",
    MAX_TENTATIVAS_CPF: Number(
      document.getElementById("cfgTentativas").value.trim() || "3"
    ),
  };

  localStorage.setItem("nfseConfig", JSON.stringify(cfg));

  setStatus("Configurações salvas!");
  addLog("✅ Configurações salvas no navegador (localStorage).");

  addLog("Usuário: " + (cfg.USERNAME || "(vazio)"));
  addLog("Senha: " + (cfg.PASSWORD ? "********" : "(vazio)"));
  addLog(
    "Status a ignorar: " +
      (cfg.IGNORAR_STATUS || "SIM, ZERADO, INVALIDO (padrão)")
  );
  addLog(
    `Data Manual: ${cfg.DATA_EMISSAO_MANUAL ? cfg.DATA_EMISSAO_MANUAL : "Não"}`
  );
  addLog("Máximo de tentativas por CPF: " + cfg.MAX_TENTATIVAS_CPF);
}

// Se tiver algo no localStorage, carrega nos campos
function loadConfig() {
  const cfg = JSON.parse(localStorage.getItem("nfseConfig"));
  if (!cfg) {
    addLog("ℹ️ Configure para iniciar...");
    return;
  }

  IPT.USERNAME.value = cfg.USERNAME || "";
  IPT.PASSWORD.value = cfg.PASSWORD || "";
  IPT.IGNORAR_STATUS.value = cfg.IGNORAR_STATUS || "SIM, ZERADO, INVALIDO";
  IPT.DATA_EMISSAO_MANUAL.value = cfg.DATA_EMISSAO_MANUAL || "";
  IPT.MAX_TENTATIVAS_CPF.value = cfg.MAX_TENTATIVAS_CPF || 3;

  addLog("ℹ️ Configurações carregadas. Revise e clique em iniciar.");
}

// Envia config + planilha para o Node (multipart/form-data)
async function sendConfigAndSpreadsheet() {
  const cfgSaved = JSON.parse(localStorage.getItem("nfseConfig"));
  const fileInput = document.getElementById("planilha");

  if (!cfgSaved) {
    setStatus("Configure antes de iniciar...");
    addLog("❌ Nenhuma configuração encontrada.");
    return;
  }

  if (!fileInput || !fileInput.files || !fileInput.files.length) {
    setStatus("Selecione a planilha.");
    addLog("❌ Nenhuma planilha selecionada.");
    return;
  }

  // Aqui montamos o config FINAL para o backend:
  // - transforma IGNORAR_STATUS em array
  const cfgToSend = {
    ...cfgSaved,
    IGNORAR_STATUS: parseIgnorarStatus(cfgSaved.IGNORAR_STATUS),
  };

  const formData = new FormData();
  formData.append("config", JSON.stringify(cfgToSend));
  formData.append("planilha", fileInput.files[0]);

  setStatus("Enviando planilha e configurações...");
  addLog("📤 Enviando dados para o servidor...");

  try {
    // ⚠️ Importante:
    // - NÃO definir Content-Type manualmente.
    // - O browser define automaticamente o boundary do multipart/form-data.
    const res = await fetch("/start", {
      method: "POST",
      body: formData,
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const msg = data?.error || "Erro ao iniciar automação.";
      throw new Error(msg);
    }

    setStatus("Automação iniciada.");
    addLog("🚀 Automação iniciada com sucesso.");
  } catch (err) {
    setStatus("Erro ao iniciar...");
    addLog("❌ Falha ao comunicar com o servidor: " + err.message);
    console.error(err);
  }
}

// Mapa do DOM
const IPT = {};

window.onload = () => {
  // Mapeia o DOM uma vez só
  IPT.USERNAME = document.getElementById("cfgUser");
  IPT.PASSWORD = document.getElementById("cfgPass");
  IPT.IGNORAR_STATUS = document.getElementById("cfgIgnorar");
  IPT.DATA_EMISSAO_MANUAL = document.getElementById("cfgData");
  IPT.MAX_TENTATIVAS_CPF = document.getElementById("cfgTentativas");

  loadConfig();

  // Botão salvar
  document.getElementById("saveConfig").addEventListener("click", (event) => {
    event.preventDefault();
    saveConfig();
  });

  // Botão iniciar
  document.getElementById("startBtn").addEventListener("click", (event) => {
    event.preventDefault();
    sendConfigAndSpreadsheet();
  });

  // Botão parar
  document.getElementById("stopBtn")?.addEventListener("click", async () => {
    setStatus("Solicitando parada...");
    addLog("🛑 Enviando solicitação de parada...");

    try {
      const res = await fetch("/stop", { method: "POST" });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = data?.error || "Erro ao enviar parada.";
        throw new Error(msg);
      }

      setStatus("Parada solicitada.");
      addLog("⚠️ Automação será encerrada com segurança.");
    } catch (err) {
      setStatus("Erro ao parar.");
      addLog("❌ Falha ao comunicar com o servidor: " + err.message);
      console.error(err);
    }
  });

  // Logs em tempo real (se o server.js tiver /logs com SSE)
  try {
    const eventSource = new EventSource("/logs");
    eventSource.onmessage = (event) => addLog(event.data);
    eventSource.onerror = () => {
      // não spammar log; só sinaliza no console
      console.error("Conexão de logs (SSE) perdida.");
    };
  } catch (err) {
    console.error("SSE não disponível:", err);
  }
};
