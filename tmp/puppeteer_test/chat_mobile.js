const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ 
    headless: 'new',
    // Emulate a mobile device setting just in case it's related
    defaultViewport: { width: 375, height: 667, isMobile: true } 
  });
  const page = await browser.newPage();

  page.on('console', msg => {
    console.log(`[${msg.type()}] ${msg.text()}`);
  });

  page.on('pageerror', error => {
    console.log('PAGE ERROR:', error.message);
  });

  await page.goto('https://nlvip.vercel.app', { waitUntil: 'networkidle2' });
  await page.type('input[type="email"]', 'ricardbonfill2@gmail.com');
  await page.type('input[type="password"]', 'said1994');
  
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {}),
    page.click('button[type="submit"]')
  ]);

  console.log('Logueado. Esperando 3 segundos...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('Intentado hacer clic en el botón flotante del chat...');
  await page.evaluate(() => {
    try {
      const buttons = Array.from(document.querySelectorAll('button'));
      const chatBtn = buttons.find(b => b.className.includes('right-6') && b.className.includes('fixed') && b.className.includes('rounded-full'));
      if (chatBtn) {
        console.log('Botón de chat encontrado. Simulando clic...');
        chatBtn.click();
      } else {
        console.log('No se encontró el botón de chat!');
      }
    } catch(e) {
      console.log('Error al buscar botón:', e.message);
    }
  });

  console.log('Clic hecho. Esperando 4 segundos de carga asíncrona de conversaciones...');
  await new Promise(resolve => setTimeout(resolve, 4000));

  console.log('Intentando hacer clic en la pestaña "Administración"...');
  await page.evaluate(() => {
    const adminTab = Array.from(document.querySelectorAll('button')).find(b => b.innerText && b.innerText.includes('Administración'));
    if (adminTab) {
      console.log('Pestaña de Admin encontrada. Haciendo clic...');
      adminTab.click();
    } else {
      console.log('Pestaña de Admin no encontrada!');
    }
  });

  await new Promise(resolve => setTimeout(resolve, 2000));
  await browser.close();
})();
