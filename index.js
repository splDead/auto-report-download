const puppeteer = require('puppeteer');
const fs = require('fs');
const https = require('https');

require('dotenv').config();

(async () => {
  const browser = await puppeteer.launch({
    headless: true
  });
  const page = await browser.newPage();
  
  console.log(`[${timestamp()}]: Page created`);
  
  await page.setViewport({width: 1920, height: 1080});
  
  console.log(`[${timestamp()}]: Set viewport`);
  
  // переход на страницу
  await page.goto(process.env.START_PAGE_URL, { waitUntil: 'networkidle0' });
  
  console.log(`[${timestamp()}]: Login page opened`);
  
  // заполняем форму логина
  await page.type('#UserName', process.env.USERNAME);
  await page.type('#Password', process.env.PASSWORD);
  
  // логинимся и ждем следующую страницу
  await Promise.all([
    page.click('#loginbutton'),
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
  ]);
  
  console.log(`[${timestamp()}]: Login complete`);
  
  await Promise.all([
    page.click(`a[href*="${process.env.TAB_NAME}"]`),
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
  ]);
  
  console.log(`[${timestamp()}]: Order manager page opened`);
  
  // выбираем кастомные даты
  const quickDateCustomIdSelect = await page.$('#QuickDateCustomID');
  await quickDateCustomIdSelect.type('Custom');
  // заполняем даты
  const START_DATE = process.env.START_DATE;
  const END_DATE = process.env.END_DATE;
  await page.$eval('#date1', (el, startDate) => el.value = startDate, START_DATE);
  await page.$eval('#date2', (el, endDate) => el.value = endDate, END_DATE);
  
  console.log(`[${timestamp()}]: Filters selected`);
  
  let downloadUrl;
  page.on('response', async response => {
    const req = response.request();
    if (req.url() === process.env.SEARCH_REQUEST_URL_FOR_DOWNLOADING) {
      downloadUrl = await response.json();
      
      if (downloadUrl && downloadUrl.Data) {
        console.log(`[${timestamp()}]: Download url:`, downloadUrl.Data);
      }
    }
  });
  
  await page.click('.btnExcel');
  await page.waitForTimeout(20000);
  
  if (downloadUrl && downloadUrl.Data) {
    console.log(`[${timestamp()}]: Try download file`);
    await download(downloadUrl.Data);
  }
  
  await browser.close();
})();

async function download(url) {
  const tempName = timestamp();
  const fileName = `${tempName.replace(/\s+/g, '_')}.csv`;
  const file = fs.createWriteStream(fileName);
  const request = https.get(url, response => {
    response.pipe(file);
    file.on('finish', () => {
      console.log(`[${timestamp()}]: File created`);
      file.close();
    })
  }).on('error', err => {
    fs.unlink(fileName);
  });
}

function timestamp(){
  function pad(n) {
    return n < 10 ? "0" + n : n;
  }
  
  const d = new Date();
  const dash = '-';
  const colon = ':';
  
  return d.getFullYear() + dash +
    pad(d.getMonth() + 1) + dash +
    pad(d.getDate()) +' ' +
    pad(d.getHours()) + colon +
    pad(d.getMinutes()) + colon +
    pad(d.getSeconds());
}
