// Synthetic residents. Each one is drawn from distributions shaped like Clinton
// County / Wilmington, Ohio (ACS 5-year profile, 2023, rounded): job mix built
// around the air park, warehouses, the hospital, the schools and farming; a
// median household income near $55k with a long low tail; about 45% renters in
// the city; 17% retired; ~30% of households with school-age kids. They are NOT
// real people and the shares are approximate. What they are for: the same deal
// lands differently on a renter earning $28k, a construction electrician, a
// farmer renting 200 acres and a retiree, and the engine already knows how.
import { tileOf } from "../mapConfig";

export type Sector = "construction" | "manufacturing" | "logistics" | "healthcare" | "education" | "retail" | "service" | "farm" | "tech" | "public" | "other" | "retired" | "student";

export type Occupation = {
  id: string;
  label: string;
  sector: Sector;
  share: number; // of adults; normalized at draw time
  income: [number, number]; // household income $/yr, uniform in this band
  night?: number; // chance of working nights
};

export const OCCUPATIONS: Occupation[] = [
  { id: "warehouse", label: "Warehouse associate", sector: "logistics", share: 0.1, income: [30000, 46000], night: 0.4 },
  { id: "aircargo", label: "Air cargo handler", sector: "logistics", share: 0.05, income: [34000, 52000], night: 0.5 },
  { id: "truck", label: "Truck driver", sector: "logistics", share: 0.05, income: [44000, 70000] },
  { id: "machinist", label: "Machine operator", sector: "manufacturing", share: 0.08, income: [36000, 58000], night: 0.3 },
  { id: "nurse", label: "Nurse", sector: "healthcare", share: 0.05, income: [52000, 82000], night: 0.3 },
  { id: "aide", label: "Home health aide", sector: "healthcare", share: 0.04, income: [24000, 34000] },
  { id: "teacher", label: "Teacher", sector: "education", share: 0.05, income: [42000, 68000] },
  { id: "cashier", label: "Retail cashier", sector: "retail", share: 0.07, income: [20000, 30000] },
  { id: "server", label: "Restaurant server", sector: "service", share: 0.05, income: [18000, 28000] },
  { id: "mechanic", label: "Auto mechanic", sector: "service", share: 0.03, income: [32000, 54000] },
  { id: "electrician", label: "Electrician", sector: "construction", share: 0.03, income: [44000, 72000] },
  { id: "laborer", label: "Construction laborer", sector: "construction", share: 0.04, income: [30000, 48000] },
  { id: "farmer_rent", label: "Farmer, rents land", sector: "farm", share: 0.02, income: [28000, 90000] },
  { id: "farmer_own", label: "Farmer, owns land", sector: "farm", share: 0.01, income: [40000, 120000] },
  { id: "it", label: "IT technician", sector: "tech", share: 0.02, income: [48000, 78000] },
  { id: "engineer", label: "Engineer", sector: "tech", share: 0.02, income: [68000, 110000] },
  { id: "clerk", label: "County office clerk", sector: "public", share: 0.03, income: [34000, 52000] },
  { id: "officer", label: "Police officer", sector: "public", share: 0.01, income: [48000, 70000], night: 0.4 },
  { id: "owner", label: "Small business owner", sector: "other", share: 0.04, income: [40000, 110000] },
  { id: "retired", label: "Retired", sector: "retired", share: 0.17, income: [16000, 48000] },
  { id: "student", label: "College student", sector: "student", share: 0.04, income: [4000, 14000] },
  { id: "disability", label: "On disability", sector: "other", share: 0.03, income: [12000, 20000] },
];

export const TRAIT_OPTIONS = [
  "Lifelong resident",
  "Moved here for the air park",
  "Moved here for cheaper housing",
  "Commutes to Dayton",
  "On a fixed income",
  "Rent takes most of the paycheck",
  "Lives alone",
  "Caring for a parent",
  "Runs a side business",
  "Volunteer firefighter",
  "Wants the town to grow",
  "Worries about the water",
  "Skeptical of tax breaks",
  "Just here for the jobs",
] as const;

// What a user fills in to make their own resident. Serializable (saved in localStorage).
export type CharacterSpec = {
  name: string;
  age: number;
  occupationId: string;
  income: number;
  tenure: "rent" | "own";
  householdSize: number;
  kidsInSchool: number;
  farmAcresRented: number;
  kwhPerMonth: number;
  worksNights: boolean;
  traits: string[];
  color: string;
  home: [number, number] | null; // scene x, z; null = pick a house for them
};

export function defaultKwh(householdSize: number, income: number) {
  return Math.round(Math.min(1800, Math.max(380, 520 + householdSize * 110 + (income / 1000) * 2.2)));
}

export type Person = {
  id: number;
  custom?: boolean; // made by the user (not drawn from the distributions)
  name: string;
  age: number;
  occupation: Occupation;
  income: number; // household $/yr
  tenure: "rent" | "own";
  householdSize: number;
  kidsInSchool: number;
  farmAcresRented: number; // 0 unless a renting farmer
  kwhPerMonth: number; // electricity use; the engine's bill effect is for an average home
  worksNights: boolean;
  traits: string[];
  home: [number, number]; // scene x, z (a real building centroid)
  ticket: number; // 0..1, fixed per person: who wins a job when there are N jobs
  color: string;
};

const FIRST = ["Jamie", "Dana", "Marcus", "Tasha", "Earl", "Brenda", "Luis", "Kayla", "Dwayne", "Carol", "Tyler", "Megan", "Hank", "Priya", "Cody", "Angela", "Rick", "Jasmine", "Wes", "Donna", "Trevor", "Nicole", "Leroy", "Heather", "Sam", "Alex", "Jordan", "Casey", "Pat", "Terry", "Robin", "Morgan", "Devin", "Lena", "Omar", "Ruth", "Gary", "Chloe", "Brandon", "Marie"];
const LAST = ["Miller", "Jones", "Smith", "Brown", "Davis", "Wilson", "Taylor", "Moore", "Clark", "Lewis", "Walker", "Hall", "Allen", "Young", "King", "Wright", "Hill", "Scott", "Green", "Adams", "Baker", "Nelson", "Carter", "Mitchell", "Roberts", "Turner", "Phillips", "Campbell", "Parker", "Evans", "Collins", "Stewart", "Morris", "Rogers", "Reed", "Cook", "Bailey", "Bell", "Cooper", "Howard"];
const SHIRTS = ["#e53935", "#1e88e5", "#43a047", "#fb8c00", "#8e24aa", "#00acc1", "#f4511e", "#3949ab", "#7cb342", "#d81b60", "#546e7a", "#ffb300"];

// mulberry32: tiny seeded PRNG so the same town always gets the same residents
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function pickOccupation(u: number): Occupation {
  const total = OCCUPATIONS.reduce((s, o) => s + o.share, 0);
  let acc = 0;
  for (const o of OCCUPATIONS) {
    acc += o.share / total;
    if (u < acc) return o;
  }
  return OCCUPATIONS[OCCUPATIONS.length - 1];
}

function traitsFor(p: Omit<Person, "traits">, r: () => number): string[] {
  const t: string[] = [];
  const o = p.occupation;
  if (r() < 0.45) t.push("Lifelong resident");
  else if (o.sector === "logistics" && r() < 0.6) t.push("Moved here for the air park");
  else if (r() < 0.3) t.push("Moved here for cheaper housing");
  if (p.kidsInSchool === 1) t.push("One kid in the city schools");
  if (p.kidsInSchool >= 2) t.push(`${p.kidsInSchool} kids in the city schools`);
  if (p.farmAcresRented > 0) t.push(`Rents ${p.farmAcresRented} acres of cropland`);
  if (o.id === "farmer_own") t.push("Owns the family farm");
  if (o.sector === "retired" || o.id === "disability") t.push("On a fixed income");
  if (p.worksNights) t.push("Works nights");
  if (["engineer", "nurse", "teacher"].includes(o.id) && r() < 0.35) t.push("Commutes to Dayton");
  if (p.tenure === "rent" && p.income < 32000) t.push("Rent takes most of the paycheck");
  if (p.householdSize === 1 && p.age > 70) t.push("Lives alone");
  if (o.sector === "student") t.push("At Wilmington College");
  return t.slice(0, 3);
}

/** A resident from a user's spec. Deterministic ticket from the name, so the same character keeps the same luck. */
export function makePerson(spec: CharacterSpec, id: number, centroids: Float32Array | null): Person {
  const r = rng(hash("custom:" + spec.name.toLowerCase()));
  const occupation = OCCUPATIONS.find((o) => o.id === spec.occupationId) ?? OCCUPATIONS[0];
  let home: [number, number] | null = spec.home;
  if (!home) {
    if (centroids && centroids.length >= 2) {
      const i = Math.floor(r() * (centroids.length / 2)) * 2;
      home = [centroids[i], centroids[i + 1]];
    } else home = [0, 0];
  }
  return {
    id,
    custom: true,
    name: spec.name,
    age: spec.age,
    occupation,
    income: spec.income,
    tenure: spec.tenure,
    householdSize: spec.householdSize,
    kidsInSchool: spec.kidsInSchool,
    farmAcresRented: occupation.id === "farmer_rent" ? spec.farmAcresRented : 0,
    kwhPerMonth: spec.kwhPerMonth,
    worksNights: spec.worksNights,
    traits: spec.traits.slice(0, 3),
    home,
    ticket: r(),
    color: spec.color,
  };
}

/** The spec a person was made from (for editing a custom character). */
export function specOf(p: Person): CharacterSpec {
  return {
    name: p.name,
    age: p.age,
    occupationId: p.occupation.id,
    income: p.income,
    tenure: p.tenure,
    householdSize: p.householdSize,
    kidsInSchool: p.kidsInSchool,
    farmAcresRented: p.farmAcresRented,
    kwhPerMonth: p.kwhPerMonth,
    worksNights: p.worksNights,
    traits: p.traits,
    color: p.color,
    home: p.home,
  };
}

/**
 * Build the town's residents. Homes are real building centroids, weighted toward
 * tiles with many buildings (residential blocks), so distance to the site is real.
 */
export function generatePopulation(seedKey: string, centroids: Float32Array | null, counts: Int32Array | null, n = 240): Person[] {
  const r = rng(hash(seedKey));
  // candidate homes: buildings in denser tiles
  const homes: [number, number][] = [];
  if (centroids) {
    for (let i = 0; i < centroids.length; i += 2) {
      const x = centroids[i], z = centroids[i + 1];
      const dense = counts ? counts[tileOf(x, z)] >= 6 : true;
      if (dense) homes.push([x, z]);
    }
    if (homes.length < n) for (let i = 0; i < centroids.length; i += 2) homes.push([centroids[i], centroids[i + 1]]);
  }
  const people: Person[] = [];
  for (let i = 0; i < n; i++) {
    const occupation = pickOccupation(r());
    let age = occupation.sector === "retired" ? 65 + Math.floor(r() * 25) : occupation.sector === "student" ? 18 + Math.floor(r() * 5) : 22 + Math.floor(r() * 42);
    if (occupation.id === "disability") age = 35 + Math.floor(r() * 30);
    const income = Math.round((occupation.income[0] + r() * (occupation.income[1] - occupation.income[0])) / 500) * 500;
    const tenure: Person["tenure"] = r() < (income < 40000 ? 0.62 : income < 70000 ? 0.4 : 0.2) ? "rent" : "own";
    const householdSize = occupation.sector === "student" ? 1 + Math.floor(r() * 3) : age > 68 ? 1 + Math.floor(r() * 2) : 1 + Math.floor(r() * 4);
    const kidsInSchool = age >= 26 && age <= 55 && householdSize >= 2 && r() < 0.45 ? 1 + Math.floor(r() * 3) : 0;
    const farmAcresRented = occupation.id === "farmer_rent" ? 80 + Math.floor(r() * 9) * 40 : 0;
    const kwhPerMonth = Math.round(Math.min(1800, Math.max(380, 520 + householdSize * 110 + (income / 1000) * 2.2 + (r() - 0.5) * 200)));
    const worksNights = r() < (occupation.night ?? 0.05);
    const home = homes.length ? homes[Math.floor(r() * homes.length)] : ([(r() - 0.5) * 4000, (r() - 0.5) * 4000] as [number, number]);
    const base: Omit<Person, "traits"> = {
      id: i,
      name: `${FIRST[Math.floor(r() * FIRST.length)]} ${LAST[Math.floor(r() * LAST.length)]}`,
      age,
      occupation,
      income,
      tenure,
      householdSize,
      kidsInSchool,
      farmAcresRented,
      kwhPerMonth,
      worksNights,
      home,
      ticket: r(),
      color: SHIRTS[Math.floor(r() * SHIRTS.length)],
    };
    people.push({ ...base, traits: traitsFor(base, r) });
  }
  return people;
}
