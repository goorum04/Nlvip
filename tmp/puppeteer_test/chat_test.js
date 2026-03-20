const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  let pageErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      pageErrors.push('CONSOLE ERROR: ' + msg.text());
    }
  });

  page.on('pageerror', error => {
    pageErrors.push('PAGE ERROR: ' + error.message);
  });

  await page.goto('https://nlvip.vercel.app', { waitUntil: 'networkidle2' });
  
  // Vamos a usar Nacho porque suele haber más errores de Admin
  await page.type('input[type="email"]', 'nacholostao28@gmail.com');
  await page.type('input[type="password"]', 'nacholostao28');
  
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {}),
    page.click('button[type="submit"]')
  ]);

  await new Promise(resolve => setTimeout(resolve, 3000));

  // Intentar abrir el chat!
  console.log('Intentando hacer clic en la burbuja de chat...');
  await page.evaluate(() => {
    // Buscar el boton flotante del chat por su icono o clases
    const buttons = Array.from(document.querySelectorAll('button'));
    const chatBtn = buttons.find(b => b.className.includes('right-6') && b.className.includes('fixed') && b.className.includes('rounded-full'));
    if (chatBtn) {
      chatBtn.click();
    }
  });

  // Darle 3 segundos para que crashee
  await new Promise(resolve => setTimeout(resolve, 3000));

  const pageData = await page.evaluate(() => {
    const errorTitle = document.querySelector('.text-red-400');
    if (errorTitle && errorTitle.innerText.includes('Error Crítico')) {
      const details = document.querySelector('details pre');
      const pre = document.querySelector('pre.text-red-200');
      return {
        type: 'error_boundary',
        message: pre ? pre.innerText : 'No message found',
        stack: details ? details.innerText : 'No stack found'
      };
    }
    
    if (document.body.innerText.includes('A client-side exception has occurred')) {
      return { type: 'generic_error', text: 'A client-side exception has occurred' };
    }

    return { type: 'success', text: document.body.innerText.substring(0, 300) };
  });

  pageData.errors = pageErrors;
  fs.writeFileSync('result_chat.json', JSON.stringify(pageData, null, 2));

  await browser.close();
})();
