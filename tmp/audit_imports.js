const fs = require('fs');
const path = require('path');

const componentsDir = path.join(process.cwd(), 'components');
const files = fs.readdirSync(componentsDir).filter(f => f.endsWith('.jsx'));

const standardTags = new Set(['div', 'span', 'button', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'form', 'label', 'input', 'select', 'option', 'code', 'pre', 'details', 'section', 'aside', 'header', 'footer', 'nav', 'main', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'li', 'img', 'video', 'audio', 'canvas', 'svg', 'path', 'g', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse', 'text', 'tspan', 'tref', 'textPath', 'image', 'use', 'defs', 'symbol', 'marker', 'mask', 'pattern', 'clipPath', 'linearGradient', 'radialGradient', 'stop', 'filter', 'fe', 'a', 'b', 'i', 'u', 's', 'em', 'strong', 'small', 'big', 'sub', 'sup', 'abbr', 'acronym', 'cite', 'q', 'dfn', 'ins', 'del', 'kbd', 'samp', 'var', 'br', 'wbr', 'hr', 'blockquote', 'address', 'center', 'iframe', 'object', 'embed', 'param', 'applet', 'map', 'area', 'canvas', 'noscript', 'script', 'style', 'template', 'slot', 'picture', 'source', 'track']);

const uiComponents = new Set(['Card', 'CardHeader', 'CardTitle', 'CardDescription', 'CardContent', 'CardFooter', 'Button', 'Input', 'Label', 'Tabs', 'TabsList', 'TabsTrigger', 'TabsContent', 'Select', 'SelectTrigger', 'SelectValue', 'SelectContent', 'SelectItem', 'Dialog', 'DialogContent', 'DialogHeader', 'DialogTitle', 'DialogTrigger', 'Badge', 'Calendar', 'Avatar', 'AvatarImage', 'AvatarFallback', 'Switch', 'Checkbox', 'RadioGroup', 'RadioGroupItem', 'Separator', 'Skeleton', 'ScrollArea', 'Accordion', 'AccordionItem', 'AccordionTrigger', 'AccordionContent', 'AlertDialog', 'AspectRatio', 'Collapsible', 'ContextMenu', 'HoverCard', 'Menubar', 'NavigationMenu', 'Popover', 'Progress', 'Slider', 'Toast', 'Tooltip', 'Sheet', 'Table', 'TableHeader', 'TableBody', 'TableFooter', 'TableHead', 'TableRow', 'TableCell', 'TableCaption']);

files.forEach(file => {
    const filePath = path.join(componentsDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Find all JSX components <Component ... />
    const componentMatches = content.match(/<([A-Z][a-zA-Z0-9]+)/g);
    if (!componentMatches) return;

    const usedComponents = new Set(componentMatches.map(m => m.substring(1)));
    
    // Find lucide-react imports
    const lucideMatch = content.match(/import \{([^}]+)\} from ['"]lucide-react['"]/);
    const importedIcons = lucideMatch ? lucideMatch[1].split(',').map(s => s.trim()) : [];
    const importedIconsSet = new Set(importedIcons);

    usedComponents.forEach(comp => {
        if (!standardTags.has(comp.toLowerCase()) && !uiComponents.has(comp) && !importedIconsSet.has(comp)) {
            // Check if it's imported from elsewhere
            const isOtherImport = new RegExp(`import .*${comp}.* from`).test(content) || new RegExp(`const .*${comp}.* =`).test(content);
            if (!isOtherImport) {
                console.log(`Potential missing import: ${comp} in ${file}`);
            }
        }
    });
});
