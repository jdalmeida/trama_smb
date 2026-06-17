'use client';

import * as React from 'react';
import { Plug, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { Modal } from '@/components/crm/modal';

/**
 * Conexão do WhatsApp — dois caminhos, lado a lado:
 *
 *  1. **Manual** (Cloud API clássica): o dono cola phone_number_id, waba_id e um
 *     token (System User) pegos no painel da Meta. Funciona sem Tech Provider.
 *  2. **Embedded Signup** (coexistência): abre o popup da Meta via SDK JS, que
 *     provisiona/seleciona a WABA e o número (e o QR code de coexistência) e
 *     devolve phone_number_id + waba_id + um code. Requer app aprovado como
 *     Tech Provider e uma config de Login for Business de coexistência.
 */

interface FBLoginResponse {
  authResponse?: { code?: string } | null;
  status?: string;
}

declare global {
  interface Window {
    FB?: {
      init: (opts: Record<string, unknown>) => void;
      login: (cb: (r: FBLoginResponse) => void, opts: Record<string, unknown>) => void;
    };
    fbAsyncInit?: () => void;
  }
}

const APP_ID = process.env.NEXT_PUBLIC_META_APP_ID;
const CONFIG_ID = process.env.NEXT_PUBLIC_META_LOGIN_CONFIG_ID;
const VERSION = process.env.NEXT_PUBLIC_META_GRAPH_VERSION || 'v21.0';

export function WhatsAppConnect({ onRefresh }: { onRefresh: () => void }) {
  const [manualAberto, setManualAberto] = React.useState(false);
  const [enviando, setEnviando] = React.useState(false);
  // Dados capturados do evento WA_EMBEDDED_SIGNUP (chegam antes do callback).
  const sessao = React.useRef<{ phoneNumberId?: string; wabaId?: string }>({});

  const embeddedDisponivel = Boolean(APP_ID && CONFIG_ID);

  // Carrega o SDK do Facebook uma única vez (só no cliente).
  React.useEffect(() => {
    if (!APP_ID || document.getElementById('facebook-jssdk')) return;
    window.fbAsyncInit = () => {
      window.FB?.init({
        appId: APP_ID,
        autoLogAppEvents: true,
        xfbml: false,
        version: VERSION,
      });
    };
    const s = document.createElement('script');
    s.id = 'facebook-jssdk';
    s.src = 'https://connect.facebook.net/en_US/sdk.js';
    s.async = true;
    s.defer = true;
    s.crossOrigin = 'anonymous';
    document.body.appendChild(s);
  }, []);

  // Escuta o evento do Embedded Signup com phone_number_id e waba_id.
  React.useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (typeof event.origin !== 'string' || !event.origin.endsWith('facebook.com')) return;
      try {
        const data = JSON.parse(event.data);
        if (data?.type === 'WA_EMBEDDED_SIGNUP' && data?.data) {
          if (data.data.phone_number_id) sessao.current.phoneNumberId = data.data.phone_number_id;
          if (data.data.waba_id) sessao.current.wabaId = data.data.waba_id;
        }
      } catch {
        // mensagens não-JSON do SDK: ignora
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  async function enviarEmbedded(code: string, phoneNumberId: string, wabaId: string) {
    setEnviando(true);
    try {
      const res = await fetch('/api/channels/whatsapp/embedded', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, phoneNumberId, wabaId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.erro ?? 'Falha ao concluir o Embedded Signup');
      }
      toast({ variant: 'success', title: 'WhatsApp conectado (coexistência)' });
      onRefresh();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Não foi possível conectar' });
    } finally {
      setEnviando(false);
    }
  }

  function lancarEmbedded() {
    if (!window.FB) {
      toast({ title: 'SDK da Meta ainda carregando — tente de novo em instantes' });
      return;
    }
    sessao.current = {};
    window.FB.login(
      (response) => {
        const code = response.authResponse?.code;
        if (!code) {
          toast({ title: 'Login cancelado' });
          return;
        }
        const { phoneNumberId, wabaId } = sessao.current;
        if (!phoneNumberId || !wabaId) {
          toast({ title: 'Não recebi os dados do número. Refaça o fluxo até o fim.' });
          return;
        }
        void enviarEmbedded(code, phoneNumberId, wabaId);
      },
      {
        config_id: CONFIG_ID,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          setup: {},
          // Ativa o fluxo de coexistência (onboarding do app WhatsApp Business).
          featureType: 'whatsapp_business_app_onboarding',
          sessionInfoVersion: '3',
        },
      },
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5"
        onClick={() => setManualAberto(true)}
      >
        <KeyRound className="size-3.5" aria-hidden />
        Conectar manualmente
      </Button>
      <Button
        size="sm"
        className="gap-1.5"
        disabled={!embeddedDisponivel || enviando}
        onClick={lancarEmbedded}
        title={
          embeddedDisponivel
            ? 'Coexistência via Embedded Signup (requer app aprovado como Tech Provider)'
            : 'Configure NEXT_PUBLIC_META_APP_ID e NEXT_PUBLIC_META_LOGIN_CONFIG_ID'
        }
      >
        <Plug className="size-3.5" aria-hidden />
        Embedded Signup
      </Button>

      {manualAberto ? (
        <WhatsAppManualModal
          onClose={() => setManualAberto(false)}
          onSaved={() => {
            setManualAberto(false);
            onRefresh();
          }}
        />
      ) : null}
    </div>
  );
}

/** Modal do caminho manual (Cloud API clássica via token). */
function WhatsAppManualModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [phoneNumberId, setPhoneNumberId] = React.useState('');
  const [wabaId, setWabaId] = React.useState('');
  const [accessToken, setAccessToken] = React.useState('');
  const [nome, setNome] = React.useState('');
  const [salvando, setSalvando] = React.useState(false);

  async function salvar() {
    if (!phoneNumberId.trim() || !wabaId.trim() || !accessToken.trim()) {
      toast({ title: 'Preencha phone_number_id, waba_id e o token' });
      return;
    }
    setSalvando(true);
    try {
      const res = await fetch('/api/channels/whatsapp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumberId: phoneNumberId.trim(),
          wabaId: wabaId.trim(),
          accessToken: accessToken.trim(),
          nome: nome.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.erro ?? 'Falha ao conectar');
      }
      toast({ variant: 'success', title: 'WhatsApp conectado' });
      onSaved();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Não foi possível conectar' });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      titulo="Conectar WhatsApp (manual)"
      onClose={onClose}
      footer={
        <>
          <Button size="sm" onClick={() => void salvar()} disabled={salvando}>
            {salvando ? 'Conectando…' : 'Conectar'}
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">
          Pegue estes valores no painel da Meta em <strong>WhatsApp → Configuração da API</strong>.
          Use um token de <strong>System User</strong> (permanente) para a conexão não expirar.
        </p>
        <Campo label="phone_number_id" valor={phoneNumberId} onChange={setPhoneNumberId} placeholder="Ex.: 123456789012345" />
        <Campo label="waba_id (WhatsApp Business Account ID)" valor={wabaId} onChange={setWabaId} placeholder="Ex.: 987654321098765" />
        <Campo label="Token de acesso" valor={accessToken} onChange={setAccessToken} placeholder="System User access token" tipo="password" />
        <Campo label="Nome de exibição (opcional)" valor={nome} onChange={setNome} placeholder="Ex.: Atendimento" />
      </div>
    </Modal>
  );
}

function Campo({
  label,
  valor,
  onChange,
  placeholder,
  tipo,
}: {
  label: string;
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
  tipo?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Input
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type={tipo}
      />
    </label>
  );
}
