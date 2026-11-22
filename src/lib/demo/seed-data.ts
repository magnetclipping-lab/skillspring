/**
 * Demo catalogue for SkillSpring.
 *
 * Single source of truth used by:
 *  - scripts/generate-seed.ts  → supabase/seed.sql
 *  - preview mode (when Supabase is not configured) for public pages
 *
 * Every record here is DEMO content: courses are flagged `is_demo = true` with
 * `rights_status = 'pending'`, so they are visible in the catalogue but can never
 * be purchased. Internships are SkillSpring-run educational simulations/projects,
 * never presented as employer vacancies. No employers, instructors, testimonials
 * or statistics are invented.
 */

export type DemoLesson = { title: string; type: "video" | "text" | "pdf" | "quiz" | "assignment"; minutes: number; preview?: boolean };
export type DemoModule = { title: string; lessons: DemoLesson[] };
export type DemoCourse = {
  slug: string;
  title: string;
  subtitle: string;
  category: string;
  description: string;
  outcomes: string[];
  requirements: string[];
  level: "beginner" | "intermediate" | "advanced";
  language: string;
  pricePaise: number;
  modules: DemoModule[];
  faqs: { q: string; a: string }[];
};

export const demoCategories = [
  { slug: "finance-stock-market", name: "Finance & Stock Market", icon: "trending-up", description: "Markets, analysis and financial modelling.", sort: 1 },
  { slug: "technology-ai", name: "Technology & AI", icon: "cpu", description: "Generative AI, prompting and data skills.", sort: 2 },
  { slug: "business-marketing", name: "Business & Marketing", icon: "megaphone", description: "Digital, content and social media marketing.", sort: 3 },
  { slug: "career-development", name: "Career Development", icon: "briefcase", description: "Resumes, interviews and workplace communication.", sort: 4 },
] as const;

const faqDefaults = [
  { q: "Is this course available now?", a: "Not yet. This is a demo listing. It will open for purchase once course material and instructor rights are approved." },
  { q: "Will I get a certificate?", a: "Yes, after you complete every mandatory lesson, submit required assignments and pass the quizzes. Each certificate has a public verification link." },
];

function m(title: string, lessons: DemoLesson[]): DemoModule {
  return { title, lessons };
}

export const demoCourses: DemoCourse[] = [
  {
    slug: "stock-market-fundamentals",
    title: "Stock Market Fundamentals",
    subtitle: "How Indian equity markets work, from exchanges to order types.",
    category: "finance-stock-market",
    description: "A structured introduction to the Indian stock market: how NSE and BSE work, the role of SEBI, depositories and brokers, how prices are formed and how to read basic market data responsibly.",
    outcomes: ["Explain how exchanges, brokers and depositories fit together", "Read a stock quote and an order book", "Tell investing apart from trading and speculation", "Recognise common risks and investor-protection rules"],
    requirements: ["No prior finance knowledge needed"],
    level: "beginner", language: "English", pricePaise: 49900,
    modules: [
      m("Market structure", [{ title: "What a stock market is for", type: "video", minutes: 12, preview: true }, { title: "Exchanges, brokers and depositories", type: "video", minutes: 15 }, { title: "Regulation and investor protection", type: "text", minutes: 10 }]),
      m("Prices and orders", [{ title: "How prices are discovered", type: "video", minutes: 14 }, { title: "Order types explained", type: "video", minutes: 13 }, { title: "Module quiz", type: "quiz", minutes: 10 }]),
      m("Getting started responsibly", [{ title: "Risk, diversification and time horizon", type: "video", minutes: 16 }, { title: "Assignment: build a watchlist with a rationale", type: "assignment", minutes: 30 }]),
    ],
    faqs: faqDefaults,
  },
  {
    slug: "technical-analysis-for-beginners",
    title: "Technical Analysis for Beginners",
    subtitle: "Charts, trends, support and resistance, and the limits of indicators.",
    category: "finance-stock-market",
    description: "Learn to read price charts and common indicators, understand what technical analysis can and cannot tell you, and practise disciplined risk management.",
    outcomes: ["Read candlestick charts", "Identify trends, support and resistance", "Use moving averages, RSI and volume with caution", "Write a basic trading-journal entry with risk limits"],
    requirements: ["Stock Market Fundamentals or equivalent knowledge"],
    level: "beginner", language: "English", pricePaise: 79900,
    modules: [
      m("Reading charts", [{ title: "Candlesticks and timeframes", type: "video", minutes: 14, preview: true }, { title: "Trends and trendlines", type: "video", minutes: 15 }]),
      m("Indicators", [{ title: "Moving averages", type: "video", minutes: 12 }, { title: "RSI and momentum", type: "video", minutes: 12 }, { title: "Volume", type: "text", minutes: 8 }, { title: "Indicator quiz", type: "quiz", minutes: 10 }]),
      m("Risk management", [{ title: "Position sizing and stop-losses", type: "video", minutes: 16 }, { title: "Assignment: annotate a chart", type: "assignment", minutes: 40 }]),
    ],
    faqs: faqDefaults,
  },
  {
    slug: "fundamental-analysis-equity-research",
    title: "Fundamental Analysis and Equity Research",
    subtitle: "Read annual reports and build an investment thesis.",
    category: "finance-stock-market",
    description: "Analyse businesses the way equity researchers do: industry structure, financial statements, ratios, valuation basics and writing a concise research note.",
    outcomes: ["Read the three financial statements", "Compute and interpret key ratios", "Apply relative valuation", "Write a one-page research note"],
    requirements: ["Basic accounting knowledge is helpful"],
    level: "intermediate", language: "English", pricePaise: 149900,
    modules: [
      m("Understanding the business", [{ title: "Industry and competitive analysis", type: "video", minutes: 18, preview: true }, { title: "Management and governance signals", type: "text", minutes: 12 }]),
      m("Financial statements", [{ title: "Income statement", type: "video", minutes: 16 }, { title: "Balance sheet", type: "video", minutes: 16 }, { title: "Cash flow statement", type: "video", minutes: 16 }, { title: "Ratio analysis workbook", type: "pdf", minutes: 20 }]),
      m("Valuation and reporting", [{ title: "Relative valuation", type: "video", minutes: 18 }, { title: "Valuation quiz", type: "quiz", minutes: 15 }, { title: "Assignment: research note", type: "assignment", minutes: 90 }]),
    ],
    faqs: faqDefaults,
  },
  {
    slug: "financial-modelling-with-excel",
    title: "Financial Modelling with Excel",
    subtitle: "Build a three-statement model and a simple DCF.",
    category: "finance-stock-market",
    description: "Hands-on financial modelling: structure, assumptions, linking the three statements, scenario analysis and a discounted cash flow valuation.",
    outcomes: ["Structure a clean, auditable model", "Link the income statement, balance sheet and cash flow", "Build a DCF with sensitivity tables", "Present model outputs clearly"],
    requirements: ["Comfort with Excel basics", "Understanding of financial statements"],
    level: "intermediate", language: "English", pricePaise: 199900,
    modules: [
      m("Model design", [{ title: "Model layout and best practice", type: "video", minutes: 14, preview: true }, { title: "Assumptions sheet", type: "video", minutes: 15 }]),
      m("Three-statement model", [{ title: "Revenue and cost build", type: "video", minutes: 20 }, { title: "Balancing the balance sheet", type: "video", minutes: 22 }, { title: "Template workbook", type: "pdf", minutes: 10 }]),
      m("Valuation", [{ title: "DCF valuation", type: "video", minutes: 24 }, { title: "Sensitivity analysis", type: "video", minutes: 14 }, { title: "Assignment: complete the model", type: "assignment", minutes: 120 }]),
    ],
    faqs: faqDefaults,
  },
  {
    slug: "advanced-excel-for-finance",
    title: "Advanced Excel for Finance",
    subtitle: "Lookups, dynamic arrays, pivots and dashboards for finance work.",
    category: "finance-stock-market",
    description: "The Excel skills finance teams use daily: XLOOKUP, dynamic arrays, pivot tables, data validation, financial functions and building clear dashboards.",
    outcomes: ["Use XLOOKUP, INDEX/MATCH and dynamic arrays", "Summarise data with pivot tables", "Apply NPV, IRR and PMT correctly", "Build a one-page finance dashboard"],
    requirements: ["Basic Excel familiarity"],
    level: "intermediate", language: "English", pricePaise: 99900,
    modules: [
      m("Core functions", [{ title: "Lookups that don't break", type: "video", minutes: 15, preview: true }, { title: "Dynamic arrays", type: "video", minutes: 14 }]),
      m("Analysis", [{ title: "Pivot tables", type: "video", minutes: 16 }, { title: "Financial functions", type: "video", minutes: 15 }, { title: "Functions quiz", type: "quiz", minutes: 10 }]),
      m("Presentation", [{ title: "Dashboard design", type: "video", minutes: 18 }, { title: "Assignment: monthly MIS dashboard", type: "assignment", minutes: 60 }]),
    ],
    faqs: faqDefaults,
  },
  {
    slug: "generative-ai-for-students",
    title: "Generative AI for Students",
    subtitle: "What generative AI is, how to use it well, and how to use it honestly.",
    category: "technology-ai",
    description: "A practical, non-technical course on large language models and image generators: how they work at a high level, where they help in study and work, their limits, and academic-integrity considerations.",
    outcomes: ["Explain how LLMs generate text at a high level", "Use AI assistants for research, drafting and revision", "Check AI output for errors and bias", "Follow academic-integrity rules when using AI"],
    requirements: ["None"],
    level: "beginner", language: "English", pricePaise: 49900,
    modules: [
      m("Foundations", [{ title: "What generative AI is", type: "video", minutes: 12, preview: true }, { title: "Strengths and limits", type: "video", minutes: 12 }]),
      m("Using AI well", [{ title: "Research and summarising", type: "video", minutes: 14 }, { title: "Drafting and editing", type: "video", minutes: 14 }, { title: "Fact-checking AI output", type: "text", minutes: 10 }]),
      m("Responsible use", [{ title: "Academic integrity and privacy", type: "video", minutes: 12 }, { title: "Final quiz", type: "quiz", minutes: 10 }]),
    ],
    faqs: faqDefaults,
  },
  {
    slug: "prompt-engineering",
    title: "Prompt Engineering",
    subtitle: "Write clear prompts that get reliable results.",
    category: "technology-ai",
    description: "Learn systematic prompting: giving context, examples and constraints, structuring outputs, iterating, and evaluating results for real tasks.",
    outcomes: ["Write prompts with clear context, task and format", "Use examples and step-by-step instructions", "Request structured output", "Evaluate and iterate on prompts"],
    requirements: ["Access to any AI assistant"],
    level: "beginner", language: "English", pricePaise: 69900,
    modules: [
      m("Principles", [{ title: "Anatomy of a good prompt", type: "video", minutes: 12, preview: true }, { title: "Context and constraints", type: "video", minutes: 12 }]),
      m("Techniques", [{ title: "Examples and few-shot prompting", type: "video", minutes: 14 }, { title: "Structured outputs", type: "video", minutes: 12 }, { title: "Techniques quiz", type: "quiz", minutes: 10 }]),
      m("Practice", [{ title: "Evaluating prompt quality", type: "text", minutes: 10 }, { title: "Assignment: prompt library for your field", type: "assignment", minutes: 45 }]),
    ],
    faqs: faqDefaults,
  },
  {
    slug: "ai-tools-and-productivity",
    title: "AI Tools and Productivity",
    subtitle: "Use AI tools for notes, spreadsheets, presentations and research.",
    category: "technology-ai",
    description: "A tour of practical AI workflows for students and early-career professionals, with a focus on saving time without sacrificing accuracy.",
    outcomes: ["Choose the right AI tool for a task", "Automate note-taking and summaries", "Speed up spreadsheet and slide work", "Build a personal productivity workflow"],
    requirements: ["None"],
    level: "beginner", language: "English", pricePaise: 49900,
    modules: [
      m("Choosing tools", [{ title: "The AI tool landscape", type: "video", minutes: 12, preview: true }, { title: "Privacy and data considerations", type: "text", minutes: 8 }]),
      m("Workflows", [{ title: "Notes and summaries", type: "video", minutes: 12 }, { title: "Spreadsheets with AI", type: "video", minutes: 14 }, { title: "Presentations with AI", type: "video", minutes: 12 }]),
      m("Your system", [{ title: "Designing a weekly workflow", type: "video", minutes: 10 }, { title: "Assignment: document your workflow", type: "assignment", minutes: 30 }]),
    ],
    faqs: faqDefaults,
  },
  {
    slug: "introduction-to-data-analytics",
    title: "Introduction to Data Analytics",
    subtitle: "Clean, analyse and visualise data with spreadsheets and SQL basics.",
    category: "technology-ai",
    description: "Learn the analytics workflow end to end: asking good questions, cleaning data, descriptive statistics, SQL fundamentals and communicating findings with charts.",
    outcomes: ["Frame an analytical question", "Clean and prepare a dataset", "Write basic SQL queries", "Choose the right chart for a message"],
    requirements: ["Basic spreadsheet use"],
    level: "beginner", language: "English", pricePaise: 99900,
    modules: [
      m("The analytics workflow", [{ title: "From question to insight", type: "video", minutes: 12, preview: true }, { title: "Data cleaning", type: "video", minutes: 16 }]),
      m("Analysis", [{ title: "Descriptive statistics", type: "video", minutes: 14 }, { title: "SQL fundamentals", type: "video", minutes: 20 }, { title: "SQL quiz", type: "quiz", minutes: 12 }]),
      m("Communication", [{ title: "Visualisation principles", type: "video", minutes: 14 }, { title: "Assignment: analyse a public dataset", type: "assignment", minutes: 90 }]),
    ],
    faqs: faqDefaults,
  },
  {
    slug: "digital-marketing-fundamentals",
    title: "Digital Marketing Fundamentals",
    subtitle: "Channels, funnels, budgets and measurement.",
    category: "business-marketing",
    description: "An overview of digital marketing for students and new marketers: customer journeys, owned/earned/paid channels, campaign planning, budgeting and analytics.",
    outcomes: ["Map a customer journey", "Compare digital channels", "Plan a small campaign with a budget", "Define and track KPIs"],
    requirements: ["None"],
    level: "beginner", language: "English", pricePaise: 59900,
    modules: [
      m("Foundations", [{ title: "Marketing funnels", type: "video", minutes: 12, preview: true }, { title: "Channels overview", type: "video", minutes: 14 }]),
      m("Campaigns", [{ title: "Planning a campaign", type: "video", minutes: 14 }, { title: "Budgets and bidding basics", type: "text", minutes: 10 }, { title: "Campaign quiz", type: "quiz", minutes: 10 }]),
      m("Measurement", [{ title: "KPIs and analytics", type: "video", minutes: 14 }, { title: "Assignment: campaign plan", type: "assignment", minutes: 60 }]),
    ],
    faqs: faqDefaults,
  },
  {
    slug: "seo-and-content-marketing",
    title: "SEO and Content Marketing",
    subtitle: "Keyword research, on-page SEO and content that earns attention.",
    category: "business-marketing",
    description: "Learn how search engines rank content, how to research keywords, optimise pages, plan a content calendar and measure organic growth.",
    outcomes: ["Do keyword research", "Optimise a page for search", "Plan a content calendar", "Measure organic performance"],
    requirements: ["None"],
    level: "beginner", language: "English", pricePaise: 69900,
    modules: [
      m("How search works", [{ title: "Crawling, indexing and ranking", type: "video", minutes: 12, preview: true }, { title: "Keyword research", type: "video", minutes: 16 }]),
      m("Optimisation", [{ title: "On-page SEO", type: "video", minutes: 14 }, { title: "Technical SEO basics", type: "text", minutes: 12 }]),
      m("Content", [{ title: "Content strategy and calendars", type: "video", minutes: 14 }, { title: "SEO quiz", type: "quiz", minutes: 10 }, { title: "Assignment: optimise a blog post", type: "assignment", minutes: 45 }]),
    ],
    faqs: faqDefaults,
  },
  {
    slug: "social-media-marketing",
    title: "Social Media Marketing",
    subtitle: "Plan, create and measure content for social platforms.",
    category: "business-marketing",
    description: "Build social media strategies: audience research, platform selection, content pillars, short-form video, community management and analytics.",
    outcomes: ["Define audience personas", "Create content pillars and a posting plan", "Script short-form video", "Read platform analytics"],
    requirements: ["None"],
    level: "beginner", language: "English", pricePaise: 59900,
    modules: [
      m("Strategy", [{ title: "Audience and platform choice", type: "video", minutes: 12, preview: true }, { title: "Content pillars", type: "video", minutes: 12 }]),
      m("Creation", [{ title: "Short-form video scripting", type: "video", minutes: 14 }, { title: "Design basics for social", type: "video", minutes: 12 }]),
      m("Growth", [{ title: "Community and analytics", type: "video", minutes: 12 }, { title: "Assignment: 30-day content plan", type: "assignment", minutes: 60 }]),
    ],
    faqs: faqDefaults,
  },
  {
    slug: "resume-building-and-linkedin",
    title: "Resume Building and LinkedIn",
    subtitle: "Write a resume and LinkedIn profile that show your real strengths.",
    category: "career-development",
    description: "Turn your education, projects and experience into a clear resume and LinkedIn profile, tailored to roles you want — truthfully and effectively.",
    outcomes: ["Write achievement-focused bullet points", "Tailor a resume to a role", "Optimise a LinkedIn profile", "Network professionally"],
    requirements: ["None"],
    level: "beginner", language: "English", pricePaise: 29900,
    modules: [
      m("Resume", [{ title: "What recruiters look for", type: "video", minutes: 10, preview: true }, { title: "Writing strong bullet points", type: "video", minutes: 12 }, { title: "Resume template", type: "pdf", minutes: 5 }]),
      m("LinkedIn", [{ title: "Profile essentials", type: "video", minutes: 12 }, { title: "Networking messages", type: "text", minutes: 8 }]),
      m("Apply it", [{ title: "Assignment: submit your resume for feedback", type: "assignment", minutes: 45 }]),
    ],
    faqs: faqDefaults,
  },
  {
    slug: "interview-preparation",
    title: "Interview Preparation",
    subtitle: "Prepare for HR, behavioural and technical interviews.",
    category: "career-development",
    description: "A practical guide to interviews: researching employers, answering behavioural questions with STAR, handling case and technical rounds, and following up.",
    outcomes: ["Research a company and role", "Answer behavioural questions with STAR", "Approach case and technical questions", "Ask good questions and follow up"],
    requirements: ["None"],
    level: "beginner", language: "English", pricePaise: 39900,
    modules: [
      m("Preparation", [{ title: "Researching the role", type: "video", minutes: 10, preview: true }, { title: "Your story in two minutes", type: "video", minutes: 10 }]),
      m("Answering well", [{ title: "Behavioural questions and STAR", type: "video", minutes: 14 }, { title: "Case and technical rounds", type: "video", minutes: 14 }, { title: "Interview quiz", type: "quiz", minutes: 10 }]),
      m("After the interview", [{ title: "Follow-up and negotiation basics", type: "text", minutes: 8 }]),
    ],
    faqs: faqDefaults,
  },
  {
    slug: "business-communication",
    title: "Business Communication",
    subtitle: "Email, presentations and meetings that get things done.",
    category: "career-development",
    description: "Communicate clearly at work: professional email, structured writing, presentations, meetings and giving and receiving feedback.",
    outcomes: ["Write clear professional emails", "Structure documents and reports", "Deliver confident presentations", "Run and contribute to effective meetings"],
    requirements: ["None"],
    level: "beginner", language: "English", pricePaise: 39900,
    modules: [
      m("Writing", [{ title: "Professional email", type: "video", minutes: 10, preview: true }, { title: "Structured writing", type: "video", minutes: 12 }]),
      m("Speaking", [{ title: "Presentations", type: "video", minutes: 14 }, { title: "Meetings", type: "video", minutes: 10 }]),
      m("Feedback", [{ title: "Giving and receiving feedback", type: "text", minutes: 8 }, { title: "Assignment: rewrite a business email", type: "assignment", minutes: 30 }]),
    ],
    faqs: faqDefaults,
  },
];

export type DemoInternship = {
  slug: string;
  title: string;
  kind: "simulation" | "project";
  description: string;
  responsibilities: string[];
  skills: string[];
  eligibility: string;
  location: string;
  workMode: "remote" | "hybrid" | "onsite";
  durationWeeks: number;
  deadlineInDays: number;
  positions: number | null;
};

/** SkillSpring-run educational experiences. Clearly NOT employer vacancies. */
export const demoInternships: DemoInternship[] = [
  {
    slug: "equity-research-virtual-simulation",
    title: "Equity Research Virtual Simulation",
    kind: "simulation",
    description: "A guided, self-paced simulation of an equity research analyst's work: analyse a listed company using public filings and produce a research note. Run by SkillSpring for learning purposes — this is not a job or an employer internship.",
    responsibilities: ["Study an annual report and recent filings", "Build a ratio analysis", "Write a one-page research note", "Present your thesis in a short recorded pitch"],
    skills: ["Financial statements", "Excel", "Report writing"],
    eligibility: "Open to all students. Basic accounting knowledge recommended.",
    location: "Online", workMode: "remote", durationWeeks: 4, deadlineInDays: 45, positions: null,
  },
  {
    slug: "digital-marketing-campaign-project",
    title: "Digital Marketing Campaign Project",
    kind: "project",
    description: "Plan a complete digital campaign for a fictional brand brief: audience research, channel mix, content calendar, budget and KPI dashboard. Mentor feedback on submission. Educational project — not an employer placement.",
    responsibilities: ["Research the target audience", "Design a channel mix and budget", "Create a 4-week content calendar", "Define KPIs and a reporting template"],
    skills: ["Digital marketing", "Content planning", "Spreadsheets"],
    eligibility: "Open to all students.",
    location: "Online", workMode: "remote", durationWeeks: 3, deadlineInDays: 30, positions: null,
  },
  {
    slug: "data-analytics-case-study",
    title: "Data Analytics Case Study Simulation",
    kind: "simulation",
    description: "Work through a realistic analytics case using a public dataset: clean the data, answer business questions with SQL and spreadsheets, and present insights. Educational simulation run by SkillSpring.",
    responsibilities: ["Clean and document a dataset", "Answer five business questions", "Build three clear charts", "Write an insights summary"],
    skills: ["SQL", "Spreadsheets", "Data visualisation"],
    eligibility: "Open to all students. Introduction to Data Analytics recommended.",
    location: "Online", workMode: "remote", durationWeeks: 4, deadlineInDays: 60, positions: null,
  },
  {
    slug: "financial-modelling-project",
    title: "Financial Modelling Capstone Project",
    kind: "project",
    description: "Build a three-statement model and DCF for a company of your choice using public information, with structured feedback. Educational capstone — not an employer internship.",
    responsibilities: ["Collect historical financials", "Build linked statements", "Run a DCF with sensitivities", "Document assumptions"],
    skills: ["Financial modelling", "Excel", "Valuation"],
    eligibility: "Students who have completed Financial Modelling with Excel or equivalent.",
    location: "Online", workMode: "remote", durationWeeks: 6, deadlineInDays: 75, positions: null,
  },
];

export function courseDurationMinutes(c: DemoCourse) {
  return c.modules.reduce((sum, mod) => sum + mod.lessons.reduce((s, l) => s + l.minutes, 0), 0);
}
