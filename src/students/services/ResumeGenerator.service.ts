import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger';

const execPromise = promisify(exec);

export interface ResumeData {
  personalInfo: {
    name: string;
    email: string;
    phone: string;
    linkedin: string;
    github?: string;
    rollNumber?: string;
    course?: string;
  };
  education: Array<{
    institution: string;
    degree: string;
    location: string;
    date: string;
    cgpa?: string;
    description?: string;
  }>;
  experience: Array<{
    company: string;
    role: string;
    location: string;
    date: string;
    description: string;
  }>;
  projects: Array<{
    name: string;
    date: string;
    description: string;
    link?: string;
    techStack?: string;
  }>;
  skills: Array<{
    category: string;
    items: string[];
  }>;
  achievements?: string[];
}

export class ResumeGeneratorService {
  private typstTemplatePath: string;
  private latexTemplatePath: string;
  private tempDir: string;

  constructor() {
    this.typstTemplatePath = path.join(__dirname, '../templates/resume_template.typ');
    this.latexTemplatePath = path.join(__dirname, '../templates/resume_professional.tex');
    this.tempDir = path.join(__dirname, '../../../temp/resumes');

    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  private latexEscape(text: string): string {
    if (!text) return '';
    return text
      .replace(/\\/g, '\\textbackslash ')
      .replace(/&/g, '\\&')
      .replace(/%/g, '\\%')
      .replace(/\$/g, '\\$')
      .replace(/#/g, '\\#')
      .replace(/_/g, '\\_')
      .replace(/{/g, '\\{')
      .replace(/}/g, '\\}')
      .replace(/~/g, '\\textasciitilde ')
      .replace(/\^/g, '\\textasciicircum ')
      .replace(/"/g, "''");
  }

  async generatePdf(data: ResumeData, templateType: string = 'classic'): Promise<Buffer> {
    if (templateType === 'professional') {
      return this.generateLatexPdf(data);
    }
    return this.generateTypstPdf(data);
  }

  private async generateTypstPdf(data: ResumeData): Promise<Buffer> {
    const id = uuidv4();
    const typFile = path.join(this.tempDir, `${id}.typ`);
    const pdfFile = path.join(this.tempDir, `${id}.pdf`);

    try {
      let template = fs.readFileSync(this.typstTemplatePath, 'utf-8');

      // Inject personal info
      template = template.replace('$NAME$', data.personalInfo.name);
      template = template.replace('$EMAIL$', data.personalInfo.email || '');
      template = template.replace('$PHONE$', data.personalInfo.phone || '');
      template = template.replace('$LINKEDIN$', data.personalInfo.linkedin || '');
      template = template.replace('$GITHUB$', data.personalInfo.github || '');

      // Inject Education
      const educationStr = data.education.map(ed => `
#entry(
  title: "${ed.institution}",
  subtitle: "${ed.degree}",
  location: "${ed.location}",
  date: "${ed.date}",
  description: [${ed.description || ""}]
)
      `).join('\n');
      template = template.replace('$EDUCATION$', educationStr);

      // Inject Experience
      const experienceStr = data.experience.map(exp => `
#entry(
  title: "${exp.company}",
  subtitle: "${exp.role}",
  location: "${exp.location}",
  date: "${exp.date}",
  description: [
    #list(
      ${exp.description.split('\n').filter(line => line.trim()).map(line => `[${line.trim()}]`).join(',\n      ')}
    )
  ]
)
      `).join('\n');
      template = template.replace('$EXPERIENCE$', experienceStr);

      // Inject Projects
      const projectsStr = data.projects.map(proj => `
#entry(
  title: "${proj.name}",
  date: "${proj.date}",
  description: [
    ${proj.link ? `#link("${proj.link}")[Project Link]\n` : ""}
    #list(
      ${proj.description.split('\n').filter(line => line.trim()).map(line => `[${line.trim()}]`).join(',\n      ')}
    )
  ]
)
      `).join('\n');
      template = template.replace('$PROJECTS$', projectsStr);

      // Inject Skills
      const skillsStr = data.skills.map(skill => `
#skill_category("${skill.category}", (${skill.items.map(item => `"${item}"`).join(', ')}))
      `).join('\n');
      template = template.replace('$SKILLS$', skillsStr);

      // Inject Achievements
      const achievementsStr = data.achievements ? `
#list(
  ${data.achievements.map(a => `[${a}]`).join(',\n  ')}
)
      ` : "";
      template = template.replace('$ACHIEVEMENTS$', achievementsStr);

      fs.writeFileSync(typFile, template);

      // Compile Typst to PDF
      const typstBin = process.env.TYPST_BIN ||
        (fs.existsSync('/home/kumar-anubhav/Downloads/typst-x86_64-unknown-linux-musl/typst')
          ? '/home/kumar-anubhav/Downloads/typst-x86_64-unknown-linux-musl/typst'
          : 'typst');
      await execPromise(`"${typstBin}" compile "${typFile}" "${pdfFile}"`);

      const pdfBuffer = fs.readFileSync(pdfFile);
      return pdfBuffer;

    } catch (error) {
      logger.error('Error in ResumeGeneratorService.generateTypstPdf', { error });
      throw error;
    } finally {
      // Cleanup
      if (fs.existsSync(typFile)) fs.unlinkSync(typFile);
      if (fs.existsSync(pdfFile)) fs.unlinkSync(pdfFile);
    }
  }

  private async generateLatexPdf(data: ResumeData): Promise<Buffer> {
    const id = uuidv4();
    const texFile = path.join(this.tempDir, `${id}.tex`);
    const pdfFile = path.join(this.tempDir, `${id}.pdf`);
    const templateDir = path.dirname(this.latexTemplatePath);

    try {
      let template = fs.readFileSync(this.latexTemplatePath, 'utf-8');

      // Helper for escaping
      const esc = (t: string) => this.latexEscape(t);

      // Inject personal info
      template = template.replace(/\$NAME\$/g, esc(data.personalInfo.name));
      template = template.replace(/\$EMAIL\$/g, esc(data.personalInfo.email || ''));
      template = template.replace(/\$PHONE\$/g, esc(data.personalInfo.phone || ''));
      template = template.replace(/\$LINKEDIN\$/g, esc(data.personalInfo.linkedin || ''));
      template = template.replace(/\$GITHUB\$/g, esc(data.personalInfo.github || ''));
      template = template.replace(/\$ROLL\$/g, esc(data.personalInfo.rollNumber || 'N/A'));
      template = template.replace(/\$COURSE\$/g, esc(data.personalInfo.course || 'Bachelor of Technology'));
      template = template.replace(/\$EMAIL_B\$/g, esc(data.personalInfo.email || '')); // Fallback

      // Inject Education
      const educationStr = data.education.map(ed => `
    \\resumeSubheading
      {${esc(ed.institution)}}{CGPA: ${esc(ed.cgpa || "N/A")}}
      {${esc(ed.degree)}}{${esc(ed.date)}}
      `).join('\n');
      template = template.replace('$EDUCATION$', educationStr);

      // Inject Experience
      const experienceStr = data.experience.map(exp => `
\\resumeSubheading
{${esc(exp.company)}}{${esc(exp.date)}}
{${esc(exp.role)}}{${esc(exp.location)}}
\\resumeItemListStart
${exp.description.split('\n').filter(line => line.trim()).map(line => `\\item ${esc(line.trim())}`).join('\n')}
\\resumeItemListEnd
      `).join('\n');
      template = template.replace('$EXPERIENCE$', experienceStr);

      // Inject Projects
      const projectsStr = data.projects.map(proj => `
\\resumeProject
{${esc(proj.name)}}
{${esc(proj.techStack || "")}}
{${esc(proj.link || "")}}
{${esc(proj.date)}}
\\resumeItemListStart
${proj.description.split('\n').filter(line => line.trim()).map(line => `\\item ${esc(line.trim())}`).join('\n')}
\\resumeItemListEnd
      `).join('\n');
      template = template.replace('$PROJECTS$', projectsStr);

      // Inject Skills
      const skillsStr = data.skills.map(skill => `
     \\textbf{${esc(skill.category)}:} ${esc(skill.items.join(', '))} \\\\
      `).join('\n');
      template = template.replace('$SKILLS$', skillsStr);

      // Inject Achievements
      const achievementsStr = data.achievements ? data.achievements.map(a => `
\\resumePOR{}{${esc(a)}}{}
      `).join('\n') : "";
      template = template.replace('$ACHIEVEMENTS$', achievementsStr);

      fs.writeFileSync(texFile, template);

      // Copy logo.png to temp dir for compilation
      const logoSource = path.join(templateDir, 'logo.png');
      const logoDest = path.join(this.tempDir, 'logo.png');
      if (fs.existsSync(logoSource) && !fs.existsSync(logoDest)) {
        fs.copyFileSync(logoSource, logoDest);
      }

      // Compile LaTeX to PDF
      // We run it twice to resolve references if any, though here it's likely fine with once
      await execPromise(`pdflatex -interaction=nonstopmode -output-directory="${this.tempDir}" "${texFile}"`);
      
      if (!fs.existsSync(pdfFile)) {
        throw new Error('LaTeX compilation failed to produce PDF');
      }

      const pdfBuffer = fs.readFileSync(pdfFile);
      return pdfBuffer;

    } catch (error) {
      logger.error('Error in ResumeGeneratorService.generateLatexPdf', { error });
      throw error;
    } finally {
      // Cleanup
      if (fs.existsSync(texFile)) fs.unlinkSync(texFile);
      if (fs.existsSync(pdfFile)) fs.unlinkSync(pdfFile);
      const auxFile = texFile.replace('.tex', '.aux');
      const logFile = texFile.replace('.tex', '.log');
      const outFile = texFile.replace('.tex', '.out');
      if (fs.existsSync(auxFile)) fs.unlinkSync(auxFile);
      if (fs.existsSync(logFile)) fs.unlinkSync(logFile);
      if (fs.existsSync(outFile)) fs.unlinkSync(outFile);
    }
  }
}
