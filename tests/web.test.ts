import { describe, expect, it } from 'vitest';
import {
  extrairTitulo,
  fazerSnippet,
  htmlParaTexto,
  normalizarCnpj,
  validarUrlPublica,
} from '@/src/lib/web';

describe('validarUrlPublica', () => {
  it('aceita URL https pública', () => {
    const r = validarUrlPublica('https://exemplo.com.br/pagina?x=1');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.url.hostname).toBe('exemplo.com.br');
    }
  });

  it('aceita URL http pública', () => {
    expect(validarUrlPublica('http://exemplo.com').ok).toBe(true);
  });

  it('rejeita protocolos que não são http(s)', () => {
    for (const url of ['ftp://exemplo.com/arquivo', 'file:///etc/passwd', 'javascript:alert(1)']) {
      const r = validarUrlPublica(url);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.erro).toBe('Apenas URLs http(s) são permitidas');
      }
    }
  });

  it.each([
    'http://localhost:3000',
    'http://app.localhost/x',
    'http://127.0.0.1/admin',
    'http://10.0.0.5/',
    'http://172.16.0.1/',
    'http://172.31.255.254/',
    'http://192.168.1.1/',
    'http://169.254.169.254/latest/meta-data',
    'http://servidor.local/',
  ])('rejeita host interno/privado: %s', (url) => {
    const r = validarUrlPublica(url);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.erro).toBe('URLs internas/privadas não são permitidas');
    }
  });

  // URL.hostname entrega IPv6 COM colchetes ("[::1]") — a lib remove os
  // colchetes antes de comparar, senão o loopback IPv6 passaria.
  it('rejeita loopback IPv6 ::1', () => {
    expect(validarUrlPublica('http://[::1]/').ok).toBe(false);
  });

  it('não rejeita IPs públicos fora das faixas privadas', () => {
    expect(validarUrlPublica('http://172.32.0.1/').ok).toBe(true);
    expect(validarUrlPublica('http://8.8.8.8/').ok).toBe(true);
  });

  it('rejeita URL inválida', () => {
    const r = validarUrlPublica('isto não é uma url');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.erro).toBe('URL inválida');
    }
  });
});

describe('htmlParaTexto', () => {
  it('remove script, style e nav', () => {
    const html =
      '<html><body><script>var x = "segredo";</script><style>.a{color:red}</style>' +
      '<nav><a href="/">Menu</a></nav><p>Conteúdo visível</p></body></html>';
    const texto = htmlParaTexto(html);
    expect(texto).toContain('Conteúdo visível');
    expect(texto).not.toContain('segredo');
    expect(texto).not.toContain('color:red');
    expect(texto).not.toContain('Menu');
  });

  it('converte <p> e <br> em quebras de linha', () => {
    const texto = htmlParaTexto('<p>linha um</p><p>linha dois<br>linha três</p>');
    expect(texto).toBe('linha um\nlinha dois\nlinha três');
  });

  it('decodifica entidades HTML comuns e numéricas', () => {
    expect(htmlParaTexto('<p>p&amp;b</p>')).toBe('p&b');
    expect(htmlParaTexto('<p>caf&#233;</p>')).toBe('café');
  });

  it('colapsa espaços em branco repetidos', () => {
    const texto = htmlParaTexto('<p>muito    espaço \t aqui</p>');
    expect(texto).toBe('muito espaço aqui');
  });

  it('trunca em maxChars com marcador de truncamento', () => {
    const texto = htmlParaTexto(`<p>${'a'.repeat(500)}</p>`, 100);
    expect(texto.startsWith('a'.repeat(100))).toBe(true);
    expect(texto).toContain('[conteúdo truncado]');
  });

  it('não trunca texto dentro do limite', () => {
    const texto = htmlParaTexto('<p>curto</p>', 100);
    expect(texto).toBe('curto');
    expect(texto).not.toContain('[conteúdo truncado]');
  });
});

describe('extrairTitulo', () => {
  it('extrai o conteúdo do <title>', () => {
    expect(extrairTitulo('<html><head><title>Minha Página</title></head></html>')).toBe(
      'Minha Página'
    );
  });

  it('decodifica entidades no título', () => {
    expect(extrairTitulo('<title>Caf&#233; &amp; Cia</title>')).toBe('Café & Cia');
  });

  it('retorna undefined quando não há <title>', () => {
    expect(extrairTitulo('<html><body><h1>Sem título</h1></body></html>')).toBeUndefined();
  });

  it('retorna undefined para <title> vazio', () => {
    expect(extrairTitulo('<title>   </title>')).toBeUndefined();
  });
});

describe('normalizarCnpj', () => {
  it('aceita CNPJ com pontuação', () => {
    expect(normalizarCnpj('12.345.678/0001-95')).toBe('12345678000195');
  });

  it('aceita CNPJ só com dígitos', () => {
    expect(normalizarCnpj('12345678000195')).toBe('12345678000195');
  });

  it('retorna null para tamanho errado', () => {
    expect(normalizarCnpj('123')).toBeNull();
    expect(normalizarCnpj('123456780001955')).toBeNull();
    expect(normalizarCnpj('')).toBeNull();
  });
});

describe('fazerSnippet', () => {
  it('colapsa whitespace', () => {
    expect(fazerSnippet('  texto\n com\t\tespaços  ')).toBe('texto com espaços');
  });

  it('mantém texto dentro do limite sem reticências', () => {
    expect(fazerSnippet('curto', 10)).toBe('curto');
  });

  it('corta texto longo com reticências', () => {
    const snippet = fazerSnippet('a'.repeat(300), 280);
    expect(snippet).toBe(`${'a'.repeat(280)}…`);
  });
});
