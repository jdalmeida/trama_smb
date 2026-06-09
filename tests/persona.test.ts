import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PERSONA_IDS } from '@/src/domain/persona';

const SKILLS_DIR = join(process.cwd(), 'src', 'skills');

describe('PERSONA_IDS', () => {
  it('não tem duplicatas', () => {
    expect(new Set(PERSONA_IDS).size).toBe(PERSONA_IDS.length);
  });

  it('não está vazio', () => {
    expect(PERSONA_IDS.length).toBeGreaterThan(0);
  });

  it.each([...PERSONA_IDS])('"%s" é um id kebab-case válido', (id) => {
    expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  // Cada persona precisa de um playbook em src/skills/<id>.md — é dele
  // que vêm o nome (label) e as instructions do agente.
  it.each([...PERSONA_IDS])('"%s" tem playbook correspondente em src/skills', (id) => {
    expect(existsSync(join(SKILLS_DIR, `${id}.md`))).toBe(true);
  });
});
