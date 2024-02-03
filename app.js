import fetch from "node-fetch";
import * as cheerio from "cheerio";
import Epub from "epub-gen";
import { createInterface } from "readline";
import chalk from "chalk";

const log = console.log;

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

let URL = "https://www.lightnovelworld.com";
let userAgent;
let path;
let epubTitle;
let epubAuthor;
let cookies;
let timePause;

const novelChapters = [
  {
    title: "Welcome:)",
    data: `<html>
  <body
    style="
      height: 50vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    "
  >
    <h1>
      Welcome Readers<br />
      <span style="font-size: 1.2rem; line-height: 2"
        >Created By RKT</span
      >
    </h1>
  </body>
</html>`,
  },
];

function askQuestion(query) {
  return new Promise((resolve) => {
    rl.question(query, (userRes) => {
      resolve(userRes);
    });
  });
}

function message() {
  log(chalk.green(`1. Go to ${URL} and Inspect by Right click.`));
  log(chalk.green(`2. Find the novel for EPUB creation.`));
  log(chalk.green(`3. Go to network tab and click on first link.`));
  log(
    chalk.green(
      `4. Scroll down and find request headers. Refresh it and do 3 step if can't see it.`
    )
  );
  log(chalk.green("5. Copy some properties and paste theme here."));
}

async function setInputParameter() {
  try {
    userAgent = await askQuestion("Enter UserAgent: ");
    cookies = await askQuestion("Enter Cookies: ");
    path = await askQuestion(
      "Enter Novel's Chapter Path(starts from /novel): "
    );
    epubTitle = await askQuestion("Enter Novel Title: ");
    epubAuthor = await askQuestion("Enter Novel Author: ");
    timePause = await askQuestion("Delay [1 for 1s]: ");
  } catch (error) {
    console.error("Error in setInputParameter", error);
    throw error;
  } finally {
    rl.close();
  }
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function chapter() {
  try {
    let headersList = {
      Host: "www.lightnovelworld.com",
      "User-Agent": userAgent,
      Cookie: cookies,
    };
    let response = await fetch(`${URL}${path}`, { headers: headersList });

    while (!response.ok) {
      log(chalk.red("Re-enter some parameters:"));
      message();
      userAgent = await askQuestion("Enter UserAgent: ");
      cookies = await askQuestion("Enter Cookies: ");
      path = await askQuestion(
        "Enter Novel's Next to last downloading Chapter Path(starts from /novel): "
      );
      timePause = await askQuestion("Delay [1 for 1s]: ");

      headersList = {
        Host: "www.lightnovelworld.com",
        "User-Agent": userAgent,
        Cookie: cookies,
      };
      response = await fetch(`${URL}${path}`, { headers: headersList });
    }

    const body = await response.text();
    const $ = cheerio.load(body);
    const chapterTitle = $(".chapter-title").text();
    const chapterContent = $("#chapter-container");
    const chapterData = $("#chapter-container").html();

    chapterContent
      .find(".vm-placement")
      .each((index, element) => $(element).closest("div").remove());

    novelChapters.push({
      title: chapterTitle,
      data: chapterData,
    });

    log(chalk.green.italic("Downloading chapter:", chapterTitle));
    if ($(".button.nextchap.isDisabled").length) {
      return false;
    }

    path = $(".button.nextchap").attr("href");
    return true;
  } catch (error) {
    console.error("Error in loadChapter", error);
    throw error;
  }
}

async function forAllChapters() {
  try {
    let next = true;
    while (next) {
      next = await chapter();
      await delay(+timePause * 1000);
    }
  } catch (error) {
    console.error("Error in forAllChapters", error);
    throw error;
  } finally {
    // Generate EPUB
    const options = {
      title: epubTitle,
      author: epubAuthor,
      output: epubTitle + ".epub",
      content: novelChapters.map((chapter) => ({
        title: chapter.title,
        data: `<html><body>${chapter.data}</body></html>`,
      })),
      css: `* { font-family: 'Atkinson Hyperlegible', sans-serif; }`,
      fonts: ["./Atkinson_Hyperlegible.ttf"],
    };

    new Epub(options).promise
      .then(() => {
        log("EPUB generated successfully!");
      })
      .catch((error) => {
        console.error("Error in epub generation", error);
      });
  }
}

log(chalk.yellowBright("\t\t\t\t\tWelcome to RKTEPUBGEN"));
message();
setInputParameter()
  .then(() => {
    forAllChapters();
  })
  .catch((error) => console.log(error));
