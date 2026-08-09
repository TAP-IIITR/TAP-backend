/**
 * Renders a clean, ATS-friendly HTML resume from the Resume Builder payload.
 * The frontend opens the HTML in a new tab where it can be printed to PDF.
 */

interface PersonalInfo {
  name?: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
  address?: string;
  rollNumber?: string;
  course?: string;
}

interface EducationEntry {
  institution?: string;
  degree?: string;
  location?: string;
  date?: string;
  cgpa?: string;
  description?: string;
}

interface ExperienceEntry {
  company?: string;
  role?: string;
  location?: string;
  date?: string;
  description?: string;
}

interface ProjectEntry {
  name?: string;
  date?: string;
  description?: string;
  link?: string;
  techStack?: string;
}

interface SkillCategory {
  category?: string;
  items?: string[];
}

interface ResumeData {
  personalInfo?: PersonalInfo;
  education?: EducationEntry[];
  experience?: ExperienceEntry[];
  projects?: ProjectEntry[];
  skills?: SkillCategory[];
  achievements?: string[];
  sectionOrder?: string[];
}

const esc = (v: unknown): string =>
  String(v ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );

// Only allow safe URL schemes in resume links (blocks javascript:, data:, etc.).
const safeUrl = (v: unknown): string => {
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (/^www\./i.test(s)) return `https://${s}`;
  return "";
};

const bulletLines = (text?: string): string =>
  (text ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `<li>${esc(l)}</li>`)
    .join("");

const sectionStyles = (template: string): string => {
  switch (template) {
    case "modern":
      return `body { font-family: 'Segoe UI', Arial, sans-serif; color: #111827; }
        h1 { color: #1d4ed8; }
        .section-title { border-bottom: 2px solid #1d4ed8; color: #1d4ed8; }
        .contact { color: #374151; }`;
    case "minimal":
      return `body { font-family: Georgia, serif; color: #111827; }
        h1 { letter-spacing: 1px; }
        .section-title { border-bottom: 1px solid #9ca3af; text-transform: uppercase; letter-spacing: 1.5px; font-size: 13px; }
        .contact { color: #4b5563; }`;
    case "professional":
      return `body { font-family: 'Palatino Linotype', 'Book Antiqua', Palatino, serif; color: #1f2937; }
        h1 { color: #374151; }
        .section-title { border-bottom: 2px solid #374151; color: #374151; }
        .contact { color: #4b5563; }`;
    default: // classic
      return `body { font-family: 'Times New Roman', serif; color: #000; }
        h1 { color: #000; }
        .section-title { border-bottom: 1.5px solid #000; text-transform: uppercase; letter-spacing: 1px; }
        .contact { color: #333; }`;
  }
};

const renderSectionTitle = (title: string): string =>
  `<h2 class="section-title" style="font-size:15px;margin:18px 0 8px;padding-bottom:4px;font-weight:700;">${esc(title)}</h2>`;

export const renderResumeHtml = (
  data: ResumeData,
  template: string = "classic"
): string => {
  const p = data.personalInfo || {};
  const edu = (data.education || []).filter((e) => e.institution?.trim());
  const exp = (data.experience || []).filter((e) => e.company?.trim() || e.role?.trim());
  const proj = (data.projects || []).filter((x) => x.name?.trim());
  const skills = (data.skills || []).filter((s) => s.category?.trim() || s.items?.some((i) => i.trim()));
  const achievements = (data.achievements || []).map((a) => a.trim()).filter(Boolean);

  const contact = [
    p.email && `Email: ${esc(p.email)}`,
    p.phone && `Phone: ${esc(p.phone)}`,
    safeUrl(p.linkedin) && `LinkedIn: ${esc(safeUrl(p.linkedin))}`,
    safeUrl(p.github) && `GitHub: ${esc(safeUrl(p.github))}`,
    safeUrl(p.portfolio) && `Portfolio: ${esc(safeUrl(p.portfolio))}`,
    p.address && `Address: ${esc(p.address)}`,
  ].filter(Boolean);

  const parts: string[] = [];

  parts.push(`<h1 style="font-size:26px;margin:0 0 4px;">${esc(p.name || "Your Name")}</h1>`);
  if (p.course) parts.push(`<p style="margin:0 0 2px;font-size:14px;">${esc(p.course)}</p>`);
  if (p.rollNumber) parts.push(`<p style="margin:0 0 2px;font-size:13px;">Roll No: ${esc(p.rollNumber)}</p>`);
  if (contact.length) {
    parts.push(`<p class="contact" style="font-size:13px;margin:6px 0 0;">${contact.join(" &nbsp;•&nbsp; ")}</p>`);
  }

  if (edu.length) {
    parts.push(renderSectionTitle("Education"));
    parts.push(
      edu
        .map(
          (e) => `<div style="margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;font-weight:600;">
              <span>${esc(e.degree || "")}${e.institution ? ` — ${esc(e.institution)}` : ""}</span>
              <span>${esc(e.date || "")}</span>
            </div>
            ${e.location ? `<div style="font-size:13px;color:#4b5563;">${esc(e.location)}</div>` : ""}
            ${e.cgpa ? `<div style="font-size:13px;">CGPA: ${esc(e.cgpa)}</div>` : ""}
            ${e.description ? `<ul style="margin:4px 0 0 18px;font-size:13px;">${bulletLines(e.description)}</ul>` : ""}
          </div>`
        )
        .join("")
    );
  }

  if (exp.length) {
    parts.push(renderSectionTitle("Experience"));
    parts.push(
      exp
        .map(
          (e) => `<div style="margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;font-weight:600;">
              <span>${esc(e.role || "")}${e.company ? ` — ${esc(e.company)}` : ""}</span>
              <span>${esc(e.date || "")}</span>
            </div>
            ${e.location ? `<div style="font-size:13px;color:#4b5563;">${esc(e.location)}</div>` : ""}
            ${e.description ? `<ul style="margin:4px 0 0 18px;font-size:13px;">${bulletLines(e.description)}</ul>` : ""}
          </div>`
        )
        .join("")
    );
  }

  if (proj.length) {
    parts.push(renderSectionTitle("Projects"));
    parts.push(
      proj
        .map(
          (x) => `<div style="margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;font-weight:600;">
            <span>${esc(x.name || "")}${safeUrl(x.link) ? ` (<a href="${esc(safeUrl(x.link))}" style="font-weight:400;">link</a>)` : ""}</span>
            <span>${esc(x.date || "")}</span>
          </div>
            ${x.techStack ? `<div style="font-size:13px;color:#4b5563;">Tech: ${esc(x.techStack)}</div>` : ""}
            ${x.description ? `<ul style="margin:4px 0 0 18px;font-size:13px;">${bulletLines(x.description)}</ul>` : ""}
          </div>`
        )
        .join("")
    );
  }

  if (skills.length) {
    parts.push(renderSectionTitle("Skills"));
    parts.push(
      skills
        .map(
          (s) =>
            `<div style="margin-bottom:4px;font-size:13px;"><strong>${esc(s.category || "")}:</strong> ${esc(
              (s.items || []).filter((i) => i.trim()).join(", ")
            )}</div>`
        )
        .join("")
    );
  }

  if (achievements.length) {
    parts.push(renderSectionTitle("Achievements"));
    parts.push(`<ul style="margin:4px 0 0 18px;font-size:13px;">${achievements.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>`);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(p.name || "Resume")}</title>
<style>
  * { box-sizing: border-box; }
  body { max-width: 800px; margin: 32px auto; padding: 0 24px; line-height: 1.45; }
  ${sectionStyles(template)}
  @media print { body { margin: 0; } }
</style>
</head>
<body>${parts.join("\n")}</body>
</html>`;
};
