# Björn

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
Volt och vänd till vänster, broms och gas som pedaler till höger, kugghjul uppe i
hörnet för paus och meny. När du dött räcker ett tryck var som helst för att köra om.

Spelet kräver landskapsläge — i porträtt pausas det och en spärr ber dig vrida
telefonen. Kameran zoomar efter skärmen så en telefon ser ungefär lika mycket bana som
en dator, och styrkorset spårar fingrarna globalt så att man kan glida mellan pedalerna
och hålla två knappar samtidigt.

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
igen längst ner i menyn. På dator visas ingenting av detta — där gör fullskärmsknappen
redan samma nytta.

`js/homescreen.js` håller ihop installationen och laddas dynamiskt bakom en
reservimplementation, precis som `screenmode.js`. Det finns ingen gemensam metod:
Chrome ger oss `beforeinstallprompt` och därmed en riktig installationsdialog, medan
Safari på iPhone inte har något API alls och bara kan beskrivas i ord. Modulen svarar
på två frågor — går det att fråga rakt av, och om inte, vad ska spelaren få läsa.
Instruktionerna finns som fyra färdiga listor i `index.html`, en per plattform.

**`spela/`** är webbens egen adress: <https://mikaelquick.github.io/bear/spela/>.
Sidan är bara en vidarebefordran till `../?web`, och `?web` får spelet att hoppa över
frågan. Den som aldrig tänker installera något kan bokmärka och dela den länken i
stället för roten.

Ikonerna genereras av `tools/make-icons.py`, som skriver PNG-bytes direkt med `zlib`
så att det inte behövs något bildbibliotek och ingen binär behöver handredigeras.

**Ljudet är avstängt som standard** tills vi har riktiga ljud. Syntkoden finns kvar
bakom `M` och växeln i menyn.

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
spela/index.html           webbens egen adress, vidarebefordrar till ../?web
icons/                     genererade app-ikoner
js/
  constants.js   fysikkonstanter, portade oförändrade
  vec2.js        vektorhjälp
  collision.js   cirkel mot linjesegment, ankarpunkter
  move.js        integration, rullning, kroppens fjäder
  forces.js      cykelns kraftmodell, volt, objektkollisioner
  sim.js         en bildrutas simulering: (tid, knappar) in, tillstånd ut
  replay.js      inspelning, kodning, ghost
  level.js       polygoner, segment, kollisionsrutnät
  levels.js      de tjugo inbyggda banorna
  render.js      Canvas 2D: terräng, parallax, björn, objekt, ghost
  effects.js     partiklar och skärmskak
  audio.js       WebAudio-syntade ljud, inga filer (avstängt som standard)
  driver.js      skriptad förare (demo i menyn + tester)
  demo.js        attract-läget bakom menyn
  touchpad.js    styrkorset: global fingerspårning för skärmknapparna
  screenmode.js  fullskärm och orienteringslås (döpt så för att inte blockeras)
  homescreen.js  installation: installationsdialog där den finns, annars ord
  editor.js      baneditor
  game.js        speltillstånd
  main.js        meny, lägen, inmatning, touch, huvudloop
test/
  physics.test.js   fysikporten
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
- En ramp uppåt måste peka åt det håll du redan kör, annars kör du in i dess undersida
- Fall på mer än ca 4 m ner på en kort avsats är en slantsingling, inte en landning
- Gravitationsvändning **upp** fungerar; att vända tillbaka ner mitt i luften är
  betydligt svårare än vändningen i sig — avsluta hellre sektionen i taket
- Lämna utrymme efter mål och ramper, annars åker man in i väggen

## Tester

`npm test` kör tre sviter:

**`physics.test.js`** — att cykeln vilar stilla på marken, att gasen driver åt rätt håll,
att volten ger och tar tillbaka rotation, att kupor/getingar/mål utlöser rätt, och att
tidsomräkningen stämmer.

**`replay.test.js`** — att kodningen är förlustfri, att samma inmatning ger exakt samma
lopp, att ghosten interpolerar rätt och slutar i tid, och att en inspelning avvisas när
banan ändrats.

**`levels.test.js`** — en skriptad förare försöker klara varje bana. Den checkpointar vid
varje upplockad kupa och backtrackar när den kör fast, så en lång bana blir en serie
korta problem. Klarar föraren banan gör en människa det garanterat. Testet har hittat
flera verkliga fel under bygget: flytande hinder man inte kunde ta sig förbi, 1,6 m höga
trappsteg, ramper som blockerade hyllan under sig, en getingsvärm inbäddad i en pelare,
och mål för nära väggen.

## Vad som inte finns än

- Stöd för originalets binära `.lev`-filer
- Gravitation i sidled (`left`/`right` finns i formatet men ingen bana använder det,
  och testföraren hanterar det inte)
- Ljud värda namnet
