# Quick-Björn

**▶ Spela: https://mikaelquick.github.io/bear/**

En webbklon av **Elasto Mania** (Balázs Rózsa, 2000) där kuskin är en björn och äpplena
är bikupor. Fysiken är portad rad för rad från originalets publicerade källkod, så den
elastiska fjädringen, hörnlåsningarna och volt-exploiten beter sig som i originalet.

> ⚠️ Läs [LICENSE.md](LICENSE.md) innan du publicerar något. Fysiken är ett derivat av
> kod under CC BY-NC-SA 4.0 med uttryckligt förbud mot kommersiell användning.

## Kom igång

```sh
npm start            # http://localhost:8080
npm test
```

Spelet ligger publicerat på GitHub Pages från `main` i roten — varje push
driftsätts automatiskt. Pages cachar med `max-age=600`, så en ändring kan ta upp till
tio minuter innan återvändande besökare ser den.

Ingen byggkedja och inga beroenden — rena ES-moduler och Canvas 2D.

Dev-servern skickar `no-store`. Det är inte kosmetiskt: med vanliga `http.server` cachar
webbläsaren ES-modulerna, och en ändrad fil syns inte förrän du hårdladdar. Två riktiga
buggar hann gömma sig bakom det under bygget.

Spelet lägger upp `window.bjorn` i konsolen för felsökning och automatiserade kontroller:

```js
bjorn.startLevel(0)      // starta bana (index i menylistan)
bjorn.startReplay(0)     // spela upp rekordet
bjorn.showMenu()
bjorn.openEditor()
bjorn.game               // tillstånd: .state .motor .ghost .recorder .level
bjorn.renderer           // .sx(x)/.sy(y) världskoordinat → skärm
bjorn.settings           // { ghost, sound }
```

Hela klarbarhetssökningen går att köra i webbläsaren mot den skarpa koden:

```js
const { Level } = await import('/js/level.js');
const { LEVELS } = await import('/js/levels.js');
const { solve } = await import('/test/autopilot.js');
LEVELS.map(d => [d.name, solve(new Level(d), 1200).result]);
```

## Så spelar du

Plocka alla bikupor, kör sedan in i honungskrukan. Du dör om björnens **huvud** nuddar
mark eller vägg, eller om huvudet eller ett hjul rör en getingsvärm. Kroppen går rakt
igenom väggar — det är så originalet fungerar och det är det banorna är byggda kring.

| Tangent | Funktion |
|---|---|
| `↑` | Gas. Håll in för länge och du slår runt bakåt. |
| `↓` | Broms. Låser båda hjulen, oberoende av körriktning. |
| `←` `→` | Volt — roterar cykeln. Riktningarna är absoluta, inte relativa till hur du är vänd. Båda samtidigt = supervolt. |
| `Space` | Vänd cykeln |
| `Enter` / `R` | Börja om |
| `P` | Paus |
| `G` | Visa/dölj ghost |
| `M` | Ljud av/på |
| `F` | Fullskärm av/på |
| `Esc` | Meny |

Tiden mäts i hundradelar och sparas per bana i `localStorage`.

**Mobil och surfplatta:** knappar dyker upp på skärmen när enheten har pekskärm.
Volt till vänster; vänd, broms och gas på en rad till höger, vänd innerst som en skiva
likt volterna. Den låg ett tag ovanpå pedalerna och tog då en remsa tvärs över synfältet
— på rad är högerklustret 104 px i stället för 153. När du dött räcker ett tryck var
som helst för att köra om.

Uppe i högra hörnet sitter **kugghjulet**, och det sitter ensamt: paus och meny i en
knapp. Det sitter numera i själva hörnet, och det krävde att skyddsytan kapas i stället
för att lydas rakt av — vilket behöver försvaras, eftersom att lyda den är regeln och
att strunta i den är precis så en knapp hamnade under kameran en gång. Skillnaden är att
den här sitter i ett *hörn*. `safe-area-inset-*` reserverar hela remsan längs en kant
fast det som är i vägen — ön, hemindikatorn — bara upptar mitten av den. Vriden är
scenens högerkant telefonens över- eller underkant (se tabellen i `:root`), och kugghjulet
sitter i änden av den, bredvid hindret och inte under det; att lyda hela insetet
knuffade in det upp till 59 px för en ö det aldrig skulle röra. Det ett hörn faktiskt
måste klara är den rundade skärmkanten: för en ruta indragen `d` på båda axlarna mot ett
hörn med radie `R` vill geometrin ha `d ≥ R(1 − 1/√2)`, alltså ungefär `0,29R` — så 18 px
täcker en radie på 61 px, mer än någon iPhone har. Där ligger taket, med golv på 6 px för
skärmar som varken har skyddsyta eller rundade hörn. Kupräknarens högermarginal följde
med ner, eftersom den siffran bara finns för att hålla räknaren fri från kugghjulet. Omstart flyttade in i den menyn, där den redan erbjöds, och fullskärmsknappen som
satt bredvid är borttagen — hörnet visas bara på pekskärmar, och där hade den inget att
göra. Installerad finns ingen webbläsarram kvar att gömma; på iPhone finns inte
Fullscreen API alls; och där det fungerar finns växeln kvar i menyfoten.

Pausrutan är därmed fem rader: *Fortsätt*, *Börja om*, *Byt fordon*, *Banor* och
*Avsluta appen*. **Byt fordon** finns där för att man ibland bara råkat starta på fel
maskin, och då ska man inte behöva ut till banlistan och tillbaka. Den öppnar samma
väljare som bankorten gör, så varje maskin kommer med sitt eget rekord på just den
banan, och ikonen är den maskin man *inte* sitter på — en motorcykel på raden medan man
kör motorcykel läses som "gå till motorcykeln". Att välja startar om banan, även om man
väljer den man redan kör: man byter inte maskin halvvägs ner för en backe, och en rad
som ibland startar om och ibland inte är värre än en som alltid gör det. *Tillbaka* i
väljaren går tillbaka till pausrutan och inte ut i ett tyst pausat spel utan något att
trycka på. Raden göms när man testkör en bana från editorn: det loppet är editorns eget
`Level`, det har ingen rad i banlistan och inget fordon valdes någonsin för det.

**Avsluta** står på två ställen — i menyfoten och som sista raden i pausrutan, så man
inte behöver ta sig ut ur ett lopp först för att komma åt den — men bara i en
installerad app: i en webbläsarflik sitter stängknappen redan tre centimeter upp. I
pausrutan heter den *Avsluta appen* och ligger längst ned, längst från *Fortsätt*:
raden ovanför lämnar redan banan, så ordet ensamt hade varit två olika utgångar bredvid
varandra, och det är den enda raden där som inte går att ångra. Om sidan får stänga sig själv är den andra
halvan, och den går inte att känna av i förväg — `window.close()` finns överallt och
gör tyst ingenting där den inte är tillåten. Så knappen erbjuds en gång, och första
trycket avgör saken: går vi inte sönder i samma bildruta var svaret nej, och då
sparas det (`settings.canQuit`), knappen tas bort i stället för att stå kvar och ljuga,
och en rad säger det enda som återstår att säga — hur man stänger appen för hand.
Det är troligen det som händer på iPhone; iOS ger en hemskärmsapp ingen väg ut.

Spelet körs **alltid liggande**, alltid åt samma håll. Rapporterar enheten porträtt
vänder vi spelet i stället för att be spelaren vända telefonen: allt ligger i `#stage`,
som får ett kvarts varv medurs. Det är det enda som fungerar när rotationslåset är
påslaget, och är det avslaget blir vyn liggande av sig själv när telefonen vänds,
klassen faller bort och scenen rätar upp sig. Båda vägarna slutar med spelet rättvänt.

Tre fällor som följer med ett vridet `#stage`, alla lagade:

- `vw` och `vh` betyder fortfarande den riktiga vyn inne i en vriden scen, så de som
  spelar roll byts för hand sist i stilmallen, där de vinner på ordning.
- Mediefrågor på `max-height` frågar också fel axel, så reglerna för låga skärmar
  hänger numera på klassen `body.short` som JS sätter utifrån scenens verkliga höjd.
- `env(safe-area-inset-*)` rapporteras mot **vyn**, inte mot scenen, så en vriden scen
  möter hålslaget på en helt annan kant. Fyra variabler i `:root` säger hur långt in
  från *scenens* egna kanter som är säkert, och allt som måste hålla sig undan använder
  dem i stället för `env()` direkt. Härledningen står i stilmallen. Får man den om
  bakfoten hamnar en knapp under kameran — vilket den gjorde: "← Världar" låg bakom
  hålslaget, och pekknapparnas egen regel hade två av fyra kanter förväxlade.

**Vinkeln är ett förslag, inte ett besked.** Installerad räknar spelet ut varvet genom
att ångra systemets egen rotation (`90 − screen.orientation.angle`), och det är den
siffran som gör att bilden står stilla på glaset. Problemet är att iOS lämnar den i
delbetalningar: en `resize` kan komma innan vinkeln hunnit med, eller efter, och ett
varv räknat på den inaktuella av de två lämnar spelet stående upprätt utan att någon
ny händelse kommer och rättar det. Det var buggen "den går fortfarande i porträtt
ibland", och att lita hårdare på vinkeln kan inte laga den, eftersom det är vinkeln
som är fel.

Så vinkeln kollas mot en regel: **scenen är liggande, alltid**. Det stämmer i varenda
korrekt fall — i ett kvarts varv är scenen så bred som vyn är hög, annars är den vyn —
så ett förslag som kommer ut porträtt kom från en inaktuell avläsning, och ett kvarts
varv till är svaret. Det kostar två tal och kräver inget aktuellt utom vyn själv.
Ovanpå det körs layouten om en gång till på nästa bildruta efter `orientationchange`
och en gång 350 ms senare, eftersom det ibland är *vyn* som är den inaktuella; båda
passen är idempotenta.

Uträkningen bor i `js/stage.js` som en ren funktion av fyra tal, och det är med flit:
buggen går inte att återskapa vid ett skrivbord, så `test/stage.test.js` går i stället
igenom varje orientering på båda vägarna in och varje sätt de två avläsningarna kan
säga emot varandra, och kräver att scenen blir liggande i allihop. Samma aritmetik står
en gång till, för hand, i den inline-skrivna skripten överst i `index.html` — den måste
vara ett klassiskt skript som hinner före första målningen och kan därför inte
importera. Ändra dem tillsammans.

Baneditorn är undantaget: den mappar pekarkoordinater rakt på en ovriden canvas, så där
står porträttspärren kvar.

`#stage` är transformerat även upprätt, med flit. Det gör scenen till containing block
för varje `position: fixed` inuti, så de mäter mot scenen i stället för mot layoutvyn —
och scenens höjd är `100svh`, vyn minus webbläsarens egna fält. Utan det hamnade
pedalerna under Safaris nedre list och gick inte att nå.

Kameran zoomar efter skärmen så en telefon ser ungefär lika mycket bana som en dator,
och styrkorset spårar fingrarna globalt så att man kan glida mellan pedalerna och hålla
två knappar samtidigt.

**Bromspedalen** rör sig med cykeln. `updatePedalFeel` i `js/main.js` läser framhjulets
`angularVelocity` varje bildruta och sätter `--tread` på `#touch`, som flyttar mönstret
på bromsen i hjulets takt. Ingen förinspelad animation — rullar hjulet rullar mönstret,
och det saktar in märkbart när bromsen tar. Inte till fullt stopp: bromsen håller
hjulet mot ramen, inte mot marken, så en ram som nickar bär hjulet med sig.

Vilket hjul som är framhjulet byts varje gång cykeln vänds. Det är **det släpande**
hjulet som drivs (se gaspådraget i `forces.js`), så med `flipped` — standardläget, cykeln
kör åt höger — driver vänster hjul och höger är fram.

Gaspedalen är med flit stillastående. Den är en knapp man trycker på, inte en mätare.
Siffrorna är mätta, inte gissade: ett hjul ligger kring 6 rad/s på plant underlag och
når trettiotalet utför eller fritt i luften, så mönstret kapas före det för att inte
stroboskopera.

Nedtryckt sjunker pedalen in i sin egen ram: kanten står kvar där den var — det är
pedalens kant, och kanter flyttar sig inte — medan ytan glider ner några pixlar och
överkanten går i skugga. Ytan får 70 ms att färdas; inmatningen väntar inte på den.

`tools/mobile-preview.html` visar spelet i en telefonstor iframe med riktiga
viewport-mått, för att slippa gissa hur det ser ut.

### Fullskärm

Första gången du startar en bana kommer frågan en gång. Svaret sparas, och kan ändras
med ⛶ uppe i hörnet, växeln i menyn eller `F`.

Det är medvetet frivilligt. **Safari på iPhone stödjer inte Fullscreen API för vanliga
element** (iPad gör det sedan iPadOS 16.4), så ett krav hade låst ute en stor del av
mobilanvändarna. Varje anrop i `js/screenmode.js` är därför best effort: be om det, och
fortsätt oavsett svar.

Modulen heter `screenmode.js` och laddas dynamiskt bakom en tom reservimplementation.
En fil som heter `fullscreen.js` blockerades rakt av av en innehållsblockerare under
test, och eftersom den importerades statiskt tog den ner hela spelet. Nu kostar en
blockerad begäran funktionen, inte spelet.

Där det fungerar följer `screen.orientation.lock('landscape')` med — det går bara i
fullskärm, och där det lyckas behöver porträttspärren aldrig visas.

För iPhone är rätt väg **Lägg till på hemskärmen**: `manifest.webmanifest` plus
`apple-mobile-web-app-capable` gör att spelet startar utan adressfält.

Första gången spelet öppnas på en pekskärm får man därför välja själv, i en ruta
framför menyn: *Lägg till på hemskärmen* eller *Spela i webbläsaren*. Valet sparas i
`settings.launch` och frågan kommer aldrig igen. Den som valde webben hittar knappen
igen uppe i menyhuvudet, bredvid titeln — i foten låg den under tjugo banors scrollning,
vilket på en telefon är detsamma som att inte finnas. På dator visas ingenting av
detta — där gör fullskärmsknappen
redan samma nytta.

`js/homescreen.js` håller ihop installationen och laddas dynamiskt bakom en
reservimplementation, precis som `screenmode.js`. Det finns ingen gemensam metod:
Chrome ger oss `beforeinstallprompt` och därmed en riktig installationsdialog, medan
Safari på iPhone inte har något API alls och bara kan beskrivas i ord. Modulen svarar
på två frågor — går det att fråga rakt av, och om inte, vad ska spelaren få läsa.
Instruktionerna finns som fyra färdiga listor i `index.html`, en per plattform.

På iPhone i **någon annan webbläsare än Safari** går det inte alls: bara Safari kan
lägga till på hemskärmen. Där visas en *Kopiera adressen*-knapp, så man kan klistra in
den i Safari.

Det satt en *Öppna i Safari*-knapp där ett tag som skickade sidan vidare med
`x-safari-`-prefixet. **Den fungerar inte** — Chrome på iPhone svarar med "något gick
fel, det gick inte att öppna appen", vilket är sämre än ingen knapp alls. Det finns
inget sätt för en sida att öppna en annan webbläsare, så det ärligaste är att lägga
adressen på urklipp och säga var den ska klistras in. Försök inte igen.

`navigator.clipboard` kräver en säker kontext, vilket LAN-dev-servern inte är, så det
finns en textarea-reserv under. Misslyckas båda säger toasten i stället var adressen
står att kopiera för hand.

**`play/`** är webbens egen adress: <https://mikaelquick.github.io/bear/play/>.
Sidan är bara en vidarebefordran till `../?web`, och `?web` får spelet att hoppa över
frågan. Den som aldrig tänker installera något kan bokmärka och dela den länken i
stället för roten.

Ikonerna genereras av `tools/make-icons.py`, som skriver PNG-bytes direkt med `zlib`
så att det inte behövs något bildbibliotek och ingen binär behöver handredigeras.

**Ljudet är avstängt som standard** tills vi har riktiga ljud. Syntkoden finns kvar
bakom `M` och växeln i menyn.



## Fordon

Man trycker på banan och får då en egen ruta: ett fordon per rad, var och en med sitt
eget rekord på just den banan, så valet görs med det som spelar roll framför sig. Det
satt ett tag som små knappar direkt på bankortet och var för pilligt att träffa. Valet
följer med till nästa bana och överlever omstart, så `R` sätter en aldrig tyst på en
annan maskin.

`js/vehicles.js` beskriver maskinerna. Motorn bär en **spec** — den handfull siffror som
skiljer fordon åt — i stället för att läsa dem som modulkonstanter. Motorcykelns spec
*är* de portade konstanterna: `constants.js` säger fortfarande att de inte är rattar att
skruva på, och det gäller. Varje annat fordon är en öppen avvikelse, skriven på ett
ställe i stället för utspridd i `forces.js`.

Ett fordon är bara värt att ha om det är bättre på något. En maskin som bara är
långsammare är aldrig rätt svar på någon bana, så varje fordon byter bort något:

| | Motorcykeln 🏍️ | Cykeln 🚲 |
|---|---|---|
| Dragkraft | 600 | 420 |
| Topp (hjulvarv × radie) | 110 × 0,4 | 98 × 0,36 |
| Vikt | 200 | 120 |
| Hjulbas | 1,7 | 1,3 |
| Volt | 12 | 15 |

Cykeln ger alltså upp fart och drag mot lätthet, kort hjulbas och snabbare volt — den
att ta in i ett trångt schakt, och fel val på en lång öppen sträcka.

Och cykeln har **ekerhjul**. Motorcykelns hjul är en fylld skiva med fem grova ekrar;
cykelns är mest luft — tunt däck, blank fälg, tolv tunna ekrar snedställda mot navet och
banan som syns igenom. Det var det som fattades: med skivhjul läste cykeln som en liten
motorcykel, och silhuetten är det enda man hinner se i fart. Samma flagga styr hjulet
som styr benen (`spec.pedals`), för det är samma sak man vet om maskinen.

Björnen **trampar** på cykeln: ett ben på var sida, upp och ner i motfas, det bortre
mörkare så de två inte smälter ihop till en form. Ingen vev ritas — i den här skalan
lästes vevarmen som en lös stötta i stället för som något fötterna vred runt, och två
pumpande ben säger "trampar" på egen hand. Takten kommer från det hjul som faktiskt
driver, nedväxlat, för en vev snurrar långt långsammare än hjulet den driver och i
hjulfart hade benen bara varit en suddighet. Han trampar alltså i den takt han kör och
frihjular när han slutar.

Takten **ackumuleras**, den läses inte av hjulets `rotation`. Fysiken slår om den till
[-π, π] (`forces.js:99`), så ett uttryck byggt rakt på den hoppar en sjundedels varv
varje gång hjulet rullar förbi skarven — mätt till 1,35 radianer i ett enda
bildrutesteg, sex gånger på tre sekunder. Det var "blinkandet". Genom att i stället
summera den kortaste vägens delta blir skarven osynlig: största steg 0,18 radianer och
noll hopp. Föraren, ghosten, reprisen och demon räknar var sin takt, annars slåss de om
samma räknare. `GEAR` i `drawBear` är siffran att ändra om trampandet ska vara lugnare
eller ivrigare. På motorcykeln vilar benet på en fotpinne som förut.

**`test/levels.test.js` bevisar varje bana på varje fordon**, fyrtiofyra körningar på
knappt fem sekunder. Den provar sex frön och tar en målgång som bevis. Fröen är en fast
lista och sökningen är seedad hela vägen ner, så testet är **deterministiskt** — det
slumpar inte fram ett fel ibland, det säger samma sak varje gång. Vad fröen köper är
marginal. Drivrutinen är trubbig, och på de vassaste banorna klarar den bara två eller
tre frön av åtta; med en kort lista kan en dag en bana som bara är svår råka se omöjlig
ut för att just de fröen hade otur. Sex kostar ingenting på en bana som går igenom —
sökningen slutar vid första frö som når mål — och bara de verkligt marginella betalar
för resten.

**Rekord och repriser ligger per bana och fordon.** En tid går bara att jämföra med
tider satta på samma maskin. Motorcykeln behåller det nakna bannamnet som nyckel, så
varje rekord satt innan fordon fanns ligger kvar precis där spelet letar — ingen
migrering, inget förlorat. Och en repris sparar *inmatning*, inte positioner, så den
återskapar bara loppet på den maskin den kördes på: reprisen bär därför ett
`vehicle`-fält, och saknas det var det en motorcykel.

Kortet visar vilka fordon banan är klarad med som emoji, och tiden för det fordon man
just nu skulle åka iväg på — det är den man ska slå.

## Banväljaren

Knapparna är avsiktligt tecknade. Tre saker gör det, och alla tre bor i `:root`:
en **inkad kontur** (`--ink`), en hörnradie långt större än ett dokument skulle använda,
och en solid **läpp** (`--lip`) under knappen som den sjunker ner på när man trycker.
Inget av det är någon enskild studios formspråk — det är hur en ritad knapp har sett ut
så länge ritade knappar funnits.

En svart kontur syns inte mot en nästan svart panel, så knappytorna är ljusare än de
var (`--btn-top`/`--btn-bot`). Det är det som köper det tecknade intrycket. Typsnittet
ber om `ui-rounded` först, vilket är San Francisco Rounded på Apple-enheter och kostar
ingenting att fråga efter; överallt annars faller det rakt igenom till systemsnittet.

**Ghost är avstängd tills någon ber om den.** En genomskinlig andra björn som kör
bredvid är förvirrande om man inte letade efter den, och den som vill ha den vet var
knappen sitter. Bara standardvärdet ändrades; den som redan slagit på den behåller den.

Pekkontrollerna får samma behandling men tvärtom: ljus kant **inuti** och en mörk ring
**utanför**, eftersom en ensam linje försvinner mot antingen himlen eller berget,
medan paret aldrig gör det. Volt och vänd sjunker ner på sin läpp; pedalerna behåller
sitt eget tryck, där ytan sjunker inuti ramen — en pedal gångjärnar, en vred trycks in,
och de två ska inte låtsas vara samma föremål.

Menyn har två flikar, **🗺️ Banor** och **✏️ Egna banor**, som stora mjuka knappar med
emojin ovanför texten — den som inte läser orden ska ändå hitta rätt. *Så spelar du* och
*Om fysiken* låg förut som två flikar till; de ligger nu som små länkar i menyfoten, där
en förälder tittar och ett barn inte gör det. Hjälpen mötte ett tag varje ny spelare vid
start — den gör den inte längre. Det här är ett spel för barn, och de listar ut det
genom att trycka på saker, vilket är roligare än att få det berättat för sig.

Först väljer man **värld**, sedan bana. Världarna står i `js/biomes.js`: **Skogen 🌲**
med tjugo banor och **Snön ❄️** med två. Snön var ett tag en låst, tom hylla — en tom
hylla säger mer än ingen hylla alls — och är nu öppen.

Ett världskort är emoji, namn och hur långt man kommit — inget annat. En rad
stämningstext är en mening ett barn måste ta sig förbi innan det får trycka, och bilden
säger redan det meningen skulle sagt. En låst värld visar ett hänglås i stället för
ordet för ett, av samma skäl.

En bana talar om vilken värld den hör till med ett `biome`-fält. Utelämnas det blir det
den första, vilket är varför de tjugo banor som skrevs innan världar fanns inte behövde
ändras alls.

**Numren på korten räknas per värld.** Den första snöbanan heter 1, inte 21 — listan
visar en värld i taget, så det är i den listan siffran ska betyda något. Framstegsraden
under banorna räknar av samma skäl den öppna världen och inte hela spelet; på
världsväljaren, där ingen värld är öppen, räknar den allihop.

**Varje värld målas i sina egna färger.** `THEMES` i `js/render.js` är skogens palett med
ett par nycklar utbytta, så en värld kostar fem rader och inte en fil. Bara kulissen
byts — björnen, maskinen och kuporna ser likadana ut överallt, så man aldrig behöver
lära om vad någonting är. I snön är himlen kallare, berget blekt i stället för brunt,
och grässtrået på marken blir en driva: fet, vit linje utan grästuvor, eftersom vita
grässtrån är precis vad snö inte får se ut som. Banbilderna i väljaren läser samma
palett, så man ser vilken värld en ruta hör till innan man läst namnet.

**Och marken måste stämma med vad som yr upp ur den.** Snön såg ut som snö men hjulen
kastade fortfarande upp brun grus, så att gasa på snö gav sand. Partiklarna bestäms i
`effects.js` och färgerna i `render.js`, och ingenting band ihop de två — att lägga till
en värld betydde att komma ihåg båda. Nu står sprutet i paletten (`spray`: färg,
tyngd och livslängd) och `effects.setBiome` hämtar det där renderaren hämtar sitt. Snö
är inte bara ljusare utan också lättare: en tredjedel av tyngden och halvannan gång
livslängden, så pudret driver efter hjulet i stället för att falla som grus. Kupor,
getingar och gravitationsvändningen ser likadana ut överallt — de är föremål, inte mark.

`test/worlds.test.js` ser till att regeln hålls i stället för att behöva kommas ihåg:
varje värld i `BIOMES` måste lösa ut till en palett med varenda nyckel renderaren och
partiklarna slår upp, en öppen värld måste ha banor i sig, och snön får inte dela sprut
med skogen.

`← Världar` tar en ut igen. Och **var man var sparas per värld**: panelen är det som
scrollar, så det är dess `scrollTop` vi minns, i `settings.biomeScroll`. Den som kört
fast på bana 17 ska inte behöva leta rätt på den igen — varken efter ett lopp, efter en
tur ut till världarna, eller efter att ha stängt sidan. Senast öppnade värld ligger i
`settings.biome` och öppnas igen av sig själv.

Banorna visas som kort med en ritad bild av banan, inte som en lista med namn. En bild
av grottan säger vilken bana det är innan man läst någonting, vilket spelar störst roll
för den som ännu inte läser namnen. Klarade banor bär det tydligt: guldgrön kant och en
bock, läsbara tvärs över ett rum.

`js/thumbnail.js` ritar bilderna. Det är ingen nedkrympt skärmdump — spelrenderaren bär
på kamera, cykel och parallaxhimmel, och inget av det hör hemma i en 200 px stor ruta.
Den ritar det en bild måste säga: grottans form, och var kuporna, getingarna och krukan
sitter. Banor är hål urgröpta ur berg, så fyllningen använder samma knep som renderaren:
måla hela rutan och dra bort polygonerna med even-odd.

Två saker att veta om den: den läser **rådata**, inte ett laddat `Level`, eftersom ett
`Level` bygger ett kollisionsrutnät och väljaren inte har någon nytta av tjugo sådana
varje gång den ritas om. Och den återanvänder en enda canvas och sparar resultatet som
data-URL:er — tjugo levande canvaselement är megabyte av bildminne för bilder som aldrig
ändras. Inbyggda banor ritas en gång per sidladdning, egna banor varje gång, eftersom
editorn kan ha ändrat dem.

## Svårighetskurvan

De fyra första banorna är lektionen, och de har inget att dö i. Bana 3 hette "Hoppet"
och hade en nio meter djup grop med getingar i; nu är den en ramp, en kant och en kupa
hängd i luften över landningen. Man lär sig att ramper kastar en utan att betala för
det. Gropen med något under finns kvar — den har bara flyttat till efter att man mött
en ofarlig variant först.

Därifrån stramas det åt hela vägen. `difficulty` på varje bana är prickarna på kortet
och går 1–10:

| Banor | Prickar | Vad som ändras |
|---|---|---|
| 1–2 | ● | plan mark, inget att dö i |
| 3–4 | ●● | första hoppet, första låga taket |
| 5–6 | ●●●–●●●● | metertrappsteg och skålar som kräver fart för att ta sig ur |
| 7–9 | ●●●●● | svärmarna ner till en meter över en ren linje, fallen längre |
| 10–12 | ●●●●●● | längre gap, lägre balkar |
| 13–15 | ●●●●●●● | fler svärmar, brantare klyfta, högre trösklar i taket |
| 16–18 | ●●●●●●●● | trängre passage, sex meter mellan avsatserna, kortare ramper |
| 19–20 | ●●●●●●●●●–● | allt på en gång, med vändning |

Det mätbara i det: hur ofta den skriptade föraren tar sig i mål. På åtta frön per bana
och fordon klarar den varenda av de sex första banorna 8/8, medan 10, 18 och 19 på
cykeln ligger på 2/8. Det är inte ett mått på svårighet för en människa, men det är ett
mått på att kurvan går åt rätt håll — och det gick att mäta före och efter.

Två saker satte taket. **Bikupan** provades med fem meter mellan avsatserna och blev då
oklarbar: föraren fick en kupa av sex. Det är skillnad på en svår bana och ett stup, och
den gränsen går där. **Takridaren** fick fyra trösklar i taket på 0,8 m och tappade
cykeln; tre på 0,6 m, utspridda tolv meter i stället för tio, går i stället bättre än
originalet gjorde. Uppför och ner i taket är det inlopet till en tröskel som är jobbet,
inte tröskeln.

## Snön

Två banor hittills, och is: `grip` i bandatan, beskriven under [Fysiken](#fysiken).
**1. Första halkan** ligger på 0.55 och är en rink — inga getingar, ingen grop, bara en
lång slät bana och en sista backe som är för brant att ta från stillastående, så hela
rinken före är ansatsen. Det är världens lektion i en form: behåll det du har.
**2. Isgrottan** ligger på 0.42 och har allt det kostar — skål, lågt tak med svärmar
över, en grop med ramp till, en backe som kräver fart, och en istagg över inloppet till
krukan där det enda som går under är en platt linje.

Namnen börjar om på 1 i varje värld. Rekordnyckeln är bannamnet, och "1. Första halkan"
är en annan sträng än "1. Första steget", så numren får upprepas utan att krocka.

## Repriser och ghosts

Ditt bästa lopp per bana spelas in. Nästa gång du kör banan visas det som en blek,
genomskinlig björn att jaga, och HUD:en säger hur många meter före eller efter honom du
ligger. `▶` i banlistan spelar upp rekordet.

En inspelning sparar **inmatning**, inte positioner: ett par `(bildrutans längd,
knappar)` per renderad bildruta, cirka 5 byte. En minut blir runt 20 kB. Uppspelning
kör samma simulering igen — både spelet och reprisen går genom `advanceFrame` i
`js/sim.js`, så det finns bara en kodväg.

Det bygger på att flyttalen beter sig likadant. Inom samma webbläsare är det exakt.
Mellan olika motorer är `sin`/`cos`/`atan2` inte garanterat bitidentiska, så en
inspelning gjord någon annanstans kan driva isär. Inget går sönder om den gör det —
ghosten följer bara en lite annan linje. Inspelningen kastas automatiskt om banan den
hör till har ändrats.

## Fysiken

Portad från [elmadev/elma-classic](https://github.com/elmadev/elma-classic)
(`src/physics/`). Konstanterna är originalets, oförändrade:

| | |
|---|---|
| Gravitation | 10 m/s² |
| Fjäderstyvhet / dämpning | 10000 N/m / 1000 N/(m/s) |
| Ram | massa 200, tröghetsmoment 200·0.55² |
| Hjul | massa 10, radie 0.4, tröghetsmoment 0.32 |
| Hjulens läge | ±0.85 i sidled, 0.6 under ramen |
| Huvud | radie 0.238, 0.63 över kroppen |
| Gas | moment 600, max hjulvarvtal 110 rad/s |
| Broms | vinkelfjäder 1000 / 100 mot rotationen vid bromstryck |
| Volt | ±12 rad/s, återtas efter 0.1 s; motvoltsbonus 3 |
| Max tidssteg | 0.0055 simenheter (≈79 Hz) |

Tre detaljer som är medvetet bevarade, eftersom de *är* känslan i spelet:

**Hjulkollision mot upp till två ankarpunkter.** Noll punkter ger vanlig integration. En
punkt gör att hjulet *rullar* runt punkten med parallellaxelteoremet. Två punkter låser
hjulet helt — därför kan man fastna i hörn.

**Volten är trasig med flit.** Du får 12 rad/s gratis och får tillbaka det en tiondel
senare, men bara ner till farten du hade innan. Hinner du växla rotationen till linjär
fart får du behålla den. Hela rekordjakten i originalet bygger på den buggen.

**Gasen går genom en "växel"** vars radie är fjäderns aktuella längd. En hoptryckt fjäder
kräver enorm kraft för samma moment, vilket är ursprunget till bug bounces.

**Is är den enda kroken fysiken har för ett underlag**, och den är med flit den minsta
som går. En bana kan sätta `grip` under 1, och då får varken motorn eller bromsen be ett
hjul om mer moment än `grip × dragkraft`. Det är ett *tak*, inte en skalning: bromsen är
en vinkelfjäder här, så halverar man dess styrka vrider den sig bara dubbelt så långt och
stannar en precis lika bra. Ett tak är vad som gör en broms som inte håller. Mätt på plan
mark, motorcykeln: 0→8 m/s tar 1,31 s med fullt grepp och 2,96 s på `grip` 0.42, och
efter en halv sekunds broms från 8 m/s är man nere på 3,50 m/s respektive 5,19 m/s. Man
tar alltså upp farten långsamt och — det som faktiskt är världens karaktär — får inte av
den igen.

Bara ett hjul som står på marken halkar; i luften finns inget att greppa, så bromsen
låser hjulen för en volt precis som förut. Och `grip` 1 hoppar över grenen helt, vilket
är varenda skogsbana och varenda fysiktest, så den portade känslan är orörd där den
betyder något.

Simuleringen kör i sin egen tidsenhet: en verklig millisekund är 0.0004368 simenheter.
Den visade klockan räknar tillbaka, så den visar riktiga hundradelar.

En sak som förvirrar om man läser originalkoden: i dess fysikrymd kör den *ovända*
cykeln mot **−x**. Våra banor går vänster→höger, så björnen startar i det speglade
läget (`flipped = true`) istället för att vi vänder tecken på konstanterna.

## Projektstruktur

```
index.html
css/style.css
tools/dev-server.py      statisk server utan cachning
tools/mobile-preview.html  spelet i en telefonstor iframe
tools/make-icons.py        genererar app-ikonerna utan bildbibliotek
manifest.webmanifest       Lägg till på hemskärmen
play/index.html            webbens egen adress, vidarebefordrar till ../?web
icons/                     genererade app-ikoner
js/
  constants.js   fysikkonstanter, portade oförändrade
  vec2.js        vektorhjälp
  collision.js   cirkel mot linjesegment, ankarpunkter
  move.js        integration, rullning, kroppens fjäder
  forces.js      cykelns kraftmodell, volt, objektkollisioner
  sim.js         en bildrutas simulering: (tid, knappar) in, tillstånd ut
  replay.js      inspelning, kodning, ghost
  thumbnail.js   ritar banbilderna till väljaren
  biomes.js      världarna och vilken bana som hör till vilken
  vehicles.js    fordonen; motorcykelns spec är de portade konstanterna
  level.js       polygoner, segment, kollisionsrutnät
  levels.js      de tjugotvå inbyggda banorna
  render.js      Canvas 2D: terräng, parallax, björn, objekt, ghost
  effects.js     partiklar och skärmskak
  audio.js       WebAudio-syntade ljud, inga filer (avstängt som standard)
  driver.js      skriptad förare (demo i menyn + tester)
  demo.js        attract-läget bakom menyn
  touchpad.js    styrkorset: global fingerspårning för skärmknapparna
  stage.js       åt vilket håll scenen vrids — ren funktion, testbar utan telefon
  screenmode.js  fullskärm och orienteringslås (döpt så för att inte blockeras)
  homescreen.js  installation: installationsdialog där den finns, annars ord
  editor.js      baneditor
  game.js        speltillstånd
  main.js        meny, lägen, inmatning, touch, huvudloop
test/
  physics.test.js   fysikporten
  stage.test.js     scenen hamnar liggande hur avläsningarna än ljuger
  worlds.test.js    varje värld är helt målad, ned till vad hjulen yr upp
  replay.test.js    inspelning, kodning, ghost
  autopilot.js      sökning med checkpoints och backtracking
  levels.test.js    varje bana måste gå att klara
```

## Baneditor

Öppnas från menyn. Banor sparas i `localStorage` och kan exporteras/importeras som JSON.

- **Polygon** — klicka för hörn, `Enter` stänger, `Esc` avbryter
- **Redigera** — dra hörn, klicka på en kant för att lägga till ett hörn, `Delete` tar bort
- **Start / Bikupa / Getingar / Honung** — klicka för att placera
- `Alt`+klick på en bikupa cyklar gravitationsriktning (upp/ner/vänster/höger)
- `Shift`+dra panorerar, scroll zoomar, `1`–`6` byter verktyg, `T` testkör

Banformat:

```json
{
  "name": "Min bana",
  "difficulty": 3,
  "polygons": [{ "grass": false, "points": [[0, 0], [40, 0], [40, 16], [0, 16]] }],
  "objects": [
    { "type": "start",  "x": 4,  "y": 1.1 },
    { "type": "apple",  "x": 20, "y": 0.6, "gravity": 0 },
    { "type": "killer", "x": 25, "y": 3.4 },
    { "type": "exit",   "x": 36, "y": 0.6 }
  ]
}
```

Koordinater är meter med **+y uppåt**. Polygoner fylls med even-odd: insidan av den yttre
polygonen är luft, och polygoner inuti den blir solid mark igen. `grass: true` gör
polygonen till ren dekoration utan kollision.

### Designregler som banorna följer

Alla kommer från banor som testföraren avslöjade som orättvisa eller omöjliga:

- Minst 3 m fri höjd där man ska kunna passera (cykeln är ca 2,4 m hög)
- Inga flytande hinder som lämnar en glipa mellan 0,9 och 3 m
- Backar brantare än ca 27° går inte att köra upp med rimlig ansats
- Lodräta steg högre än ca 0,6 m stoppar cykeln — fasa av dem
- Getingsvärmar på marken utan ramp före är omöjliga att passera
- Hängande svärmar behöver ca 1,2 m fri höjd över huvudet (huvudets topp ligger ca 2,4 m över marken)
- Räknat i mitten: huvudet sitter ca 2,1 m över marken man står på och svärmen når ca
  0,65 m, så en svärm under 2,75 m träffar en som kör alldeles rakt. 3,1 m är en meters
  marginal — platt linje går igenom, minsta vurpa gör det inte. Mät från marken **under**
  svärmen, inte från nollplanet: samma svärm över en ramp står en meter lägre
- En ramp uppåt måste peka åt det håll du redan kör, annars kör du in i dess undersida
- Fall på mer än ca 4 m ner på en kort avsats är en slantsingling, inte en landning
- Gravitationsvändning **upp** fungerar; att vända tillbaka ner mitt i luften är
  betydligt svårare än vändningen i sig — avsluta hellre sektionen i taket
- Lämna utrymme efter mål och ramper, annars åker man in i väggen

## Tester

`npm test` kör fem sviter:

**`physics.test.js`** — att cykeln vilar stilla på marken, att gasen driver åt rätt håll,
att volten ger och tar tillbaka rotation, att kupor/getingar/mål utlöser rätt, och att
tidsomräkningen stämmer.

**`stage.test.js`** — att scenen alltid hamnar liggande. Den finns för att buggen den
täcker inte går att återskapa här: den händer på en telefon, mitt i en vridning, när
iOS rapporterar en vinkel som inte stämmer med vyn den redan ändrat. Så beslutet är
utbrutet ur DOM:en till `js/stage.js`, och testet går igenom aritmetiken uttömmande —
båda vägarna in, alla fyra vinklar, och varje sätt de två avläsningarna kan säga emot
varandra.

**`worlds.test.js`** — att varje värld är helt målad: hela paletten, ett eget sprut
under hjulen, inga öppna men tomma världar, och en okänd värld som faller tillbaka i
stället för att krascha. Den finns för att snön en gång yrde upp sand.

**`replay.test.js`** — att kodningen är förlustfri, att samma inmatning ger exakt samma
lopp, att ghosten interpolerar rätt och slutar i tid, och att en inspelning avvisas när
banan ändrats.

**`levels.test.js`** — en skriptad förare försöker klara varje bana. Den checkpointar vid
varje upplockad kupa och backtrackar när den kör fast, så en lång bana blir en serie
korta problem. Klarar föraren banan gör en människa det garanterat. Testet har hittat
flera verkliga fel under bygget: flytande hinder man inte kunde ta sig förbi, 1,6 m höga
trappsteg, ramper som blockerade hyllan under sig, en getingsvärm inbäddad i en pelare,
och mål för nära väggen. Under åtstramningen av kurvan fångade det en svärm hängd så
lågt att en helt rak linje gick in i den, en kupa hamnad inuti en tröskel i taket, en
istagg över en ramp där marken står en meter högre och glipan därmed försvann, och en
skål brantare än något fordon tar sig upp ur.

## Vad som inte finns än

- Stöd för originalets binära `.lev`-filer
- Gravitation i sidled (`left`/`right` finns i formatet men ingen bana använder det,
  och testföraren hanterar det inte)
- Ljud värda namnet
