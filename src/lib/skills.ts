import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';
import type { ModelTier } from '@/src/ai/models';

/**
 * Metadados do frontmatter de um arquivo de skill (playbook) em src/skills/*.md.
 * Os playbooks são editáveis sem tocar no código — é a base de conhecimento
 * versionada de cada persona.
 */
export interface SkillMeta {
  id: string;
  nome: string;
  modelTier: ModelTier;
  quandoUsar?: string;
  tools?: string[];
}

export interface Skill {
  meta: SkillMeta;
  /** Corpo em markdown: quando se aplica, passo a passo, faça/não faça, exemplos. */
  body: string;
}

const SKILLS_DIR = join(process.cwd(), 'src', 'skills');
const cache = new Map<string, Skill>();

export function loadSkill(id: string): Skill {
  // Em dev não cacheia, para os playbooks poderem ser editados a quente.
  if (process.env.NODE_ENV === 'production') {
    const hit = cache.get(id);
    if (hit) return hit;
  }

  const raw = readFileSync(join(SKILLS_DIR, `${id}.md`), 'utf8');
  const { data, content } = matter(raw);
  const skill: Skill = { meta: data as SkillMeta, body: content.trim() };

  if (process.env.NODE_ENV === 'production') cache.set(id, skill);
  return skill;
}

/** Monta o `instructions` (system prompt) de um agente a partir do playbook. */
export function buildInstructions(id: string, extra?: string): string {
  const { meta, body } = loadSkill(id);
  return [
    `# Você é: ${meta.nome}`,
    meta.quandoUsar ? `Quando você atua: ${meta.quandoUsar}` : '',
    '',
    body,
    extra ? `\n---\n\n${extra}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
