/**
 * Hand-built 3D models for common school topics, in the same scene format as AI-built ones
 * (see model3d-schema.ts). A lesson that clearly matches one gets it for free, with no AI call.
 */
import type { Scene, SceneObject, Vec3 } from "./model3d-schema";

type Part = Partial<SceneObject> & Pick<SceneObject, "id" | "shape" | "label" | "info" | "color">;
const part = (o: Part): SceneObject => ({
  position: [0, 0, 0], size: [0.5, 0.5, 0.5], rotation: [0, 0, 0], opacity: 1, to: null,
  motion: { kind: "none", center: null, speed: 1 }, hideLabel: false, ...o,
});
const round = (n: number) => Math.round(n * 1000) / 1000;
/** A point on a flat circle of radius r, at an angle in degrees. */
const onCircle = (r: number, deg: number, y = 0): Vec3 => [round(r * Math.cos((deg * Math.PI) / 180)), y, round(r * Math.sin((deg * Math.PI) / 180))];
const orbit = (center: string | null, speed: number) => ({ kind: "orbit" as const, center, speed });

/* ------------------------------------------------------------------ solar system */
const PLANETS = [
  { id: "mercury", label: "Mercury", r: 2.0, size: 0.12, color: "#a39d94", speed: 1.6, deg: 20, info: "The smallest planet and closest to the Sun. It has almost no air, so it is very hot by day and very cold at night." },
  { id: "venus", label: "Venus", r: 2.6, size: 0.2, color: "#e2b86b", speed: 1.2, deg: 140, info: "The hottest planet, because its thick clouds trap heat. It is the brightest planet in our night sky." },
  { id: "earth", label: "Earth", r: 3.3, size: 0.22, color: "#3f7fd1", speed: 1.0, deg: 250, info: "Our planet, the third from the Sun. It has liquid water and air, which make life possible." },
  { id: "mars", label: "Mars", r: 4.0, size: 0.16, color: "#c4532f", speed: 0.8, deg: 320, info: "The red planet: its soil has iron oxide (rust). It has two small moons." },
  { id: "jupiter", label: "Jupiter", r: 5.0, size: 0.5, color: "#d4a373", speed: 0.45, deg: 80, info: "The largest planet, a giant ball of gas. It has a giant storm called the Great Red Spot and many moons." },
  { id: "saturn", label: "Saturn", r: 6.1, size: 0.42, color: "#e6cf8b", speed: 0.35, deg: 200, info: "A gas giant famous for its rings, made of ice and rock. It is so light it would float in water." },
  { id: "uranus", label: "Uranus", r: 7.0, size: 0.3, color: "#8fd3e0", speed: 0.25, deg: 290, info: "An ice giant that spins on its side, so it seems to roll around the Sun." },
  { id: "neptune", label: "Neptune", r: 7.8, size: 0.29, color: "#4a6fd6", speed: 0.2, deg: 30, info: "The farthest planet from the Sun. It is a cold, windy ice giant." },
];
const solarSystem: Scene = {
  title: "The solar system",
  intro: "The Sun and the eight planets moving around it. Distances and sizes are not to scale. Inner planets go around faster than outer ones.",
  objects: [
    part({ id: "sun", shape: "sphere", label: "Sun", info: "The Sun is a star: a huge ball of hot gases that gives out heat and light. All the planets go around it.", color: "#f6b93b", size: [1.2, 0, 0], motion: { kind: "pulse", center: null, speed: 0.4 } }),
    ...PLANETS.map((p) => part({ id: p.id, shape: "sphere", label: p.label, info: p.info, color: p.color, position: onCircle(p.r, p.deg), size: [p.size, 0, 0], motion: orbit("sun", p.speed) })),
    part({ id: "moon", shape: "sphere", label: "Moon", info: "The Moon is Earth's natural satellite. It goes around the Earth about once a month and shines by reflecting sunlight.", color: "#d9d9d9", position: (() => { const e = onCircle(3.3, 250); return [round(e[0] + 0.5), 0, e[2]] as Vec3; })(), size: [0.07, 0, 0], motion: orbit("earth", 3) }),
    part({ id: "saturn-rings", shape: "torus", label: "Saturn's rings", info: "Saturn's rings are made of billions of pieces of ice and rock.", color: "#cdb77a", position: onCircle(6.1, 200), size: [0.72, 0.09, 0], rotation: [20, 0, 0], opacity: 0.8, motion: orbit("saturn", 1), hideLabel: true }),
  ],
  steps: [
    { caption: "The Sun is at the centre. It is a star, and its gravity keeps the planets moving around it.", focus: ["sun"] },
    { caption: "The four inner planets are small and rocky: Mercury, Venus, Earth and Mars.", focus: ["mercury", "venus", "earth", "mars"] },
    { caption: "Earth goes around the Sun once a year, and the Moon goes around the Earth.", focus: ["earth", "moon"] },
    { caption: "The four outer planets are giants made mostly of gas and ice: Jupiter, Saturn, Uranus and Neptune.", focus: ["jupiter", "saturn", "saturn-rings", "uranus", "neptune"] },
    { caption: "Each planet moves in its own path (orbit). The farther it is, the longer it takes to go around once.", focus: PLANETS.map((p) => p.id) },
  ],
};

/* ------------------------------------------------------------------ layers of the Earth */
const earthLayers: Scene = {
  title: "Layers of the Earth",
  intro: "The Earth is made of layers, like an onion. The outer layers are see-through here so you can look inside. The deeper you go, the hotter it gets.",
  objects: [
    part({ id: "crust", shape: "sphere", label: "Crust", info: "The thin, rocky outer layer we live on. It is about 5 to 70 km thick, thinnest under the oceans.", color: "#6f8f4f", size: [4.0, 0, 0], opacity: 0.18 }),
    part({ id: "mantle", shape: "sphere", label: "Mantle", info: "The thickest layer (about 2,900 km). Its hot rock flows very slowly, which moves the plates of the crust.", color: "#c4552f", size: [3.6, 0, 0], opacity: 0.3 }),
    part({ id: "outer-core", shape: "sphere", label: "Outer core", info: "Liquid iron and nickel. Its movement creates the Earth's magnetic field.", color: "#f09a3e", size: [2.0, 0, 0], opacity: 0.5 }),
    part({ id: "inner-core", shape: "sphere", label: "Inner core", info: "A solid ball of iron and nickel at the centre, as hot as the Sun's surface. It stays solid because of the huge pressure.", color: "#f6d35b", size: [1.0, 0, 0], motion: { kind: "pulse", center: null, speed: 0.4 } }),
    part({ id: "heat-arrow", shape: "arrow", label: "Hotter and denser", info: "Going down from the crust towards the centre, temperature and pressure both increase.", color: "#d1544f", position: [4.8, 3.0, 0], to: [1.3, 0.9, 0], size: [0.06, 0, 0] }),
  ],
  steps: [
    { caption: "The crust is the outermost layer. Compared with the whole Earth it is as thin as an apple's skin.", focus: ["crust"] },
    { caption: "Below it is the mantle, the thickest layer, made of hot rock that flows very slowly.", focus: ["mantle"] },
    { caption: "The outer core is liquid metal. Its movement makes the Earth a giant magnet.", focus: ["outer-core"] },
    { caption: "The inner core is solid metal at the very centre.", focus: ["inner-core"] },
    { caption: "The deeper you go, the hotter it gets and the greater the pressure.", focus: ["heat-arrow", "inner-core"] },
  ],
};

/* ------------------------------------------------------------------ candle flame */
const candleFlame: Scene = {
  title: "Zones of a candle flame",
  intro: "A candle flame has three zones. Each burns differently and has a different temperature. Rotate it to see how the zones sit inside each other.",
  objects: [
    part({ id: "candle", shape: "cylinder", label: "Candle (wax)", info: "Solid wax melts near the flame, rises up the wick and turns into vapour, which burns.", color: "#f4efe1", position: [0, -2.6, 0], size: [0.7, 3.0, 0] }),
    part({ id: "wick", shape: "cylinder", label: "Wick", info: "The thread that carries melted wax up to the flame.", color: "#3b3330", position: [0, -0.85, 0], size: [0.05, 0.5, 0] }),
    part({ id: "dark-zone", shape: "cone", label: "Innermost zone (dark)", info: "Unburnt wax vapour around the wick. It is the least hot part of the flame.", color: "#3a2e2a", position: [0, -0.25, 0], size: [0.25, 0.75, 0], opacity: 0.9 }),
    part({ id: "luminous-zone", shape: "cone", label: "Middle zone (luminous)", info: "Wax burns only partly here because there isn't enough air. It glows yellow and gives light. It is moderately hot.", color: "#ffc93c", position: [0, 0.45, 0], size: [0.55, 2.0, 0], opacity: 0.5, motion: { kind: "pulse", center: null, speed: 0.8 } }),
    part({ id: "non-luminous-zone", shape: "cone", label: "Outer zone (non-luminous)", info: "Plenty of air reaches here, so the wax burns completely. It is blue, gives little light and is the hottest part.", color: "#5b9bff", position: [0, 0.6, 0], size: [0.78, 2.6, 0], opacity: 0.22, motion: { kind: "pulse", center: null, speed: 0.8 } }),
    part({ id: "air-arrow", shape: "arrow", label: "Air (oxygen) comes in", info: "Oxygen from the air reaches the outer zone most easily, which is why burning is complete there.", color: "#3aa6a0", position: [2.6, -0.2, 0], to: [0.95, 0.4, 0], size: [0.05, 0, 0] }),
  ],
  steps: [
    { caption: "Heat melts the wax, the wick carries it up, and it turns into vapour that burns.", focus: ["candle", "wick"] },
    { caption: "The innermost dark zone is unburnt wax vapour. It is the least hot.", focus: ["dark-zone"] },
    { caption: "The middle yellow zone burns only partly. It gives the flame its light.", focus: ["luminous-zone"] },
    { caption: "The outer blue zone gets the most air, so burning is complete there. It is the hottest zone, which is why goldsmiths use it to melt gold.", focus: ["non-luminous-zone", "air-arrow"] },
  ],
};

/** The atom, cells and molecules are covered by the narrated 3D lessons (src/lib/knowa), which are richer. */
export const LIBRARY: Record<string, Scene> = {
  "solar-system": solarSystem, "earth-layers": earthLayers, "candle-flame": candleFlame,
};

/** Words and phrases that point at each model, with a weight. Phrases in the lesson title or chapter count double. */
const KEYWORDS: Record<keyof typeof LIBRARY & string, [string, number][]> = {
  "solar-system": [["solar system", 6], ["planet", 2], ["mercury", 1], ["venus", 1], ["jupiter", 2], ["saturn", 2], ["neptune", 2], ["orbit", 1], ["sun", 1]],
  "earth-layers": [["layers of the earth", 6], ["interior of the earth", 6], ["inner core", 3], ["outer core", 3], ["mantle", 3], ["crust", 2]],
  "candle-flame": [["zones of a flame", 6], ["zones of flame", 6], ["candle flame", 5], ["luminous zone", 4], ["non-luminous", 4], ["luminous", 2], ["flame", 1], ["wick", 1]],
};
const THRESHOLD = 8;

const count = (hay: string, word: string) => {
  const re = new RegExp(`(^|[^a-z0-9])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "g");
  return hay.match(re)?.length ?? 0;
};

/**
 * The hand-built model that clearly fits a lesson, or null. Scores each model by how often its words appear
 * (each counted at most 3 times; double in the title or chapter) and needs a clear winner over the threshold.
 */
export function matchLibrary(lesson: { chapter: string; title: string; text: string }): string | null {
  const head = `${lesson.chapter} ${lesson.title}`.toLowerCase();
  const body = lesson.text.toLowerCase();
  const scores = Object.entries(KEYWORDS).map(([id, words]) => ({
    id,
    score: words.reduce((sum, [w, weight]) => sum + weight * (Math.min(count(head, w), 3) * 2 + Math.min(count(body, w), 3)), 0),
  })).sort((a, b) => b.score - a.score);
  const [best, next] = scores;
  if (best.score < THRESHOLD) return null;
  // Two models scoring nearly the same (e.g. a lesson comparing plant and animal cells): the stronger match still wins, a tie doesn't.
  if (next && next.score === best.score) return null;
  return best.id;
}
