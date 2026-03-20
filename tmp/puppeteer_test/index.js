const puppeteer = require('puppeteer');

(async () => {
  console.log('Lanzando navegador...');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  // Capturar errores de consola
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('CONSOLE ERROR:', msg.text());
    }
  });

  page.on('pageerror', error => {
    console.log('PAGE ERROR:', error.message);
  });

  console.log('Navegando a Vercel...');
  await page.goto('https://nlvip.vercel.app', { waitUntil: 'networkidle2' });

  console.log('Llenando credenciales del socio Ricard...');
  await page.type('input[type="email"]', 'ricardbonfill2@gmail.com');
  await page.type('input[type="password"]', 'said1994');
  
  console.log('Haciendo clic en Entrar...');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {}),
    page.click('button[type="submit"]')
  ]);

  console.log('Esperando a que cargue el dashboard de member (5s)...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Buscar el ErrorBoundary u otros errores
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
    
    // Check if we see the generic Next.js client-side exception text
    if (document.body.innerText.includes('A client-side exception has occurred')) {
      return { type: 'generic_error', text: 'A client-side exception has occurred' };
    }

    // Check if MemberDashboard loaded successfully by looking for some text
    if (document.body.innerText.includes('Mi Progreso') || document.body.innerText.includes('Rutina')) {
      return { type: 'success', text: 'Dashboard cargado con éxito. ' + document.body.innerText.substring(0, 100).replace(/\n/g, ' ') };
    }

    return { type: 'unknown', text: document.body.innerText.substring(0, 300).replace(/\n/g, ' ') };
  });

  console.log('>>> RESULTADO:', JSON.stringify(pageData, null, 2));

  await browser.close();
  console.log('Fin del script.');
})();
