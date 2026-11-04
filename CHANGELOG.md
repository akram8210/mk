# Ändringslogg

## 2.0.0 – 2026-11-04 (pilot med tekniklärare)

Byggd utifrån programbeskrivningen för version 2. Versionen bygger på lärarens reflektion efter version 1 och på återkoppling från agenterna för design, ingenjörsarbete, test och undervisning.

- **Målstyrt läge.** Eleven anger slaglängd eller öppningsvinkel, och programmet räknar baklänges fram drev, kuggar eller hävarm.
  - Uträkningen visas steg för steg.
  - Programmet anger vilken servovinkel som ger exakt rätt mått.
  - Eleven gissar först (förutsäg–observera–förklara) på nivåerna Nybörjare och Van.
- **Montering direkt på servoaxeln.**
  - Axelhålet är 4,9 mm som standard och kan justeras mellan 4,6 och 5,2 mm. Måttet påverkas inte av passningsspelet.
  - Hålet kan vara runt eller ha krossribbor. Det finns en fasning och en valfri låsskruv.
  - Måttet h_axel och en frigång på 0,5 mm gör att delen hamnar på rätt höjd.
- **Kalibreringsbit K01 och skrivarprofil.** K01 har sju hål mellan 4,6 och 5,2 mm. Profilen sparas per servo.
- **Servokatalog med fyra servon.** Leverantör A och B, i varianterna 180° och 360°. Servomåtten kan ändras på expertnivån.
- **360°-servo.**
  - Slaglängden räknas i antal varv.
  - Programmet lägger till hållare för ändlägesbrytare och mikrobrytare.
  - Tiden för rörelsen beräknas.
  - Om 360°-servot används till svängande mekanismer visas en varning.
- **Servo på avstånd.**
  - Länkstången kan vara 20–250 mm. Är den längre än 80 mm görs den av pianotråd och programmet skapar en böjmall.
  - Verkningsgraden räknas in i säkerhetsmarginalen.
  - Servofästet har fästhål i ett 10 mm-raster.
- **Nivåer.** Nybörjare, Van och Expert väljs i början eller via länk (#nyborjare, #van, #expert).
- **Anpassning till enheten.** Layouten anpassar sig till mobil, surfplatta och dator. 3D-vyn kan styras med pekgester, och kvaliteten sänks automatiskt på långsamma enheter. Filer kan delas från surfplatta och mobil.
- **Jämförelse och dokumentation.**
  - Steget Mekanism har en jämförelsetabell.
  - Eleven skriver sin designmotivering i Granska och kan exportera den som .md.
  - Designen kan sparas och öppnas som fil (.json).
- **Övrigt i 3D-vyn och exporten.**
  - Måttlinjer i 3D-vyn.
  - Creality K1C är förvald byggplatta.
  - ZIP-filen innehåller K01 och designmotiveringen.
- **Kompatibilitet.** Designer från version 1 öppnas med fäste via servohornet och ger samma STL-filer som tidigare. Testerna kontrollerar detta mot referensfiler.
- **Tester.** Det finns nu 39 enhetstester, varav 21 är nya.

Planerat till 2.1: push-pull-vajer och förlängningsaxel, delad kuggstång, två dörrar, vev–slid, lintrumma och block och talja.

## 1.0.0 – 2026-11-04

Ny fristående version byggd från programbeskrivningen. Den innehåller steg 1–4 i den föreslagna genomförandeordningen.

- Arbetsgången börjar med uppgiften och går sedan vidare till mekanismen, med fyra uppgifter och rangordnade förslag.
- Programmet har tre mekanismer: servoarm, hävarm med länkstång och kuggstång med drev och hållare.
- En gemensam datamodell styr 3D-vy, animation, sprängvy, monteringssteg, dellista och export.
- Delarna delas in i fyra materialkategorier med egen färg och ikon.
- Sprängvyn har ett reglage, delnummer och hjälplinjer mellan hål och axlar.
- Monteringen visas steg för steg, och delarna glider på plats i 3D-vyn.
- Det går att exportera STL per del, en samlad STL utlagd på plattan och ett ZIP-paket med stycklista (CSV), LASMIG.txt och design.json.
- Programmet kontrollerar om delarna ryms på byggplattan och fördelar dem på flera plattor vid behov.
- Beräkningarna visar slaglängd, utväxling, vridmoment och säkerhetsmarginal med färgkodade kontroller.
- Det finns ångra-funktion och automatisk lokal sparning.
- 18 enhetstester ingår.

### Planerat till version 2

- Två dörrar som öppnas samtidigt (dubbel kuggstång, kugghjulspar, länkage).
- Vev–slid, lintrumma, block/talja och sammansatta maskiner.
- Förutsäg–observera–förklara, jämförelsetabell, nivåer för åk 7–9 och export av designmotivering.
- Automatisk delning av långa kuggstänger och en kalibreringsbit för passningsspel.
