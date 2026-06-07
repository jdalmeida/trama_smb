import type { NextConfig } from 'next';
import { withWorkflow } from 'workflow/next';

const nextConfig: NextConfig = {
  // As personas leem seus "playbooks" (src/skills/*.md) em runtime.
  // Garante que esses arquivos sejam incluídos no bundle das rotas/steps em produção.
  outputFileTracingIncludes: {
    '/api/**': ['./src/skills/**'],
  },
};

export default withWorkflow(nextConfig);
