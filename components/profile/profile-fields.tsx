import type { BusinessProfile } from '@/src/domain/business-profile';

/**
 * Renderiza os campos do Perfil do Negócio. Compartilhado entre o card de
 * confirmação no chat (onboarding) e a aba "Memórias" (perfil já confirmado),
 * para que as duas telas mostrem o perfil exatamente do mesmo jeito.
 */
export function ProfileFields({ profile }: { profile: BusinessProfile }) {
  return (
    <div className="space-y-3 text-sm">
      <Campo rotulo="Nome" valor={profile.nomeNegocio} />
      <Campo rotulo="Setor" valor={profile.setor} />
      <Campo rotulo="Produto / serviço" valor={profile.produtoServico} />
      <Campo rotulo="Público-alvo" valor={profile.publicoAlvo} />
      {profile.regiao ? <Campo rotulo="Região" valor={profile.regiao} /> : null}
      {profile.ticketMedio ? (
        <Campo rotulo="Ticket médio" valor={profile.ticketMedio} />
      ) : null}
      <CampoLista rotulo="Canais atuais" itens={profile.canaisAtuais} />
      <CampoLista rotulo="Principais dores" itens={profile.principaisDores} />
      <CampoLista rotulo="Diferenciais" itens={profile.diferenciais} />
      <CampoLista rotulo="Objetivos" itens={profile.objetivos} />
    </div>
  );
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {rotulo}
      </p>
      <p className="break-words text-foreground">{valor}</p>
    </div>
  );
}

function CampoLista({ rotulo, itens }: { rotulo: string; itens: string[] }) {
  if (!itens || itens.length === 0) return null;
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {rotulo}
      </p>
      <ul className="ml-4 list-disc text-foreground">
        {itens.map((it, i) => (
          <li key={i} className="break-words">
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}
