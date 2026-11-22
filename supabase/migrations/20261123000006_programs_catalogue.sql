-- Replace the original 15 demo course listings with the four SkillSpring programs
-- (inserted by seed.sql). Only demo rows with no enrolments, orders or applications
-- are removed, so this never deletes anything a student has touched.
delete from public.courses c
where c.is_demo
  and c.slug in (
    'stock-market-fundamentals', 'technical-analysis-for-beginners', 'fundamental-analysis-equity-research',
    'financial-modelling-with-excel', 'advanced-excel-for-finance', 'generative-ai-for-students', 'prompt-engineering',
    'ai-tools-and-productivity', 'introduction-to-data-analytics', 'digital-marketing-fundamentals',
    'seo-and-content-marketing', 'social-media-marketing', 'resume-building-and-linkedin', 'interview-preparation',
    'business-communication')
  and not exists (select 1 from public.enrolments e where e.course_id = c.id)
  and not exists (select 1 from public.orders o where o.course_id = c.id);

delete from public.internships i
where i.is_demo
  and i.slug in ('equity-research-virtual-simulation', 'data-analytics-case-study', 'financial-modelling-project')
  and not exists (select 1 from public.internship_applications a where a.internship_id = i.id);

delete from public.categories cat
where cat.slug in ('finance-stock-market', 'technology-ai', 'business-marketing', 'career-development')
  and not exists (select 1 from public.courses c where c.category_id = cat.id);
