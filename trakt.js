const Trakt = require("trakt.tv");
const chalk = require("chalk");
const formatISO = require("date-fns/formatISO");
const parse = require("date-fns/parse");
const puppeteer = require("puppeteer");

const itemsList = require("./douban-list.json");

const log = console.log;

const API_URL = "https://api.trakt.tv";
const client_id =
  "4f1fc0fa2575a76ade3b371067f0b32465392c15eb5d9b3da10ace7a40fb0382";
const client_secret =
  "571075ac369cb8be7928a561e810bb9c8956bc2ffe03616e882af5d7ce24321d";


let options = {
  client_id: client_id,
  client_secret: client_secret,
  redirect_uri: null, // defaults to 'urn:ietf:wg:oauth:2.0:oob'
  api_url: API_URL, // defaults to 'https://api.trakt.tv'
  useragent: null, // defaults to 'trakt.tv/<version>'
  pagination: true, // defaults to false, global pagination (see below),
  debug: true
};
const trakt = new Trakt(options);

(async () => {
//   await trakt
//     .get_codes()
//     .then(poll => {
//       log(
//         chalk.blue(`请访问 ${poll.verification_url}, 输入代码${poll.user_code}`)
//       );
//       return trakt.poll_access(poll);
//     })
//     .catch(error => {
//       console.log(error);
//       if (error.message === "Expired") log(chalk.red("已超时，请重试脚本"));
//       process.exit(1);
//     });

//   const token = trakt.export_token();
//   console.log(token);



  const browser = await puppeteer.launch();
  const page = await browser.newPage();

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

  for (let item of itemsList) {
    log(chalk.blue("开始同步:" + item.title));

    await page.goto(item.link);
    item.imdb = await page.evaluate(() => {
      const imdbEl = document.querySelector(
        "#info a[href^='https://www.imdb.com/title']"
      );
      const imdb = imdbEl ? imdbEl.textContent : "";
      return Promise.resolve(imdb);
    });

    let addDate = item.addDate;
    addDate = formatISO(parse(addDate, "yyyy-MM-dd", new Date()));
    if(item.imdb) {
        console.log(item.imdb)
        await syncHistory(item.imdb, item.addDate);
    }
    log(chalk.blue("结束同步:" + item.title));
  }
})();

async function syncHistory(imdbID, addDate, rating) {
  let traktRes = await trakt.search.id({
    id_type: "imdb",
    id: imdbID
  });
  if (traktRes && traktRes.data && traktRes.data.length) {
    let traktInfo = traktRes.data[0];
    switch (traktInfo.type) {
      case "movie":
        await syncMovie(traktInfo.movie, addDate, rating);
        break;

      case "show":
        await syncShow(traktInfo.show, addDate, rating);
        break;

      case "episode":
        await syncEpisodeToShow(traktInfo, addDate, rating);
        break;

      default:
        log(chalk.red("未知类型, 跳过"));
    }
    log(chalk.blue("执行完毕"));
  }
}

async function syncMovie(movie, addDate) {
  return await trakt.sync.history
    .add({
      movies: [
        {
          watched_at: addDate,
          ids: {
            trakt: movie.ids.trakt
          }
        }
      ]
    })
    .then(res => console.log(JSON.stringify(res)))
    .catch(err => log(err));
}

async function syncShow(show, addDate) {
  return await trakt.sync.history
    .add({
      shows: [
        {
          watched_at: addDate,
          ids: {
            trakt: show.ids.trakt
          }
        }
      ]
    })
    .then(res => console.log(JSON.stringify(res)))
    .catch(err => log(err));
}

async function syncEpisodeToShow(info, addDate) {
  const seasonNumber = info.episode.season;
  const seasonSummary = await trakt.seasons.summary({
    id: info.show.ids.trakt
  });
  const seasonInfo = seasonSummary.data.find(season => {
    return seasonNumber === season.number + 1;
  });

  const season = {
    watched_at: addDate,
    ids: seasonInfo.ids
  };
  return await trakt.sync.history
    .add({
      seasons: [season]
    })
    .then(res => console.log(JSON.stringify(res)))
    .catch(err => console.log(err));
}
