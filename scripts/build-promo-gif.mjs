/**
 * Build a compact promotional GIF from JSVision's authentic README screenshots.
 *
 * The montage is intentionally generated from committed captures rather than mock UI artwork. This
 * keeps directory submissions and social posts honest while making the asset reproducible whenever
 * the screenshots change.
 *
 * Usage:
 *   node scripts/build-promo-gif.mjs
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPOSITORY_ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUTPUT = resolve(REPOSITORY_ROOT, 'assets/promo/jsvision-demo.gif');
const FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf';
const WIDTH = 720;
const HEIGHT = 448;
const FRAME_RATE = 6;
const SCENE_SECONDS = 2.3;
const TRANSITION_SECONDS = 0.4;

/** The real product captures and concise feature labels shown in montage order. */
const SCENES = [
  ['assets/readme/desktop.png', 'JSVision desktop | menus and movable windows'],
  ['assets/readme/theme-designer.png', 'Reactive themes and localized UI'],
  ['assets/readme/data-grid.png', 'Editable data grids'],
  ['assets/readme/code-editor.png', 'Terminal-native code editor'],
  ['assets/readme/matrix-rain.png', 'Matrix rain | the same engine in the browser'],
];

/**
 * Run one media command and surface its diagnostics when it fails.
 *
 * @param {string} command Executable name available on PATH.
 * @param {string[]} args Argument vector passed without shell interpolation.
 */
function run(command, args) {
  const result = spawnSync(command, args, { cwd: REPOSITORY_ROOT, encoding: 'utf8' });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} failed:\n${result.stderr || result.stdout}`);
  }
}

/** Validate every fixed input before starting an expensive encode. */
function validateInputs() {
  for (const [relativePath] of SCENES) {
    if (!existsSync(resolve(REPOSITORY_ROOT, relativePath))) {
      throw new Error(`missing promotional screenshot: ${relativePath}`);
    }
  }
  if (!existsSync(FONT)) throw new Error(`missing caption font: ${FONT}`);
}

/**
 * Create the filter graph that normalizes each capture, adds a caption, and cross-fades scenes.
 *
 * @returns {string} An ffmpeg complex-filter expression ending in the `montage` stream.
 */
function buildMontageFilter() {
  const filters = SCENES.map(
    ([, label], index) =>
      `[${index}:v]scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=decrease,` +
      `pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=#050b1c,` +
      `drawbox=x=0:y=0:w=iw:h=52:color=#050b1c@0.88:t=fill,` +
      `drawtext=fontfile=${FONT}:text='${label}':fontcolor=#f8fafc:fontsize=22:x=22:y=14,` +
      `setsar=1,settb=AVTB[scene${index}]`,
  );

  let previous = 'scene0';
  for (let index = 1; index < SCENES.length; index += 1) {
    const output = index === SCENES.length - 1 ? 'montage' : `transition${index}`;
    const offset = (SCENE_SECONDS - TRANSITION_SECONDS) * index;
    filters.push(
      `[${previous}][scene${index}]xfade=transition=fade:duration=${TRANSITION_SECONDS}:` +
        `offset=${offset.toFixed(1)}[${output}]`,
    );
    previous = output;
  }
  return filters.join(';');
}

/** Build an intermediate video so palette generation and GIF encoding see identical frames. */
function buildVideo(videoPath) {
  const inputs = SCENES.flatMap(([relativePath]) => [
    '-loop',
    '1',
    '-t',
    String(SCENE_SECONDS),
    '-i',
    resolve(REPOSITORY_ROOT, relativePath),
  ]);
  run('ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    ...inputs,
    '-filter_complex',
    buildMontageFilter(),
    '-map',
    '[montage]',
    '-r',
    String(FRAME_RATE),
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    videoPath,
  ]);
}

/** Encode the final GIF with a palette derived from the completed montage. */
function buildGif(videoPath, palettePath) {
  run('ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    videoPath,
    '-vf',
    `fps=${FRAME_RATE},palettegen=stats_mode=diff`,
    palettePath,
  ]);
  run('ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    videoPath,
    '-i',
    palettePath,
    '-filter_complex',
    `[0:v]fps=${FRAME_RATE}[frames];[frames][1:v]paletteuse=dither=bayer:bayer_scale=5`,
    '-loop',
    '0',
    OUTPUT,
  ]);
}

/** Validate inputs, build both encoding passes, and always clean temporary artifacts. */
function main() {
  validateInputs();
  mkdirSync(dirname(OUTPUT), { recursive: true });
  const temporaryDirectory = mkdtempSync(join(tmpdir(), 'jsvision-promo-'));
  const videoPath = join(temporaryDirectory, 'montage.mp4');
  const palettePath = join(temporaryDirectory, 'palette.png');
  try {
    buildVideo(videoPath);
    buildGif(videoPath, palettePath);
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
  process.stdout.write(`built assets/promo/jsvision-demo.gif\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`promotional GIF build failed: ${String(error)}\n`);
  process.exitCode = 1;
}
