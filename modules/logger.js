// logger.js
import fs from "fs";
import path from "path";

// 📂 Diretório dos logs
const LOGS_DIR = "./logs";

// 📌 Garante que o diretório de logs existe
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

// 📅 Obtém a data atual no formato YYYY-MM-DD
const getCurrentDate = () => {
  return new Date().toISOString().split("T")[0];
};

// 📌 Função para obter a hora correta em UTC -4
const getFormattedTimestamp = () => {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Porto_Velho",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(new Date())
    .replace(",", "")
    .replace(/\//g, "-"); // Ajusta o formato para YYYY-MM-DD HH:mm:ss
};

// 📌 Escreve a mensagem no arquivo de log e exibe no terminal
const logMessage = (level, message) => {
  const timestamp = getFormattedTimestamp(); // Agora pega a hora correta de Porto Velho
  const formattedMessage = `[${timestamp}] [${level}] ${message}`;

  // Salvar no arquivo
  const logFilePath = path.join(LOGS_DIR, `${getCurrentDate()}.log`);
  fs.appendFileSync(logFilePath, formattedMessage + "\n");

  // Exibir no console
  console.log(formattedMessage);
};

// 📌 Métodos públicos para diferentes tipos de log
export const logger = {
  info: (message) => logMessage("INFO", message),
  warn: (message) => logMessage("WARN", message),
  error: (message) => logMessage("ERROR", message),
};
