const puppeteer = require('puppeteer');
const fs = require('fs');

const BASE_URL = 'https://nlvip.vercel.app';
const ADMIN_EMAIL = 'nacholostao28@gmail.com';
const ADMIN_PASS = 'nacholostao28';
const MEMBER_EMAIL = 'maria@demo.com';
const MEMBER_PASS = 'Demo1234!';
const TEST_EMAIL = `testaudit${Date.now()}@prueba.com`;
const TEST_PASS = 'TestAudit1!';

const results = [];
let invitationCode = null;

function log(section, status, detail) {
  const entry = { section, status, detail };
  results.push(entry);
  const icon = status === 'OK' ? '✅' : status === 'WARN' ? '⚠️' : '❌';
  console.log(`${icon} [${section}] ${detail}`);
}

async function waitAndScreenshot(page, name, waitMs = 3000) {
  await new Promise(r => setTimeout(r, waitMs));
  await page.screenshot({ path: `screenshot_${name}.png`, fullPage: false });
}

async function getPageText(page) {
  return page.evaluate(() => document.body.innerText.substring(0, 500));
}

async function getConsoleErrors(page) {
  return page._consoleErrors || [];
}

// ── LOGIN ─────────────────────────────────────────────────────────────────
async function login(page, email, password) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));

  // Esperar formulario de login
  try {
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  } catch {
    // Puede que ya esté en dashboard o en otra página
    const url = page.url();
    const text = await getPageText(page);
    return { alreadyLoggedIn: true, url, text };
  }

  await page.type('input[type="email"]', email, { delay: 50 });
  await page.type('input[type="password"]', password, { delay: 50 });
  
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {}),
    page.click('button[type="submit"]')
  ]);

  await new Promise(r => setTimeout(r, 4000));
  return { url: page.url(), text: await getPageText(page) };
}

async function logout(page) {
  try {
    // Buscar botón de logout
    const logoutBtn = await page.$('[data-testid="logout"], button:has-text("Cerrar sesión"), button:has-text("Logout"), button:has-text("Salir")');
    if (logoutBtn) {
      await logoutBtn.click();
      await new Promise(r => setTimeout(r, 2000));
      return true;
    }
    // Intentar via URL de auth
    await page.goto(`${BASE_URL}/api/auth/signout`, { waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
    // Limpiar cookies + localStorage como fallback
    const client = await page.target().createCDPSession();
    await client.send('Network.clearBrowserCookies');
    await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch(e) {} });
    return true;
  } catch (e) {
    return false;
  }
}

// ══════════════════════════════════════════════════════════════════════════
(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    defaultViewport: { width: 1280, height: 900 }
  });

  const page = await browser.newPage();
  
  // Capturar errores de consola
  page._consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') page._consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => page._consoleErrors.push('PAGE ERROR: ' + err.message));

  try {

    // ─── FASE 1: LOGIN ADMIN ───────────────────────────────────────────
    console.log('\n══ FASE 1: LOGIN ADMIN ══');
    const loginResult = await login(page, ADMIN_EMAIL, ADMIN_PASS);
    const pageText = await getPageText(page);
    const currentUrl = page.url();
    await waitAndScreenshot(page, '01_admin_login', 1000);
    
    if (pageText.includes('Error') && pageText.includes('credenciales')) {
      log('Login Admin', 'ERROR', 'Credenciales rechazadas');
    } else if (currentUrl.includes('nlvip.vercel.app') && !currentUrl.includes('/error')) {
      log('Login Admin', 'OK', `Sesión iniciada. URL: ${currentUrl}`);
    } else {
      log('Login Admin', 'WARN', `URL inesperada: ${currentUrl}. Texto: ${pageText.substring(0, 100)}`);
    }

    // ─── FASE 2: EXPLORAR DASHBOARD ADMIN ─────────────────────────────
    console.log('\n══ FASE 2: DASHBOARD ADMIN ══');
    await new Promise(r => setTimeout(r, 3000));
    const dashText = await getPageText(page);
    await waitAndScreenshot(page, '02_admin_dashboard', 500);

    const hasAdminIndicators = dashText.includes('Admin') || dashText.includes('Socios') || 
                               dashText.includes('Dashboard') || dashText.includes('Panel');
    if (hasAdminIndicators) {
      log('Dashboard Admin', 'OK', `Contenido visible: ${dashText.substring(0, 150)}`);
    } else {
      log('Dashboard Admin', 'WARN', `Contenido desconocido: ${dashText.substring(0, 150)}`);
    }

    // ─── FASE 3: SECCIÓN SOCIOS ───────────────────────────────────────
    console.log('\n══ FASE 3: SECCIÓN SOCIOS ══');
    
    // Buscar tabs/botones de socios
    const sociosSelectors = [
      'button::-p-text("Socios")', 'a::-p-text("Socios")',
      'button::-p-text("Miembros")', 'a::-p-text("Miembros")',
      '[data-tab="members"]', '[data-tab="socios"]'
    ];
    
    let sociosFound = false;
    for (const sel of sociosSelectors) {
      try {
        const el = await page.$(sel);
        if (el) {
          await el.click();
          await new Promise(r => setTimeout(r, 3000));
          sociosFound = true;
          break;
        }
      } catch {}
    }

    if (!sociosFound) {
      // Intentar buscar por texto
      const clicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, a, [role="tab"]'));
        const sociosBtn = buttons.find(b => 
          b.textContent.includes('Socios') || b.textContent.includes('Usuarios') || 
          b.textContent.includes('Miembros') || b.textContent.includes('Members')
        );
        if (sociosBtn) { sociosBtn.click(); return sociosBtn.textContent.trim(); }
        return null;
      });
      if (clicked) {
        sociosFound = true;
        await new Promise(r => setTimeout(r, 3000));
      }
    }

    await waitAndScreenshot(page, '03_socios_tab', 500);
    const sociosText = await getPageText(page);
    
    if (sociosFound) {
      log('Sección Socios', 'OK', `Tab encontrado. Contenido: ${sociosText.substring(0, 150)}`);
    } else {
      log('Sección Socios', 'WARN', `No se encontró tab de socios. Contenido actual: ${sociosText.substring(0, 150)}`);
    }

    const hasMaria = sociosText.includes('maria') || sociosText.includes('Maria') || sociosText.includes('demo');
    log('Socio Maria', hasMaria ? 'OK' : 'WARN', hasMaria ? 'maria@demo.com encontrada en la lista' : 'maria@demo.com no visible en lista');

    // ─── FASE 4: CÓDIGOS DE INVITACIÓN ────────────────────────────────
    console.log('\n══ FASE 4: CÓDIGOS DE INVITACIÓN ══');
    
    const codigoClicked = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('button, a, [role="tab"], li, div[onClick]'));
      const btn = all.find(b => 
        b.textContent.includes('Invitación') || b.textContent.includes('Código') || 
        b.textContent.includes('Invitation') || b.textContent.includes('Codes')
      );
      if (btn) { btn.click(); return btn.textContent.trim(); }
      return null;
    });

    if (codigoClicked) {
      await new Promise(r => setTimeout(r, 2000));
      await waitAndScreenshot(page, '04_codigos_invitacion', 500);
      log('Tab Códigos Invitación', 'OK', `Found: ${codigoClicked}`);
      
      // Intentar generar un código
      const generarBtn = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const btn = btns.find(b => 
          b.textContent.includes('Generar') || b.textContent.includes('Nuevo') || 
          b.textContent.includes('Crear') || b.textContent.includes('Generate')
        );
        if (btn) { btn.click(); return btn.textContent.trim(); }
        return null;
      });

      if (generarBtn) {
        await new Promise(r => setTimeout(r, 3000));
        await waitAndScreenshot(page, '04b_codigo_generado', 500);
        
        // Intentar extraer el código generado
        invitationCode = await page.evaluate(() => {
          const codeEls = document.querySelectorAll('code, .code, [class*="code"], input[readonly], [class*="invitation"]');
          for (const el of codeEls) {
            const text = el.textContent || el.value;
            if (text && text.length >= 6 && text.length <= 20) return text.trim();
          }
          // Buscar en texto general
          const body = document.body.innerText;
          const match = body.match(/[A-Z0-9]{6,12}/g);
          return match ? match[0] : null;
        });
        
        log('Generar Código', 'OK', `Código: ${invitationCode || '(no extraído automáticamente)'}`);
      } else {
        log('Generar Código', 'WARN', 'No se encontró botón de generar código');
      }
    } else {
      log('Tab Códigos Invitación', 'WARN', 'No se encontró sección de códigos de invitación');
    }

    // ─── FASE 5: DETALLE DE SOCIO Y ASIGNAR DIETA ─────────────────────
    console.log('\n══ FASE 5: DETALLE DE SOCIO ══');
    
    // Volver a socios
    await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('button, a, [role="tab"]'));
      const btn = all.find(b => b.textContent.includes('Socios') || b.textContent.includes('Miembros'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 2000));

    // Clickar en el primer socio
    const memberClicked = await page.evaluate(() => {
      const rows = document.querySelectorAll('tr, [class*="member"], [class*="socio"], [class*="user-row"]');
      if (rows.length > 1) {
        rows[1].click();
        return 'clicked row';
      }
      // Intentar click en cualquier elemento que parezca una fila de usuario
      const items = document.querySelectorAll('li, .list-item, [class*="list"]');
      if (items.length > 0) { items[0].click(); return 'clicked list item'; }
      return null;
    });

    await new Promise(r => setTimeout(r, 2000));
    await waitAndScreenshot(page, '05_detalle_socio', 500);
    const detalleText = await getPageText(page);
    
    if (memberClicked) {
      log('Detalle Socio', 'OK', `Panel abierto. Contenido: ${detalleText.substring(0, 150)}`);
    } else {
      log('Detalle Socio', 'WARN', `No se pudo abrir detalle. Contenido: ${detalleText.substring(0, 150)}`);
    }

    // Buscar opción de dieta
    const dietaOption = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('button'));
      const btn = all.find(b => 
        b.textContent.includes('Dieta') || b.textContent.includes('Diet') || 
        b.textContent.includes('Nutrición') || b.textContent.includes('Enviar formulario')
      );
      return btn ? btn.textContent.trim() : null;
    });
    log('Opción Dieta en Detalle', dietaOption ? 'OK' : 'WARN', dietaOption ? `Botón encontrado: ${dietaOption}` : 'No se encontró opción de dieta');

    // ─── FASE 6: AI ASSISTANT ─────────────────────────────────────────
    console.log('\n══ FASE 6: AI ASSISTANT ADMIN ══');
    
    const aiClicked = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('button, a, [role="tab"]'));
      const btn = all.find(b => 
        b.textContent.includes('Asistente') || b.textContent.includes('AI') || 
        b.textContent.includes('Chat') || b.textContent.includes('Assistant')
      );
      if (btn) { btn.click(); return btn.textContent.trim(); }
      return null;
    });

    if (aiClicked) {
      await new Promise(r => setTimeout(r, 2000));
      await waitAndScreenshot(page, '06_ai_assistant', 500);
      
      // Escribir mensaje de prueba
      const chatInput = await page.$('textarea, input[placeholder*="escrib"], input[placeholder*="mensaje"], input[placeholder*="Pregunta"]');
      if (chatInput) {
        await chatInput.type('¿Cuántos socios tenemos registrados?', { delay: 50 });
        await new Promise(r => setTimeout(r, 500));
        
        const sendBtn = await page.$('button[type="submit"], button::-p-text("Enviar"), button::-p-text("Send")');
        if (sendBtn) {
          await sendBtn.click();
          await new Promise(r => setTimeout(r, 8000)); // Esperar respuesta AI
          await waitAndScreenshot(page, '06b_ai_response', 500);
          const aiText = await getPageText(page);
          log('AI Assistant', 'OK', `Respuesta AI: ${aiText.substring(0, 200)}`);
        } else {
          log('AI Assistant', 'WARN', 'No se encontró botón de envío');
        }
      } else {
        log('AI Assistant', 'WARN', 'No se encontró campo de texto del chat');
      }
    } else {
      log('AI Assistant', 'WARN', `No se encontró tab de AI. Tab clickado: ${aiClicked}`);
    }

    // ─── FASE 7: LOGOUT ───────────────────────────────────────────────
    console.log('\n══ FASE 7: LOGOUT ADMIN ══');
    const loggedOut = await logout(page);
    log('Logout Admin', loggedOut ? 'OK' : 'WARN', loggedOut ? 'Sesión cerrada' : 'Cierre de sesión manual');

    // ─── FASE 8: REGISTRO CON CÓDIGO INVITACIÓN ───────────────────────
    console.log('\n══ FASE 8: REGISTRO CON CÓDIGO DE INVITACIÓN ══');
    
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));
    await waitAndScreenshot(page, '08_home_logout', 500);
    
    // Buscar botón de registro
    const registerBtn = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('button, a'));
      const btn = all.find(b => 
        b.textContent.includes('Regístrate') || b.textContent.includes('Registro') || 
        b.textContent.includes('Register') || b.textContent.includes('Crear cuenta') ||
        b.textContent.includes('¿No tienes cuenta?') || b.textContent.includes('Únete')
      );
      if (btn) { btn.click(); return btn.textContent.trim(); }
      return null;
    });

    await new Promise(r => setTimeout(r, 2000));
    await waitAndScreenshot(page, '08b_register_form', 500);
    
    if (registerBtn) {
      log('Botón Registro', 'OK', `Encontrado: ${registerBtn}`);
      
      // Buscar campos de registro
      const hasCodeField = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input'));
        return inputs.some(i => 
          (i.placeholder || '').toLowerCase().includes('código') || 
          (i.placeholder || '').toLowerCase().includes('code') ||
          (i.placeholder || '').toLowerCase().includes('invitación') ||
          (i.name || '').toLowerCase().includes('code') ||
          (i.name || '').toLowerCase().includes('codigo')
        );
      });
      
      log('Campo Código Invitación', hasCodeField ? 'OK' : 'WARN', hasCodeField ? 'Campo de código encontrado en el formulario de registro' : 'No se encontró campo de código de invitación en registro');
      
      // Intentar llenar el formulario si hay campos
      const formFields = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input'));
        return inputs.map(i => ({ type: i.type, placeholder: i.placeholder, name: i.name }));
      });
      log('Campos Formulario Registro', 'OK', JSON.stringify(formFields));
      
    } else {
      log('Botón Registro', 'WARN', 'No se encontró botón de registro en la página principal');
    }

    // ─── FASE 9: LOGIN COMO SOCIO ─────────────────────────────────────
    console.log('\n══ FASE 9: LOGIN COMO SOCIO ══');
    
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));
    
    const memberLogin = await login(page, MEMBER_EMAIL, MEMBER_PASS);
    await new Promise(r => setTimeout(r, 4000));
    await waitAndScreenshot(page, '09_member_login', 500);
    
    const memberDashText = await getPageText(page);
    const memberUrl = page.url();
    
    if (memberDashText.includes('Error') || memberDashText.includes('error')) {
      log('Login Socio', 'ERROR', `Error al iniciar sesión: ${memberDashText.substring(0, 200)}`);
    } else {
      log('Login Socio', 'OK', `URL: ${memberUrl}. Contenido: ${memberDashText.substring(0, 150)}`);
    }

    // ─── FASE 10: DASHBOARD SOCIO ─────────────────────────────────────
    console.log('\n══ FASE 10: DASHBOARD SOCIO ══');
    await new Promise(r => setTimeout(r, 3000));
    const memberDash2 = await getPageText(page);
    await waitAndScreenshot(page, '10_member_dashboard', 500);
    
    const hasWorkout = memberDash2.includes('Rutina') || memberDash2.includes('Workout') || memberDash2.includes('Entreno');
    const hasDiet = memberDash2.includes('Dieta') || memberDash2.includes('Diet') || memberDash2.includes('Nutrición');
    const hasProgress = memberDash2.includes('Progreso') || memberDash2.includes('Progress');
    
    log('Dashboard Socio - Rutina', hasWorkout ? 'OK' : 'WARN', hasWorkout ? 'Sección de rutina visible' : 'No se ve sección de rutina');
    log('Dashboard Socio - Dieta', hasDiet ? 'OK' : 'WARN', hasDiet ? 'Sección de dieta visible' : 'No se ve sección de dieta');
    log('Dashboard Socio - Progreso', hasProgress ? 'OK' : 'WARN', hasProgress ? 'Sección de progreso visible' : 'No se ve sección de progreso');

    // ─── FASE 11: CHAT AI SOCIO ───────────────────────────────────────
    console.log('\n══ FASE 11: CHAT AI SOCIO ══');
    
    const memberAiClicked = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('button, a, [role="tab"]'));
      const btn = all.find(b => 
        b.textContent.includes('Chat') || b.textContent.includes('Asistente') || 
        b.textContent.includes('AI') || b.textContent.includes('Nutricionista')
      );
      if (btn) { btn.click(); return btn.textContent.trim(); }
      return null;
    });

    if (memberAiClicked) {
      await new Promise(r => setTimeout(r, 2000));
      const chatInput = await page.$('textarea, input[placeholder*="escrib"], input[placeholder*="mensaje"]');
      if (chatInput) {
        await chatInput.type('Hola, ¿cuál es mi dieta actual?', { delay: 50 });
        const sendBtn = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const btn = btns.find(b => b.type === 'submit' || b.textContent.includes('Enviar') || b.textContent.includes('Send'));
          if (btn) { btn.click(); return btn.textContent.trim(); }
          return null;
        });
        if (sendBtn) {
          await new Promise(r => setTimeout(r, 8000));
          await waitAndScreenshot(page, '11_member_chat', 500);
          const chatResponse = await getPageText(page);
          log('Chat AI Socio', 'OK', `Respuesta: ${chatResponse.substring(0, 200)}`);
        } else {
          log('Chat AI Socio', 'WARN', 'No se encontró botón de enviar');
        }
      } else {
        log('Chat AI Socio', 'WARN', 'No se encontró campo de chat del socio');
      }
    } else {
      log('Chat AI Socio', 'WARN', 'No se encontró sección de chat en dashboard de socio');
    }

    // ─── ERRORES DE CONSOLA ────────────────────────────────────────────
    const consoleErrors = page._consoleErrors;
    if (consoleErrors.length > 0) {
      log('Errores de Consola', 'WARN', `${consoleErrors.length} errores: ${consoleErrors.slice(0, 3).join(' | ')}`);
    } else {
      log('Errores de Consola', 'OK', 'Sin errores de consola detectados');
    }

  } catch (err) {
    log('ERROR CRÍTICO', 'ERROR', err.message);
    await page.screenshot({ path: 'screenshot_error.png', fullPage: false }).catch(() => {});
  } finally {
    await browser.close();
  }

  // ─── REPORTE FINAL ─────────────────────────────────────────────────
  const ok = results.filter(r => r.status === 'OK').length;
  const warn = results.filter(r => r.status === 'WARN').length;
  const error = results.filter(r => r.status === 'ERROR').length;

  const report = {
    resumen: { total: results.length, ok, warn, error },
    codigoInvitacion: invitationCode,
    detalles: results
  };

  fs.writeFileSync('audit_report.json', JSON.stringify(report, null, 2));
  
  console.log('\n══════════════════════════════════════════');
  console.log(`RESUMEN AUDITORÍA: ✅ ${ok} OK  |  ⚠️  ${warn} AVISOS  |  ❌ ${error} ERRORES`);
  if (invitationCode) console.log(`CÓDIGO DE INVITACIÓN GENERADO: ${invitationCode}`);
  console.log('Reporte completo en: audit_report.json');
  console.log('Screenshots guardados como: screenshot_*.png');
})();
