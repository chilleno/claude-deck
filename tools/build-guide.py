#!/usr/bin/env python3
"""Build the bundled user guide, one self-contained page per language.

Issue #4 (Ulanzi Studio team): the plugin shipped with no explanation that it
drives Anthropic's Claude Code CLI, and no install path. The guide is bundled
rather than hosted so it works offline and always matches the installed
version; the "User Guide" button in every panel opens it in the browser.

Action names and tooltips are read back from the language files, so the guide
can't drift from what Studio shows in the action list.

Run from the repo root:  python3 tools/build-guide.py
"""
import json
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "com.claudedeck.deck.plugin.ulanziPlugin"
OUT = ROOT / "property-inspector" / "guide"
LANGS = ["en", "es_ES", "fr", "de_DE", "pt_PT", "ja_JP", "ko_KR", "zh_CN", "zh_HK"]

# Shown in the in-page language switcher. Always written in the target language
# — someone who opened the wrong page can't read a list translated into it.
LANG_NAMES = {
    "en": "English",
    "es_ES": "Español",
    "fr": "Français",
    "de_DE": "Deutsch",
    "pt_PT": "Português",
    "ja_JP": "日本語",
    "ko_KR": "한국어",
    "zh_CN": "简体中文",
    "zh_HK": "繁體中文",
}

DOCS_URL = "https://docs.claude.com/en/docs/claude-code/setup"
REPO_URL = "https://github.com/chilleno/claude-deck"

T = {}

T["en"] = {
    "title": "Claude Deck — User Guide",
    "intro": "Claude Deck shows what your Claude Code sessions are doing, right on the deck: which one is working, which one is asking you something, how much context is left — and it lets you answer questions and run /compact or /clear without touching the keyboard.",
    "needs": "You need: macOS, Ulanzi Studio, and Anthropic's Claude Code CLI. Claude Deck is a companion for Claude Code — on its own it has nothing to show.",
    "setup_h": "Setting up",
    "steps": [
        ("1. Install Claude Code",
         "Claude Code is Anthropic's command-line tool for Claude. Follow the official install instructions, then run <code>claude</code> once in a terminal so it creates its settings."),
        ("2. Turn on Claude tracking",
         "Drag any Claude Deck action onto a key and open its settings panel. The Setup list shows what is still missing; press <b>Enable Claude tracking</b>. This adds hook entries to your Claude Code settings (a backup is saved first) so the deck can see session status. Restart any claude sessions that are already running."),
        ("3. Allow terminal control",
         "Pick your terminal (iTerm2 or Terminal.app) in the panel, then press <b>Check terminal access</b> and accept the macOS prompt. Answering it now avoids a key that later seems to do nothing. If you refused before: System Settings → Privacy &amp; Security → Automation → Ulanzi Studio."),
        ("4. Optional: the big screen",
         "Press the <b>Claude Screen Setup</b> key once to put the Claude session display on the big key. Ulanzi Studio restarts itself to apply this (about 15 seconds). Press it again to give the big key back to the built-in widget."),
    ],
    "keys_h": "What each key does",
    "icons_h": "What the icons mean",
    "icons": [
        ("In colour", "a Claude Code session is being tracked."),
        ("Black and white", "no session is running right now. Start one and the keys come back to life."),
        ("Black and white with an amber dot", "Claude Deck still needs setting up — open any key's settings panel and work through the Setup list."),
    ],
    "trouble_h": "If something doesn't work",
    "trouble": [
        ("The keys stay grey even though claude is running",
         "The hooks are read when a session starts, so sessions that were already open when you enabled tracking don't report anything. Restart them. If it still doesn't help, open the panel and check the Setup list."),
        ("A key does nothing when I press it",
         "That is usually macOS blocking terminal control. Press <b>Check terminal access</b> in the panel; if it says blocked, allow Ulanzi Studio under System Settings → Privacy &amp; Security → Automation."),
        ("Questions don't appear on the big key",
         "Multi-select questions can't be answered from the deck — the key says so and takes you to the terminal instead. Everything else shows up on the big key within a second or two."),
        ("The big screen went back to the built-in widget",
         "Ulanzi Studio rewrites that slot when you edit the page. Press Claude Screen Setup again and let Studio restart."),
    ],
    "footer": "Claude Deck is open source — issues and source at",
}

T["es_ES"] = {
    "title": "Claude Deck — Guía de usuario",
    "intro": "Claude Deck muestra en el deck lo que están haciendo tus sesiones de Claude Code: cuál está trabajando, cuál te está preguntando algo y cuánto contexto queda. Además puedes responder preguntas y ejecutar /compact o /clear sin tocar el teclado.",
    "needs": "Necesitas: macOS, Ulanzi Studio y el CLI Claude Code de Anthropic. Claude Deck es un complemento de Claude Code: por sí solo no tiene nada que mostrar.",
    "setup_h": "Configuración",
    "steps": [
        ("1. Instala Claude Code",
         "Claude Code es la herramienta de línea de comandos de Anthropic para Claude. Sigue las instrucciones oficiales de instalación y ejecuta <code>claude</code> una vez en el terminal para que cree su configuración."),
        ("2. Activa el seguimiento de Claude",
         "Arrastra cualquier acción de Claude Deck a una tecla y abre su panel de ajustes. La lista de configuración muestra lo que falta; pulsa <b>Activar seguimiento de Claude</b>. Esto añade los hooks a tu configuración de Claude Code (se guarda antes una copia de seguridad) para que el deck vea el estado de las sesiones. Reinicia las sesiones de claude que ya estuvieran abiertas."),
        ("3. Permite el control del terminal",
         "Elige tu terminal (iTerm2 o Terminal.app) en el panel, pulsa <b>Comprobar acceso al terminal</b> y acepta el aviso de macOS. Responderlo ahora evita que luego una tecla parezca no hacer nada. Si lo rechazaste antes: Ajustes del Sistema → Privacidad y seguridad → Automatización → Ulanzi Studio."),
        ("4. Opcional: la pantalla grande",
         "Pulsa una vez la tecla <b>Configurar Pantalla</b> para poner la pantalla de sesión de Claude en la tecla grande. Ulanzi Studio se reinicia solo para aplicarlo (unos 15 segundos). Vuelve a pulsarla para devolver la tecla grande al widget integrado."),
    ],
    "keys_h": "Qué hace cada tecla",
    "icons_h": "Qué significan los iconos",
    "icons": [
        ("En color", "hay una sesión de Claude Code en seguimiento."),
        ("En blanco y negro", "no hay ninguna sesión activa ahora mismo. Abre una y las teclas volverán a la vida."),
        ("En blanco y negro con un punto ámbar", "Claude Deck aún está sin configurar: abre el panel de ajustes de cualquier tecla y completa la lista."),
    ],
    "trouble_h": "Si algo no funciona",
    "trouble": [
        ("Las teclas siguen grises aunque claude esté abierto",
         "Los hooks se leen al iniciar la sesión, así que las sesiones que ya estaban abiertas cuando activaste el seguimiento no informan de nada. Reinícialas. Si sigue igual, abre el panel y revisa la lista de configuración."),
        ("Pulso una tecla y no pasa nada",
         "Normalmente es macOS bloqueando el control del terminal. Pulsa <b>Comprobar acceso al terminal</b> en el panel; si aparece bloqueado, permite Ulanzi Studio en Ajustes del Sistema → Privacidad y seguridad → Automatización."),
        ("Las preguntas no aparecen en la tecla grande",
         "Las preguntas de selección múltiple no se pueden responder desde el deck: la tecla te lo indica y te lleva al terminal. Todo lo demás aparece en la tecla grande en uno o dos segundos."),
        ("La pantalla grande volvió al widget integrado",
         "Ulanzi Studio reescribe esa ranura al editar la página. Pulsa otra vez Configurar Pantalla y deja que Studio se reinicie."),
    ],
    "footer": "Claude Deck es código abierto: incidencias y código en",
}

T["fr"] = {
    "title": "Claude Deck — Guide d'utilisation",
    "intro": "Claude Deck affiche sur le deck ce que font vos sessions Claude Code : laquelle travaille, laquelle vous pose une question, combien de contexte il reste. Vous pouvez aussi répondre aux questions et lancer /compact ou /clear sans toucher au clavier.",
    "needs": "Il vous faut : macOS, Ulanzi Studio et le CLI Claude Code d'Anthropic. Claude Deck accompagne Claude Code — seul, il n'a rien à afficher.",
    "setup_h": "Configuration",
    "steps": [
        ("1. Installez Claude Code",
         "Claude Code est l'outil en ligne de commande d'Anthropic pour Claude. Suivez les instructions d'installation officielles, puis lancez <code>claude</code> une fois dans un terminal pour qu'il crée sa configuration."),
        ("2. Activez le suivi de Claude",
         "Glissez une action Claude Deck sur une touche et ouvrez son panneau de réglages. La liste de configuration montre ce qui manque ; appuyez sur <b>Activer le suivi de Claude</b>. Les hooks sont ajoutés à votre configuration Claude Code (une sauvegarde est créée d'abord) pour que le deck voie l'état des sessions. Redémarrez les sessions claude déjà ouvertes."),
        ("3. Autorisez le contrôle du terminal",
         "Choisissez votre terminal (iTerm2 ou Terminal.app) dans le panneau, appuyez sur <b>Vérifier l'accès au terminal</b> et acceptez l'invite macOS. Y répondre maintenant évite une touche qui semblera inactive plus tard. Si vous aviez refusé : Réglages Système → Confidentialité et sécurité → Automatisation → Ulanzi Studio."),
        ("4. Facultatif : le grand écran",
         "Appuyez une fois sur la touche <b>Configurer l'écran</b> pour afficher la session Claude sur la grande touche. Ulanzi Studio redémarre seul pour appliquer (environ 15 secondes). Appuyez de nouveau pour rendre la grande touche au widget intégré."),
    ],
    "keys_h": "Ce que fait chaque touche",
    "icons_h": "Ce que signifient les icônes",
    "icons": [
        ("En couleur", "une session Claude Code est suivie."),
        ("En noir et blanc", "aucune session n'est active. Lancez-en une et les touches reprennent vie."),
        ("En noir et blanc avec un point ambre", "Claude Deck n'est pas encore configuré — ouvrez le panneau d'une touche et suivez la liste."),
    ],
    "trouble_h": "Si quelque chose ne marche pas",
    "trouble": [
        ("Les touches restent grises alors que claude tourne",
         "Les hooks sont lus au démarrage d'une session : celles déjà ouvertes quand vous avez activé le suivi ne remontent rien. Redémarrez-les. Sinon, ouvrez le panneau et vérifiez la liste de configuration."),
        ("Une touche ne fait rien",
         "C'est en général macOS qui bloque le contrôle du terminal. Appuyez sur <b>Vérifier l'accès au terminal</b> ; si c'est bloqué, autorisez Ulanzi Studio dans Réglages Système → Confidentialité et sécurité → Automatisation."),
        ("Les questions n'apparaissent pas sur la grande touche",
         "Les questions à choix multiples ne peuvent pas être traitées depuis le deck : la touche le signale et vous renvoie au terminal. Tout le reste s'affiche en une seconde ou deux."),
        ("Le grand écran est revenu au widget intégré",
         "Ulanzi Studio réécrit cet emplacement quand vous modifiez la page. Appuyez à nouveau sur Configurer l'écran et laissez Studio redémarrer."),
    ],
    "footer": "Claude Deck est open source — problèmes et code source sur",
}

T["de_DE"] = {
    "title": "Claude Deck — Anleitung",
    "intro": "Claude Deck zeigt direkt auf dem Deck, was deine Claude-Code-Sitzungen tun: welche arbeitet, welche dich etwas fragt und wie viel Kontext noch übrig ist. Fragen beantwortest du und /compact oder /clear startest du, ohne die Tastatur anzufassen.",
    "needs": "Du brauchst: macOS, Ulanzi Studio und Anthropics Claude-Code-CLI. Claude Deck ist eine Ergänzung zu Claude Code — allein hat es nichts anzuzeigen.",
    "setup_h": "Einrichtung",
    "steps": [
        ("1. Claude Code installieren",
         "Claude Code ist Anthropics Kommandozeilen-Werkzeug für Claude. Folge der offiziellen Installationsanleitung und starte danach einmal <code>claude</code> im Terminal, damit die Einstellungen angelegt werden."),
        ("2. Claude-Tracking einschalten",
         "Zieh eine Claude-Deck-Aktion auf eine Taste und öffne ihr Einstellungsfeld. Die Einrichtungsliste zeigt, was noch fehlt; drücke <b>Claude-Tracking aktivieren</b>. Das trägt die Hooks in deine Claude-Code-Einstellungen ein (vorher wird eine Sicherung angelegt), damit das Deck den Sitzungsstatus sieht. Starte bereits laufende claude-Sitzungen neu."),
        ("3. Terminal-Steuerung erlauben",
         "Wähle im Feld dein Terminal (iTerm2 oder Terminal.app), drücke <b>Terminal-Zugriff prüfen</b> und bestätige die macOS-Abfrage. Jetzt zu antworten verhindert später eine Taste, die scheinbar nichts tut. Falls du abgelehnt hast: Systemeinstellungen → Datenschutz &amp; Sicherheit → Automation → Ulanzi Studio."),
        ("4. Optional: das große Display",
         "Drücke die Taste <b>Display einrichten</b> einmal, um die Claude-Sitzungsanzeige auf die große Taste zu legen. Ulanzi Studio startet zum Übernehmen selbst neu (etwa 15 Sekunden). Nochmal drücken gibt die große Taste dem eingebauten Widget zurück."),
    ],
    "keys_h": "Was jede Taste macht",
    "icons_h": "Was die Symbole bedeuten",
    "icons": [
        ("Farbig", "eine Claude-Code-Sitzung wird erfasst."),
        ("Schwarz-weiß", "gerade läuft keine Sitzung. Starte eine, und die Tasten erwachen."),
        ("Schwarz-weiß mit bernsteinfarbenem Punkt", "Claude Deck muss noch eingerichtet werden — öffne ein Einstellungsfeld und arbeite die Liste ab."),
    ],
    "trouble_h": "Wenn etwas nicht funktioniert",
    "trouble": [
        ("Die Tasten bleiben grau, obwohl claude läuft",
         "Hooks werden beim Sitzungsstart gelesen — Sitzungen, die beim Aktivieren schon offen waren, melden nichts. Starte sie neu. Hilft das nicht, öffne das Feld und sieh in der Einrichtungsliste nach."),
        ("Eine Taste tut beim Drücken nichts",
         "Meist blockiert macOS die Terminal-Steuerung. Drücke <b>Terminal-Zugriff prüfen</b>; steht dort blockiert, erlaube Ulanzi Studio unter Systemeinstellungen → Datenschutz &amp; Sicherheit → Automation."),
        ("Fragen erscheinen nicht auf der großen Taste",
         "Mehrfachauswahl-Fragen lassen sich nicht vom Deck beantworten — die Taste sagt das und bringt dich stattdessen ins Terminal. Alles andere erscheint binnen ein bis zwei Sekunden."),
        ("Das große Display zeigt wieder das eingebaute Widget",
         "Ulanzi Studio überschreibt diesen Platz, wenn du die Seite bearbeitest. Drücke erneut Display einrichten und lass Studio neu starten."),
    ],
    "footer": "Claude Deck ist Open Source — Fehlerberichte und Quellcode unter",
}

T["pt_PT"] = {
    "title": "Claude Deck — Guia do utilizador",
    "intro": "O Claude Deck mostra no deck o que as suas sessões do Claude Code estão a fazer: qual está a trabalhar, qual lhe está a perguntar algo e quanto contexto resta. Também responde a perguntas e executa /compact ou /clear sem tocar no teclado.",
    "needs": "Precisa de: macOS, Ulanzi Studio e o CLI Claude Code da Anthropic. O Claude Deck acompanha o Claude Code — sozinho não tem nada para mostrar.",
    "setup_h": "Configuração",
    "steps": [
        ("1. Instale o Claude Code",
         "O Claude Code é a ferramenta de linha de comandos da Anthropic para o Claude. Siga as instruções oficiais de instalação e execute <code>claude</code> uma vez no terminal para que crie as definições."),
        ("2. Ative a monitorização do Claude",
         "Arraste qualquer ação do Claude Deck para uma tecla e abra o painel de definições. A lista de configuração mostra o que falta; prima <b>Ativar monitorização do Claude</b>. Isto adiciona os hooks às definições do Claude Code (é guardada primeiro uma cópia de segurança) para o deck ver o estado das sessões. Reinicie as sessões do claude já abertas."),
        ("3. Autorize o controlo do terminal",
         "Escolha o seu terminal (iTerm2 ou Terminal.app) no painel, prima <b>Verificar acesso ao terminal</b> e aceite o pedido do macOS. Responder agora evita uma tecla que mais tarde parece não fazer nada. Se recusou antes: Definições do Sistema → Privacidade e Segurança → Automatização → Ulanzi Studio."),
        ("4. Opcional: o ecrã grande",
         "Prima uma vez a tecla <b>Configurar Ecrã</b> para colocar o ecrã de sessão do Claude na tecla grande. O Ulanzi Studio reinicia sozinho para aplicar (cerca de 15 segundos). Prima novamente para devolver a tecla grande ao widget incorporado."),
    ],
    "keys_h": "O que faz cada tecla",
    "icons_h": "O que significam os ícones",
    "icons": [
        ("A cores", "há uma sessão do Claude Code a ser monitorizada."),
        ("A preto e branco", "não há nenhuma sessão ativa. Inicie uma e as teclas voltam à vida."),
        ("A preto e branco com um ponto âmbar", "o Claude Deck ainda precisa de configuração — abra o painel de qualquer tecla e percorra a lista."),
    ],
    "trouble_h": "Se algo não funcionar",
    "trouble": [
        ("As teclas continuam cinzentas apesar de o claude estar a correr",
         "Os hooks são lidos no início da sessão, por isso as sessões já abertas quando ativou a monitorização não reportam nada. Reinicie-as. Se continuar, abra o painel e veja a lista de configuração."),
        ("Primo uma tecla e não acontece nada",
         "Normalmente é o macOS a bloquear o controlo do terminal. Prima <b>Verificar acesso ao terminal</b>; se indicar bloqueado, autorize o Ulanzi Studio em Definições do Sistema → Privacidade e Segurança → Automatização."),
        ("As perguntas não aparecem na tecla grande",
         "As perguntas de seleção múltipla não podem ser respondidas pelo deck — a tecla avisa e leva-o ao terminal. Tudo o resto aparece na tecla grande em um ou dois segundos."),
        ("O ecrã grande voltou ao widget incorporado",
         "O Ulanzi Studio reescreve esse espaço quando edita a página. Prima outra vez Configurar Ecrã e deixe o Studio reiniciar."),
    ],
    "footer": "O Claude Deck é open source — problemas e código em",
}

T["ja_JP"] = {
    "title": "Claude Deck — ユーザーガイド",
    "intro": "Claude Deck は、Claude Code の各セッションの状態をデッキ上に表示します。どれが作業中か、どれが質問しているか、コンテキストの残りはどれくらいか。さらに、キーボードに触れずに質問へ回答したり /compact や /clear を実行できます。",
    "needs": "必要なもの：macOS、Ulanzi Studio、そして Anthropic の Claude Code CLI。Claude Deck は Claude Code の補助ツールで、単体では表示するものがありません。",
    "setup_h": "セットアップ",
    "steps": [
        ("1. Claude Code をインストールする",
         "Claude Code は Anthropic が提供する Claude 用のコマンドラインツールです。公式のインストール手順に従い、ターミナルで一度 <code>claude</code> を実行して設定ファイルを作成してください。"),
        ("2. Claude トラッキングを有効にする",
         "Claude Deck のアクションをキーにドラッグし、設定パネルを開きます。セットアップ一覧に不足している項目が表示されるので、<b>Claude トラッキングを有効化</b> を押してください。Claude Code の設定にフックが追加され（事前にバックアップを保存します）、デッキがセッション状態を取得できるようになります。すでに実行中の claude セッションは再起動してください。"),
        ("3. ターミナル制御を許可する",
         "パネルでターミナル（iTerm2 または Terminal.app）を選び、<b>ターミナルアクセスを確認</b> を押して macOS の確認に許可を与えます。ここで答えておくと、後からキーが無反応に見える問題を防げます。以前に拒否した場合：システム設定 → プライバシーとセキュリティ → オートメーション → Ulanzi Studio。"),
        ("4. 任意：ビッグスクリーン",
         "<b>スクリーン設定</b> キーを一度押すと、Claude のセッション表示がビッグキーに配置されます。適用のため Ulanzi Studio が自動的に再起動します（約15秒）。もう一度押すと内蔵ウィジェットに戻ります。"),
    ],
    "keys_h": "各キーの機能",
    "icons_h": "アイコンの意味",
    "icons": [
        ("カラー", "Claude Code のセッションを追跡中です。"),
        ("白黒", "現在セッションが実行されていません。セッションを開始するとキーが動き出します。"),
        ("白黒＋オレンジの点", "Claude Deck のセットアップが未完了です。いずれかのキーの設定パネルを開き、一覧の項目を進めてください。"),
    ],
    "trouble_h": "うまく動かないとき",
    "trouble": [
        ("claude を実行中なのにキーがグレーのまま",
         "フックはセッション開始時に読み込まれるため、トラッキングを有効にした時点ですでに開いていたセッションは何も送信しません。再起動してください。それでも直らない場合はパネルのセットアップ一覧を確認してください。"),
        ("キーを押しても何も起こらない",
         "多くの場合、macOS がターミナル制御をブロックしています。パネルで <b>ターミナルアクセスを確認</b> を押し、ブロックと表示されたら システム設定 → プライバシーとセキュリティ → オートメーション で Ulanzi Studio を許可してください。"),
        ("質問がビッグキーに表示されない",
         "複数選択の質問はデッキから回答できません。その場合はキーがその旨を表示し、ターミナルへ移動します。それ以外の質問は1〜2秒でビッグキーに表示されます。"),
        ("ビッグスクリーンが内蔵ウィジェットに戻ってしまった",
         "ページを編集すると Ulanzi Studio がそのスロットを書き換えます。もう一度スクリーン設定キーを押し、Studio の再起動を待ってください。"),
    ],
    "footer": "Claude Deck はオープンソースです。問題の報告とソースコードはこちら：",
}

T["ko_KR"] = {
    "title": "Claude Deck — 사용 설명서",
    "intro": "Claude Deck은 Claude Code 세션의 상태를 덱에서 바로 보여줍니다. 어떤 세션이 작업 중인지, 어떤 세션이 질문하고 있는지, 컨텍스트가 얼마나 남았는지. 키보드를 만지지 않고 질문에 답하거나 /compact, /clear를 실행할 수도 있습니다.",
    "needs": "필요한 것: macOS, Ulanzi Studio, 그리고 Anthropic의 Claude Code CLI. Claude Deck은 Claude Code의 보조 도구라서 단독으로는 표시할 내용이 없습니다.",
    "setup_h": "설정하기",
    "steps": [
        ("1. Claude Code 설치",
         "Claude Code는 Anthropic이 제공하는 Claude용 명령줄 도구입니다. 공식 설치 안내를 따른 뒤 터미널에서 <code>claude</code>를 한 번 실행해 설정 파일이 만들어지게 하세요."),
        ("2. Claude 추적 켜기",
         "Claude Deck 액션을 키에 끌어다 놓고 설정 패널을 엽니다. 설정 목록에 부족한 항목이 표시되면 <b>Claude 추적 활성화</b>를 누르세요. Claude Code 설정에 훅이 추가되고(먼저 백업이 저장됩니다) 덱이 세션 상태를 볼 수 있게 됩니다. 이미 실행 중인 claude 세션은 다시 시작하세요."),
        ("3. 터미널 제어 허용",
         "패널에서 터미널(iTerm2 또는 Terminal.app)을 고르고 <b>터미널 접근 확인</b>을 눌러 macOS 요청을 허용하세요. 지금 응답해 두면 나중에 키가 아무 반응 없는 상황을 막을 수 있습니다. 이전에 거부했다면: 시스템 설정 → 개인정보 보호 및 보안 → 자동화 → Ulanzi Studio."),
        ("4. 선택 사항: 큰 화면",
         "<b>화면 설정</b> 키를 한 번 누르면 Claude 세션 화면이 큰 키에 표시됩니다. 적용을 위해 Ulanzi Studio가 자동으로 재시작합니다(약 15초). 다시 누르면 기본 위젯으로 돌아갑니다."),
    ],
    "keys_h": "각 키의 기능",
    "icons_h": "아이콘의 의미",
    "icons": [
        ("컬러", "Claude Code 세션이 추적되고 있습니다."),
        ("흑백", "지금 실행 중인 세션이 없습니다. 세션을 시작하면 키가 다시 살아납니다."),
        ("흑백 + 주황색 점", "Claude Deck 설정이 아직 필요합니다. 아무 키의 설정 패널을 열고 목록을 따라가세요."),
    ],
    "trouble_h": "문제가 있을 때",
    "trouble": [
        ("claude가 실행 중인데도 키가 회색입니다",
         "훅은 세션이 시작될 때 읽히므로, 추적을 켜기 전부터 열려 있던 세션은 아무것도 보고하지 않습니다. 해당 세션을 다시 시작하세요. 그래도 안 되면 패널의 설정 목록을 확인하세요."),
        ("키를 눌러도 아무 일도 없습니다",
         "대개 macOS가 터미널 제어를 차단한 경우입니다. 패널에서 <b>터미널 접근 확인</b>을 누르고, 차단으로 표시되면 시스템 설정 → 개인정보 보호 및 보안 → 자동화에서 Ulanzi Studio를 허용하세요."),
        ("질문이 큰 키에 나타나지 않습니다",
         "다중 선택 질문은 덱에서 답할 수 없습니다. 이 경우 키가 안내하고 터미널로 이동시킵니다. 그 외 질문은 1~2초 안에 큰 키에 표시됩니다."),
        ("큰 화면이 기본 위젯으로 돌아갔습니다",
         "페이지를 편집하면 Ulanzi Studio가 해당 자리를 다시 씁니다. 화면 설정 키를 다시 누르고 Studio가 재시작되도록 두세요."),
    ],
    "footer": "Claude Deck은 오픈 소스입니다 — 이슈와 소스 코드:",
}

T["zh_CN"] = {
    "title": "Claude Deck — 用户指南",
    "intro": "Claude Deck 把 Claude Code 会话的状态直接显示在按键上：哪个在工作、哪个在向你提问、上下文还剩多少。你还可以不碰键盘就回答问题、执行 /compact 或 /clear。",
    "needs": "你需要：macOS、Ulanzi Studio，以及 Anthropic 的 Claude Code CLI。Claude Deck 是 Claude Code 的配套插件，单独使用没有任何内容可显示。",
    "setup_h": "开始设置",
    "steps": [
        ("1. 安装 Claude Code",
         "Claude Code 是 Anthropic 提供的 Claude 命令行工具。请按官方安装说明安装，然后在终端运行一次 <code>claude</code>，让它生成配置文件。"),
        ("2. 启用 Claude 追踪",
         "把任意 Claude Deck 动作拖到按键上并打开它的设置面板。设置列表会显示还缺什么，点击 <b>启用 Claude 追踪</b>。这会在你的 Claude Code 配置中添加 hook（会先保存备份），让按键能读取会话状态。已经在运行的 claude 会话需要重启。"),
        ("3. 允许控制终端",
         "在面板中选择你的终端（iTerm2 或 Terminal.app），点击 <b>检查终端访问权限</b> 并同意 macOS 的提示。现在处理好，可以避免以后按键看起来毫无反应。如果之前拒绝过：系统设置 → 隐私与安全性 → 自动化 → Ulanzi Studio。"),
        ("4. 可选：大屏显示",
         "按一次 <b>大屏设置</b> 键，即可把 Claude 会话显示放到大按键上。Ulanzi Studio 会自行重启以生效（约 15 秒）。再按一次可把大按键还给内置小组件。"),
    ],
    "keys_h": "每个按键的功能",
    "icons_h": "图标含义",
    "icons": [
        ("彩色", "正在追踪一个 Claude Code 会话。"),
        ("黑白", "当前没有运行中的会话。启动一个会话，按键就会恢复。"),
        ("黑白加琥珀色圆点", "Claude Deck 尚未完成设置——打开任意按键的设置面板，按照列表逐项完成。"),
    ],
    "trouble_h": "如果遇到问题",
    "trouble": [
        ("claude 正在运行，按键却仍然是灰的",
         "hook 在会话启动时读取，因此启用追踪之前就已打开的会话不会上报任何内容。请重启这些会话。如果仍无效，请打开面板查看设置列表。"),
        ("按下按键没有任何反应",
         "通常是 macOS 阻止了终端控制。请在面板中点击 <b>检查终端访问权限</b>；若显示被阻止，请在 系统设置 → 隐私与安全性 → 自动化 中允许 Ulanzi Studio。"),
        ("大按键上不显示问题",
         "多选题无法从按键回答——按键会提示并带你回到终端。其他问题会在一两秒内显示在大按键上。"),
        ("大屏又变回内置小组件了",
         "编辑页面时 Ulanzi Studio 会重写该位置。再按一次大屏设置键，等待 Studio 重启即可。"),
    ],
    "footer": "Claude Deck 是开源项目——问题反馈与源码：",
}

T["zh_HK"] = {
    "title": "Claude Deck — 使用指南",
    "intro": "Claude Deck 會喺按鍵上直接顯示 Claude Code 工作階段嘅狀態：邊個喺度做嘢、邊個喺度問你嘢、仲剩幾多上下文。你亦可以唔掂鍵盤就回答問題、執行 /compact 或 /clear。",
    "needs": "你需要：macOS、Ulanzi Studio，以及 Anthropic 嘅 Claude Code CLI。Claude Deck 係 Claude Code 嘅配套外掛，單獨使用冇嘢可以顯示。",
    "setup_h": "開始設定",
    "steps": [
        ("1. 安裝 Claude Code",
         "Claude Code 係 Anthropic 提供嘅 Claude 命令列工具。請按官方安裝說明安裝，然後喺終端機執行一次 <code>claude</code>，等佢建立設定檔。"),
        ("2. 啟用 Claude 追蹤",
         "將任何 Claude Deck 動作拖去按鍵，然後打開佢嘅設定面板。設定清單會顯示仲欠咩，撳 <b>啟用 Claude 追蹤</b>。呢個動作會喺你嘅 Claude Code 設定加入 hook（會先儲存備份），令按鍵可以讀取工作階段狀態。已經行緊嘅 claude 工作階段要重啟。"),
        ("3. 允許控制終端機",
         "喺面板揀你嘅終端機（iTerm2 或 Terminal.app），撳 <b>檢查終端機存取權</b> 並同意 macOS 嘅提示。而家處理好，可以避免之後按鍵好似冇反應。如果之前拒絕咗：系統設定 → 私隱與安全性 → 自動化 → Ulanzi Studio。"),
        ("4. 可選：大屏幕",
         "撳一次 <b>大屏幕設定</b> 鍵，就可以將 Claude 工作階段顯示放上大按鍵。Ulanzi Studio 會自動重啟以套用（約 15 秒）。再撳一次就可以還返個大按鍵俾內置小工具。"),
    ],
    "keys_h": "每個按鍵嘅功能",
    "icons_h": "圖示嘅意思",
    "icons": [
        ("彩色", "正在追蹤一個 Claude Code 工作階段。"),
        ("黑白", "而家冇執行中嘅工作階段。開一個就會回復正常。"),
        ("黑白加琥珀色圓點", "Claude Deck 仲未設定好——打開任何按鍵嘅設定面板，跟住清單逐項完成。"),
    ],
    "trouble_h": "如果有問題",
    "trouble": [
        ("claude 行緊，但按鍵仲係灰色",
         "hook 喺工作階段開始時先讀取，所以喺你啟用追蹤之前已經開咗嘅工作階段唔會上報任何嘢。請重啟佢哋。如果仲係咁，請喺面板睇吓設定清單。"),
        ("撳按鍵冇任何反應",
         "通常係 macOS 阻止咗終端機控制。喺面板撳 <b>檢查終端機存取權</b>；如果顯示被阻止，請喺 系統設定 → 私隱與安全性 → 自動化 允許 Ulanzi Studio。"),
        ("大按鍵冇顯示問題",
         "多選題冇辦法喺按鍵回答——按鍵會提示你，並帶你返終端機。其他問題會喺一兩秒內顯示喺大按鍵。"),
        ("大屏幕變返做內置小工具",
         "編輯頁面時 Ulanzi Studio 會覆寫嗰個位置。再撳一次大屏幕設定鍵，等 Studio 重啟就得。"),
    ],
    "footer": "Claude Deck 係開源項目——問題回報同原始碼：",
}

TEMPLATE = """<!DOCTYPE html>
<html lang="{htmllang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title>
<style>
  :root {{ color-scheme: dark; }}
  body {{
    margin: 0; padding: 32px 20px 64px;
    background: #1e1f22; color: #e8e8ec;
    font: 15px/1.6 -apple-system, "Segoe UI", "PingFang SC", "Hiragino Sans", "Noto Sans KR", Roboto, sans-serif;
  }}
  main {{ max-width: 720px; margin: 0 auto; }}
  h1 {{ font-size: 26px; margin: 0 0 4px; letter-spacing: .3px; }}
  h1 .mark {{ color: #d77757; }}
  h2 {{ font-size: 15px; text-transform: uppercase; letter-spacing: 1.2px; opacity: .65;
       margin: 34px 0 12px; font-weight: 600; }}
  p {{ margin: 0 0 12px; }}
  .lede {{ font-size: 16px; }}
  .needs {{ background: #26272b; border-left: 3px solid #d77757; padding: 12px 14px; border-radius: 0 6px 6px 0; }}
  .step {{ margin: 0 0 18px; }}
  .step h3 {{ font-size: 15px; margin: 0 0 4px; }}
  .step p {{ margin: 0; opacity: .85; }}
  table {{ border-collapse: collapse; width: 100%; }}
  td {{ padding: 7px 10px 7px 0; border-bottom: 1px solid #2c2d32; vertical-align: top; }}
  td.k {{ white-space: nowrap; font-weight: 600; width: 1%; }}
  td.d {{ opacity: .8; font-size: 14px; }}
  .icons li {{ margin-bottom: 6px; }}
  .q {{ font-weight: 600; margin: 0 0 2px; }}
  .a {{ opacity: .8; margin: 0 0 14px; }}
  code {{ background: #2c2d32; border-radius: 4px; padding: 1px 5px; font-size: 13px; }}
  a {{ color: #7ab8f5; }}
  footer {{ margin-top: 40px; padding-top: 16px; border-top: 1px solid #2c2d32; opacity: .6; font-size: 13px; }}
  .langs {{ display: flex; flex-wrap: wrap; gap: 6px; margin: 14px 0 22px; }}
  .langs a {{
    padding: 3px 9px; border-radius: 999px; font-size: 13px; text-decoration: none;
    color: #b9b9c2; background: #26272b; border: 1px solid transparent;
  }}
  .langs a:hover {{ background: #303137; color: #e8e8ec; }}
  .langs a[aria-current="page"] {{ background: #d77757; border-color: #d77757; color: #1e1f22; font-weight: 600; }}
</style>
</head>
<body>
<main>
  <h1><span class="mark">Claude</span> Deck</h1>
  <nav class="langs">{langs}</nav>
  <p class="lede">{intro}</p>
  <p class="needs">{needs} <a href="{docs}">{docs}</a></p>

  <h2>{setup_h}</h2>
  {steps}

  <h2>{keys_h}</h2>
  <table>{keys}</table>

  <h2>{icons_h}</h2>
  <ul class="icons">{icons}</ul>

  <h2>{trouble_h}</h2>
  {trouble}

  <footer>{footer} <a href="{repo}">{repo}</a> · v{version}</footer>
</main>
</body>
</html>
"""


def build(lang: str) -> str:
    t = T[lang]
    data = json.loads((ROOT / f"{lang}.json").read_text(encoding="utf-8"))
    version = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))["Version"]

    steps = "\n  ".join(
        f'<div class="step"><h3>{escape(h)}</h3><p>{b}</p></div>' for h, b in t["steps"]
    )
    # names and tooltips come from the language file, so the guide always
    # matches what Studio lists in the action bar
    keys = "".join(
        f'<tr><td class="k">{escape(a["Name"])}</td><td class="d">{escape(a["Tooltip"])}</td></tr>'
        for a in data["Actions"]
    )
    icons = "".join(f"<li><b>{escape(n)}</b> — {escape(d)}</li>" for n, d in t["icons"])
    # sibling pages sit next to this one, so plain relative links work whether
    # the guide is opened from disk or served over http
    langs = "".join(
        f'<a href="{other}.html" hreflang="{other.replace("_", "-")}"'
        f'{" aria-current=\"page\"" if other == lang else ""}>{escape(LANG_NAMES[other])}</a>'
        for other in LANGS
    )
    trouble = "\n  ".join(
        f'<p class="q">{escape(q)}</p><p class="a">{a}</p>' for q, a in t["trouble"]
    )
    return TEMPLATE.format(
        htmllang=lang.replace("_", "-"),
        langs=langs,
        title=escape(t["title"]),
        intro=escape(t["intro"]),
        needs=escape(t["needs"]),
        setup_h=escape(t["setup_h"]),
        steps=steps,
        keys_h=escape(t["keys_h"]),
        keys=keys,
        icons_h=escape(t["icons_h"]),
        icons=icons,
        trouble_h=escape(t["trouble_h"]),
        trouble=trouble,
        footer=escape(t["footer"]),
        docs=DOCS_URL,
        repo=REPO_URL,
        version=version,
    )


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for lang in LANGS:
        page = build(lang)
        (OUT / f"{lang}.html").write_text(page, encoding="utf-8")
        print(f"guide/{lang}.html  {len(page):>6} bytes")


if __name__ == "__main__":
    main()
