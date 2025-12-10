// Lida com a interface: configurações, status e logs (versão só-front-end)

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

function saveConfig() {
  const cfg = {
    USERNAME: document.getElementById("cfgUser").value.trim(),
    PASSWORD: document.getElementById("cfgPass").value.trim(),
    IGNORAR_STATUS:
      document.getElementById("cfgIgnorar").value.trim() ||
      "SIM, ZERADO, INVALIDO",
    DATA_EMISSAO_MANUAL: document.getElementById("cfgData").value.trim() || "",
    MAX_TENTATIVAS_CPF: Number(
      document.getElementById("cfgTentativas").value.trim() || "3"
    ),
  };

  // Salva como JSON no navegador
  localStorage.setItem("nfseConfig", JSON.stringify(cfg));

  setStatus("Configurações salvas!");
  addLog("Configurações salvas no navegador (localStorage).");

  // --------------- "console.log" ---------------
  addLog("Usuario: " + cfg.USERNAME);
  addLog("Senha: " + cfg.PASSWORD);
  addLog("Status a ignorar: " + cfg.IGNORAR_STATUS);
  addLog(
    "Data Manual?: " + cfg.DATA_EMISSAO_MANUAL
      ? cfg.DATA_EMISSAO_MANUAL
      : "Não."
  );
  addLog("Maxímo de Tentativas por CPF: " + cfg.MAX_TENTATIVAS_CPF);
}

window.onload = () => {
  document.getElementById("saveConfig").addEventListener("click", (event) => {
    event.preventDefault;
    saveConfig();
  });
};
