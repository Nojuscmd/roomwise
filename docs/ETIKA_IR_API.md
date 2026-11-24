# Ataskaitos tekstai: DI paslaugos pagrindimas ir etika

Paruošti tekstai ataskaitai. Skliausteliuose `[...]` pažymėtą vietą patikrink pats.

## A. Uždaro DI API naudojimo pagrindimas (V, VI ir VIII skyriams)

**Kodėl naudojamas Anthropic Claude.** Roomwise turi išversti kambario nuotrauką į struktūrizuotus
duomenis (kambario matmenys, durys, langai, baldai). Tai reikalauja regos ir kalbos modelio. Atviras
modelis (pvz., kompiuterinės regos tinklas) tam reikalautų didelio anotuoto kambarių duomenų rinkinio ir
treniravimo, kurių projekto apimtyje nėra. Todėl nuotraukų „skaitymui" naudojamas Claude per Anthropic
Messages API. Kvietimas vyksta tik iš serverio funkcijos (Supabase Edge Function), o API raktas
niekada nepatenka į programą.

**Kas yra mūsų indėlis.** DI atlieka tik suvokimą (nuotrauka į JSON). Visa likusi sistema yra mūsų
pačių:

- griežta DI išvesties validacija (`src/domain/validate.ts`): rezultatas laikomas nepatikimu, kol
  nepatikrintas ir apribotas;
- taisyklių variklis (ergonomikos ir feng shui taisyklės, `src/domain/rules`);
- sprendiklis, kuris ieško geresnio išdėstymo ir rašo paaiškinimą kiekvienam perkėlimui
  (`src/domain/solver.ts`);
- grindų plano vizualizacija ir rankinio taisymo ekranas.

**Atsarginis (offline) variantas.** Atviro modelio, kuris pakeistų nuotraukų analizę, neturime ir to
neslepiame. Tačiau sistema neapsiriboja DI:

- kambarį ir baldus galima įvesti ir pataisyti **rankiniu būdu** (taisymo ekranas), o tada taisyklių
  variklis ir sprendiklis veikia visiškai be API ir be interneto;
- taisyklių variklis ir sprendiklis išbandyti **be jokio API** su 1000 sintetinių kambarių
  (`npm run evaluate`);
- DI atsakymas vėliau gali būti pakeistas bet kuriuo kitu šaltiniu, nes jis tik užpildo vieną JSON
  struktūrą.

**Apribojimai (VIII skyriui).** Nuotraukų analizė be DI paslaugos neveikia. Paslauga mokama, todėl
įdiegtas limitas: ne daugiau kaip 10 analizių vienam naudotojui per valandą.

## B. Etika, sauga ir privatumas (III skyriui)

**Kokie duomenys renkami.** Programa saugo naudotojo kambarių nuotraukas, kambarių matmenis, baldų
išdėstymą ir el. paštą (prisijungimui). Veidų ar asmens duomenų specialiai nerenkama, tačiau nuotraukoje
gali atsitiktinai matytis asmeniniai daiktai.

**Kaip duomenys saugomi.**

- Nuotraukos laikomos privačioje Supabase saugykloje (`room-photos`). Prieigos taisyklės leidžia
  skaityti, įkelti ir trinti tik savo aplanke (`<naudotojo_id>/...`). Leidžiami tik JPEG ir PNG, iki 8 MB.
- Lentelėse įjungtas eilučių lygio saugumas (Row Level Security): kiekviena taisyklė tikrina
  `user_id = auth.uid()`, todėl vienas naudotojas negali matyti kito duomenų.
- Tai patikrinta dviejų paskyrų testu (`supabase/tests/rls_check.sql`), 10 iš 10 patikrų sėkmingos
  (2026-10-05).
- DI raktas yra tik serverio paslaptis, o programoje yra tik viešas (anon) Supabase raktas.
- Nuotraukų dydis prieš įkėlimą sumažinamas (iki 1400 px pločio).

**Duomenų siuntimas trečiajai šaliai.** Analizės metu nuotraukos siunčiamos į Anthropic API. Naudotojai
apie tai turi būti informuoti prieš naudojimą. Testuotojai buvo informuoti raštu (žinute) prieš naudodami programą: jiems paaiškinta, kad nuotrauka siunčiama į DI paslaugą analizei ir saugoma privačiai.

**Testuotojai.** Programą išbandė 3 draugai savanoriškai. Naudoti tik jų pačių pasirinkti kambariai.
Jei ataskaitoje cituojami jų atsakymai, jie pateikiami nuasmeninti (be pavardžių). [Patikrink: ar draugai sutiko, kad jų atsakymai būtų cituojami? Jei ne, paklausk jų žinute prieš cituodamas.]

**Rizikos ir ribos.**

| Rizika                               | Kaip sumažinta                                      | Likęs trūkumas                         |
| ------------------------------------ | --------------------------------------------------- | -------------------------------------- |
| Kitas naudotojas pamato mano kambarį | RLS ir privati saugykla, testuota                   | Edge Function atskirai netestuota      |
| DI suklysta (neteisingi matmenys)    | Validacija ir ribojimas, ekranas rankiniam taisymui | Matmenys iš nuotraukos yra apytiksliai |
| Piktnaudžiavimas ir kaštai           | 10 analizių per valandą vienam naudotojui           | Nevaldomas daugelio paskyrų kūrimas    |
| Programa „valdo" realų daiktą        | Neįmanoma, programa tik pataria (informacinė)       | nėra                                   |
| Diskriminacija                       | Neanalizuojami žmonės, tik baldai                   | nėra                                   |

**Žinomi trūkumai (sąžiningai).**

- Registracija atvira, bet el. pašto patvirtinimas įjungtas (2026-11-25), todėl naujos paskyros turi
  patvirtinti adresą. Anthropic išlaidas riboja išankstinių mokėjimų kreditų likutis, o automatinis
  papildymas išjungtas.
- Paskyros ištrynimo ekrano nėra. Kambario trynimas pašalina jo nuotraukas ir išdėstymus, o visą paskyrą
  galima ištrinti tik Supabase skydelyje.
- Programa informacinė: ji nieko nevaldo ir pataria, o sprendimą visada priima žmogus.

## C. Sutikimo žinutė testuotojams (galima nusiųsti)

> Sveiki! Mes mokomės kolegijoje ir kuriame programą Roomwise (kambario išdėstymo patarimai pagal nuotrauką).
> Prašome išbandyti ir trumpai atsakyti. Nuotrauka bus išsiųsta į DI paslaugą (Anthropic) analizei ir
> saugoma privačiai. Nefotografuok žmonių ar dokumentų. Tavo atsakymus ataskaitoje cituosime be
> pavardės. Jei nenori, kad cituotume, parašyk. Ar sutinki?
