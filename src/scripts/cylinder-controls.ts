type CylinderControlGroup = {
  heightPx: number;
  scale: number;
  x: number;
  y: number;
  pitch: number;
  yaw: number;
  speed: number;
  backfaceVisible: boolean;
};

type LogoCylinderControlGroup = CylinderControlGroup & {
  bandHeightPx: number;
  heightCompression: number;
};

type CameraControlGroup = {
  fov: number;
  z: number;
  x: number;
  y: number;
  pitch: number;
  yaw: number;
  roll: number;
};

type CanvasControlGroup = {
  topOffsetPx: number;
  heightOffsetPx: number;
  widthOffsetPx: number;
  x: number;
  opacity: number;
};

type FogControlGroup = {
  enabled: boolean;
  near: number;
  far: number;
};

export type CylinderControlState = {
  canvas: CanvasControlGroup;
  title: CylinderControlGroup;
  logos: LogoCylinderControlGroup;
  camera: CameraControlGroup;
  fog: FogControlGroup;
};

type SliderConfig = {
  type: 'slider';
  group: keyof CylinderControlState;
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
};

type ToggleConfig = {
  type: 'toggle';
  group: keyof CylinderControlState;
  key: string;
  label: string;
  value: boolean;
};

type ControlConfig = SliderConfig | ToggleConfig;

const storageKey = 'jules:cylinder-controls:v7';
const eventName = 'jules:cylinder-controls';
const mobileLayoutQuery = '(max-width: 767px)';

const cloneState = (state: CylinderControlState): CylinderControlState => ({
  canvas: { ...state.canvas },
  title: { ...state.title },
  logos: { ...state.logos },
  camera: { ...state.camera },
  fog: { ...state.fog },
});

const readStoredState = () => {
  try {
    const stored = window.localStorage.getItem(storageKey);
    return stored ? (JSON.parse(stored) as Partial<CylinderControlState>) : undefined;
  } catch {
    return undefined;
  }
};

const writeStoredState = (state: CylinderControlState) => {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // localStorage can be unavailable in private or constrained contexts.
  }
};

const getRoundedHeight = (selector: string, fallback: number) => {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) return fallback;

  const height = element.getBoundingClientRect().height;
  return Math.max(1, Math.round(height || fallback));
};

const getDefaultState = (): CylinderControlState => {
  const isMobile = window.matchMedia(mobileLayoutQuery).matches;

  return {
    canvas: {
      topOffsetPx: -70,
      heightOffsetPx: -2,
      widthOffsetPx: 0,
      x: 0,
      opacity: 1,
    },
    title: {
      heightPx: 278,
      scale: 0.76,
      x: 0,
      y: isMobile ? -0.6 : 1.69,
      pitch: 0.23,
      yaw: 0,
      speed: 1,
      backfaceVisible: true,
    },
    logos: {
      heightPx: getRoundedHeight('.agency-logo-cylinder', 224),
      bandHeightPx: 210,
      heightCompression: 1.32,
      scale: 0.59,
      x: 0,
      y: isMobile ? 2.15 : 0.35,
      pitch: -0.39,
      yaw: 0,
      speed: 1,
      backfaceVisible: true,
    },
    camera: {
      fov: 42,
      z: 25,
      x: 0,
      y: 0,
      pitch: 0,
      yaw: 0,
      roll: 0,
    },
    fog: {
      enabled: true,
      near: 20,
      far: 33,
    },
  };
};

const mergeState = (base: CylinderControlState, stored?: Partial<CylinderControlState>): CylinderControlState => ({
  canvas: {
    ...base.canvas,
    ...(stored?.canvas ?? {}),
  },
  title: {
    ...base.title,
    ...(stored?.title ?? {}),
  },
  logos: {
    ...base.logos,
    ...(stored?.logos ?? {}),
  },
  camera: {
    ...base.camera,
    ...(stored?.camera ?? {}),
  },
  fog: {
    ...base.fog,
    ...(stored?.fog ?? {}),
  },
});

const dispatchState = (state: CylinderControlState) => {
  window.__julesCylinderControls = cloneState(state);
  window.dispatchEvent(new CustomEvent<CylinderControlState>(eventName, { detail: cloneState(state) }));
};

const setElementPixels = (selector: string, property: 'height' | 'minHeight', value: number) => {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) return;

  element.style[property] = `${Math.round(value)}px`;
};

const applyLayoutState = (state: CylinderControlState) => {
  setElementPixels('.agency-cylinder-headline', 'height', state.title.heightPx);
  setElementPixels('.agency-logo-cylinder', 'height', state.logos.heightPx);
  setElementPixels('.agency-pattern-logo-band', 'minHeight', state.logos.bandHeightPx);
};

const formatValue = (value: number, step: number) => {
  if (step >= 1) return Math.round(value).toString();
  if (step >= 0.1) return value.toFixed(1);
  return value.toFixed(2);
};

const copyText = async (text: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  throw new Error('Clipboard API is unavailable.');
};

const makeSlider = (config: SliderConfig, state: CylinderControlState, onChange: () => void) => {
  const row = document.createElement('label');
  row.className = 'cylinder-controls__row';

  const text = document.createElement('span');
  text.className = 'cylinder-controls__label';
  text.textContent = config.label;

  const output = document.createElement('output');
  output.className = 'cylinder-controls__value';
  output.value = formatValue(config.value, config.step);
  output.textContent = output.value;

  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(config.min);
  input.max = String(config.max);
  input.step = String(config.step);
  input.value = String(config.value);
  input.dataset.group = config.group;
  input.dataset.key = config.key;

  input.addEventListener('input', () => {
    const group = input.dataset.group as keyof CylinderControlState;
    const key = input.dataset.key;
    if (!group || !key) return;

    const nextValue = Number(input.value);
    const target = state[group] as unknown as Record<string, number>;
    target[key] = nextValue;
    output.value = formatValue(nextValue, config.step);
    output.textContent = output.value;
    onChange();
  });

  const header = document.createElement('span');
  header.className = 'cylinder-controls__row-header';
  header.append(text, output);
  row.append(header, input);

  return row;
};

const makeToggle = (config: ToggleConfig, state: CylinderControlState, onChange: () => void) => {
  const row = document.createElement('label');
  row.className = 'cylinder-controls__toggle-row';

  const text = document.createElement('span');
  text.className = 'cylinder-controls__label';
  text.textContent = config.label;

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = config.value;
  input.dataset.group = config.group;
  input.dataset.key = config.key;

  input.addEventListener('input', () => {
    const group = input.dataset.group as keyof CylinderControlState;
    const key = input.dataset.key;
    if (!group || !key) return;

    const target = state[group] as unknown as Record<string, number | boolean>;
    target[key] = input.checked;
    onChange();
  });

  row.append(input, text);

  return row;
};

const makeGroup = (
  title: string,
  controls: ControlConfig[],
  state: CylinderControlState,
  onChange: () => void,
) => {
  const group = document.createElement('fieldset');
  group.className = 'cylinder-controls__group';

  const legend = document.createElement('legend');
  legend.textContent = title;
  group.append(legend);

  controls.forEach((control) => {
    group.append(control.type === 'toggle' ? makeToggle(control, state, onChange) : makeSlider(control, state, onChange));
  });

  return group;
};

const getControlConfig = (state: CylinderControlState): ControlConfig[] => [
  {
    type: 'slider',
    group: 'canvas',
    key: 'topOffsetPx',
    label: 'Top',
    min: -240,
    max: 240,
    step: 1,
    value: state.canvas.topOffsetPx,
  },
  {
    type: 'slider',
    group: 'canvas',
    key: 'heightOffsetPx',
    label: 'Height',
    min: -280,
    max: 520,
    step: 1,
    value: state.canvas.heightOffsetPx,
  },
  {
    type: 'slider',
    group: 'canvas',
    key: 'widthOffsetPx',
    label: 'Width',
    min: -520,
    max: 520,
    step: 1,
    value: state.canvas.widthOffsetPx,
  },
  { type: 'slider', group: 'canvas', key: 'x', label: 'X', min: -260, max: 260, step: 1, value: state.canvas.x },
  {
    type: 'slider',
    group: 'canvas',
    key: 'opacity',
    label: 'Opacity',
    min: 0.1,
    max: 1,
    step: 0.01,
    value: state.canvas.opacity,
  },
  {
    type: 'slider',
    group: 'title',
    key: 'heightPx',
    label: 'Canvas height',
    min: 120,
    max: 460,
    step: 1,
    value: state.title.heightPx,
  },
  { type: 'slider', group: 'title', key: 'scale', label: 'Scale', min: 0.05, max: 1.45, step: 0.01, value: state.title.scale },
  { type: 'slider', group: 'title', key: 'x', label: 'X', min: -3, max: 3, step: 0.01, value: state.title.x },
  { type: 'slider', group: 'title', key: 'y', label: 'Y', min: -6, max: 4, step: 0.01, value: state.title.y },
  { type: 'slider', group: 'title', key: 'pitch', label: 'Pitch', min: -0.8, max: 0.8, step: 0.01, value: state.title.pitch },
  { type: 'slider', group: 'title', key: 'yaw', label: 'Yaw', min: -1.2, max: 1.2, step: 0.01, value: state.title.yaw },
  { type: 'slider', group: 'title', key: 'speed', label: 'Speed', min: -2, max: 2, step: 0.01, value: state.title.speed },
  { type: 'toggle', group: 'title', key: 'backfaceVisible', label: 'Backface visible', value: state.title.backfaceVisible },
  {
    type: 'slider',
    group: 'logos',
    key: 'heightPx',
    label: 'Canvas height',
    min: 120,
    max: 520,
    step: 1,
    value: state.logos.heightPx,
  },
  {
    type: 'slider',
    group: 'logos',
    key: 'bandHeightPx',
    label: 'Band height',
    min: 120,
    max: 560,
    step: 1,
    value: state.logos.bandHeightPx,
  },
  {
    type: 'slider',
    group: 'logos',
    key: 'heightCompression',
    label: 'Height compression',
    min: 0.25,
    max: 1.75,
    step: 0.01,
    value: state.logos.heightCompression,
  },
  { type: 'slider', group: 'logos', key: 'scale', label: 'Scale', min: 0.05, max: 1.7, step: 0.01, value: state.logos.scale },
  { type: 'slider', group: 'logos', key: 'x', label: 'X', min: -3, max: 3, step: 0.01, value: state.logos.x },
  { type: 'slider', group: 'logos', key: 'y', label: 'Y', min: -6, max: 4, step: 0.01, value: state.logos.y },
  { type: 'slider', group: 'logos', key: 'pitch', label: 'Pitch', min: -0.9, max: 0.9, step: 0.01, value: state.logos.pitch },
  { type: 'slider', group: 'logos', key: 'yaw', label: 'Yaw', min: -1.2, max: 1.2, step: 0.01, value: state.logos.yaw },
  { type: 'slider', group: 'logos', key: 'speed', label: 'Speed', min: -2, max: 2, step: 0.01, value: state.logos.speed },
  { type: 'toggle', group: 'logos', key: 'backfaceVisible', label: 'Backface visible', value: state.logos.backfaceVisible },
  { type: 'slider', group: 'camera', key: 'fov', label: 'FOV', min: 12, max: 42, step: 0.1, value: state.camera.fov },
  { type: 'slider', group: 'camera', key: 'z', label: 'Z', min: 12, max: 45, step: 0.1, value: state.camera.z },
  { type: 'slider', group: 'camera', key: 'x', label: 'X', min: -5, max: 5, step: 0.01, value: state.camera.x },
  { type: 'slider', group: 'camera', key: 'y', label: 'Y', min: -5, max: 5, step: 0.01, value: state.camera.y },
  { type: 'slider', group: 'camera', key: 'pitch', label: 'Pitch', min: -0.5, max: 0.5, step: 0.01, value: state.camera.pitch },
  { type: 'slider', group: 'camera', key: 'yaw', label: 'Yaw', min: -0.5, max: 0.5, step: 0.01, value: state.camera.yaw },
  { type: 'slider', group: 'camera', key: 'roll', label: 'Roll', min: -0.5, max: 0.5, step: 0.01, value: state.camera.roll },
  { type: 'toggle', group: 'fog', key: 'enabled', label: 'Fog enabled', value: state.fog.enabled },
  { type: 'slider', group: 'fog', key: 'near', label: 'Near', min: 8, max: 36, step: 0.1, value: state.fog.near },
  { type: 'slider', group: 'fog', key: 'far', label: 'Far', min: 12, max: 56, step: 0.1, value: state.fog.far },
];

export const initCylinderControls = () => {
  const root = document.querySelector<HTMLElement>('.cylinder-home');
  if (!root) {
    return () => {};
  }

  let state = mergeState(getDefaultState(), readStoredState());
  let collapsed = false;
  const panel = document.createElement('aside');
  panel.className = 'cylinder-controls';
  panel.setAttribute('aria-label', 'Cylinder controls');

  const header = document.createElement('div');
  header.className = 'cylinder-controls__top';

  const heading = document.createElement('h2');
  heading.textContent = 'Cylinder controls';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'cylinder-controls__toggle';
  toggle.textContent = 'Hide';

  header.append(heading, toggle);

  const body = document.createElement('div');
  body.className = 'cylinder-controls__body';

  const controls = getControlConfig(state);
  const flush = () => {
    applyLayoutState(state);
    writeStoredState(state);
    dispatchState(state);
  };

  body.append(
    makeGroup(
      'Canvas',
      controls.filter((control) => control.group === 'canvas'),
      state,
      flush,
    ),
    makeGroup(
      'Title cylinder',
      controls.filter((control) => control.group === 'title'),
      state,
      flush,
    ),
    makeGroup(
      'Logo cylinder',
      controls.filter((control) => control.group === 'logos'),
      state,
      flush,
    ),
    makeGroup(
      'Camera',
      controls.filter((control) => control.group === 'camera'),
      state,
      flush,
    ),
    makeGroup(
      'Fog',
      controls.filter((control) => control.group === 'fog'),
      state,
      flush,
    ),
  );

  const footer = document.createElement('div');
  footer.className = 'cylinder-controls__footer';

  const copy = document.createElement('button');
  copy.type = 'button';
  copy.className = 'cylinder-controls__copy';
  copy.textContent = 'Copy values';
  copy.addEventListener('click', () => {
    void copyText(JSON.stringify(cloneState(state), null, 2))
      .then(() => {
        copy.textContent = 'Copied';
        window.setTimeout(() => {
          copy.textContent = 'Copy values';
        }, 1200);
      })
      .catch(() => {
        copy.textContent = 'Copy failed';
        window.setTimeout(() => {
          copy.textContent = 'Copy values';
        }, 1400);
      });
  });

  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'cylinder-controls__reset';
  reset.textContent = 'Reset';
  reset.addEventListener('click', () => {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // Ignore storage failures.
    }

    window.location.reload();
  });

  footer.append(copy, reset);
  body.append(footer);
  panel.append(header, body);
  document.body.append(panel);

  toggle.addEventListener('click', () => {
    collapsed = !collapsed;
    panel.classList.toggle('is-collapsed', collapsed);
    toggle.textContent = collapsed ? 'Show' : 'Hide';
  });

  const cleanup = () => {
    panel.remove();
  };

  applyLayoutState(state);
  dispatchState(state);

  return () => {
    cleanup();
  };
};
