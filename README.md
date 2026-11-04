# Mekanismdesignern

Ett webbaserat designverktyg för Teknik åk 7–9. Eleven väljer först vad mekanismen ska göra, till exempel öppna en lucka eller skjuta en dörr, och därefter en mekanism som löser uppgiften. Sedan anpassar eleven mått och servo. Programmet visar lösningen i 3D med animation, sprängvy och stegvis montering, och det skapar STL-filer för 3D-utskrift.

Version 2.0 lägger till målstyrt läge, montering direkt på servoaxeln, 360°-servon, servo på avstånd, nivåer och anpassning till mobil, surfplatta och dator. Se [CHANGELOG.md](CHANGELOG.md).

Länk med förvald nivå: lägg till `#nyborjare`, `#van` eller `#expert` sist i adressen.

## Kom igång

- **Använda programmet:** öppna `dist/index.html` i Chrome, Edge, Firefox eller Safari. Filen är fristående och kräver varken installation, inloggning eller nätverk. Den fungerar också på Chromebook.
- **Utveckla:**

  ```bash
  npm install
  npm test        # enhetstester
  npm run build   # bygger dist/index.html
  ```

## Vad programmet gör

| Steg | Innehåll |
| --- | --- |
| 1. Uppgift | Öppna en lucka, öppna en dörr, skjuta en dörr eller ett fönster, lyfta en modellhiss. Två dörrar kommer i version 2. |
| 2. Mekanism | Programmet rangordnar lämpliga mekanismer och markerar en som ”Bra start”. Varje förslag visas i rörelse. |
| 3. Motor och mått | Val av servo (SG90 eller MG90S) och reglage för mått och passningsspel, med förklaringar. Kontrollerna uppdateras direkt. |
| 4. Granska | Formler, insatta värden och säkerhetsmarginal för vridmoment. |
| 5. Montera | Monteringssteg där varje steg animeras. Samma delnummer används i instruktionen, dellistan, sprängvyn och filnamnen. |
| 6. Exportera | STL per del, en samlad STL utlagd på byggplattan, kontroll av plattans storlek (med flera plattor vid behov) och ett ZIP-paket med stycklista och instruktion. |

Följande mekanismer finns i version 1:

- **Servoarm (direkt):** servoaxeln sitter i gångjärnets linje.
- **Hävarm med länkstång:** en fyrledsmekanism som löses numeriskt, med varning för dödpunkt.
- **Kuggstång med drev:** drevet har evolventprofil, och kuggstången styrs av en hållare med styrskena och justerbart passningsspel.

Delarna delas in i fyra materialkategorier, som var och en har en egen färg och ikon:

| Kategori | Exempel |
| --- | --- |
| 3D-skrivs | servofäste, arm, drev, kuggstång |
| Från materiallådan | servo, skruvar |
| Bygger själv | lucka, dörr |
| Visningsdel | exempelstomme |

Den samlade STL-filen innehåller bara de delar som ska skrivas ut.

## Struktur

```
src/catalog.js     servokatalog, byggplattor, kategorier, uppgifter
src/geom.js        2D-former, extrudering, kugghjul och kuggstång
src/mechanisms.js  datamodell: delar, kinematik, steg, beräkningar (en källa för allt)
src/stl.js         binär STL och kontroll av slutna skal
src/export.js      utskriftsorientering, packning på byggplatta, ZIP-paket
src/zip.js         ZIP utan beroenden
src/app.js         gränssnitt och 3D-vy (three.js)
src/index.html     sidmall och stil
test/              enhetstester (node --test)
build.mjs          bygger en fristående dist/index.html
```

All geometri, kinematik och export byggs från samma modell, som skapas av `bygg(design)` i `src/mechanisms.js`. Därför visar animationen, monteringsvyn, dellistan och filerna alltid samma val och mått.

## Tester

Testerna (39 st i `test/mekanism.test.js` och `test/v2.test.js`) kontrollerar följande:

- att varje skal är slutet och har positiv volym, även vid parametrarnas gränsvärden
- formler och kinematik
- att delnumren är konsekventa
- att den samlade STL-filen har rätt antal kroppar, att kropparna inte överlappar och att de håller marginalen till plattans kant
- att byggplattekontrollen fungerar
- att ZIP-paketet är giltigt
- att en måttändring slår igenom både i dellistan och i geometrin
- målstyrt läge (AK-11–13), axelhålets mått och oberoende av passningsspelet, 360°-servo, pianotråd och kalibreringsbit
- att designer från version 1 ger samma STL som tidigare (`test/golden-v1.json`)

Kravens ID (till exempel FK-STL-02 och AK-3) hänvisar till kravlistan i programbeskrivningen.

## Begränsningar

- Servomåtten är ungefärliga och bör kontrolleras mot skolans servon (expertnivå → Avancerat).
- Axelhålets standardmått 4,9 mm måste provas med K01 på skolans skrivare innan eleverna använder direktmontering.
- Beräkningarna är uppskattningar för statisk last med säkerhetsfaktor 1,3. De ersätter inte dimensionering.
- Kuggstänger som är längre än byggplattan markeras men delas ännu inte automatiskt.
