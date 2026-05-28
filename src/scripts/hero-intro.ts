import { gsap } from 'gsap';

const heroSelector = '.homecontainer > .aboutintro.hp.herohp:first-child';
const headlineSelector = '.heading-3.topheader.herohero';

interface HeroIntro {
  animatedElements: Set<HTMLElement>;
  cleanup: () => void;
}

interface LiquidRenderer {
  canvas: HTMLCanvasElement;
  pulse: () => void;
  destroy: () => void;
}

const createShader = (gl: WebGLRenderingContext, type: number, source: string) => {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }

  return shader;
};

const createProgram = (gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string) => {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

  if (!vertexShader || !fragmentShader) return null;

  const program = gl.createProgram();
  if (!program) return null;

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }

  return program;
};

const vertexSource = `
  attribute vec2 a_position;

  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const fragmentSource = `
  precision highp float;

  uniform vec2 u_resolution;
  uniform vec2 u_pointer;
  uniform float u_time;
  uniform float u_intensity;
  uniform float u_intro;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);

    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;

    for (int i = 0; i < 4; i++) {
      value += amplitude * noise(p);
      p = mat2(1.6, -1.2, 1.2, 1.6) * p;
      amplitude *= 0.5;
    }

    return value;
  }

  void main() {
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    float aspect = u_resolution.x / u_resolution.y;
    vec2 uv = vec2(st.x * aspect, st.y);
    vec2 pointer = vec2(u_pointer.x * aspect, u_pointer.y);
    float pointerDistance = distance(uv, pointer);
    float pull = exp(-pointerDistance * 3.4) * u_intensity;

    vec2 drift = vec2(u_time * 0.032, -u_time * 0.024);
    vec2 flow = uv + drift;
    flow += vec2(
      fbm(uv * 1.7 + vec2(0.0, u_time * 0.018)),
      fbm(uv * 1.5 + vec2(u_time * 0.012, 0.0))
    ) * 0.18;
    flow += (pointer - uv) * pull * 0.09;

    float field = fbm(flow * 2.15);
    float line = sin((uv.x * 2.65 + field * 1.85 + pull * 0.75) * 3.14159);
    float ribbonA = smoothstep(0.085, 0.0, abs((uv.y - 0.53) + line * 0.105 + (field - 0.5) * 0.16));
    float ribbonB = smoothstep(0.06, 0.0, abs((uv.y - 0.46) - line * 0.072 + (field - 0.5) * 0.12));
    float cursorBloom = smoothstep(0.36, 0.0, pointerDistance) * 0.12 * u_intensity;
    float edgeFade = smoothstep(0.0, 0.14, st.x) * smoothstep(1.0, 0.86, st.x);
    edgeFade *= smoothstep(0.0, 0.08, st.y) * smoothstep(1.0, 0.08, 1.0 - st.y);
    float alpha = (ribbonA * 0.2 + ribbonB * 0.14 + cursorBloom) * edgeFade * u_intro;

    gl_FragColor = vec4(vec3(0.052, 0.048, 0.043), alpha);
  }
`;

const createLiquidRenderer = (hero: HTMLElement): LiquidRenderer | undefined => {
  const canvas = document.createElement('canvas');
  canvas.className = 'hero-liquid-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  hero.prepend(canvas);

  const gl = canvas.getContext('webgl', {
    alpha: true,
    antialias: false,
    depth: false,
    premultipliedAlpha: false,
    stencil: false,
  });

  if (!gl) {
    canvas.remove();
    return undefined;
  }

  const program = createProgram(gl, vertexSource, fragmentSource);
  if (!program) {
    canvas.remove();
    return undefined;
  }

  const buffer = gl.createBuffer();
  const positionLocation = gl.getAttribLocation(program, 'a_position');
  const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
  const pointerLocation = gl.getUniformLocation(program, 'u_pointer');
  const timeLocation = gl.getUniformLocation(program, 'u_time');
  const intensityLocation = gl.getUniformLocation(program, 'u_intensity');
  const introLocation = gl.getUniformLocation(program, 'u_intro');

  if (!buffer || positionLocation < 0) {
    canvas.remove();
    return undefined;
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );
  gl.useProgram(program);
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  let frame = 0;
  let pulseTimer = 0;
  let intro = 0;
  let intensity = 0.18;
  let targetIntensity = 0.18;
  let pointerX = 0.5;
  let pointerY = 0.5;
  let targetPointerX = 0.5;
  let targetPointerY = 0.5;
  const startedAt = performance.now();

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.6);
    const width = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const height = Math.max(1, Math.round(canvas.clientHeight * dpr));

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
  };

  const render = (now: number) => {
    resize();

    pointerX += (targetPointerX - pointerX) * 0.075;
    pointerY += (targetPointerY - pointerY) * 0.075;
    intensity += (targetIntensity - intensity) * 0.06;
    intro += (1 - intro) * 0.045;

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
    gl.uniform2f(pointerLocation, pointerX, pointerY);
    gl.uniform1f(timeLocation, (now - startedAt) * 0.001);
    gl.uniform1f(intensityLocation, intensity);
    gl.uniform1f(introLocation, intro);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    frame = requestAnimationFrame(render);
  };

  const updatePointer = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    targetPointerX = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0.5;
    targetPointerY = rect.height > 0 ? 1 - (event.clientY - rect.top) / rect.height : 0.5;
    targetPointerX = gsap.utils.clamp(0, 1, targetPointerX);
    targetPointerY = gsap.utils.clamp(0, 1, targetPointerY);
    targetIntensity = 0.92;
  };

  const releasePointer = () => {
    targetPointerX = 0.5;
    targetPointerY = 0.5;
    targetIntensity = 0.18;
  };

  hero.addEventListener('pointermove', updatePointer);
  hero.addEventListener('pointerleave', releasePointer);
  frame = requestAnimationFrame(render);

  return {
    canvas,
    pulse: () => {
      window.clearTimeout(pulseTimer);
      targetIntensity = 1.5;
      pulseTimer = window.setTimeout(() => {
        targetIntensity = 0.28;
      }, 340);
    },
    destroy: () => {
      window.clearTimeout(pulseTimer);
      cancelAnimationFrame(frame);
      hero.removeEventListener('pointermove', updatePointer);
      hero.removeEventListener('pointerleave', releasePointer);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      canvas.remove();
    },
  };
};

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

const splitHeadline = (headline: HTMLElement) => {
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

export const initHeroIntro = (): HeroIntro => {
  const animatedElements = new Set<HTMLElement>();
  const cleanups: Array<() => void> = [];
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
  const liquid = createLiquidRenderer(hero);

  hero.classList.add('hero-liquid-stage', 'hero-ready');
  animatedElements.add(hero);
  animatedElements.add(headline);
  if (copy) animatedElements.add(copy);

  if (liquid) {
    cleanups.push(liquid.destroy);
  }

  gsap.set(headline, { autoAlpha: 1 });
  gsap.set(chars, {
    autoAlpha: 0,
    yPercent: 68,
    rotationX: -42,
    filter: 'blur(8px)',
    transformOrigin: '50% 78%',
  });

  if (copy) {
    gsap.set(copy.children, { autoAlpha: 0, y: 14 });
  }

  const intro = gsap.timeline({
    defaults: {
      ease: 'power4.out',
    },
  });

  if (liquid) {
    intro.to(liquid.canvas, { opacity: 0.86, duration: 1.25 }, 0);
  }

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

  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    let lastWave = 0;
    const wave = (from: 'center' | 'start' = 'center') => {
      const now = performance.now();
      if (now - lastWave < 850) return;

      lastWave = now;
      liquid?.pulse();
      gsap.fromTo(
        chars,
        {
          yPercent: (index) => (index % 2 === 0 ? -9 : 7),
          rotation: (index) => (index % 2 === 0 ? -1.2 : 1.2),
        },
        {
          yPercent: 0,
          rotation: 0,
          duration: 0.72,
          ease: 'power3.out',
          stagger: {
            amount: 0.38,
            from,
          },
          overwrite: 'auto',
          clearProps: 'transform',
        },
      );
    };

    const onPointerEnter = () => wave('center');
    const onFocus = () => wave('start');

    headline.addEventListener('pointerenter', onPointerEnter);
    headline.addEventListener('focus', onFocus);

    cleanups.push(() => {
      headline.removeEventListener('pointerenter', onPointerEnter);
      headline.removeEventListener('focus', onFocus);
    });
  }

  return {
    animatedElements,
    cleanup: () => cleanups.forEach((cleanup) => cleanup()),
  };
};
