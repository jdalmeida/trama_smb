import { describe, expect, it } from 'vitest';
import * as deliverable from '@/src/domain/deliverable';
import {
  ContentPlanSchema,
  MarketResearchSchema,
  type DeliverableContent,
} from '@/src/domain/deliverable';
import { z } from 'zod';

const contentPlanValido = {
  resumo: 'Plano de presença digital para a padaria.',
  posicionamento: 'A padaria artesanal de bairro com fermentação natural.',
  canais: [
    {
      canal: 'Instagram',
      porque: 'Público local e apelo visual dos produtos',
      frequencia: '3x/semana',
    },
  ],
  calendario: [
    {
      dia: 'Seg, semana 1',
      canal: 'Instagram',
      formato: 'Reels',
      tema: 'Bastidores da fornada',
      gancho: 'Como nasce o pão de fermentação natural',
    },
  ],
  ideiasProntas: [
    {
      titulo: 'Fornada do dia',
      canal: 'Instagram',
      texto: 'Saiu agora do forno! Venha provar o pão do dia.',
    },
  ],
};

const marketResearchValido = {
  panorama: 'Mercado de padarias artesanais em crescimento na região.',
  concorrentes: [
    {
      nome: 'Padaria Concorrente',
      oQueFazem: 'Pães e confeitaria tradicional',
      forcas: ['Localização central'],
      brechas: ['Sem presença digital'],
      fonte: 'https://exemplo.com.br',
    },
  ],
  segmentos: [
    {
      nome: 'Famílias do bairro',
      descricao: 'Compram pão diariamente',
      comoAlcancar: 'Instagram e Google Meu Negócio',
    },
  ],
  sugestoesPosicionamento: ['A padaria artesanal mais próxima de você'],
};

describe('ContentPlanSchema', () => {
  it('aceita um plano de conteúdo válido', () => {
    expect(ContentPlanSchema.safeParse(contentPlanValido).success).toBe(true);
  });

  it('rejeita plano sem campos obrigatórios', () => {
    expect(ContentPlanSchema.safeParse({}).success).toBe(false);
    const { canais: _canais, ...semCanais } = contentPlanValido;
    expect(ContentPlanSchema.safeParse(semCanais).success).toBe(false);
  });

  it('rejeita itens malformados dentro dos arrays', () => {
    const invalido = {
      ...contentPlanValido,
      canais: [{ canal: 'Instagram' }], // faltam porque/frequencia
    };
    expect(ContentPlanSchema.safeParse(invalido).success).toBe(false);
  });
});

describe('MarketResearchSchema', () => {
  it('aceita uma pesquisa de mercado válida', () => {
    expect(MarketResearchSchema.safeParse(marketResearchValido).success).toBe(true);
  });

  it('aplica defaults em forcas/brechas e mantém fonte opcional', () => {
    const semOpcionais = {
      ...marketResearchValido,
      concorrentes: [
        { nome: 'Outra Padaria', oQueFazem: 'Pães de forma industriais' },
      ],
    };
    const result = MarketResearchSchema.safeParse(semOpcionais);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.concorrentes[0].forcas).toEqual([]);
      expect(result.data.concorrentes[0].brechas).toEqual([]);
      expect(result.data.concorrentes[0].fonte).toBeUndefined();
    }
  });

  it('rejeita pesquisa sem campos obrigatórios', () => {
    expect(MarketResearchSchema.safeParse({}).success).toBe(false);
    const { panorama: _p, ...semPanorama } = marketResearchValido;
    expect(MarketResearchSchema.safeParse(semPanorama).success).toBe(false);
  });
});

describe('schemas exportados (genérico)', () => {
  // Se outro agente adicionar um novo schema de entregável, ele entra aqui
  // automaticamente: todo export *Schema deve ser um schema Zod de objeto.
  const schemas = Object.entries(deliverable).filter(
    ([nome]) => nome.endsWith('Schema'),
  );

  it('exporta ao menos os schemas conhecidos', () => {
    const nomes = schemas.map(([nome]) => nome);
    expect(nomes).toContain('ContentPlanSchema');
    expect(nomes).toContain('MarketResearchSchema');
  });

  it.each(schemas)('%s é um schema Zod que rejeita entrada vazia', (_nome, schema) => {
    expect(schema).toBeInstanceOf(z.ZodType);
    // Nenhum entregável faz sentido como objeto vazio.
    expect((schema as z.ZodType).safeParse({}).success).toBe(false);
  });
});

describe('DeliverableContent (discriminação por tipo)', () => {
  // O union é um tipo TS (não Zod); validamos a discriminação via narrowing.
  // O default mantém o teste compilando se novas variantes forem adicionadas.
  function descreve(content: DeliverableContent): string {
    switch (content.tipo) {
      case 'plano-conteudo':
        // narrowing: campos de ContentPlan acessíveis
        return content.resumo;
      case 'pesquisa-mercado':
        // narrowing: campos de MarketResearch acessíveis
        return content.panorama;
      case 'texto':
        return content.texto;
      default:
        return content.tipo;
    }
  }

  it('discrimina cada variante por tipo', () => {
    const plano: DeliverableContent = { tipo: 'plano-conteudo', ...contentPlanValido };
    const pesquisa: DeliverableContent = {
      tipo: 'pesquisa-mercado',
      ...marketResearchValido,
    };
    const texto: DeliverableContent = { tipo: 'texto', texto: 'Resposta simples' };

    expect(descreve(plano)).toBe(contentPlanValido.resumo);
    expect(descreve(pesquisa)).toBe(marketResearchValido.panorama);
    expect(descreve(texto)).toBe('Resposta simples');
  });
});
