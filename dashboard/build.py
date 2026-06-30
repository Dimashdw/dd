#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build.py — инлайнит theme.css/data.js/charts.js/ui.js в шаблон src/tpl/dashboard.html
и пишет ОДИН автономный файл dist/dashboard.html (работает с диска, без интернета).

ГРАБЛЯ: при замене НЕ передаём содержимое js/css как строку-замену в re.sub
(обратные слэши \d \B \/ Python примет за escape) — используем str.replace /
функцию-замену. Здесь — простой str.replace.
"""
import os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "src")
TPL = os.path.join(SRC, "tpl", "dashboard.html")
DIST = os.path.join(ROOT, "dist")
OUT = os.path.join(DIST, "dashboard.html")


def read(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def protect_script_close(js):
    # чтобы браузер не закрыл <script> раньше времени на строке "</script"
    return js.replace("</script", "<\\/script")


def main():
    html = read(TPL)

    css = read(os.path.join(SRC, "theme.css"))
    data_js = read(os.path.join(SRC, "data.js"))
    charts_js = read(os.path.join(SRC, "charts.js"))
    ui_js = read(os.path.join(SRC, "ui.js"))
    # real-data.js — реальные цифры из Meta (опционально; если нет — шаблон на заглушках)
    real_path = os.path.join(SRC, "real-data.js")
    real_js = read(real_path) if os.path.exists(real_path) else None

    # 1) <link rel="stylesheet" href="../theme.css"> -> <style>…</style>
    link_pat = re.compile(r'<link[^>]*href="\.\./theme\.css"[^>]*>')
    if not link_pat.search(html):
        print("WARN: тег <link theme.css> не найден", file=sys.stderr)
    html = link_pat.sub(lambda m: "<style>\n" + css + "\n</style>", html)

    # 2) каждый <script src="../X.js"></script> -> встроенный <script>…</script>
    def inline_script(fname, content):
        nonlocal html
        pat = re.compile(r'<script[^>]*src="\.\./' + re.escape(fname) + r'"[^>]*>\s*</script>')
        if not pat.search(html):
            print("WARN: тег <script %s> не найден" % fname, file=sys.stderr)
        repl = "<script>\n" + protect_script_close(content) + "\n</script>"
        html = pat.sub(lambda m: repl, html)

    if real_js is not None:
        inline_script("real-data.js", real_js)
    else:
        # тег есть в шаблоне, но файла нет — убираем тег, чтобы не было битой ссылки
        html = re.sub(r'<script[^>]*src="\.\./real-data\.js"[^>]*>\s*</script>\s*', "", html)
    inline_script("data.js", data_js)
    inline_script("charts.js", charts_js)
    inline_script("ui.js", ui_js)

    if 'src="../' in html or 'href="../' in html:
        print("WARN: остались внешние ссылки ../ — файл не полностью автономен", file=sys.stderr)

    os.makedirs(DIST, exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(html)

    # опционально — дубль в /tmp для предпросмотра
    try:
        with open("/tmp/dashboard.html", "w", encoding="utf-8") as f:
            f.write(html)
    except Exception:
        pass

    print("OK → %s (%d КБ)" % (OUT, len(html.encode("utf-8")) // 1024))


if __name__ == "__main__":
    main()
