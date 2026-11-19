/**
 * Narrated 3D lessons (from Knowa). Each step is a little script the tutor performs: speak `say`,
 * write `note` on the notepad, move sliders (`set`), point the camera (`view`) and point at a part (`focus`).
 * No AI is involved: these are fixed, checked lessons.
 */
export type LessonVisual = { type: "table"; head?: string[]; rows: string[][]; caption?: string } | { type: "flow"; boxes: string[]; caption?: string };
export type LessonNote = { title?: string; lines?: string[]; formula?: string; code?: string[]; mark?: number[]; same?: boolean; visual?: LessonVisual };
export type LessonStep = { say: string; note?: LessonNote; model?: string; set?: Record<string, number | string>; focus?: string | null; view?: string };
export type LessonQuiz = { q: string; options: string[]; answer: number; why: string };
export type Lesson = { id: string; model: string; subject: string; title: string; blurb: string; chapter: string; classes: number[]; steps: LessonStep[]; quiz: LessonQuiz[] };

export const LESSONS: Lesson[] = [
{ id: "mensuration", model: "mensuration", subject: "Maths", title: "Cone, sphere and cylinder: the 1 : 2 : 3 secret", blurb: "Why is there a ⅓ in the cone formula? Pour water and see.", chapter: "Surface Areas and Volumes", classes: [8, 9, 10],
 steps: [
 { model: "mensuration", set: { cones: 0, spheres: 0 }, view: "default", focus: null,
  say: "Today we find out why three formulas you have been memorising are really one story. Look at these three vessels. All three have the same radius r, and the cone and the cylinder also have the same height, two r.",
  note: { title: "Our three vessels", lines: ["Cylinder: radius r, height h = 2r", "Cone: radius r, height h = 2r", "Sphere: radius r, so it is 2r across too"] } },
 { focus: "cylinder", view: "cylinder", say: "Start with the cylinder. Its volume is base area times height. That is pi r squared times two r, which gives two pi r cubed.",
  note: { title: "Cylinder", lines: ["Base area = πr²", "Height = 2r"], formula: "V = πr² × 2r = 2πr³" } },
 { focus: "cone", view: "cone", say: "Now the cone. Your book says one third pi r squared h. But why one third? Let us not just believe it. Let us pour water and test it.",
  note: { title: "Cone", lines: ["Same base and same height as the cylinder"], formula: "V = ⅓πr²h = ⅔πr³" } },
 { set: { cones: 1 }, focus: "cylinder", view: "cylinder", say: "I fill the cone and pour it into the cylinder. See that? One cone of water rises only one third of the way up.",
  note: { title: "Pour test", lines: ["1 cone fills ⅓ of the cylinder"] } },
 { set: { cones: 3 }, say: "Two more cones, and the cylinder is exactly full. Three cones make one cylinder. So a cone holds one third of a cylinder with the same base and height. That is where the one third comes from.",
  note: { same: true, lines: ["3 cones = 1 cylinder", "So cone = ⅓ × cylinder"] } },
 { set: { cones: 0, spheres: 0 }, focus: "sphere", view: "sphere", say: "Now the sphere. A legend says Archimedes was so proud of this result that he wanted a sphere inside a cylinder carved on his tomb.",
  note: { title: "Sphere", lines: ["Radius r, fits snugly in the cylinder"], formula: "V = 4⁄3 πr³" } },
 { set: { spheres: 1 }, focus: "cylinder", view: "cylinder", say: "I pour one sphere of water into the cylinder. It rises two thirds of the way. So the sphere is two thirds of the cylinder: two thirds of two pi r cubed, which is four thirds pi r cubed.",
  note: { title: "Pour test: sphere", lines: ["1 sphere fills ⅔ of the cylinder", "⅔ × 2πr³ = 4⁄3 πr³"] } },
 { set: { cones: 1, spheres: 1 }, view: "default", focus: null, say: "Put it all together. One cone and one sphere poured together fill the cylinder exactly. So cone, sphere and cylinder are in the ratio one to two to three.",
  note: { title: "The big picture", lines: ["Cone : Sphere : Cylinder = 1 : 2 : 3", "Cone + Sphere = Cylinder"], formula: "⅓ + ⅔ = 1" } },
 { say: "An exam tip. When a question melts one solid and recasts it into another, the volume stays the same. Equate the volumes, cancel pi and common factors, and keep all units the same.",
  note: { title: "Exam tip", lines: ["Melting and recasting: volume stays the same", "Cancel π first, then solve", "Keep all lengths in the same unit"] } },
 ],
 quiz: [
  { q: "A cone and a cylinder have the same base radius and the same height. What is the ratio of their volumes, cone : cylinder?", options: ["1 : 2", "1 : 3", "2 : 3", "1 : 1"], answer: 1, why: "Three cones of water fill one cylinder, so the cone is ⅓ of the cylinder." },
  { q: "A sphere of radius r fits exactly inside a cylinder of height 2r. What fraction of the cylinder does the sphere fill?", options: ["⅓", "½", "⅔", "¾"], answer: 2, why: "Sphere = 4⁄3 πr³ and cylinder = 2πr³. Dividing gives ⅔." },
  { q: "Find the volume of a cone with r = 3 cm and h = 7 cm. Take π = 22/7.", options: ["66 cm³", "198 cm³", "132 cm³", "33 cm³"], answer: 0, why: "⅓ × 22/7 × 9 × 7 = 22 × 3 = 66 cm³." },
 ] },
{ id: "pythag", model: "pythag", subject: "Maths", title: "Pythagoras: see why a² + b² = c²", blurb: "Slide four triangles around and the proof appears.", chapter: "Triangles / Pythagoras Theorem", classes: [7, 8, 9, 10],
 steps: [
 { model: "pythag", set: { a: 3, b: 4, proof: 0 }, view: "default", focus: "triangles",
  say: "Pythagoras tells us that in a right-angled triangle, a squared plus b squared equals c squared. Instead of memorising it, let us see why. Here are four identical right triangles, with legs a equals three and b equals four, inside a big square of side a plus b.",
  note: { title: "The set-up", lines: ["4 identical right triangles", "Legs a = 3 and b = 4", "Big square has side a + b = 7"] } },
 { focus: "csquare", say: "In the middle is a tilted square. Each side of it is the hypotenuse of a triangle, so its side is c, and its area is c squared.", note: { title: "The middle square", lines: ["Side = hypotenuse = c", "Area = c²"] } },
 { focus: "outer", say: "The big square has area a plus b, all squared. Each triangle has area half a b, so the four of them take two a b. Whatever is left over must be c squared.",
  note: { title: "Count the area", lines: ["Big square = (a + b)²", "4 triangles = 4 × ½ab = 2ab"], formula: "c² = (a + b)² − 2ab" } },
 { set: { proof: 1 }, focus: null, say: "Now watch carefully. I slide the triangles to new places without changing them at all. The big square is the same and the four triangles are the same, but the empty space now splits into two squares: one with side b, and one with side a.",
  note: { title: "Slide the triangles", lines: ["Same 4 triangles, same big square", "The empty space is now two squares"] } },
 { focus: "bsq", say: "This one has side b, which is four. So its area is b squared, sixteen." },
 { focus: "asq", say: "And this one has side a, which is three. Its area is a squared, nine." },
 { focus: null, say: "Both pictures leave exactly the same area uncovered. So c squared equals a squared plus b squared. Nine plus sixteen is twenty five, so c is five.",
  note: { title: "Pythagoras Theorem", lines: ["Hypotenuse² = sum of squares of the other two sides", "c = √25 = 5"], formula: "a² + b² = c²  →  9 + 16 = 25" } },
 { set: { a: 5, b: 12 }, view: "default", say: "Try other numbers. With a equals five and b equals twelve, we get twenty five plus one hundred forty four, which is one sixty nine. So c is thirteen. Triples like three four five and five twelve thirteen love appearing in exams.",
  note: { title: "Favourite triples", lines: ["(3, 4, 5) · (5, 12, 13)", "(8, 15, 17) · (7, 24, 25)", "Multiples work too: (6, 8, 10)"] } },
 { say: "One more thing. The converse is also true. If the three sides of a triangle satisfy a squared plus b squared equals c squared, then the triangle is right-angled. Always test the longest side as c.",
  note: { title: "Converse", lines: ["If a² + b² = c², the triangle is right-angled", "Take the longest side as c"] } },
 ],
 quiz: [
  { q: "A 10 m ladder rests against a wall with its foot 6 m from the wall. How high up the wall does it reach?", options: ["6 m", "8 m", "10 m", "4 m"], answer: 1, why: "h² = 10² − 6² = 100 − 36 = 64, so h = 8 m." },
  { q: "Which set of sides forms a right-angled triangle?", options: ["5, 7, 9", "6, 8, 10", "4, 5, 6", "7, 8, 10"], answer: 1, why: "6² + 8² = 36 + 64 = 100 = 10²." },
  { q: "In the rearrangement proof, the big square has area (a + b)². What is the total area of the four triangles?", options: ["2ab", "ab", "4ab", "ab/2"], answer: 0, why: "Each triangle is ½ab, so four of them make 2ab." },
 ] },
{ id: "solids", model: "solids", subject: "Maths", title: "Euler's formula: V − E + F = 2", blurb: "Count corners, edges and faces on five solids.", chapter: "Visualising Solid Shapes", classes: [8, 9],
 steps: [
 { model: "solids", set: { solid: "cube", count: 0, explode: 0 }, view: "default", focus: null,
  say: "A polyhedron is a solid whose faces are all flat polygons. Where two faces meet we get an edge, and where edges meet we get a vertex, or corner. Let us count on this cube.",
  note: { title: "Words to know", lines: ["**Face**: a flat surface", "**Edge**: where two faces meet", "**Vertex**: a corner where edges meet"] } },
 { set: { count: 0.33 }, focus: "vertices", say: "First the vertices. I tap them one by one from the bottom up. Eight corners in all." },
 { set: { count: 0.66 }, focus: "edges", say: "Next the edges, the straight lines between the corners. There are twelve." },
 { set: { count: 1, explode: 0.7 }, focus: "faces", say: "And the faces. I pull them apart so you can count each flat square. Six faces." },
 { set: { explode: 0 }, focus: null, say: "Now work out V minus E plus F. That is eight minus twelve plus six, which is two. Euler noticed that the answer is two for every solid like this.",
  note: { title: "Euler's formula", lines: ["Cube: 8 − 12 + 6 = 2"], formula: "V − E + F = 2" } },
 { set: { solid: "tetra" }, say: "Test it on a tetrahedron, a pyramid with four triangular faces. It has four vertices, six edges and four faces. Four minus six plus four is two again.", note: { same: true, lines: ["Tetrahedron: 4 − 6 + 4 = 2"] } },
 { set: { solid: "dodeca" }, say: "And the dodecahedron, which has twelve pentagon faces. Twenty vertices, thirty edges, twelve faces. Twenty minus thirty plus twelve is, once more, two.", note: { same: true, lines: ["Dodecahedron: 20 − 30 + 12 = 2"] } },
 { say: "So if you know any two numbers, you can find the third. A solid with six faces and eight vertices must have six plus eight minus two, which is twelve edges. This works for solids with flat faces and no holes.",
  note: { title: "Use it in exams", lines: ["6 faces, 8 vertices → E = 6 + 8 − 2 = 12", "Works for polyhedra without holes"], formula: "E = V + F − 2" } },
 ],
 quiz: [
  { q: "A polyhedron has 12 faces and 20 vertices. How many edges does it have?", options: ["28", "30", "32", "34"], answer: 1, why: "E = V + F − 2 = 20 + 12 − 2 = 30." },
  { q: "Which of these is NOT a polyhedron?", options: ["Cube", "Triangular prism", "Cylinder", "Square pyramid"], answer: 2, why: "A cylinder has a curved surface, so not all its faces are flat polygons." },
  { q: "An octahedron has 8 faces and 12 edges. How many vertices?", options: ["4", "6", "8", "10"], answer: 1, why: "V = E − F + 2 = 12 − 8 + 2 = 6." },
 ] },
{ id: "atom", model: "atom", subject: "Science", title: "Bohr's atom: shells, configuration and valency", blurb: "Build the first 20 elements electron by electron.", chapter: "Structure of the Atom", classes: [8, 9, 10],
 steps: [
 { model: "atom", set: { Z: 1 }, view: "default", focus: "nucleus", say: "Every atom has a tiny, dense nucleus in the middle, and electrons moving around it in shells. This is hydrogen, the simplest atom: one proton in the nucleus, and one electron outside.",
  note: { title: "Hydrogen", lines: ["1 proton in the nucleus", "1 electron in the K shell"] } },
 { set: { Z: 6 }, focus: "nucleus", say: "Now carbon. The nucleus holds protons, which are positive, and neutrons, which have no charge. The number of protons is the atomic number Z. Carbon has six protons and six neutrons, so its mass number A is twelve.",
  note: { title: "Inside the nucleus", lines: ["Atomic number Z = number of protons", "Mass number A = protons + neutrons"], formula: "A = p + n  →  12 = 6 + 6" } },
 { focus: "K", say: "Electrons live in shells called K, L, M and N. Bohr said a shell number n can hold at most two n squared electrons. So the K shell holds two, and the L shell holds eight.",
  note: { title: "Shells", lines: ["K (n = 1): at most 2", "L (n = 2): at most 8", "Outermost shell: never more than 8"], formula: "max electrons = 2n²" } },
 { set: { Z: 11 }, focus: "valence", say: "Sodium has eleven electrons. Fill K with two, L with eight, and one is left over. It sits all alone in the M shell. So the configuration is two, eight, one.",
  note: { title: "Sodium (Z = 11)", lines: ["K = 2, L = 8, M = 1"], formula: "2, 8, 1" } },
 { focus: "valence", say: "That lonely outer electron is the valence electron. Sodium gives it away easily, so its valency is one. Valency depends only on the outermost shell." },
 { set: { Z: 17 }, focus: "valence", say: "Chlorine has seventeen electrons: two, eight, seven. It needs just one more electron to complete eight in its outer shell, so its valency is eight minus seven, which is one.",
  note: { title: "Chlorine (Z = 17)", lines: ["Configuration 2, 8, 7", "Needs 1 electron for an octet", "Valency = 8 − 7 = 1"] } },
 { set: { Z: 18 }, focus: "valence", say: "Argon, with eighteen electrons, is two, eight, eight. Its outer shell already has a full octet, so it does not gain, lose or share electrons. Its valency is zero, and it is an inert gas.",
  note: { title: "Argon (Z = 18)", lines: ["Configuration 2, 8, 8: full octet", "Valency 0, so inert"] } },
 { set: { Z: 20 }, focus: "N", say: "Finally calcium, with twenty electrons. Why is it not two, eight, ten? Because the outermost shell can never hold more than eight. So the last two electrons go into the N shell: two, eight, eight, two.",
  note: { title: "Calcium (Z = 20)", lines: ["Outermost shell holds at most 8"], formula: "2, 8, 8, 2" } },
 { focus: null, say: "An exam tip. To write a configuration, fill K first, then L, then M, and so on. For valency, look only at the outer shell. If it has four or fewer electrons, that number is the valency. If it has more, subtract it from eight.",
  note: { title: "Exam tip", lines: ["Fill shells in order K → L → M → N", "Outer e⁻ ≤ 4 → valency = outer e⁻", "Outer e⁻ > 4 → valency = 8 − outer e⁻"] } },
 ],
 quiz: [
  { q: "What is the electronic configuration of magnesium (Z = 12)?", options: ["2, 8, 2", "2, 10", "2, 8, 1", "2, 6, 4"], answer: 0, why: "Two in K, eight in L, and the remaining two in M." },
  { q: "What is the valency of oxygen (Z = 8)?", options: ["1", "2", "6", "8"], answer: 1, why: "Configuration 2, 6. It needs two more electrons, so valency = 8 − 6 = 2." },
  { q: "An atom has 17 protons and 18 neutrons. What is its mass number?", options: ["17", "18", "35", "1"], answer: 2, why: "A = protons + neutrons = 17 + 18 = 35. This is chlorine-35." },
 ] },
{ id: "cell", model: "cell", subject: "Science", title: "Inside a cell: animal and plant", blurb: "Slice a cell open and meet every organelle.", chapter: "The Fundamental Unit of Life", classes: [8, 9],
 steps: [
 { model: "cell", set: { type: "animal", cut: 0.6 }, view: "default", focus: "membrane", say: "Every living thing is built from cells. This is an animal cell, and I have cut a window into the front so we can look inside. The thin skin you see is the cell membrane. It decides what may enter and what may leave.",
  note: { title: "The cell", lines: ["The fundamental unit of life", "Cell membrane: selectively permeable"] } },
 { focus: "nucleus", say: "In the middle is the nucleus, the control room of the cell. It carries the DNA in the form of chromosomes, and the bright dots on its surface are pores in its double membrane.",
  note: { title: "Nucleus", lines: ["Controls all the cell’s activities", "Contains DNA (chromosomes)", "Double membrane with pores"] } },
 { focus: "mitochondria", say: "These bean shapes are mitochondria, the powerhouses. They break down glucose to release energy as ATP, which the cell spends like pocket money. The zig-zag folds inside are called cristae.",
  note: { title: "Mitochondria", lines: ["Release energy from food (respiration)", "Energy currency: ATP", "Inner folds: cristae"] } },
 { focus: "er", say: "Wrapped around the nucleus is the endoplasmic reticulum, a maze of tubes. The rough part is dotted with ribosomes, the tiny protein factories, and helps make proteins. The smooth part makes fats, or lipids.",
  note: { title: "ER and ribosomes", lines: ["Rough ER: has ribosomes → proteins", "Smooth ER: lipids", "Ribosomes also float free"] } },
 { focus: "golgi", say: "The stack of curved sheets is the Golgi apparatus. Think of it as the cell’s post office. It receives proteins and lipids, packs them into little bags, and sends them where they are needed.",
  note: { title: "Golgi apparatus", lines: ["Packs, modifies and dispatches materials"] } },
 { focus: "lysosome", say: "The coral balls are lysosomes. They are full of digestive enzymes, so they clean up waste and worn-out parts.",
  note: { title: "Lysosomes", lines: ["Digestive enzymes", "Clean up waste and old organelles"] } },
 { set: { type: "plant" }, focus: "wall", say: "Now a plant cell. Outside its membrane it has a stiff cell wall made of cellulose. This gives the plant its fixed shape and strength.",
  note: { title: "Only in plant cells", lines: ["Cell wall (cellulose)", "Chloroplasts", "One large central vacuole"] } },
 { focus: "chloroplast", say: "The green discs are chloroplasts. They contain chlorophyll and make food by photosynthesis, which is why plants do not need to eat." },
 { focus: "vacuole", say: "And this big blue sac is the central vacuole. It stores water and cell sap, and keeps the cell firm, like air in a balloon. Animal cells only have small vacuoles." },
 ],
 quiz: [
  { q: "Which organelle is called the powerhouse of the cell?", options: ["Nucleus", "Mitochondria", "Golgi apparatus", "Lysosome"], answer: 1, why: "Mitochondria release energy as ATP during respiration." },
  { q: "Which of these is found in plant cells but NOT in animal cells?", options: ["Mitochondria", "Nucleus", "Cell wall", "Ribosome"], answer: 2, why: "Only plant cells have a cellulose cell wall." },
  { q: "Where are proteins made in the cell?", options: ["Golgi apparatus", "Lysosomes", "Ribosomes", "Vacuole"], answer: 2, why: "Ribosomes are the protein factories." },
 ] },
{ id: "molecule", model: "molecule", subject: "Science", title: "Covalent bonds and the shape of molecules", blurb: "See shared electrons, lone pairs and bond angles.", chapter: "Carbon and its Compounds", classes: [8, 9, 10],
 steps: [
 { model: "molecule", set: { mol: "water", electrons: 0 }, view: "default", focus: "central", say: "Atoms join to complete their outer shell. Look at water. Oxygen needs two more electrons to reach eight, and each hydrogen needs one more to reach two. So they share.",
  note: { title: "Why atoms bond", lines: ["Atoms want a full outer shell", "Oxygen needs 2 more electrons", "Hydrogen needs 1 more electron"] } },
 { set: { electrons: 1 }, focus: "electrons", say: "Switch on the electrons. Each glowing pair between two atoms is one shared pair. This sharing is called a covalent bond. Oxygen shares one pair with each hydrogen.",
  note: { title: "Covalent bond", lines: ["Atoms **share** pairs of electrons", "Single bond = 1 shared pair"], formula: "H – O – H" } },
 { focus: "lonepairs", say: "But oxygen has two more pairs that it keeps to itself. These are lone pairs, and they are not part of any bond." },
 { focus: "angle", say: "Those lone pairs push on the bonds and squeeze them together. That is why water is bent, with an angle of one hundred and four point five degrees, and not a straight line.",
  note: { title: "Shape of water", lines: ["Bent shape", "H–O–H angle = 104.5°"], formula: "∠HOH = 104.5°" } },
 { set: { mol: "co2" }, focus: "bonds", say: "Carbon dioxide is different. Carbon shares two pairs with each oxygen, which makes double bonds. Carbon has no lone pairs to bend the molecule, so it is a straight line, one hundred and eighty degrees.",
  note: { title: "Carbon dioxide", lines: ["Two double bonds", "Linear, 180°"], formula: "O = C = O" } },
 { set: { mol: "ch4" }, focus: "central", say: "Methane. Carbon has four electrons in its outer shell, so its valency is four. It makes four single bonds, and they spread out as far apart as possible in 3D, forming a tetrahedron with angles of one hundred and nine point five degrees.",
  note: { title: "Methane", lines: ["Carbon valency = 4", "Four single bonds", "Tetrahedral, 109.5°"] } },
 { set: { mol: "nh3" }, focus: "lonepairs", say: "Ammonia has three bonds and one lone pair on the nitrogen. The lone pair pushes the hydrogens down into a pyramid, and squeezes the angle to about one hundred and seven degrees.",
  note: { title: "Ammonia", lines: ["3 bonds + 1 lone pair", "Pyramid shape, 107°"] } },
 { focus: null, say: "An exam tip. To draw an electron dot structure, count the valence electrons of each atom, then share pairs until every atom except hydrogen has eight around it, and hydrogen has two.",
  note: { title: "Exam tip", lines: ["Count valence electrons first", "Share pairs until each atom is stable", "Octet for most atoms, duet for H"] } },
 ],
 quiz: [
  { q: "How many covalent bonds can one carbon atom form?", options: ["1", "2", "4", "8"], answer: 2, why: "Carbon has 4 outer electrons, so its valency is 4." },
  { q: "What kind of bond joins carbon to each oxygen in CO₂?", options: ["Single covalent", "Double covalent", "Ionic", "Triple covalent"], answer: 1, why: "Carbon shares two pairs with each oxygen." },
  { q: "Which molecule is linear?", options: ["H₂O", "CH₄", "CO₂", "NH₃"], answer: 2, why: "CO₂ is O=C=O in a straight line, 180°." },
 ] },
{ id: "lens", model: "lens", subject: "Science", title: "Lenses: draw the image with three rays", blurb: "Move the object and watch the image change.", chapter: "Light: Mirrors and Lenses", classes: [8, 10],
 steps: [
 { model: "lens", set: { lens: "convex", u: 25, f: 10 }, view: "default", focus: "focus", say: "A convex lens is thicker in the middle. It bends parallel rays so they meet at a single point, the principal focus F. The distance from the lens to F is the focal length, and here it is ten centimetres. I have also marked two F, which is twenty centimetres.",
  note: { title: "Convex lens", lines: ["Converging lens", "Focal length f = 10 cm", "F₁, F₂ at 10 cm; 2F₁, 2F₂ at 20 cm"] } },
 { focus: "object", say: "Now we place an object, this arrow, twenty five centimetres in front of the lens. To find its image, we only need three special rays, and we can draw them without any maths." },
 { focus: "ray1", say: "Ray one travels parallel to the axis. After the lens, it bends and passes through the focus on the other side.",
  note: { title: "Three rays", lines: ["① Parallel to axis → through F₂", "② Through the optical centre → straight on", "③ Through F₁ → emerges parallel"] } },
 { focus: "ray2", say: "Ray two goes through the centre of the lens. The lens is very thin there, so the ray goes straight on without bending." },
 { focus: "ray3", say: "Ray three is aimed at the focus on this side, so after the lens it comes out parallel to the axis." },
 { focus: "image", say: "All three meet at one point, and that is the tip of the image. It is real, because the rays really do meet there. It is upside down, and smaller than the object. The lens formula gives v as about sixteen point seven centimetres.",
  note: { title: "Lens formula", lines: ["u = −25 cm, f = +10 cm", "1/v = 1/10 − 1/25 = 3/50", "v = +16.7 cm, m = v/u = −0.67"], formula: "1/v − 1/u = 1/f" } },
 { set: { u: 15 }, focus: "image", say: "Slide the object closer, to fifteen centimetres, between F and two F. The image jumps beyond two F and grows bigger. It is still real and inverted. A film projector works this way.",
  note: { same: true, lines: ["u = −15: v = +30 cm, m = −2 (magnified)"] } },
 { set: { u: 6 }, focus: "image", say: "Now move the object inside the focus, to six centimetres. The rays no longer meet. The dashed lines trace them backwards, and they seem to meet on the same side as the object. The image is virtual, erect and magnified. This is exactly how a magnifying glass works.",
  note: { same: true, lines: ["u = −6: v = −15 cm, m = +2.5 (virtual, erect)"] } },
 { set: { lens: "concave", u: 20 }, focus: "image", say: "A concave lens behaves differently. It is thinner in the middle and spreads rays out. Wherever the object is, the image is virtual, erect and smaller. Concave lenses are used in spectacles for short-sightedness.",
  note: { title: "Concave lens", lines: ["Always virtual, erect, diminished", "Used to correct myopia"] } },
 { focus: null, say: "Last, the sign convention. Measure distances from the optical centre. u is always negative for a real object. And f is positive for a convex lens, negative for a concave lens. The power of a lens is one over f in metres, measured in dioptres.",
  note: { title: "Sign convention", lines: ["u is negative for a real object", "f > 0 convex, f < 0 concave", "Power in dioptre (D), f in metres"], formula: "P = 1/f" } },
 ],
 quiz: [
  { q: "An object is placed at 2F of a convex lens. The image formed is…", options: ["at F, small and real", "at 2F, same size, real and inverted", "at infinity", "virtual and erect"], answer: 1, why: "At 2F the image forms at 2F on the other side, same size, real and inverted." },
  { q: "What is the power of a lens of focal length +25 cm?", options: ["0.25 D", "2.5 D", "4 D", "25 D"], answer: 2, why: "P = 1/f = 1/0.25 m = 4 D." },
  { q: "A lens always forms a virtual, erect and diminished image. It must be…", options: ["a convex lens", "a concave lens", "a plane mirror", "a prism"], answer: 1, why: "Only a concave lens always gives such an image." },
 ] },
{ id: "seasons", model: "seasons", subject: "Social Science", title: "Why do we have seasons?", blurb: "Tilt, orbit and the date: it is not about distance.", chapter: "Motions of the Earth", classes: [6, 7, 8],
 steps: [
 { model: "seasons", set: { day: 172, run: 0 }, view: "default", focus: "orbit", say: "Here is a question. Is it hotter in summer because the Earth is closer to the Sun? Surprisingly, no. In fact, Earth is closest to the Sun in early January, in the middle of the Indian winter. So distance is not the reason.",
  note: { title: "A common mistake", lines: ["Seasons are NOT caused by distance", "Earth is nearest the Sun in early January"] } },
 { focus: "axis", say: "The real reason is tilt. Earth’s axis is tilted by twenty three and a half degrees, and it keeps pointing in the same direction, towards the Pole Star, all the way around the Sun.",
  note: { title: "The real reason", lines: ["Axis tilted by 23.5°", "The tilt direction stays fixed all year"], formula: "tilt = 23.5°" } },
 { set: { day: 172 }, view: "earth", focus: "earth", say: "This is the twenty first of June. The northern half of Earth is tilted towards the Sun, so sunlight falls more directly and the days are longer. For central India that means summer.",
  note: { title: "21 June: summer solstice", lines: ["Northern half tilted towards the Sun", "Rays fall more directly, so more heat", "Longest day in the north"] } },
 { set: { day: 265 }, focus: "earth", say: "Three months later, on the twenty second of September, Earth is a quarter of the way round, but its axis still points the same way. Now neither half is tilted towards the Sun, so day and night are equal everywhere. This is an equinox.",
  note: { title: "22 Sep: equinox", lines: ["Neither half tilted to the Sun", "Day and night about 12 hours each"] } },
 { set: { day: 355 }, focus: "earth", say: "By the twenty first of December, the northern half is tilted away from the Sun. The rays are slanted and spread out, and the days are short. That is winter in the north. Meanwhile it is summer in the southern half.",
  note: { title: "21 Dec: winter solstice", lines: ["Northern half tilted away", "Slanting rays, short days", "Summer in the south"] } },
 { set: { day: 79 }, focus: "earth", say: "And in March we reach the other equinox. Day and night are equal again, and spring begins in the north.", note: { same: true, lines: ["20 Mar: equinox again"] } },
 { set: { day: 172 }, view: "earth", focus: "tropics", say: "One more special line. The Tropic of Cancer, at twenty three and a half degrees north, passes through the middle of India. On the twenty first of June, the noon Sun is exactly overhead on this line.",
  note: { title: "Tropic of Cancer", lines: ["23.5° N latitude", "Passes through India", "Sun overhead at noon on 21 June"] } },
 { set: { run: 1 }, view: "top", focus: null, say: "Let me run the whole year. Watch the date, and watch how the tilted Earth keeps its axis fixed while it moves. The part facing the Sun keeps changing. That is what gives us seasons.",
  note: { title: "Rotation and revolution", lines: ["Rotation (24 h): day and night", "Revolution (365¼ days): the year", "Tilt + revolution: seasons"] } },
 ],
 quiz: [
  { q: "What is the main cause of seasons on Earth?", options: ["Earth’s changing distance from the Sun", "The tilt of Earth’s axis", "Earth’s rotation", "The Moon’s gravity"], answer: 1, why: "The tilt of 23.5°, together with Earth’s revolution, changes how directly sunlight falls." },
  { q: "On 21 June, the noon Sun is directly overhead on…", options: ["The Equator", "Tropic of Capricorn", "Tropic of Cancer", "Arctic Circle"], answer: 2, why: "On 21 June the northern half is tilted towards the Sun, so the overhead Sun is at 23.5° N." },
  { q: "On an equinox, day and night are…", options: ["longest in the north", "longest in the south", "equal everywhere", "always 10 and 14 hours"], answer: 2, why: "On an equinox neither half is tilted towards the Sun." },
 ] },
{ id: "quad", model: "graph", subject: "Maths", title: "Quadratic equations by factorising", blurb: "Solve x² − 5x + 6 = 0 line by line, and see the roots on the graph.", chapter: "Quadratic Equations", classes: [9, 10],
 steps: [
 { model: "graph", set: { a: 1, b: -5, c: 6 }, view: "default", focus: null, say: "Let us solve a quadratic equation together. A quadratic is an equation where the highest power of x is two. Our example is x squared minus five x plus six equals zero.",
  note: { title: "Our equation", lines: ["Standard form: ax² + bx + c = 0", "Here a = 1, b = −5, c = 6"], formula: "x² − 5x + 6 = 0" } },
 { focus: "yint", say: "The trick is to split the middle term. I need two numbers that multiply to c times a, which is six, and add up to b, which is minus five.",
  note: { title: "Find two numbers", lines: ["Product = 6", "Sum = −5"], visual: { type: "table", head: ["Pair", "Product", "Sum"], rows: [["−1, −6", "6", "−7"], ["−2, −3", "6", "−5 ✓"], ["1, 6", "6", "7"]], caption: "Only −2 and −3 work" } } },
 { focus: null, say: "So I rewrite minus five x as minus two x minus three x. Nothing changes in value, but now we can group.",
  note: { title: "Split the middle term", lines: ["x² − 2x − 3x + 6 = 0", "x(x − 2) − 3(x − 2) = 0"], formula: "(x − 2)(x − 3) = 0" } },
 { view: "roots", focus: "roots", say: "If two numbers multiply to zero, at least one of them must be zero. So either x minus two is zero, or x minus three is zero. On the graph, these are exactly where the curve crosses the x-axis.",
  note: { title: "Zero product rule", lines: ["x − 2 = 0  ⇒  x = 2", "x − 3 = 0  ⇒  x = 3"], formula: "x = 2 or x = 3" } },
 { focus: "roots", say: "Always check. Put x equals two: four minus ten plus six is zero. Good. Put x equals three: nine minus fifteen plus six is zero. Also good.", note: { title: "Check", lines: ["x = 2: 4 − 10 + 6 = 0 ✓", "x = 3: 9 − 15 + 6 = 0 ✓"] } },
 { set: { a: 0 }, view: "default", focus: "curve", say: "Two quick tips. A quadratic can have two roots, so always write both. And a can never be zero. Watch what happens when I move a to zero: the curve straightens into a line, so it is no longer a quadratic.",
  note: { title: "Exam tips", lines: ["Two roots, so write both", "Product positive and sum negative: both numbers are negative", "Not factorising nicely? Use x = (−b ± √(b² − 4ac)) / 2a"] } },
 ],
 quiz: [
  { q: "Factorise x² − 7x + 12 = 0. What are the roots?", options: ["3 and 4", "−3 and −4", "2 and 6", "1 and 12"], answer: 0, why: "Numbers with product 12 and sum −7 are −3 and −4, so (x − 3)(x − 4) = 0 and x = 3 or 4." },
  { q: "In ax² + bx + c = 0, which value of a is NOT allowed?", options: ["1", "0", "−1", "2"], answer: 1, why: "If a = 0 the x² term vanishes and the equation is no longer quadratic." },
  { q: "What are the roots of x² − 9 = 0?", options: ["3 only", "−3 only", "3 and −3", "9 and −9"], answer: 2, why: "x² − 9 = (x − 3)(x + 3), so x = 3 or x = −3." },
 ] },
{ id: "binary", model: "binary", subject: "Computer Science", title: "Binary numbers: how computers count", blurb: "Place values, converting 13 to binary, and how letters become numbers.", chapter: "Number Systems: Binary", classes: [6, 7, 8, 9],
 steps: [
 { model: "binary", set: { bits: 8, value: 0 }, view: "default", focus: "bits", say: "Computers only understand two states, on and off. We write them as one and zero. So a computer counts in base two, which we call binary. Each digit is called a bit.",
  note: { title: "Why binary?", lines: ["Switch ON = 1, OFF = 0", "One digit = 1 bit", "8 bits = 1 byte"] } },
 { set: { value: 31 }, focus: null, say: "In our normal decimal system, each place is ten times the one before. In binary, each place is two times the one before. From the right the places are one, two, four, eight, sixteen.",
  note: { title: "Place values", lines: ["Decimal places: 1, 10, 100, 1000", "Binary places: 1, 2, 4, 8, 16, 32 …"], visual: { type: "table", head: ["16", "8", "4", "2", "1"], rows: [["2⁴", "2³", "2²", "2¹", "2⁰"]], caption: "Each place is double the one on its right" } } },
 { set: { bits: 4, value: 13 }, focus: null, say: "Let us read one. Take the binary number one one zero one. We add the place values wherever there is a one: eight plus four plus one makes thirteen.",
  note: { title: "Binary → decimal", lines: ["1101₂ has 1 at 8, 1 at 4, 0 at 2, 1 at 1", "8 + 4 + 0 + 1 = 13"], formula: "1101₂ = 13" } },
 { focus: "lsb", say: "Now the other way. To convert thirteen to binary, keep dividing by two and write down the remainders. Then read the remainders from bottom to top.",
  note: { title: "Decimal → binary", lines: ["13 ÷ 2 = 6 remainder 1", "6 ÷ 2 = 3 remainder 0", "3 ÷ 2 = 1 remainder 1", "1 ÷ 2 = 0 remainder 1", "Read upwards: 1101"] } },
 { set: { bits: 8, value: 65 }, focus: "bits", say: "How do letters work? Every character gets a number code. In the ASCII code, capital A is sixty five, which in binary is zero one zero zero zero zero zero one.",
  note: { title: "Letters are numbers", lines: ["A = 65 = 01000001₂", "B = 66 = 01000010₂", "a = 97 = 01100001₂"] } },
 { set: { value: 255 }, focus: "msb", say: "A common exam mistake is reading the remainders from top to bottom. Always read them from the bottom up. Also, eight bits can store two to the power eight, that is two hundred fifty six, different values.",
  note: { title: "Exam tips", lines: ["Remainders: read bottom to top", "n bits give 2ⁿ values", "8 bits: 0 to 255"] } },
 ],
 quiz: [
  { q: "What is 101₂ in decimal?", options: ["3", "4", "5", "6"], answer: 2, why: "4 + 0 + 1 = 5." },
  { q: "What is 10 in binary?", options: ["1001", "1010", "1100", "1110"], answer: 1, why: "8 + 2 = 10, so 1010." },
  { q: "How many different values can 8 bits store?", options: ["8", "64", "128", "256"], answer: 3, why: "2⁸ = 256 values, from 0 to 255." },
 ] },
{ id: "pyfor", model: "loop", subject: "Computer Science", title: "Python for loops: repeat without typing twice", blurb: "See code line by line, with the important lines highlighted.", chapter: "Python: Loops", classes: [8, 9, 10],
 steps: [
 { model: "loop", set: { start: 0, stop: 5, step: 1, run: 0 }, view: "default", focus: null, say: "Suppose you want to print Hello five times. You could write the print line five times, but programmers are lazy in a smart way. We use a loop, which repeats instructions for us.",
  note: { title: "The problem", lines: ["Print \"Hello\" five times", "Copy-pasting is slow and error-prone", "A loop repeats code for us"] } },
 { set: { run: 1 }, focus: "pointer", say: "Here is a for loop. The words range of five give the numbers zero, one, two, three, four. Python runs the indented line once for each number.",
  note: { title: "A for loop", lines: ["range(5) → 0, 1, 2, 3, 4"], code: ["for i in range(5):", "    print(\"Hello\", i)"], mark: [1] } },
 { focus: null, say: "Notice the colon at the end of the first line, and the four spaces before print. In Python, indentation shows which lines belong inside the loop.",
  note: { title: "Syntax rules", lines: ["Colon : after the for line", "Indent the loop body by 4 spaces"] } },
 { focus: "first", say: "Here is the output. Hello zero, Hello one, up to Hello four. Counting starts from zero, and range of five stops before five.",
  note: { title: "Output", code: ["Hello 0", "Hello 1", "Hello 2", "Hello 3", "Hello 4"] } },
 { set: { start: 2, stop: 10, step: 2, run: 0 }, focus: "stop", say: "You can choose where to start and the step size. Range of two comma ten comma two starts at two, goes up to but not including ten, in steps of two. A running total is a very common use.",
  note: { title: "start, stop, step", lines: ["range(start, stop, step)"], code: ["total = 0", "for n in range(2, 10, 2):", "    total = total + n", "print(total)"], mark: [2, 3] } },
 { set: { run: 1 }, focus: "track", say: "That prints twenty, because two plus four plus six plus eight is twenty. A common mistake is forgetting the colon or the indentation, which gives a syntax error. And remember, the stop value is never included.",
  note: { title: "Exam tips", lines: ["Output above: 20", "Forgot the colon? SyntaxError", "Stop value is not included"] } },
 ],
 quiz: [
  { q: "What does list(range(3)) give?", options: ["[1, 2, 3]", "[0, 1, 2]", "[0, 1, 2, 3]", "[1, 2]"], answer: 1, why: "range(3) starts at 0 and stops before 3." },
  { q: "What does range(2, 5) produce?", options: ["2, 3, 4", "2, 3, 4, 5", "3, 4, 5", "2, 5"], answer: 0, why: "It starts at 2 and stops before 5." },
  { q: "How does Python know which lines are inside a loop?", options: ["Brackets", "Semicolons", "Indentation", "Capital letters"], answer: 2, why: "Python uses indentation, not brackets, to group lines." },
 ] },
{ id: "voice", model: "voice", subject: "English", title: "Active and passive voice", blurb: "Who does the action? Rules, examples and a rewrite.", chapter: "Grammar: Voice", classes: [7, 8, 9, 10],
 steps: [
 { model: "voice", set: { sentence: "letter", voice: 0 }, view: "default", focus: "doer", say: "In English, voice tells us who is the star of the sentence. In active voice, the doer of the action comes first. In passive voice, the receiver of the action comes first.",
  note: { title: "Two voices", lines: ["Active: Riya wrote the letter.", "Passive: The letter was written by Riya."], visual: { type: "flow", boxes: ["Doer", "Verb", "Receiver"], caption: "Active order. The passive flips it." } } },
 { set: { voice: 1 }, focus: "arrow", say: "To change active to passive, follow three steps. Move the object to the front as the new subject. Use the right form of the verb to be with the past participle. Then add by and the old subject, if needed.",
  note: { title: "Three steps", lines: ["1. Object becomes subject", "2. is / am / are / was / were / been + past participle (V3)", "3. by + old subject (optional)"] } },
 { focus: "action", say: "The form of the verb to be depends on the tense. For present simple use is, am or are. For past simple use was or were. For future use will be.",
  note: { title: "Tense table", lines: ["Present simple: is/are + V3", "Past simple: was/were + V3", "Future simple: will be + V3", "Present perfect: has/have been + V3"] } },
 { set: { sentence: "food", voice: 1 }, focus: null, say: "Let us try one. The cook prepares food. Object is food, tense is present simple. So we get: Food is prepared by the cook. Now a past one: The boys broke the window becomes The window was broken by the boys.",
  note: { title: "Worked examples", lines: ["The cook prepares food.", "→ Food is prepared by the cook.", "The boys broke the window.", "→ The window was broken by the boys."] } },
 { focus: "receiver", say: "When do we use passive? When the doer is unknown or unimportant, like My bicycle was stolen. A common mistake is using the wrong participle, saying was broke instead of was broken.",
  note: { title: "When and mistakes", lines: ["Use when the doer is unknown: My bike was stolen.", "Always use V3: was broken, not was broke", "Only sentences with an object can become passive"] } },
 ],
 quiz: [
  { q: "Passive form of \"She sings a song\"?", options: ["A song is sung by her.", "A song was sung by her.", "A song sings her.", "A song is sing by her."], answer: 0, why: "Present simple becomes is + V3: is sung." },
  { q: "Which is passive?", options: ["Dogs chase cats.", "The match was won by India.", "He is running.", "We will play."], answer: 1, why: "The subject (the match) receives the action." },
  { q: "Passive of \"They have finished the work\"?", options: ["The work was finished.", "The work has been finished.", "The work is finished by them.", "The work have been finished."], answer: 1, why: "Present perfect becomes has/have been + V3." },
 ] },
];

export const LESSON_BY_ID: Record<string, Lesson> = Object.fromEntries(LESSONS.map((l) => [l.id, l]));

/**
 * NCERT chapter names (current books, any class) that have a narrated 3D lesson. Matched after removing
 * "5. " numbering and "Part 1 · " prefixes. A lesson is offered only to the classes it was written for.
 */
const CHAPTER_LESSON: Record<string, string> = {
  "measuring space: perimeter and area": "mensuration", "area": "mensuration", "surface areas and volumes": "mensuration",
  "the baudhayana-pythagoras theorem": "pythag", "triangles": "pythag",
  "journey inside the atom": "atom", "structure of the atom": "atom", "atomic foundations of matter": "molecule", "particulate nature of matter": "atom",
  "cell: the building block of life": "cell", "the fundamental unit of life": "cell", "cell — structure and functions": "cell",
  "carbon and its compounds": "molecule", "nature of matter: elements, compounds, and mixtures": "molecule",
  "light: reflection and refraction": "lens", "light: mirrors and lenses": "lens",
  "earth, moon, and the sun": "seasons", "beyond earth": "seasons", "keeping time with the skies": "seasons", "motions of the earth": "seasons",
  "quadratic equations": "quad", "a square and a cube": "solids", "visualising solid shapes": "solids", "exploring some geometrical themes": "solids",
};
export const chapterKey = (name: string) => name.replace(/^\s*(?:part\s*\d+\s*·\s*)?(?:chapter\s*)?\d+\s*[.:)\-–]\s*/i, "").trim().toLowerCase();

/** The narrated 3D lesson for a chapter of a class at this level, if there is one. */
export function lessonForChapter(chapterName: string, grade: string | null): Lesson | null {
  const id = CHAPTER_LESSON[chapterKey(chapterName)];
  const lesson = id ? LESSON_BY_ID[id] : null;
  if (!lesson) return null;
  const g = Number(grade);
  return !grade || !Number.isFinite(g) || lesson.classes.includes(g) ? lesson : null;
}

/**
 * Words that point to each lesson: [strong, weak]. A strong word names the lesson's idea on its own
 * ("hypotenuse"); a weak one only helps ("volume", "nucleus" fits both the atom and the cell).
 * Matched as whole words or phrases, plural "s" allowed.
 */
const LESSON_WORDS: Record<string, [string[], string[]]> = {
  mensuration: [["cone", "sphere", "cylinder", "hemisphere", "frustum", "recast", "recasting"], ["volume", "surface area", "melted", "curved surface", "radius"]],
  pythag: [["pythagoras", "pythagorean", "hypotenuse", "baudhayana"], ["right angled", "right angle", "right triangle", "triangle"]],
  solids: [["euler", "polyhedron", "polyhedra"], ["vertex", "vertices", "edge", "face", "prism", "pyramid", "cube", "cuboid", "solid shape"]],
  atom: [["atom", "atomic", "electron", "proton", "neutron", "bohr", "valency", "electronic configuration", "atomic number"], ["nucleus", "shell", "orbit", "element"]],
  cell: [["organelle", "mitochondria", "mitochondrion", "chloroplast", "cytoplasm", "cell membrane", "cell wall", "vacuole", "ribosome", "plant cell", "animal cell", "golgi"], ["cell", "nucleus", "membrane", "tissue"]],
  molecule: [["covalent", "lone pair", "bond angle", "methane", "valence electron"], ["molecule", "bond", "carbon compound", "shared electron"]],
  lens: [["lens", "lenses", "convex", "concave", "focal length", "ray diagram", "refraction", "magnification"], ["image", "focus", "mirror", "light ray"]],
  seasons: [["season", "solstice", "equinox", "axial tilt"], ["tilt", "revolution", "summer", "winter", "hemisphere"]],
  quad: [["quadratic", "parabola", "factorise", "factorize", "factorising", "factorizing", "discriminant"], ["root", "equation", "factor"]],
  binary: [["binary", "base 2", "ascii", "bit", "byte"], ["place value", "decimal", "computer count"]],
  pyfor: [["for loop", "python"], ["loop", "range", "iteration", "repeat"]],
  voice: [["passive voice", "active voice", "passive"], ["voice", "active", "grammar"]],
};

/** For each lesson, how many of its strong and weak words a piece of text contains. */
function lessonHits(text: string) {
  const t = ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
  const has = (w: string) => t.includes(` ${w} `) || t.includes(` ${w}s `) || t.includes(` ${w}es `);
  return Object.fromEntries(Object.entries(LESSON_WORDS).map(([id, [strong, weak]]) => [id, { strong: strong.filter(has).length, weak: weak.filter(has).length }]));
}

/**
 * The narrated 3D lesson that fits a question and its explanation, if one clearly does. A strong word
 * scores 2 and a weak one 1; the question counts twice as much as the explanation. The winner needs a
 * strong word, a score of at least 4 and a clear lead. Offered only for the class level it was written
 * for (any level if `grade` isn't set).
 */
export function lessonForText(question: string, explanation: string, grade: string | null): Lesson | null {
  const q = lessonHits(question), a = lessonHits(explanation);
  const ranked = Object.keys(LESSON_WORDS).map((id) => ({
    id, strong: q[id].strong + a[id].strong,
    score: (q[id].strong * 2 + q[id].weak) * 2 + a[id].strong * 2 + a[id].weak,
  })).sort((x, y) => y.score - x.score);
  const [best, next] = ranked;
  if (!best.strong || best.score < 4 || best.score === next.score) return null;
  const lesson = LESSON_BY_ID[best.id];
  const g = Number(grade);
  return !grade || !Number.isFinite(g) || lesson.classes.includes(g) ? lesson : null;
}

/** Lessons offered to a class level (all of them if the level isn't set). */
export function lessonsForGrade(grade: string | null) {
  const g = Number(grade);
  return LESSONS.filter((l) => !grade || !Number.isFinite(g) || l.classes.includes(g));
}
