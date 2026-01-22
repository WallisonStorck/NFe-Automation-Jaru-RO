// modules/sessao.js
import fs from "fs-extra";
import { CONFIG } from "../config.js";
import { logger } from "../modules/logger.js";

// sleep compatível com qualquer versão do Puppeteer
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Seletores "sentinela" da tela de emissão (usar sufixos JSF/PrimeFaces). */
const SENTINELAS_EMISSAO = [
  '[id$=":itCpf"]',
  '[id$=":tipoPessoa_input"]',
  '[id$=":descricaoItem"]',
];

/** Seletores genéricos da tela de login (ajuste se o portal mudar) */
const USER_SEL = 'input[name="username"], #username';
const PASS_SEL = 'input[type="password"], #password';
const BTN_SEL = 'input[type="submit"], button[type="submit"], #j_idt110';

/** Checa rapidamente se algum seletor de emissão existe na página. */
async function hasEmissionSentinel(page, timeoutMs = 1500) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    for (const sel of SENTINELAS_EMISSAO) {
      try {
        const el = await page.$(sel);
        if (el) return true;
      } catch {
        /* ignore */
      }
    }
    await sleep(150);
  }
  return false;
}

/** Checa se a tela de login está presente (sem travar). */
async function isLoginScreen(page) {
  try {
    const u = await page.$(USER_SEL);
    const p = await page.$(PASS_SEL);
    // não exijo o botão, pois alguns portais enviam com Enter
    return !!(u && p);
  } catch {
    return false;
  }
}

/**
 * Garante que estamos na **tela de emissão**.
 * - Se já estiver, retorna.
 * - Se não, navega para CONFIG.ISS_JARU e valida por sentinela.
 */
export async function ensurePaginaEmissao(
  page,
  motivo = "navegar para emissão",
  cfg = CONFIG,
) {
  try {
    if (await hasEmissionSentinel(page, 1000)) {
      if (cfg.VERBOSE) {
        logger.info("✅ Tela de emissão detectada.");
      }
      return;
    }

    if (cfg.VERBOSE) {
      logger.warn(
        `🧭 Não está na emissão (${motivo}). Navegando para a URL de emissão...`,
      );
    }
    await page.goto(cfg.ISS_JARU, { waitUntil: "domcontentloaded" });

    // alguns portais demoram para hidratar os componentes
    if (await hasEmissionSentinel(page, 15000)) {
      if (cfg.VERBOSE) {
        logger.info("✅ Página de emissão carregada e validada.");
      }
      return;
    }

    if (cfg.VERBOSE) {
      logger.warn(
        "⏳ Emissão não detectada após navegação. Tentando recarregar a página...",
      );
    }
    await page.reload({ waitUntil: "domcontentloaded" });

    if (await hasEmissionSentinel(page, 15000)) {
      logger.info("✅ Página de emissão carregada e validada.");
      return;
    }

    throw new Error("Sentinelas da emissão não foram encontradas.");
  } catch (e) {
    logger.error(`❌ Falha ao garantir tela de emissão: ${e.message}`);
    throw e; // fatal: sem a tela não dá pra processar
  }
}

/**
 * Restaura sessão por cookies, **mas** trata casos em que a sessão
 * já está ativa mesmo sem cookies (navegador mantido aberto).
 * Retorna: "restaurada" | "expirada" | "ausente"
 */
export async function restaurarSessao(page, cfg = CONFIG) {
  // 0) Primeiro, vê se já estamos autenticados (sem depender de cookies)
  try {
    await page.goto(cfg.ISS_JARU, { waitUntil: "domcontentloaded" });
  } catch {
    /* ignore */
  }

  if (await hasEmissionSentinel(page, 1500)) {
    logger.info("🔐 Sessão ativa detectada (sem uso de cookies).");
    return "restaurada";
  }

  // 1) Sem cookies?
  if (!fs.existsSync(cfg.COOKIE_FILE)) {
    if (cfg.VERBOSE) {
      logger.info("ℹ️ Cookie file ausente — sem sessão para restaurar.");
    }
    // Mesmo sem cookies, pode estar logado porém fora da emissão
    // Tenta ir direto pra emissão:
    try {
      await ensurePaginaEmissao(page, "pós-checagem de cookies ausentes", cfg);
      return "restaurada";
    } catch {
      return "ausente";
    }
  }

  // 2) Com cookies
  try {
    if (cfg.VERBOSE) {
      logger.info("🍪 Tentando restaurar sessão a partir dos cookies...");
    }
    // Ir ao domínio alvo ajuda o setCookie
    await page.goto(cfg.ISS_JARU, { waitUntil: "domcontentloaded" });

    const cookies = JSON.parse(await fs.readFile(cfg.COOKIE_FILE, "utf8"));
    if (!Array.isArray(cookies) || cookies.length === 0) {
      logger.warn("⚠️ Cookie file vazio — removendo arquivo.");
      await fs.remove(cfg.COOKIE_FILE);
      // tenta emissão mesmo assim (pode já estar logado)
      try {
        await ensurePaginaEmissao(page, "pós-cookies vazios", cfg);
        return "restaurada";
      } catch {
        return "ausente";
      }
    }

    await page.setCookie(...cookies);
    await page.reload({ waitUntil: "domcontentloaded" });

    // Se estiver em login, expirou
    if (await isLoginScreen(page)) {
      if (cfg.VERBOSE) {
        logger.warn(
          "⚠️ Cookies carregados, mas sessão não validou (login à vista).",
        );
      }
      await fs.remove(cfg.COOKIE_FILE).catch(() => {});
      return "expirada";
    }

    // Se já dá pra ver a emissão, restaurou
    if (await hasEmissionSentinel(page, 1500)) {
      logger.info("🔐 Sessão restaurada com sucesso (sentinela encontrada).");
      return "restaurada";
    }

    // Pode estar logado mas em outra página → garante emissão
    try {
      await ensurePaginaEmissao(page, "pós-restauração", cfg);
      logger.info("🔐 Sessão restaurada com sucesso (após navegação).");
      return "restaurada";
    } catch {
      // não conseguimos detectar emissão — trate como expirada
      await fs.remove(cfg.COOKIE_FILE).catch(() => {});
      return "expirada";
    }
  } catch (error) {
    logger.warn(`⚠️ Falha ao restaurar sessão: ${error.message}`);
    try {
      await fs.remove(cfg.COOKIE_FILE);
    } catch {}
    return "expirada";
  }
}

/**
 * Faz login **somente se necessário**:
 * - Se já estiver autenticado (emissão visível), NÃO tenta logar.
 * - Se não for tela de login, tenta ir direto pra emissão.
 * - Só digita credenciais quando a tela de login está presente.
 * Salva cookies no fim.
 */
export async function fazerLogin(page, cfg = CONFIG) {
  if (cfg.VERBOSE) {
    logger.info("🔑 Realizando login…");
  }
  // Garante que estamos no domínio alvo
  await page.goto(cfg.ISS_JARU, { waitUntil: "domcontentloaded" });

  // 1) Já autenticado? (sentinela na tela atual)
  if (await hasEmissionSentinel(page, 1500)) {
    if (cfg.VERBOSE) {
      logger.info("✅ Sessão já autenticada — pulando login.");
    }
    await salvarCookies(page, cfg);
    return;
  }

  // 2) Tela de login presente?
  if (!(await isLoginScreen(page))) {
    // Não é login; pode estar autenticado em outra tela
    logger.warn("ℹ️ Não é a tela de login. Tentando ir direto para a emissão.");
    await ensurePaginaEmissao(page, "pós-deteção de não-login", cfg);
    await salvarCookies(page, cfg);
    return;
  }

  // 3) É login de fato — procede
  if (cfg.VERBOSE) {
    logger.info(
      `🧭 Campos de login detectados: user="${USER_SEL}" pass="${PASS_SEL}"`,
    );
  }

  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el) el.value = "";
  }, USER_SEL);
  await page.type(USER_SEL, (cfg.USERNAME || "").trim(), { delay: 15 });

  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el) el.value = "";
  }, PASS_SEL);
  await page.type(PASS_SEL, (cfg.PASSWORD || "").trim(), { delay: 15 });

  if (cfg.VERBOSE) {
    logger.info(`👉 Clicando no botão de login: "${BTN_SEL}"`);
  }
  await Promise.all([
    page.waitForNavigation({
      waitUntil: "domcontentloaded",
      timeout: Number(cfg.NAVIGATION_TIMEOUT_MS ?? 45000),
    }),
    page.click(BTN_SEL),
  ]);

  // Se ainda for a tela de login, falhou
  if (await isLoginScreen(page)) {
    throw new Error("Credenciais inválidas ou bloqueio no login.");
  }

  if (cfg.VERBOSE) {
    logger.info("✅ Login realizado com sucesso!");
  }
  await ensurePaginaEmissao(page, "pós-login", cfg);
  await salvarCookies(page, cfg);
}

/** Salva cookies atuais em disco (best-effort). */
async function salvarCookies(page, cfg = CONFIG) {
  try {
    const cookies = await page.cookies();
    await fs.writeFile(cfg.COOKIE_FILE, JSON.stringify(cookies, null, 2));
    if (cfg.VERBOSE) {
      logger.info("💾 Cookies salvos para próximas execuções.");
    }
  } catch (e) {
    if (cfg.VERBOSE) {
      logger.warn(`⚠️ Não foi possível salvar cookies: ${e.message}`);
    }
  }
}

/** Compat: redireciona para emissão (mantém API antiga, caso chamada em algum lugar) */
export async function redirecionaPagina(page, cfg = CONFIG) {
  await ensurePaginaEmissao(page, "redirecionaPagina()", cfg);
}
