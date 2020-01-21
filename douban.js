const puppeteer = require("puppeteer");
const chalk = require("chalk");
const fs = require("fs");
const log = console.log;

const pageSize = 15;

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  //登录豆瓣
  await page.goto("https://accounts.douban.com/passport/login");
  await page.click("li.account-tab-account");
  await page.type("#username", "");
  await page.type("#password", "");
  await page.click("a.btn-account");
  const [response] = await Promise.all([
    page.waitForNavigation(),
    page.click("a.btn-account")
  ]);
  log(chalk.blue("成功登录"));

  //获取豆瓣观影条目
  await page.goto("https://movie.douban.com/mine?status=collect");
  const totalCount = await page.evaluate(() => {
    let count = document
      .querySelector("#db-usr-profile .info h1")
      .textContent.match(/\d+/)[0];
    return Promise.resolve(count ? parseInt(count) : 0);
  });
  log(chalk.blue(`一共观看了${totalCount}部影视剧`));

  let startNum = 0;
  let itemsList = [];
  while(totalCount / startNum >= 1) {
    await page.goto(`https://movie.douban.com/mine?status=collect&start=${startNum}`);
    log(chalk.blue(`抓取第${parseInt(startNum / pageSize) + 1}页列表`));

    const items = await page.evaluate(async() => {
      let items = await Promise.all(Array.from(document.querySelectorAll('.article .item')).map(async (el) => {
        const ratingEl = el.querySelector(".info ul li:not([class]) span[class^='rating']");
        const commentEL = el.querySelector(".info ul li:not([class]) .comment");

        const link = el.querySelector(".info ul .title a").getAttribute('href');
        const title = el.querySelector(".info ul .title a em").textContent;
        const rating = ratingEl ? ratingEl.getAttribute('class').match(/\d/)[0] : null;
        const addDate = el.querySelector(".info ul li:not([class]) .date").textContent;
        const comment = commentEL ? commentEL.textContent : '';
        const cover = el.querySelector(".pic img").getAttribute('src');

        return Promise.resolve({link, title, rating, addDate, comment, cover});
      }));
      return Promise.resolve(items);
    });
    itemsList = itemsList.concat(items);
    startNum += pageSize;
  }

  fs.writeFile('douban-list.json', JSON.stringify(itemsList), (err) => {
    if(err) {
      log(chalk.red('写入文件失败'));
      throw err;
    }
  })

  log(chalk.blue('成功抓取豆瓣观影列表'));

  await browser.close();
})();