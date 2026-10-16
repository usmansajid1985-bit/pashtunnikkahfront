/**
 * Professions: the titles members choose from (searchable dropdown in signup and Edit Profile),
 * grouped for the Browse "Profession" filter. Older profiles hold free text, which the filter
 * matches on each group's keywords. Client-safe.
 */
export type ProfessionGroup = {
  id: string;
  label: string;
  /** Titles members pick from (Edit Profile / signup). Groups without titles are filter-only. */
  titles?: readonly string[];
  /** Words that older free-text professions are matched on by the Browse filter. */
  keywords: readonly string[];
};

export const PROFESSION_GROUPS: readonly ProfessionGroup[] = [
  {
    id: "healthcare",
    titles: ["Doctor / GP", "Hospital Doctor", "Surgeon", "Dentist", "Pharmacist", "Nurse", "Midwife", "Paramedic", "Physiotherapist", "Optometrist", "Radiographer", "Psychologist", "Healthcare Assistant", "Care Worker", "Medical Receptionist", "Dental Nurse", "Occupational Therapist", "Speech Therapist", "Biomedical Scientist", "Vet"],
    label: "Healthcare & medicine",
    keywords: ["doctor", "nurs", "medic", "dentist", "dental", "pharmac", "surgeon", "physio", "optom", "midwi", "paramedic", "health", "nhs", "general practi", "carer", "care assistant", "radiograph", "psycholog", "therap"],
  },
  {
    id: "engineering_tech",
    titles: ["Software Engineer", "Web Developer", "IT Support", "Data Analyst", "Data Scientist", "Cyber Security Specialist", "Network Engineer", "Civil Engineer", "Mechanical Engineer", "Electrical Engineer", "Chemical Engineer", "Aerospace Engineer", "Architect", "Quantity Surveyor", "Product Manager", "UX / UI Designer", "Telecoms Engineer"],
    label: "Engineering & technology",
    keywords: ["engineer", "software", "developer", "programmer", "it support", "it consult", "it manager", "it engineer", "tech", "data", "cyber", "network", "web dev", "computer", "architect", "analyst"],
  },
  {
    id: "business_finance",
    titles: ["Accountant", "Auditor", "Finance Manager", "Financial Analyst", "Banker", "Investment Banker", "Insurance Advisor", "Mortgage Advisor", "Business Analyst", "Management Consultant", "Project Manager", "Operations Manager", "Marketing Manager", "Sales Executive", "Estate Agent", "HR Manager", "Recruiter", "Office Administrator", "Personal Assistant", "Economist"],
    label: "Business & finance",
    keywords: ["account", "financ", "bank", "audit", "business", "manager", "management", "consult", "marketing", "sales", "hr manager", "hr advis", "human resources", "recruit", "project", "admin", "insurance", "investment", "econom"],
  },
  {
    id: "education",
    titles: ["Teacher", "Primary School Teacher", "Secondary School Teacher", "Teaching Assistant", "Lecturer", "Professor", "Tutor", "Nursery Practitioner", "Researcher", "School Administrator"],
    label: "Education & teaching",
    keywords: ["teach", "lectur", "tutor", "professor", "education", "school", "academic", "research", "trainer"],
  },
  {
    id: "law_public",
    titles: ["Solicitor", "Barrister", "Paralegal", "Police Officer", "Civil Servant", "Council Officer", "Social Worker", "Armed Forces", "Firefighter", "Prison Officer", "Border Force Officer", "Charity Worker"],
    label: "Law & public service",
    keywords: ["law", "solicitor", "barrister", "legal", "paralegal", "police", "civil serv", "government", "council", "social work", "army", "military", "officer"],
  },
  {
    id: "trades",
    titles: ["Electrician", "Plumber", "Gas Engineer", "Mechanic", "Builder", "Carpenter", "Painter & Decorator", "Plasterer", "Technician", "Driver", "Taxi Driver", "HGV Driver", "Delivery Driver", "Warehouse Operative", "Factory Worker", "Tailor", "Barber", "Chef", "Pilot", "Cabin Crew"],
    label: "Trades & skilled work",
    keywords: ["electric", "plumb", "mechanic", "builder", "construct", "carpent", "driver", "taxi", "technician", "warehouse", "logistic", "factory", "tailor", "barber", "chef", "cook"],
  },
  {
    id: "retail_hospitality",
    titles: ["Retail Assistant", "Store Manager", "Customer Service Advisor", "Call Centre Advisor", "Restaurant Manager", "Hotel Staff", "Beautician", "Hairdresser", "Security Officer", "Travel Agent", "Cleaner"],
    label: "Retail, hospitality & services",
    keywords: ["retail", "shop", "store", "customer", "hospitality", "restaurant", "hotel", "catering", "beaut", "travel", "security", "cleaner", "delivery"],
  },
  {
    id: "creative_media",
    titles: ["Graphic Designer", "Photographer", "Videographer", "Journalist", "Writer", "Content Creator", "Fashion Designer", "Interior Designer", "Artist", "Marketing Executive"],
    label: "Creative & media",
    keywords: ["design", "artist", "writer", "journalis", "media", "photograph", "content", "film", "creative", "fashion"],
  },
  {
    id: "islamic",
    titles: ["Imam", "Islamic Teacher / Ustadh", "Aalim / Aalimah", "Hafiz / Hafiza", "Islamic Scholar", "Quran Teacher"],
    label: "Islamic studies & religious work",
    keywords: ["imam", "alim", "aalim", "hafiz", "islamic", "quran", "madrasa", "mufti", "scholar"],
  },
  { id: "self_employed",
    titles: ["Business Owner", "Entrepreneur", "Shop Owner", "Restaurant Owner", "Landlord / Property", "Freelancer", "Contractor"], label: "Self-employed / business owner", keywords: ["self-employed", "self employed", "business owner", "owner", "entrepreneur", "freelanc", "own business"] },
  { id: "student", label: "Student", keywords: ["student", "studying", "undergrad", "apprentice"] },
  { id: "homemaker", label: "Homemaker", keywords: ["homemaker", "housewife", "home maker", "stay at home"] },
];

export function professionGroup(id: string | null | undefined) {
  return PROFESSION_GROUPS.find((g) => g.id === (id ?? "").trim()) ?? null;
}

/** Choice for anything not listed. */
export const OTHER_PROFESSION = "Other";

export const STUDY_SUBJECTS: readonly string[] = [
  "Medicine", "Dentistry", "Pharmacy", "Nursing / Midwifery", "Allied Health", "Biomedical Science",
  "Engineering", "Computer Science", "Data Science / Maths", "Physics / Chemistry", "Biology",
  "Architecture", "Law", "Accounting / Finance", "Business / Management", "Economics", "Marketing",
  "Psychology", "Education / Teaching", "Social Work", "Politics / International Relations",
  "English / Languages", "History", "Islamic Studies", "Art / Design", "Media / Journalism",
  "Apprenticeship", "A Levels / College", "Other",
];

/** Options for the "What do you do?" / "What are you studying?" picker. */
export function careerOptions(employment: string): { group: string; options: readonly string[] }[] {
  if (employment === "Student") return [{ group: "Field of study", options: STUDY_SUBJECTS }];
  return [
    ...PROFESSION_GROUPS.filter((g) => g.titles?.length).map((g) => ({ group: g.label, options: g.titles! })),
    { group: "Not listed", options: [OTHER_PROFESSION] },
  ];
}

export function isCareerOption(employment: string, value: string): boolean {
  return careerOptions(employment).some((g) => g.options.includes(value));
}
