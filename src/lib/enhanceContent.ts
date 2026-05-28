import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';
import { projectDeliverables } from '../data/projectDeliverables';
import { withBasePath } from './paths';
import { noindexPaths, siteName } from './seo';

interface EnhanceContentOptions {
  title: string;
  currentPath: string;
}

const decorativeClasses = [
  'capricorn',
  'caterpillar',
  'cow',
  'image-15',
  'peacock',
  'whale',
];

function cleanText(value: string) {
  return value.replace(/\s+/g, ' ').replace(/\u200d/g, '').trim();
}

function isDecorative($: CheerioAPI, element: Element) {
  const className = $(element).attr('class') ?? '';
  return decorativeClasses.some((name) => className.split(/\s+/).includes(name));
}

function renameElement(element: Element, tagName: string) {
  element.tagName = tagName;
  element.name = tagName;
}

function closestProjectTitle($: CheerioAPI, element: Element) {
  const card = $(element).closest('a.projectblocklink, a.smallproject, a.writingblocks');
  if (card.length === 0) return '';

  return cleanText(card.find('.projecttitle, .projecttitleworkpage, .text-block, h1, h2, h3').first().text());
}

function writingContext($: CheerioAPI, element: Element, fallbackTitle: string) {
  const previousHeading = cleanText($(element).prevAll('.posttext').first().find('h1, h2, h3').last().text());
  return previousHeading || fallbackTitle;
}

function altForImage($: CheerioAPI, element: Element, options: EnhanceContentOptions, index: number) {
  if (isDecorative($, element)) return '';

  const cardTitle = closestProjectTitle($, element);
  if (cardTitle) return `${cardTitle} project preview`;

  const className = $(element).attr('class') ?? '';
  if (className.includes('postimg')) {
    return `${writingContext($, element, options.title)} visual example`;
  }

  if (className.includes('projectimg')) {
    return `${options.title} case study visual ${index}`;
  }

  if (className.includes('clientlogo')) return 'Client logo';
  if (className.includes('image-8')) return 'Jules Haggard portrait';
  if (className.includes('image-18')) return 'Haggard & Associates collaborator portrait collage';

  return `${options.title} visual`;
}

function enhanceImages($: CheerioAPI, options: EnhanceContentOptions) {
  let contentImageIndex = 0;

  $('img').each((_, element) => {
    const image = $(element);
    const existingAlt = image.attr('alt');

    if (isDecorative($, element)) {
      image.attr('alt', '');
      image.attr('aria-hidden', 'true');
    } else if (!existingAlt || cleanText(existingAlt).length === 0) {
      contentImageIndex += 1;
      image.attr('alt', altForImage($, element, options, contentImageIndex));
    }

    image.attr('decoding', 'async');

    if (!image.attr('loading')) {
      image.attr('loading', contentImageIndex <= 1 ? 'eager' : 'lazy');
    }

    if (contentImageIndex === 1 && image.attr('loading') === 'eager') {
      image.attr('fetchpriority', 'high');
    }
  });
}

function enhanceVideos($: CheerioAPI) {
  $('.w-background-video').each((_, element) => {
    const wrapper = $(element);
    wrapper.attr('aria-hidden', 'true');

    const poster = wrapper.attr('data-poster-url');
    wrapper.removeAttr('data-poster-url data-video-urls data-autoplay data-loop');

    wrapper.find('video').each((__, videoElement) => {
      const video = $(videoElement);
      video.attr('muted', '');
      video.attr('playsinline', '');
      video.attr('preload', 'metadata');
      video.attr('tabindex', '-1');
      video.attr('aria-hidden', 'true');
      video.attr('disablepictureinpicture', '');
      video.removeAttr('data-object-fit');

      if (poster) video.attr('poster', poster);

      const inlineStyle = video.attr('style');
      if (inlineStyle?.includes('background-image')) video.removeAttr('style');
    });
  });
}

function enhanceLinks($: CheerioAPI) {
  $('a').each((_, element) => {
    const link = $(element);
    const href = link.attr('href') ?? '';
    const text = cleanText(link.text());

    if (link.attr('target') === '_blank') {
      const rel = new Set((link.attr('rel') ?? '').split(/\s+/).filter(Boolean));
      rel.add('noopener');
      rel.add('noreferrer');
      link.attr('rel', Array.from(rel).join(' '));
    }

    if (href.startsWith('mailto:') && !link.attr('aria-label')) {
      link.attr('aria-label', `Email ${siteName}`);
    }

    if (text.length === 0 && !link.attr('aria-label')) {
      const cardTitle = closestProjectTitle($, element);
      if (cardTitle) link.attr('aria-label', `View ${cardTitle}`);
    }
  });
}

function rewriteSrcset(srcset: string) {
  return srcset
    .split(',')
    .map((candidate) => {
      const trimmed = candidate.trim();
      const [url, ...descriptor] = trimmed.split(/\s+/);
      const rewrittenUrl = withBasePath(url);

      return [rewrittenUrl, ...descriptor].join(' ');
    })
    .join(', ');
}

function rewriteStyleUrls(style: string) {
  return style.replace(/url\((['"]?)(\/(?!\/)[^'")]+)\1\)/g, (_, quote: string, url: string) => {
    return `url(${quote}${withBasePath(url)}${quote})`;
  });
}

function rewriteRootRelativeUrls($: CheerioAPI) {
  const urlAttributes = ['href', 'src', 'poster', 'data-poster-url'];

  $('*').each((_, element) => {
    const node = $(element);

    urlAttributes.forEach((attribute) => {
      const value = node.attr(attribute);
      if (value) node.attr(attribute, withBasePath(value));
    });

    const srcset = node.attr('srcset');
    if (srcset) node.attr('srcset', rewriteSrcset(srcset));

    const style = node.attr('style');
    if (style) node.attr('style', rewriteStyleUrls(style));
  });
}

function enhanceHeadings($: CheerioAPI) {
  $('a.projectblocklink h1.projecttitle, a.smallproject h1.projecttitle, a.projectblocklink h1.projecttitleworkpage, a.smallproject h1.projecttitleworkpage').each(
    (_, element) => {
      renameElement(element, 'h2');
    },
  );

  const headings = $('h1')
    .toArray()
    .filter((element) => cleanText($(element).text()).length > 0);

  headings.slice(1).forEach((element) => {
    renameElement(element, 'h2');
  });
}

function stripEmptyNoise($: CheerioAPI) {
  $('[aria-current="page"]').each((_, element) => {
    if ($(element).attr('href')?.startsWith('mailto:')) {
      $(element).removeAttr('aria-current');
    }
  });

  $('br').each((_, element) => {
    const next = element.next;
    if (next?.type === 'tag' && next.name === 'br') {
      $(next).remove();
    }
  });
}

function projectSlugFromPath(path: string) {
  const match = path.match(/^\/projects\/([^/]+)\/?$/);
  return match?.[1] ?? '';
}

function injectProjectDeliverables($: CheerioAPI, options: EnhanceContentOptions) {
  const slug = projectSlugFromPath(options.currentPath);
  const recap = projectDeliverables[slug];

  if (!recap) return;
  if ($('.deliverables-recap').length > 0) return;

  const sectionId = `deliverables-${slug}`;
  const section = $('<section></section>')
    .addClass('deliverables-recap')
    .attr('aria-labelledby', sectionId);
  const body = $('<div></div>').addClass('deliverables-recap__body');

  body.append($('<p></p>').addClass('deliverables-recap__label').text('Deliverables'));
  body.append($('<h2></h2>').addClass('deliverables-recap__title').attr('id', sectionId).text('What Haggard delivered'));
  body.append($('<p></p>').addClass('deliverables-recap__summary').text(recap.summary));

  const list = $('<ul></ul>').addClass('deliverables-recap__list');
  recap.items.forEach((item) => {
    list.append($('<li></li>').text(item));
  });
  body.append(list);
  section.append(body);

  const moreWorkHeading = $('.rightcol.workcol > .mainline.myname.morework').first();
  if (moreWorkHeading.length > 0) {
    moreWorkHeading.before(section);
    return;
  }

  const rightColumn = $('.rightcol.workcol').first();
  if (rightColumn.length > 0) {
    rightColumn.append(section);
  }
}

export function enhanceContentHtml(html: string, options: EnhanceContentOptions) {
  const $ = cheerio.load(html, {}, false);

  enhanceHeadings($);
  enhanceImages($, options);
  enhanceVideos($);
  enhanceLinks($);
  stripEmptyNoise($);
  injectProjectDeliverables($, options);
  rewriteRootRelativeUrls($);

  if (noindexPaths.has(options.currentPath)) {
    $('[aria-current="page"]').removeAttr('aria-current');
  }

  return $.root().html() ?? html;
}
