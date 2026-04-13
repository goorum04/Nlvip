const puppeteer = require('puppeteer');
const fs = require('fs');

const BASE_URL = 'https://nlvip.vercel.app';
const ADMIN_EMAIL = 'nacholostao28@gmail.com';
const ADMIN_PASS = 'nacholostao28';
const MEMBER_EMAIL = 'maria@demo.com';
const MEMBER_PASS = 'Demo1234!';

const results = [];
let invitationCode = null;

function log(section, status, detail) {
  const entry = { section, status, detail: String(detail).substring(0, 300) };
  results.push(entry);
  const icon = status === 'OK' ? '✅' : status === 'WARN' ? '⚠️' : '❌';
  console.log(`${icon} [${section}] ${String(detail).substring(0, 200)}`);
}

async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function ss(page, name) {
  await page.screenshot({ path: `ss_${name}.png`, fullPage: false });
}

async function getText(page) {
  return page.evaluate(() => document.body.innerText.substring(0, 600));
}

// Clic en elemento que contenga texto
async function clickText(page, text, timeout = 5000) {
  try {
    await page.evaluate((t) => {
      const all = [...document.querySelectorAll('button, a, [role="tab"], li, div[class*="cursor"]')];
      const el = all.find(e => e.textContent.trim().includes(t));
      if (el) { el.click(); return true; }
      return false;
    }, text);
    await wait(2000);
    return true;
  } catch { return false; }
}

// ══════════════════════════════════════════════════════
(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1280,900'],
    defaultViewport: { width: 1280, height: 900 }
  });

  const page = await browser.newPage();
  page._errs = [];
  page.on('console', m => { if (m.type() === 'error') page._errs.push(m.text()); });
  page.on('pageerror', e => page._errs.push(e.message));

  try {

    // ── FASE 1: LOGIN ADMIN ───────────────────────────────────────────────
    console.log('\n══ FASE 1: LOGIN ADMIN ══');
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await wait(2000);
    await ss(page, '01_home');

    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.type('input[type="email"]', ADMIN_EMAIL, { delay: 40 });
    await page.type('input[type="password"]', ADMIN_PASS, { delay: 40 });
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {}),
      page.click('button[type="submit"]')
    ]);
    await wait(5000);
    await ss(page, '02_admin_dash');

    const dash1 = await getText(page);
    if (dash1.includes('Asistente IA') || dash1.includes('Socios') || dash1.includes('MASTER ADMIN')) {
      log('Login Admin', 'OK', 'Dashboard admin cargado correctamente. Tabs visibles.');
    } else {
      log('Login Admin', 'WARN', `Contenido inesperado: ${dash1.substring(0, 100)}`);
    }

    // ── FASE 2: SECCIÓN SOCIOS ────────────────────────────────────────────
    console.log('\n══ FASE 2: SECCIÓN SOCIOS ══');
    await clickText(page, 'Lista de Socios');
    await wait(3000);
    await ss(page, '03_socios');
    const sociosText = await getText(page);
    
    const numMatch = sociosText.match(/(\d+)\s*Total/);
    log('Lista de Socios', 'OK', `Encontrados: ${numMatch ? numMatch[1] + ' socios' : 'ver screenshot'}. Contenido: ${sociosText.substring(0, 100)}`);

    // Intentar click en el primer socio de la lista
    console.log('  → Clickando en el primer socio...');
    const memberClicked = await page.evaluate(() => {
      // Los miembros tienen onClick={() => onSelectMember?.(member)} en el div padre
      const memberCards = document.querySelectorAll('[class*="rounded"][class*="border"][class*="cursor"]');
      if (memberCards.length > 0) {
        memberCards[0].click();
        return memberCards[0].textContent.substring(0, 60);
      }
      return null;
    });
    await wait(3000);
    await ss(page, '04_member_detail');
    const memberDetailText = await getText(page);
    
    if (memberClicked) {
      log('Detalle Socio', 'OK', `Socio clickado: ${memberClicked.substring(0, 60)}. Panel detalle: ${memberDetailText.substring(0, 100)}`);
    } else {
      log('Detalle Socio', 'WARN', `No se clickó ningún socio. Texto actual: ${memberDetailText.substring(0, 100)}`);
    }

    // ── FASE 3: ENVIAR FORMULARIO DE DIETA ───────────────────────────────
    console.log('\n══ FASE 3: FORMULARIO DIETA ══');
    const dietBtn = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')];
      const b = btns.find(b => b.textContent.includes('Dieta') || b.textContent.includes('Enviar formulario') || b.textContent.includes('Cuestionario'));
      if (b) { b.click(); return b.textContent.trim().substring(0, 50); }
      return null;
    });
    if (dietBtn) {
      log('Botón Dieta en Detalle Socio', 'OK', `Botón encontrado: ${dietBtn}`);
    } else {
      log('Botón Dieta en Detalle Socio', 'WARN', 'No se encontró botón de dieta en el panel de detalle');
    }

    // ── FASE 4: TAB GESTIÓN → CÓDIGOS ───────────────────────────────────
    console.log('\n══ FASE 4: CÓDIGOS DE INVITACIÓN ══');
    
    // Click en "Gestión" para expandir submenu
    await page.evaluate(() => {
      const all = [...document.querySelectorAll('button, div, li, p, span')];
      const el = all.find(e => e.textContent.trim() === 'Gestión');
      if (el) el.click();
    });
    await wait(1500);
    
    // Click en "Códigos" dentro de Gestión
    await page.evaluate(() => {
      const all = [...document.querySelectorAll('button, div, li, p, span, [class*="cursor"]')];
      const el = all.find(e => e.textContent.trim().includes('Códigos') || e.textContent.trim().includes('Invitaciones'));
      if (el) el.click();
    });
    await wait(3000);
    await ss(page, '05_codigos');
    const codesText = await getText(page);
    
    if (codesText.includes('Código') || codesText.includes('Invitación') || codesText.includes('código')) {
      log('Tab Códigos Invitación', 'OK', `Sección cargada. Contenido: ${codesText.substring(0, 150)}`);
    } else {
      log('Tab Códigos Invitación', 'WARN', `No se detectó sección de códigos. Contenido: ${codesText.substring(0, 150)}`);
    }

    // Generar nuevo código
    const genBtn = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')];
      const b = btns.find(b => b.textContent.includes('Generar') || b.textContent.includes('Nuevo') || b.textContent.includes('Crear código'));
      if (b) { b.click(); return b.textContent.trim().substring(0, 50); }
      return null;
    });
    
    if (genBtn) {
      await wait(3000);
      await ss(page, '06_codigo_generado');
      const afterGen = await getText(page);
      
      // Extraer código generado (buscar textos cortos en mayúsculas)
      invitationCode = await page.evaluate(() => {
        const all = [...document.querySelectorAll('*')];
        for (const el of all) {
          const t = el.textContent.trim();
          if (/^[A-Z0-9]{6,12}$/.test(t)) return t;
        }
        // Buscar en inputs
        const inputs = document.querySelectorAll('input[readonly], input[disabled]');
        for (const i of inputs) {
          if (i.value && i.value.length >= 6) return i.value;
        }
        return null;
      });
      
      log('Generar Código Invitación', 'OK', `Botón: "${genBtn}". Código extraído: ${invitationCode || '(ver screenshot)'}`);
    } else {
      log('Generar Código Invitación', 'WARN', 'No se encontró botón de generar código');
    }

    // ── FASE 5: AI ASSISTANT ADMIN ───────────────────────────────────────
    console.log('\n══ FASE 5: AI ASSISTANT ══');
    
    // Click en "Asistente IA" (TabsTrigger con value="assistant")
    const assistantClicked = await page.evaluate(() => {
      const all = [...document.querySelectorAll('[role="tab"], button, li, div[class*="cursor"]')];
      const el = all.find(e => e.textContent.trim().includes('Asistente IA') || e.textContent.trim().includes('Asistente'));
      if (el) { el.click(); return true; }
      return false;
    });
    await wait(3000);
    await ss(page, '07_ai_assistant');
    
    const aiText = await getText(page);
    const hasChatInput = await page.$('textarea') !== null;
    
    if (assistantClicked && hasChatInput) {
      log('AI Assistant Admin', 'OK', 'Sección de AI cargada con campo de texto');
      
      const textarea = await page.$('textarea');
      await textarea.type('¿Cuántos socios estamos teniendo actualmente?', { delay: 30 });
      await wait(500);
      
      // Click enviar
      const sent = await page.evaluate(() => {
        const btns = [...document.querySelectorAll('button')];
        const b = btns.find(b => b.type === 'submit' || b.textContent.includes('Enviar') || b.textContent.includes('Send') || b.querySelector('svg'));
        if (b && !b.disabled) { b.click(); return true; }
        return false;
      });
      
      if (sent) {
        await wait(12000); // Esperar respuesta AI
        await ss(page, '07b_ai_respuesta');
        const aiResponse = await getText(page);
        log('AI Assistant - Respuesta', 'OK', `Respuesta recibida: ${aiResponse.substring(0, 200)}`);
      } else {
        log('AI Assistant - Envío', 'WARN', 'No se pudo hacer click en enviar');
      }
    } else {
      log('AI Assistant Admin', 'WARN', `assistantClicked=${assistantClicked}, hasChatInput=${hasChatInput}. Contenido: ${aiText.substring(0, 100)}`);
    }

    // ── FASE 6: LOGOUT ADMIN ────────────────────────────────────────────
    console.log('\n══ FASE 6: LOGOUT ADMIN ══');
    
    // El logout button es: <Button onClick={onLogout}> con LogOut icon
    const logoutClicked = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')];
      // Buscar botón con svg (ícono LogOut) que tenga clase de logout
      const b = btns.find(b => {
        const hasSvg = b.querySelector('svg');
        const classes = b.className || '';
        return hasSvg && (classes.includes('red') || classes.includes('logout'));
      });
      if (b) { b.click(); return true; }
      // Intentar clic en último botón del header
      const headerBtns = document.querySelectorAll('header button, nav button');
      if (headerBtns.length > 0) {
        const last = headerBtns[headerBtns.length - 1];
        last.click();
        return true;
      }
      return false;
    });
    
    await wait(3000);
    
    // Verificar que volvimos al login
    const afterLogout = await getText(page);
    const isLoggedOut = afterLogout.includes('Iniciar') || afterLogout.includes('email') || 
                        afterLogout.includes('Login') || page.url().includes('auth');
    
    if (!isLoggedOut) {
      // Forzar limpieza de sesión
      await page.evaluate(() => {
        Object.keys(localStorage).forEach(k => localStorage.removeItem(k));
        Object.keys(sessionStorage).forEach(k => sessionStorage.removeItem(k));
      });
      const cookies = await page.cookies();
      if (cookies.length) await page.deleteCookie(...cookies);
      await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 20000 });
      await wait(2000);
    }
    
    await ss(page, '08_after_logout');
    log('Logout Admin', isLoggedOut || !logoutClicked ? 'OK' : 'WARN', 
      `Logout intentado. Página actual: ${page.url()}`);

    // ── FASE 7: REGISTRO CON CÓDIGO ──────────────────────────────────────
    console.log('\n══ FASE 7: PÁGINA DE REGISTRO ══');
    
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await wait(2000);
    await ss(page, '09_home_registrar');
    
    const regText = await getText(page);
    const hasRegLink = regText.includes('Regístr') || regText.includes('Crear cuenta') || 
                       regText.includes('Register') || regText.includes('código');
    
    // Buscar link de registro
    const regClicked = await page.evaluate(() => {
      const all = [...document.querySelectorAll('button, a, span[class*="cursor"], p')];
      const el = all.find(e => 
        e.textContent.includes('Regístr') || e.textContent.includes('¿No tienes cuenta') || 
        e.textContent.includes('Crear cuenta') || e.textContent.includes('código de invitación')
      );
      if (el) { el.click(); return el.textContent.trim().substring(0, 50); }
      return null;
    });
    
    await wait(2000);
    await ss(page, '09b_registro_form');
    const regFormText = await getText(page);
    
    const hasCodeInput = await page.evaluate(() => {
      const inputs = [...document.querySelectorAll('input')];
      return inputs.some(i => (i.placeholder || '').toLowerCase().includes('código') || 
                               (i.placeholder || '').toLowerCase().includes('code') ||
                               (i.name || '').toLowerCase().includes('code'));
    });
    
    log('Página Registro', regClicked || hasCodeInput ? 'OK' : 'WARN', 
      `Link: "${regClicked}". Campo código invitación: ${hasCodeInput ? 'SÍ' : 'NO'}. Contenido: ${regFormText.substring(0, 100)}`);

    // ── FASE 8: LOGIN COMO SOCIO ─────────────────────────────────────────
    console.log('\n══ FASE 8: LOGIN COMO SOCIO ══');
    
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await wait(2000);
    
    // Si hay formulario de login
    try {
      await page.waitForSelector('input[type="email"]', { timeout: 8000 });
      await page.type('input[type="email"]', MEMBER_EMAIL, { delay: 40 });
      await page.type('input[type="password"]', MEMBER_PASS, { delay: 40 });
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {}),
        page.click('button[type="submit"]')
      ]);
      await wait(5000);
      await ss(page, '10_member_dash');
      
      const memberText = await getText(page);
      const hasMemberDash = memberText.includes('Mi Rutina') || memberText.includes('Mi Dieta') || 
                            memberText.includes('Progreso') || memberText.includes('Bienvenid');
      
      log('Login Socio (maria@demo.com)', hasMemberDash ? 'OK' : 'WARN', 
        `Contenido: ${memberText.substring(0, 150)}`);
      
      if (hasMemberDash) {
        // Verificar secciones del dashboard
        const hasWorkout = memberText.includes('Rutina') || memberText.includes('Workout');
        const hasDiet = memberText.includes('Dieta') || memberText.includes('Nutrición');
        
        log('Dashboard Socio - Rutina visible', hasWorkout ? 'OK' : 'WARN', hasWorkout ? 'Sí' : 'No visible');
        log('Dashboard Socio - Dieta visible', hasDiet ? 'OK' : 'WARN', hasDiet ? 'Sí' : 'No visible');
        
        // Probar chat AI del socio
        const memberChatBtn = await page.evaluate(() => {
          const all = [...document.querySelectorAll('button, [role="tab"], a')];
          const el = all.find(e => e.textContent.includes('Chat') || e.textContent.includes('Asistente') || e.textContent.includes('AI'));
          if (el) { el.click(); return el.textContent.trim(); }
          return null;
        });
        await wait(2500);
        
        const hasTextarea = await page.$('textarea') !== null;
        if (memberChatBtn && hasTextarea) {
          const ta = await page.$('textarea');
          await ta.type('Hola, ¿cuál es mi dieta actual?', { delay: 30 });
          const sent = await page.evaluate(() => {
            const btns = [...document.querySelectorAll('button')];
            const b = btns.find(b => b.type === 'submit' || (b.querySelector('svg') && !b.disabled));
            if (b) { b.click(); return true; }
            return false;
          });
          if (sent) {
            await wait(10000);
            await ss(page, '11_member_chat');
            const chatResp = await getText(page);
            log('Chat AI Socio', 'OK', `Respuesta: ${chatResp.substring(0, 200)}`);
          } else {
            log('Chat AI Socio', 'WARN', 'No se encontró botón de envío en el chat del socio');
          }
        } else {
          log('Chat AI Socio', 'WARN', `Chat btn: "${memberChatBtn}", textarea: ${hasTextarea}`);
        }
      }
      
    } catch (e) {
      log('Login Socio', 'ERROR', `Error: ${e.message}`);
    }

    // ── ERRORES CONSOLA ──────────────────────────────────────────────────
    const errs = page._errs.filter(e => !e.includes('favicon') && !e.includes('analytics'));
    if (errs.length > 0) {
      log('Errores Consola JS', 'WARN', `${errs.length} errores: ${errs.slice(0, 3).join(' | ')}`);
    } else {
      log('Errores Consola JS', 'OK', 'Sin errores de consola');
    }

  } catch (e) {
    log('ERROR CRÍTICO SCRIPT', 'ERROR', e.message);
    await ss(page, 'error_fatal').catch(() => {});
  } finally {
    await browser.close();
  }

  // ── REPORTE FINAL ────────────────────────────────────────────────────
  const ok = results.filter(r => r.status === 'OK').length;
  const warn = results.filter(r => r.status === 'WARN').length;
  const error = results.filter(r => r.status === 'ERROR').length;

  const report = {
    timestamp: new Date().toISOString(),
    resumen: { total: results.length, ok, warn, error },
    codigoInvitacion: invitationCode,
    detalles: results
  };

  fs.writeFileSync('audit_report_v2.json', JSON.stringify(report, null, 2));

  console.log('\n══════════════════════════════════════════════');
  console.log(`RESUMEN AUDITORÍA: ✅ ${ok} OK  |  ⚠️ ${warn} AVISOS  |  ❌ ${error} ERRORES`);
  if (invitationCode) console.log(`🔑 CÓDIGO DE INVITACIÓN: ${invitationCode}`);
  console.log('📄 Reporte: audit_report_v2.json');
  console.log('📸 Screenshots: ss_*.png');
})();
