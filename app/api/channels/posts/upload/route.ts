import { falha, naoAutenticado, negocioAtual } from '@/src/lib/api';
import { blobConfigurado, uploadImagem } from '@/src/lib/blob';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Tamanho máximo da imagem aceita no upload (8 MB). */
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * POST /api/channels/posts/upload — sobe uma imagem (multipart, campo "file")
 * para o Vercel Blob e devolve a URL pública (necessária para publicar no
 * Instagram). Sem o Blob configurado, responde 400 amigável e a UI segue só com
 * texto (Facebook) ou em simulação.
 */
export async function POST(req: Request) {
  const businessId = await negocioAtual();
  if (!businessId) return naoAutenticado();

  if (!blobConfigurado()) {
    return falha(
      new Error(
        'Armazenamento de imagens não configurado (BLOB_READ_WRITE_TOKEN). Veja docs/omnichannel-setup.md.',
      ),
    );
  }

  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return falha(new Error('Envie um arquivo de imagem no campo "file".'));
    }
    if (!file.type.startsWith('image/')) {
      return falha(new Error('O arquivo precisa ser uma imagem.'));
    }
    if (file.size > MAX_BYTES) {
      return falha(new Error('Imagem muito grande (máx. 8 MB).'));
    }
    const { url } = await uploadImagem(businessId, file, {
      nome: file.name || 'imagem',
      contentType: file.type,
    });
    return Response.json({ ok: true, url });
  } catch (err) {
    return falha(err);
  }
}
