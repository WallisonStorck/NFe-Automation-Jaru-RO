// navegador.js (Gerencia o navegador)
import puppeteer from "puppeteer";
import { logger } from "../modules/logger.js";
import fs from "fs";
import { CONFIG } from "../config.js";

// Tenta descobrir o caminho padrão do Chrome ou Edge no Windows
function descobrirNavegadorPadrao() {
  const caminhosPossiveis = [
    // Google Chrome
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",

    // Microsoft Edge
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ];

  for (const caminho of caminhosPossiveis) {
    if (fs.existsSync(caminho)) return caminho;
  }

  logger.warn("⚠️ Navegador padrão não encontrado, usará o Chromium embutido.");
  return null;
}

export async function abrirNavegador() {
  try {
    logger.info("🌐 Abrindo navegador...");

    const caminhoNavegador = descobrirNavegadorPadrao();

    const browser = await puppeteer.launch({
      headless: false,
      executablePath: caminhoNavegador || undefined, // usa Chromium se não encontrar nenhum navegador externo
      args: ["--start-maximized", "--no-sandbox", "--disable-setuid-sandbox"],
    });

    await new Promise((resolve) => setTimeout(resolve, 2000));
    const pages = await browser.pages();
    const page = pages.length > 0 ? pages[0] : await browser.newPage();

    // Maximiza a janela via DevTools Protocol
    const session = await page.target().createCDPSession();
    const { windowId } = await session.send("Browser.getWindowForTarget");
    await session.send("Browser.setWindowBounds", {
      windowId,
      bounds: { windowState: "maximized" },
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const { width, height } = await page.evaluate(() => ({
      width: window.outerWidth,
      height: window.outerHeight,
    }));
    await page.setViewport({ width, height });

    if (CONFIG.VERBOSE) {
      logger.info(`✅ Viewport do navegador ajustada para: ${width}x${height}`);
    }
    return { browser, page };
  } catch (error) {
    logger.error(`❌ Erro ao abrir o navegador: ${error.stack}`);
    throw error;
  }
}
