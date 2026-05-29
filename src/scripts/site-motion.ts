import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { initCtaWebglButtons } from './cta-webgl';
import { initHeadlineReveals, initHeroIntro } from './hero-intro';

gsap.registerPlugin(ScrollTrigger);

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let motionContext: gsap.Context | undefined;
let cleanupListeners: Array<() => void> = [];
let currentPageKey = '';

const cleanupMotion = () => {
  cleanupListeners.forEach((cleanup) => cleanup());
  cleanupListeners = [];
  motionContext?.revert();
  motionContext = undefined;
  ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
};

const addHoverTween = (element: HTMLElement, enterVars: gsap.TweenVars, leaveVars: gsap.TweenVars) => {
  const onEnter = () => gsap.to(element, enterVars);
  const onLeave = () => gsap.to(element, leaveVars);

  element.addEventListener('mouseenter', onEnter);
  element.addEventListener('mouseleave', onLeave);
  cleanupListeners.push(() => {
    element.removeEventListener('mouseenter', onEnter);
    element.removeEventListener('mouseleave', onLeave);
  });
};

const testimonialGridSelector = '.aboutintro.hp.herohp.lowerdown.testimonials + .grid';
const testimonialHeadingSelector = '.aboutintro.hp.herohp.lowerdown.testimonials';
const isTestimonialCard = (element: HTMLElement) => element.matches(`${testimonialGridSelector} .paragraph-5`);

const initTestimonialHeartParticles = (grid: HTMLElement) => {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    return;
  }

  const heading = document.querySelector<HTMLElement>(testimonialHeadingSelector);
  const activeHearts = new Set<HTMLElement>();
  const activeTweens = new Set<gsap.core.Animation>();
  const heartTweens = new Map<HTMLElement, gsap.core.Animation>();
  const heartCharacters = ['💗', '💖', '💕'];
  let lastEmit = 0;

  const getExpandedBandRect = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const styles = getComputedStyle(element);
    const marginTop = Number.parseFloat(styles.marginTop) || 0;
    const marginBottom = Number.parseFloat(styles.marginBottom) || 0;

    return {
      top: rect.top - marginTop,
      bottom: rect.bottom + marginBottom,
    };
  };

  const isInsideTestimonialBand = (event: PointerEvent) => {
    const rects = [heading, grid]
      .filter((element): element is HTMLElement => Boolean(element))
      .map(getExpandedBandRect);
    const top = Math.min(...rects.map((rect) => rect.top));
    const bottom = Math.max(...rects.map((rect) => rect.bottom));
    return event.clientY >= top && event.clientY <= bottom;
  };

  const removeHeart = (heart: HTMLElement, tween?: gsap.core.Animation) => {
    const trackedTween = tween ?? heartTweens.get(heart);
    trackedTween?.kill();
    if (trackedTween) {
      activeTweens.delete(trackedTween);
      heartTweens.delete(heart);
    }
    activeHearts.delete(heart);
    heart.remove();
  };

  const emitHeart = (event: PointerEvent) => {
    const now = performance.now();

    if (now - lastEmit < 42) {
      return;
    }

    lastEmit = now;

    if (activeHearts.size > 28) {
      const oldestHeart = activeHearts.values().next().value;
      if (oldestHeart) removeHeart(oldestHeart);
    }

    const heart = document.createElement('span');
    heart.className = 'testimonial-heart-particle';
    heart.setAttribute('aria-hidden', 'true');
    heart.textContent = gsap.utils.random(heartCharacters);
    document.body.append(heart);
    activeHearts.add(heart);

    const driftX = gsap.utils.random(-82, 82);
    const driftY = gsap.utils.random(-132, -58);
    const startScale = gsap.utils.random(0.62, 0.88);
    const endScale = gsap.utils.random(1.8, 2.7);
    const rotation = gsap.utils.random(-28, 28);

    const duration = gsap.utils.random(1.08, 1.44);
    const tween = gsap.timeline({ onComplete: () => removeHeart(heart, tween) });

    tween.fromTo(
      heart,
      {
        x: event.clientX - 8,
        y: event.clientY - 10,
        scale: startScale,
        rotation,
        autoAlpha: 0.96,
        filter: 'blur(0px)',
      },
      {
        x: event.clientX + driftX,
        y: event.clientY + driftY,
        scale: endScale,
        rotation: rotation + gsap.utils.random(-24, 24),
        duration,
        ease: 'power3.out',
      },
      0,
    );

    tween.to(
      heart,
      {
        filter: 'blur(4.8px)',
        duration: duration * 0.5,
        ease: 'power2.in',
      },
      duration * 0.36,
    );

    tween.to(
      heart,
      {
        autoAlpha: 0,
        duration: duration * 0.66,
        ease: 'power2.in',
      },
      duration * 0.28,
    );

    activeTweens.add(tween);
    heartTweens.set(heart, tween);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (isInsideTestimonialBand(event)) {
      emitHeart(event);
    }
  };

  window.addEventListener('pointermove', onPointerMove, { passive: true });

  cleanupListeners.push(() => {
    window.removeEventListener('pointermove', onPointerMove);
    activeTweens.forEach((tween) => tween.kill());
    activeTweens.clear();
    heartTweens.clear();
    activeHearts.forEach((heart) => heart.remove());
    activeHearts.clear();
  });
};

const initTestimonials = () => {
  const grid = document.querySelector<HTMLElement>(testimonialGridSelector);
  if (!grid) {
    return;
  }

  const cards = gsap.utils.toArray<HTMLElement>('.paragraph-5', grid);
  if (!cards.length) {
    return;
  }

  grid.setAttribute('role', 'list');
  grid.setAttribute('aria-label', 'Client testimonials');
  gsap.set(cards, { transformOrigin: 'left center' });

  cards.forEach((card) => {
    card.setAttribute('role', 'listitem');

    const onEnter = () => {
      gsap.to(card, {
        y: -5,
        duration: 0.34,
        ease: 'power3.out',
        overwrite: 'auto',
      });
    };
    const onLeave = () => {
      gsap.to(card, {
        y: 0,
        duration: 0.42,
        ease: 'power3.out',
        overwrite: 'auto',
      });
    };

    card.addEventListener('mouseenter', onEnter);
    card.addEventListener('mouseleave', onLeave);

    cleanupListeners.push(() => {
      card.removeEventListener('mouseenter', onEnter);
      card.removeEventListener('mouseleave', onLeave);
    });
  });

  gsap.set(cards, { autoAlpha: 0, y: 18 });

  ScrollTrigger.batch(cards, {
    once: true,
    start: 'top 84%',
    onEnter: (batch) => {
      gsap.to(batch, {
        autoAlpha: 1,
        y: 0,
        clearProps: 'opacity,visibility,transform',
        duration: 0.62,
        ease: 'power3.out',
        stagger: 0.06,
      });
    },
  });

  initTestimonialHeartParticles(grid);
};

const initAssociatePortraitCloud = () => {
  const cloud = document.querySelector<HTMLElement>('#aboutmesection .associate-portrait-cloud');
  if (!cloud) {
    return;
  }

  const faces = gsap.utils.toArray<HTMLElement>('.associate-face', cloud);
  if (!faces.length) {
    return;
  }

  const orbitPlanes = [
    { rx: 0.49, ry: 0.16, rotation: -4, depth: 0.9, speed: 0.00013 },
    { rx: 0.48, ry: 0.17, rotation: -34, depth: 0.78, speed: -0.00011 },
    { rx: 0.46, ry: 0.155, rotation: 31, depth: 0.84, speed: 0.00015 },
  ];
  const faceOrbitIndexes = [1, 2, 0, 0, 2, 1, 0, 2, 1];
  const facePhases = [0.04, 0.61, 0.86, 0.17, 0.42, 0.78, 0.55, 0.3, 0.93];
  const faceSpeedMultipliers = [0.95, 1.08, 0.86, 1.16, 0.92, 1.04, 0.82, 1.12, 0.98];
  const tau = Math.PI * 2;
  let elapsed = 0;

  const getCloudWidth = () => Math.max(320, cloud.getBoundingClientRect().width);

  const writePositions = (time: number) => {
    const cloudWidth = getCloudWidth();

    for (let i = 0; i < faces.length; i += 1) {
      const plane = orbitPlanes[faceOrbitIndexes[i] % orbitPlanes.length];
      const angle = facePhases[i] * tau + time * plane.speed * faceSpeedMultipliers[i];
      const cosT = Math.cos(angle);
      const sinT = Math.sin(angle);
      const rx = cloudWidth * plane.rx;
      const ry = cloudWidth * plane.ry;
      const rotation = (plane.rotation * Math.PI) / 180;
      const cosR = Math.cos(rotation);
      const sinR = Math.sin(rotation);

      const orbitX = cosT * rx;
      const orbitY = sinT * ry;
      const x = orbitX * cosR - orbitY * sinR;
      const y = orbitX * sinR + orbitY * cosR;
      const depth = sinT * plane.depth;
      const depthProgress = (depth + 1) / 2;
      const scale = 0.76 + depthProgress * 0.48;
      const opacity = 0.48 + depthProgress * 0.52;

      const face = faces[i];
      const style = face.style;
      style.setProperty('--x', `${x}px`);
      style.setProperty('--y', `${y}px`);
      style.setProperty('--depth-scale', scale.toFixed(3));
      style.setProperty('--orbit-opacity', opacity.toFixed(3));
      style.zIndex = depth > -0.08 ? '6' : '1';
    }
  };

  writePositions(0);
  gsap.set(faces, { '--reveal-alpha': 0, '--reveal-scale': 0.35, '--float-y': '0px' });

  let tickerFn: ((time: number) => void) | undefined;
  const startTicker = () => {
    const startTime = performance.now();
    tickerFn = () => {
      elapsed = performance.now() - startTime;
      writePositions(elapsed);
    };
    gsap.ticker.add(tickerFn);
  };

  const onResize = () => writePositions(elapsed);
  window.addEventListener('resize', onResize);

  cleanupListeners.push(() => {
    window.removeEventListener('resize', onResize);

    if (tickerFn) {
      gsap.ticker.remove(tickerFn);
      tickerFn = undefined;
    }
  });

  ScrollTrigger.create({
    trigger: cloud,
    start: 'top 82%',
    once: true,
    onEnter: () => {
      startTicker();
      gsap.to(faces, {
        '--reveal-alpha': 1,
        '--reveal-scale': 1,
        duration: 0.9,
        ease: 'power4.out',
        stagger: { each: 0.07, from: 'random' },
      });
    },
  });
};

const initMotion = () => {
  const pageKey = `${window.location.pathname}${window.location.search}`;
  if (currentPageKey === pageKey && motionContext) {
    return;
  }

  currentPageKey = pageKey;
  cleanupMotion();

  if (reduceMotion.matches) {
    return;
  }

  motionContext = gsap.context(() => {
    gsap.fromTo(
      '#main-content',
      { autoAlpha: 0.92, y: 8 },
      {
        autoAlpha: 1,
        y: 0,
        clearProps: 'opacity,visibility,transform',
        duration: 0.38,
        ease: 'power3.out',
      },
    );

    const heroIntro = initHeroIntro();
    cleanupListeners.push(heroIntro.cleanup);
    const headlineReveals = initHeadlineReveals(heroIntro.animatedElements);
    cleanupListeners.push(headlineReveals.cleanup);

    const animatedTextElements = new Set([...heroIntro.animatedElements, ...headlineReveals.animatedElements]);

    const firstReadSelectors = [
      '.nav',
      '.copysection.projectcopy .subline.homesub',
      '.copysection.projectcopy .mainline.smallhomesection',
      '.copysection.projectcopy .splitpara',
      '.aboutintro.hp.herohp > *',
      '.homecontainer > *:first-child',
      '.heading-3.topheader',
      '.heading-4',
      '.projecttitle.headertitledesc.lefty.brand-leader.morework.pricing:not(.lowerdown)',
    ];

    const firstReadElements = gsap.utils
      .toArray<HTMLElement>(firstReadSelectors.join(', '))
      .filter((element) => !animatedTextElements.has(element));

    if (firstReadElements.length) {
      gsap.set(firstReadElements, { autoAlpha: 0, y: 14 });
      gsap.to(firstReadElements, {
        autoAlpha: 1,
        y: 0,
        clearProps: 'opacity,visibility,transform',
        delay: 0.04,
        duration: 0.72,
        ease: 'power3.out',
        stagger: 0.055,
      });
    }

    const revealElements = gsap.utils
      .toArray<HTMLElement>(
        [
          '.projectblock',
          '.projectblocklink',
          '.smallproject',
          '.writingblocks',
          '.projectimg',
          '.projectimg-copy',
          '.projectimg-copy-copy',
          '.posttext > *',
          '.paragraph-4',
          '.paragraph-5',
          '.div-block-31',
        ].join(', '),
      )
      .filter(
        (element) =>
          !firstReadElements.includes(element) && !animatedTextElements.has(element) && !isTestimonialCard(element),
      );

    if (revealElements.length) {
      gsap.set(revealElements, { autoAlpha: 0, y: 22 });
      ScrollTrigger.batch(revealElements, {
        once: true,
        start: 'top 88%',
        onEnter: (batch) => {
          gsap.to(batch, {
            autoAlpha: 1,
            y: 0,
            clearProps: 'opacity,visibility,transform',
            duration: 0.68,
            ease: 'power3.out',
            stagger: 0.045,
          });
        },
      });
    }

    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      const hoverCards = gsap.utils.toArray<HTMLElement>('.projectblocklink, .smallproject, .writingblocks');
      hoverCards.forEach((card) => {
        addHoverTween(
          card,
          { y: -5, duration: 0.32, ease: 'power3.out', overwrite: 'auto' },
          { y: 0, duration: 0.42, ease: 'power3.out', overwrite: 'auto' },
        );
      });

      const hoverLinks = gsap.utils.toArray<HTMLElement>('.navlink');
      hoverLinks.forEach((link) => {
        addHoverTween(
          link,
          { y: -1, duration: 0.22, ease: 'power2.out', overwrite: 'auto' },
          { y: 0, duration: 0.28, ease: 'power2.out', overwrite: 'auto' },
        );
      });
    }

    initTestimonials();
    initAssociatePortraitCloud();
    cleanupListeners.push(initCtaWebglButtons());
    requestAnimationFrame(() => ScrollTrigger.refresh());
  });
};

document.addEventListener('astro:before-swap', cleanupMotion);
document.addEventListener('astro:page-load', initMotion);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMotion, { once: true });
} else {
  initMotion();
}
