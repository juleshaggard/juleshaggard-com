const ctaSelector = '.ctalink, .mainline.inver.rightsidecontact.contact';
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const vertexShaderSource = `
  attribute vec2 a_position;
  varying vec2 v_uv;

  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const fragmentShaderSource = `
  precision mediump float;

  varying vec2 v_uv;
  uniform float u_time;
  uniform vec2 u_resolution;
  uniform vec2 u_pointer;

  float hash(vec2 point) {
    return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 point) {
    vec2 i = floor(point);
    vec2 f = fract(point);
    vec2 u = f * f * (3.0 - 2.0 * f);

    return mix(
      mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 point) {
    float value = 0.0;
    float amplitude = 0.5;

    for (int i = 0; i < 5; i++) {
      value += amplitude * noise(point);
      point *= 2.02;
      amplitude *= 0.52;
    }

    return value;
  }

  void main() {
    vec2 uv = v_uv;
    vec2 aspect = vec2(max(u_resolution.x / max(u_resolution.y, 1.0), 1.0), 1.0);
    vec2 field = uv * aspect;
    float time = u_time * 0.001;
    float grain = fbm(field * 4.4 + vec2(time * 0.32, -time * 0.22));
    float silk = sin((uv.x * 9.4) + (uv.y * 4.2) + (time * 2.0) + grain * 4.8) * 0.5 + 0.5;
    float pulse = fbm(field * 8.0 - vec2(time * 0.74, time * 0.18));
    float pointerGlow = smoothstep(0.56, 0.0, distance(uv, u_pointer));
    float mixValue = smoothstep(0.34, 0.9, grain * 0.62 + silk * 0.3 + pulse * 0.16 + pointerGlow * 0.34);

    vec3 darkPink = vec3(0.58, 0.018, 0.285);
    vec3 brightPink = vec3(0.995, 0.12, 0.55);
    vec3 hotPink = vec3(1.0, 0.48, 0.74);
    vec3 color = mix(darkPink, brightPink, mixValue);
    color = mix(color, hotPink, pointerGlow * 0.34);
    color += (noise(uv * u_resolution.xy * 0.58 + time * 8.0) - 0.5) * 0.045;

    gl_FragColor = vec4(color, 1.0);
  }
`;

const compileShader = (gl: WebGLRenderingContext, type: number, source: string) => {
  const shader = gl.createShader(type);

  if (!shader) {
    return null;
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }

  return shader;
};

const createProgram = (gl: WebGLRenderingContext) => {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

  if (!vertexShader || !fragmentShader) {
    return null;
  }

  const program = gl.createProgram();

  if (!program) {
    return null;
  }

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

const ensureCtaLabel = (cta: HTMLElement) => {
  if (cta.querySelector(':scope > .cta-label')) {
    return;
  }

  const label = document.createElement('span');
  label.className = 'cta-label';

  while (cta.firstChild) {
    label.append(cta.firstChild);
  }

  cta.append(label);
};

const createRenderer = (cta: HTMLElement) => {
  ensureCtaLabel(cta);

  const canvas = document.createElement('canvas');
  canvas.className = 'cta-noise-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  cta.prepend(canvas);

  const gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false,
  });

  if (!gl) {
    canvas.remove();
    return null;
  }

  const program = createProgram(gl);

  if (!program) {
    canvas.remove();
    return null;
  }

  const positionBuffer = gl.createBuffer();
  const positionLocation = gl.getAttribLocation(program, 'a_position');
  const timeLocation = gl.getUniformLocation(program, 'u_time');
  const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
  const pointerLocation = gl.getUniformLocation(program, 'u_pointer');
  const pointer = { x: 0.5, y: 0.5 };
  let animationFrame = 0;
  let running = false;

  if (!positionBuffer || positionLocation < 0 || !timeLocation || !resolutionLocation || !pointerLocation) {
    canvas.remove();
    return null;
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

  const resize = () => {
    const rect = cta.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    gl.viewport(0, 0, width, height);
  };

  const render = (time: number) => {
    resize();
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1f(timeLocation, time);
    gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
    gl.uniform2f(pointerLocation, pointer.x, pointer.y);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    if (running) {
      animationFrame = requestAnimationFrame(render);
    }
  };

  const setPointer = (event: PointerEvent | MouseEvent | FocusEvent) => {
    if (!('clientX' in event) || !event.clientX || !event.clientY) {
      pointer.x = 0.5;
      pointer.y = 0.5;
      return;
    }

    const rect = cta.getBoundingClientRect();
    pointer.x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    pointer.y = 1 - Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
  };

  const start = (event: PointerEvent | MouseEvent | FocusEvent) => {
    setPointer(event);
    cta.classList.add('cta-webgl-active');

    if (running) {
      return;
    }

    running = true;
    animationFrame = requestAnimationFrame(render);
  };

  const stop = () => {
    cta.classList.remove('cta-webgl-active');
    running = false;

    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    }
  };

  const destroy = () => {
    stop();
    gl.deleteBuffer(positionBuffer);
    gl.deleteProgram(program);
    canvas.remove();
  };

  resize();

  return { destroy, resize, setPointer, start, stop };
};

export const initCtaWebglButtons = () => {
  if (prefersReducedMotion.matches) {
    return () => {};
  }

  const ctas = [...document.querySelectorAll<HTMLElement>(ctaSelector)];

  if (!ctas.length) {
    return () => {};
  }

  const cleanupCallbacks: Array<() => void> = [];

  ctas.forEach((cta) => {
    const renderer = createRenderer(cta);

    if (!renderer) {
      return;
    }

    cta.classList.add('cta-webgl-ready');

    const onPointerEnter = (event: PointerEvent) => renderer.start(event);
    const onPointerMove = (event: PointerEvent) => renderer.setPointer(event);
    const onPointerLeave = () => renderer.stop();
    const onFocus = (event: FocusEvent) => renderer.start(event);
    const onBlur = () => renderer.stop();
    const onResize = () => renderer.resize();

    cta.addEventListener('pointerenter', onPointerEnter);
    cta.addEventListener('pointermove', onPointerMove);
    cta.addEventListener('pointerleave', onPointerLeave);
    cta.addEventListener('focus', onFocus);
    cta.addEventListener('blur', onBlur);
    window.addEventListener('resize', onResize);

    cleanupCallbacks.push(() => {
      cta.removeEventListener('pointerenter', onPointerEnter);
      cta.removeEventListener('pointermove', onPointerMove);
      cta.removeEventListener('pointerleave', onPointerLeave);
      cta.removeEventListener('focus', onFocus);
      cta.removeEventListener('blur', onBlur);
      window.removeEventListener('resize', onResize);
      cta.classList.remove('cta-webgl-ready', 'cta-webgl-active');
      renderer.destroy();
    });
  });

  return () => cleanupCallbacks.forEach((cleanup) => cleanup());
};
