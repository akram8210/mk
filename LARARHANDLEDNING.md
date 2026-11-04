# Lärarhandledning – Mekanismdesignern 2.0

## 1. Syfte och koppling till Lgr22

Mekanismdesignern stödjer elevernas förmåga att **identifiera och analysera tekniska lösningar**, eftersom eleven ser hur en servoarm, en hävarm eller en kuggstång omvandlar servots vridning. Den stödjer också förmågan att **lösa problem genom teknikutvecklingsarbete**, eftersom arbetet börjar i en uppgift i elevens eget bygge och inte i en färdig mekanism.

Vi anser att programmet är ett stöd för elevens resonemang och inte en ersättning för det. Eleven bör därför alltid motivera sitt val av mekanism i sin dokumentation.

Programmet berör centralt innehåll om:

- mekanismer för rörelse
- styrsystem med servo
- modeller och ritningar med digitala verktyg
- teknikutvecklingsarbetets faser

## 2. Arbetsgång för eleven

1. **Uppgift:** eleven väljer vad mekanismen ska göra.
2. **Mekanism:** eleven klickar på förslagen och jämför dem i 3D-vyn.
3. **Motor och mått:** eleven anpassar mått, servo och passningsspel och läser kontrollerna.
4. **Granska:** eleven läser formlerna och kontrollerar att säkerhetsmarginalen är grön.
5. **Montera:** eleven följer stegen och använder sprängvyn.
6. **Exportera:** eleven väljer byggplatta och hämtar STL- eller ZIP-filen.

## 3. Begrepp

| Begrepp | Förklaring för eleven |
| --- | --- |
| Mekanism | Delar som överför eller ändrar en rörelse. |
| Hävarm | En stång som vrids runt en punkt. Lång arm ger stor rörelse, kort arm ger stor kraft. |
| Länkstång | En stång med leder som för en rörelse vidare. |
| Drev | Ett litet kugghjul som driver något. |
| Kuggstång | En rak skena med kuggar som omvandlar vridning till rak rörelse. |
| Modul | Ett mått på hur stora kuggarna är. |
| Utväxling | Hur mycket en del vrids jämfört med en annan. |
| Vridmoment | Hur kraftigt något vrids (N·m eller kg·cm). |
| Slaglängd | Hur långt något rör sig från ena ändläget till det andra. |
| Passningsspel | Mellanrummet som gör att delar kan röra sig utan att kärva. |
| Sprängskiss | En bild där delarna är isärdragna så att man ser hur de hör ihop. |
| Säkerhetsmarginal | Hur många gånger starkare servot är än vad som behövs. |

## 4. Förslag på frågor att diskutera

- Varför måste servot orka mer med servoarm (direkt) än med hävarm?
- Vad händer med slaglängden och kraften om drevet får fler kuggar?
- Varför ska servot stå på 0° innan armen eller drevet skruvas fast?
- Vilka delar skrivs ut, och vilka kommer från materiallådan? Varför skriver vi inte ut skruvar?

## 5. Praktik: utskrift och montering

- **Utskrift:** PLA, 0,2 mm lagerhöjd (0,12–0,16 mm för modul 1), 3 perimetrar, 20–30 % fyllnad och inget stöd. Delarna läggs ut i rätt orientering automatiskt.
- **Byggplatta:** välj skolans skrivare. Om delarna inte ryms visar programmet hur många utskrifter som behövs.
- **Passningsspel:** standard är 0,3 mm. Om kuggstången kärvar ökar eleven spelet till 0,4–0,5 mm och skriver ut hållaren igen.
- **Servo:** kontrollera att servots och hornets hål stämmer med utskriften innan hela klassen skriver ut. Måtten i programmet är ungefärliga.
- **Ström:** två servon bör ha egen 5 V-matning och inte drivas direkt från micro:bit.

## 6. Exempel på lektionsupplägg (åk 8, tre lektioner)

| Lektion | Innehåll |
| --- | --- |
| 1. Behov och förslag | Gemensam genomgång av uppgiften. Eleverna jämför minst två mekanismer i programmet och skriver ner för- och nackdelar. |
| 2. Val och anpassning | Eleverna anpassar måtten, granskar beräkningarna, skriver en kort motivering och exporterar. |
| 3. Bygga och förklara | Eleverna monterar med stöd av stegen och sprängvyn, testar med micro:bit och förklarar hela kedjan program → servo → mekanism → rörelse. |

## 7. Felsökning

| Problem | Åtgärd |
| --- | --- |
| Röd kontroll: ”Servot är för svagt” | Byt till hävarm, gör luckan lättare, välj färre kuggar eller MG90S. |
| ”Länkstången når inte” | Gör länkstången längre eller servoarmen kortare. |
| Delarna sitter för hårt | Öka passningsspelet och skriv ut igen. |
| STL-filen kommer som ZIP | I Claude-vyn sparas STL-filer i en ZIP-fil. Packa upp den. |
| Inga filer laddas ner | Öppna `index.html` direkt i webbläsaren och försök igen. |

## 8. Kommer i version 2

- Två dörrar som öppnas samtidigt.
- Vev–slid, lintrumma och block/talja.
- Förutsäg–observera–förklara, nivåer för åk 7–9 och export av designmotivering till den tekniska rapporten.

## 9. Nytt i version 2.0

### Nivåer
| Nivå | Förslag | Vad eleven ser |
| --- | --- | --- |
| Nybörjare | åk 7 | Bara målstyrt läge. Eleven gissar först och ser uträkningen steg för steg. |
| Van | åk 8 | Målstyrt läge och "prova själv", alla mått, servo på avstånd med länkstång. |
| Expert | åk 9 | Allt, även axelhål, hålprofil, låsskruv, skrivarprofil och servomått. |

Eleven väljer nivå i början och kan byta när som helst. Dela en länk med `#nyborjare`, `#van` eller `#expert` sist för att förvälja nivån.

### Innan direktmontering används med elever
1. Skriv ut K01 (Exportera → K01 Kalibreringsbit) på Creality K1C med PLA.
2. Prova hålen på varje servotyp, alltså båda leverantörerna i både 180°- och 360°-varianten.
3. Välj expertnivå, gå till Motor och mått och öppna Avancerat. Välj under Skrivarprofil det hål som satt bäst. Måttet sparas på enheten.
4. Mät servona med skjutmått och för in måtten under Avancerat om de skiljer sig från standardvärdena.

### 360°-servon
Ett 360°-servo styrs med fart (90 = stopp) och vet inte var det står. Programmet lägger därför till ändlägesbrytare. Detta är ett bra tillfälle att prata om öppen och sluten styrning och koppla det till växthusprojektet.

### Inköpslista
- Pianotråd 1,0 och 1,5 mm
- Mikrobrytare med arm (2 per 360°-mekanism)
- PTFE-rör eller tunna stålrör (för vajer i version 2.1)

### Pilot med tekniklärare
Varje lärare bygger en dörr som ska öppnas 50 mm och styras på 100 mm avstånd. Bygget görs med både 180°- och 360°-servo och på minst två enheter. Notera var ni fastnar, vilka texter som är otydliga och hur utskrifterna passar.
