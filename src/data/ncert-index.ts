/**
 * NCERT chapter index for CBSE Classes 3–10 (English medium).
 *
 * Source: the "Contents" page of each book's front-matter PDF on ncert.nic.in
 * (https://ncert.nic.in/textbook/pdf/<code>ps.pdf), retrieved 2026-11-04. Book codes are the
 * ones NCERT's textbook page currently serves for each class and subject. Edition = the reprint
 * printed on the Contents page ("Reprint 2026-27"), or "2026 edition" where none is printed.
 *
 * Classes 3–5 (added 2026-11-05): Maths Mela, Santoor and Our Wondrous World ("The World Around Us",
 * which replaced EVS); "Picture Reading" / "Self Assessment" activity pages are not chapters.
 * Chapter names are copied as printed. Where a subject has several books or parts, the book/part is
 * prefixed so chapters stay unambiguous. Hindi and Sanskrit are not included: their PDFs don't contain
 * a machine-readable Contents page, and chapter names must not be guessed. Teachers add those manually.
 */
export type IndexBook = { code: string; title: string; edition: string };
export type IndexSubject = { books: IndexBook[]; chapters: string[] };

const R = "Reprint 2026-27";
const N = "2026 edition";

export const NCERT_INDEX: Record<string, Record<string, IndexSubject>> = {
  "3": {
    Mathematics: {
      books: [{ code: "cemm1", title: "Maths Mela", edition: R }],
      chapters: [
        "1. What's in a Name?", "2. Toy Joy", "3. Double Century", "4. Vacation with My Nani Maa", "5. Fun with Shapes",
        "6. House of Hundreds – I", "7. Raksha Bandhan", "8. Fair Share", "9. House of Hundreds – II", "10. Fun at Class Party!",
        "11. Filling and Lifting", "12. Give and Take", "13. Time Goes On", "14. The Surajkund Fair",
      ],
    },
    English: {
      books: [{ code: "cesa1", title: "Santoor", edition: R }],
      chapters: [
        "Unit 1 · 1. Colours", "Unit 1 · 2. Badal and Moti", "Unit 1 · 3. Best Friends",
        "Unit 2 · 4. Out in the Garden", "Unit 2 · 5. Talking Toys", "Unit 2 · 6. Paper Boats",
        "Unit 3 · 7. The Big Laddoo", "Unit 3 · 8. Thank God", "Unit 3 · 9. Madhu's Wish",
        "Unit 4 · 10. Night", "Unit 4 · 11. Chanda Mama Counts the Stars", "Unit 4 · 12. Chandrayaan",
      ],
    },
    "The World Around Us": {
      books: [{ code: "ceev1", title: "Our Wondrous World", edition: R }],
      chapters: [
        "Unit 1 · 1. Family and Friends", "Unit 1 · 2. Going to the Mela", "Unit 1 · 3. Celebrating Festivals",
        "Unit 2 · 4. Getting to Know Plants", "Unit 2 · 5. Plants and Animals Live Together", "Unit 2 · 6. Living in Harmony",
        "Unit 3 · 7. Water— A Precious Gift", "Unit 3 · 8. Food We Eat", "Unit 3 · 9. Staying Healthy and Happy",
        "Unit 4 · 10. This World of Things", "Unit 4 · 11. Making Things", "Unit 4 · 12. Taking Charge of Waste",
      ],
    },
  },
  "4": {
    Mathematics: {
      books: [{ code: "demm1", title: "Maths Mela", edition: R }],
      chapters: [
        "1. Shapes Around Us", "2. Hide and Seek", "3. Pattern Around Us", "4. Thousands Around Us", "5. Sharing and Measuring",
        "6. Measuring Length", "7. The Cleanest Village", "8. Weigh it, Pour it", "9. Equal Groups",
        "10. Elephants, Tigers, and Leopards", "11. Fun with Symmetry", "12. Ticking Clocks and Turning Calendar",
        "13. The Transport Museum", "14. Data Handling",
      ],
    },
    English: {
      books: [{ code: "desa1", title: "Santoor", edition: R }],
      chapters: [
        "Unit 1 · 1. Together We Can", "Unit 1 · 2. The Tinkling Bells", "Unit 1 · 3. Be Smart, Be Safe",
        "Unit 2 · 4. One Thing at a Time", "Unit 2 · 5. The Old Stag", "Unit 2 · 6. Braille",
        "Unit 3 · 7. Fit Body, Fit Mind, Fit Nation", "Unit 3 · 8. The Lagori Champions", "Unit 3 · 9. Hekko",
        "Unit 4 · 10. The Swing", "Unit 4 · 11. A Journey to the Magical Mountains", "Unit 4 · 12. Maheshwar",
      ],
    },
    "The World Around Us": {
      books: [{ code: "deev1", title: "Our Wondrous World", edition: R }],
      chapters: [
        "Unit 1 · 1. Living Together", "Unit 1 · 2. Exploring Our Neighbourhood",
        "Unit 2 · 3. Nature Trail", "Unit 2 · 4. Growing up with Nature",
        "Unit 3 · 5. Food for Health", "Unit 3 · 6. Happy and Healthy Living",
        "Unit 4 · 7. How Things Work", "Unit 4 · 8. How Things are Made",
        "Unit 5 · 9. Different Lands, Different Lives", "Unit 5 · 10. Our Sky",
      ],
    },
  },
  "5": {
    Mathematics: {
      books: [{ code: "eemm1", title: "Maths Mela", edition: R }],
      chapters: [
        "1. We the Travellers — I", "2. Fractions", "3. Angles as Turns", "4. We the Travellers — II", "5. Far and Near",
        "6. The Dairy Farm", "7. Shapes and Patterns", "8. Weight and Capacity", "9. Coconut Farm", "10. Symmetrical Designs",
        "11. Grandmother's Quilt", "12. Racing Seconds", "13. Animal Jumps", "14. Maps and Locations", "15. Data Through Pictures",
      ],
    },
    English: {
      books: [{ code: "eesa1", title: "Santoor", edition: R }],
      chapters: [
        "Unit 1 · 1. Papa's Spectacles", "Unit 1 · 2. Gone with the Scooter",
        "Unit 2 · 3. The Rainbow", "Unit 2 · 4. The Wise Parrot",
        "Unit 3 · 5. The Frog", "Unit 3 · 6. What a Tank!",
        "Unit 4 · 7. Gilli Danda", "Unit 4 · 8. The Decision of the Panchayat",
        "Unit 5 · 9. Vocation", "Unit 5 · 10. Glass Bangles",
      ],
    },
    "The World Around Us": {
      books: [{ code: "eeev1", title: "Our Wondrous World", edition: R }],
      chapters: [
        "Unit 1 · 1. Water — The Essence of Life", "Unit 1 · 2. Journey of a River",
        "Unit 2 · 3. The Mystery of Food", "Unit 2 · 4. Our School — A Happy Place",
        "Unit 3 · 5. Our Vibrant Country", "Unit 3 · 6. Some Unique Places",
        "Unit 4 · 7. Energy — How Things Work", "Unit 4 · 8. Clothes — How Things are Made",
        "Unit 5 · 9. Rhythms of Nature", "Unit 5 · 10. Earth — Our Shared Home",
      ],
    },
  },
  "6": {
    Science: {
      books: [{ code: "fecu1", title: "Curiosity", edition: R }],
      chapters: [
        "1. The Wonderful World of Science", "2. Diversity in the Living World", "3. Mindful Eating: A Path to a Healthy Body",
        "4. Exploring Magnets", "5. Measurement of Length and Motion", "6. Materials Around Us", "7. Temperature and its Measurement",
        "8. A Journey through States of Water", "9. Methods of Separation in Everyday Life",
        "10. Living Creatures: Exploring their Characteristics", "11. Nature's Treasures", "12. Beyond Earth",
      ],
    },
    Mathematics: {
      books: [{ code: "fegp1", title: "Ganita Prakash", edition: R }],
      chapters: [
        "1. Patterns in Mathematics", "2. Lines and Angles", "3. Number Play", "4. Data Handling and Presentation", "5. Prime Time",
        "6. Perimeter and Area", "7. Fractions", "8. Playing with Constructions", "9. Symmetry", "10. The Other Side of Zero",
      ],
    },
    "Social Science": {
      books: [{ code: "fees1", title: "Exploring Society: India and Beyond", edition: N }],
      chapters: [
        "1. Locating Places on the Earth", "2. Oceans and Continents", "3. Landforms and Life", "4. Timeline and Sources of History",
        "5. India, That Is Bharat", "6. The Beginnings of Indian Civilisation", "7. India's Cultural Roots",
        "8. Unity in Diversity, or 'Many in the One'", "9. Family and Community", "10. Grassroots Democracy — Part 1: Governance",
        "11. Grassroots Democracy — Part 2: Local Government in Rural Areas",
        "12. Grassroots Democracy — Part 3: Local Government in Urban Areas", "13. The Value of Work", "14. Economic Activities Around Us",
      ],
    },
    English: {
      books: [{ code: "fepr1", title: "Poorvi", edition: R }],
      chapters: [
        "Unit 1 · A Bottle of Dew", "Unit 1 · The Raven and the Fox", "Unit 1 · Rama to the Rescue",
        "Unit 2 · The Unlikely Best Friends", "Unit 2 · A Friend's Prayer", "Unit 2 · The Chair",
        "Unit 3 · Neem Baba", "Unit 3 · What a Bird Thought", "Unit 3 · Spices that Heal Us",
        "Unit 4 · Change of Heart", "Unit 4 · The Winner", "Unit 4 · Yoga—A Way of Life",
        "Unit 5 · Hamara Bharat—Incredible India!", "Unit 5 · The Kites", "Unit 5 · Ila Sachani: Embroidering Dreams with her Feet",
        "Unit 5 · National War Memorial",
      ],
    },
  },
  "7": {
    Science: {
      books: [{ code: "gecu1", title: "Curiosity", edition: R }],
      chapters: [
        "1. The Ever-Evolving World of Science", "2. Exploring Substances: Acidic, Basic, and Neutral",
        "3. Electricity: Circuits and their Components", "4. The World of Metals and Non-metals",
        "5. Changes Around Us: Physical and Chemical", "6. Adolescence: A Stage of Growth and Change", "7. Heat Transfer in Nature",
        "8. Measurement of Time and Motion", "9. Life Processes in Animals", "10. Life Processes in Plants",
        "11. Light: Shadows and Reflections", "12. Earth, Moon, and the Sun",
      ],
    },
    Mathematics: {
      books: [{ code: "gegp1", title: "Ganita Prakash", edition: R }, { code: "gegp2", title: "Ganita Prakash Part II", edition: N }],
      chapters: [
        "Part 1 · 1. Large Numbers Around Us", "Part 1 · 2. Arithmetic Expressions", "Part 1 · 3. A Peek Beyond the Point",
        "Part 1 · 4. Expressions using Letter-Numbers", "Part 1 · 5. Parallel and Intersecting Lines", "Part 1 · 6. Number Play",
        "Part 1 · 7. A Tale of Three Intersecting Lines", "Part 1 · 8. Working with Fractions",
        "Part 2 · 1. Geometric Twins", "Part 2 · 2. Operations with Integers", "Part 2 · 3. Finding Common Ground",
        "Part 2 · 4. Another Peek Beyond the Point", "Part 2 · 5. Connecting the Dots", "Part 2 · 6. Constructions and Tilings",
        "Part 2 · 7. Finding the Unknown",
      ],
    },
    "Social Science": {
      books: [{ code: "gees1", title: "Exploring Society: India and Beyond Part I", edition: R }, { code: "gees2", title: "Exploring Society: India and Beyond Part II", edition: R }],
      chapters: [
        "Part 1 · 1. Geographical Diversity of India", "Part 1 · 2. Understanding the Weather", "Part 1 · 3. Climates of India",
        "Part 1 · 4. New Beginnings: Cities and States", "Part 1 · 5. The Rise of Empires", "Part 1 · 6. The Age of Reorganisation",
        "Part 1 · 7. The Gupta Era: An Age of Tireless Creativity", "Part 1 · 8. How the Land Becomes Sacred",
        "Part 1 · 9. From the Rulers to the Ruled: Types of Governments", "Part 1 · 10. The Constitution of India — An Introduction",
        "Part 1 · 11. From Barter to Money", "Part 1 · 12. Understanding Markets",
        "Part 2 · 1. The Story of Indian Farming", "Part 2 · 2. India and Her Neighbours",
        "Part 2 · 3. Empires and Kingdoms: 6th to 10th Centuries", "Part 2 · 4. Turning Tides: 11th and 12th Centuries",
        "Part 2 · 5. India, a Home to Many", "Part 2 · 6. The State, the Government, and You",
        "Part 2 · 7. Infrastructure: Engine of India's Development", "Part 2 · 8. Banks and the Magic of Finance",
      ],
    },
    English: {
      books: [{ code: "gepr1", title: "Poorvi", edition: R }],
      chapters: [
        "Unit 1 · The Day the River Spoke", "Unit 1 · Try Again", "Unit 1 · Three Days to See",
        "Unit 2 · Animals, Birds, and Dr. Dolittle", "Unit 2 · A Funny Man", "Unit 2 · Say the Right Thing",
        "Unit 3 · My Brother's Great Invention", "Unit 3 · Paper Boats", "Unit 3 · North, South, East, West",
        "Unit 4 · The Tunnel", "Unit 4 · Travel", "Unit 4 · Conquering the Summit",
        "Unit 5 · A Homage to Our Brave Soldiers", "Unit 5 · My Dear Soldiers", "Unit 5 · Rani Abbakka",
      ],
    },
  },
  "8": {
    Science: {
      books: [{ code: "hecu1", title: "Curiosity", edition: R }],
      chapters: [
        "1. Exploring the Investigative World of Science", "2. The Invisible Living World: Beyond Our Naked Eye",
        "3. Health: The Ultimate Treasure", "4. Electricity: Magnetic and Heating Effects", "5. Exploring Forces",
        "6. Pressure, Winds, Storms, and Cyclones", "7. Particulate Nature of Matter",
        "8. Nature of Matter: Elements, Compounds, and Mixtures", "9. The Amazing World of Solutes, Solvents, and Solutions",
        "10. Light: Mirrors and Lenses", "11. Keeping Time with the Skies", "12. How Nature Works in Harmony",
        "13. Our Home: Earth, a Unique Life Sustaining Planet",
      ],
    },
    Mathematics: {
      books: [{ code: "hegp1", title: "Ganita Prakash Part I", edition: R }, { code: "hegp2", title: "Ganita Prakash Part II", edition: N }],
      chapters: [
        "Part 1 · 1. A Square and A Cube", "Part 1 · 2. Power Play", "Part 1 · 3. A Story of Numbers", "Part 1 · 4. Quadrilaterals",
        "Part 1 · 5. Number Play", "Part 1 · 6. We Distribute, Yet Things Multiply", "Part 1 · 7. Proportional Reasoning-1",
        "Part 2 · 1. Fractions in Disguise", "Part 2 · 2. The Baudhayana-Pythagoras Theorem", "Part 2 · 3. Proportional Reasoning-2",
        "Part 2 · 4. Exploring Some Geometric Themes", "Part 2 · 5. Tales by Dots and Lines", "Part 2 · 6. Algebra Play", "Part 2 · 7. Area",
      ],
    },
    "Social Science": {
      books: [{ code: "hees1", title: "Exploring Society: India and Beyond Part I", edition: R }, { code: "hees2", title: "Exploring Society: India and Beyond Part II", edition: N }],
      chapters: [
        "Part 1 · 1. Natural Resources and Their Use", "Part 1 · 2. Reshaping India's Political Map", "Part 1 · 3. The Rise of the Marathas",
        "Part 1 · 4. The Colonial Era in India", "Part 1 · 5. Universal Franchise and India's Electoral System",
        "Part 1 · 6. The Parliamentary System: Legislature and Executive", "Part 1 · 7. Factors of Production",
        "Part 2 · 1. World Geography: Some Glimpses", "Part 2 · 2. India's Long Road to Independence",
        "Part 2 · 3. A Journey Through Indian Architecture", "Part 2 · 4. The Role of the Judiciary in Our Society",
        "Part 2 · 5. Citizenship: Rights and Duties", "Part 2 · 6. Dynamics of Population", "Part 2 · 7. India's Urban Landscape",
        "Part 2 · 8. Cultural Currents: 13th to 17th Centuries",
      ],
    },
    English: {
      books: [{ code: "hepr1", title: "Poorvi", edition: R }],
      chapters: [
        "Unit 1 · The Wit that Won Hearts", "Unit 1 · A Concrete Example", "Unit 1 · Wisdom Paves the Way",
        "Unit 2 · A Tale of Valour: Major Somnath Sharma and the Battle of Badgam", "Unit 2 · Somebody's Mother",
        "Unit 2 · Verghese Kurien— I Too Had A Dream",
        "Unit 3 · The Case of the Fifth Word", "Unit 3 · The Magic Brush of Dreams", "Unit 3 · Spectacular Wonders",
        "Unit 4 · The Cherry Tree", "Unit 4 · Harvest Hymn", "Unit 4 · Waiting for the Rain",
        "Unit 5 · Feathered Friend", "Unit 5 · Magnifying Glass",
        "Unit 5 · Bibha Chowdhuri: The Beam of Light that Lit the Path for Women in Indian Science",
      ],
    },
  },
  "9": {
    Science: {
      books: [{ code: "iesc1", title: "Exploration", edition: N }],
      chapters: [
        "1. Exploration: Entering the World of Secondary Science", "2. Cell: The Building Block of Life", "3. Tissues in Action",
        "4. Describing Motion Around Us", "5. Exploring Mixtures and their Separation", "6. How Forces Affect Motion",
        "7. Work, Energy, and Simple Machines", "8. Journey Inside the Atom", "9. Atomic Foundations of Matter",
        "10. Sound Waves: Characteristics and Applications", "11. Reproduction: How Life Continues",
        "12. Patterns in Life: Diversity and Classification", "13. Earth as a System: Energy, Matter, and Life",
      ],
    },
    Mathematics: {
      books: [{ code: "iemh1", title: "Ganita Manjari", edition: N }, { code: "iemh2", title: "Ganita Manjari Part II", edition: N }],
      chapters: [
        "1. Orienting Yourself: The Use of Coordinates", "2. Introduction to Linear Polynomials", "3. The World of Numbers",
        "4. Exploring Algebraic Identities", "5. I'm Up and Down, and Round and Round", "6. Measuring Space: Perimeter and Area",
        "7. The Mathematics of Maybe: Introduction to Probability",
        "8. Predicting What Comes Next: Exploring Sequences and Progressions",
        "9. Propositions and their Converses", "10. How Quantities Combine: Understanding Data", "11. The World of Algorithms",
        "12. Quadrilaterals", "13. Two Variables, One Line", "14. Math of Space: Surface Area and Volume",
      ],
    },
    "Social Science": {
      books: [{ code: "iest1", title: "Understanding Society: India and Beyond Part I", edition: N }],
      chapters: [
        "1. Understanding Social Science", "Geography · 2. Shaping of the Earth's Surface", "Geography · 3. Atmosphere and Climate",
        "History · 4. Early Humans and Beginning of Civilisation", "History · 5. State and Society up to 1000 CE",
        "Political Science · 6. Democracy", "Political Science · 7. Elections",
        "Economics · 8. Building Blocks in Economics: The Problem of Choice", "Economics · 9. The Price Puzzle: What Drives the Market",
      ],
    },
    English: {
      books: [{ code: "iebe1", title: "Kaveri", edition: N }],
      chapters: [
        "Unit 1 · How I Taught My Grandmother to Read", "Unit 1 · Bharat Our Land",
        "Unit 2 · The Pot Maker", "Unit 2 · Gifts of Grace: Honouring Our Vocations",
        "Unit 3 · Winds of Change", "Unit 3 · Canvas of Soil",
        "Unit 4 · Vitamin-M", "Unit 4 · I Cannot Remember My Mother",
        "Unit 5 · The World of Limitless Possibilities", "Unit 5 · Nine Gold Medals",
        "Unit 6 · Twin Melodies", "Unit 6 · A Friend Found in Music",
        "Unit 7 · Carrier of Words", "Unit 7 · Words",
        "Unit 8 · Follow That Dream", "Unit 8 · Believe in Yourself",
      ],
    },
  },
  "10": {
    Science: {
      books: [{ code: "jesc1", title: "Science", edition: R }],
      chapters: [
        "1. Chemical Reactions and Equations", "2. Acids, Bases and Salts", "3. Metals and Non-metals", "4. Carbon and its Compounds",
        "5. Life Processes", "6. Control and Coordination", "7. How do Organisms Reproduce?", "8. Heredity",
        "9. Light – Reflection and Refraction", "10. The Human Eye and the Colourful World", "11. Electricity",
        "12. Magnetic Effects of Electric Current", "13. Our Environment",
      ],
    },
    Mathematics: {
      books: [{ code: "jemh1", title: "Mathematics", edition: R }],
      chapters: [
        "1. Real Numbers", "2. Polynomials", "3. Pair of Linear Equations in Two Variables", "4. Quadratic Equations",
        "5. Arithmetic Progressions", "6. Triangles", "7. Coordinate Geometry", "8. Introduction to Trigonometry",
        "9. Some Applications of Trigonometry", "10. Circles", "11. Areas Related to Circles", "12. Surface Areas and Volumes",
        "13. Statistics", "14. Probability",
      ],
    },
    "Social Science": {
      books: [
        { code: "jess3", title: "India and the Contemporary World – II (History)", edition: R },
        { code: "jess1", title: "Contemporary India (Geography)", edition: R },
        { code: "jess4", title: "Democratic Politics (Political Science)", edition: R },
        { code: "jess2", title: "Understanding Economic Development (Economics)", edition: R },
      ],
      chapters: [
        "History · I. The Rise of Nationalism in Europe", "History · II. Nationalism in India", "History · III. The Making of a Global World",
        "History · IV. The Age of Industrialisation", "History · V. Print Culture and the Modern World",
        "Geography · 1. Resources and Development", "Geography · 2. Forest and Wildlife Resources", "Geography · 3. Water Resources",
        "Geography · 4. Agriculture", "Geography · 5. Minerals and Energy Resources", "Geography · 6. Manufacturing Industries",
        "Geography · 7. Lifelines of National Economy",
        "Political Science · 1. Power-sharing", "Political Science · 2. Federalism", "Political Science · 3. Gender, Religion and Caste",
        "Political Science · 4. Political Parties", "Political Science · 5. Outcomes of Democracy",
        "Economics · 1. Development", "Economics · 2. Sectors of the Indian Economy", "Economics · 3. Money and Credit",
        "Economics · 4. Globalisation and the Indian Economy", "Economics · 5. Consumer Rights",
      ],
    },
    English: {
      books: [{ code: "jeff1", title: "First Flight", edition: R }, { code: "jefp1", title: "Footprints without Feet", edition: R }],
      chapters: [
        "First Flight · 1. A Letter to God", "First Flight · Dust of Snow", "First Flight · Fire and Ice",
        "First Flight · 2. Nelson Mandela: Long Walk to Freedom", "First Flight · A Tiger in the Zoo",
        "First Flight · 3. Two Stories about Flying: His First Flight; Black Aeroplane", "First Flight · How to Tell Wild Animals",
        "First Flight · The Ball Poem", "First Flight · 4. From the Diary of Anne Frank", "First Flight · Amanda!",
        "First Flight · 5. Glimpses of India: A Baker from Goa; Coorg; Tea from Assam", "First Flight · The Trees",
        "First Flight · 6. Mijbil the Otter", "First Flight · Fog", "First Flight · 7. Madam Rides the Bus",
        "First Flight · The Tale of Custard the Dragon", "First Flight · 8. The Sermon at Benares", "First Flight · For Anne Gregory",
        "First Flight · 9. The Proposal",
        "Footprints · 1. A Triumph of Surgery", "Footprints · 2. The Thief's Story", "Footprints · 3. The Midnight Visitor",
        "Footprints · 4. A Question of Trust", "Footprints · 5. Footprints without Feet", "Footprints · 6. The Making of a Scientist",
        "Footprints · 7. The Necklace", "Footprints · 8. Bholi", "Footprints · 9. The Book That Saved the Earth",
      ],
    },
  },
};

/** Subjects for which NCERT books exist but no chapter list is bundled (teacher adds chapters). */
export const NO_INDEX_SUBJECTS = ["Hindi", "Sanskrit"];

export function ncertChapters(grade: string | null | undefined, subject: string) {
  if (!grade) return null;
  const s = NCERT_INDEX[grade]?.[Object.keys(NCERT_INDEX[grade] ?? {}).find((k) => k.toLowerCase() === subject.trim().toLowerCase()) ?? ""];
  return s ?? null;
}
