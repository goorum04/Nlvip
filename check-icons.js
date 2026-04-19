const fs = require('fs');
const path = require('path');
const lucide = require('lucide-react');

function findLucideImports(dir) {
  let files = fs.readdirSync(dir);
  let badIcons = [];
  
  files.forEach(file => {
    let fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      badIcons = badIcons.concat(findLucideImports(fullPath));
    } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let regex = /import\s+\{([^}]+)\}\s+from\s+['"]lucide-react['"]/g;
      let match;
      while ((match = regex.exec(content)) !== null) {
        let imports = match[1].split(',').map(s => s.trim()).filter(s => s);
        imports.forEach(imp => {
          let originalName = imp.split(/\s+as\s+/)[0].trim();
          if (!lucide[originalName]) {
            badIcons.push({ file: fullPath, icon: originalName });
          }
        });
      }
    }
  });
  return badIcons;
}

let badComponents = findLucideImports('./components');
let badApp = findLucideImports('./app');
let allBad = badComponents.concat(badApp);

if (allBad.length === 0) {
  console.log('ALL ICONS ARE VALID');
} else {
  console.log('INVALID ICONS FOUND:');
  console.log(JSON.stringify(allBad, null, 2));
}
