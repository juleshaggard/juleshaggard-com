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

const initStickyNavVisibility = () => {
  const nav = document.querySelector<HTMLElement>('.nav');

  if (!nav) {
    return () => {};
  }

  let lastScrollY = Math.max(window.scrollY, 0);
  let ticking = false;

  const showNav = () => nav.classList.remove('nav--hidden');
  const hideNav = () => nav.classList.add('nav--hidden');

  const update = () => {
    const currentScrollY = Math.max(window.scrollY, 0);
    const delta = currentScrollY - lastScrollY;
    const shouldShow = currentScrollY <= 12 || delta < -4;
    const shouldHide = delta > 6 && currentScrollY > nav.offsetHeight;

    if (shouldShow) {
      showNav();
    } else if (shouldHide) {
      hideNav();
    }

    lastScrollY = currentScrollY;
    ticking = false;
  };

  const onScroll = () => {
    if (ticking) {
      return;
    }

    ticking = true;
    requestAnimationFrame(update);
  };

  nav.classList.remove('nav--hidden');
  window.addEventListener('scroll', onScroll, { passive: true });
  nav.addEventListener('focusin', showNav);

  return () => {
    window.removeEventListener('scroll', onScroll);
    nav.removeEventListener('focusin', showNav);
    nav.classList.remove('nav--hidden');
  };
};

const initNavHoverGlow = () => {
  const nav = document.querySelector<HTMLElement>('.nav');
  const glow = nav?.querySelector<HTMLElement>('.nav-hover-glow');

  if (!nav || !glow || reduceMotion.matches) {
    return () => {};
  }

  const targets = [...nav.querySelectorAll<HTMLElement>('.logo, .navlink')];

  if (!targets.length) {
    return () => {};
  }

  gsap.set(glow, { xPercent: -50, opacity: 0, scale: 0.92, scaleX: 1 });

  const xTo = gsap.quickTo(glow, 'x', { duration: 0.46, ease: 'power3.out' });
  const opacityTo = gsap.quickTo(glow, 'opacity', { duration: 0.24, ease: 'power2.out' });
  const scaleTo = gsap.quickTo(glow, 'scale', { duration: 0.32, ease: 'power3.out' });
  const scaleXTo = gsap.quickTo(glow, 'scaleX', { duration: 0.46, ease: 'power3.out' });
  let activeTarget: HTMLElement | null = null;

  const moveGlowTo = (target: HTMLElement, event?: PointerEvent) => {
    const navRect = nav.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const targetCenter = targetRect.left - navRect.left + targetRect.width / 2;
    const pointerX = event ? event.clientX - navRect.left : targetCenter;
    const mixedX = targetCenter * 0.72 + pointerX * 0.28;
    const scaleX = Math.min(1.34, Math.max(0.86, targetRect.width / 86));

    xTo(mixedX);
    opacityTo(1);
    scaleTo(1);
    scaleXTo(scaleX);
  };

  const hideGlow = () => {
    activeTarget = null;
    opacityTo(0);
    scaleTo(0.94);
    scaleXTo(0.92);
  };

  const onPointerEnter = (event: PointerEvent) => {
    const target = event.currentTarget as HTMLElement;
    activeTarget = target;
    moveGlowTo(target, event);
  };

  const onPointerMove = (event: PointerEvent) => {
    const target = event.currentTarget as HTMLElement;

    if (activeTarget === target) {
      moveGlowTo(target, event);
    }
  };

  const onFocus = (event: FocusEvent) => {
    const target = event.currentTarget as HTMLElement;
    activeTarget = target;
    moveGlowTo(target);
  };

  const onNavLeave = () => {
    if (!nav.matches(':focus-within')) {
      hideGlow();
    }
  };

  const onFocusOut = () => {
    requestAnimationFrame(() => {
      if (!nav.matches(':focus-within')) {
        hideGlow();
      }
    });
  };

  const onResize = () => {
    if (activeTarget) {
      moveGlowTo(activeTarget);
    }
  };

  targets.forEach((target) => {
    target.addEventListener('pointerenter', onPointerEnter);
    target.addEventListener('pointermove', onPointerMove);
    target.addEventListener('focus', onFocus);
    target.addEventListener('blur', onFocusOut);
  });
  nav.addEventListener('pointerleave', onNavLeave);
  window.addEventListener('resize', onResize);

  return () => {
    targets.forEach((target) => {
      target.removeEventListener('pointerenter', onPointerEnter);
      target.removeEventListener('pointermove', onPointerMove);
      target.removeEventListener('focus', onFocus);
      target.removeEventListener('blur', onFocusOut);
    });
    nav.removeEventListener('pointerleave', onNavLeave);
    window.removeEventListener('resize', onResize);
    gsap.killTweensOf(glow);
    gsap.set(glow, { clearProps: 'transform,opacity' });
  };
};

const testimonialGridSelector = '.aboutintro.hp.herohp.lowerdown.testimonials + .grid';
const testimonialHeadingSelector = '.aboutintro.hp.herohp.lowerdown.testimonials';
const isTestimonialCard = (element: HTMLElement) => element.matches(`${testimonialGridSelector} .paragraph-5`);
const marketAttentionSelector = '.homecontainer .aboutintro.hp.herohp.lowerdown:not(.testimonials)';

const initMarketAttentionInteraction = () => {
  const section = document.querySelector<HTMLElement>(marketAttentionSelector);
  if (!section || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    return () => {};
  }

  const eyesSvg = section.querySelector<SVGSVGElement>('.attention-eyes');
  const pupils = gsap.utils.toArray<SVGElement>('.attention-pupil', section);
  if (!pupils.length) {
    return () => {};
  }

  const eyeGeometry = pupils.map((pupil) =>
    pupil.classList.contains('attention-pupil--right')
      ? { eyeX: 103.403, eyeY: 48, pupilX: 126.09, pupilY: 47.7612 }
      : { eyeX: 31.7607, eyeY: 48, pupilX: 54.4478, pupilY: 47.7612 },
  );

  gsap.set(pupils, { x: 0, y: 0 });

  const xSetters = pupils.map((pupil) => gsap.quickTo(pupil, 'x', { duration: 0.24, ease: 'power3.out' }));
  const ySetters = pupils.map((pupil) => gsap.quickTo(pupil, 'y', { duration: 0.24, ease: 'power3.out' }));
  const activeGlitters = new Set<HTMLElement>();
  const activeTweens = new Set<gsap.core.Animation>();
  const glitterTweens = new Map<HTMLElement, gsap.core.Animation>();
  const glitterColors = [
    'oklch(0.84 0.13 345)',
    'oklch(0.91 0.09 338)',
    'oklch(0.73 0.08 342)',
    'oklch(0.97 0.025 330)',
  ];
  let lastEmit = 0;

  const expandedSectionRect = () => {
    const rect = section.getBoundingClientRect();
    return {
      top: rect.top - window.innerHeight * 0.1,
      right: rect.right,
      bottom: rect.bottom + window.innerHeight * 0.12,
      left: rect.left,
    };
  };

  const isInsideInteractionBand = (event: PointerEvent) => {
    const rect = expandedSectionRect();
    return (
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    );
  };

  const updateEyes = (event: PointerEvent) => {
    if (!eyesSvg) {
      return;
    }

    const svgRect = eyesSvg.getBoundingClientRect();

    pupils.forEach((_, index) => {
      const geometry = eyeGeometry[index];
      const centerX = svgRect.left + (geometry.eyeX / 136) * svgRect.width;
      const centerY = svgRect.top + (geometry.eyeY / 96) * svgRect.height;
      const deltaX = event.clientX - centerX;
      const deltaY = event.clientY - centerY;
      const angle = Math.atan2(deltaY, deltaX);
      const distance = Math.min(1, Math.hypot(deltaX, deltaY) / Math.max(window.innerWidth * 0.26, 280));
      const targetPupilX = geometry.eyeX + Math.cos(angle) * 22.75 * distance;
      const targetPupilY = geometry.eyeY + Math.sin(angle) * 9.25 * distance;
      const svgScaleX = svgRect.width / 136;
      const svgScaleY = svgRect.height / 96;

      xSetters[index]((targetPupilX - geometry.pupilX) * svgScaleX);
      ySetters[index]((targetPupilY - geometry.pupilY) * svgScaleY);
    });
  };

  const removeGlitter = (glitter: HTMLElement, tween?: gsap.core.Animation) => {
    const trackedTween = tween ?? glitterTweens.get(glitter);
    trackedTween?.kill();
    if (trackedTween) {
      activeTweens.delete(trackedTween);
      glitterTweens.delete(glitter);
    }
    activeGlitters.delete(glitter);
    glitter.remove();
  };

  const emitGlitter = (event: PointerEvent) => {
    const now = performance.now();
    if (now - lastEmit < 28) {
      return;
    }

    lastEmit = now;

    const glitterCount = gsap.utils.random([2, 3]);

    for (let i = 0; i < glitterCount; i += 1) {
      if (activeGlitters.size > 64) {
        const oldestGlitter = activeGlitters.values().next().value;
        if (oldestGlitter) removeGlitter(oldestGlitter);
      }

      const glitter = document.createElement('span');
      glitter.className = 'attention-glitter-particle';
      glitter.setAttribute('aria-hidden', 'true');
      glitter.style.setProperty('--sparkle-size', `${gsap.utils.random(5, 12)}px`);
      glitter.style.setProperty('--sparkle-color', gsap.utils.random(glitterColors));
      document.body.append(glitter);
      activeGlitters.add(glitter);

      const driftX = gsap.utils.random(-50, 50);
      const driftY = gsap.utils.random(-52, 38);
      const startScale = gsap.utils.random(0.46, 0.82);
      const endScale = gsap.utils.random(1.35, 2.3);
      const rotation = gsap.utils.random(-110, 110);
      const duration = gsap.utils.random(0.62, 0.96);
      const tween = gsap.timeline({ onComplete: () => removeGlitter(glitter, tween) });

      tween.fromTo(
        glitter,
        {
          x: event.clientX + gsap.utils.random(-10, 10),
          y: event.clientY + gsap.utils.random(-10, 10),
          scale: startScale,
          rotation,
          autoAlpha: 0.96,
          filter: 'blur(0px)',
        },
        {
          x: event.clientX + driftX,
          y: event.clientY + driftY,
          scale: endScale,
          rotation: rotation + gsap.utils.random(-180, 180),
          duration,
          ease: 'power3.out',
        },
        0,
      );

      tween.to(
        glitter,
        {
          filter: 'blur(3.6px)',
          duration: duration * 0.48,
          ease: 'power2.in',
        },
        duration * 0.36,
      );

      tween.to(
        glitter,
        {
          autoAlpha: 0,
          duration: duration * 0.62,
          ease: 'power2.in',
        },
        duration * 0.3,
      );

      activeTweens.add(tween);
      glitterTweens.set(glitter, tween);
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    updateEyes(event);
    if (isInsideInteractionBand(event)) {
      emitGlitter(event);
    }
  };

  window.addEventListener('pointermove', onPointerMove, { passive: true });

  return () => {
    window.removeEventListener('pointermove', onPointerMove);
    activeTweens.forEach((tween) => tween.kill());
    activeTweens.clear();
    glitterTweens.clear();
    activeGlitters.forEach((glitter) => glitter.remove());
    activeGlitters.clear();
    gsap.killTweensOf(pupils);
    gsap.set(pupils, { clearProps: 'transform' });
  };
};

const initTestimonialHeartParticles = (grid: HTMLElement) => {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    return;
  }

  const heading = document.querySelector<HTMLElement>(testimonialHeadingSelector);
  const activeHearts = new Set<HTMLElement>();
  const activeTweens = new Set<gsap.core.Animation>();
  const heartTweens = new Map<HTMLElement, gsap.core.Animation>();
  const heartSprites = ['/assets/hearts/heart01.png', '/assets/hearts/heart02.png', '/assets/hearts/heart03.png'];
  let lastEmit = 0;

  heartSprites.forEach((src) => {
    const image = new Image();
    image.src = src;
  });

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

    const heart = document.createElement('img');
    heart.className = 'testimonial-heart-particle';
    heart.setAttribute('aria-hidden', 'true');
    heart.alt = '';
    heart.decoding = 'async';
    heart.src = gsap.utils.random(heartSprites);
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

    }

    initTestimonials();
    initAssociatePortraitCloud();
    cleanupListeners.push(initMarketAttentionInteraction());
    cleanupListeners.push(initNavHoverGlow());
    cleanupListeners.push(initStickyNavVisibility());
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
