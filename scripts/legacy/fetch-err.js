fetch('http://localhost:3000').then(r => r.text()).then(t => {
    const match = t.match(/<title>(.*?)<\/title>/);
    console.log(match ? match[1] : 'No title');
    const errors = t.split('\n').filter(l => l.includes('Error:') || l.includes('ReferenceError') || l.includes('TypeError'));
    console.log(errors.slice(0, 5));
});
