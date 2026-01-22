// server.js
import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { fileURLToPath } from "url";
import { startAutomation, stopAutomation } from "./index.js";

const app = express();

// --- ajustes para ESM ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- pasta da interface ---
const UI_PATH = path.join(__dirname, "ui");

// --- middlewares ---
app.use(express.json()); // permite receber JSON (para rotas que usam JSON)
app.use(express.static(UI_PATH));

// --- garantir pasta de uploads ---
const UPLOADS_PATH = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOADS_PATH)) {
  fs.mkdirSync(UPLOADS_PATH, { recursive: true });
}

// --- upload da planilha ---
const upload = multer({
  dest: UPLOADS_PATH, // pasta temporária
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB (ajuste se precisar)
  },
});

// ===============================
// LOG STREAM (SSE) - logs ao vivo
// ===============================
let logClients = [];

function sendLogToClients(message) {
  for (const res of logClients) {
    res.write(`data: ${message}\n\n`);
  }
}

// expõe para o logger usar (global)
global.sendLogToUI = (message) => {
  sendLogToClients(message);
};

// rota de streaming
app.get("/logs", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // mensagem inicial
  res.write("data: 🔌 Conectado ao stream de logs\n\n");

  logClients.push(res);

  req.on("close", () => {
    logClients = logClients.filter((c) => c !== res);
  });
});

// --- rota principal (UI) ---
app.get("/", (req, res) => {
  res.sendFile(path.join(UI_PATH, "index.html"));
});

// --- iniciar automação ---
app.post("/start", upload.single("planilha"), async (req, res) => {
  try {
    // validações básicas
    if (!req.body?.config) {
      return res.status(400).json({
        ok: false,
        error: 'Campo "config" não foi enviado.',
      });
    }

    if (!req.file?.path) {
      return res.status(400).json({
        ok: false,
        error: "Nenhuma planilha foi enviada.",
      });
    }

    const cfg = JSON.parse(req.body.config);
    const filePath = req.file.path;

    console.log("📥 Configuração recebida:", cfg);
    console.log("📂 Planilha recebida em:", filePath);

    // dispara a automação (não usar await, para não travar o servidor)
    startAutomation({
      ...cfg,
      FATURAMENTO_FIMCA: filePath,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("❌ Erro ao iniciar:", err);
    return res.status(500).json({
      ok: false,
      error: "Erro interno ao iniciar a automação.",
    });
  }
});

// --- parar automação ---
app.post("/stop", (req, res) => {
  console.log("🛑 Parada solicitada pela interface...");
  stopAutomation();
  res.json({ ok: true });
});

// --- iniciar servidor ---
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🖥️  Interface disponível em: http://localhost:${PORT}`);
});
