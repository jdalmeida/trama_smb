import { put } from '@vercel/blob';

/**
 * Armazenamento de imagens das publicações (Vercel Blob).
 *
 * O feed do Instagram só aceita imagem por URL pública (`image_url`), então a
 * imagem que o dono sobe precisa ser hospedada em algum lugar público antes de
 * publicar. Encapsulamos isso aqui para degradar graciosamente: sem o token do
 * Blob (`BLOB_READ_WRITE_TOKEN`), `blobConfigurado()` é false e a UI/lib oferece
 * o fluxo em modo de simulação (não publica de verdade), como nas outras levas.
 */

/** True quando o Vercel Blob está configurado (token de leitura/escrita). */
export function blobConfigurado(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/**
 * Hospeda uma imagem no Vercel Blob e devolve a URL pública. Lança quando o
 * Blob não está configurado — o chamador decide a degradação.
 */
export async function uploadImagem(
  businessId: string,
  file: Blob | ArrayBuffer | Buffer,
  opts: { nome: string; contentType?: string },
): Promise<{ url: string }> {
  if (!blobConfigurado()) {
    throw new Error(
      'Armazenamento de imagens (Vercel Blob) não configurado. Defina BLOB_READ_WRITE_TOKEN.',
    );
  }
  const seguro = opts.nome.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 80) || 'imagem';
  const blob = await put(`social-posts/${businessId}/${seguro}`, file, {
    access: 'public',
    contentType: opts.contentType,
    addRandomSuffix: true,
  });
  return { url: blob.url };
}
