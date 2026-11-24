"""Word-assignment questions and answer keys, plus scenario answer keys, per course slug.

DOC[slug] = list of (question, model-answer key points)
SCENARIO[slug] = key points a strong scenario response should cover
These are used to build the DOCX templates and the private answer keys the AI evaluator grades against.
"""

DOC = {
    "mastering-claude-ai": [
        ("Prompt A: 'Write something about our new product.' Rewrite it as a complete brief and explain each change.", ["Adds role/audience, product facts as context, specific task, output format and length", "States tone and constraints (claims to avoid)", "Explains that context and format reduce guessing and rework"]),
        ("Prompt B: 'Summarise this report.' (a 40-page market report). Rewrite it so the summary is verifiable.", ["Asks for key findings with page/section references or quotes", "Specifies audience and length", "Asks Claude to flag uncertainties or missing data"]),
        ("Prompt C: 'Is this contract good?' Rewrite it and predict how the output will change.", ["Defines the reviewer's perspective (our company) and what 'good' means", "Requests clause-by-clause risks with references and severity", "Predicts structured, specific output instead of a vague opinion; notes legal review still needed"]),
    ],
    "ai-productivity-workflow-automation": [
        ("A support team handles password resets, refund requests and product bug reports. Classify each as draft, check or automate, with reasons.", ["Password resets: automate via self-service with verification", "Refunds: AI drafts, human approves (money and judgement)", "Bug reports: AI triages and summarises, human checks before routing"]),
        ("What data would you collect before automating, and why?", ["Volume and time per task", "Error rates and cost of mistakes", "Variation and exceptions in inputs"]),
        ("Describe two human checkpoints you would add and where.", ["Approval before any external message or payment", "Exception queue for low-confidence or unusual cases", "Periodic sample review of automated outputs"]),
    ],
    "ai-agents-autonomous-workflows": [
        ("List the tools the support agent needs and the permission level for each.", ["Read-only order lookup and knowledge base", "Draft-only reply tool; sending needs approval for sensitive cases", "No direct refund or account-deletion tool, or approval-gated"]),
        ("Define escalation rules to a human.", ["Low confidence or repeated failure", "Money, legal, safety or angry/vulnerable customers", "Requests outside documented policy"]),
        ("Name three risks and a mitigation for each.", ["Hallucinated policy → ground in knowledge base with citations", "Prompt injection from customer text → treat input as data, restrict tools", "Runaway actions/cost → limits, logging, monitoring"]),
    ],
    "generative-ai-for-professionals": [
        ("Which tools would you approve for a 50-person firm and on what criteria?", ["Enterprise plans with data-use controls and admin settings", "Security/privacy review, data residency, retention terms", "Fit to actual use cases and cost"]),
        ("Write three data-handling rules for staff.", ["No confidential client or personal data in unapproved tools", "Anonymise or minimise data when allowed", "Check outputs before external use; disclose where required"]),
        ("How would you measure whether AI adoption is working after three months?", ["Time saved on target tasks (baseline vs after)", "Quality/error rates and review findings", "Adoption/usage and staff feedback"]),
    ],
    "ai-powered-business-automation": [
        ("Map the distributor's order-to-cash steps and mark the biggest bottleneck.", ["Order capture → credit check → fulfilment → invoicing → collection", "Identifies manual re-keying of orders/invoices as bottleneck", "Uses the case's delay or error figures as evidence"]),
        ("Which step would you automate first and why?", ["Highest volume, rule-based step with measurable savings", "Low risk and easy to reverse", "Quick payback to build credibility"]),
        ("What controls would you put around the automation?", ["Exception queue and owner", "Audit log and reconciliation", "Monitoring with alerts and periodic review"]),
    ],
    "chatgpt-claude-gemini-practical-mastery": [
        ("A legal team needs long-contract review. Which assistant setup would you recommend and why?", ["Long-context model with file upload (e.g., Claude Projects)", "Clause-referenced outputs and human legal review", "Enterprise data controls"]),
        ("A marketing team lives in Google Workspace. What do you recommend?", ["Gemini in Workspace for in-doc drafting", "Second assistant for cross-checking or specialised tasks", "Brand voice guidance and review"]),
        ("How would you train a mixed team to choose the right tool per task?", ["Task-to-tool guide with examples", "Shared prompt library", "Verification habits and when not to use AI"]),
    ],
    "ai-tools-for-entrepreneurs": [
        ("Who exactly is your customer and what problem do they have?", ["Specific segment (not 'everyone')", "Concrete, frequent, painful problem", "Evidence from conversations or data"]),
        ("What alternatives do they use today and why are they inadequate?", ["Names real alternatives including doing nothing", "Specific shortcomings", "Switching costs considered"]),
        ("What is your unique value and what proof do you have?", ["Clear differentiator tied to the problem", "Proof: pilots, pre-orders, interviews, metrics", "Honest about what is not yet proven"]),
    ],
    "digital-marketing-mastery": [
        ("Define the launch goals and KPIs for the two-city D2C skincare launch.", ["SMART business goal (e.g., orders/revenue by a date)", "Funnel KPIs: reach, CTR, conversion rate, CAC, repeat rate", "City-level targets"]),
        ("Describe the target persona and customer journey.", ["Demographics plus needs/skin concerns and buying triggers", "Journey stages with channels and messages", "Objections and trust builders"]),
        ("Propose a channel mix and budget split with reasons.", ["Mix of paid social, search, creators, email/WhatsApp", "Budget weighted to channels matching intent and audience", "Test-and-learn reserve"]),
    ],
    "ai-powered-digital-marketing": [
        ("Describe the fintech app's brand personality in three traits with do/don't examples.", ["Three clear traits (e.g., clear, trustworthy, encouraging)", "Do/don't examples for each", "Avoids jargon and hype"]),
        ("List approved and banned words/phrases and why.", ["Approved product terms", "Banned: guaranteed returns, risk-free, misleading claims", "Regulatory reasoning"]),
        ("Write two example posts in the voice and annotate them.", ["Posts consistent with traits", "Annotations linking choices to the guide", "Compliant claims"]),
    ],
    "performance-marketing-paid-advertising": [
        ("Identify the three most urgent problems in the Google Ads account summary.", ["Tracking/conversion issues", "Wasted spend on broad/irrelevant search terms", "Structure or bidding mismatched to goals"]),
        ("Prioritise fixes by impact and effort.", ["Fix tracking first", "Negative keywords and restructuring", "Bidding and creative tests next"]),
        ("How will you measure that the fixes worked?", ["Before/after CPA and ROAS on comparable periods", "Conversion volume and quality", "Search-term waste share"]),
    ],
    "seo-content-marketing": [
        ("Primary keyword, intent and target reader.", ["Keyword chosen from list with stated intent", "Specific reader and their goal", "Matches the SERP type"]),
        ("Outline H2/H3 structure and what each section answers.", ["Logical structure covering intent fully", "Includes related subtopics/questions", "Unique angle or information gain"]),
        ("Internal links, title tag and meta description.", ["Relevant internal links with anchors", "Title under ~60 chars with keyword", "Compelling meta description"]),
    ],
    "social-media-marketing-brand-building": [
        ("Define the café chain's positioning in one sentence and three personality traits.", ["Specific audience and differentiator", "Distinct traits", "Fits the new city's context"]),
        ("Which platforms and content pillars would you use and why?", ["Instagram/short video for discovery, maybe Google/WhatsApp for local", "3–5 pillars tied to brand", "Local community content"]),
        ("How will you measure brand-building progress in the first 90 days?", ["Reach and follower growth in target city", "Engagement and saves/shares", "Store visits/redemptions linked to social"]),
    ],
    "growth-marketing-customer-acquisition": [
        ("What is the meal-kit startup's North Star metric and why?", ["e.g., weekly active ordering households or meals delivered", "Reflects customer value", "Leads to revenue"]),
        ("Score the experiment ideas with RICE and justify the top three.", ["Correct RICE calculation (Reach×Impact×Confidence÷Effort)", "Reasonable estimates", "Top three justified"]),
        ("Design the first experiment in detail.", ["Hypothesis, metric, audience, duration/sample", "Success threshold", "What you will do with each outcome"]),
    ],
    "marketing-analytics-conversion-optimisation": [
        ("List the key events for the course store with parameters.", ["view_item, add_to_cart/begin_checkout, purchase, sign_up, lesson_start", "Parameters: course_id, price, currency, value", "Consistent naming"]),
        ("Which events are conversions and why?", ["purchase as primary", "sign_up/begin_checkout as micro-conversions", "Linked to business goals"]),
        ("How will you check data quality?", ["Test in debug view before launch", "Reconcile purchases with payment records", "Regular audits/alerts"]),
    ],
    "advanced-excel-for-professionals": [
        ("Find the errors and risks in the colleague's pricing model.", ["Hard-coded numbers in formulas", "Inconsistent ranges/broken references", "No input/calculation separation"]),
        ("How would you restructure the model?", ["Separate inputs, calculations, outputs", "Named ranges/Tables, consistent formulas", "Error checks"]),
        ("What checks would you add before sharing?", ["Totals reconcile", "Error trapping (IFERROR used carefully)", "Peer review and version control"]),
    ],
    "excel-automation-ai-integration": [
        ("Identify bugs in the AI-generated VBA.", ["Uses ActiveSheet/Select without checks", "Hard-coded ranges that miss new rows", "No error handling"]),
        ("Identify risks of running it as-is.", ["Deleting/overwriting data on wrong sheet", "Silent failures", "Macro security"]),
        ("Rewrite or describe the safer version.", ["Explicit worksheet references", "Dynamic last row", "Backup/confirmation and error handling"]),
    ],
    "power-bi-business-intelligence": [
        ("Explain filter context and how CALCULATE changes it.", ["Filter context from slicers/visual rows", "CALCULATE adds/overrides filters", "Example measure"]),
        ("Write a measure for revenue year-to-date and same period last year.", ["TOTALYTD or DATESYTD with date table", "SAMEPERIODLASTYEAR or DATEADD", "Requires marked date table"]),
        ("Why might a YoY measure show blanks?", ["No/inactive relationship to date table", "Date table not continuous/marked", "Missing prior-year data"]),
    ],
    "financial-modelling-business-analysis": [
        ("Compare the two retailers' profitability.", ["Gross and operating margin comparison", "ROE/ROCE drivers", "Explains differences"]),
        ("Compare their efficiency and working capital.", ["Inventory/receivable days", "Asset turnover", "Cash conversion"]),
        ("Which is financially stronger and what are the caveats?", ["Uses leverage/liquidity ratios", "Clear conclusion", "Caveats: accounting differences, one-year data"]),
    ],
    "advanced-powerpoint-business-presentations": [
        ("Write the governing thought for the market-entry case.", ["One clear recommendation sentence", "Answers the decision-maker's question", "Specific"]),
        ("Write the three key supporting arguments with evidence.", ["MECE arguments", "Evidence from case data", "Logical order"]),
        ("Write the executive summary slide text.", ["Situation, complication, resolution", "Action title", "Concise"]),
    ],
    "data-analytics-for-business-professionals": [
        ("Restate the delivery delay problem as a specific analysis question.", ["Measurable outcome (e.g., % late deliveries)", "Scope and time period", "Decision it informs"]),
        ("Which metrics and data do you need?", ["On-time rate, delay minutes, by route/driver/time", "Order, dispatch and delivery timestamps", "Definitions agreed"]),
        ("What are possible causes and how would you test them?", ["Hypotheses: traffic times, warehouse dispatch, routes, staffing", "Segment comparisons", "Avoid causal claims without evidence"]),
    ],
    "startup-launch-business-fundamentals": [
        ("Customer segments and value proposition with evidence.", ["Specific segments", "Value proposition tied to pain", "Evidence cited"]),
        ("Channels, customer relationships and revenue streams.", ["Realistic channels", "Pricing model", "Retention approach"]),
        ("Key resources, activities, partners and cost structure.", ["Essential resources/partners", "Main cost drivers", "Consistent with model"]),
    ],
    "business-development-sales-mastery": [
        ("What do you need to learn in discovery?", ["Current process and pain", "Impact/cost of the problem", "Decision process, budget and timeline"]),
        ("Write five discovery questions.", ["Open-ended", "Probe impact and priorities", "Identify stakeholders"]),
        ("How will you decide whether to proceed after the call?", ["Qualification criteria (e.g., BANT/MEDDIC)", "Clear next step agreed", "Disqualify if no fit"]),
    ],
    "building-scaling-online-business": [
        ("Compare marketplace and own D2C store for the handloom brand.", ["Marketplace: reach, fees, less control", "D2C: margin, data, brand, but acquisition cost", "Considers product and stage"]),
        ("Which would you start with and why?", ["Clear recommendation", "Based on economics and brand goals", "Possibly hybrid"]),
        ("What metrics will tell you to change course?", ["Contribution per order", "CAC vs LTV", "Repeat rate and returns"]),
    ],
    "personal-branding-linkedin-growth": [
        ("Who do you help, with what, and how are you different?", ["Specific audience", "Clear expertise", "Differentiator with proof"]),
        ("Draft your headline.", ["Value-focused", "Includes keywords", "Under limit"]),
        ("Draft your About section.", ["Hook, proof, what you do, call to action", "First person, specific", "Readable"]),
    ],
}

SCENARIO = {
    "mastering-claude-ai": ["Explains likely causes: summarisation without quoting, long-document attention, no verification step", "Review process: clause-referenced output, human check of critical clauses, checklist", "Does not blame the tool alone; owns the workflow"],
    "ai-productivity-workflow-automation": ["Root cause: matching on name instead of unique ID/email", "Fix: unique identifiers, validation step, approval before sending external documents", "Incident response: inform client, apologise, contain"],
    "ai-agents-autonomous-workflows": ["Cause: non-idempotent write action plus retries after timeout, excessive permissions", "Controls: idempotency keys, approval for refunds, least privilege, rate limits", "Monitoring and reconciliation; remediation of duplicates"],
    "generative-ai-for-professionals": ["Immediate: contain, assess what was shared, inform security/legal, check tool data terms", "Do not panic-blame; treat as process gap", "After: approved tools, training, clear rules and enterprise controls"],
    "ai-powered-business-automation": ["Builds cost–benefit with realistic hours, wages, tool costs, implementation", "Acknowledges hidden costs and risks", "Proposes pilot with measurable payback"],
    "chatgpt-claude-gemini-practical-mastery": ["Do not average; trace each figure to a source", "Check definitions, geography, year", "Report a range with sources and stated uncertainty"],
    "ai-tools-for-entrepreneurs": ["Specific market or technology change that makes now possible", "Evidence of demand/traction", "Why the team and approach differ from past failures"],
    "digital-marketing-mastery": ["Checks traffic quality and source mix", "Landing page/offer mismatch, tracking issues, checkout friction", "Next steps: segment analysis, fix funnel, test"],
    "ai-powered-digital-marketing": ["Immediate: remove or correct the claim, consult legal, respond transparently", "Do not delete silently if it would mislead", "Process: claims checklist and legal review for AI drafts"],
    "performance-marketing-paid-advertising": ["Causes: audience saturation, frequency/creative fatigue, broader targeting, bidding learning", "Check tracking and attribution", "Recovery: scale gradually, new creative, restructure, set ROAS/CPA targets"],
    "seo-content-marketing": ["Check redirects (301 mapping), lost pages/content", "Robots/noindex, canonicals, internal links, sitemap", "Search Console coverage and ranking comparison"],
    "social-media-marketing-brand-building": ["Acknowledge quickly and honestly", "Clear update on timeline and what customers can do", "Respond to comments, escalate cases, avoid deleting criticism"],
    "growth-marketing-customer-acquisition": ["Diagnose activation and retention, not acquisition", "Cohort and funnel analysis to find drop-off", "Experiments on onboarding/aha moment and habit loops"],
    "marketing-analytics-conversion-optimisation": ["p = 0.31 means result not statistically significant", "Options: run longer if underpowered, ship only if low risk/other reasons", "Avoid claiming a 2% win"],
    "advanced-excel-for-professionals": ["VLOOKUP uses a hard-coded column index that shifted", "Rebuild with XLOOKUP or INDEX-MATCH and Tables", "Add checks"],
    "excel-automation-ai-integration": ["Macro acted on the active/wrong sheet without checks", "Safeguards: explicit sheet references, confirmation, backup, logging", "Restore from backup/version history"],
    "power-bi-business-intelligence": ["Different definitions (gross vs net, booking vs invoice date)", "Different filters/data sources or refresh timing", "Fix: shared certified dataset and metric definitions"],
    "financial-modelling-business-analysis": ["Challenge growth, margins, churn, CAC, hiring and capex assumptions", "Compare with benchmarks and historicals", "Run downside scenarios and sensitivities"],
    "advanced-powerpoint-business-presentations": ["Lead with the recommendation", "Keep 3 slides: answer, evidence, ask/next steps", "Move detail to appendix"],
    "data-analytics-for-business-professionals": ["Correlation not causation; seasonality (June) and other factors", "Need a comparison/control group", "Proposes a fair test"],
    "startup-launch-business-fundamentals": ["Compares runway, control, speed, dilution", "Uses traction evidence and market timing", "Clear recommendation with conditions"],
    "business-development-sales-mastery": ["Do not discount immediately", "Explore value, total cost and differences", "Trade concessions for commitments"],
    "building-scaling-online-business": ["Analyse return reasons by product/size", "Fix size guides, photos, descriptions, QC", "Policy and economics changes"],
    "personal-branding-linkedin-growth": ["Reach without relevance; vanity metric", "Return to positioning and pillars", "Use the attention: follow-up post tied to expertise"],
}
