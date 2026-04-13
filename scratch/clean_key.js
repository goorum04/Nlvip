const fs = require('fs');
const path = require('path');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "HIDDEN_KEY";
const replacement = 'process.env.SUPABASE_SERVICE_ROLE_KEY || "HIDDEN_KEY"';

function walk(dir) {
  const files = fs.readdirSync(dir);
  files.forEach(f => {
    const fp = path.join(dir, f);
    if (fs.statSync(fp).isDirectory()) {
      if (!fp.includes('node_modules') && !fp.includes('.git') && !fp.includes('.next')) walk(fp);
    } else {
      if (fp.endsWith('.js') || fp.endsWith('.py') || fp.endsWith('.sql') || fp.endsWith('.patch')) {
        let content = fs.readFileSync(fp, 'utf8');
        if (content.includes(key)) {
          // Si el archivo ya usa comillas alrededor de la key, intentemos evitar syntax errors
          content = content.replace(new RegExp(`['"\`]${key}['"\`]`, 'g'), replacement);
          content = content.replace(new RegExp(key, 'g'), 'HIDDEN_KEY'); // Por si acaso
          fs.writeFileSync(fp, content);
          console.log('Fixed ' + fp);
        }
      }
    }
  });
}
walk('.');
console.log('Finalizado.');
