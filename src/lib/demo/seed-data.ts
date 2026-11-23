/**
 * Proofwork catalogue: the four programs.
 *
 * Single source of truth used by:
 *  - scripts/generate-seed.ts  → supabase/seed.sql
 *  - preview mode (when Supabase is not configured) for public pages
 *
 * Programs are seeded with `is_demo = true` ("Enrolment opens soon") because the
 * lesson videos have not been uploaded yet. When a program's content is ready, an
 * admin unticks "Demo" in Admin → Courses and it becomes purchasable.
 * Internships here are Proofwork-run projects, never presented as employer vacancies.
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
  { slug: "stock-market", name: "Stock Market", icon: "trending-up", description: "Trading, investing and equity research.", sort: 1 },
  { slug: "web-development", name: "Web Design & Development", icon: "code", description: "Design and build modern websites.", sort: 2 },
  { slug: "digital-marketing", name: "Digital Marketing", icon: "megaphone", description: "SEO, social media and paid ads.", sort: 3 },
  { slug: "excel", name: "Excel", icon: "table", description: "Excel for finance and business.", sort: 4 },
] as const;

const v = (title: string, minutes: number, preview = false): DemoLesson => ({ title, type: "video", minutes, preview });
const quiz = (title: string): DemoLesson => ({ title, type: "quiz", minutes: 10 });
const task = (title: string, minutes = 60): DemoLesson => ({ title, type: "assignment", minutes });
const pdf = (title: string, minutes = 10): DemoLesson => ({ title, type: "pdf", minutes });

const certificateFaq = { q: "Will I get a certificate?", a: "Yes. When you finish every mandatory lesson, submit the required assignments and pass the quizzes, you receive a Proofwork certificate with a unique ID that anyone can verify online." };
const accessFaq = { q: "How long can I access the program?", a: "Your access doesn't expire. Watch lessons at your own pace and come back to them whenever you need a refresher." };
const paymentFaq = { q: "How do I pay?", a: "Pay securely with UPI, debit or credit card, net banking or wallets through Razorpay. You get access as soon as your payment is confirmed." };
const refundFaq = { q: "Can I get a refund?", a: "Yes, within 7 days of purchase if you have completed less than 25% of the program. See our refund policy for the full conditions." };

export const demoCourses: DemoCourse[] = [
  {
    slug: "stock-market-program",
    title: "Stock Market Program",
    subtitle: "Understand how markets work, read charts, analyse companies and manage risk with discipline.",
    category: "stock-market",
    description:
      "A complete, practical introduction to the Indian stock market. You start with how NSE, BSE, brokers and demat accounts fit together, then learn to read price charts and indicators, analyse a company's financial statements, value a business and build a risk-managed portfolio. Every module ends with practice, and the program closes with a capstone where you build and defend your own mock portfolio.",
    outcomes: [
      "Explain how Indian exchanges, brokers, depositories and SEBI work together",
      "Read candlestick charts and identify trends, support and resistance",
      "Use moving averages, RSI and MACD as part of a disciplined checklist",
      "Analyse a company's P&L, balance sheet and cash flow statement",
      "Value a business with ratios and an introductory DCF",
      "Size positions, set stop-losses and avoid common behavioural mistakes",
    ],
    requirements: ["No prior finance knowledge needed", "A laptop or phone and an internet connection"],
    level: "beginner",
    language: "English",
    pricePaise: 399900,
    modules: [
      { title: "How the Indian stock market works", lessons: [v("Exchanges, SEBI and depositories", 14, true), v("How a trade happens: brokers, demat and settlement", 16), v("Order types: market, limit and stop-loss", 12), quiz("Market basics quiz")] },
      { title: "Reading price charts", lessons: [v("Candlesticks and timeframes", 15), v("Trends, support and resistance", 18), v("What volume tells you", 12), task("Annotate three real charts", 45)] },
      { title: "Technical indicators", lessons: [v("Moving averages", 14), v("RSI and MACD", 16), v("Building a trading checklist", 12), quiz("Indicators quiz")] },
      { title: "Fundamental analysis", lessons: [v("Reading the P&L, balance sheet and cash flow", 22), v("Key ratios: P/E, ROE and debt-to-equity", 18), v("Industry analysis and competitive moats", 15), pdf("Ratio analysis workbook")] },
      { title: "Valuation and research", lessons: [v("Relative valuation", 16), v("Introduction to DCF valuation", 20), task("Write a one-page stock research note", 90)] },
      { title: "Risk, psychology and portfolio building", lessons: [v("Position sizing and stop-losses", 14), v("Diversification and asset allocation", 13), v("Trading psychology and common mistakes", 12), task("Capstone: build and justify a mock portfolio", 120), quiz("Final assessment")] },
    ],
    faqs: [
      { q: "Is this program for complete beginners?", a: "Yes. We start from how the market works and build up step by step. Commerce, engineering and arts students all take it." },
      { q: "Will you give stock tips or trading calls?", a: "No. This is an education program. We teach you how to analyse markets and companies yourself. Nothing in the program is investment advice." },
      { q: "Do I need a demat account?", a: "No. You can complete the whole program, including the capstone, without opening a demat account. We explain how to open one if you decide to invest later." },
      { q: "How much time does it take?", a: "Most students finish in about 8 weeks at 4–5 hours a week. It's self-paced, so you can go faster or slower." },
      certificateFaq, accessFaq, paymentFaq, refundFaq,
    ],
  },
  {
    slug: "web-development-program",
    title: "Web Design & Development Program",
    subtitle: "Design in Figma, build with HTML, CSS, JavaScript and React, and launch your own portfolio website.",
    category: "web-development",
    description:
      "Go from zero to a live portfolio website. You learn how the web works, write clean HTML and CSS, design layouts in Figma, add interactivity with JavaScript, build components in React and deploy your projects to the internet. You build something in every module, so by the end you have a portfolio of real work to show recruiters and clients.",
    outcomes: [
      "Build responsive web pages with semantic HTML and modern CSS",
      "Create layouts with Flexbox and Grid that work on every screen size",
      "Design landing pages and app screens in Figma",
      "Write JavaScript that responds to users and fetches data from APIs",
      "Build reusable components with React and style them with Tailwind CSS",
      "Use Git and GitHub, and deploy websites on Vercel",
    ],
    requirements: ["No coding experience needed", "A laptop (Windows, Mac or Linux)"],
    level: "beginner",
    language: "English",
    pricePaise: 399900,
    modules: [
      { title: "How the web works", lessons: [v("How websites work", 12, true), v("Setting up VS Code and your tools", 14), quiz("Web basics quiz")] },
      { title: "HTML", lessons: [v("The structure of a web page", 16), v("Forms, tables and media", 18), v("Semantic HTML and accessibility", 14), task("Build your profile page", 60)] },
      { title: "CSS and responsive design", lessons: [v("Selectors, colours and the box model", 18), v("Typography and spacing", 14), v("Flexbox and Grid", 22), v("Responsive design for mobile", 16), quiz("CSS quiz")] },
      { title: "UI design with Figma", lessons: [v("UI design basics", 15), v("From wireframe to mockup in Figma", 20), task("Design a landing page", 90)] },
      { title: "JavaScript", lessons: [v("Variables, functions and logic", 22), v("The DOM and events", 20), v("Fetching data from APIs", 18), task("Build an interactive to-do app", 120)] },
      { title: "React and modern tools", lessons: [v("Components and props", 18), v("State and hooks", 20), v("Styling with Tailwind CSS", 15), quiz("React quiz")] },
      { title: "Ship it", lessons: [v("Git and GitHub", 16), v("Deploying on Vercel", 10), task("Capstone: launch your portfolio website", 180)] },
    ],
    faqs: [
      { q: "I've never coded before. Can I do this?", a: "Yes. The program assumes no coding experience. Each concept is shown on screen step by step, and you practise it straight away." },
      { q: "What will I have built by the end?", a: "A profile page, a designed landing page, an interactive to-do app and a live portfolio website, all on your own GitHub account." },
      { q: "Do I need a powerful laptop?", a: "No. Any laptop that can run a modern browser and VS Code is enough. All the tools we use are free." },
      { q: "Does it cover both design and development?", a: "Yes. You learn UI design basics in Figma, then build those designs with HTML, CSS, JavaScript and React." },
      { q: "How much time does it take?", a: "About 10 weeks at 5–6 hours a week. It's self-paced, so you can adjust it around college." },
      certificateFaq, accessFaq, paymentFaq, refundFaq,
    ],
  },
  {
    slug: "digital-marketing-program",
    title: "Digital Marketing Program",
    subtitle: "Plan campaigns, grow on social media, rank on Google and measure what works.",
    category: "digital-marketing",
    description:
      "Learn the skills brands hire for. You start with marketing funnels and customer personas, then learn SEO and content, social media and short-form video, Google and Meta ads, email and WhatsApp marketing, and analytics. You finish by building a complete campaign plan you can show in interviews or use for a real business.",
    outcomes: [
      "Map a customer journey and plan a full marketing funnel",
      "Do keyword research and optimise content to rank on Google",
      "Plan social media content and short-form videos that people engage with",
      "Set up and budget Google Ads and Meta Ads campaigns",
      "Use email, WhatsApp and automation to nurture customers",
      "Track results in Google Analytics 4 and report ROI",
    ],
    requirements: ["No prior marketing experience needed", "A laptop or phone and an internet connection"],
    level: "beginner",
    language: "English",
    pricePaise: 299900,
    modules: [
      { title: "Marketing foundations", lessons: [v("The digital marketing funnel", 12, true), v("Customer personas and journeys", 14), quiz("Foundations quiz")] },
      { title: "SEO and content", lessons: [v("How search engines rank pages", 14), v("Keyword research", 16), v("On-page SEO and content writing", 18), task("Optimise a blog post", 60)] },
      { title: "Social media marketing", lessons: [v("Choosing platforms: Instagram, LinkedIn, YouTube", 14), v("Content pillars and calendars", 12), v("Short-form video and reels", 16), task("Create a 30-day content calendar", 90)] },
      { title: "Performance marketing", lessons: [v("Google Ads basics", 20), v("Meta Ads basics", 20), v("Budgets, bidding and targeting", 15), quiz("Ads quiz")] },
      { title: "Email, WhatsApp and automation", lessons: [v("Email marketing and newsletters", 15), v("WhatsApp marketing and automation tools", 14)] },
      { title: "Analytics and growth", lessons: [v("Google Analytics 4 basics", 18), v("Measuring ROI and KPIs", 14), task("Capstone: plan a complete campaign", 150), quiz("Final assessment")] },
    ],
    faqs: [
      { q: "Do I need to spend money on ads to complete the program?", a: "No. We show you how ad platforms work using their own tools and demo accounts. You don't need to run paid campaigns to finish." },
      { q: "Is this useful for freelancing or my own business?", a: "Yes. The capstone is a complete campaign plan you can adapt for a real business or show to freelance clients." },
      { q: "Which tools will I learn?", a: "Google Search Console, Google Ads, Meta Ads Manager, Google Analytics 4, Canva and common email and automation tools." },
      { q: "How much time does it take?", a: "About 6 weeks at 4–5 hours a week, at your own pace." },
      certificateFaq, accessFaq, paymentFaq, refundFaq,
    ],
  },
  {
    slug: "excel-program",
    title: "Excel for Finance & Business",
    subtitle: "Formulas, pivot tables, financial functions and dashboards, the Excel skills employers test for.",
    category: "excel",
    description:
      "Become the person in the team who's fast and accurate in Excel. You learn the formulas that matter, including XLOOKUP and dynamic arrays, analyse data with pivot tables, use financial functions like NPV, IRR and PMT, and build clean MIS dashboards. Every lesson uses business and finance examples, with practice workbooks to download.",
    outcomes: [
      "Work quickly with tables, formatting and keyboard shortcuts",
      "Use IF, XLOOKUP, text and date functions confidently",
      "Analyse data with pivot tables and dynamic arrays",
      "Apply NPV, IRR and PMT and build an EMI calculator",
      "Build an MIS dashboard with charts that communicate clearly",
      "Automate repetitive work with Power Query and basic macros",
    ],
    requirements: ["Basic computer skills", "Microsoft Excel 2021 or Microsoft 365 (recommended)"],
    level: "beginner",
    language: "English",
    pricePaise: 199900,
    modules: [
      { title: "Excel foundations", lessons: [v("Navigating Excel like a pro", 12, true), v("Formatting, tables and shortcuts", 14), quiz("Foundations quiz")] },
      { title: "Essential formulas", lessons: [v("Logical functions: IF, AND and OR", 14), v("Lookups that don't break: XLOOKUP", 4, true), v("Text and date functions", 15), task("Clean a messy dataset", 45)] },
      { title: "Data analysis", lessons: [v("Sorting, filtering and data validation", 12), v("Pivot tables", 20), v("Dynamic arrays: FILTER, SORT and UNIQUE", 15), quiz("Data analysis quiz")] },
      { title: "Finance in Excel", lessons: [v("NPV, IRR and PMT", 18), v("Building a loan and EMI calculator", 16), v("Budget vs actual analysis", 14), pdf("Financial functions workbook")] },
      { title: "Dashboards and reporting", lessons: [v("Charts that communicate", 15), v("Building an MIS dashboard", 22), task("Build a monthly sales dashboard", 90)] },
      { title: "Productivity and automation", lessons: [v("Power Query basics", 18), v("Introduction to macros", 14), quiz("Final assessment")] },
    ],
    faqs: [
      { q: "Which version of Excel do I need?", a: "Excel 2021 or Microsoft 365 is recommended because some lessons use XLOOKUP and dynamic arrays. Most other lessons also work in Excel 2016 and 2019." },
      { q: "Is this only for commerce and finance students?", a: "No. The examples are from finance and business, but the skills apply to any role that works with data, including operations, sales and HR." },
      { q: "Do I get practice files?", a: "Yes. Most lessons come with a downloadable workbook so you can practise as you watch." },
      { q: "How much time does it take?", a: "About 4 weeks at 3–4 hours a week, at your own pace." },
      certificateFaq, accessFaq, paymentFaq, refundFaq,
    ],
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

/** Proofwork-run educational experiences. Clearly NOT employer vacancies. */
export const demoInternships: DemoInternship[] = [
  {
    slug: "stock-market-research-simulation",
    title: "Stock Market Research Simulation",
    kind: "simulation",
    description: "Work like an equity research analyst for four weeks: pick a listed company, study its filings and price history, and publish a research note with a clear view. Run by Proofwork for learning purposes. This is not a job or an employer internship.",
    responsibilities: ["Study an annual report and recent filings", "Analyse price charts and key ratios", "Write a one-page research note", "Present your thesis in a short recorded pitch"],
    skills: ["Financial statements", "Technical analysis", "Report writing"],
    eligibility: "Open to all students. The Stock Market Program is recommended.",
    location: "Online", workMode: "remote", durationWeeks: 4, deadlineInDays: 45, positions: null,
  },
  {
    slug: "website-development-project",
    title: "Website Development Project",
    kind: "project",
    description: "Design and build a responsive website for a fictional small business from a real-style client brief, then deploy it live. Mentor feedback on submission. Educational project, not an employer placement.",
    responsibilities: ["Turn a client brief into a Figma mockup", "Build the site with HTML, CSS and JavaScript or React", "Make it responsive and accessible", "Deploy it and share the live link"],
    skills: ["HTML & CSS", "JavaScript", "Figma"],
    eligibility: "Open to all students. The Web Design & Development Program is recommended.",
    location: "Online", workMode: "remote", durationWeeks: 4, deadlineInDays: 60, positions: null,
  },
  {
    slug: "digital-marketing-campaign-project",
    title: "Digital Marketing Campaign Project",
    kind: "project",
    description: "Plan a complete digital campaign for a fictional brand brief: audience research, channel mix, content calendar, budget and KPI dashboard. Educational project, not an employer placement.",
    responsibilities: ["Research the target audience", "Design a channel mix and budget", "Create a 4-week content calendar", "Define KPIs and a reporting template"],
    skills: ["Digital marketing", "Content planning", "Analytics"],
    eligibility: "Open to all students. The Digital Marketing Program is recommended.",
    location: "Online", workMode: "remote", durationWeeks: 3, deadlineInDays: 30, positions: null,
  },
  {
    slug: "excel-mis-dashboard-project",
    title: "Excel MIS Dashboard Project",
    kind: "project",
    description: "Turn a raw sales dataset into a clean monthly MIS report and dashboard, the way finance teams do every month. Educational project run by Proofwork.",
    responsibilities: ["Clean and structure the raw data", "Summarise it with pivot tables", "Build a one-page dashboard", "Write three insights for management"],
    skills: ["Excel", "Pivot tables", "Data visualisation"],
    eligibility: "Open to all students. The Excel for Finance & Business program is recommended.",
    location: "Online", workMode: "remote", durationWeeks: 2, deadlineInDays: 40, positions: null,
  },
];

export function courseDurationMinutes(c: DemoCourse) {
  return c.modules.reduce((sum, mod) => sum + mod.lessons.reduce((s, l) => s + l.minutes, 0), 0);
}
