import * as cheerio from 'cheerio';
import { default as got } from 'got';
import { Chapter } from './Chapter.js';
import { Channel } from './Channel.js';

export class IVooxChannel extends Channel {

    private channelUrl? : string;
    private channelPageHtml?: string;

    constructor(channelName: string) {
        super(channelName);
    }

    private fromSpanishDate(text: string): Date {
        const parts = text.split(/[\/·:]/);
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);

        return new Date(year, month, day);
    }

    protected async fetchChannelInformation(): Promise<void> {
        console.info(`Configuring feed from ${this.channelUrl}`);
        const channelResponsePage = await got(this.channelUrl || '');
        const $ = cheerio.default;
        this.channelPageHtml = channelResponsePage.body;
        const $channelPage = $.load(this.channelPageHtml);

        this.channelName = $channelPage('h1').text().trim();
        this.author = $channelPage('.d-flex > .text-medium > . a').text().trim();
        this.description = $channelPage('.d-flex > .d-none > .text-truncate-3').text().trim();
        this.imageUrl = $channelPage('.d-flex > .image-wrapper.pr-2 > img').attr('data-lazy-src')?.trim();
        this.ttlInMinutes = 60;
        this.siteUrl = this.channelUrl;

        console.info(`Podcast image: ${this.imageUrl}`);
    }

    protected async fetchEpisodeList() : Promise<Chapter[]> {
        const $channelPage = cheerio.load(this.channelPageHtml || '');
        const $ = cheerio.load('');

        const selector = `.pl-1 > .d-flex > .d-flex > .w-100 > a`

        const chapters = await Promise.all(
              [...$channelPage(selector)]
                .filter(a => a)
                .map(a => this.fetchChapterData($(a).text().trim(), `https://ivoox.com${$(a).attr('href')}` || ''))
        );
        return chapters;
    }

    private async fetchChapterData(title: string, url: string): Promise<Chapter> {
        console.debug(`Retrieving info for chapter ${title} (${url}).`);
        const programResponsePage = await got(url);

        const $chapterPage = cheerio.load(programResponsePage.body);

        const audioUrlTempl = "https://www.ivoox.com/listenembeded_mn_12345678_1.mp3?source=EMBEDEDHTML5";

        const id = (url.match(/\d{6,12}/g))![0];
        const audioRealUrl = audioUrlTempl.replace('12345678', id);

        const description = $chapterPage('div.mb-3 > div > p.text-truncate-5').text().trim();

        const date = this.fromSpanishDate($chapterPage('span.text-medium.ml-sm-1').text().split('·')[0].trim() || '01/01/2000');

        let img = ($chapterPage('.d-flex > .image-wrapper.pr-2 > img').attr('data-lazy-src') || '');
        if (img.includes('url=')) {
            img = img.split('url=')[1];
        }

        const chapter = new Chapter(id, title, audioRealUrl, description, date, img);

        return chapter;
    }

    private async findChannelUrl(): Promise<string | undefined> {
        console.info(`Searching for the program "${this.channelName}"`);
        const normalizedName = this.channelName.trim().toLowerCase().replace(/ /g, '-');
        const searchURL = `https://www.ivoox.com/${normalizedName}_sw_1_1.html`;
        const searchResponsePage = await got(searchURL);

        console.debug(`Looking for the program url.`);
        const $ = cheerio.load(searchResponsePage.body);
        const selector = `.modulo-type-programa .header-modulo a`;
        const anchor = $(selector);

        const programUrl = anchor.attr('href')?.toString();
        console.debug(`Program url: ${programUrl}.`);

        return programUrl;
    }

   public async generateFeed(): Promise<string | undefined> {
        console.info(`Creating rss feed.`);
        console.debug(`Getting channel ${this.channelName} url.`);
        this.channelUrl = await this.findChannelUrl();
        if (this.channelUrl === undefined) {
            console.warn(`Channel url not found for ${this.channelName}.`);
            return;
        }
        console.info(`Channel url is ${this.channelUrl}.`);
        return super.generateFeed();
    }
}
//# sourceMappingURL=IVooxChannel.js.map