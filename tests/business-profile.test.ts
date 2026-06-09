import { describe, expect, it } from 'vitest';
import {
  BusinessProfileSchema,
  PartialBusinessProfileSchema,
} from '@/src/domain/business-profile';

// Perfil completo, com todos os campos (inclusive opcionais).
const perfilCompleto = {
  nomeNegocio: 'Padaria do Bairro',
  setor: 'Alimentação',
  produtoServico: 'Pães artesanais e café da manhã',
  publicoAlvo: 'Moradores do bairro que valorizam produtos frescos',
  regiao: 'Curitiba/PR',
  canaisAtuais: ['Instagram', 'WhatsApp'],
  principaisDores: ['Pouco movimento durante a semana'],
  diferenciais: ['Fermentação natural'],
  ticketMedio: 'R$ 35',
  objetivos: ['Aumentar vendas em 20% em 6 meses'],
};

describe('BusinessProfileSchema', () => {
  it('aceita um perfil completo', () => {
    const result = BusinessProfileSchema.safeParse(perfilCompleto);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(perfilCompleto);
    }
  });

  it('aceita perfil sem opcionais e aplica defaults nos arrays', () => {
    const minimo = {
      nomeNegocio: 'Padaria do Bairro',
      setor: 'Alimentação',
      produtoServico: 'Pães artesanais',
      publicoAlvo: 'Moradores do bairro',
    };
    const result = BusinessProfileSchema.safeParse(minimo);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.regiao).toBeUndefined();
      expect(result.data.ticketMedio).toBeUndefined();
      expect(result.data.canaisAtuais).toEqual([]);
      expect(result.data.principaisDores).toEqual([]);
      expect(result.data.diferenciais).toEqual([]);
      expect(result.data.objetivos).toEqual([]);
    }
  });

  it('rejeita perfil sem campos obrigatórios', () => {
    expect(BusinessProfileSchema.safeParse({}).success).toBe(false);
    expect(
      BusinessProfileSchema.safeParse({ nomeNegocio: 'Só o nome' }).success,
    ).toBe(false);
  });

  it('rejeita tipos errados', () => {
    const result = BusinessProfileSchema.safeParse({
      ...perfilCompleto,
      canaisAtuais: 'Instagram', // deveria ser array
    });
    expect(result.success).toBe(false);
  });
});

describe('PartialBusinessProfileSchema', () => {
  it('aceita objeto vazio (onboarding incompleto)', () => {
    expect(PartialBusinessProfileSchema.safeParse({}).success).toBe(true);
  });

  it('ainda valida os tipos dos campos presentes', () => {
    expect(
      PartialBusinessProfileSchema.safeParse({ nomeNegocio: 123 }).success,
    ).toBe(false);
  });
});
