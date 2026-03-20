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
  await page.type('input[type="email"]', 'ricardbonfill2@gmail.com');
  await page.type('input[type="password"]', 'said1994');
  
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {}),
    page.click('button[type="submit"]')
  ]);

  await new Promise(resolve => setTimeout(resolve, 5000));

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

    if (document.body.innerText.includes('Mi Progreso') || document.body.innerText.includes('Rutina') || document.body.innerText.includes('Bienvenido')) {
      return { type: 'success', text: document.body.innerText.substring(0, 300) };
    }

    return { type: 'unknown', text: document.body.innerText.substring(0, 300) };
  });

  pageData.errors = pageErrors;
  fs.writeFileSync('result.json', JSON.stringify(pageData, null, 2));

  await browser.close();
})();
