import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const heroSelector = '.homecontainer > .aboutintro.hp.herohp:first-child';
const headlineSelector = '.heading-3.topheader.herohero';
const headlineRevealSelector = ['main h1', 'main h2', 'main h3', '.bigthinklink', '.text-block'].join(', ');

interface HeroIntro {
  animatedElements: Set<HTMLElement>;
  cleanup: () => void;
}

const appendText = (text: string, target: HTMLElement, chars: HTMLElement[]) => {
  const tokens = text.match(/\S+|\s+/g) ?? [];

  tokens.forEach((token) => {
    if (/^\s+$/.test(token)) {
      target.append(document.createTextNode(token));
      return;
    }

    const word = document.createElement('span');
    word.className = 'headline-word';

    Array.from(token).forEach((character) => {
      const span = document.createElement('span');
      span.className = 'headline-char';
      span.textContent = character;
      word.append(span);
      chars.push(span);
    });

    target.append(word);
  });
};

const appendNode = (node: Node, target: HTMLElement, chars: HTMLElement[]) => {
  if (node.nodeType === Node.TEXT_NODE) {
    appendText(node.textContent ?? '', target, chars);
    return;
  }

  if (!(node instanceof HTMLElement)) return;

  if (node.tagName.toLowerCase() === 'br') {
    target.append(document.createElement('br'));
    return;
  }

  const clone = node.cloneNode(false) as HTMLElement;
  target.append(clone);
  Array.from(node.childNodes).forEach((child) => appendNode(child, clone, chars));
};

export const prepareHeadlineChars = (chars: HTMLElement[]) => {
  gsap.set(chars, {
    autoAlpha: 0,
    yPercent: 68,
    rotationX: -42,
    filter: 'blur(8px)',
    transformOrigin: '50% 78%',
  });
};

const revealHeadlineChars = (headline: HTMLElement, delay = 0) => {
  const chars = gsap.utils.toArray<HTMLElement>('.headline-char', headline);
  if (!chars.length) return;

  gsap.to(chars, {
    autoAlpha: 1,
    yPercent: 0,
    rotationX: 0,
    filter: 'blur(0px)',
    delay,
    duration: 0.92,
    ease: 'power4.out',
    stagger: {
      amount: Math.min(0.54, Math.max(0.22, chars.length * 0.014)),
      from: 'start',
    },
    clearProps: 'opacity,visibility,transform,filter',
  });
};

export const splitHeadline = (headline: HTMLElement) => {
  if (headline.dataset.headlineSplit === 'true') {
    return gsap.utils.toArray<HTMLElement>('.headline-char', headline);
  }

  const label = (headline.innerText || headline.textContent || '').replace(/\s+/g, ' ').trim();
  const originalNodes = Array.from(headline.childNodes);
  const visual = document.createElement('span');
  const chars: HTMLElement[] = [];

  visual.className = 'headline-visual';
  visual.setAttribute('aria-hidden', 'true');
  headline.dataset.headlineSplit = 'true';
  headline.setAttribute('aria-label', label);
  headline.replaceChildren(visual);
  originalNodes.forEach((node) => appendNode(node, visual, chars));

  return chars;
};

const shouldRevealHeadline = (headline: HTMLElement, excludedElements: Set<HTMLElement>) => {
  if (excludedElements.has(headline)) return false;
  if (!headline.textContent?.trim()) return false;
  if (headline.closest('.nav, .skip-link')) return false;
  if (headline.closest('.agency-anthem-section')) return false;
  if (headline.closest('.projectblocklink, .smallproject')) return false;
  if (headline.matches('.ctalink, .mainline.inver.rightsidecontact.contact')) return false;

  return headline.matches('a') || !headline.querySelector('a');
};

export const initHeadlineReveals = (excludedElements = new Set<HTMLElement>()): HeroIntro => {
  const animatedElements = new Set<HTMLElement>();
  const headlines = gsap.utils
    .toArray<HTMLElement>(headlineRevealSelector)
    .filter((headline) => shouldRevealHeadline(headline, excludedElements));

  const preparedHeadlines = headlines.filter((headline) => {
    const chars = splitHeadline(headline);
    if (!chars.length) return false;

    gsap.set(headline, { autoAlpha: 1 });
    prepareHeadlineChars(chars);
    animatedElements.add(headline);
    return true;
  });

  if (preparedHeadlines.length) {
    ScrollTrigger.batch(preparedHeadlines, {
      once: true,
      start: 'top 88%',
      interval: 0.08,
      batchMax: 4,
      onEnter: (batch) => {
        batch.forEach((headline, index) => revealHeadlineChars(headline as HTMLElement, index * 0.045));
      },
    });
  }

  return {
    animatedElements,
    cleanup: () => undefined,
  };
};

export const initHeroIntro = (): HeroIntro => {
  const animatedElements = new Set<HTMLElement>();
  const hero = document.querySelector<HTMLElement>(heroSelector);
  const headline = hero?.querySelector<HTMLElement>(headlineSelector);

  if (!hero || !headline) {
    return {
      animatedElements,
      cleanup: () => undefined,
    };
  }

  const copy = hero.querySelector<HTMLElement>('.flex-block-3');
  const chars = splitHeadline(headline);

  hero.classList.add('hero-ready');
  animatedElements.add(hero);
  animatedElements.add(headline);
  if (copy) animatedElements.add(copy);

  gsap.set(headline, { autoAlpha: 1 });
  prepareHeadlineChars(chars);

  if (copy) {
    gsap.set(copy.children, { autoAlpha: 0, y: 14 });
  }

  const intro = gsap.timeline({
    defaults: {
      ease: 'power4.out',
    },
  });

  intro.to(
    chars,
    {
      autoAlpha: 1,
      yPercent: 0,
      rotationX: 0,
      filter: 'blur(0px)',
      duration: 1.05,
      stagger: {
        amount: 0.62,
        from: 'start',
      },
      clearProps: 'opacity,visibility,transform,filter',
    },
    0.08,
  );

  if (copy) {
    intro.to(
      copy.children,
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.72,
        stagger: 0.065,
        clearProps: 'opacity,visibility,transform',
      },
      0.76,
    );
  }

  return {
    animatedElements,
    cleanup: () => undefined,
  };
};
