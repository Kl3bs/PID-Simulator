#!/usr/bin/env python3
"""
Visualizador leve de arquivos .tex em HTML/MathJax usando apenas a biblioteca padrao do Python.
Uso:
    python3 docs/tcc/preview.py [caminho_do_arquivo.tex]
Exemplo:
    python3 docs/tcc/preview.py docs/tcc/capitulos/1_introducao.tex
"""

import sys
import os
import re
import html
import http.server
import socketserver
import webbrowser
from pathlib import Path

def tex_to_html(tex_content: str, title: str = "Pré-visualização LaTeX") -> str:
    # 1. Tratar quebras de linha e escape
    text = tex_content

    # Remover comentarios LaTeX %
    text = re.sub(r'(?<!\\)%.*$', '', text, flags=re.MULTILINE)

    # Capitulos e Secoes
    text = re.sub(r'\\chapter\{([^}]+)\}', r'<h1 class="chapter">\1</h1>', text)
    text = re.sub(r'\\section\{([^}]+)\}', r'<h2 class="section">\1</h2>', text)
    text = re.sub(r'\\subsection\{([^}]+)\}', r'<h3 class="subsection">\1</h3>', text)
    text = re.sub(r'\\subsubsection\{([^}]+)\}', r'<h4 class="subsubsection">\1</h4>', text)

    # Formatacao de texto
    text = re.sub(r'\\textbf\{([^}]+)\}', r'<strong>\1</strong>', text)
    text = re.sub(r'\\textit\{([^}]+)\}', r'<em>\1</em>', text)
    text = re.sub(r'\\emph\{([^}]+)\}', r'<em>\1</em>', text)
    text = re.sub(r'\\texttt\{([^}]+)\}', r'<code>\1</code>', text)

    # Citacoes e Referencias
    text = re.sub(r'\\cite\{([^}]+)\}', r'<span class="citation">[\1]</span>', text)
    text = re.sub(r'\\citeonline\{([^}]+)\}', r'<span class="citation">\1</span>', text)
    text = re.sub(r'\\ref\{([^}]+)\}', r'<span class="ref">[\1]</span>', text)
    text = re.sub(r'\\label\{([^}]+)\}', '', text)

    # Citacao longa (quote)
    text = re.sub(r'\\begin\{quote\}(.*?)\\end\{quote\}', r'<blockquote>\1</blockquote>', text, flags=re.DOTALL)

    # Listas
    text = re.sub(r'\\begin\{enumerate\}(\[[^\]]*\])?', '<ol>', text)
    text = re.sub(r'\\end\{enumerate\}', '</ol>', text)
    text = re.sub(r'\\begin\{itemize\}', '<ul>', text)
    text = re.sub(r'\\end\{itemize\}', '</ul>', text)
    text = re.sub(r'\\item\s+', '<li>', text)

    # Ajustar fechamento de <li>
    # Converte paragrafos separados por linha em branco
    paragraphs = text.split('\n\n')
    processed_paragraphs = []
    for p in paragraphs:
        p = p.strip()
        if not p:
            continue
        if p.startswith('<h') or p.startswith('<ul') or p.startswith('<ol') or p.startswith('<blockquote'):
            processed_paragraphs.append(p)
        elif p.startswith('<li>'):
            # se comeca com li, fecha tags abertas
            processed_paragraphs.append(p + '</li>')
        else:
            processed_paragraphs.append(f'<p>{p}</p>')

    body_html = '\n'.join(processed_paragraphs)

    # Substituicoes de caracteres especiais do LaTeX
    body_html = body_html.replace(r'\%', '%').replace(r'\_', '_').replace(r'\&', '&')
    body_html = body_html.replace('---', '&mdash;').replace('--', '&ndash;')

    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <!-- MathJax para formulas matematicas -->
    <script src="https://polyfill.io/v3/polyfill.min.js?features=es6"></script>
    <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
    <style>
        body {{
            font-family: 'Georgia', 'Times New Roman', serif;
            background-color: #f7f9fc;
            color: #1e293b;
            line-height: 1.8;
            margin: 0;
            padding: 40px 20px;
        }}
        .container {{
            max-width: 820px;
            margin: 0 auto;
            background: #ffffff;
            padding: 60px 80px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            border-radius: 8px;
        }}
        .badge {{
            display: inline-block;
            background: #e2e8f0;
            color: #475569;
            font-size: 0.75rem;
            font-family: -apple-system, sans-serif;
            padding: 4px 10px;
            border-radius: 999px;
            text-transform: uppercase;
            font-weight: bold;
            margin-bottom: 20px;
        }}
        h1.chapter {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 2.2rem;
            color: #0f172a;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 12px;
            margin-bottom: 30px;
        }}
        h2.section {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 1.5rem;
            color: #1e293b;
            margin-top: 36px;
            margin-bottom: 16px;
        }}
        h3.subsection {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 1.2rem;
            color: #334155;
            margin-top: 24px;
            margin-bottom: 12px;
        }}
        p {{
            text-align: justify;
            text-indent: 2.5em;
            margin-bottom: 1.2em;
            font-size: 1.1rem;
        }}
        blockquote {{
            margin: 24px 0 24px 40px;
            padding: 12px 20px;
            border-left: 4px solid #3b82f6;
            background: #f8fafc;
            font-style: italic;
            color: #334155;
            font-size: 1.05rem;
        }}
        ul, ol {{
            margin: 20px 0 20px 30px;
            padding-left: 20px;
            font-size: 1.05rem;
        }}
        li {{
            margin-bottom: 10px;
            text-align: justify;
        }}
        .citation {{
            color: #2563eb;
            font-weight: 500;
        }}
        code {{
            background: #f1f5f9;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 0.95em;
        }}
    </style>
</head>
<body>
    <div class="container">
        <span class="badge">Visualizador Python .tex &bull; TCC Engenharia UFAL</span>
        {body_html}
    </div>
</body>
</html>
"""

def load_tex_with_includes(file_path: Path) -> str:
    if not file_path.exists():
        return ""
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    def replace_include(match):
        inc_name = match.group(1).strip()
        if not inc_name.endswith('.tex'):
            inc_name += '.tex'
        inc_path = file_path.parent / inc_name
        if not inc_path.exists():
            inc_path = Path("docs/tcc") / inc_name
        if inc_path.exists():
            return load_tex_with_includes(inc_path)
        return f"\n% [Arquivo não encontrado: {inc_name}]\n"

    # Substituir \include{...} e \input{...}
    content = re.sub(r'\\(?:include|input)\{([^}]+)\}', replace_include, content)
    return content

def main():
    default_tex = Path("docs/tcc/main.tex")
    tex_path = Path(sys.argv[1]) if len(sys.argv) > 1 else default_tex

    if not tex_path.exists():
        tex_path = Path("docs/tcc/capitulos/1_introducao.tex")

    content = load_tex_with_includes(tex_path)

    output_dir = Path("docs/tcc/.preview")
    output_dir.mkdir(parents=True, exist_ok=True)
    html_file = output_dir / "index.html"
    static_preview = Path("docs/tcc/preview_tcc_completo.html")

    rendered_html = tex_to_html(content, title=f"TCC UFAL — {tex_path.stem.capitalize()}")
    with open(html_file, "w", encoding="utf-8") as f:
        f.write(rendered_html)
    with open(static_preview, "w", encoding="utf-8") as f:
        f.write(rendered_html)

    print(f"✅ HTML completo gerado com sucesso em: {static_preview.resolve()}")
    
    # Servir via HTTP local e abrir no navegador
    port = 8585
    os.chdir(output_dir)
    
    class SilentHandler(http.server.SimpleHTTPRequestHandler):
        def log_message(self, format, *args):
            pass  # Silenciar logs no terminal

    with socketserver.TCPServer(("", port), SilentHandler) as httpd:
        url = f"http://localhost:{port}"
        print(f"🚀 Servidor ativo em {url}")
        print("Pressione Ctrl+C para encerrar o visualizador.")
        webbrowser.open(url)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServidor encerrado.")

if __name__ == "__main__":
    main()
