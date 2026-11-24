#!/usr/bin/env python3
"""Builds the Proofwork catalogue from the content modules in this folder.

Outputs (all generated — edit the content modules, then re-run):
  supabase/migrations/20261125000010_proofwork_catalogue.sql   idempotent seed (catalogue, quizzes, assignments, answer keys)
  src/lib/catalogue/catalogue.json                             public-safe catalogue for preview mode (no answers)
  private/templates/<slug>/*.xlsx|*.docx                       assignment templates served only to enrolled learners
  public/thumbnails/<slug>.svg                                 course thumbnails

Run: python3 scripts/catalogue/build.py
"""
import hashlib
import json
import os
import random
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))

import ai, marketing, professional, business  # noqa: E402
from datasets import BUILDERS  # noqa: E402
from keys import DOC, SCENARIO  # noqa: E402

from openpyxl import Workbook  # noqa: E402
from openpyxl.styles import Alignment, Font, PatternFill, Border, Side  # noqa: E402
from openpyxl.utils import get_column_letter  # noqa: E402
from docx import Document  # noqa: E402
from docx.shared import Pt, RGBColor  # noqa: E402

PRICE_PAISE = 750000
FEATURED = {"mastering-claude-ai", "ai-agents-autonomous-workflows", "digital-marketing-mastery",
            "performance-marketing-paid-advertising", "advanced-excel-for-professionals", "financial-modelling-business-analysis"}
GROUPS = [ai, marketing, professional, business]
HIDDEN_CATEGORIES = [{
    "slug": "financial-markets", "name": "Financial Markets", "tagline": "Coming later: markets, investing and research.",
    "description": "Roadmap category. Not visible or purchasable until courses are added and published.", "accent": "amber", "icon": "trending-up",
}]
OLD_PROGRAMS = ["stock-market-program", "web-development-program", "digital-marketing-program", "excel-program"]
OLD_CATEGORIES = ["stock-market", "web-development", "digital-marketing", "excel"]


def uid(name):
    h = hashlib.sha1(("proofwork:" + name).encode()).hexdigest()
    return f"{h[0:8]}-{h[8:12]}-5{h[13:16]}-a{h[17:20]}-{h[20:32]}"


def q(s):
    if s is None:
        return "null"
    return "'" + str(s).replace("'", "''") + "'"


def arr(xs):
    return "array[" + ", ".join(q(x) for x in xs) + "]::text[]"


def j(o):
    return q(json.dumps(o, ensure_ascii=False)) + "::jsonb"


# ----------------------------------------------------------------------------- rubrics
RUBRICS = {
    "file": [
        ("Accuracy of results", 40, "Key figures match the answer key within rounding; answers sheet complete."),
        ("Live, correct formulas", 25, "Results are calculated with working formulas (not typed values); references are robust."),
        ("Structure and presentation", 15, "Clear sheets, labels, formatting and charts as requested."),
        ("Insight and recommendation", 20, "Conclusions follow from the numbers and are specific and actionable."),
    ],
    "document": [
        ("Accuracy and depth", 40, "Answers cover the key points in the answer key correctly and in depth."),
        ("Application to the case", 25, "Uses the facts of the brief rather than generic statements."),
        ("Reasoning and evidence", 20, "Explains why, with evidence, numbers or examples."),
        ("Clarity and structure", 15, "Well organised, concise, professional writing."),
    ],
    "practical": [
        ("Completeness of deliverable", 30, "Everything requested in the deliverables list is submitted."),
        ("Quality of execution", 30, "The work meets a professional standard and applies course methods."),
        ("Evidence of real work", 20, "Screenshots, links, files or results show the work was actually done."),
        ("Reflection and learning", 20, "Honest reflection on what worked, what did not and what to change."),
    ],
    "scenario": [
        ("Diagnosis", 30, "Identifies the real causes, not just symptoms."),
        ("Recommended actions", 30, "Concrete, prioritised, realistic actions."),
        ("Risks and trade-offs", 20, "Considers risks, stakeholders and alternatives."),
        ("Communication", 20, "Clear, structured and persuasive for the stated audience."),
    ],
}
KIND_META = {
    "file": {"label": "Workbook assignment", "accepted": ["xlsx", "csv"], "minutes": 120, "module": 2},
    "document": {"label": "Written assignment", "accepted": ["docx", "pdf"], "minutes": 90, "module": 1},
    "practical": {"label": "Practical project", "accepted": ["pdf", "docx", "pptx", "xlsx", "png", "jpg", "zip"], "minutes": 180, "module": 3},
    "scenario": {"label": "Scenario challenge", "accepted": ["docx", "pdf"], "minutes": 60, "module": 4},
}
LEVEL_HOURS = {"beginner": 16, "intermediate": 20, "advanced": 24}


def rubric_json(kind):
    return [{"criterion": c, "points": p, "description": d} for c, p, d in RUBRICS[kind]]


# ----------------------------------------------------------------------------- quiz encoding
def encode_quiz(slug, quiz):
    rng = random.Random("quiz:" + slug)
    out = []
    for i, item in enumerate(quiz):
        t = item[0]
        base = {"position": i + 1, "context": None, "correct_index": None, "correct": None, "options": None, "points": 1}
        if t == "single":
            _, prompt, opts, idx, expl = item
            base.update(qtype="single", prompt=prompt, options=opts, correct_index=idx, explanation=expl)
        elif t == "multi":
            _, prompt, opts, idxs, expl = item
            base.update(qtype="multi", prompt=prompt, options=opts, correct=idxs, explanation=expl, points=2)
        elif t == "tf":
            _, prompt, val, expl = item
            base.update(qtype="true_false", prompt=prompt, options=["True", "False"], correct_index=0 if val else 1, explanation=expl)
        elif t == "fill":
            _, prompt, answers, expl = item
            base.update(qtype="fill_blank", prompt=prompt, correct=answers, explanation=expl)
        elif t == "match":
            _, prompt, left, right, expl = item
            order = list(range(len(right)))
            while order == sorted(order):
                rng.shuffle(order)
            shuffled = [right[k] for k in order]
            correct = [order.index(k) for k in range(len(left))]
            base.update(qtype="match", prompt=prompt, options={"left": left, "right": shuffled}, correct=correct, explanation=expl, points=2)
        elif t == "scenario":
            _, context, prompt, opts, idx, expl = item
            base.update(qtype="scenario", context=context, prompt=prompt, options=opts, correct_index=idx, explanation=expl, points=2)
        else:
            raise ValueError(t)
        out.append(base)
    return out


# ----------------------------------------------------------------------------- templates
INK = "101827"
VIOLET = "7457FF"
thin = Side(style="thin", color="D5D9E2")


def build_workbook(course, asg, data, path):
    wb = Workbook()
    ws = wb.active
    ws.title = "Brief"
    ws.sheet_view.showGridLines = False
    ws["A1"] = "Proofwork"
    ws["A1"].font = Font(bold=True, color=VIOLET, size=11)
    ws["A2"] = course["title"]
    ws["A2"].font = Font(bold=True, size=16, color=INK)
    ws["A3"] = "Assignment: " + asg[0]
    ws["A3"].font = Font(bold=True, size=12, color=INK)
    ws["A5"] = asg[1]
    ws["A5"].alignment = Alignment(wrap_text=True, vertical="top")
    ws.row_dimensions[5].height = 48
    ws["A7"] = "Tasks"
    ws["A7"].font = Font(bold=True, size=12)
    r = 8
    for n, t in enumerate(data["tasks"], 1):
        ws.cell(r, 1, f"{n}. {t}").alignment = Alignment(wrap_text=True, vertical="top")
        ws.row_dimensions[r].height = 34
        r += 1
    r += 1
    ws.cell(r, 1, "How to submit").font = Font(bold=True, size=12)
    ws.cell(r + 1, 1, "Save this workbook with your work, keep formulas live (do not paste values), complete the Answers sheet and upload it in the assignment panel.").alignment = Alignment(wrap_text=True)
    ws.row_dimensions[r + 1].height = 34
    ws.cell(r + 2, 1, "Your submission is evaluated against a published rubric. Results usually appear about an hour after you submit.").alignment = Alignment(wrap_text=True)
    ws.column_dimensions["A"].width = 110

    for name, (headers, rows) in data["sheets"].items():
        s = wb.create_sheet(name[:31])
        for c, h in enumerate(headers, 1):
            cell = s.cell(1, c, h)
            cell.font = Font(bold=True, color="FFFFFF")
            cell.fill = PatternFill("solid", fgColor=INK)
            cell.alignment = Alignment(vertical="center", wrap_text=True)
        for ri, row in enumerate(rows, 2):
            for c, v in enumerate(row, 1):
                cell = s.cell(ri, c, v if v != "" else None)
                cell.border = Border(bottom=thin)
                if isinstance(v, float) and 0 < abs(v) < 1:
                    cell.number_format = "0.0%" if "rate" in headers[c - 1].lower() or "share" in headers[c - 1].lower() or "%" in headers[c - 1] or "margin" in headers[c - 1].lower() else "0.000"
        for c, h in enumerate(headers, 1):
            width = max([len(str(h))] + [len(str(rw[c - 1])) for rw in rows[:50]]) + 2
            s.column_dimensions[get_column_letter(c)].width = min(48, max(10, width))
        s.freeze_panes = "A2"

    a = wb.create_sheet("Answers")
    a["A1"] = "Answers"
    a["A1"].font = Font(bold=True, size=14)
    a["A2"] = "Enter a formula (preferred) or value in the yellow cells."
    for i, label in enumerate(data["answers"], 4):
        a.cell(i, 1, label).font = Font(bold=True)
        cell = a.cell(i, 2)
        cell.fill = PatternFill("solid", fgColor="FFF4C2")
        cell.border = Border(top=thin, bottom=thin, left=thin, right=thin)
    a.column_dimensions["A"].width = 52
    a.column_dimensions["B"].width = 34
    wb.save(path)


def build_docx(course, asg, questions, path):
    d = Document()
    st = d.styles["Normal"]
    st.font.name = "Calibri"
    st.font.size = Pt(11)
    p = d.add_paragraph()
    run = p.add_run("PROOFWORK")
    run.bold = True
    run.font.color.rgb = RGBColor(0x74, 0x57, 0xFF)
    d.add_heading(course["title"], level=1)
    d.add_heading("Written assignment: " + asg[0], level=2)
    d.add_paragraph(asg[1])
    d.add_heading("Instructions", level=3)
    for t in ["Answer every question in the space provided. Aim for 150–300 words per answer.",
              "Use the facts in the brief and the methods from the course. Generic answers score lower.",
              "Save as .docx or .pdf and upload it in the assignment panel.",
              "Your submission is evaluated against the rubric at the end of this document."]:
        d.add_paragraph(t, style="List Bullet")
    for n, (qtext, _) in enumerate(questions, 1):
        d.add_heading(f"Question {n}", level=3)
        d.add_paragraph(qtext)
        ans = d.add_paragraph("Your answer:")
        ans.runs[0].italic = True
        for _ in range(5):
            d.add_paragraph("")
    d.add_heading("Rubric", level=3)
    t = d.add_table(rows=1, cols=3)
    t.style = "Light Grid Accent 1"
    hdr = t.rows[0].cells
    hdr[0].text, hdr[1].text, hdr[2].text = "Criterion", "Points", "What good looks like"
    for c, pts, desc in RUBRICS["document"]:
        row = t.add_row().cells
        row[0].text, row[1].text, row[2].text = c, str(pts), desc
    d.save(path)


# ----------------------------------------------------------------------------- thumbnails
ACCENTS = {"violet": ("#7457FF", "#B9A9FF"), "cyan": ("#55D6E8", "#B5F1F8"), "blue": ("#5B8CFF", "#BFD2FF"), "emerald": ("#3DD68C", "#B4F2D3"), "amber": ("#F5B94A", "#FBE2B0")}


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def wrap(text, n=24):
    words, lines, line = text.split(), [], ""
    for w in words:
        if len((line + " " + w).strip()) > n:
            lines.append(line.strip())
            line = w
        else:
            line += " " + w
    if line.strip():
        lines.append(line.strip())
    return lines[:3]


def thumbnail(course, cat, idx):
    a, soft = ACCENTS[cat["accent"]]
    rng = random.Random("thumb:" + course["slug"])
    title = course["title"].split(" — ")[0]
    lines = wrap(title)
    m = idx % 4
    if m == 0:  # ascending path
        pts = [(760 + i * 90, 520 - i * 70 - rng.randint(0, 30)) for i in range(5)]
        path = "M" + " L".join(f"{x} {y}" for x, y in pts)
        motif = f'<path d="{path}" fill="none" stroke="{a}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>' + "".join(
            f'<circle cx="{x}" cy="{y}" r="{9 if i < 4 else 16}" fill="{a if i == 4 else "#0B0D12"}" stroke="{a}" stroke-width="4"/>' for i, (x, y) in enumerate(pts))
    elif m == 1:  # grid of cells, some lit
        motif = "".join(f'<rect x="{760 + c * 70}" y="{170 + r * 70}" width="54" height="54" rx="6" fill="{a if rng.random() < .28 else "#ffffff"}" fill-opacity="{0.9 if rng.random() < .28 else 0.05}"/>'
                        for r in range(5) for c in range(5))
    elif m == 2:  # concentric arcs
        motif = "".join(f'<path d="M{1000 - r} 520 A{r} {r} 0 0 1 {1000 + r} 520" fill="none" stroke="{a}" stroke-opacity="{0.85 - i * 0.17}" stroke-width="4"/>' for i, r in enumerate([70, 130, 190, 250, 310]))
    else:  # bars
        motif = "".join(f'<rect x="{770 + i * 64}" y="{520 - h}" width="40" height="{h}" rx="4" fill="{a}" fill-opacity="{0.25 + i * 0.15}"/>'
                        for i, h in enumerate(sorted(rng.sample(range(80, 360), 5))))
    text = "\n  ".join(f'<text x="72" y="{300 + i * 70}" font-family="Bricolage Grotesque, Inter, Arial, sans-serif" font-size="58" font-weight="700" fill="#F4F5F8" letter-spacing="-1">{esc(l)}</text>' for i, l in enumerate(lines))
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" role="img" aria-label="{esc(course["title"])}">
  <defs><radialGradient id="g" cx="0.85" cy="0.15" r="0.9"><stop offset="0" stop-color="{a}" stop-opacity="0.32"/><stop offset="1" stop-color="{a}" stop-opacity="0"/></radialGradient>
  <pattern id="p" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="#ffffff" stroke-opacity="0.04"/></pattern></defs>
  <rect width="1200" height="675" fill="#0B0D12"/><rect width="1200" height="675" fill="url(#p)"/><rect width="1200" height="675" fill="url(#g)"/>
  {motif}
  <text x="72" y="130" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="600" fill="{soft}" letter-spacing="3">{esc(cat["name"].upper())}</text>
  {text}
  <text x="72" y="600" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="600" fill="#F4F5F8" fill-opacity="0.7">Proofwork</text>
</svg>'''


# ----------------------------------------------------------------------------- lessons & faqs
def lesson_body(course, mod_title, title, mi, li):
    return (f"**Module {mi + 1}, lesson {li + 1}** · {mod_title}\n\n"
            f"## {title}\n\n"
            f"This lesson is part of *{course['title']}*. Use it with the module's assignment and the course quiz.\n\n"
            "> **Lesson video and notes are being finalised.** This course's quiz and assignments are already live, "
            "and this page will update automatically when the full lesson is published.")


def faqs(course):
    return [
        {"question": "Who is this course for?", "answer": f"{course['subtitle']} Level: {course['level'].title()}. Requirements: {'; '.join(course['requirements'])}."},
        {"question": "How are assignments evaluated?", "answer": "Quizzes are marked instantly. Workbook, written, practical and scenario assignments are evaluated against a published rubric, usually about an hour after you submit. Results include marks and written feedback, and the Proofwork team can review and adjust any result."},
        {"question": "How long do I have access?", "answer": "Access does not expire. Learn at your own pace and come back to the material whenever you need it."},
        {"question": "Is there a certificate?", "answer": "You receive an internal Proofwork completion record when you finish the course requirements. It is not an accredited qualification."},
        {"question": "How do I pay?", "answer": "The course costs ₹7,500. Pay securely with UPI, cards, net banking or wallets through Razorpay. Access is granted as soon as your payment is verified."},
        {"question": "Can I get a refund?", "answer": "Yes, within 7 days of purchase if you have completed less than 25% of the course. See the refund policy for full conditions."},
    ]


# ----------------------------------------------------------------------------- main
def main():
    sql = ["-- GENERATED by scripts/catalogue/build.py — do not edit by hand.",
           "-- Proofwork catalogue: 4 public categories, 24 courses at ₹7,500, quizzes, assignments, rubrics and private answer keys.",
           "-- Idempotent: safe to re-run. Content rows use deterministic ids.", ""]
    public = {"categories": [], "courses": []}
    tpl_root = ROOT / "private" / "templates"
    thumb_root = ROOT / "public" / "thumbnails"
    thumb_root.mkdir(parents=True, exist_ok=True)

    # Retire the old programs (kept for history; hidden from the catalogue).
    sql.append(f"update public.courses set status = 'archived', is_featured = false where slug in ({', '.join(q(s) for s in OLD_PROGRAMS)}) and status <> 'archived';")
    sql.append(f"update public.categories set is_public = false where slug in ({', '.join(q(s) for s in OLD_CATEGORIES)});")

    cats = [g.CATEGORY for g in GROUPS] + HIDDEN_CATEGORIES
    for si, c in enumerate(cats, 1):
        is_public = c not in HIDDEN_CATEGORIES
        sql.append(f"insert into public.categories (id, slug, name, description, icon, sort_order, is_public, tagline, accent) values "
                   f"({q(uid('cat:' + c['slug']))}, {q(c['slug'])}, {q(c['name'])}, {q(c['description'])}, {q(c['icon'])}, {si}, {str(is_public).lower()}, {q(c['tagline'])}, {q(c['accent'])}) "
                   "on conflict (slug) do update set name = excluded.name, description = excluded.description, icon = excluded.icon, sort_order = excluded.sort_order, is_public = excluded.is_public, tagline = excluded.tagline, accent = excluded.accent;")
        if is_public:
            public["categories"].append({**c, "sort_order": si})
        else:
            public["categories"].append({**c, "sort_order": si, "is_public": False})

    idx = 0
    for g in GROUPS:
        cat = g.CATEGORY
        for course in g.COURSES:
            slug = course["slug"]
            cid = uid("course:" + slug)
            idx += 1
            (thumb_root / f"{slug}.svg").write_text(thumbnail(course, cat, idx))
            data = BUILDERS[slug](slug)
            hours = LEVEL_HOURS[course["level"]]
            n_lessons = sum(len(m[1]) for m in course["modules"])
            sql.append("")
            sql.append(f"-- {course['title']}")
            sql.append(
                "insert into public.courses (id, slug, title, subtitle, description, category_id, thumbnail_url, price_paise, level, language, duration_minutes, "
                "learning_outcomes, requirements, faqs, status, rights_status, rights_notes, is_demo, published_at, projects_count, is_featured, sort_order, "
                "completion_requires_all_lessons, completion_requires_assignments, completion_min_quiz_pct) values ("
                f"{q(cid)}, {q(slug)}, {q(course['title'])}, {q(course['subtitle'])}, {q(course['description'])}, (select id from public.categories where slug = {q(cat['slug'])}), "
                f"{q('/thumbnails/' + slug + '.svg')}, {PRICE_PAISE}, {q(course['level'])}, 'English', {hours * 60}, {arr(course['outcomes'])}, {arr(course['requirements'])}, "
                f"{j(faqs(course))}, 'published', 'owned', 'Original Proofwork course content.', false, now(), {course['projects']}, {str(slug in FEATURED).lower()}, {idx}, "
                "false, true, 60) on conflict (slug) do update set title = excluded.title, subtitle = excluded.subtitle, description = excluded.description, "
                "category_id = excluded.category_id, thumbnail_url = coalesce(public.courses.thumbnail_url, excluded.thumbnail_url), level = excluded.level, "
                "duration_minutes = excluded.duration_minutes, learning_outcomes = excluded.learning_outcomes, requirements = excluded.requirements, faqs = excluded.faqs, "
                "projects_count = excluded.projects_count, sort_order = excluded.sort_order;")

            pub_course = {k: course[k] for k in ("slug", "title", "subtitle", "description", "level", "outcomes", "requirements")}
            pub_course.update(id=cid, category=cat["slug"], price_paise=PRICE_PAISE, duration_minutes=hours * 60, projects_count=course["projects"],
                              is_featured=slug in FEATURED, sort_order=idx, thumbnail_url=f"/thumbnails/{slug}.svg", faqs=faqs(course), modules=[], assignments=[], quiz_questions=len(course["quiz"]))

            module_ids, lesson_minutes = [], max(12, (hours * 60 - 450) // n_lessons)
            for mi, (mtitle, lessons) in enumerate(course["modules"]):
                mid = uid(f"module:{slug}:{mi}")
                module_ids.append(mid)
                sql.append(f"insert into public.course_modules (id, course_id, title, position) values ({q(mid)}, {q(cid)}, {q(mtitle)}, {mi + 1}) "
                           "on conflict (id) do update set title = excluded.title, position = excluded.position;")
                pub_mod = {"title": mtitle, "lessons": []}
                for li, ltitle in enumerate(lessons):
                    lid = uid(f"lesson:{slug}:{mi}:{li}")
                    sql.append("insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values "
                               f"({q(lid)}, {q(mid)}, {q(cid)}, {q(ltitle)}, 'text', {q(lesson_body(course, mtitle, ltitle, mi, li))}, {lesson_minutes}, {li + 1}, {str(mi == 0 and li == 0).lower()}, true) "
                               "on conflict (id) do update set title = excluded.title, position = excluded.position;")
                    pub_mod["lessons"].append({"title": ltitle, "type": "text", "minutes": lesson_minutes, "preview": mi == 0 and li == 0})
                pub_course["modules"].append(pub_mod)

            # Assignments: one lesson each inside its module.
            slug_dir = tpl_root / slug
            slug_dir.mkdir(parents=True, exist_ok=True)
            for kind in ("document", "file", "practical", "scenario"):
                title, brief, deliverable = course["assignments"][kind]
                meta = KIND_META[kind]
                mi = meta["module"]
                mid = module_ids[mi]
                aid = uid(f"asg:{slug}:{kind}")
                lid = uid(f"asg-lesson:{slug}:{kind}")
                pos = 10 + list(KIND_META).index(kind)
                sql.append("insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values "
                           f"({q(lid)}, {q(mid)}, {q(cid)}, {q(meta['label'] + ': ' + title)}, 'assignment', null, {meta['minutes']}, {pos}, false, true) "
                           "on conflict (id) do update set title = excluded.title, duration_minutes = excluded.duration_minutes;")
                template_path = template_name = None
                scenario_text = None
                answer_key = {}
                if kind == "file":
                    template_name = f"{slug}-workbook.xlsx"
                    build_workbook(course, (title, brief), data, slug_dir / template_name)
                    template_path = f"bundled:{slug}/{template_name}"
                    answer_key = {"expected": data["key"], "answers_sheet_labels": data["answers"]}
                    instructions = brief + "\n\n**Tasks**\n" + "\n".join(f"{n}. {t}" for n, t in enumerate(data["tasks"], 1))
                    evaluator_notes = "Inspect formulas, not just values. Accept rounding differences under 1%. Hard-coded answers where formulas were requested lose 'Live, correct formulas' marks."
                elif kind == "document":
                    template_name = f"{slug}-brief.docx"
                    build_docx(course, (title, brief), DOC[slug], slug_dir / template_name)
                    template_path = f"bundled:{slug}/{template_name}"
                    answer_key = {"questions": [{"question": qq, "key_points": kp} for qq, kp in DOC[slug]]}
                    instructions = brief + "\n\n**Questions**\n" + "\n".join(f"{n}. {qq}" for n, (qq, _) in enumerate(DOC[slug], 1))
                    evaluator_notes = "Award marks for each key point covered with case-specific reasoning. Key points are indicative; accept well-argued alternatives."
                elif kind == "scenario":
                    scenario_text = brief
                    answer_key = {"key_points": SCENARIO[slug]}
                    instructions = "Read the scenario, then write your response. State your assumptions, then give your diagnosis, recommended actions and the risks."
                    evaluator_notes = "Strong answers cover the key points with specific, prioritised actions. Accept other sound approaches."
                else:
                    answer_key = {"must_include": [deliverable], "evidence": "Submission must include verifiable evidence (screenshots, links or files) of real work."}
                    instructions = brief + "\n\nUse a real or realistic business. Do not invent results: if something did not work, say so and explain what you learned."
                    evaluator_notes = "Do not reward claims without evidence. If evidence is missing or unverifiable, flag for human review."
                sql.append(
                    "insert into public.assignments (id, course_id, lesson_id, module_id, title, instructions, kind, summary, scenario, deliverables, submission_requirements, rubric, "
                    "max_score, pass_pct, template_path, template_name, accepted_types, allow_text, allow_links, ai_evaluation, estimated_minutes, position, is_mandatory, allow_file) values ("
                    f"{q(aid)}, {q(cid)}, {q(lid)}, {q(mid)}, {q(title)}, {q(instructions)}, {q(kind)}, {q(brief if kind != 'scenario' else 'Scenario challenge: respond as the decision-maker.')}, "
                    f"{q(scenario_text)}, {q(deliverable)}, {q('Accepted: ' + ', '.join(meta['accepted']).upper() + '. Maximum 20 MB.')}, {j(rubric_json(kind))}, 100, 50, "
                    f"{q(template_path)}, {q(template_name)}, {arr(meta['accepted'])}, {str(kind in ('scenario', 'practical')).lower()}, {str(kind == 'practical').lower()}, true, "
                    f"{meta['minutes']}, {pos}, true, true) on conflict (id) do update set title = excluded.title, instructions = excluded.instructions, kind = excluded.kind, "
                    "summary = excluded.summary, scenario = excluded.scenario, deliverables = excluded.deliverables, submission_requirements = excluded.submission_requirements, "
                    "rubric = excluded.rubric, template_path = coalesce(public.assignments.template_path, excluded.template_path), "
                    "template_name = coalesce(public.assignments.template_name, excluded.template_name), accepted_types = excluded.accepted_types, "
                    "allow_text = excluded.allow_text, allow_links = excluded.allow_links, estimated_minutes = excluded.estimated_minutes, position = excluded.position;")
                sql.append(f"insert into public.assignment_answer_keys (assignment_id, answer_key, evaluator_notes) values ({q(aid)}, {q(json.dumps(answer_key, ensure_ascii=False, indent=1))}, {q(evaluator_notes)}) "
                           "on conflict (assignment_id) do update set answer_key = excluded.answer_key, evaluator_notes = excluded.evaluator_notes;")
                pub_course["assignments"].append({"title": title, "kind": kind, "summary": brief if kind != "scenario" else "Scenario challenge", "module": mi, "minutes": meta["minutes"]})

            # Quiz: final knowledge check in the last module.
            last = module_ids[-1]
            qlid = uid(f"quiz-lesson:{slug}")
            qid = uid(f"quiz:{slug}")
            sql.append("insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values "
                       f"({q(qlid)}, {q(last)}, {q(cid)}, 'Course knowledge check', 'quiz', null, 15, 20, false, true) on conflict (id) do update set title = excluded.title;")
            sql.append("insert into public.quizzes (id, course_id, lesson_id, title, description, pass_pct, is_mandatory) values "
                       f"({q(qid)}, {q(cid)}, {q(qlid)}, 'Course knowledge check', 'Mixed question types. Marked instantly; you can retake it.', 60, true) "
                       "on conflict (id) do update set title = excluded.title, description = excluded.description;")
            for item in encode_quiz(slug, course["quiz"]):
                qqid = uid(f"qq:{slug}:{item['position']}")
                opts = "null" if item["options"] is None else j(item["options"])
                corr = "null" if item["correct"] is None else j(item["correct"])
                ci = "null" if item["correct_index"] is None else str(item["correct_index"])
                sql.append("insert into public.quiz_questions (id, quiz_id, qtype, context, prompt, options, correct_index, correct, explanation, points, position) values "
                           f"({q(qqid)}, {q(qid)}, {q(item['qtype'])}, {q(item['context'])}, {q(item['prompt'])}, {opts}, {ci}, {corr}, {q(item['explanation'])}, {item['points']}, {item['position']}) "
                           "on conflict (id) do update set qtype = excluded.qtype, context = excluded.context, prompt = excluded.prompt, options = excluded.options, "
                           "correct_index = excluded.correct_index, correct = excluded.correct, explanation = excluded.explanation, points = excluded.points, position = excluded.position;")
            public["courses"].append(pub_course)

    out = ROOT / "supabase" / "migrations" / "20261125000010_proofwork_catalogue.sql"
    out.write_text("\n".join(sql) + "\n")
    pj = ROOT / "src" / "lib" / "catalogue" / "catalogue.json"
    pj.parent.mkdir(parents=True, exist_ok=True)
    pj.write_text(json.dumps(public, ensure_ascii=False, indent=1) + "\n")
    print(f"Wrote {out.relative_to(ROOT)} ({len(public['courses'])} courses), {pj.relative_to(ROOT)}, templates and thumbnails.")


if __name__ == "__main__":
    main()
