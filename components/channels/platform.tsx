import * as React from 'react';
import { Camera, MessageCircle, MessagesSquare } from 'lucide-react';
import type { ChannelPlatform } from '@/src/domain/channels';

/**
 * Identidade visual de cada plataforma (ícone + cor de destaque), compartilhada
 * pelos componentes de Canais. WhatsApp não tem ícone próprio no lucide, então
 * usamos MessageCircle com a cor da marca.
 */
export const PLATFORM_UI: Record<
  ChannelPlatform,
  { label: string; Icon: React.ComponentType<{ className?: string }>; cor: string }
> = {
  whatsapp: { label: 'WhatsApp', Icon: MessageCircle, cor: '#25D366' },
  instagram: { label: 'Instagram', Icon: Camera, cor: '#E1306C' },
  messenger: { label: 'Messenger', Icon: MessagesSquare, cor: '#0084FF' },
};

/** Selo redondo com o ícone da plataforma, na cor da marca. */
export function PlatformBadge({
  platform,
  className,
}: {
  platform: ChannelPlatform;
  className?: string;
}) {
  const { Icon, cor } = PLATFORM_UI[platform];
  return (
    <span
      className={className ?? 'flex size-9 shrink-0 items-center justify-center rounded-full'}
      style={{ backgroundColor: `${cor}1a`, color: cor }}
    >
      <Icon className="size-4" />
    </span>
  );
}
