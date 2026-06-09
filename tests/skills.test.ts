import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import matter from 'gray-matter';
import { describe, expect, it } from 'vitest';
import { MODELS } from '@/src/ai/models';
import { buildInstructions, loadSkill } from '@/src/lib/skills';

const SKILLS_DIR = join(process.cwd(), 'src', 'skills');
const skillFiles = readdirSync(SKILLS_DIR).filter((f) => f.endsWith('.md'));
const skillIds = skillFiles.map((f) => basename(f, '.md'));

describe('src/skills', () => {
  it('tem ao menos um playbook', () => {
    expect(skillFiles.length).toBeGreaterThan(0);
  });
});

describe.each(skillIds)('skill "%s"', (id) => {
  it('loadSkill parseia frontmatter coerente com SkillMeta', () => {
    const skill = loadSkill(id);

    // id do frontmatter bate com o nome do arquivo
    expect(skill.meta.id).toBe(id);

    // campos obrigatórios
    expect(typeof skill.meta.nome).toBe('string');
    expect(skill.meta.nome.length).toBeGreaterThan(0);
    expect(Object.keys(MODELS)).toContain(skill.meta.modelTier);

    // opcionais, quando presentes, têm o tipo certo
    if (skill.meta.quandoUsar !== undefined) {
      expect(typeof skill.meta.quandoUsar).toBe('string');
    }
    if (skill.meta.tools !== undefined) {
      expect(Array.isArray(skill.meta.tools)).toBe(true);
      for (const tool of skill.meta.tools) {
        expect(typeof tool).toBe('string');
      }
    }

    // corpo não-vazio (o playbook em si)
    expect(skill.body.length).toBeGreaterThan(0);
  });

  it('o corpo retornado bate com o markdown real do arquivo', () => {
    const raw = readFileSync(join(SKILLS_DIR, `${id}.md`), 'utf8');
    const { content } = matter(raw);
    expect(loadSkill(id).body).toBe(content.trim());
  });

  it('buildInstructions retorna string não-vazia contendo o corpo', () => {
    const skill = loadSkill(id);
    const instructions = buildInstructions(id);

    expect(instructions.length).toBeGreaterThan(0);
    expect(instructions).toContain(`# Você é: ${skill.meta.nome}`);
    expect(instructions).toContain(skill.body);
  });

  it('buildInstructions anexa o extra após o separador', () => {
    const extra = 'Contexto adicional de teste.';
    const instructions = buildInstructions(id, extra);
    expect(instructions).toContain('---');
    expect(instructions).toContain(extra);
  });
});
