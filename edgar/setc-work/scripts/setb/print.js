// usage: node print.js jobs.json
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const jobs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  for (const j of jobs) {
    const page = await ctx.newPage();
    try {
      await page.goto('file://' + j.html, { waitUntil: 'load', timeout: 120000 });
      await page.emulateMedia({ media: 'print' });
      const opts = { path: j.out, format: 'Letter', landscape: !!j.landscape, printBackground: !!j.bg,
        margin: { top: '0.4in', bottom: '0.4in', left: '0.4in', right: '0.4in' } };
      if (j.hf) {
        opts.displayHeaderFooter = true;
        const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
        opts.headerTemplate = `<div style="font-size:8px;width:100%;padding:0 0.4in;display:flex;justify-content:space-between;font-family:Arial"><span>${esc(j.date||'')}</span><span>${esc(j.title||'')}</span><span></span></div>`;
        opts.footerTemplate = `<div style="font-size:8px;width:100%;padding:0 0.4in;display:flex;justify-content:space-between;font-family:Arial"><span>${esc(j.url||'')}</span><span><span class="pageNumber"></span>/<span class="totalPages"></span></span></div>`;
      }
      await page.pdf(opts);
      console.log('ok', j.out);
    } catch (e) { console.log('ERR', j.out, e.message); }
    await page.close();
  }
  await browser.close();
})();
