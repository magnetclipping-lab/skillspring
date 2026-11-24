"""Workbook datasets for the 'file' (XLSX) assignment of each course.

Each builder returns a dict:
  sheets: {sheet_name: (headers, rows)}
  tasks:  list of task strings (shown on the Brief sheet)
  answers: list of answer labels (the Answers sheet has one input cell per label)
  key:    {label: expected value or guidance} — private, used by the evaluator
Data is generated with a seeded RNG so builds are reproducible.
"""
import random
from collections import defaultdict
from datetime import date, timedelta


def _rng(slug):
    return random.Random("proofwork:" + slug)


def r2(x):
    return round(x, 2)


# ---------------------------------------------------------------- AI & automation
def feedback(slug):
    rng = _rng(slug)
    channels = ["Email", "App review", "Chat", "Survey"]
    themes = [("delivery was late again", 2), ("love the new dashboard", 5), ("billing page is confusing", 2),
              ("support resolved my issue fast", 5), ("app crashes on login", 1), ("pricing is fair", 4),
              ("export to excel would help", 3), ("onboarding took too long", 2), ("great value", 5), ("search is slow", 3)]
    rows = []
    for i in range(1, 81):
        t, base = rng.choice(themes)
        rating = max(1, min(5, base + rng.choice([-1, 0, 0, 1])))
        text = t if rng.random() > .3 else ("  " + t.upper() + "!!  ")
        ch = rng.choice(channels)
        rows.append([f"FB-{i:03d}", (date(2026, 7, 1) + timedelta(days=rng.randint(0, 90))).isoformat(),
                     ch if rng.random() > .15 else ch.lower(), rating, text])
    avg = sum(r[3] for r in rows) / len(rows)
    by_ch = defaultdict(list)
    for r in rows:
        by_ch[r[2].strip().title() if r[2].lower() != "app review" else "App review"].append(r[3])
    return {
        "sheets": {"Feedback": (["ID", "Date", "Channel", "Rating (1-5)", "Comment"], rows)},
        "tasks": ["Clean the Channel and Comment columns (consistent case, trimmed spaces) in a new 'Clean' sheet.",
                  "Use Claude to tag each comment with a theme and a sentiment (Positive/Neutral/Negative). Keep the tags in columns.",
                  "Calculate the average rating overall and by channel with formulas.",
                  "Write a 5-bullet summary of the main issues on a 'Summary' sheet.",
                  "On a 'Prompts & checks' sheet, paste the prompts you used and list how you checked Claude's tagging (e.g. spot-check 10 rows)."],
        "answers": ["Average rating (all)", "Lowest-rated channel", "Number of Negative comments", "Top issue theme"],
        "key": {"Average rating (all)": r2(avg),
                "Lowest-rated channel": min(by_ch, key=lambda k: sum(by_ch[k]) / len(by_ch[k])),
                "Number of Negative comments": "≈ count of ratings 1–2 (" + str(sum(1 for r in rows if r[3] <= 2)) + "); accept tagging within ±5",
                "Top issue theme": "Any of: late delivery, app crashes, billing confusion, slow onboarding — must match the student's own tagging"},
    }


def time_audit(slug):
    rng = _rng(slug)
    tasks = ["Reply to routine client emails", "Prepare weekly status report", "Data entry from invoices", "Schedule meetings",
             "Write meeting notes", "Update CRM after calls", "Research competitors", "Proofread documents", "Create social posts",
             "Reconcile expenses", "Answer internal FAQs", "Strategy planning", "Team one-on-ones", "Client negotiation", "Format slide decks"]
    rows = []
    for t in tasks:
        rows.append([t, rng.choice(["Communication", "Reporting", "Admin", "Analysis", "People"]), r2(rng.uniform(.5, 6)),
                     rng.randint(1, 5), rng.randint(1, 5), rng.randint(1, 5)])
    for r in rows:  # make judgement-heavy tasks low on rules
        if r[0] in ("Strategy planning", "Team one-on-ones", "Client negotiation"):
            r[4] = 1
    score = lambda r: r[2] * (r[3] + r[4]) / 2 * (6 - r[5]) / 5
    top = sorted(rows, key=score, reverse=True)[:5]
    return {
        "sheets": {"Time audit": (["Task", "Category", "Hours per week", "Repetitive (1-5)", "Rule-based (1-5)", "Cost of error (1-5)"], rows)},
        "tasks": ["Add an 'Automation score' column = Hours × AVERAGE(Repetitive, Rule-based) × (6 − Cost of error) / 5, using formulas.",
                  "Add a 'Decision' column: Automate if score ≥ 6, Draft with AI if score ≥ 3, otherwise Keep human (use IFS or nested IF).",
                  "Sort or use SORTBY/TAKE to list the top-5 tasks by score on the Answers sheet.",
                  "Total the weekly hours in the 'Automate' group."],
        "answers": ["Top task by score", "Hours/week in Automate group", "Number of tasks to keep human"],
        "key": {"Top task by score": top[0][0],
                "Hours/week in Automate group": r2(sum(r[2] for r in rows if score(r) >= 6)),
                "Number of tasks to keep human": sum(1 for r in rows if score(r) < 3),
                "Top 5": [t[0] for t in top]},
    }


def agent_eval(slug):
    rng = _rng(slug)
    cats = ["Wrong tool", "Hallucinated fact", "Incomplete", "Formatting", "Timeout"]
    rows = []
    for i in range(1, 21):
        ok = rng.random() < .65
        rows.append([f"RUN-{i:02d}", rng.choice(["Research brief", "Lead qualification", "Invoice triage"]),
                     "Pass" if ok else "Fail", "" if ok else rng.choice(cats), rng.randint(3, 40), r2(rng.uniform(.02, .4))])
    fails = [r for r in rows if r[2] == "Fail"]
    fc = defaultdict(int)
    for r in fails:
        fc[r[3]] += 1
    return {
        "sheets": {"Agent runs": (["Run ID", "Task type", "Outcome", "Failure category", "Steps taken", "Cost (USD)"], rows)},
        "tasks": ["Calculate the overall pass rate with COUNTIF.", "Calculate pass rate by task type.",
                  "Build a PivotTable (or COUNTIFS table) of failures by category.", "Calculate average cost per passed run.",
                  "Write two recommendations based on the most common failure categories."],
        "answers": ["Overall pass rate (%)", "Most common failure category", "Average cost per passed run (USD)"],
        "key": {"Overall pass rate (%)": r2(100 * (20 - len(fails)) / 20),
                "Most common failure category": max(fc, key=fc.get) if fc else "n/a",
                "Average cost per passed run (USD)": r2(sum(r[5] for r in rows if r[2] == "Pass") / max(1, 20 - len(fails)))},
    }


def usecases(slug):
    rng = _rng(slug)
    names = ["Meeting summaries", "First-draft proposals", "Contract clause search", "Customer email replies", "Job description drafts",
             "Sales call prep", "Data cleaning", "Report narratives", "Social captions", "Internal FAQ bot", "Translation",
             "Survey analysis", "Training quizzes", "Code snippets for reports", "Competitor monitoring"]
    rows = [[n, rng.randint(1, 5), rng.randint(1, 5), rng.randint(1, 5)] for n in names]
    score = lambda r: r[1] * 2 - r[2] - r[3]
    ranked = sorted(rows, key=score, reverse=True)
    return {
        "sheets": {"Use cases": (["Use case", "Value (1-5)", "Effort (1-5)", "Risk (1-5)"], rows)},
        "tasks": ["Add a 'Priority score' column = 2 × Value − Effort − Risk.", "Rank the use cases with RANK or SORT.",
                  "Create a scatter or bubble chart of Value vs Effort.", "List your top 3 pilots on the Answers sheet with one line each on why."],
        "answers": ["Top-ranked use case", "Priority score of top use case", "Number with score ≤ 0"],
        "key": {"Top-ranked use case": ranked[0][0] + " (ties acceptable: " + ", ".join(r[0] for r in ranked if score(r) == score(ranked[0])) + ")",
                "Priority score of top use case": score(ranked[0]),
                "Number with score ≤ 0": sum(1 for r in rows if score(r) <= 0)},
    }


def roi(slug):
    inputs = [["Invoices per month", 1800], ["Minutes per invoice (manual)", 6], ["Minutes per invoice (automated, incl. review)", 1.5],
              ["Fully-loaded cost per hour (₹)", 450], ["Exception rate (needs manual handling)", 0.12],
              ["Automation tool cost per month (₹)", 18000], ["One-time implementation cost (₹)", 150000]]
    v = {k: x for k, x in inputs}
    manual = v["Invoices per month"] * v["Minutes per invoice (manual)"] / 60 * v["Fully-loaded cost per hour (₹)"]
    auto_min = v["Invoices per month"] * ((1 - v["Exception rate (needs manual handling)"]) * v["Minutes per invoice (automated, incl. review)"]
                                         + v["Exception rate (needs manual handling)"] * v["Minutes per invoice (manual)"])
    auto = auto_min / 60 * v["Fully-loaded cost per hour (₹)"] + v["Automation tool cost per month (₹)"]
    saving = manual - auto
    return {
        "sheets": {"Inputs": (["Assumption", "Value"], inputs)},
        "tasks": ["Calculate monthly manual processing cost.", "Calculate monthly automated cost (including exceptions handled manually and the tool cost).",
                  "Calculate monthly saving and payback period in months.", "Calculate three-year net value (36 × saving − implementation).",
                  "Add a sensitivity table showing payback if the exception rate is 5%, 12%, 20% and 30%."],
        "answers": ["Monthly manual cost (₹)", "Monthly automated cost (₹)", "Monthly saving (₹)", "Payback (months)", "Three-year net value (₹)"],
        "key": {"Monthly manual cost (₹)": r2(manual), "Monthly automated cost (₹)": r2(auto), "Monthly saving (₹)": r2(saving),
                "Payback (months)": r2(v["One-time implementation cost (₹)"] / saving), "Three-year net value (₹)": r2(36 * saving - v["One-time implementation cost (₹)"])},
    }


def benchmark(slug):
    tasks = ["Summarise a 20-page PDF", "Draft a cold email", "Clean a messy table", "Explain a formula", "Brainstorm 10 campaign ideas",
             "Answer a current-events question", "Describe an uploaded image", "Write a Python snippet"]
    rows = [[t, "", "", ""] for t in tasks]
    return {
        "sheets": {"Benchmark": (["Task", "ChatGPT score (1-5)", "Claude score (1-5)", "Gemini score (1-5)"], rows),
                   "Rubric": (["Score", "Meaning"], [[5, "Correct, complete, ready to use"], [4, "Minor edits needed"], [3, "Useful but notable gaps"], [2, "Major errors"], [1, "Unusable"]])},
        "tasks": ["Run each task on all three assistants with an identical prompt; paste prompts in a 'Prompts' sheet.",
                  "Score each output with the rubric.", "Calculate each assistant's average with formulas.",
                  "Highlight the best tool per task with conditional formatting.", "Write your recommendation for a team of analysts."],
        "answers": ["Highest-average assistant", "Best tool for long documents", "Best tool for current events"],
        "key": {"Note": "Scores are the student's own; grade consistency between scores, evidence (prompts/notes) and recommendation. Formulas must compute averages."},
    }


def market_size(slug):
    inputs = [["Target country population (crore)", 142], ["Share in target segment (e.g. urban working adults)", 0.18],
              ["Share with the problem", 0.35], ["Share reachable with your channels", 0.25], ["Realistic share you can win in 3 years", 0.03],
              ["Annual price per customer (₹)", 2400]]
    v = [x[1] for x in inputs]
    tam_c = v[0] * 1e7 * v[1] * v[2]
    sam_c = tam_c * v[3]
    som_c = sam_c * v[4]
    return {
        "sheets": {"Inputs": (["Assumption (replace with your own, cited)", "Example value"], inputs)},
        "tasks": ["Replace the example assumptions with your own for your idea and cite a source for each in a 'Sources' column.",
                  "Calculate TAM, SAM and SOM in customers and in ₹ per year.", "Add a bottom-up check: customers you can realistically reach per month × conversion × 36 months.",
                  "Explain any gap between top-down SOM and bottom-up estimate."],
        "answers": ["TAM (₹ per year)", "SAM (₹ per year)", "SOM (₹ per year)", "Bottom-up 3-year customers"],
        "key": {"Example values (if unchanged)": {"TAM ₹": r2(tam_c * v[5]), "SAM ₹": r2(sam_c * v[5]), "SOM ₹": r2(som_c * v[5])},
                "Note": "Students are expected to replace assumptions; grade logic, formulas and sourcing, not the specific numbers."},
    }


# ---------------------------------------------------------------- Marketing
def campaign(slug):
    rng = _rng(slug)
    channels = {"Google Search": (0.045, 18, 0.06), "Meta Feed": (0.012, 7, 0.018), "Instagram Reels": (0.009, 5, 0.012),
                "YouTube": (0.006, 9, 0.01), "Email": (0.03, 0.4, 0.05)}
    rows = []
    for wk in range(1, 5):
        for ch, (ctr, cpc, cvr) in channels.items():
            imp = rng.randint(20000, 120000) if ch != "Email" else rng.randint(8000, 12000)
            clicks = int(imp * ctr * rng.uniform(.8, 1.2))
            cost = r2(clicks * cpc * rng.uniform(.85, 1.15))
            conv = int(clicks * cvr * rng.uniform(.7, 1.3))
            rows.append([f"Week {wk}", ch, imp, clicks, cost, conv, conv * 1450])
    agg = defaultdict(lambda: [0, 0, 0, 0])
    for r in rows:
        a = agg[r[1]]; a[0] += r[2]; a[1] += r[3]; a[2] += r[4]; a[3] += r[5]
    cpa = {k: a[2] / a[3] for k, a in agg.items() if a[3]}
    return {
        "sheets": {"Campaign data": (["Week", "Channel", "Impressions", "Clicks", "Cost (₹)", "Conversions", "Revenue (₹)"], rows)},
        "tasks": ["Build a channel summary (SUMIFS) with impressions, clicks, cost, conversions and revenue.",
                  "Calculate CTR, CPC, conversion rate, CPA and ROAS per channel.", "Chart CPA by channel.",
                  "Recommend how to reallocate next month's budget and justify it with the numbers."],
        "answers": ["Total spend (₹)", "Overall CPA (₹)", "Lowest-CPA channel", "Highest-CPA channel"],
        "key": {"Total spend (₹)": r2(sum(r[4] for r in rows)), "Overall CPA (₹)": r2(sum(r[4] for r in rows) / sum(r[5] for r in rows)),
                "Lowest-CPA channel": min(cpa, key=cpa.get), "Highest-CPA channel": max(cpa, key=cpa.get),
                "CPA by channel": {k: r2(v) for k, v in cpa.items()}},
    }


def ab_variants(slug):
    rng = _rng(slug)
    rows = []
    for i in range(1, 13):
        imp = rng.randint(18000, 26000)
        clicks = int(imp * rng.uniform(.008, .022))
        conv = int(clicks * rng.uniform(.02, .07))
        rows.append([f"V{i:02d}", rng.choice(["Benefit-led", "Question hook", "Social proof", "Offer-led"]), imp, clicks, conv])
    best = max(rows, key=lambda r: r[4] / r[3])
    return {
        "sheets": {"Variants": (["Variant", "Angle", "Impressions", "Clicks", "Conversions"], rows)},
        "tasks": ["Calculate CTR and conversion rate (conversions ÷ clicks) per variant.", "Compare each variant with V01 (control) using a two-proportion z-test on conversion rate; show the z-score and whether |z| ≥ 1.96.",
                  "Summarise performance by creative angle with AVERAGEIFS.", "State which variants you would scale, pause or retest."],
        "answers": ["Highest conversion-rate variant", "Its conversion rate (%)", "Best-performing angle", "Variants significantly better than V01"],
        "key": {"Highest conversion-rate variant": best[0], "Its conversion rate (%)": r2(100 * best[4] / best[3]),
                "Note": "Check z-test formula: p_pool = (c1+c2)/(n1+n2); z = (p2−p1)/sqrt(p_pool(1−p_pool)(1/n1+1/n2)). Small samples mean few or no significant winners — reward correct caution."},
    }


def breakeven_roas(slug):
    rows = [["Cotton kurta", 1499, 520, 90, 0.02, 0.12], ["Leather wallet", 899, 260, 60, 0.02, 0.05], ["Skincare kit", 1999, 640, 70, 0.02, 0.04]]
    out = {}
    for name, price, cogs, ship, fee, ret in rows:
        margin = (price * (1 - ret) - cogs - ship - price * fee) / price
        out[name] = {"Contribution margin %": r2(100 * margin), "Break-even ROAS": r2(1 / margin)}
    return {
        "sheets": {"Products": (["Product", "Price (₹)", "Product cost (₹)", "Shipping (₹)", "Payment fee (% of price)", "Return rate"], rows),
                   "Targets": (["Setting", "Value"], [["Target profit margin after ads", 0.10], ["Daily orders goal", 40]])},
        "tasks": ["Calculate contribution per order after returns, shipping and payment fees.", "Calculate contribution margin % and break-even ROAS (1 ÷ margin) per product.",
                  "Calculate target ROAS to keep a 10% profit margin after ads, and the maximum CAC per order.", "Recommend daily budgets per product to hit the daily orders goal at target CAC."],
        "answers": ["Break-even ROAS — Cotton kurta", "Break-even ROAS — Leather wallet", "Break-even ROAS — Skincare kit"],
        "key": {**{f"Break-even ROAS — {k}": v["Break-even ROAS"] for k, v in out.items()}, "Detail": out,
                "Formula": "margin = (price×(1−return rate) − cost − shipping − price×fee) ÷ price"},
    }


def keywords(slug):
    rng = _rng(slug)
    heads = {"running shoes": "Commercial", "how to start running": "Informational", "marathon training plan": "Informational",
             "buy running shoes online": "Transactional", "best running watch": "Commercial", "running shoes for flat feet": "Commercial",
             "couch to 5k": "Informational", "running shoe size guide": "Informational", "nike vs asics": "Commercial", "trail running gear": "Commercial"}
    mods = ["", " india", " for beginners", " under 5000", " women", " men", " 2026", " review", " near me", " tips", " guide", " price", " best", " cheap", " online"]
    rows, seen = [], set()
    while len(rows) < 150:
        h = rng.choice(list(heads)); m = rng.choice(mods); kw = (h + m).strip()
        if kw in seen:
            continue
        seen.add(kw)
        rows.append([kw, rng.choice([90, 140, 260, 480, 880, 1600, 2900, 5400]), rng.randint(5, 70)])
    return {
        "sheets": {"Keywords": (["Keyword", "Monthly searches (India)", "Difficulty (0-100)"], rows)},
        "tasks": ["Add an Intent column (Informational, Commercial, Transactional, Navigational).", "Add a Topic cluster column and group keywords into 8–12 clusters.",
                  "Assign each cluster to one target URL (existing or new page).", "Score opportunity = searches × (100 − difficulty) / 100 and rank clusters by total opportunity.",
                  "List your top three pages to create first."],
        "answers": ["Number of clusters", "Highest-opportunity cluster", "First page to create"],
        "key": {"Expected intent for head terms": heads, "Note": "Grade clustering coherence (one intent per page, no cannibalisation) and correct opportunity formula."},
    }


def social_posts(slug, n=60, name="Posts"):
    rng = _rng(slug)
    pillars = ["Behind the scenes", "Education", "Customer stories", "Product", "Community"]
    formats = ["Reel", "Carousel", "Static", "Story"]
    rows = []
    for i in range(n):
        p, f = rng.choice(pillars), rng.choice(formats)
        reach = int(rng.uniform(800, 9000) * (1.6 if f == "Reel" else 1) * (1.3 if p == "Education" else 1))
        eng = int(reach * rng.uniform(.02, .08) * (1.4 if f == "Carousel" else 1))
        rows.append([(date(2026, 8, 1) + timedelta(days=i)).isoformat(), p, f, rng.choice(["Question", "Bold claim", "Number", "Story"]), reach, eng])
    rate = lambda key: {k: r2(100 * sum(r[5] for r in rows if r[key] == k) / sum(r[4] for r in rows if r[key] == k)) for k in set(r[key] for r in rows)}
    pr, fr = rate(1), rate(2)
    return {
        "sheets": {name: (["Date", "Pillar", "Format", "Hook type", "Reach", "Engagements"], rows)},
        "tasks": ["Calculate engagement rate (engagements ÷ reach) per post.", "Summarise average reach and engagement rate by pillar, format and hook type (AVERAGEIFS or PivotTable).",
                  "Chart engagement rate by format.", "Recommend the next month's content mix with percentages."],
        "answers": ["Overall engagement rate (%)", "Best pillar by engagement rate", "Best format by engagement rate"],
        "key": {"Overall engagement rate (%)": r2(100 * sum(r[5] for r in rows) / sum(r[4] for r in rows)),
                "Best pillar by engagement rate": max(pr, key=pr.get), "Best format by engagement rate": max(fr, key=fr.get),
                "By pillar": pr, "By format": fr},
    }


def cohorts(slug):
    rng = _rng(slug)
    rows, oid = [], 1
    months = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"]
    for mi, m in enumerate(months):
        for c in range(rng.randint(45, 70)):
            cust = f"C{mi}{c:03d}"
            active = True
            for k in range(mi, len(months)):
                if k > mi and (not active or rng.random() > (.55 if k == mi + 1 else .75)):
                    active = False
                    continue
                rows.append([f"O{oid:05d}", cust, m, months[k], rng.choice([499, 699, 899])]); oid += 1
    first = {}
    for r in rows:
        first.setdefault(r[1], r[2])
    size = defaultdict(set); m1 = defaultdict(set)
    for r in rows:
        size[r[2]].add(r[1])
        if months.index(r[3]) == months.index(r[2]) + 1:
            m1[r[2]].add(r[1])
    ret = {m: r2(100 * len(m1[m]) / len(size[m])) for m in months[:-1]}
    return {
        "sheets": {"Orders": (["Order ID", "Customer ID", "Signup month", "Order month", "Order value (₹)"], rows)},
        "tasks": ["Count customers in each signup cohort.", "Build a cohort table: % of each cohort ordering in month 0, 1, 2… after signup (COUNTIFS on unique customers or a PivotTable with distinct count).",
                  "Chart month-1 retention by cohort.", "Identify where retention breaks and propose two experiments."],
        "answers": ["Size of 2026-01 cohort", "Month-1 retention of 2026-01 cohort (%)", "Average month-1 retention (%)"],
        "key": {"Size of 2026-01 cohort": len(size["2026-01"]), "Month-1 retention of 2026-01 cohort (%)": ret["2026-01"],
                "Average month-1 retention (%)": r2(sum(ret.values()) / len(ret)), "Month-1 retention by cohort": ret},
    }


def funnel_ab(slug):
    steps = [["Product page view", 48200], ["Add to cart", 9640], ["Begin checkout", 5310], ["Payment details", 3720], ["Purchase", 2905]]
    test = [["A (control)", 6120, 337], ["B (one-page checkout)", 6085, 389]]
    import math
    p1, p2 = 337 / 6120, 389 / 6085
    pp = (337 + 389) / (6120 + 6085)
    z = (p2 - p1) / math.sqrt(pp * (1 - pp) * (1 / 6120 + 1 / 6085))
    return {
        "sheets": {"Funnel": (["Step", "Users"], steps), "Checkout test": (["Variant", "Visitors", "Purchases"], test)},
        "tasks": ["Calculate step-to-step conversion and drop-off for the funnel.", "Identify the biggest drop-off step.",
                  "Calculate conversion rate for A and B, relative lift, and the z-score of a two-proportion test.", "Recommend whether to ship B."],
        "answers": ["Overall view-to-purchase rate (%)", "Biggest drop-off step", "Relative lift of B (%)", "z-score", "Ship B? (Yes/No + reason)"],
        "key": {"Overall view-to-purchase rate (%)": r2(100 * 2905 / 48200), "Biggest drop-off step": "Product page view → Add to cart (80% drop)",
                "Relative lift of B (%)": r2(100 * (p2 - p1) / p1), "z-score": r2(z), "Ship B? (Yes/No + reason)": "Yes — |z| ≈ " + str(r2(z)) + " > 1.96 (significant at 95%)"},
    }


# ---------------------------------------------------------------- Professional
def sales_ops(slug):
    rng = _rng(slug)
    products = [("P-101", "Desk lamp", 1299), ("P-102", "Office chair", 7499), ("P-103", "Monitor stand", 1899), ("P-104", "Keyboard", 2499),
                ("P-105", "Webcam", 3299), ("P-106", "Headset", 2799)]
    regions = ["North", "South", "East", "West"]
    orders = []
    for i in range(1, 241):
        p = rng.choice(products)
        orders.append([f"SO-{i:04d}", (date(2026, 1, 1) + timedelta(days=rng.randint(0, 180))).isoformat(), rng.choice(regions), p[0], rng.randint(1, 12)])
    price = {p[0]: p[2] for p in products}
    rev = defaultdict(float)
    for o in orders:
        rev[o[2]] += price[o[3]] * o[4]
    total = sum(rev.values())
    return {
        "sheets": {"Orders": (["Order ID", "Date", "Region", "Product code", "Quantity"], orders),
                   "Price list": (["Product code", "Product", "Unit price (₹)"], [list(p) for p in products])},
        "tasks": ["Convert both ranges to Excel Tables.", "Add Product and Unit price to Orders with XLOOKUP; add Revenue = Quantity × Unit price.",
                  "Create a FILTER-based report on a new sheet showing West region orders above ₹20,000.", "Build a PivotTable of revenue by Region and Month.",
                  "Build a scenario table: total revenue if prices rise 0%, 5% and 10%."],
        "answers": ["Total revenue (₹)", "Top region by revenue", "Revenue at +5% prices (₹)"],
        "key": {"Total revenue (₹)": r2(total), "Top region by revenue": max(rev, key=rev.get), "Revenue at +5% prices (₹)": r2(total * 1.05),
                "Revenue by region": {k: r2(v) for k, v in rev.items()}, "Note": "Formulas must be live (XLOOKUP/FILTER), not pasted values."},
    }


def regions(slug):
    rng = _rng(slug)
    sheets, totals = {}, {}
    for reg in ["North", "South", "West"]:
        rows = [[(date(2026, 9, 1) + timedelta(days=d)).isoformat(), rng.choice(["Retail", "Online", "Wholesale"]), rng.randint(5000, 60000)] for d in range(30)]
        sheets[reg] = (["Date", "Channel", "Sales (₹)"], rows)
        totals[reg] = sum(r[2] for r in rows)
    return {
        "sheets": sheets,
        "tasks": ["Write a macro or Office Script that combines the three regional sheets into one 'Combined' sheet with a Region column.",
                  "The automation must find the last row dynamically and must not touch any other sheet.", "Add a 'Report' sheet with totals by region and channel, formatted as a table.",
                  "Paste your code into a 'Code' sheet (or submit it as a .txt/.bas file) with comments."],
        "answers": ["Combined row count", "Total sales all regions (₹)", "Top region"],
        "key": {"Combined row count": 90, "Total sales all regions (₹)": sum(totals.values()), "Top region": max(totals, key=totals.get), "By region": totals},
    }


def flat_sales(slug):
    rng = _rng(slug)
    cust = [(f"CU{i:03d}", rng.choice(["Mumbai", "Pune", "Delhi", "Bengaluru"]), rng.choice(["Retail", "Corporate"])) for i in range(1, 31)]
    prod = [("SKU1", "Notebook", "Stationery", 120), ("SKU2", "Pen set", "Stationery", 250), ("SKU3", "Backpack", "Bags", 1800), ("SKU4", "Laptop sleeve", "Bags", 950), ("SKU5", "Desk organiser", "Office", 650)]
    rows = []
    for i in range(1, 201):
        c, p = rng.choice(cust), rng.choice(prod)
        q = rng.randint(1, 20)
        rows.append([f"INV{i:04d}", (date(2025, 4, 1) + timedelta(days=rng.randint(0, 540))).isoformat(), c[0], c[1], c[2], p[0], p[1], p[2], q, p[3], q * p[3]])
    return {
        "sheets": {"Sales extract": (["Invoice", "Date", "Customer ID", "City", "Segment", "SKU", "Product", "Category", "Qty", "Unit price", "Amount"], rows)},
        "tasks": ["Design a star schema: list the fact table and each dimension table with their columns and keys on a 'Model design' sheet.",
                  "Create the dimension tables (Customer, Product, Date) as separate sheets with unique keys (use UNIQUE).", "Create the fact table with only keys and measures.",
                  "Document each relationship (from, to, cardinality, direction).", "Explain which DAX measures you would create first."],
        "answers": ["Number of customers", "Number of products", "Fact table columns"],
        "key": {"Number of customers": len(set(r[2] for r in rows)), "Number of products": len(set(r[5] for r in rows)),
                "Fact table columns": "Invoice, Date key, Customer ID, SKU, Qty, Unit price, Amount (city/segment/product/category belong in dimensions)",
                "Relationships": "Dim → Fact one-to-many, single direction"},
    }


def three_statement(slug):
    hist = [["Revenue", 1200, 1380], ["COGS", 720, 820], ["Operating expenses", 300, 335], ["Depreciation", 40, 45], ["Interest", 18, 16],
            ["Cash", 90, 110], ["Receivables", 150, 170], ["Inventory", 180, 200], ["Net fixed assets", 400, 430], ["Payables", 120, 135],
            ["Debt", 200, 180], ["Equity", 500, 595]]
    drivers = [["Revenue growth", .12, .11, .10, .09, .08], ["Gross margin", .41, .41, .42, .42, .42], ["Opex % revenue", .24, .24, .235, .23, .23],
               ["Capex % revenue", .05, .05, .05, .05, .05], ["Depreciation % opening fixed assets", .105, .105, .105, .105, .105],
               ["Receivable days", 45, 45, 44, 44, 43], ["Inventory days (on COGS)", 89, 88, 87, 86, 85], ["Payable days (on COGS)", 60, 60, 60, 60, 60],
               ["Tax rate", .25, .25, .25, .25, .25], ["Debt repayment", 20, 20, 20, 20, 20], ["Interest rate on opening debt", .09, .09, .09, .09, .09]]
    rev = [1380]
    for g in drivers[0][1:]:
        rev.append(rev[-1] * (1 + g))
    return {
        "sheets": {"Historicals (₹ lakh)": (["Line item", "FY24", "FY25"], hist), "Drivers": (["Driver", "FY26", "FY27", "FY28", "FY29", "FY30"], drivers)},
        "tasks": ["Build the forecast income statement for FY26–FY30 from the drivers.", "Build the balance sheet with working capital from day counts, fixed assets roll-forward and debt schedule.",
                  "Build the cash flow statement; cash on the balance sheet must come from the cash flow.", "Add a balance check row (Assets − Liabilities − Equity) that equals zero every year.",
                  "Add a summary with revenue, EBITDA margin and free cash flow."],
        "answers": ["FY26 revenue", "FY30 revenue", "Balance check equals zero in all years? (Yes/No)"],
        "key": {"FY26 revenue": r2(rev[1]), "FY30 revenue": r2(rev[5]), "Balance check equals zero in all years? (Yes/No)": "Must be Yes; inspect check row formulas",
                "Note": "Inspect that net income flows to retained earnings and cash is linked from the cash flow statement (no plugs)."},
    }


def chart_data(slug):
    months = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"]
    rng = _rng(slug)
    rows = [[m, rng.randint(40, 60) + i * 2, rng.randint(20, 30) + i, rng.randint(10, 25) - (i // 3)] for i, m in enumerate(months)]
    return {
        "sheets": {"Revenue by segment": (["Month", "Enterprise (₹ lakh)", "SMB (₹ lakh)", "Consumer (₹ lakh)"], rows),
                   "Problems to fix": (["Original chart", "Problem"], [["3D pie of 12 months", "Pie for time series; 3D distorts"], ["Clustered column with 6 colours", "Hard to compare trend, too many colours"], ["Line chart with dual axis", "Misleading scale"]])},
        "tasks": ["Build a line chart showing the trend of each segment over the year, labelled directly (no legend).", "Build a bar chart comparing full-year totals by segment, sorted.",
                  "Build a chart that highlights Consumer's decline (grey other series, colour Consumer).", "Give each chart an action title that states the message."],
        "answers": ["Largest segment full-year (₹ lakh)", "Segment in decline", "Action title for chart 3"],
        "key": {"Largest segment full-year (₹ lakh)": "Enterprise — " + str(sum(r[1] for r in rows)), "Segment in decline": "Consumer",
                "Note": "Grade chart choice, decluttering, direct labels and action titles."},
    }


def retail_dirty(slug):
    rng = _rng(slug)
    cats = ["Grocery", "grocery ", "Home", "HOME", "Personal care", "Electronics"]
    rows = []
    for i in range(1, 301):
        rows.append([f"T{i:04d}", (date(2026, 6, 1) + timedelta(days=rng.randint(0, 60))).isoformat(), rng.choice(["Andheri", "Thane", "Powai", "andheri"]),
                     rng.choice(cats), rng.randint(1, 6), rng.choice([49, 99, 149, 299, 899, 1499, ""])])
    for _ in range(12):
        rows.append(list(rng.choice(rows)))
    clean = {}
    for r in rows:
        if r[5] == "":
            continue
        clean[r[0]] = r
    tot = sum(r[4] * r[5] for r in clean.values())
    bycat = defaultdict(float)
    for r in clean.values():
        bycat[r[3].strip().title()] += r[4] * r[5]
    return {
        "sheets": {"Transactions": (["Txn ID", "Date", "Store", "Category", "Units", "Unit price (₹)"], rows)},
        "tasks": ["Remove duplicate transactions, standardise Store and Category text, and handle blank prices (exclude and count them). Log every step on a 'Cleaning log' sheet.",
                  "Add Revenue = Units × Unit price.", "Answer: total revenue, revenue by category, best store, average basket value, and number of excluded rows."],
        "answers": ["Duplicates removed", "Rows excluded for blank price", "Total revenue (₹)", "Top category"],
        "key": {"Duplicates removed": len(rows) - len(set(r[0] for r in rows)), "Rows excluded for blank price": sum(1 for r in {r[0]: r for r in rows}.values() if r[5] == ""),
                "Total revenue (₹)": r2(tot), "Top category": max(bycat, key=bycat.get), "By category": {k: r2(v) for k, v in bycat.items()}},
    }


# ---------------------------------------------------------------- Business
def unit_economics(slug):
    inputs = [["Average order value (₹)", 320], ["Food cost % of AOV", 0.32], ["Packaging per order (₹)", 18], ["Aggregator commission %", 0.22],
              ["Delivery/other variable per order (₹)", 12], ["Monthly rent (₹)", 45000], ["Monthly salaries (₹)", 120000], ["Monthly utilities & other fixed (₹)", 25000]]
    v = dict(inputs)
    contrib = v["Average order value (₹)"] * (1 - v["Food cost % of AOV"] - v["Aggregator commission %"]) - v["Packaging per order (₹)"] - v["Delivery/other variable per order (₹)"]
    fixed = v["Monthly rent (₹)"] + v["Monthly salaries (₹)"] + v["Monthly utilities & other fixed (₹)"]
    return {
        "sheets": {"Inputs": (["Assumption", "Value"], inputs)},
        "tasks": ["Calculate contribution per order and contribution margin %.", "Calculate total monthly fixed costs and break-even orders per month and per day (30 days).",
                  "Build a two-way data table: break-even orders/day for AOV ₹280–₹400 and food cost 28%–36%.", "Recommend two levers to reach break-even faster."],
        "answers": ["Contribution per order (₹)", "Break-even orders per month", "Break-even orders per day"],
        "key": {"Contribution per order (₹)": r2(contrib), "Break-even orders per month": r2(fixed / contrib), "Break-even orders per day": r2(fixed / contrib / 30)},
    }


def pipeline(slug):
    rng = _rng(slug)
    stages = {"Prospecting": .1, "Discovery": .2, "Proposal": .5, "Negotiation": .7, "Verbal commit": .9}
    rows = [[f"D-{i:03d}", f"Account {i}", rng.choice(list(stages)), rng.choice([150000, 250000, 400000, 600000, 900000]),
             (date(2026, 10, 1) + timedelta(days=rng.randint(0, 120))).isoformat(), rng.choice(["Asha", "Rohit", "Meera"])] for i in range(1, 41)]
    q = [r for r in rows if r[4] <= "2026-12-31"]
    return {
        "sheets": {"CRM export": (["Deal ID", "Account", "Stage", "Value (₹)", "Expected close", "Owner"], rows),
                   "Stage probabilities": (["Stage", "Probability"], [[k, v] for k, v in stages.items()])},
        "tasks": ["Look up each deal's stage probability and calculate weighted value.", "Summarise weighted pipeline by stage and by owner.",
                  "Forecast Q4 2026 (deals expected to close by 31 Dec 2026).", "Flag deals that need requalification and say why."],
        "answers": ["Total pipeline (₹)", "Total weighted pipeline (₹)", "Q4 weighted forecast (₹)"],
        "key": {"Total pipeline (₹)": sum(r[3] for r in rows), "Total weighted pipeline (₹)": r2(sum(r[3] * stages[r[2]] for r in rows)),
                "Q4 weighted forecast (₹)": r2(sum(r[3] * stages[r[2]] for r in q))},
    }


def order_economics(slug):
    inputs = [["Average order value (₹)", 1500], ["Product cost % of AOV", 0.38], ["Shipping per order (₹)", 85], ["Payment gateway fee %", 0.02],
              ["Return rate", 0.15], ["Cost per return (reverse shipping + handling, ₹)", 140], ["Target profit per order (₹)", 120]]
    v = dict(inputs)
    aov = v["Average order value (₹)"]
    contrib = aov * (1 - v["Return rate"]) - aov * v["Product cost % of AOV"] * (1 - v["Return rate"] * 0.6) - v["Shipping per order (₹)"] - aov * v["Payment gateway fee %"] - v["Return rate"] * v["Cost per return (reverse shipping + handling, ₹)"]
    return {
        "sheets": {"Inputs": (["Assumption", "Value"], inputs), "Notes": (["Note"], [["Assume 60% of returned products are resaleable, so product cost is lost on 40% of returns."]])},
        "tasks": ["Calculate expected contribution per order after returns, shipping, fees and return costs.", "Calculate the maximum CAC you can afford while keeping the target profit per order.",
                  "Show how contribution changes if the return rate falls to 8%.", "Recommend actions on the biggest cost driver."],
        "answers": ["Contribution per order (₹)", "Affordable CAC (₹)"],
        "key": {"Contribution per order (₹)": r2(contrib), "Affordable CAC (₹)": r2(contrib - v["Target profit per order (₹)"]),
                "Formula": "AOV×(1−r) − cost%×AOV×(1−0.6r) − shipping − fee%×AOV − r×return cost"},
    }


BUILDERS = {
    "mastering-claude-ai": feedback,
    "ai-productivity-workflow-automation": time_audit,
    "ai-agents-autonomous-workflows": agent_eval,
    "generative-ai-for-professionals": usecases,
    "ai-powered-business-automation": roi,
    "chatgpt-claude-gemini-practical-mastery": benchmark,
    "ai-tools-for-entrepreneurs": market_size,
    "digital-marketing-mastery": campaign,
    "ai-powered-digital-marketing": ab_variants,
    "performance-marketing-paid-advertising": breakeven_roas,
    "seo-content-marketing": keywords,
    "social-media-marketing-brand-building": social_posts,
    "growth-marketing-customer-acquisition": cohorts,
    "marketing-analytics-conversion-optimisation": funnel_ab,
    "advanced-excel-for-professionals": sales_ops,
    "excel-automation-ai-integration": regions,
    "power-bi-business-intelligence": flat_sales,
    "financial-modelling-business-analysis": three_statement,
    "advanced-powerpoint-business-presentations": chart_data,
    "data-analytics-for-business-professionals": retail_dirty,
    "startup-launch-business-fundamentals": unit_economics,
    "business-development-sales-mastery": pipeline,
    "building-scaling-online-business": order_economics,
    "personal-branding-linkedin-growth": lambda s: social_posts(s, 30, "Post log"),
}
