/**
 * Profession groups for the Browse "Profession" filter. Members type their profession as free
 * text ("What do you do?"), so each group matches on the words people actually write.
 * Client-safe.
 */
export const PROFESSION_GROUPS: readonly { id: string; label: string; keywords: readonly string[] }[] = [
  {
    id: "healthcare",
    label: "Healthcare & medicine",
    keywords: ["doctor", "nurs", "medic", "dentist", "dental", "pharmac", "surgeon", "physio", "optom", "midwi", "paramedic", "health", "nhs", "general practi", "carer", "care assistant", "radiograph", "psycholog", "therap"],
  },
  {
    id: "engineering_tech",
    label: "Engineering & technology",
    keywords: ["engineer", "software", "developer", "programmer", "it support", "it consult", "it manager", "it engineer", "tech", "data", "cyber", "network", "web dev", "computer", "architect", "analyst"],
  },
  {
    id: "business_finance",
    label: "Business & finance",
    keywords: ["account", "financ", "bank", "audit", "business", "manager", "management", "consult", "marketing", "sales", "hr manager", "hr advis", "human resources", "recruit", "project", "admin", "insurance", "investment", "econom"],
  },
  {
    id: "education",
    label: "Education & teaching",
    keywords: ["teach", "lectur", "tutor", "professor", "education", "school", "academic", "research", "trainer"],
  },
  {
    id: "law_public",
    label: "Law & public service",
    keywords: ["law", "solicitor", "barrister", "legal", "paralegal", "police", "civil serv", "government", "council", "social work", "army", "military", "officer"],
  },
  {
    id: "trades",
    label: "Trades & skilled work",
    keywords: ["electric", "plumb", "mechanic", "builder", "construct", "carpent", "driver", "taxi", "technician", "warehouse", "logistic", "factory", "tailor", "barber", "chef", "cook"],
  },
  {
    id: "retail_hospitality",
    label: "Retail, hospitality & services",
    keywords: ["retail", "shop", "store", "customer", "hospitality", "restaurant", "hotel", "catering", "beaut", "travel", "security", "cleaner", "delivery"],
  },
  {
    id: "creative_media",
    label: "Creative & media",
    keywords: ["design", "artist", "writer", "journalis", "media", "photograph", "content", "film", "creative", "fashion"],
  },
  {
    id: "islamic",
    label: "Islamic studies & religious work",
    keywords: ["imam", "alim", "aalim", "hafiz", "islamic", "quran", "madrasa", "mufti", "scholar"],
  },
  { id: "self_employed", label: "Self-employed / business owner", keywords: ["self-employed", "self employed", "business owner", "owner", "entrepreneur", "freelanc", "own business"] },
  { id: "student", label: "Student", keywords: ["student", "studying", "undergrad", "apprentice"] },
  { id: "homemaker", label: "Homemaker", keywords: ["homemaker", "housewife", "home maker", "stay at home"] },
];

export function professionGroup(id: string | null | undefined) {
  return PROFESSION_GROUPS.find((g) => g.id === (id ?? "").trim()) ?? null;
}
