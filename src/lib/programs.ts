/**
 * Marketing details for each program page. Price, curriculum, outcomes and FAQs
 * live in the database (editable from Admin → Courses); everything here is the
 * presentational layer: colour, positioning, projects, tools and career paths.
 * Edit this file to change what appears on the program pages.
 */
export type ProgramHue = "stock" | "web" | "digital" | "excel";
export type Showcase = "chart" | "code" | "campaign" | "sheet";

export type ProgramDetails = {
  slug: string;
  category: string;
  name: string;
  shortName: string;
  hue: ProgramHue;
  showcase: Showcase;
  pitch: string;
  duration: string;
  weeklyEffort: string;
  format: string;
  audience: string[];
  projects: { title: string; description: string }[];
  tools: string[];
  careers: string[];
  includes: string[];
};

const sharedIncludes = [
  "Recorded video lessons you can watch anytime",
  "Downloadable notes and practice files",
  "Quizzes after every module",
  "Graded assignments and a capstone project",
  "Verifiable Proofwork certificate",
  "Access to Proofwork project experiences",
];

export const PROGRAMS: ProgramDetails[] = [
  {
    slug: "stock-market-program",
    category: "stock-market",
    name: "Stock Market Program",
    shortName: "Stock Market",
    hue: "stock",
    showcase: "chart",
    pitch: "Read charts, analyse companies and invest with a plan.",
    duration: "8 weeks",
    weeklyEffort: "4–5 hours a week",
    format: "Self-paced video lessons",
    audience: [
      "Students who want to understand markets before investing real money",
      "Commerce and finance students preparing for equity research or broking roles",
      "Anyone who wants a structured alternative to random tips and videos",
    ],
    projects: [
      { title: "Chart annotation", description: "Mark trends, support, resistance and signals on three real NSE charts." },
      { title: "Stock research note", description: "Analyse a listed company's financials and publish a one-page view." },
      { title: "Mock portfolio capstone", description: "Build a diversified portfolio with position sizes and defend every choice." },
    ],
    tools: ["TradingView", "NSE & BSE websites", "Screener.in", "Excel or Google Sheets"],
    careers: ["Equity research analyst", "Investment banking analyst", "Wealth management associate", "Financial analyst"],
    includes: sharedIncludes,
  },
  {
    slug: "web-development-program",
    category: "web-development",
    name: "Web Design & Development Program",
    shortName: "Web Development",
    hue: "web",
    showcase: "code",
    pitch: "Design, build and launch real websites, then show them off.",
    duration: "10 weeks",
    weeklyEffort: "5–6 hours a week",
    format: "Self-paced video lessons",
    audience: [
      "Complete beginners who want to start coding",
      "Engineering and BCA students who want a portfolio of real projects",
      "Designers and freelancers who want to build what they design",
    ],
    projects: [
      { title: "Profile page", description: "Your first web page, built with clean, accessible HTML and CSS." },
      { title: "Landing page design", description: "A complete landing page designed in Figma, ready for development." },
      { title: "Interactive to-do app", description: "A JavaScript app that saves tasks and responds to users." },
      { title: "Portfolio website capstone", description: "A responsive portfolio built in React and deployed live on Vercel." },
    ],
    tools: ["VS Code", "Figma", "HTML, CSS & JavaScript", "React", "Tailwind CSS", "Git & GitHub", "Vercel"],
    careers: ["Front-end developer", "UI developer", "Web designer", "Freelance web developer"],
    includes: sharedIncludes,
  },
  {
    slug: "digital-marketing-program",
    category: "digital-marketing",
    name: "Digital Marketing Program",
    shortName: "Digital Marketing",
    hue: "digital",
    showcase: "campaign",
    pitch: "Plan campaigns, grow audiences and prove what works.",
    duration: "6 weeks",
    weeklyEffort: "4–5 hours a week",
    format: "Self-paced video lessons",
    audience: [
      "BBA, BMS and commerce students aiming for marketing roles",
      "Creators and freelancers who want to grow faster",
      "Founders and family-business owners who want more customers online",
    ],
    projects: [
      { title: "SEO blog optimisation", description: "Research keywords and rewrite a blog post so it can rank." },
      { title: "30-day content calendar", description: "Plan a month of posts and reels around clear content pillars." },
      { title: "Campaign plan capstone", description: "A full campaign with audience, channels, budget and KPI dashboard." },
    ],
    tools: ["Google Ads", "Meta Ads Manager", "Google Analytics 4", "Google Search Console", "Canva", "Email marketing tools"],
    careers: ["Digital marketing executive", "Social media manager", "SEO specialist", "Performance marketing associate"],
    includes: sharedIncludes,
  },
  {
    slug: "excel-program",
    category: "excel",
    name: "Excel for Finance & Business",
    shortName: "Excel",
    hue: "excel",
    showcase: "sheet",
    pitch: "The Excel skills interviewers test and teams rely on.",
    duration: "4 weeks",
    weeklyEffort: "3–4 hours a week",
    format: "Self-paced video lessons",
    audience: [
      "CA, CMA, B.Com and MBA students preparing for articleship or placements",
      "Freshers who want to be fast and accurate in their first job",
      "Working professionals who still copy-paste what a formula could do",
    ],
    projects: [
      { title: "Data clean-up", description: "Turn a messy export into a clean, analysis-ready table." },
      { title: "EMI calculator", description: "Build a loan calculator with PMT and an amortisation schedule." },
      { title: "MIS dashboard", description: "A one-page monthly sales dashboard with charts and insights." },
    ],
    tools: ["Microsoft Excel", "Pivot tables", "XLOOKUP & dynamic arrays", "Power Query", "Macros"],
    careers: ["Financial analyst", "MIS executive", "Accounts and audit associate", "Business analyst"],
    includes: sharedIncludes,
  },
];

export function getProgram(slug: string) {
  return PROGRAMS.find((p) => p.slug === slug) ?? null;
}

export function getProgramByCategory(category: string | undefined | null) {
  return PROGRAMS.find((p) => p.category === category) ?? null;
}

/** Tailwind classes per hue (literal strings so Tailwind can see them). */
export const HUE: Record<ProgramHue, { solid: string; tint: string; text: string; ring: string; dot: string }> = {
  stock: { solid: "bg-stock", tint: "bg-stock-tint", text: "text-stock", ring: "ring-stock/25", dot: "bg-stock" },
  web: { solid: "bg-web", tint: "bg-web-tint", text: "text-web", ring: "ring-web/25", dot: "bg-web" },
  digital: { solid: "bg-digital", tint: "bg-digital-tint", text: "text-digital", ring: "ring-digital/25", dot: "bg-digital" },
  excel: { solid: "bg-excel", tint: "bg-excel-tint", text: "text-excel", ring: "ring-excel/25", dot: "bg-excel" },
};
