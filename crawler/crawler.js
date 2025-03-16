const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://arca.live/b/epic7', { waitUntil: 'networkidle2' });
  const content = await page.content();
  const $ = cheerio.load(content);

  // 실제 클래스명으로 수정 필요
  const titles = $('.title').map((i, el) => $(el).text()).get();
  console.log('Titles:', titles);

  await browser.close();
})();