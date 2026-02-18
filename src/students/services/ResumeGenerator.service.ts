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
  };
  education: Array<{
    institution: string;
    degree: string;
    location: string;
    date: string;
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
  }>;
  skills: Array<{
    category: string;
    items: string[];
  }>;
  achievements?: string[];
}

export class ResumeGeneratorService {
  private templatePath: string;
  private tempDir: string;

  constructor() {
    this.templatePath = path.join(__dirname, '../templates/resume_template.typ');
    this.tempDir = path.join(__dirname, '../../../temp/resumes');

    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async generatePdf(data: ResumeData): Promise<Buffer> {
    const id = uuidv4();
    const typFile = path.join(this.tempDir, `${id}.typ`);
    const pdfFile = path.join(this.tempDir, `${id}.pdf`);

    try {
      let template = fs.readFileSync(this.templatePath, 'utf-8');

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
      logger.error('Error in ResumeGeneratorService.generatePdf', { error });
      throw error;
    } finally {
      // Cleanup
      if (fs.existsSync(typFile)) fs.unlinkSync(typFile);
      if (fs.existsSync(pdfFile)) fs.unlinkSync(pdfFile);
    }
  }
}
