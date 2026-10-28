from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor


ROOT = Path(__file__).resolve().parent
OUT = ROOT / "Texte_Expose_Militarisation_Arctique.docx"

NAVY = "123247"
CYAN = "17A9D4"
GREY = "5F6F7A"


def set_cell_shading(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), fill)
    tc_pr.append(shd)


def add_heading(doc, text, level=1):
    p = doc.add_paragraph()
    p.style = f"Heading {level}"
    run = p.add_run(text)
    run.font.name = "Arial"
    return p


def add_label(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(5)
    p.paragraph_format.space_after = Pt(2)
    run = p.add_run(text)
    run.bold = True
    run.font.name = "Arial"
    run.font.size = Pt(10)
    run.font.color.rgb = RGBColor.from_string(CYAN)
    return p


def add_body(doc, text, bold_start=None):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.line_spacing = 1.08
    if bold_start and text.startswith(bold_start):
        r1 = p.add_run(bold_start)
        r1.bold = True
        r2 = p.add_run(text[len(bold_start) :])
        runs = (r1, r2)
    else:
        runs = (p.add_run(text),)
    for run in runs:
        run.font.name = "Arial"
        run.font.size = Pt(10.5)
    return p


def add_bullet(doc, text):
    p = doc.add_paragraph(style="List Bullet")
    p.paragraph_format.space_after = Pt(3)
    run = p.add_run(text)
    run.font.name = "Arial"
    run.font.size = Pt(10.5)
    return p


def add_page_break(doc):
    doc.add_page_break()


def configure_styles(doc):
    styles = doc.styles
    normal = styles["Normal"]
    normal.font.name = "Arial"
    normal.font.size = Pt(10.5)

    for style_name, size, color in [
        ("Title", 28, NAVY),
        ("Subtitle", 13, GREY),
        ("Heading 1", 18, NAVY),
        ("Heading 2", 13, CYAN),
        ("Heading 3", 11, NAVY),
    ]:
        style = styles[style_name]
        style.font.name = "Arial"
        style.font.size = Pt(size)
        style.font.color.rgb = RGBColor.from_string(color)
        style.font.bold = style_name != "Subtitle"


def configure_page(doc):
    section = doc.sections[0]
    section.top_margin = Cm(1.8)
    section.bottom_margin = Cm(1.7)
    section.left_margin = Cm(2)
    section.right_margin = Cm(2)

    header = section.header.paragraphs[0]
    header.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    r = header.add_run("LA MILITARISATION DE L’ARCTIQUE · TEXTE DE L’EXPOSÉ")
    r.font.name = "Arial"
    r.font.size = Pt(7.5)
    r.font.color.rgb = RGBColor.from_string(GREY)

    footer = section.footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = footer.add_run("Document d’accompagnement · octobre 2026")
    r.font.name = "Arial"
    r.font.size = Pt(8)
    r.font.color.rgb = RGBColor.from_string(GREY)


def build_document():
    doc = Document()
    configure_styles(doc)
    configure_page(doc)

    title = doc.add_paragraph(style="Title")
    title.alignment = WD_ALIGN_PARAGRAPH.LEFT
    title.add_run("La militarisation\nde l’Arctique")
    subtitle = doc.add_paragraph(style="Subtitle")
    subtitle.add_run(
        "Texte complet de l’exposé · explication en russe · réponses aux questions"
    )

    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(18)
    r = p.add_run("VERSION 5 DIAPOSITIVES")
    r.bold = True
    r.font.name = "Arial"
    r.font.size = Pt(11)
    r.font.color.rgb = RGBColor.from_string(CYAN)

    add_body(
        doc,
        "Ce document accompagne la présentation PowerPoint. Il contient une explication simple du sujet, "
        "un texte oral en français et des réponses prêtes pour la discussion finale.",
    )

    add_label(doc, "COMMENT L’UTILISER")
    add_bullet(doc, "Pour un exposé de 5 à 7 minutes, lire la partie « Texte oral en français ».")
    add_bullet(doc, "Pour comprendre le sujet, commencer par l’explication en russe.")
    add_bullet(doc, "Pour la discussion, utiliser les réponses courtes puis développer si nécessaire.")

    add_page_break(doc)

    add_heading(doc, "1. Объяснение смысла презентации", 1)
    add_body(
        doc,
        "Милитаризация Арктики — это не обязательно подготовка к войне. Это увеличение военного присутствия: "
        "строительство и модернизация баз, размещение радаров и систем ПВО, патрулирование авиацией и флотом, "
        "проведение учений и защита стратегических объектов.",
    )

    add_heading(doc, "Главная идея", 2)
    add_body(
        doc,
        "Изменение климата делает Арктику более доступной, но само по себе не создаёт конфликт. "
        "Военное соперничество появляется потому, что государства хотят защищать свои территории, "
        "контролировать маршруты и обеспечить работу ядерных сил сдерживания.",
    )

    add_heading(doc, "Что означает каждый слайд", 2)
    add_bullet(
        doc,
        "Слайд 1 — постановка проблемы: становится ли Арктика новым стратегическим фронтиром?",
    )
    add_bullet(
        doc,
        "Слайд 2 — причина роста интереса: сокращение морского льда облегчает доступ к отдельным маршрутам и районам, "
        "но условия остаются крайне тяжёлыми.",
    )
    add_bullet(
        doc,
        "Слайд 3 — соотношение сил: Россия имеет географическое и ядерное преимущество; НАТО — преимущество союза; "
        "Китай влияет на регион, но пока не обладает сопоставимым военным присутствием.",
    )
    add_bullet(
        doc,
        "Слайд 4 — основные зоны риска: Кольский полуостров и проход GIUK, Гренландия, Берингов пролив и Северный морской путь.",
    )
    add_bullet(
        doc,
        "Слайд 5 — вопросы без однозначного ответа. Их цель — показать, что безопасность и эскалация могут усиливаться одновременно.",
    )

    add_heading(doc, "Основной вывод", 2)
    add_body(
        doc,
        "Наиболее вероятная опасность — не заранее запланированная война, а непреднамеренная эскалация: "
        "инцидент, неверная интерпретация действий другой стороны и слишком быстрая ответная реакция. "
        "Поэтому необходимы не только вооружения, но и каналы связи, правила поведения и ограниченное сотрудничество.",
    )

    add_page_break(doc)

    add_heading(doc, "2. Texte oral en français", 1)
    add_body(
        doc,
        "Durée indicative : 5 à 7 minutes. Le texte peut être lu presque tel quel.",
    )

    add_heading(doc, "Diapositive 1 — Introduction", 2)
    add_body(
        doc,
        "Bonjour. Aujourd’hui, je vais parler de la militarisation de l’Arctique. "
        "La question centrale est la suivante : la fonte des glaces transforme-t-elle le Grand Nord "
        "en nouvelle frontière stratégique ? Par militarisation, on entend l’augmentation des bases, "
        "des radars, des exercices, des patrouilles et des capacités de défense. Cela ne signifie pas "
        "qu’une guerre est inévitable. Cela signifie que les États accordent à cette région une importance "
        "militaire croissante. Je vais d’abord expliquer pourquoi l’Arctique attire davantage l’attention, "
        "puis présenter les principaux acteurs et enfin les zones où le risque d’escalade est le plus élevé.",
    )

    add_heading(doc, "Diapositive 2 — Pourquoi maintenant ?", 2)
    add_body(
        doc,
        "Le premier facteur est le changement climatique. Selon le NSIDC, la tendance du minimum de banquise "
        "de septembre entre 1979 et 2025 est une baisse de 12,1 % par décennie. Certaines routes maritimes "
        "peuvent donc rester accessibles plus longtemps pendant l’été. Mais il ne faut pas imaginer une mer "
        "facile à traverser : la météo, la glace mobile, les distances et le manque d’infrastructures rendent "
        "toujours les opérations très coûteuses.",
    )
    add_body(
        doc,
        "L’Arctique possède aussi une valeur militaire ancienne. C’est une zone importante pour l’alerte radar, "
        "les satellites, l’aviation et surtout les sous-marins nucléaires. La route la plus courte entre la Russie "
        "et l’Amérique du Nord passe également par le Nord. La fonte des glaces crée donc une opportunité d’accès, "
        "mais c’est la rivalité entre puissances qui transforme cette opportunité en enjeu stratégique.",
    )

    add_page_break(doc)

    add_heading(doc, "Diapositive 3 — Les acteurs", 2)
    add_body(
        doc,
        "La Russie est l’acteur militaire le plus fortement installé dans l’Arctique. Elle possède la plus longue "
        "façade arctique et concentre autour de la péninsule de Kola une partie essentielle de sa flotte du Nord. "
        "Des sous-marins nucléaires lanceurs d’engins y garantissent une capacité de seconde frappe. Moscou cherche "
        "donc à créer un bastion protégé par des avions, des radars, des systèmes antiaériens et des missiles côtiers.",
    )
    add_body(
        doc,
        "L’OTAN a changé de géographie avec l’adhésion de la Finlande en 2023 et de la Suède en 2024. "
        "Sept des huit États arctiques appartiennent désormais à l’Alliance. Cela facilite la surveillance, "
        "la planification et le déplacement des renforts entre l’Amérique du Nord et l’Europe du Nord. "
        "En 2026, l’activité Arctic Sentry renforce cette coordination.",
    )
    add_body(
        doc,
        "La Chine est un acteur différent. Elle n’a aucune côte arctique, mais elle investit dans la recherche, "
        "les routes maritimes, l’énergie et certains partenariats avec la Russie. Son influence augmente, "
        "mais sa présence militaire reste limitée. Il faut donc la considérer comme une puissance d’influence "
        "et d’accès, et non comme l’équivalent militaire actuel de la Russie ou de l’OTAN.",
    )

    add_heading(doc, "Diapositive 4 — Les points chauds", 2)
    add_body(
        doc,
        "Trois espaces concentrent les risques. Le premier est l’ensemble Kola–mer de Barents–passage GIUK, "
        "entre le Groenland, l’Islande et le Royaume-Uni. Les sous-marins russes y croisent les missions de "
        "surveillance alliées et les routes utilisées pour envoyer des renforts dans l’Atlantique Nord.",
    )
    add_body(
        doc,
        "Le deuxième espace est le Groenland. Sa position est importante pour l’alerte avancée, les satellites "
        "et la défense de l’Amérique du Nord. Les infrastructures civiles peuvent également avoir une fonction militaire.",
    )
    add_body(
        doc,
        "Le troisième espace est le détroit de Béring et la route maritime du Nord. La Russie veut contrôler "
        "la navigation le long de ses côtes, tandis que la coopération avec la Chine se développe. "
        "Le risque principal n’est pas forcément une attaque volontaire. Il peut s’agir d’une collision, "
        "d’un brouillage, d’une interception ou d’un exercice mal interprété. Un incident produit une perception "
        "de menace, puis une riposte : c’est le mécanisme d’escalade involontaire.",
    )

    add_heading(doc, "Diapositive 5 — Discussion", 2)
    add_body(
        doc,
        "Pour conclure, l’Arctique est aujourd’hui un espace de dissuasion, de surveillance et de compétition. "
        "La présence militaire peut empêcher une attaque directe, mais elle augmente aussi le risque d’erreur. "
        "La question n’est donc pas seulement de savoir qui possède le plus de moyens, mais comment éviter "
        "qu’un incident limité devienne une crise majeure. Je vous propose maintenant trois questions.",
    )

    add_page_break(doc)

    add_heading(doc, "3. Réponses aux questions finales", 1)

    add_heading(doc, "Question 1", 2)
    add_body(doc, "La dissuasion rend-elle l’Arctique plus sûr ?")
    add_label(doc, "RÉPONSE COURTE")
    add_body(
        doc,
        "Elle réduit le risque d’une attaque volontaire, mais elle augmente le coût d’une erreur ou d’un malentendu.",
    )
    add_label(doc, "RÉPONSE DÉVELOPPÉE")
    add_body(
        doc,
        "La dissuasion peut stabiliser la région parce qu’aucun acteur ne veut provoquer un affrontement direct "
        "entre puissances nucléaires. Cependant, plus il existe de sous-marins, d’avions, de radars et d’exercices, "
        "plus les occasions d’incident se multiplient. La sécurité dépend donc de deux éléments : des capacités "
        "crédibles pour décourager une attaque et des mécanismes de communication pour éviter une mauvaise interprétation. "
        "La dissuasion seule ne suffit pas.",
    )
    add_label(doc, "СМЫСЛ ПО-РУССКИ")
    add_body(
        doc,
        "Сдерживание уменьшает вероятность намеренной атаки, но большое количество вооружений повышает цену ошибки. "
        "Поэтому нужны и силы обороны, и связь между сторонами.",
    )

    add_heading(doc, "Question 2", 2)
    add_body(doc, "L’OTAN protège-t-elle ou accélère-t-elle l’escalade ?")
    add_label(doc, "RÉPONSE COURTE")
    add_body(
        doc,
        "Les deux effets existent : l’OTAN rassure ses membres, mais la Russie peut interpréter son renforcement comme une menace.",
    )
    add_label(doc, "RÉPONSE DÉVELOPPÉE")
    add_body(
        doc,
        "Pour la Finlande, la Suède et la Norvège, l’intégration à l’OTAN renforce la défense collective, "
        "la surveillance et la capacité de recevoir des renforts. Cela peut décourager une agression. "
        "Mais du point de vue russe, l’extension des activités alliées près de Kola peut sembler menacer "
        "la flotte du Nord et la dissuasion nucléaire. C’est le dilemme de sécurité : une mesure défensive "
        "pour un camp paraît offensive à l’autre. La solution consiste à combiner fermeté, proportionnalité "
        "et transparence sur les exercices.",
    )
    add_label(doc, "СМЫСЛ ПО-РУССКИ")
    add_body(
        doc,
        "НАТО одновременно защищает своих членов и усиливает тревогу России. Это не противоречие, а классическая "
        "дилемма безопасности: оборона одной стороны воспринимается другой как угроза.",
    )

    add_heading(doc, "Question 3", 2)
    add_body(
        doc,
        "Peut-on coopérer sur le climat tout en rivalisant militairement ?",
    )
    add_label(doc, "RÉPONSE COURTE")
    add_body(
        doc,
        "Oui, mais surtout dans des domaines techniques et limités : science, météo, secours, pollution et pêche.",
    )
    add_label(doc, "RÉPONSE DÉVELOPPÉE")
    add_body(
        doc,
        "Les États ont des intérêts communs malgré leur rivalité. Un accident maritime, une marée noire ou une "
        "opération de secours exige une coordination rapide. Le Conseil de l’Arctique poursuit certains travaux "
        "scientifiques, même si les réunions politiques sont limitées depuis 2022 et si son mandat exclut la sécurité "
        "militaire. Une coopération sélective reste donc possible. Elle ne supprime pas la compétition, mais elle peut "
        "réduire les risques humains et environnementaux.",
    )
    add_label(doc, "СМЫСЛ ПО-РУССКИ")
    add_body(
        doc,
        "Ограниченное сотрудничество возможно там, где интересы совпадают: спасательные операции, наука, погода, "
        "экология и рыболовство. Оно не отменяет военное соперничество.",
    )

    add_page_break(doc)

    add_heading(doc, "4. Vocabulaire essentiel", 1)
    rows = [
        ("Terme français", "Значение по-русски"),
        ("Banquise", "Морской лёд, образующийся при замерзании океана."),
        ("Militarisation", "Рост военного присутствия и значения региона."),
        ("Dissuasion", "Сдерживание: угроза ответного ущерба, препятствующая атаке."),
        ("SNLE", "Атомная подлодка с баллистическими ракетами."),
        ("Seconde frappe", "Способность нанести ядерный ответ после первого удара противника."),
        ("Déni d’accès", "Средства, затрудняющие вход противника в определённую зону."),
        ("Bastion", "Защищённая зона действий стратегических подлодок."),
        ("GIUK", "Морской проход между Гренландией, Исландией и Великобританией."),
        ("NSR / Route maritime du Nord", "Северный морской путь вдоль российского побережья."),
        ("Zone grise", "Давление ниже порога открытой войны: кибератаки, помехи, саботаж."),
        ("Escalade involontaire", "Непреднамеренное обострение из-за ошибки или неверной интерпретации."),
    ]
    table = doc.add_table(rows=len(rows), cols=2)
    table.style = "Table Grid"
    table.autofit = False
    table.columns[0].width = Cm(5.2)
    table.columns[1].width = Cm(11.3)
    for i, row in enumerate(rows):
        for j, value in enumerate(row):
            cell = table.cell(i, j)
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            cell.text = value
            for p in cell.paragraphs:
                for run in p.runs:
                    run.font.name = "Arial"
                    run.font.size = Pt(9.5)
                    if i == 0:
                        run.bold = True
                        run.font.color.rgb = RGBColor(255, 255, 255)
            if i == 0:
                set_cell_shading(cell, NAVY)
            elif i % 2 == 0:
                set_cell_shading(cell, "EAF4F8")

    add_heading(doc, "5. Sources principales", 1)
    sources = [
        "OTAN, Arctic Sentry, 11 février 2026 — https://www.nato.int/",
        "OTAN, sécurité dans l’Arctique et le Grand Nord, 8 juin 2026 — https://www.nato.int/",
        "NSIDC, minimum de banquise arctique 2025 — https://nsidc.org/",
        "Conseil de l’Arctique, mandat et mise à jour 2026 — https://arctic-council.org/",
        "U.S. Department of Defense, 2024 Arctic Strategy — https://www.defense.gov/",
        "CSIS, analyses sur la péninsule de Kola et la présence russe — https://www.csis.org/",
    ]
    for source in sources:
        add_bullet(doc, source)

    props = doc.core_properties
    props.title = "Texte de l’exposé — La militarisation de l’Arctique"
    props.subject = "Script oral, explication en russe et réponses aux questions"
    props.author = "Cursor"
    props.keywords = "Arctique, militarisation, exposé, OTAN, Russie, Chine"

    doc.save(OUT)
    print(f"Created: {OUT}")


if __name__ == "__main__":
    build_document()
