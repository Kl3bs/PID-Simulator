#!/usr/bin/env python3
"""
Converte docs/tcc/MANUAL_DE_ESTUDOS_TCC.md para docs/tcc/manual_estudos.html
com suporte completo a MathJax (inline $ e display $$), tabelas HTML estilizadas,
blocos de código, cartões de destaque e tipografia acadêmica de alta legibilidade.
"""

import re
import html
from pathlib import Path

def parse_markdown_to_html(md_text: str) -> str:
    # 1. Proteger blocos matemáticos e blocos de código
    code_blocks = []
    def save_code_block(match):
        lang = match.group(1) or ""
        code = match.group(2)
        idx = len(code_blocks)
        code_blocks.append((lang, code))
        return f"%%CODEBLOCK_{idx}%%"
    
    # Substituir blocos de código ``` ... ```
    text = re.sub(r'```([a-zA-Z0-9_-]*)\n(.*?)```', save_code_block, md_text, flags=re.DOTALL)
    
    # 2. Proteger equações em display $$ ... $$ e inline $ ... $
    math_blocks = []
    def save_math_display(match):
        idx = len(math_blocks)
        math_blocks.append(match.group(0))
        return f"%%MATH_{idx}%%"
    
    text = re.sub(r'\$\$(.*?)\$\$', save_math_display, text, flags=re.DOTALL)
    text = re.sub(r'\$([^\$\n]+?)\$', save_math_display, text)

    # 3. Processar tabelas Markdown
    def parse_table(table_match):
        raw_table = table_match.group(0).strip().split('\n')
        if len(raw_table) < 2:
            return table_match.group(0)
        
        headers = [c.strip() for c in raw_table[0].split('|')[1:-1]]
        # Linha 1 é separador (|:---|:---|)
        rows = []
        for line in raw_table[2:]:
            cells = [c.strip() for c in line.split('|')[1:-1]]
            if cells:
                rows.append(cells)
        
        html_table = ['<div class="table-wrapper"><table>']
        html_table.append('<thead><tr>')
        for h in headers:
            html_table.append(f'<th>{h}</th>')
        html_table.append('</tr></thead><tbody>')
        for r in rows:
            html_table.append('<tr>')
            for c in r:
                html_table.append(f'<td>{c}</td>')
            html_table.append('</tr>')
        html_table.append('</tbody></table></div>')
        return '\n'.join(html_table)

    table_pattern = re.compile(r'(\|[^\n]+\|\n\|[\s\-:|]+\|\n(?:\|[^\n]+\|\n?)+)')
    text = table_pattern.sub(parse_table, text)

    # 4. Formatação de texto inline
    text = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', text)
    text = re.sub(r'\*([^*]+)\*', r'<em>\1</em>', text)
    text = re.sub(r'`([^`]+)`', r'<code>\1</code>', text)

    # 5. Processar linha a linha para cabeçalhos, listas, blockquotes e parágrafos
    lines = text.split('\n')
    output = []
    in_list = False
    list_type = None

    for line in lines:
        stripped = line.strip()

        # Fechar listas se a linha estiver vazia ou não for item de lista
        if in_list and not (stripped.startswith('- ') or re.match(r'^\d+\.\s', stripped)):
            output.append(f'</{list_type}>')
            in_list = False
            list_type = None

        if not stripped:
            continue

        # Cabeçalhos
        if stripped.startswith('# '):
            output.append(f'<h1 class="h1-title">{stripped[2:]}</h1>')
        elif stripped.startswith('## '):
            output.append(f'<h2 class="h2-section">{stripped[3:]}</h2>')
        elif stripped.startswith('### '):
            output.append(f'<h3 class="h3-sub">{stripped[4:]}</h3>')
        elif stripped.startswith('#### '):
            output.append(f'<h4 class="h4-sub">{stripped[5:]}</h4>')
        elif stripped == '---':
            output.append('<hr class="divider">')
        # Blockquote / Destaque
        elif stripped.startswith('> '):
            content = stripped[2:]
            output.append(f'<div class="callout">{content}</div>')
        # Lista não ordenada
        elif stripped.startswith('- '):
            if not in_list:
                in_list = True
                list_type = 'ul'
                output.append('<ul class="custom-list">')
            output.append(f'<li>{stripped[2:]}</li>')
        # Lista numerada
        elif re.match(r'^\d+\.\s', stripped):
            item_text = re.sub(r'^\d+\.\s', '', stripped)
            if not in_list:
                in_list = True
                list_type = 'ol'
                output.append('<ol class="custom-list">')
            output.append(f'<li>{item_text}</li>')
        # Tabela já processada
        elif stripped.startswith('<div class="table-wrapper">') or stripped.startswith('%%CODEBLOCK_'):
            output.append(stripped)
        else:
            output.append(f'<p>{stripped}</p>')

    if in_list:
        output.append(f'</{list_type}>')

    body = '\n'.join(output)

    # 6. Restaurar blocos de código
    for idx, (lang, code) in enumerate(code_blocks):
        escaped_code = html.escape(code.strip())
        placeholder = f"%%CODEBLOCK_{idx}%%"
        lang_badge = f'<span class="code-lang">{lang.upper()}</span>' if lang else ""
        code_html = f'<div class="code-container">{lang_badge}<pre><code>{escaped_code}</code></pre></div>'
        body = body.replace(placeholder, code_html)

    # 7. Restaurar blocos matemáticos
    for idx, math_content in enumerate(math_blocks):
        placeholder = f"%%MATH_{idx}%%"
        body = body.replace(placeholder, math_content)

    return body

def build_full_html(body_content: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Manual de Estudos para Defesa do TCC — Engenharia UFAL</title>
    
    <!-- Configuração Correta do MathJax 3 com suporte a $ inline e $$ display -->
    <script>
    window.MathJax = {{
      tex: {{
        inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
        displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']],
        processEscapes: true,
        processEnvironments: true
      }},
      options: {{
        skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code']
      }},
      chtml: {{
        scale: 1.05
      }}
    }};
    </script>
    <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>

    <style>
        :root {{
            --bg-page: #0f172a;
            --bg-card: #ffffff;
            --text-main: #1e293b;
            --text-muted: #64748b;
            --primary: #2563eb;
            --primary-light: #eff6ff;
            --accent: #0ea5e9;
            --accent-bg: #f0f9ff;
            --success: #16a34a;
            --warning: #d97706;
            --danger: #dc2626;
            --border: #e2e8f0;
            --code-bg: #0b1120;
        }}

        * {{
            box-sizing: border-box;
        }}

        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #f1f5f9;
            color: var(--text-main);
            line-height: 1.8;
            margin: 0;
            padding: 40px 20px;
            font-size: 17px;
        }}

        .container {{
            max-width: 960px;
            margin: 0 auto;
            background: var(--bg-card);
            padding: 60px 80px;
            border-radius: 16px;
            box-shadow: 0 10px 40px rgba(15, 23, 42, 0.08);
            border: 1px solid var(--border);
        }}

        /* Cabeçalhos */
        .h1-title {{
            font-size: 2.3rem;
            color: #0f172a;
            font-weight: 800;
            margin-top: 20px;
            margin-bottom: 12px;
            letter-spacing: -0.02em;
            line-height: 1.25;
            border-bottom: 3px solid #3b82f6;
            padding-bottom: 16px;
        }}

        .h2-section {{
            font-size: 1.65rem;
            color: #1e293b;
            font-weight: 700;
            margin-top: 48px;
            margin-bottom: 20px;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 10px;
            letter-spacing: -0.01em;
        }}

        .h3-sub {{
            font-size: 1.28rem;
            color: #0369a1;
            font-weight: 600;
            margin-top: 32px;
            margin-bottom: 14px;
        }}

        .h4-sub {{
            font-size: 1.1rem;
            color: #475569;
            font-weight: 600;
            margin-top: 24px;
            margin-bottom: 10px;
        }}

        p {{
            margin-bottom: 1.25em;
            color: #334155;
            text-align: justify;
        }}

        strong {{
            color: #0f172a;
            font-weight: 700;
        }}

        .divider {{
            border: 0;
            height: 1px;
            background: #e2e8f0;
            margin: 40px 0;
        }}

        /* Callouts / Caixas de Destaque */
        .callout {{
            background: #f8fafc;
            border-left: 4px solid #2563eb;
            padding: 16px 22px;
            border-radius: 0 10px 10px 0;
            margin: 24px 0;
            color: #1e293b;
            font-size: 1.02rem;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
        }}

        .callout strong {{
            color: #1d4ed8;
        }}

        /* Listas */
        .custom-list {{
            margin: 18px 0 24px 28px;
            padding-left: 10px;
        }}

        .custom-list li {{
            margin-bottom: 10px;
            color: #334155;
            line-height: 1.7;
        }}

        /* Tabelas Formatadas */
        .table-wrapper {{
            overflow-x: auto;
            margin: 30px 0;
            border: 1px solid var(--border);
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.02);
        }}

        table {{
            width: 100%;
            border-collapse: collapse;
            font-size: 0.96rem;
            text-align: left;
        }}

        th {{
            background-color: #f8fafc;
            color: #0f172a;
            font-weight: 700;
            padding: 14px 18px;
            border-bottom: 2px solid var(--border);
            text-transform: uppercase;
            font-size: 0.82rem;
            letter-spacing: 0.5px;
        }}

        td {{
            padding: 14px 18px;
            border-bottom: 1px solid var(--border);
            color: #334155;
            vertical-align: top;
        }}

        tr:last-child td {{
            border-bottom: none;
        }}

        tr:nth-child(even) {{
            background-color: #fbfcfe;
        }}

        /* Código e Snippets */
        code {{
            background: #f1f5f9;
            color: #0284c7;
            padding: 3px 7px;
            border-radius: 5px;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 0.9em;
            font-weight: 600;
        }}

        .code-container {{
            position: relative;
            background: var(--code-bg);
            border-radius: 10px;
            margin: 24px 0;
            padding: 24px;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
            overflow-x: auto;
        }}

        .code-lang {{
            position: absolute;
            top: 10px;
            right: 14px;
            font-size: 0.72rem;
            font-weight: 700;
            color: #64748b;
            letter-spacing: 1px;
        }}

        .code-container pre {{
            margin: 0;
            padding: 0;
            background: transparent;
        }}

        .code-container code {{
            background: transparent;
            color: #e2e8f0;
            padding: 0;
            font-size: 0.94rem;
            font-weight: 400;
            line-height: 1.6;
        }}

        /* Fórmulas MathJax em destaque */
        mjx-container {{
            color: #0f172a !important;
            font-size: 1.1em !important;
        }}

        mjx-container[jax="CHTML"][display="true"] {{
            margin: 20px 0 !important;
            padding: 14px 20px;
            background: #f8fafc;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
            overflow-x: auto;
        }}

        /* Badges de Navegação */
        .top-nav {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
            padding-bottom: 16px;
            border-bottom: 1px solid #e2e8f0;
        }}

        .badge-ufal {{
            background: #dbeafe;
            color: #1e40af;
            font-size: 0.8rem;
            font-weight: 700;
            padding: 5px 12px;
            border-radius: 999px;
            text-transform: uppercase;
        }}

        .print-btn {{
            background: #0f172a;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 0.88rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }}

        .print-btn:hover {{
            background: #2563eb;
        }}

        @media (max-width: 768px) {{
            .container {{
                padding: 30px 20px;
            }}
            .h1-title {{
                font-size: 1.8rem;
            }}
        }}

        @media print {{
            body {{
                background: white;
                padding: 0;
            }}
            .container {{
                box-shadow: none;
                border: none;
                padding: 0;
                max-width: 100%;
            }}
            .print-btn {{
                display: none;
            }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="top-nav">
            <span class="badge-ufal">UFAL &bull; Engenharia de Computação &bull; TCC</span>
            <button class="print-btn" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
        </div>
        {body_content}
    </div>
</body>
</html>
"""

def main():
    md_file = Path("docs/tcc/MANUAL_DE_ESTUDOS_TCC.md")
    html_file = Path("docs/tcc/manual_estudos.html")

    if not md_file.exists():
        print(f"Erro: {md_file} não encontrado.")
        return

    print(f"Lendo {md_file}...")
    md_content = md_file.read_text(encoding="utf-8")
    
    print("Convertendo Markdown para HTML semântico com MathJax...")
    body = parse_markdown_to_html(md_content)
    full_html = build_full_html(body)

    html_file.write_text(full_html, encoding="utf-8")
    print(f"✅ Arquivo atualizado com sucesso em: {html_file.resolve()}")

if __name__ == "__main__":
    main()
