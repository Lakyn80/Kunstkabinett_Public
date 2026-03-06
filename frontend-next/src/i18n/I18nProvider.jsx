// src/i18n/I18nProvider.jsx
import { createContext, useContext, useEffect, useMemo, useState } from "react";

/**
 * Jednoduchý i18n bez dependencí.
 * - Slovníky jsou inline, ať neřešíme JSON importy ve Vite.
 * - Jazyk se pamatuje v localStorage a nastaví <html lang="..">.
 * - Funkce t('a.b', {x:1}) – podporuje parametrické nahrazování.
 */

// ---- Slovníky --------------------------------------------------------------
// Kompletní slovník překladů pro všechny jazyky
// Struktura: { section: { key: "text" } }
// Použití: t('section.key') nebo t('section.key', {param: value})

const cs = {
  brand: { name: "Kunstkabinett" },
  nav: { 
    home: "Domů", 
    discover: "Galerie", 
    artists: "Umělci", 
    blog: "Blog",
    about: "O nás",
    contact: "Kontakt",
    login: "Přihlásit",
    account: "Můj účet",
    logout: "Odhlásit",
    cart: "Košík"
  },
  footer: { terms: "Podmínky", privacy: "Soukromí", support: "Podpora", cookies: "ZÁSADY POUŽÍVÁNÍ COOKIES", cookieSettings: "Nastavení cookies" },
  cookies: {
    title: "Používání cookies",
    description: "Tento web používá cookies pro zajištění správné funkčnosti, analýzu návštěvnosti a personalizaci obsahu. Můžete si vybrat, které typy cookies chcete povolit.",
    necessary: {
      title: "Nezbytné (technické) cookies",
      description: "Nutné pro základní funkce webu a e-shopu (košík, přihlášení, zobrazení stránky). Bez těchto cookies nelze web správně používat."
    },
    preferences: {
      title: "Preferenční cookies",
      description: "Zapamatují si vaše volby (jazyk, nastavení) a zlepšují uživatelský komfort."
    },
    analytics: {
      title: "Analytické / statistické cookies",
      description: "Měří návštěvnost webu a vytvářejí anonymní statistiky pro vylepšování obsahu."
    },
    marketing: {
      title: "Marketingové cookies",
      description: "Používají se pro zobrazování cílené reklamy a měření úspěšnosti marketingových kampaní."
    },
    acceptAll: "Povolit vše",
    rejectOptional: "Odmítnout nepovinné",
    save: "Uložit výběr"
  },
  legal: {
    terms: {
      title: "Obchodní podmínky",
      content: "Obchodní podmínky Arte Moderno s.r.o.\n\nTyto obchodní podmínky upravují vztahy mezi Arte Moderno s.r.o. a zákazníky při nákupu uměleckých děl prostřednictvím internetového obchodu na adrese https://kunstkabinett.cz.\n\n1. Úvodní ustanovení\n\n1.1. Provozovatelem internetového obchodu je společnost Arte Moderno s.r.o., IČO 24678821, se sídlem Podolská 103/126, 147 00 Praha 4 – Podolí, Česká republika, provozovna / galerie: Dominikánské náměstí 656/2, Jalta palác, Brno.\n\n1.2. Kontaktní údaje:\n- E-mail: info@kunstkabinett.cz\n- Web: https://kunstkabinett.cz\n\n2. Předmět smlouvy\n\n2.1. Předmětem smlouvy je prodej uměleckých děl (obrazů, soch, grafik a dalších uměleckých předmětů) prostřednictvím internetového obchodu.\n\n2.2. Všechny produkty jsou zobrazeny s popisem, cenou a dostupností. Arte Moderno s.r.o. si vyhrazuje právo změnit ceny a dostupnost produktů bez předchozího upozornění.\n\n3. Uzavření kupní smlouvy\n\n3.1. Kupní smlouva je uzavřena okamžikem potvrzení objednávky ze strany Arte Moderno s.r.o.\n\n3.2. Arte Moderno s.r.o. si vyhrazuje právo odmítnout objednávku bez udání důvodu.\n\n4. Cena a platba\n\n4.1. Ceny produktů jsou uvedeny včetně DPH.\n\n4.2. Platba může být provedena bankovním převodem, platební kartou nebo na dobírku.\n\n5. Dodání\n\n5.1. Arte Moderno s.r.o. zajistí dodání produktů v dohodnuté lhůtě.\n\n5.2. Náklady na dopravu jsou uvedeny při objednávce.\n\n6. Odstoupení od smlouvy\n\n6.1. Zákazník má právo odstoupit od smlouvy do 14 dnů od převzetí zboží.\n\n6.2. Informace o právu na odstoupení jsou uvedeny v samostatném dokumentu.\n\n7. Reklamace\n\n7.1. Zákazník má právo na reklamaci vadného zboží.\n\n7.2. Reklamace se podává na kontaktní údaje Arte Moderno s.r.o.\n\n8. Závěrečná ustanovení\n\n8.1. Tyto obchodní podmínky se řídí právním řádem České republiky.\n\n8.2. Arte Moderno s.r.o. si vyhrazuje právo změnit tyto podmínky. Aktuální verze je vždy zveřejněna na webových stránkách."
    },
    privacy: {
      title: "Zásady ochrany osobních údajů",
      content: "Zásady ochrany osobních údajů Arte Moderno s.r.o.\n\n1. Správce osobních údajů\n\nSprávcem osobních údajů je společnost:\nArte Moderno s.r.o., IČO 24678821\nsídlo: Podolská 103/126, 147 00 Praha 4 – Podolí, Česká republika\nprovozovna / galerie: Dominikánské náměstí 656/2, Jalta palác, Brno\ne-mail: info@kunstkabinett.cz\n\n2. Rozsah zpracovávaných osobních údajů\n\nZpracováváme následující osobní údaje:\n- Jméno a příjmení\n- E-mailová adresa\n- Telefonní číslo\n- Adresa doručení\n- Platební údaje (pouze pro zpracování platby)\n- Údaje o objednávkách\n\n3. Účely zpracování\n\nOsobní údaje zpracováváme za účelem:\n- Plnění kupní smlouvy\n- Komunikace se zákazníkem\n- Zpracování objednávek\n- Zpracování plateb\n- Plnění zákonných povinností\n- Marketingových aktivit (pouze se souhlasem)\n\n4. Právní základ zpracování\n\n- Plnění smlouvy (čl. 6 odst. 1 písm. b) GDPR)\n- Oprávněný zájem (čl. 6 odst. 1 písm. f) GDPR)\n- Souhlas (čl. 6 odst. 1 písm. a) GDPR)\n- Plnění zákonné povinnosti (čl. 6 odst. 1 písm. c) GDPR)\n\n5. Doba uchování\n\nOsobní údaje uchováváme po dobu nezbytnou pro plnění účelů zpracování, nejdéle však po dobu stanovenou zákonem.\n\n6. Vaše práva\n\nMáte právo:\n- Na přístup k osobním údajům\n- Na opravu osobních údajů\n- Na výmaz osobních údajů\n- Na omezení zpracování\n- Na přenositelnost údajů\n- Vznést námitku proti zpracování\n- Odvolat souhlas se zpracováním\n\n7. Kontakt\n\nV případě dotazů nás kontaktujte na e-mailu: info@kunstkabinett.cz\n\n8. Podání stížnosti\n\nMáte právo podat stížnost u Úřadu pro ochranu osobních údajů (www.uoou.cz)."
    },
    cookies: {
      title: "Zásady používání cookies",
      content: `Arte Moderno s.r.o. – www.kunstkabinett.cz

1. Kdo cookies používá

Správcem osobních údajů je společnost:

Arte Moderno s.r.o., IČO 24678821

sídlo: Podolská 103/126, 147 00 Praha 4 – Podolí, Česká republika

provozovna / galerie: Dominikánské náměstí 656/2, Jalta palác, Brno

e-mail: info@kunstkabinett.cz

Tyto zásady používání cookies se vztahují na provoz internetového obchodu a webových stránek na adrese https://kunstkabinett.cz.

2. Co jsou cookies

Cookies jsou malé textové soubory, které se ukládají do vašeho zařízení (počítač, tablet, mobilní telefon) při návštěvě webových stránek. Umožňují rozpoznat vaše zařízení, zapamatovat si některá vaše nastavení a pomáhají nám zajistit správnou funkčnost webu, měřit návštěvnost a zlepšovat naše služby.

Cookies nepoškozují vaše zařízení ani software a ve většině případů neumožňují identifikovat konkrétní osobu, ale pouze konkrétní zařízení.

3. Jaké cookies používáme

Na našich stránkách používáme tyto základní typy cookies:

3.1 Nezbytné (technické) cookies

Tyto cookies jsou nutné pro základní funkce webu a e-shopu, například:

uložení obsahu nákupního košíku,
průběžné ukládání objednávky,
zobrazení stránky v správném formátu a jazyce,
zabezpečené přihlášení do uživatelského účtu (pokud je dostupný).

Bez těchto cookies nelze web a e-shop správně používat. Zpracování vychází z našeho oprávněného zájmu na zajištění funkčnosti stránek.

3.2 Preferenční cookies

Pomáhají zapamatovat si vaše volby (např. jazyk, předchozí nastavení) a zlepšují váš uživatelský komfort. Tyto cookies používáme pouze, pokud nám k tomu udělíte souhlas.

3.3 Analytické / statistické cookies

Slouží k měření návštěvnosti webu a k vytváření anonymních statistik o používání stránek (např. které stránky jsou nejnavštěvovanější, z jakých zdrojů návštěvníci přicházejí). Tyto informace využíváme k vylepšování obsahu a uživatelského prostředí. Analytické cookies používáme pouze na základě vašeho souhlasu.

Můžeme využívat např. služby třetích stran (typicky nástroje pro webovou analytiku). Těmto poskytovatelům jsou předávány pouze takové údaje, které nejsou nutné k vaší přímé identifikaci.

3.4 Marketingové cookies

Používají se pro zobrazování cílené reklamy, připomínání prohlížených produktů či měření úspěšnosti marketingových kampaní. Tento typ cookies používáme jen v případě, že nám k tomu dáte souhlas prostřednictvím cookie lišty nebo nastavení prohlížeče.

4. Právní základ zpracování

U nezbytných (technických) cookies je právním základem náš oprávněný zájem na zajištění funkčnosti a bezpečnosti webu a poskytování služeb, o které máte zájem (uzavření a plnění kupní smlouvy).

U preferenčních, analytických a marketingových cookies je právním základem váš souhlas. Souhlas můžete kdykoli odvolat – viz článek 5 níže.

5. Nastavení cookies a odvolání souhlasu

Při první návštěvě našich stránek se vám zobrazí informační lišta, kde můžete:

povolit všechny cookies,
odmítnout nepovinné cookies,
nebo si vybrat konkrétní typy cookies, s nimiž souhlasíte.

Souhlas s používáním cookies můžete kdykoli změnit nebo odvolat úpravou nastavení svého internetového prohlížeče. Většina prohlížečů umožňuje:

zakázat ukládání cookies,
omezit je na určité typy,
smazat již uložené cookies.

Konkrétní postup najdete v nápovědě vašeho prohlížeče (např. v sekci „Zabezpečení a soukromí" nebo „Cookies").

Upozorňujeme, že blokace nebo smazání některých cookies (zejména nezbytných) může omezit funkčnost našich stránek a e-shopu, např. nebude možné dokončit objednávku.

6. Doba uchování cookies

Doba uchování cookies se liší podle jejich typu:

Relační (session) cookies – ukládají se pouze po dobu relace (návštěvy webu) a po zavření prohlížeče se smažou.

Trvalé (persistent) cookies – zůstávají ve vašem zařízení po dobu uvedenou v jejich nastavení nebo do ručního smazání v prohlížeči.

Konkrétní doby uchování se mohou lišit podle nastavení jednotlivých nástrojů a poskytovatelů.

7. Cookies třetích stran

Na našich stránkách mohou být používány také cookies třetích stran, zejména:

poskytovatelé platebních služeb (např. Comgate) – pro zpracování online plateb,
poskytovatelé dopravních služeb a logistiky (např. Zásilkovna) – v souvislosti s doručením zásilky,
poskytovatelé analytických a marketingových nástrojů – pro statistiku návštěvnosti a případný remarketing.

Tyto subjekty mají vlastní zásady ochrany osobních údajů a cookies, se kterými se můžete seznámit na jejich webových stránkách.

8. Souvislost s ochranou osobních údajů (GDPR)

Informace získané prostřednictvím cookies mohou v určitých případech představovat osobní údaje. V takovém případě s nimi nakládáme v souladu s našimi Zásadami ochrany osobních údajů (GDPR), které podrobně upravují:

rozsah zpracovávaných osobních údajů,
účely a právní základy zpracování,
dobu uchování,
vaše práva (přístup, oprava, výmaz, omezení, přenositelnost, námitka),
možnosti podání stížnosti u Úřadu pro ochranu osobních údajů.

Doporučujeme se s těmito zásadami seznámit; jsou dostupné na našich webových stránkách.

9. Kontaktní údaje pro dotazy

V případě dotazů týkajících se cookies nebo zpracování osobních údajů nás můžete kontaktovat:

e-mailem: info@kunstkabinett.cz

poštou na adresu sídla: Arte Moderno s.r.o., Podolská 103/126, 147 00 Praha 4 – Podolí

10. Aktualizace zásad používání cookies

Tyto zásady mohou být čas od času aktualizovány, zejména v souvislosti se změnou právních předpisů, technických řešení nebo služeb, které na webu používáme.

Aktuální verze je vždy zveřejněna na našich webových stránkách.`
    }
  },
  home: {
    badge: "Kurátorův výběr",
    title: "The September Collection",
    subtitle: "Objev moderní díla od současných autorů. Okamžitá platba, bezpečné doručení.",
    ctaProducts: "Prohlédnout produkty",
    ctaBlog: "Číst blog",
    caption: "{badge} · 2025",
    originals: "Originals",
    heroTitles: [
      "Timeless Works of Art",
      "Echoes of Modern Beauty",
      "The Essence of Artistry",
      "Visions of Modern Art",
      "Contemporary Dreams Collection",
      "Reflections of Creativity",
      "Spirit of Modern Art",
      "Beyond the Canvas",
      "Art in Motion",
      "The Modern Muse"
    ],
    selectionForYou: "Výběr pro vás:",
    all: "Vše",
    allArtists: "Všichni",
    discoverArt: "Discover Art",
    results: "výsledků",
    curated: "curated",
    sort: "Sort:",
    trending: "Trending",
    loading: "Načítám…",
    errorLoading: "Nepodařilo se načíst galerii.",
    noImage: "bez obrázku",
    detail: "Detail",
    buy: "Koupit",
    artistSpotlight: "Artist Spotlight",
    openWork: "Otevřít dílo",
    followArtist: "Sledovat autora",
    exploreWorks: "Prozkoumat díla",
    artInsights: "Zajímavosti z umění"
  },
  products: {
    title: "Galerie",
    loading: "Načítám…",
    noResults: "Žádné výsledky",
    noProducts: "Žádné produkty.",
    filterByCategory: "Filtrovat podle kategorie",
    filterByArtist: "Filtrovat podle autora",
    filterByPrice: "Filtrovat podle ceny",
    priceMin: "Min. cena",
    priceMax: "Max. cena",
    currency: "Měna",
    czk: "CZK",
    eur: "EUR",
    inStock: "Skladem",
    outOfStock: "Není skladem",
    addToCart: "Přidat do košíku",
    viewDetail: "Zobrazit detail",
    unknownAuthor: "Neznámý autor",
    noImage: "bez obrázku",
    filters: "Filtry",
    artist: "Umělec",
    allArtists: "Všichni umělci",
    workTitle: "Název díla",
    searchByTitle: "Hledat podle názvu...",
    priceFrom: "Cena od",
    priceTo: "Cena do",
    clearFilters: "Vymazat",
    activeFilter: "aktivní filtr",
    activeFilters: "aktivní filtry",
    activeFiltersMany: "aktivních filtrů",
    active: "Aktivní:"
  },
  productDetail: {
    loading: "Načítám…",
    errorLoading: "Produkt se nepodařilo načíst.",
    notFound: "Produkt nenalezen.",
    work: "Dílo",
    addToCart: "Přidat do košíku",
    inStock: "Skladem",
    outOfStock: "Není skladem",
    reserved: "Rezervováno",
    reservedMessage: "Toto dílo je rezervováno. Kupující má {minutes}:{seconds} na zaplacení.",
    reservedTime: "Toto dílo je rezervováno. Kupující má {minutes}:{seconds} na zaplacení.",
    enlarge: "Zvětšit",
    closePreview: "Zavřít náhled",
    noImage: "bez obrázku",
    author: "Autor",
    unknownAuthor: "Neznámý autor",
    notAvailable: "Toto dílo není momentálně dostupné.",
    clickForFullDescription: "Klikni pro celý popis",
    closeDescription: "Zavřít popis",
    price: "Cena:",
    description: "Popis:",
    category: "Kategorie:",
    stock: "Skladem:"
  },
  cart: {
    title: "Košík",
    empty: "Košík je prázdný",
    items: "Položek:",
    total: "Celkem:",
    author: "Autor:",
    unknownAuthor: "Neznámý autor",
    remove: "Odebrat",
    continueShopping: "Pokračovat v nákupu",
    proceedToCheckout: "Pokračovat k platbě",
    clearCart: "Vyprázdnit košík"
  },
  checkout: {
    title: "Pokladna",
    empty: "Košík je prázdný.",
    backToCatalog: "Zpět do katalogu",
    loginRequired: "Pro dokončení objednávky se prosím",
    loginLink: "přihlašte",
    loginToComplete: "Přihlas se pro dokončení objednávky",
    items: "Položek",
    subtotal: "Mezisoučet",
    discount: "Sleva",
    total: "Celkem k úhradě",
    summary: "Souhrn",
    couponCode: "Slevový kód",
    apply: "Použít",
    validate: "Ověřit",
    validating: "Ověřuji…",
    verifyCoupon: "Ověřit",
    paymentMethod: "Způsob platby",
    paymentCurrency: "Měna platby",
    paymentCard: "Kartou online",
    paymentCod: "Hotově / dobírka",
    paymentBank: "Převodem",
    shipping: "Doprava",
    shippingDelivery: "Doručení",
    shippingPickup: "Osobní odběr",
    delivery: "Doprava",
    deliveryMethod: "Doručení",
    note: "Poznámka (volitelné)",
    notePlaceholder: "Speciální přání k doručení, apod.",
    placeOrder: "Dokončit objednávku",
    completeOrder: "Dokončit objednávku",
    submitting: "Odesílám…",
    currency: "Měna platby",
    currencyCzk: "CZK (Koruna)",
    currencyEur: "EUR (Euro)",
    czk: "CZK (Koruna česká)",
    eur: "EUR (Euro)",
    currencyMixError: "Nelze vytvořit objednávku s mixem měn",
    currencyMixErrorMsg: "Nelze vytvořit objednávku v EUR: některé produkty nemají cenu v EUR. Prosím odstraňte produkty bez EUR ceny nebo změňte měnu na CZK.",
    productsWithoutEur: "Produkty bez EUR ceny:",
    currencyMixSolution: "Řešení: Odstraňte produkty bez EUR ceny z košíku a vytvořte samostatnou objednávku, nebo změňte měnu na CZK.",
    createOrderError: "Vytvoření objednávky selhalo:",
    unknownError: "Neznámá chyba",
    author: "Autor:",
    couponInvalid: "Kupon je neplatný pro tuto měnu.",
    couponVerifyError: "Chyba při ověření kuponu."
  },
  login: {
    title: "Přihlášení do účtu",
    subtitle: "Pokračuj v objevování současného umění. Zadej své údaje a přihlas se.",
    email: "E-mail",
    password: "Heslo",
    forgotPassword: "Zapomenuté heslo?",
    noAccount: "Nemáte účet? Registrovat",
    submit: "Přihlásit",
    submitting: "Přihlašuji…",
    error: "Přihlášení selhalo.",
    exploreWorks: "Objevovat díla",
    howItWorks: "Jak to funguje",
    welcomeBack: "Welcome back"
  },
  register: {
    title: "Vytvořit účet",
    subtitle: "Registruj se a ukládej košík, objednávky i oblíbená díla.",
    name: "Jméno a příjmení",
    email: "E-mail",
    password: "Heslo",
    password2: "Heslo znovu",
    passwordMin: "min. 8 znaků",
    passwordVerify: "ověření hesla",
    agree: "Souhlasím s",
    terms: "podmínkami",
    privacy: "zpracováním osobních údajů",
    submit: "Vytvořit účet",
    submitting: "Vytvářím účet…",
    hasAccount: "Už máte účet?",
    loginLink: "Přihlásit se",
    browseWorks: "Prohlédnout díla",
    alreadyHaveAccount: "Už mám účet",
    createAccount: "Create account",
    nameRequired: "Zadejte prosím jméno.",
    emailRequired: "Zadejte prosím e-mail.",
    passwordMinLength: "Heslo musí mít alespoň 8 znaků.",
    passwordMismatch: "Hesla se neshodují.",
    agreeRequired: "Pro vytvoření účtu je potřeba souhlasit s podmínkami.",
    error: "Registrace selhala.",
    notAvailable: "Registrace není na serveru k dispozici (404). Nastav VITE_REGISTER_PATH."
  },
  resetPassword: {
    resetPassword: "Obnova hesla",
    title: "Obnova hesla",
    subtitle: "Nastav nové heslo k účtu. Odkaz z e-mailu je časově omezený.",
    requestSubtitle: "Zadej svůj e-mail a pošleme ti odkaz pro obnovu hesla. Odkaz je platný 30 minut.",
    email: "E-mail",
    emailRequired: "Zadej prosím e-mail.",
    emailSent: "Pokud tento e-mail existuje v systému, byl ti odeslán odkaz pro obnovu hesla.",
    sendEmail: "Poslat odkaz",
    sending: "Odesílám…",
    requestError: "Nepodařilo se odeslat odkaz pro obnovu hesla.",
    newPassword: "Nové heslo",
    confirmPassword: "Potvrzení hesla",
    show: "Zobrazit",
    hide: "Skrýt",
    submit: "Nastavit nové heslo",
    saving: "Ukládám…",
    backToLogin: "Zpět na přihlášení",
    missingToken: "Chybí nebo je neplatný reset token v URL.",
    fillBoth: "Vyplň obě pole hesla.",
    passwordMismatch: "Hesla se neshodují.",
    passwordMinLength: "Heslo musí mít alespoň 8 znaků.",
    success: "Heslo bylo úspěšně změněno. Můžeš se přihlásit.",
    error: "Nepodařilo se nastavit nové heslo.",
    notAvailable: "Reset hesla není k dispozici.",
    connectionError: "Chyba spojení se serverem. Zkus to znovu."
  },
  account: {
    title: "Můj profil",
    myOrders: "Moje objednávky",
    storedDataTitle: "Uložené údaje",
    stored: "Uloženo",
    basicInfo: "Základní údaje",
    name: "Jméno a příjmení",
    email: "E-mail",
    phone: "Telefon",
    phoneNote: "Telefon používáme jen pro doručení.",
    billingAddress: "Fakturační adresa",
    street: "Ulice a č.p.",
    city: "Město",
    zip: "PSČ",
    country: "Země",
    shippingAddress: "Doručovací adresa",
    sameAsBilling: "Stejná jako fakturační",
    saveForNext: "Uložit tyto údaje pro příští nákup",
    saveProfile: "Uložit profil",
    save: "Uložit profil",
    saving: "Ukládám…",
    clearProfile: "Vymazat údaje z profilu",
    clear: "Vymazat údaje z profilu"
  },
  orders: {
    title: "Moje objednávky",
    loading: "Načítám…",
    errorLoading: "Nepodařilo se načíst objednávky.",
    error: "Nepodařilo se načíst objednávky.",
    order: "Objednávka",
    status: "Status",
    total: "Celkem",
    actions: "Akce",
    detail: "Detail & platba",
    detailPayment: "Detail & platba",
    remove: "Odebrat",
    removing: "Odebírám…",
    removeTitle: "Odebrat ze seznamu",
    removeFromList: "Odebrat ze seznamu",
    confirmRemove: "Opravdu odebrat tuto objednávku ze seznamu?",
    removeError: "Objednávku se nepodařilo odebrat.",
    empty: "Nemáš žádné objednávky.",
    noOrders: "Nemáš žádné objednávky."
  },
  orderDetail: {
    back: "← Zpět",
    backToList: "← Zpět na seznam",
    status: "Status:",
    orderNumber: "Objednávka #{id}",
    total: "Celkem k úhradě",
    quantity: "Ks:",
    unitPrice: "Cena/kus:",
    paymentMethod: "Platba",
    delivery: "Doprava",
    customerInfo: "Doručovací a kontaktní údaje",
    name: "Jméno a příjmení",
    email: "E-mail",
    phone: "Telefon",
    street: "Ulice a č.p.",
    city: "Město",
    zip: "PSČ",
    address: "Adresa:",
    fillFromProfile: "Vyplnit z profilu",
    saving: "Ukládám…",
    save: "Uložit údaje",
    payment: "Zaplatit",
    bankTransfer: "Převodem / QR",
    bankTransferNote: "Po kliknutí na 'Zaplatit převodem' tě přesměruji na rekapitulaci, kde bude QR s platným VS.",
    qrCode: "QR kód",
    alreadyPaid: "Objednávka je již zaplacená.",
    pendingPayment: "Objednávka čeká na platbu.",
    codNote: "Platba při převzetí.",
    loading: "Načítám…",
    error: "Chyba při načítání.",
    item: "položka",
    author: "Autor",
    unknownAuthor: "Neznámý autor"
  },
  orderPayment: {
    loading: "Načítám…",
    errorLoadingPayment: "Nepodařilo se načíst platební informace.",
    errorLoadingOrder: "Nepodařilo se načíst rekapitulaci objednávky.",
    backToOrder: "← Zpět na objednávku",
    back: "← Zpět",
    status: "Status:",
    title: "Rekapitulace platby převodem",
    amount: "Částka",
    variableSymbol: "VS",
    account: "Účet",
    currency: "Měna",
    qrPayment: "QR platba",
    statusPendingPayment: "Stav objednávky je pending_payment. Po přijetí platby bude změněn na paid."
  },
  contact: {
    title: "Kontakt",
    subtitle: "Jsme tu pro vás. Kontaktujte nás kdykoliv.",
    contactInfo: "Kontaktní údaje",
    name: "Jméno",
    phone: "Telefon",
    address: "Adresa",
    location: "Poloha",
    mapTitle: "Mapa - Palác Jalta, Brno",
    sendMessage: "Napište nám",
    formName: "Jméno",
    formEmail: "Email",
    formSubject: "Předmět",
    formMessage: "Zpráva",
    send: "Odeslat",
    sending: "Odesílám...",
    success: "Vaše zpráva byla úspěšně odeslána. Děkujeme!",
    error: "Nepodařilo se odeslat zprávu. Zkuste to prosím později.",
    nameRequired: "Jméno je povinné",
    emailRequired: "Email je povinný",
    subjectRequired: "Předmět je povinný",
    messageRequired: "Zpráva je povinná"
  },
  artists: {
    title: "Umělci",
    loading: "Načítám…",
    errorLoading: "Nepodařilo se načíst umělce.",
    noArtists: "Žádní umělci",
    authors: "autorů",
    artist: "Umělec",
    artistPortrait: "Portrét umělce",
    noPortrait: "bez portrétu",
    profile: "Profil",
    viewWorks: "Zobrazit díla",
    works: "Díla",
    description: "Popis",
    noDescription: "Bez popisu",
    noImage: "bez obrázku",
    unknownAuthor: "Neznámý autor",
    filterByLastname: "Filtrovat podle příjmení",
    allLetters: "Všechna písmena",
    dropdownAllLastnames: "Všechna příjmení"
  },
  artistDetail: {
    loading: "Načítám…",
    errorLoading: "Umělce se nepodařilo načíst.",
    missingIdentifier: "Chybí identifikátor umělce.",
    notFound: "Umělec nenalezen.",
    noPortrait: "bez portrétu",
    unknownAuthor: "Neznámý autor",
    worksInGallery: "děl v galerii",
    works: "Díla",
    work: "Dílo",
    noImage: "bez obrázku",
    noTitle: "Bez názvu",
    viewDetail: "Detail díla"
  },
  common: {
    loading: "Načítám…",
    error: "Chyba",
    save: "Uložit",
    cancel: "Zrušit",
    delete: "Smazat",
    edit: "Upravit",
    close: "Zavřít",
    back: "Zpět",
    next: "Další",
    previous: "Předchozí",
    page: "Strana",
    of: "z",
    yes: "Ano",
    no: "Ne",
    ok: "OK",
    search: "Hledat",
    filter: "Filtrovat",
    clear: "Vymazat",
    apply: "Použít",
    reset: "Resetovat",
    dark: "Dark",
    and: "a",
  },
  status: {
    draft: "Návrh",
    pendingPayment: "Čeká na platbu",
    pending_payment: "Čeká na platbu",
    paid: "Zaplaceno",
    shipped: "Odesláno",
    canceled: "Zrušeno",
    expired: "Expirovalo",
    sold: "Prodáno",
    reserved: "Rezervováno"
  }
};

const en = {
  brand: { name: "Kunstkabinett" },
  nav: { 
    home: "Home", 
    discover: "Explore", 
    artists: "Artists", 
    blog: "Blog", 
    about: "About us",
    contact: "Contact",
    login: "Sign in",
    account: "My account",
    logout: "Sign out",
    cart: "Cart"
  },
  footer: { terms: "Terms", privacy: "Privacy", support: "Support", cookies: "COOKIE POLICY", cookieSettings: "Cookie Settings" },
  cookies: {
    title: "Cookie Usage",
    description: "This website uses cookies to ensure proper functionality, analyze traffic, and personalize content. You can choose which types of cookies you want to allow.",
    necessary: {
      title: "Necessary (technical) cookies",
      description: "Required for basic website and e-shop functions (cart, login, page display). Without these cookies, the website cannot function properly."
    },
    preferences: {
      title: "Preference cookies",
      description: "Remember your choices (language, settings) and improve user comfort."
    },
    analytics: {
      title: "Analytical / statistical cookies",
      description: "Measure website traffic and create anonymous statistics to improve content."
    },
    marketing: {
      title: "Marketing cookies",
      description: "Used for displaying targeted advertising and measuring marketing campaign success."
    },
    acceptAll: "Accept all",
    rejectOptional: "Reject optional",
    save: "Save selection"
  },
  legal: {
    terms: {
      title: "Terms and Conditions",
      content: "Terms and Conditions Arte Moderno s.r.o.\n\nThese terms and conditions govern the relationship between Arte Moderno s.r.o. and customers when purchasing artworks through the online store at https://kunstkabinett.cz.\n\n1. Introductory Provisions\n\n1.1. The operator of the online store is Arte Moderno s.r.o., ID: 24678821, with registered office at Podolská 103/126, 147 00 Prague 4 – Podolí, Czech Republic, business premises / gallery: Dominikánské náměstí 656/2, Jalta Palace, Brno.\n\n1.2. Contact details:\n- Email: info@kunstkabinett.cz\n- Website: https://kunstkabinett.cz\n\n2. Subject of Contract\n\n2.1. The subject of the contract is the sale of artworks (paintings, sculptures, graphics and other art objects) through the online store.\n\n2.2. All products are displayed with description, price and availability. Arte Moderno s.r.o. reserves the right to change prices and product availability without prior notice.\n\n3. Conclusion of Purchase Contract\n\n3.1. The purchase contract is concluded at the moment of order confirmation by Arte Moderno s.r.o.\n\n3.2. Arte Moderno s.r.o. reserves the right to refuse an order without giving a reason.\n\n4. Price and Payment\n\n4.1. Product prices are stated including VAT.\n\n4.2. Payment can be made by bank transfer, credit card or cash on delivery.\n\n5. Delivery\n\n5.1. Arte Moderno s.r.o. will ensure delivery of products within the agreed period.\n\n5.2. Shipping costs are stated when ordering.\n\n6. Withdrawal from Contract\n\n6.1. The customer has the right to withdraw from the contract within 14 days of receiving the goods.\n\n6.2. Information on the right of withdrawal is provided in a separate document.\n\n7. Complaints\n\n7.1. The customer has the right to complain about defective goods.\n\n7.2. Complaints are submitted to Arte Moderno s.r.o. contact details.\n\n8. Final Provisions\n\n8.1. These terms and conditions are governed by the legal order of the Czech Republic.\n\n8.2. Arte Moderno s.r.o. reserves the right to change these conditions. The current version is always published on the website."
    },
    privacy: {
      title: "Privacy Policy",
      content: "Privacy Policy Arte Moderno s.r.o.\n\n1. Data Controller\n\nThe data controller is:\nArte Moderno s.r.o., ID: 24678821\nregistered office: Podolská 103/126, 147 00 Prague 4 – Podolí, Czech Republic\nbusiness premises / gallery: Dominikánské náměstí 656/2, Jalta Palace, Brno\nemail: info@kunstkabinett.cz\n\n2. Scope of Processed Personal Data\n\nWe process the following personal data:\n- First and last name\n- Email address\n- Phone number\n- Delivery address\n- Payment data (only for payment processing)\n- Order data\n\n3. Purposes of Processing\n\nWe process personal data for the purpose of:\n- Fulfillment of purchase contract\n- Communication with customer\n- Order processing\n- Payment processing\n- Fulfillment of legal obligations\n- Marketing activities (only with consent)\n\n4. Legal Basis for Processing\n\n- Contract fulfillment (Art. 6(1)(b) GDPR)\n- Legitimate interest (Art. 6(1)(f) GDPR)\n- Consent (Art. 6(1)(a) GDPR)\n- Legal obligation (Art. 6(1)(c) GDPR)\n\n5. Retention Period\n\nWe retain personal data for the period necessary to fulfill the purposes of processing, but no longer than the period prescribed by law.\n\n6. Your Rights\n\nYou have the right:\n- To access personal data\n- To rectification of personal data\n- To erasure of personal data\n- To restriction of processing\n- To data portability\n- To object to processing\n- To withdraw consent to processing\n\n7. Contact\n\nFor questions, contact us at: info@kunstkabinett.cz\n\n8. Complaint Filing\n\nYou have the right to file a complaint with the Office for Personal Data Protection (www.uoou.cz)."
    },
    cookies: {
      title: "Cookie Policy",
      content: "Arte Moderno s.r.o. – www.kunstkabinett.cz\n\n1. Who Uses Cookies\n\nThe data controller is:\n\nArte Moderno s.r.o., ID: 24678821\n\nregistered office: Podolská 103/126, 147 00 Prague 4 – Podolí, Czech Republic\n\nbusiness premises / gallery: Dominikánské náměstí 656/2, Jalta Palace, Brno\n\nemail: info@kunstkabinett.cz\n\nThis cookie policy applies to the operation of the online store and website at https://kunstkabinett.cz.\n\n2. What Are Cookies\n\nCookies are small text files that are stored on your device (computer, tablet, mobile phone) when you visit websites. They allow recognition of your device, remember some of your settings, and help us ensure proper website functionality, measure traffic, and improve our services.\n\nCookies do not harm your device or software and in most cases do not allow identification of a specific person, but only a specific device.\n\n3. What Cookies We Use\n\nOn our website we use these basic types of cookies:\n\n3.1 Necessary (technical) cookies\n\nThese cookies are necessary for basic website and e-shop functions, for example:\n\nstoring shopping cart content,\nprogressive order saving,\ndisplaying the page in the correct format and language,\nsecure login to user account (if available).\n\nWithout these cookies, the website and e-shop cannot function properly. Processing is based on our legitimate interest in ensuring website functionality.\n\n3.2 Preference cookies\n\nThey help remember your choices (e.g., language, previous settings) and improve your user comfort. We use these cookies only if you give us consent.\n\n3.3 Analytical / statistical cookies\n\nThey serve to measure website traffic and create anonymous statistics about website usage (e.g., which pages are most visited, what sources visitors come from). We use this information to improve content and user environment. We use analytical cookies only based on your consent.\n\nWe may use services of third parties (typically web analytics tools). Only such data that is not necessary for your direct identification is passed to these providers.\n\n3.4 Marketing cookies\n\nThey are used for displaying targeted advertising, reminding of viewed products, or measuring marketing campaign success. We use this type of cookies only if you give us consent through the cookie bar or browser settings.\n\n4. Legal Basis for Processing\n\nFor necessary (technical) cookies, the legal basis is our legitimate interest in ensuring website functionality and security and providing services you are interested in (conclusion and fulfillment of purchase contract).\n\nFor preference, analytical and marketing cookies, the legal basis is your consent. You can withdraw consent at any time – see Article 5 below.\n\n5. Cookie Settings and Consent Withdrawal\n\nOn your first visit to our website, an information bar will be displayed where you can:\n\nallow all cookies,\nreject optional cookies,\nor choose specific types of cookies you agree with.\n\nYou can change or withdraw consent to cookie usage at any time by adjusting your internet browser settings. Most browsers allow:\n\ndisabling cookie storage,\nlimiting them to certain types,\ndelete already stored cookies.\n\nYou can find the specific procedure in your browser's help (e.g., in the \"Security and Privacy\" or \"Cookies\" section).\n\nWe note that blocking or deleting some cookies (especially necessary ones) may limit the functionality of our website and e-shop, e.g., it will not be possible to complete an order.\n\n6. Cookie Retention Period\n\nThe retention period of cookies varies according to their type:\n\nSession cookies – stored only for the duration of the session (website visit) and deleted after closing the browser.\n\nPersistent cookies – remain on your device for the period stated in their settings or until manual deletion in the browser.\n\nSpecific retention periods may vary according to settings of individual tools and providers.\n\n7. Third-Party Cookies\n\nThird-party cookies may also be used on our website, especially:\n\npayment service providers (e.g., Comgate) – for online payment processing,\ntransport and logistics service providers (e.g., Zásilkovna) – in connection with package delivery,\nanalytical and marketing tool providers – for traffic statistics and possible remarketing.\n\nThese entities have their own privacy and cookie policies, which you can familiarize yourself with on their websites.\n\n8. Connection with Personal Data Protection (GDPR)\n\nInformation obtained through cookies may in certain cases represent personal data. In such cases, we handle them in accordance with our Privacy Policy (GDPR), which in detail regulates:\n\nthe scope of processed personal data,\npurposes and legal bases of processing,\nretention period,\nyour rights (access, rectification, erasure, restriction, portability, objection),\npossibilities of filing a complaint with the Office for Personal Data Protection.\n\nWe recommend familiarizing yourself with these policies; they are available on our website.\n\n9. Contact Details for Inquiries\n\nFor questions regarding cookies or personal data processing, you can contact us:\n\nby email: info@kunstkabinett.cz\n\nby mail to the registered office address: Arte Moderno s.r.o., Podolská 103/126, 147 00 Prague 4 – Podolí\n\n10. Cookie Policy Updates\n\nThis policy may be updated from time to time, especially in connection with changes in legislation, technical solutions, or services we use on the website.\n\nThe current version is always published on our website."
    }
  },
  home: {
    badge: "Curator's Pick",
    title: "The September Collection",
    subtitle: "Discover contemporary works by emerging artists. Instant checkout, secure delivery.",
    ctaProducts: "Browse products",
    ctaBlog: "Read blog",
    caption: "{badge} · 2025",
    originals: "Originals",
    heroTitles: [
      "Timeless Works of Art",
      "Echoes of Modern Beauty",
      "The Essence of Artistry",
      "Visions of Modern Art",
      "Contemporary Dreams Collection",
      "Reflections of Creativity",
      "Spirit of Modern Art",
      "Beyond the Canvas",
      "Art in Motion",
      "The Modern Muse"
    ],
    selectionForYou: "Selection for you:",
    all: "All",
    allArtists: "All artists",
    discoverArt: "Discover Art",
    results: "results",
    curated: "curated",
    sort: "Sort:",
    trending: "Trending",
    loading: "Loading…",
    errorLoading: "Failed to load gallery.",
    noImage: "no image",
    detail: "Detail",
    buy: "Buy",
    artistSpotlight: "Artist Spotlight",
    openWork: "Open work",
    followArtist: "Follow artist",
    exploreWorks: "Explore works",
    artInsights: "Art insights"
  },
  products: {
    title: "Gallery",
    loading: "Loading…",
    noResults: "No results",
    noProducts: "No products.",
    filterByCategory: "Filter by category",
    filterByArtist: "Filter by artist",
    filterByPrice: "Filter by price",
    priceMin: "Min. price",
    priceMax: "Max. price",
    currency: "Currency",
    czk: "CZK",
    eur: "EUR",
    inStock: "In stock",
    outOfStock: "Out of stock",
    addToCart: "Add to cart",
    viewDetail: "View detail",
    unknownAuthor: "Unknown author",
    noImage: "no image",
    filters: "Filters",
    artist: "Artist",
    allArtists: "All artists",
    workTitle: "Work title",
    searchByTitle: "Search by title...",
    priceFrom: "Price from",
    priceTo: "Price to",
    clearFilters: "Clear",
    activeFilter: "active filter",
    activeFilters: "active filters",
    activeFiltersMany: "active filters",
    active: "Active:"
  },
  productDetail: {
    loading: "Loading…",
    errorLoading: "Failed to load product.",
    notFound: "Product not found.",
    work: "Work",
    addToCart: "Add to cart",
    inStock: "In stock",
    outOfStock: "Out of stock",
    reserved: "Reserved",
    reservedMessage: "This work is reserved. The buyer has {minutes}:{seconds} to pay.",
    reservedTime: "This work is reserved. The buyer has {minutes}:{seconds} to pay.",
    enlarge: "Enlarge",
    closePreview: "Close preview",
    noImage: "no image",
    author: "Author",
    unknownAuthor: "Unknown author",
    notAvailable: "This work is not currently available.",
    clickForFullDescription: "Click for full description",
    closeDescription: "Close description",
    price: "Price:",
    description: "Description:",
    category: "Category:",
    stock: "In stock:"
  },
  cart: {
    title: "Cart",
    empty: "Cart is empty",
    items: "Items:",
    total: "Total:",
    author: "Author:",
    unknownAuthor: "Unknown author",
    remove: "Remove",
    continueShopping: "Continue shopping",
    proceedToCheckout: "Proceed to checkout",
    clearCart: "Clear cart"
  },
  checkout: {
    title: "Checkout",
    empty: "Cart is empty.",
    backToCatalog: "Back to catalog",
    loginRequired: "Please",
    loginLink: "sign in",
    items: "Items",
    subtotal: "Subtotal",
    discount: "Discount",
    total: "Total to pay",
    couponCode: "Discount code",
    apply: "Apply",
    verifyCoupon: "Verify",
    paymentMethod: "Payment method",
    paymentCard: "Card online",
    paymentBank: "Bank transfer",
    delivery: "Delivery",
    deliveryMethod: "Delivery",
    note: "Note (optional)",
    placeOrder: "Complete order",
    submitting: "Submitting…",
    currency: "Payment currency",
    currencyCzk: "CZK (Koruna)",
    currencyEur: "EUR (Euro)",
    currencyMixError: "Cannot create order with mixed currencies",
    currencyMixErrorMsg: "Cannot create order in EUR: some products do not have EUR price. Please remove products without EUR price or change currency to CZK.",
    productsWithoutEur: "Products without EUR price:",
    currencyMixSolution: "Solution: Remove products without EUR price from cart and create a separate order, or change currency to CZK.",
    createOrderError: "Order creation failed:",
    unknownError: "Unknown error"
  },
  login: {
    title: "Sign in to account",
    subtitle: "Continue exploring contemporary art. Enter your details and sign in.",
    email: "E-mail",
    password: "Password",
    forgotPassword: "Forgot password?",
    noAccount: "Don't have an account? Register",
    submit: "Sign in",
    submitting: "Signing in…",
    error: "Sign in failed.",
    exploreWorks: "Explore works",
    howItWorks: "How it works",
    welcomeBack: "Welcome back"
  },
  register: {
    title: "Create account",
    subtitle: "Register and save cart, orders and favorite works.",
    name: "Full name",
    email: "E-mail",
    password: "Password",
    password2: "Password again",
    passwordMin: "min. 8 characters",
    passwordVerify: "verify password",
    agree: "I agree with",
    terms: "terms",
    privacy: "privacy policy",
    submit: "Create account",
    submitting: "Creating account…",
    hasAccount: "Already have an account?",
    loginLink: "Sign in",
    browseWorks: "Browse works",
    alreadyHaveAccount: "I already have an account",
    createAccount: "Create account",
    nameRequired: "Please enter name.",
    emailRequired: "Please enter e-mail.",
    passwordMinLength: "Password must be at least 8 characters.",
    passwordMismatch: "Passwords do not match.",
    agreeRequired: "You must agree to the terms to create an account.",
    error: "Registration failed.",
    notAvailable: "Registration is not available on the server (404). Set VITE_REGISTER_PATH."
  },
  resetPassword: {
    resetPassword: "Reset password",
    title: "Reset password",
    subtitle: "Set a new password for your account. The email link is time-limited.",
    requestSubtitle: "Enter your email and we'll send you a password reset link. The link is valid for 30 minutes.",
    email: "E-mail",
    emailRequired: "Please enter your email.",
    emailSent: "If this email exists in the system, a password reset link has been sent to you.",
    sendEmail: "Send link",
    sending: "Sending…",
    requestError: "Failed to send password reset link.",
    newPassword: "New password",
    confirmPassword: "Confirm password",
    show: "Show",
    hide: "Hide",
    submit: "Set new password",
    saving: "Saving…",
    backToLogin: "Back to login",
    missingToken: "Missing or invalid reset token in URL.",
    fillBoth: "Please fill both password fields.",
    passwordMismatch: "Passwords do not match.",
    passwordMinLength: "Password must be at least 8 characters.",
    success: "Password has been successfully changed. You can now log in.",
    error: "Failed to set new password.",
    notAvailable: "Password reset is not available.",
    connectionError: "Connection error. Please try again."
  },
  account: {
    title: "My profile",
    myOrders: "My orders",
    storedDataTitle: "Stored data",
    stored: "Saved",
    basicInfo: "Basic information",
    name: "Full name",
    email: "E-mail",
    phone: "Phone",
    phoneNote: "Phone is only used for delivery.",
    billingAddress: "Billing address",
    street: "Street and number",
    city: "City",
    zip: "ZIP code",
    country: "Country",
    shippingAddress: "Shipping address",
    sameAsBilling: "Same as billing",
    saveForNext: "Save this information for next purchase",
    saveProfile: "Save profile",
    saving: "Saving…",
    clearProfile: "Clear profile data"
  },
  orders: {
    title: "My orders",
    loading: "Loading…",
    error: "Failed to load orders.",
    order: "Order",
    status: "Status",
    total: "Total",
    actions: "Actions",
    detail: "Detail & payment",
    remove: "Remove",
    removing: "Removing…",
    removeTitle: "Remove from list",
    confirmRemove: "Really remove this order from the list?",
    removeError: "Failed to remove order.",
    empty: "You have no orders."
  },
  orderDetail: {
    back: "← Back",
    backToList: "← Back to list",
    status: "Status:",
    orderNumber: "Order #{id}",
    total: "Total to pay",
    quantity: "Qty:",
    unitPrice: "Price/item:",
    paymentMethod: "Payment",
    delivery: "Delivery",
    customerInfo: "Delivery and contact information",
    name: "Full name",
    email: "E-mail",
    phone: "Phone",
    street: "Street and number",
    city: "City",
    zip: "ZIP code",
    address: "Address:",
    fillFromProfile: "Fill from profile",
    saving: "Saving…",
    save: "Save data",
    payment: "Pay",
    bankTransfer: "Bank transfer / QR",
    bankTransferNote: "After clicking \"Pay by transfer\" you will be redirected to a summary with a QR code and valid VS.",
    qrCode: "QR code",
    alreadyPaid: "Order is already paid.",
    pendingPayment: "Order is pending payment.",
    codNote: "Payment on delivery.",
    loading: "Loading…",
    error: "Error loading.",
    item: "item",
    author: "Author",
    unknownAuthor: "Unknown author"
  },
  orderPayment: {
    loading: "Loading…",
    errorLoadingPayment: "Failed to load payment information.",
    errorLoadingOrder: "Failed to load order summary.",
    backToOrder: "← Back to order",
    back: "← Back",
    status: "Status:",
    title: "Bank transfer payment summary",
    amount: "Amount",
    variableSymbol: "VS",
    account: "Account",
    currency: "Currency",
    qrPayment: "QR payment",
    statusPendingPayment: "Order status is pending_payment. After payment is received, it will be changed to paid."
  },
  contact: {
    title: "Contact",
    subtitle: "We are here for you. Contact us anytime.",
    contactInfo: "Contact Information",
    name: "Name",
    phone: "Phone",
    address: "Address",
    location: "Location",
    mapTitle: "Map - Jalta Palace, Brno",
    sendMessage: "Send us a message",
    formName: "Name",
    formEmail: "Email",
    formSubject: "Subject",
    formMessage: "Message",
    send: "Send",
    sending: "Sending...",
    success: "Your message has been sent successfully. Thank you!",
    error: "Failed to send message. Please try again later.",
    nameRequired: "Name is required",
    emailRequired: "Email is required",
    subjectRequired: "Subject is required",
    messageRequired: "Message is required"
  },
  artists: {
    title: "Artists",
    loading: "Loading…",
    authors: "artists",
    noArtists: "No artists",
    artist: "Artist",
    artistPortrait: "Artist portrait",
    noPortrait: "no portrait",
    viewWorks: "View works",
    works: "Works",
    description: "Description",
    noDescription: "No description",
    noImage: "no image",
    profile: "Profile",
    unknownAuthor: "Unknown artist",
    filterByLastname: "Filter by last name",
    allLetters: "All letters",
    dropdownAllLastnames: "All last names"
  },
  common: {
    loading: "Loading…",
    error: "Error",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    close: "Close",
    back: "Back",
    next: "Next",
    previous: "Previous",
    page: "Page",
    of: "of",
    yes: "Yes",
    no: "No",
    ok: "OK",
    search: "Search",
    filter: "Filter",
    clear: "Clear",
    apply: "Apply",
    reset: "Reset",
    dark: "Dark"
  },
  status: {
    draft: "Draft",
    pendingPayment: "Pending payment",
    pending_payment: "Pending payment",
    paid: "Paid",
    shipped: "Shipped",
    canceled: "Canceled",
    expired: "Expired",
    sold: "Sold",
    reserved: "Reserved"
  }
};

// Helper funkce pro vytvoření kompletního slovníku z anglického základu
function extendDict(base, translations) {
  // Deep merge - použij překlady kde jsou, jinak použij base (EN)
  const result = JSON.parse(JSON.stringify(base)); // Deep copy
  for (const key in translations) {
    if (typeof translations[key] === 'object' && !Array.isArray(translations[key]) && translations[key] !== null) {
      result[key] = extendDict(result[key] || {}, translations[key]);
    } else {
      result[key] = translations[key];
    }
  }
  return result;
}

const fr = extendDict(en, {
  brand: { name: "Kunstkabinett" },
  nav: { home: "Accueil", discover: "Découvrir", artists: "Artistes", blog: "Blog", about: "À propos", contact: "Contact", login: "Se connecter", account: "Mon compte", logout: "Se déconnecter", cart: "Panier" },
  contact: {
    title: "Contact",
    subtitle: "Nous sommes là pour vous. Contactez-nous à tout moment.",
    contactInfo: "Informations de contact",
    name: "Nom",
    phone: "Téléphone",
    address: "Adresse",
    location: "Localisation",
    mapTitle: "Carte - Palais Jalta, Brno",
    sendMessage: "Envoyez-nous un message",
    formName: "Nom",
    formEmail: "Email",
    formSubject: "Sujet",
    formMessage: "Message",
    send: "Envoyer",
    sending: "Envoi en cours...",
    success: "Votre message a été envoyé avec succès. Merci!",
    error: "Échec de l'envoi du message. Veuillez réessayer plus tard.",
    nameRequired: "Le nom est requis",
    emailRequired: "L'email est requis",
    subjectRequired: "Le sujet est requis",
    messageRequired: "Le message est requis"
  },
  footer: { terms: "Conditions", privacy: "Confidentialité", support: "Support", cookies: "POLITIQUE DES COOKIES", cookieSettings: "Paramètres des cookies" },
  account: {
    title: "Mon profil",
    myOrders: "Mes commandes",
    storedDataTitle: "Données enregistrées",
    stored: "Enregistré",
    basicInfo: "Informations de base",
    name: "Nom complet",
    email: "E-mail",
    phone: "Téléphone",
    phoneNote: "Le téléphone est uniquement utilisé pour la livraison.",
    billingAddress: "Adresse de facturation",
    street: "Rue et numéro",
    city: "Ville",
    zip: "Code postal",
    country: "Pays",
    shippingAddress: "Adresse de livraison",
    sameAsBilling: "Identique à l'adresse de facturation",
    saveForNext: "Enregistrer ces informations pour le prochain achat",
    saveProfile: "Enregistrer le profil",
    save: "Enregistrer le profil",
    saving: "Enregistrement…",
    clearProfile: "Effacer les données du profil",
    clear: "Effacer les données du profil"
  },
  orders: {
    title: "Mes commandes",
    loading: "Chargement…",
    errorLoading: "Impossible de charger les commandes.",
    error: "Impossible de charger les commandes.",
    order: "Commande",
    status: "Statut",
    total: "Total",
    actions: "Actions",
    detail: "Détails et paiement",
    detailPayment: "Détails et paiement",
    remove: "Retirer",
    removing: "Retrait…",
    removeTitle: "Retirer de la liste",
    removeFromList: "Retirer de la liste",
    confirmRemove: "Voulez-vous vraiment retirer cette commande de la liste?",
    removeError: "Impossible de retirer la commande.",
    empty: "Vous n'avez aucune commande.",
    noOrders: "Vous n'avez aucune commande."
  },
  products: {
    title: "Galerie",
    loading: "Chargement…",
    noResults: "Aucun résultat",
    noProducts: "Aucun produit.",
    filterByCategory: "Filtrer par catégorie",
    filterByArtist: "Filtrer par artiste",
    filterByPrice: "Filtrer par prix",
    priceMin: "Prix min.",
    priceMax: "Prix max.",
    currency: "Devise",
    czk: "CZK",
    eur: "EUR",
    inStock: "En stock",
    outOfStock: "Rupture de stock",
    addToCart: "Ajouter au panier",
    viewDetail: "Voir les détails",
    unknownAuthor: "Artiste inconnu",
    noImage: "pas d'image",
    filters: "Filtres",
    artist: "Artiste",
    allArtists: "Tous les artistes",
    workTitle: "Titre de l'œuvre",
    searchByTitle: "Rechercher par titre...",
    priceFrom: "Prix à partir de",
    priceTo: "Prix jusqu'à",
    clearFilters: "Effacer",
    activeFilter: "filtre actif",
    activeFilters: "filtres actifs",
    activeFiltersMany: "filtres actifs",
    active: "Actif:"
  },
  checkout: {
    title: "Caisse",
    empty: "Le panier est vide.",
    backToCatalog: "Retour au catalogue",
    loginRequired: "Veuillez",
    loginLink: "vous connecter",
    loginToComplete: "Connectez-vous pour finaliser la commande",
    items: "Articles",
    subtotal: "Sous-total",
    discount: "Remise",
    total: "Total à payer",
    summary: "Résumé",
    couponCode: "Code de réduction",
    validate: "Valider",
    validating: "Validation…",
    verifyCoupon: "Vérifier",
    paymentMethod: "Méthode de paiement",
    paymentCurrency: "Devise de paiement",
    paymentCard: "Carte en ligne",
    paymentCod: "Espèces / Paiement à la livraison",
    paymentBank: "Virement",
    shipping: "Livraison",
    shippingDelivery: "Livraison",
    shippingPickup: "Retrait",
    delivery: "Livraison",
    deliveryMethod: "Livraison",
    note: "Note (optionnelle)",
    notePlaceholder: "Souhaits spéciaux pour la livraison, etc.",
    placeOrder: "Finaliser la commande",
    completeOrder: "Finaliser la commande",
    submitting: "Envoi…",
    currency: "Devise de paiement",
    currencyCzk: "CZK (Couronne)",
    currencyEur: "EUR (Euro)",
    czk: "CZK (Couronne tchèque)",
    eur: "EUR (Euro)",
    currencyMixError: "Impossible de créer une commande avec des devises mixtes",
    currencyMixErrorMsg: "Impossible de créer une commande en EUR: certains produits n'ont pas de prix en EUR. Veuillez retirer les produits sans prix EUR ou changer la devise en CZK.",
    productsWithoutEur: "Produits sans prix EUR:",
    currencyMixSolution: "Solution: Retirez les produits sans prix EUR du panier et créez une commande séparée, ou changez la devise en CZK.",
    createOrderError: "Échec de la création de la commande:",
    unknownError: "Erreur inconnue",
    author: "Artiste:",
    couponInvalid: "Le coupon n'est pas valide pour cette devise.",
    couponVerifyError: "Erreur lors de la vérification du coupon."
  },
  cart: {
    title: "Panier",
    empty: "Le panier est vide",
    items: "Articles:",
    total: "Total:",
    author: "Artiste:",
    unknownAuthor: "Artiste inconnu",
    remove: "Retirer",
    continueShopping: "Continuer les achats",
    proceedToCheckout: "Aller à la caisse",
    clearCart: "Vider le panier"
  },
  orderDetail: {
    back: "← Retour",
    backToList: "← Retour à la liste",
    status: "Statut:",
    orderNumber: "Commande #{id}",
    total: "Total à payer",
    quantity: "Qté:",
    unitPrice: "Prix/article:",
    paymentMethod: "Paiement",
    delivery: "Livraison",
    customerInfo: "Informations de livraison et de contact",
    name: "Nom complet",
    email: "E-mail",
    phone: "Téléphone",
    street: "Rue et numéro",
    city: "Ville",
    zip: "Code postal",
    address: "Adresse:",
    fillFromProfile: "Remplir depuis le profil",
    saving: "Enregistrement…",
    save: "Enregistrer les données",
    payment: "Payer",
    bankTransfer: "Virement / QR",
    bankTransferNote: "Après avoir cliqué sur \"Payer par virement\", vous serez redirigé vers un résumé avec un code QR et un VS valide.",
    qrCode: "Code QR",
    alreadyPaid: "La commande est déjà payée.",
    pendingPayment: "La commande est en attente de paiement.",
    codNote: "Paiement à la livraison.",
    loading: "Chargement…",
    error: "Erreur lors du chargement.",
    item: "article",
    author: "Artiste",
    unknownAuthor: "Artiste inconnu"
  },
  orderPayment: {
    loading: "Chargement…",
    errorLoadingPayment: "Impossible de charger les informations de paiement.",
    errorLoadingOrder: "Impossible de charger le résumé de la commande.",
    backToOrder: "← Retour à la commande",
    back: "← Retour",
    status: "Statut:",
    title: "Résumé du paiement par virement",
    amount: "Montant",
    variableSymbol: "VS",
    account: "Compte",
    currency: "Devise",
    qrPayment: "Paiement QR",
    statusPendingPayment: "Le statut de la commande est pending_payment. Après réception du paiement, il sera changé en paid."
  },
  status: {
    draft: "Brouillon",
    pendingPayment: "En attente de paiement",
    pending_payment: "En attente de paiement",
    paid: "Payé",
    shipped: "Expédié",
    canceled: "Annulé",
    expired: "Expiré",
    sold: "Vendu",
    reserved: "Réservé"
  },
  common: {
    loading: "Chargement…",
    error: "Erreur",
    save: "Enregistrer",
    cancel: "Annuler",
    delete: "Supprimer",
    edit: "Modifier",
    close: "Fermer",
    back: "Retour",
    next: "Suivant",
    previous: "Précédent",
    page: "Page",
    of: "de",
    yes: "Oui",
    no: "Non",
    ok: "OK",
    search: "Rechercher",
    filter: "Filtrer",
    clear: "Effacer",
    apply: "Appliquer",
    reset: "Réinitialiser",
    dark: "Sombre",
    and: "et",
  },
  cookies: {
    title: "Utilisation des cookies",
    description: "Ce site Web utilise des cookies pour assurer le bon fonctionnement, analyser le trafic et personnaliser le contenu. Vous pouvez choisir les types de cookies que vous souhaitez autoriser.",
    necessary: {
      title: "Cookies nécessaires (techniques)",
      description: "Requis pour les fonctions de base du site Web et de la boutique en ligne (panier, connexion, affichage des pages). Sans ces cookies, le site Web ne peut pas fonctionner correctement."
    },
    preferences: {
      title: "Cookies de préférences",
      description: "Mémorisent vos choix (langue, paramètres) et améliorent votre confort d'utilisation."
    },
    analytics: {
      title: "Cookies analytiques / statistiques",
      description: "Mesurent le trafic du site Web et créent des statistiques anonymes pour améliorer le contenu."
    },
    marketing: {
      title: "Cookies marketing",
      description: "Utilisés pour afficher des publicités ciblées et mesurer le succès des campagnes marketing."
    },
    acceptAll: "Tout accepter",
    rejectOptional: "Rejeter les optionnels",
    save: "Enregistrer la sélection"
  },
  legal: {
    terms: {
      title: "Conditions générales",
      content: `Conditions générales Arte Moderno s.r.o.

Ces conditions générales régissent la relation entre Arte Moderno s.r.o. et les clients lors de l'achat d'œuvres d'art via la boutique en ligne à l'adresse https://kunstkabinett.cz.

1. Dispositions introductives

1.1. L'opérateur de la boutique en ligne est Arte Moderno s.r.o., ID: 24678821, avec siège social au Podolská 103/126, 147 00 Prague 4 – Podolí, République tchèque, locaux commerciaux / galerie: Dominikánské náměstí 656/2, Palais Jalta, Brno.

1.2. Coordonnées:
- E-mail: info@kunstkabinett.cz
- Site Web: https://kunstkabinett.cz

2. Objet du contrat

2.1. L'objet du contrat est la vente d'œuvres d'art (peintures, sculptures, graphiques et autres objets d'art) via la boutique en ligne.

2.2. Tous les produits sont affichés avec description, prix et disponibilité. Arte Moderno s.r.o. se réserve le droit de modifier les prix et la disponibilité des produits sans préavis.

3. Conclusion du contrat d'achat

3.1. Le contrat d'achat est conclu au moment de la confirmation de la commande par Arte Moderno s.r.o.

3.2. Arte Moderno s.r.o. se réserve le droit de refuser une commande sans donner de raison.

4. Prix et paiement

4.1. Les prix des produits sont indiqués TTC.

4.2. Le paiement peut être effectué par virement bancaire, carte de crédit ou contre remboursement.

5. Livraison

5.1. Arte Moderno s.r.o. assurera la livraison des produits dans les délais convenus.

5.2. Les frais d'expédition sont indiqués lors de la commande.

6. Droit de rétractation

6.1. Le client a le droit de se rétracter du contrat dans les 14 jours suivant la réception des marchandises.

6.2. Les informations sur le droit de rétractation sont fournies dans un document séparé.

7. Réclamations

7.1. Le client a le droit de réclamer des marchandises défectueuses.

7.2. Les réclamations sont soumises aux coordonnées d'Arte Moderno s.r.o.

8. Dispositions finales

8.1. Ces conditions générales sont régies par l'ordre juridique de la République tchèque.

8.2. Arte Moderno s.r.o. se réserve le droit de modifier ces conditions. La version actuelle est toujours publiée sur le site Web.`
    },
    privacy: {
      title: "Politique de confidentialité",
      content: `Politique de confidentialité Arte Moderno s.r.o.

1. Responsable du traitement des données

Le responsable du traitement des données est:
Arte Moderno s.r.o., ID: 24678821
siège social: Podolská 103/126, 147 00 Prague 4 – Podolí, République tchèque
locaux commerciaux / galerie: Dominikánské náměstí 656/2, Palais Jalta, Brno
e-mail: info@kunstkabinett.cz

2. Portée des données personnelles traitées

Nous traitons les données personnelles suivantes:
- Prénom et nom
- Adresse e-mail
- Numéro de téléphone
- Adresse de livraison
- Données de paiement (uniquement pour le traitement des paiements)
- Données de commande

3. Finalités du traitement

Nous traitons les données personnelles aux fins de:
- Exécution du contrat d'achat
- Communication avec le client
- Traitement des commandes
- Traitement des paiements
- Exécution des obligations légales
- Activités marketing (uniquement avec consentement)

4. Base juridique du traitement

- Exécution du contrat (art. 6, par. 1, point b) RGPD)
- Intérêt légitime (art. 6, par. 1, point f) RGPD)
- Consentement (art. 6, par. 1, point a) RGPD)
- Obligation légale (art. 6, par. 1, point c) RGPD)

5. Durée de conservation

Nous conservons les données personnelles pendant la période nécessaire à l'accomplissement des finalités du traitement, mais pas plus longtemps que la période prescrite par la loi.

6. Vos droits

Vous avez le droit:
- D'accès aux données personnelles
- De rectification des données personnelles
- D'effacement des données personnelles
- De limitation du traitement
- De portabilité des données
- De vous opposer au traitement
- De retirer le consentement au traitement

7. Contact

Pour toute question, contactez-nous à: info@kunstkabinett.cz

8. Dépôt de plainte

Vous avez le droit de déposer une plainte auprès de l'Autorité de protection des données personnelles (www.uoou.cz).`
    },
    cookies: {
      title: "Politique des cookies",
      content: `Arte Moderno s.r.o. – www.kunstkabinett.cz

1. Qui utilise les cookies

Le responsable du traitement des données est:

Arte Moderno s.r.o., ID: 24678821

siège social: Podolská 103/126, 147 00 Prague 4 – Podolí, République tchèque

locaux commerciaux / galerie: Dominikánské náměstí 656/2, Palais Jalta, Brno

e-mail: info@kunstkabinett.cz

Cette politique de cookies s'applique à l'exploitation de la boutique en ligne et du site Web à l'adresse https://kunstkabinett.cz.

2. Qu'est-ce que les cookies

Les cookies sont de petits fichiers texte qui sont stockés sur votre appareil (ordinateur, tablette, téléphone portable) lorsque vous visitez des sites Web. Ils permettent de reconnaître votre appareil, de mémoriser certains de vos paramètres et nous aident à assurer le bon fonctionnement du site Web, à mesurer le trafic et à améliorer nos services.

Les cookies n'endommagent pas votre appareil ou votre logiciel et, dans la plupart des cas, ne permettent pas d'identifier une personne spécifique, mais uniquement un appareil spécifique.

3. Quels cookies utilisons-nous

Sur notre site Web, nous utilisons ces types de base de cookies:

3.1 Cookies nécessaires (techniques)

Ces cookies sont nécessaires pour les fonctions de base du site Web et de la boutique en ligne, par exemple:

stockage du contenu du panier d'achat,
sauvegarde progressive de la commande,
affichage de la page dans le bon format et la bonne langue,
connexion sécurisée au compte utilisateur (si disponible).

Sans ces cookies, le site Web et la boutique en ligne ne peuvent pas fonctionner correctement. Le traitement est basé sur notre intérêt légitime à assurer la fonctionnalité du site Web.

3.2 Cookies de préférences

Ils aident à mémoriser vos choix (par exemple, langue, paramètres précédents) et améliorent votre confort d'utilisation. Nous n'utilisons ces cookies que si vous nous donnez votre consentement.

3.3 Cookies analytiques / statistiques

Ils servent à mesurer le trafic du site Web et à créer des statistiques anonymes sur l'utilisation du site Web (par exemple, quelles pages sont les plus visitées, de quelles sources viennent les visiteurs). Nous utilisons ces informations pour améliorer le contenu et l'environnement utilisateur. Nous n'utilisons les cookies analytiques que sur la base de votre consentement.

Nous pouvons utiliser les services de tiers (généralement des outils d'analyse Web). Seules les données qui ne sont pas nécessaires à votre identification directe sont transmises à ces fournisseurs.

3.4 Cookies marketing

Ils sont utilisés pour afficher des publicités ciblées, rappeler les produits consultés ou mesurer le succès des campagnes marketing. Nous n'utilisons ce type de cookies que si vous nous donnez votre consentement via la barre de cookies ou les paramètres du navigateur.

4. Base juridique du traitement

Pour les cookies nécessaires (techniques), la base juridique est notre intérêt légitime à assurer la fonctionnalité et la sécurité du site Web et à fournir des services qui vous intéressent (conclusion et exécution du contrat d'achat).

Pour les cookies de préférences, analytiques et marketing, la base juridique est votre consentement. Vous pouvez retirer votre consentement à tout moment – voir l'article 5 ci-dessous.

5. Paramètres des cookies et retrait du consentement

Lors de votre première visite sur notre site Web, une barre d'information s'affichera où vous pourrez:

autoriser tous les cookies,
rejeter les cookies optionnels,
ou choisir des types spécifiques de cookies avec lesquels vous êtes d'accord.

Vous pouvez modifier ou retirer votre consentement à l'utilisation des cookies à tout moment en ajustant les paramètres de votre navigateur Internet. La plupart des navigateurs permettent de:

désactiver le stockage des cookies,
les limiter à certains types,
supprimer les cookies déjà stockés.

Vous pouvez trouver la procédure spécifique dans l'aide de votre navigateur (par exemple, dans la section "Sécurité et confidentialité" ou "Cookies").

Nous notons que le blocage ou la suppression de certains cookies (en particulier les cookies nécessaires) peut limiter la fonctionnalité de notre site Web et de notre boutique en ligne, par exemple, il ne sera pas possible de finaliser une commande.

6. Durée de conservation des cookies

La durée de conservation des cookies varie selon leur type:

Cookies de session – stockés uniquement pendant la durée de la session (visite du site Web) et supprimés après la fermeture du navigateur.

Cookies persistants – restent sur votre appareil pendant la période indiquée dans leurs paramètres ou jusqu'à suppression manuelle dans le navigateur.

Les durées de conservation spécifiques peuvent varier selon les paramètres des outils et fournisseurs individuels.

7. Cookies tiers

Des cookies tiers peuvent également être utilisés sur notre site Web, notamment:

prestataires de services de paiement (par exemple, Comgate) – pour le traitement des paiements en ligne,
prestataires de services de transport et de logistique (par exemple, Zásilkovna) – en relation avec la livraison des colis,
prestataires d'outils d'analyse et de marketing – pour les statistiques de trafic et le remarketing éventuel.

Ces entités ont leurs propres politiques de confidentialité et de cookies, que vous pouvez consulter sur leurs sites Web.

8. Lien avec la protection des données personnelles (RGPD)

Les informations obtenues via les cookies peuvent dans certains cas représenter des données personnelles. Dans de tels cas, nous les traitons conformément à notre Politique de confidentialité (RGPD), qui régit en détail:

la portée des données personnelles traitées,
les finalités et bases juridiques du traitement,
la durée de conservation,
vos droits (accès, rectification, effacement, limitation, portabilité, objection),
les possibilités de déposer une plainte auprès de l'Autorité de protection des données personnelles.

Nous recommandons de vous familiariser avec ces politiques; elles sont disponibles sur notre site Web.

9. Coordonnées pour les demandes

Pour toute question concernant les cookies ou le traitement des données personnelles, vous pouvez nous contacter:

par e-mail: info@kunstkabinett.cz

par courrier à l'adresse du siège social: Arte Moderno s.r.o., Podolská 103/126, 147 00 Prague 4 – Podolí

10. Mises à jour de la politique des cookies

Cette politique peut être mise à jour de temps à autre, notamment en relation avec les changements de législation, de solutions techniques ou de services que nous utilisons sur le site Web.

La version actuelle est toujours publiée sur notre site Web.`
    }
  },
  login: {
    title: "Se connecter au compte",
    subtitle: "Continuez à explorer l'art contemporain. Entrez vos informations et connectez-vous.",
    email: "E-mail",
    password: "Mot de passe",
    forgotPassword: "Mot de passe oublié?",
    noAccount: "Vous n'avez pas de compte? S'inscrire",
    submit: "Se connecter",
    submitting: "Connexion…",
    error: "La connexion a échoué.",
    exploreWorks: "Explorer les œuvres",
    howItWorks: "Comment ça marche",
    welcomeBack: "Bon retour"
  },
  register: {
    title: "Créer un compte",
    subtitle: "Inscrivez-vous et enregistrez le panier, les commandes et les œuvres favorites.",
    name: "Nom complet",
    email: "E-mail",
    password: "Mot de passe",
    password2: "Mot de passe à nouveau",
    passwordMin: "min. 8 caractères",
    passwordVerify: "vérifier le mot de passe",
    agree: "J'accepte les",
    terms: "conditions",
    privacy: "politique de confidentialité",
    submit: "Créer un compte",
    submitting: "Création du compte…",
    hasAccount: "Vous avez déjà un compte?",
    loginLink: "Se connecter",
    browseWorks: "Parcourir les œuvres",
    alreadyHaveAccount: "J'ai déjà un compte",
    createAccount: "Créer un compte",
    nameRequired: "Veuillez entrer le nom.",
    emailRequired: "Veuillez entrer l'e-mail.",
    passwordMinLength: "Le mot de passe doit contenir au moins 8 caractères.",
    passwordMismatch: "Les mots de passe ne correspondent pas.",
    agreeRequired: "Vous devez accepter les conditions pour créer un compte.",
    error: "L'inscription a échoué.",
    notAvailable: "L'inscription n'est pas disponible sur le serveur (404). Définissez VITE_REGISTER_PATH."
  },
  resetPassword: {
    resetPassword: "Réinitialiser le mot de passe",
    title: "Réinitialiser le mot de passe",
    subtitle: "Définissez un nouveau mot de passe pour votre compte. Le lien email est limité dans le temps.",
    requestSubtitle: "Entrez votre e-mail et nous vous enverrons un lien pour réinitialiser le mot de passe. Le lien est valable 30 minutes.",
    email: "E-mail",
    emailRequired: "Veuillez entrer votre e-mail.",
    emailSent: "Si cet e-mail existe dans le système, un lien de réinitialisation du mot de passe vous a été envoyé.",
    sendEmail: "Envoyer le lien",
    sending: "Envoi…",
    requestError: "Impossible d'envoyer le lien de réinitialisation du mot de passe.",
    newPassword: "Nouveau mot de passe",
    confirmPassword: "Confirmer le mot de passe",
    show: "Afficher",
    hide: "Masquer",
    submit: "Définir un nouveau mot de passe",
    saving: "Enregistrement…",
    backToLogin: "Retour à la connexion",
    missingToken: "Token de réinitialisation manquant ou invalide dans l'URL.",
    fillBoth: "Veuillez remplir les deux champs de mot de passe.",
    passwordMismatch: "Les mots de passe ne correspondent pas.",
    passwordMinLength: "Le mot de passe doit contenir au moins 8 caractères.",
    success: "Le mot de passe a été modifié avec succès. Vous pouvez maintenant vous connecter.",
    error: "Impossible de définir le nouveau mot de passe.",
    notAvailable: "La réinitialisation du mot de passe n'est pas disponible.",
    connectionError: "Erreur de connexion. Veuillez réessayer."
  },
  home: {
    badge: "Sélection du conservateur",
    title: "La Collection de Septembre",
    subtitle: "Découvrez des œuvres contemporaines d'artistes émergents. Paiement instantané, livraison sécurisée.",
    ctaProducts: "Parcourir les produits",
    ctaBlog: "Lire le blog",
    caption: "{badge} · 2025",
    originals: "Originaux",
    heroTitles: [
      "Œuvres intemporelles",
      "Échos de la beauté moderne",
      "L'essence de l'art",
      "Visions de l'art moderne",
      "Collection Rêves contemporains",
      "Réflexions de créativité",
      "Esprit de l'art moderne",
      "Au-delà de la toile",
      "Art en mouvement",
      "La muse moderne"
    ],
    selectionForYou: "Sélection pour vous :",
    all: "Tout",
    allArtists: "Tous les artistes",
    discoverArt: "Découvrir l'art",
    results: "résultats",
    curated: "sélectionné",
    sort: "Trier :",
    trending: "Tendance",
    loading: "Chargement…",
    errorLoading: "Impossible de charger la galerie.",
    noImage: "pas d'image",
    detail: "Détail",
    buy: "Acheter",
    artistSpotlight: "Artiste à l'honneur",
    openWork: "Ouvrir l'œuvre",
    followArtist: "Suivre l'artiste",
    exploreWorks: "Explorer les œuvres",
    artInsights: "Aperçus de l'art"
  }
});

const de = extendDict(en, {
  brand: { name: "Kunstkabinett" },
  nav: { home: "Start", discover: "Entdecken", artists: "Künstler", blog: "Blog", about: "Über uns", contact: "Kontakt", login: "Anmelden", account: "Mein Konto", logout: "Abmelden", cart: "Warenkorb" },
  contact: {
    title: "Kontakt",
    subtitle: "Wir sind für Sie da. Kontaktieren Sie uns jederzeit.",
    contactInfo: "Kontaktinformationen",
    name: "Name",
    phone: "Telefon",
    address: "Adresse",
    location: "Standort",
    mapTitle: "Karte - Palast Jalta, Brünn",
    sendMessage: "Senden Sie uns eine Nachricht",
    formName: "Name",
    formEmail: "Email",
    formSubject: "Betreff",
    formMessage: "Nachricht",
    send: "Senden",
    sending: "Wird gesendet...",
    success: "Ihre Nachricht wurde erfolgreich gesendet. Vielen Dank!",
    error: "Nachricht konnte nicht gesendet werden. Bitte versuchen Sie es später erneut.",
    nameRequired: "Name ist erforderlich",
    emailRequired: "Email ist erforderlich",
    subjectRequired: "Betreff ist erforderlich",
    messageRequired: "Nachricht ist erforderlich"
  },
  footer: { terms: "Nutzungsbedingungen", privacy: "Datenschutz", support: "Support", cookies: "COOKIE-RICHTLINIE", cookieSettings: "Cookie-Einstellungen" },
  account: {
    title: "Mein Profil",
    myOrders: "Meine Bestellungen",
    storedDataTitle: "Gespeicherte Daten",
    stored: "Gespeichert",
    basicInfo: "Grundinformationen",
    name: "Vollständiger Name",
    email: "E-Mail",
    phone: "Telefon",
    phoneNote: "Telefon wird nur für die Lieferung verwendet.",
    billingAddress: "Rechnungsadresse",
    street: "Straße und Hausnummer",
    city: "Stadt",
    zip: "Postleitzahl",
    country: "Land",
    shippingAddress: "Lieferadresse",
    sameAsBilling: "Gleich wie Rechnungsadresse",
    saveForNext: "Diese Informationen für den nächsten Kauf speichern",
    saveProfile: "Profil speichern",
    save: "Profil speichern",
    saving: "Speichere…",
    clearProfile: "Profildaten löschen",
    clear: "Profildaten löschen"
  },
  login: {
    title: "In Konto anmelden",
    subtitle: "Setze deine Entdeckung zeitgenössischer Kunst fort. Gib deine Daten ein und melde dich an.",
    email: "E-Mail",
    password: "Passwort",
    forgotPassword: "Passwort vergessen?",
    noAccount: "Noch kein Konto? Registrieren",
    submit: "Anmelden",
    submitting: "Melde an…",
    error: "Anmeldung fehlgeschlagen.",
    exploreWorks: "Werke entdecken",
    howItWorks: "Wie es funktioniert",
    welcomeBack: "Willkommen zurück"
  },
  register: {
    title: "Konto erstellen",
    subtitle: "Registriere dich und speichere Warenkorb, Bestellungen und Lieblingswerke.",
    name: "Vollständiger Name",
    email: "E-Mail",
    password: "Passwort",
    password2: "Passwort erneut",
    passwordMin: "min. 8 Zeichen",
    passwordVerify: "Passwort bestätigen",
    agree: "Ich stimme den",
    terms: "Bedingungen",
    privacy: "Datenschutzrichtlinie",
    submit: "Konto erstellen",
    submitting: "Erstelle Konto…",
    hasAccount: "Bereits ein Konto?",
    loginLink: "Anmelden",
    browseWorks: "Werke durchsuchen",
    alreadyHaveAccount: "Ich habe bereits ein Konto",
    createAccount: "Konto erstellen",
    nameRequired: "Bitte geben Sie einen Namen ein.",
    emailRequired: "Bitte geben Sie eine E-Mail ein.",
    passwordMinLength: "Passwort muss mindestens 8 Zeichen lang sein.",
    passwordMismatch: "Passwörter stimmen nicht überein.",
    agreeRequired: "Sie müssen den Bedingungen zustimmen, um ein Konto zu erstellen.",
    error: "Registrierung fehlgeschlagen.",
    notAvailable: "Registrierung ist auf dem Server nicht verfügbar (404). Setzen Sie VITE_REGISTER_PATH."
  },
  resetPassword: {
    resetPassword: "Passwort zurücksetzen",
    title: "Passwort zurücksetzen",
    subtitle: "Setzen Sie ein neues Passwort für Ihr Konto. Der E-Mail-Link ist zeitlich begrenzt.",
    requestSubtitle: "Geben Sie Ihre E-Mail ein und wir senden Ihnen einen Link zum Zurücksetzen des Passworts. Der Link ist 30 Minuten gültig.",
    email: "E-Mail",
    emailRequired: "Bitte geben Sie Ihre E-Mail ein.",
    emailSent: "Wenn diese E-Mail im System existiert, wurde Ihnen ein Link zum Zurücksetzen des Passworts gesendet.",
    sendEmail: "Link senden",
    sending: "Sende…",
    requestError: "Link zum Zurücksetzen des Passworts konnte nicht gesendet werden.",
    newPassword: "Neues Passwort",
    confirmPassword: "Passwort bestätigen",
    show: "Anzeigen",
    hide: "Verbergen",
    submit: "Neues Passwort setzen",
    saving: "Speichere…",
    backToLogin: "Zurück zur Anmeldung",
    missingToken: "Fehlender oder ungültiger Reset-Token in der URL.",
    fillBoth: "Bitte füllen Sie beide Passwortfelder aus.",
    passwordMismatch: "Passwörter stimmen nicht überein.",
    passwordMinLength: "Passwort muss mindestens 8 Zeichen lang sein.",
    success: "Passwort wurde erfolgreich geändert. Sie können sich jetzt anmelden.",
    error: "Neues Passwort konnte nicht gesetzt werden.",
    notAvailable: "Passwort-Reset ist nicht verfügbar.",
    connectionError: "Verbindungsfehler. Bitte versuchen Sie es erneut."
  },
  orders: {
    title: "Meine Bestellungen",
    loading: "Lade…",
    errorLoading: "Bestellungen konnten nicht geladen werden.",
    error: "Bestellungen konnten nicht geladen werden.",
    order: "Bestellung",
    status: "Status",
    total: "Gesamt",
    actions: "Aktionen",
    detail: "Details & Zahlung",
    detailPayment: "Details & Zahlung",
    remove: "Entfernen",
    removing: "Entferne…",
    removeTitle: "Aus Liste entfernen",
    removeFromList: "Aus Liste entfernen",
    confirmRemove: "Diese Bestellung wirklich aus der Liste entfernen?",
    removeError: "Bestellung konnte nicht entfernt werden.",
    empty: "Du hast keine Bestellungen.",
    noOrders: "Du hast keine Bestellungen."
  },
  products: {
    title: "Galerie",
    loading: "Lade…",
    noResults: "Keine Ergebnisse",
    noProducts: "Keine Produkte.",
    filterByCategory: "Nach Kategorie filtern",
    filterByArtist: "Nach Künstler filtern",
    filterByPrice: "Nach Preis filtern",
    priceMin: "Min. Preis",
    priceMax: "Max. Preis",
    currency: "Währung",
    czk: "CZK",
    eur: "EUR",
    inStock: "Auf Lager",
    outOfStock: "Nicht auf Lager",
    addToCart: "In den Warenkorb",
    viewDetail: "Details anzeigen",
    unknownAuthor: "Unbekannter Künstler",
    noImage: "kein Bild",
    filters: "Filter",
    artist: "Künstler",
    allArtists: "Alle Künstler",
    workTitle: "Werktitel",
    searchByTitle: "Nach Titel suchen...",
    priceFrom: "Preis ab",
    priceTo: "Preis bis",
    clearFilters: "Löschen",
    activeFilter: "aktiver Filter",
    activeFilters: "aktive Filter",
    activeFiltersMany: "aktive Filter",
    active: "Aktiv:"
  },
  checkout: {
    title: "Kasse",
    empty: "Warenkorb ist leer.",
    backToCatalog: "Zurück zum Katalog",
    loginRequired: "Bitte",
    loginLink: "anmelden",
    loginToComplete: "Melde dich an, um die Bestellung abzuschließen",
    items: "Artikel",
    subtotal: "Zwischensumme",
    discount: "Rabatt",
    total: "Gesamt zu zahlen",
    summary: "Zusammenfassung",
    couponCode: "Rabattcode",
    validate: "Überprüfen",
    validating: "Überprüfe…",
    verifyCoupon: "Überprüfen",
    paymentMethod: "Zahlungsmethode",
    paymentCurrency: "Zahlungswährung",
    paymentCard: "Karte online",
    paymentCod: "Bar / Nachnahme",
    paymentBank: "Überweisung",
    shipping: "Versand",
    shippingDelivery: "Lieferung",
    shippingPickup: "Abholung",
    delivery: "Versand",
    deliveryMethod: "Lieferung",
    note: "Hinweis (optional)",
    notePlaceholder: "Besondere Wünsche zur Lieferung, etc.",
    placeOrder: "Bestellung abschließen",
    completeOrder: "Bestellung abschließen",
    submitting: "Sende…",
    currency: "Zahlungswährung",
    currencyCzk: "CZK (Krone)",
    currencyEur: "EUR (Euro)",
    czk: "CZK (Tschechische Krone)",
    eur: "EUR (Euro)",
    currencyMixError: "Bestellung mit gemischten Währungen kann nicht erstellt werden",
    currencyMixErrorMsg: "Bestellung in EUR kann nicht erstellt werden: Einige Produkte haben keinen EUR-Preis. Bitte entferne Produkte ohne EUR-Preis oder ändere die Währung auf CZK.",
    productsWithoutEur: "Produkte ohne EUR-Preis:",
    currencyMixSolution: "Lösung: Entferne Produkte ohne EUR-Preis aus dem Warenkorb und erstelle eine separate Bestellung, oder ändere die Währung auf CZK.",
    createOrderError: "Bestellung konnte nicht erstellt werden:",
    unknownError: "Unbekannter Fehler",
    author: "Künstler:",
    couponInvalid: "Gutschein ist für diese Währung ungültig.",
    couponVerifyError: "Fehler beim Überprüfen des Gutscheins."
  },
  cart: {
    title: "Warenkorb",
    empty: "Warenkorb ist leer",
    items: "Artikel:",
    total: "Gesamt:",
    author: "Künstler:",
    unknownAuthor: "Unbekannter Künstler",
    remove: "Entfernen",
    continueShopping: "Weiter einkaufen",
    proceedToCheckout: "Zur Kasse gehen",
    clearCart: "Warenkorb leeren"
  },
  orderDetail: {
    back: "← Zurück",
    backToList: "← Zurück zur Liste",
    status: "Status:",
    orderNumber: "Bestellung #{id}",
    total: "Gesamt zu zahlen",
    quantity: "Menge:",
    unitPrice: "Preis/Stück:",
    paymentMethod: "Zahlung",
    delivery: "Versand",
    customerInfo: "Liefer- und Kontaktinformationen",
    name: "Vollständiger Name",
    email: "E-Mail",
    phone: "Telefon",
    street: "Straße und Hausnummer",
    city: "Stadt",
    zip: "Postleitzahl",
    address: "Adresse:",
    fillFromProfile: "Aus Profil ausfüllen",
    saving: "Speichere…",
    save: "Daten speichern",
    payment: "Zahlen",
    bankTransfer: "Überweisung / QR",
    bankTransferNote: "Nach Klick auf \"Per Überweisung zahlen\" wirst du zu einer Zusammenfassung mit QR-Code und gültigem VS weitergeleitet.",
    qrCode: "QR-Code",
    alreadyPaid: "Bestellung ist bereits bezahlt.",
    pendingPayment: "Bestellung wartet auf Zahlung.",
    codNote: "Zahlung bei Abholung.",
    loading: "Lade…",
    error: "Fehler beim Laden.",
    item: "Artikel",
    author: "Künstler",
    unknownAuthor: "Unbekannter Künstler"
  },
  orderPayment: {
    loading: "Lade…",
    errorLoadingPayment: "Zahlungsinformationen konnten nicht geladen werden.",
    errorLoadingOrder: "Bestellzusammenfassung konnte nicht geladen werden.",
    backToOrder: "← Zurück zur Bestellung",
    back: "← Zurück",
    status: "Status:",
    title: "Überweisungszahlungszusammenfassung",
    amount: "Betrag",
    variableSymbol: "VS",
    account: "Konto",
    currency: "Währung",
    qrPayment: "QR-Zahlung",
    statusPendingPayment: "Bestellstatus ist pending_payment. Nach Erhalt der Zahlung wird er auf paid geändert."
  },
  status: {
    draft: "Entwurf",
    pendingPayment: "Wartet auf Zahlung",
    pending_payment: "Wartet auf Zahlung",
    paid: "Bezahlt",
    shipped: "Versandt",
    canceled: "Storniert",
    expired: "Abgelaufen",
    sold: "Verkauft",
    reserved: "Reserviert"
  },
  common: {
    loading: "Lade…",
    error: "Fehler",
    save: "Speichern",
    cancel: "Abbrechen",
    delete: "Löschen",
    edit: "Bearbeiten",
    close: "Schließen",
    back: "Zurück",
    next: "Weiter",
    previous: "Zurück",
    page: "Seite",
    of: "von",
    yes: "Ja",
    no: "Nein",
    ok: "OK",
    search: "Suchen",
    filter: "Filtern",
    clear: "Löschen",
    apply: "Anwenden",
    reset: "Zurücksetzen",
    dark: "Dunkel",
    and: "und",
  },
  cookies: {
    title: "Cookie-Verwendung",
    description: "Diese Website verwendet Cookies, um die ordnungsgemäße Funktionalität sicherzustellen, den Datenverkehr zu analysieren und Inhalte zu personalisieren. Sie können wählen, welche Arten von Cookies Sie zulassen möchten.",
    necessary: {
      title: "Notwendige (technische) Cookies",
      description: "Erforderlich für grundlegende Website- und E-Shop-Funktionen (Warenkorb, Anmeldung, Seitenanzeige). Ohne diese Cookies kann die Website nicht ordnungsgemäß funktionieren."
    },
    preferences: {
      title: "Präferenz-Cookies",
      description: "Merken Sie sich Ihre Auswahl (Sprache, Einstellungen) und verbessern Sie den Benutzerkomfort."
    },
    analytics: {
      title: "Analytische / statistische Cookies",
      description: "Messen Sie den Website-Datenverkehr und erstellen Sie anonyme Statistiken zur Verbesserung der Inhalte."
    },
    marketing: {
      title: "Marketing-Cookies",
      description: "Werden für die Anzeige gezielter Werbung und die Messung des Erfolgs von Marketingkampagnen verwendet."
    },
    acceptAll: "Alle akzeptieren",
    rejectOptional: "Optionale ablehnen",
    save: "Auswahl speichern"
  },
  legal: {
    terms: {
      title: "Allgemeine Geschäftsbedingungen",
      content: `Allgemeine Geschäftsbedingungen Arte Moderno s.r.o.

Diese Allgemeinen Geschäftsbedingungen regeln die Beziehung zwischen Arte Moderno s.r.o. und Kunden beim Kauf von Kunstwerken über den Online-Shop unter https://kunstkabinett.cz.

1. Einleitende Bestimmungen

1.1. Der Betreiber des Online-Shops ist Arte Moderno s.r.o., ID: 24678821, mit Sitz in Podolská 103/126, 147 00 Prag 4 – Podolí, Tschechische Republik, Geschäftsräume / Galerie: Dominikánské náměstí 656/2, Jalta Palast, Brünn.

1.2. Kontaktdaten:
- E-Mail: info@kunstkabinett.cz
- Website: https://kunstkabinett.cz

2. Vertragsgegenstand

2.1. Gegenstand des Vertrags ist der Verkauf von Kunstwerken (Gemälde, Skulpturen, Grafiken und anderen Kunstobjekten) über den Online-Shop.

2.2. Alle Produkte werden mit Beschreibung, Preis und Verfügbarkeit angezeigt. Arte Moderno s.r.o. behält sich das Recht vor, Preise und Produktverfügbarkeit ohne vorherige Ankündigung zu ändern.

3. Abschluss des Kaufvertrags

3.1. Der Kaufvertrag wird im Moment der Bestätigung der Bestellung durch Arte Moderno s.r.o. geschlossen.

3.2. Arte Moderno s.r.o. behält sich das Recht vor, eine Bestellung ohne Angabe von Gründen abzulehnen.

4. Preis und Zahlung

4.1. Die Produktpreise sind einschließlich Mehrwertsteuer angegeben.

4.2. Die Zahlung kann per Banküberweisung, Kreditkarte oder Nachnahme erfolgen.

5. Lieferung

5.1. Arte Moderno s.r.o. stellt die Lieferung der Produkte innerhalb der vereinbarten Frist sicher.

5.2. Die Versandkosten werden bei der Bestellung angegeben.

6. Widerruf vom Vertrag

6.1. Der Kunde hat das Recht, innerhalb von 14 Tagen nach Erhalt der Ware vom Vertrag zurückzutreten.

6.2. Informationen zum Widerrufsrecht werden in einem separaten Dokument bereitgestellt.

7. Reklamationen

7.1. Der Kunde hat das Recht, mangelhafte Waren zu reklamieren.

7.2. Reklamationen werden an die Kontaktdaten von Arte Moderno s.r.o. übermittelt.

8. Schlussbestimmungen

8.1. Diese Allgemeinen Geschäftsbedingungen unterliegen der Rechtsordnung der Tschechischen Republik.

8.2. Arte Moderno s.r.o. behält sich das Recht vor, diese Bedingungen zu ändern. Die aktuelle Version wird immer auf der Website veröffentlicht.`
    },
    privacy: {
      title: "Datenschutzrichtlinie",
      content: `Datenschutzrichtlinie Arte Moderno s.r.o.

1. Verantwortlicher für die Datenverarbeitung

Der Verantwortliche für die Datenverarbeitung ist:
Arte Moderno s.r.o., ID: 24678821
Sitz: Podolská 103/126, 147 00 Prag 4 – Podolí, Tschechische Republik
Geschäftsräume / Galerie: Dominikánské náměstí 656/2, Jalta Palast, Brünn
E-Mail: info@kunstkabinett.cz

2. Umfang der verarbeiteten personenbezogenen Daten

Wir verarbeiten folgende personenbezogene Daten:
- Vor- und Nachname
- E-Mail-Adresse
- Telefonnummer
- Lieferadresse
- Zahlungsdaten (nur zur Zahlungsabwicklung)
- Bestelldaten

3. Zwecke der Verarbeitung

Wir verarbeiten personenbezogene Daten zu folgenden Zwecken:
- Erfüllung des Kaufvertrags
- Kommunikation mit dem Kunden
- Bestellabwicklung
- Zahlungsabwicklung
- Erfüllung gesetzlicher Verpflichtungen
- Marketingaktivitäten (nur mit Einwilligung)

4. Rechtsgrundlage für die Verarbeitung

- Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO)
- Berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO)
- Einwilligung (Art. 6 Abs. 1 lit. a DSGVO)
- Rechtliche Verpflichtung (Art. 6 Abs. 1 lit. c DSGVO)

5. Aufbewahrungsdauer

Wir speichern personenbezogene Daten für den Zeitraum, der zur Erfüllung der Verarbeitungszwecke erforderlich ist, jedoch nicht länger als die gesetzlich vorgeschriebene Frist.

6. Ihre Rechte

Sie haben das Recht:
- Auf Zugang zu personenbezogenen Daten
- Auf Berichtigung personenbezogener Daten
- Auf Löschung personenbezogener Daten
- Auf Einschränkung der Verarbeitung
- Auf Datenübertragbarkeit
- Widerspruch gegen die Verarbeitung einzulegen
- Die Einwilligung zur Verarbeitung zu widerrufen

7. Kontakt

Bei Fragen kontaktieren Sie uns unter: info@kunstkabinett.cz

8. Beschwerde einreichen

Sie haben das Recht, eine Beschwerde beim Amt für den Schutz personenbezogener Daten (www.uoou.cz) einzureichen.`
    },
    cookies: {
      title: "Cookie-Richtlinie",
      content: `Arte Moderno s.r.o. – www.kunstkabinett.cz

1. Wer Cookies verwendet

Der Verantwortliche für die Datenverarbeitung ist:

Arte Moderno s.r.o., ID: 24678821

Sitz: Podolská 103/126, 147 00 Prag 4 – Podolí, Tschechische Republik

Geschäftsräume / Galerie: Dominikánské náměstí 656/2, Jalta Palast, Brünn

E-Mail: info@kunstkabinett.cz

Diese Cookie-Richtlinie gilt für den Betrieb des Online-Shops und der Website unter https://kunstkabinett.cz.

2. Was sind Cookies

Cookies sind kleine Textdateien, die auf Ihrem Gerät (Computer, Tablet, Mobiltelefon) gespeichert werden, wenn Sie Websites besuchen. Sie ermöglichen die Erkennung Ihres Geräts, speichern einige Ihrer Einstellungen und helfen uns, die ordnungsgemäße Funktionalität der Website sicherzustellen, den Datenverkehr zu messen und unsere Dienste zu verbessern.

Cookies schädigen Ihr Gerät oder Ihre Software nicht und ermöglichen in den meisten Fällen keine Identifizierung einer bestimmten Person, sondern nur eines bestimmten Geräts.

3. Welche Cookies verwenden wir

Auf unserer Website verwenden wir diese grundlegenden Arten von Cookies:

3.1 Notwendige (technische) Cookies

Diese Cookies sind für grundlegende Website- und E-Shop-Funktionen erforderlich, zum Beispiel:

Speicherung des Warenkorbinhalts,
fortschreitendes Speichern der Bestellung,
Anzeige der Seite im richtigen Format und in der richtigen Sprache,
sicherer Login zum Benutzerkonto (falls verfügbar).

Ohne diese Cookies können die Website und der E-Shop nicht ordnungsgemäß funktionieren. Die Verarbeitung basiert auf unserem berechtigten Interesse an der Gewährleistung der Funktionalität der Website.

3.2 Präferenz-Cookies

Sie helfen, Ihre Auswahl (z. B. Sprache, vorherige Einstellungen) zu speichern und verbessern Ihren Benutzerkomfort. Wir verwenden diese Cookies nur, wenn Sie uns Ihre Einwilligung erteilen.

3.3 Analytische / statistische Cookies

Sie dienen der Messung des Website-Datenverkehrs und der Erstellung anonymer Statistiken über die Nutzung der Website (z. B. welche Seiten am häufigsten besucht werden, aus welchen Quellen Besucher kommen). Wir verwenden diese Informationen zur Verbesserung der Inhalte und der Benutzerumgebung. Wir verwenden analytische Cookies nur auf der Grundlage Ihrer Einwilligung.

Wir können Dienste Dritter (typischerweise Web-Analyse-Tools) verwenden. An diese Anbieter werden nur solche Daten übermittelt, die für Ihre direkte Identifizierung nicht erforderlich sind.

3.4 Marketing-Cookies

Sie werden für die Anzeige gezielter Werbung, die Erinnerung an angesehene Produkte oder die Messung des Erfolgs von Marketingkampagnen verwendet. Wir verwenden diese Art von Cookies nur, wenn Sie uns Ihre Einwilligung über die Cookie-Leiste oder die Browsereinstellungen erteilen.

4. Rechtsgrundlage für die Verarbeitung

Für notwendige (technische) Cookies ist die Rechtsgrundlage unser berechtigtes Interesse an der Gewährleistung der Funktionalität und Sicherheit der Website und der Bereitstellung von Diensten, an denen Sie interessiert sind (Abschluss und Erfüllung des Kaufvertrags).

Für Präferenz-, analytische und Marketing-Cookies ist die Rechtsgrundlage Ihre Einwilligung. Sie können die Einwilligung jederzeit widerrufen – siehe Artikel 5 unten.

5. Cookie-Einstellungen und Widerruf der Einwilligung

Bei Ihrem ersten Besuch auf unserer Website wird eine Informationsleiste angezeigt, in der Sie:

alle Cookies zulassen,
optionale Cookies ablehnen,
oder bestimmte Arten von Cookies auswählen können, denen Sie zustimmen.

Sie können die Einwilligung zur Verwendung von Cookies jederzeit ändern oder widerrufen, indem Sie die Einstellungen Ihres Internetbrowsers anpassen. Die meisten Browser ermöglichen:

Deaktivierung der Cookie-Speicherung,
Einschränkung auf bestimmte Arten,
Löschen bereits gespeicherter Cookies.

Die spezifische Vorgehensweise finden Sie in der Hilfe Ihres Browsers (z. B. im Abschnitt "Sicherheit und Datenschutz" oder "Cookies").

Wir weisen darauf hin, dass das Blockieren oder Löschen einiger Cookies (insbesondere notwendiger) die Funktionalität unserer Website und unseres E-Shops einschränken kann, z. B. wird es nicht möglich sein, eine Bestellung abzuschließen.

6. Aufbewahrungsdauer von Cookies

Die Aufbewahrungsdauer von Cookies variiert je nach Typ:

Sitzungs-Cookies – werden nur für die Dauer der Sitzung (Website-Besuch) gespeichert und nach dem Schließen des Browsers gelöscht.

Persistente Cookies – bleiben auf Ihrem Gerät für den in ihren Einstellungen angegebenen Zeitraum oder bis zur manuellen Löschung im Browser.

Die spezifischen Aufbewahrungsdauern können je nach Einstellungen einzelner Tools und Anbieter variieren.

7. Cookies von Drittanbietern

Auf unserer Website können auch Cookies von Drittanbietern verwendet werden, insbesondere:

Zahlungsdienstleister (z. B. Comgate) – zur Online-Zahlungsabwicklung,
Transport- und Logistikdienstleister (z. B. Zásilkovna) – im Zusammenhang mit der Paketzustellung,
Anbieter von Analyse- und Marketing-Tools – für Verkehrsstatistiken und mögliches Remarketing.

Diese Unternehmen haben ihre eigenen Datenschutz- und Cookie-Richtlinien, die Sie auf ihren Websites einsehen können.

8. Zusammenhang mit dem Schutz personenbezogener Daten (DSGVO)

Über Cookies erhaltene Informationen können in bestimmten Fällen personenbezogene Daten darstellen. In solchen Fällen behandeln wir sie in Übereinstimmung mit unserer Datenschutzrichtlinie (DSGVO), die im Detail regelt:

den Umfang der verarbeiteten personenbezogenen Daten,
die Zwecke und Rechtsgrundlagen der Verarbeitung,
die Aufbewahrungsdauer,
Ihre Rechte (Zugang, Berichtigung, Löschung, Einschränkung, Übertragbarkeit, Widerspruch),
Möglichkeiten zur Einreichung einer Beschwerde beim Amt für den Schutz personenbezogener Daten.

Wir empfehlen, sich mit diesen Richtlinien vertraut zu machen; sie sind auf unserer Website verfügbar.

9. Kontaktdaten für Anfragen

Bei Fragen zu Cookies oder der Verarbeitung personenbezogener Daten können Sie uns kontaktieren:

per E-Mail: info@kunstkabinett.cz

per Post an die Adresse des Sitzes: Arte Moderno s.r.o., Podolská 103/126, 147 00 Prag 4 – Podolí

10. Aktualisierungen der Cookie-Richtlinie

Diese Richtlinie kann von Zeit zu Zeit aktualisiert werden, insbesondere im Zusammenhang mit Änderungen der Gesetzgebung, technischen Lösungen oder Diensten, die wir auf der Website verwenden.

Die aktuelle Version wird immer auf unserer Website veröffentlicht.`
    }
  },
  home: {
    badge: "Kuratorenauswahl",
    title: "Die September-Kollektion",
    subtitle: "Entdecken Sie zeitgenössische Werke aufstrebender Künstler. Sofortiger Checkout, sichere Lieferung.",
    ctaProducts: "Produkte ansehen",
    ctaBlog: "Blog lesen",
    caption: "{badge} · 2025",
    originals: "Originale",
    selectionForYou: "Auswahl für Sie:",
    all: "Alle",
    allArtists: "Alle Künstler",
    discoverArt: "Kunst entdecken",
    results: "Ergebnisse",
    curated: "kuratiert",
    sort: "Sortieren:",
    trending: "Trending",
    loading: "Lädt…",
    errorLoading: "Galerie konnte nicht geladen werden.",
    noImage: "kein Bild",
    detail: "Detail",
    buy: "Kaufen",
    artistSpotlight: "Künstler im Rampenlicht",
    openWork: "Werk öffnen",
    followArtist: "Künstler folgen",
    exploreWorks: "Werke erkunden",
    artInsights: "Kunsteinblicke"
  }
});

// Pro ostatní jazyky použij extendDict - automaticky použije EN jako základ
// Přidáme pouze překlady, které jsou jiné než EN
const ru = extendDict(en, {
  brand: { name: "Kunstkabinett" },
  nav: { home: "Главная", discover: "Обзор", artists: "Художники", blog: "Блог", about: "О нас", contact: "Контакты", login: "Войти", account: "Мой аккаунт", logout: "Выйти", cart: "Корзина" },
  contact: {
    title: "Контакты",
    subtitle: "Мы здесь для вас. Свяжитесь с нами в любое время.",
    contactInfo: "Контактная информация",
    name: "Имя",
    phone: "Телефон",
    address: "Адрес",
    location: "Местоположение",
    mapTitle: "Карта - Дворец Ялта, Брно",
    sendMessage: "Отправьте нам сообщение",
    formName: "Имя",
    formEmail: "Email",
    formSubject: "Тема",
    formMessage: "Сообщение",
    send: "Отправить",
    sending: "Отправка...",
    success: "Ваше сообщение успешно отправлено. Спасибо!",
    error: "Не удалось отправить сообщение. Пожалуйста, попробуйте позже.",
    nameRequired: "Имя обязательно",
    emailRequired: "Email обязателен",
    subjectRequired: "Тема обязательна",
    messageRequired: "Сообщение обязательно"
  },
  footer: { terms: "Условия", privacy: "Конфиденциальность", support: "Поддержка", cookies: "ПОЛИТИКА COOKIES", cookieSettings: "Настройки cookies" },
  account: {
    title: "Мой профиль",
    myOrders: "Мои заказы",
    storedDataTitle: "Сохраненные данные",
    stored: "Сохранено",
    basicInfo: "Основная информация",
    name: "Полное имя",
    email: "Электронная почта",
    phone: "Телефон",
    phoneNote: "Телефон используется только для доставки.",
    billingAddress: "Платёжный адрес",
    street: "Улица и номер",
    city: "Город",
    zip: "Почтовый индекс",
    country: "Страна",
    shippingAddress: "Адрес доставки",
    sameAsBilling: "Такой же, как платёжный адрес",
    saveForNext: "Сохранить эту информацию для следующей покупки",
    saveProfile: "Сохранить профиль",
    save: "Сохранить профиль",
    saving: "Сохранение…",
    clearProfile: "Очистить данные профиля",
    clear: "Очистить данные профиля"
  },
  orders: {
    title: "Мои заказы",
    loading: "Загрузка…",
    errorLoading: "Не удалось загрузить заказы.",
    error: "Не удалось загрузить заказы.",
    order: "Заказ",
    status: "Статус",
    total: "Итого",
    actions: "Действия",
    detail: "Детали и оплата",
    detailPayment: "Детали и оплата",
    remove: "Удалить",
    removing: "Удаление…",
    removeTitle: "Удалить из списка",
    removeFromList: "Удалить из списка",
    confirmRemove: "Действительно удалить этот заказ из списка?",
    removeError: "Не удалось удалить заказ.",
    empty: "У вас нет заказов.",
    noOrders: "У вас нет заказов."
  },
  products: {
    title: "Галерея",
    loading: "Загрузка…",
    noResults: "Нет результатов",
    noProducts: "Нет товаров.",
    filterByCategory: "Фильтровать по категории",
    filterByArtist: "Фильтровать по художнику",
    filterByPrice: "Фильтровать по цене",
    priceMin: "Мин. цена",
    priceMax: "Макс. цена",
    currency: "Валюта",
    czk: "CZK",
    eur: "EUR",
    inStock: "В наличии",
    outOfStock: "Нет в наличии",
    addToCart: "Добавить в корзину",
    viewDetail: "Показать детали",
    unknownAuthor: "Неизвестный художник",
    noImage: "нет изображения",
    filters: "Фильтры",
    artist: "Художник",
    allArtists: "Все художники",
    workTitle: "Название произведения",
    searchByTitle: "Искать по названию...",
    priceFrom: "Цена от",
    priceTo: "Цена до",
    clearFilters: "Очистить",
    activeFilter: "активный фильтр",
    activeFilters: "активные фильтры",
    activeFiltersMany: "активных фильтров",
    active: "Активные:"
  },
  checkout: {
    title: "Оформление заказа",
    empty: "Корзина пуста.",
    backToCatalog: "Вернуться в каталог",
    loginRequired: "Пожалуйста",
    loginLink: "войдите",
    loginToComplete: "Войдите, чтобы завершить заказ",
    items: "Товары",
    subtotal: "Промежуточный итог",
    discount: "Скидка",
    total: "Итого к оплате",
    summary: "Итого",
    couponCode: "Код скидки",
    validate: "Проверить",
    validating: "Проверка…",
    verifyCoupon: "Проверить",
    paymentMethod: "Способ оплаты",
    paymentCurrency: "Валюта оплаты",
    paymentCard: "Карта онлайн",
    paymentCod: "Наличные / Наложенный платёж",
    paymentBank: "Банковский перевод",
    shipping: "Доставка",
    shippingDelivery: "Доставка",
    shippingPickup: "Самовывоз",
    delivery: "Доставка",
    deliveryMethod: "Доставка",
    note: "Примечание (необязательно)",
    notePlaceholder: "Особые пожелания к доставке и т.д.",
    placeOrder: "Завершить заказ",
    completeOrder: "Завершить заказ",
    submitting: "Отправка…",
    currency: "Валюта оплаты",
    currencyCzk: "CZK (Крона)",
    currencyEur: "EUR (Евро)",
    czk: "CZK (Чешская крона)",
    eur: "EUR (Евро)",
    currencyMixError: "Невозможно создать заказ со смешанными валютами",
    currencyMixErrorMsg: "Невозможно создать заказ в EUR: некоторые товары не имеют цены в EUR. Пожалуйста, удалите товары без цены в EUR или измените валюту на CZK.",
    productsWithoutEur: "Товары без цены в EUR:",
    currencyMixSolution: "Решение: Удалите товары без цены в EUR из корзины и создайте отдельный заказ, или измените валюту на CZK.",
    createOrderError: "Не удалось создать заказ:",
    unknownError: "Неизвестная ошибка",
    author: "Художник:",
    couponInvalid: "Купон недействителен для этой валюты.",
    couponVerifyError: "Ошибка при проверке купона."
  },
  cart: {
    title: "Корзина",
    empty: "Корзина пуста",
    items: "Товары:",
    total: "Итого:",
    author: "Художник:",
    unknownAuthor: "Неизвестный художник",
    remove: "Удалить",
    continueShopping: "Продолжить покупки",
    proceedToCheckout: "Перейти к оформлению",
    clearCart: "Очистить корзину"
  },
  orderDetail: {
    back: "← Назад",
    backToList: "← Назад к списку",
    status: "Статус:",
    orderNumber: "Заказ #{id}",
    total: "Итого к оплате",
    quantity: "Кол-во:",
    unitPrice: "Цена/шт.:",
    paymentMethod: "Оплата",
    delivery: "Доставка",
    customerInfo: "Информация о доставке и контактах",
    name: "Полное имя",
    email: "Электронная почта",
    phone: "Телефон",
    street: "Улица и номер",
    city: "Город",
    zip: "Почтовый индекс",
    address: "Адрес:",
    fillFromProfile: "Заполнить из профиля",
    saving: "Сохранение…",
    save: "Сохранить данные",
    payment: "Оплатить",
    bankTransfer: "Банковский перевод / QR",
    bankTransferNote: "После нажатия \"Оплатить переводом\" вы будете перенаправлены на сводку с QR-кодом и действительным VS.",
    qrCode: "QR-код",
    alreadyPaid: "Заказ уже оплачен.",
    pendingPayment: "Заказ ожидает оплаты.",
    codNote: "Оплата при получении.",
    loading: "Загрузка…",
    error: "Ошибка при загрузке.",
    item: "товар",
    author: "Художник",
    unknownAuthor: "Неизвестный художник"
  },
  orderPayment: {
    loading: "Загрузка…",
    errorLoadingPayment: "Не удалось загрузить информацию об оплате.",
    errorLoadingOrder: "Не удалось загрузить сводку заказа.",
    backToOrder: "← Назад к заказу",
    back: "← Назад",
    status: "Статус:",
    title: "Сводка платежа банковским переводом",
    amount: "Сумма",
    variableSymbol: "VS",
    account: "Счёт",
    currency: "Валюта",
    qrPayment: "QR-платёж",
    statusPendingPayment: "Статус заказа pending_payment. После получения платежа он будет изменён на paid."
  },
  status: {
    draft: "Черновик",
    pendingPayment: "Ожидает оплаты",
    pending_payment: "Ожидает оплаты",
    paid: "Оплачено",
    shipped: "Отправлено",
    canceled: "Отменено",
    expired: "Истекло",
    sold: "Продано",
    reserved: "Зарезервировано"
  },
  common: {
    loading: "Загрузка…",
    error: "Ошибка",
    save: "Сохранить",
    cancel: "Отмена",
    delete: "Удалить",
    edit: "Редактировать",
    close: "Закрыть",
    back: "Назад",
    next: "Далее",
    previous: "Предыдущий",
    page: "Страница",
    of: "из",
    yes: "Да",
    no: "Нет",
    ok: "OK",
    search: "Поиск",
    filter: "Фильтр",
    clear: "Очистить",
    apply: "Применить",
    reset: "Сбросить",
    dark: "Тёмный",
    and: "и",
  },
  cookies: {
    title: "Использование cookies",
    description: "Этот веб-сайт использует cookies для обеспечения правильной функциональности, анализа трафика и персонализации контента. Вы можете выбрать, какие типы cookies вы хотите разрешить.",
    necessary: {
      title: "Необходимые (технические) cookies",
      description: "Требуются для основных функций веб-сайта и интернет-магазина (корзина, вход, отображение страницы). Без этих cookies веб-сайт не может работать должным образом."
    },
    preferences: {
      title: "Cookies предпочтений",
      description: "Запоминают ваш выбор (язык, настройки) и улучшают ваш пользовательский комфорт."
    },
    analytics: {
      title: "Аналитические / статистические cookies",
      description: "Измеряют трафик веб-сайта и создают анонимную статистику для улучшения контента."
    },
    marketing: {
      title: "Маркетинговые cookies",
      description: "Используются для отображения целевой рекламы и измерения успеха маркетинговых кампаний."
    },
    acceptAll: "Принять все",
    rejectOptional: "Отклонить необязательные",
    save: "Сохранить выбор"
  },
  legal: {
    terms: {
      title: "Условия использования",
      content: `Условия использования Arte Moderno s.r.o.

Эти условия использования регулируют отношения между Arte Moderno s.r.o. и клиентами при покупке произведений искусства через интернет-магазин по адресу https://kunstkabinett.cz.

1. Вводные положения

1.1. Оператором интернет-магазина является Arte Moderno s.r.o., ID: 24678821, с зарегистрированным офисом по адресу Podolská 103/126, 147 00 Прага 4 – Подоли, Чешская Республика, коммерческие помещения / галерея: Dominikánské náměstí 656/2, Дворец Ялта, Брно.

1.2. Контактные данные:
- Электронная почта: info@kunstkabinett.cz
- Веб-сайт: https://kunstkabinett.cz

2. Предмет договора

2.1. Предметом договора является продажа произведений искусства (картин, скульптур, графики и других предметов искусства) через интернет-магазин.

2.2. Все продукты отображаются с описанием, ценой и наличием. Arte Moderno s.r.o. оставляет за собой право изменять цены и наличие продуктов без предварительного уведомления.

3. Заключение договора купли-продажи

3.1. Договор купли-продажи заключается в момент подтверждения заказа Arte Moderno s.r.o.

3.2. Arte Moderno s.r.o. оставляет за собой право отказать в заказе без указания причин.

4. Цена и оплата

4.1. Цены на продукты указаны включая НДС.

4.2. Оплата может быть произведена банковским переводом, кредитной картой или наложенным платежом.

5. Доставка

5.1. Arte Moderno s.r.o. обеспечит доставку продуктов в согласованные сроки.

5.2. Стоимость доставки указывается при заказе.

6. Отказ от договора

6.1. Клиент имеет право отказаться от договора в течение 14 дней с момента получения товара.

6.2. Информация о праве на отказ предоставляется в отдельном документе.

7. Рекламации

7.1. Клиент имеет право подать рекламацию на дефектный товар.

7.2. Рекламации подаются по контактным данным Arte Moderno s.r.o.

8. Заключительные положения

8.1. Эти условия использования регулируются правовым порядком Чешской Республики.

8.2. Arte Moderno s.r.o. оставляет за собой право изменять эти условия. Текущая версия всегда публикуется на веб-сайте.`
    },
    privacy: {
      title: "Политика конфиденциальности",
      content: `Политика конфиденциальности Arte Moderno s.r.o.

1. Контроллер данных

Контроллер данных:
Arte Moderno s.r.o., ID: 24678821
зарегистрированный офис: Podolská 103/126, 147 00 Прага 4 – Подоли, Чешская Республика
коммерческие помещения / галерея: Dominikánské náměstí 656/2, Дворец Ялта, Брно
электронная почта: info@kunstkabinett.cz

2. Объем обрабатываемых персональных данных

Мы обрабатываем следующие персональные данные:
- Имя и фамилия
- Адрес электронной почты
- Номер телефона
- Адрес доставки
- Платежные данные (только для обработки платежей)
- Данные заказа

3. Цели обработки

Мы обрабатываем персональные данные для целей:
- Выполнения договора купли-продажи
- Общения с клиентом
- Обработки заказов
- Обработки платежей
- Выполнения правовых обязательств
- Маркетинговых мероприятий (только с согласия)

4. Правовая основа обработки

- Выполнение договора (ст. 6(1)(b) GDPR)
- Законный интерес (ст. 6(1)(f) GDPR)
- Согласие (ст. 6(1)(a) GDPR)
- Правовое обязательство (ст. 6(1)(c) GDPR)

5. Срок хранения

Мы храним персональные данные в течение периода, необходимого для выполнения целей обработки, но не дольше периода, установленного законом.

6. Ваши права

Вы имеете право:
- На доступ к персональным данным
- На исправление персональных данных
- На удаление персональных данных
- На ограничение обработки
- На переносимость данных
- Возразить против обработки
- Отозвать согласие на обработку

7. Контакт

По вопросам обращайтесь к нам: info@kunstkabinett.cz

8. Подача жалобы

Вы имеете право подать жалобу в Управление по защите персональных данных (www.uoou.cz).`
    },
    cookies: {
      title: "Политика cookies",
      content: `Arte Moderno s.r.o. – www.kunstkabinett.cz

1. Кто использует cookies

Контроллер данных:

Arte Moderno s.r.o., ID: 24678821

зарегистрированный офис: Podolská 103/126, 147 00 Прага 4 – Подоли, Чешская Республика

коммерческие помещения / галерея: Dominikánské náměstí 656/2, Дворец Ялта, Брно

электронная почта: info@kunstkabinett.cz

Эта политика cookies применяется к работе интернет-магазина и веб-сайта по адресу https://kunstkabinett.cz.

2. Что такое cookies

Cookies — это небольшие текстовые файлы, которые сохраняются на вашем устройстве (компьютер, планшет, мобильный телефон) при посещении веб-сайтов. Они позволяют распознавать ваше устройство, запоминать некоторые ваши настройки и помогают нам обеспечивать правильную функциональность веб-сайта, измерять трафик и улучшать наши услуги.

Cookies не наносят вреда вашему устройству или программному обеспечению и в большинстве случаев не позволяют идентифицировать конкретное лицо, а только конкретное устройство.

3. Какие cookies мы используем

На нашем веб-сайте мы используем следующие основные типы cookies:

3.1 Необходимые (технические) cookies

Эти cookies необходимы для основных функций веб-сайта и интернет-магазина, например:

хранение содержимого корзины покупок,
постепенное сохранение заказа,
отображение страницы в правильном формате и языке,
безопасный вход в учетную запись пользователя (если доступно).

Без этих cookies веб-сайт и интернет-магазин не могут работать должным образом. Обработка основана на нашем законном интересе в обеспечении функциональности веб-сайта.

3.2 Cookies предпочтений

Они помогают запомнить ваш выбор (например, язык, предыдущие настройки) и улучшают ваш пользовательский комфорт. Мы используем эти cookies только если вы даете нам согласие.

3.3 Аналитические / статистические cookies

Они служат для измерения трафика веб-сайта и создания анонимной статистики об использовании веб-сайта (например, какие страницы наиболее посещаемы, из каких источников приходят посетители). Мы используем эту информацию для улучшения контента и пользовательской среды. Мы используем аналитические cookies только на основе вашего согласия.

Мы можем использовать услуги третьих сторон (обычно инструменты веб-аналитики). Этим поставщикам передаются только такие данные, которые не необходимы для вашей прямой идентификации.

3.4 Маркетинговые cookies

Они используются для отображения целевой рекламы, напоминания о просмотренных продуктах или измерения успеха маркетинговых кампаний. Мы используем этот тип cookies только если вы даете нам согласие через панель cookies или настройки браузера.

4. Правовая основа обработки

Для необходимых (технических) cookies правовой основой является наш законный интерес в обеспечении функциональности и безопасности веб-сайта и предоставлении услуг, которые вас интересуют (заключение и выполнение договора купли-продажи).

Для cookies предпочтений, аналитических и маркетинговых cookies правовой основой является ваше согласие. Вы можете отозвать согласие в любое время – см. статью 5 ниже.

5. Настройки cookies и отзыв согласия

При первом посещении нашего веб-сайта будет отображаться информационная панель, где вы можете:

разрешить все cookies,
отклонить необязательные cookies,
или выбрать конкретные типы cookies, с которыми вы согласны.

Вы можете изменить или отозвать согласие на использование cookies в любое время, изменив настройки вашего интернет-браузера. Большинство браузеров позволяют:

отключить хранение cookies,
ограничить их определенными типами,
удалить уже сохраненные cookies.

Конкретную процедуру вы можете найти в справке вашего браузера (например, в разделе "Безопасность и конфиденциальность" или "Cookies").

Мы отмечаем, что блокировка или удаление некоторых cookies (особенно необходимых) может ограничить функциональность нашего веб-сайта и интернет-магазина, например, не будет возможности завершить заказ.

6. Срок хранения cookies

Срок хранения cookies варьируется в зависимости от их типа:

Сессионные cookies — сохраняются только на время сессии (посещения веб-сайта) и удаляются после закрытия браузера.

Постоянные cookies — остаются на вашем устройстве в течение периода, указанного в их настройках, или до ручного удаления в браузере.

Конкретные сроки хранения могут варьироваться в зависимости от настроек отдельных инструментов и поставщиков.

7. Cookies третьих сторон

На нашем веб-сайте также могут использоваться cookies третьих сторон, в частности:

поставщики платежных услуг (например, Comgate) — для обработки онлайн-платежей,
поставщики транспортных и логистических услуг (например, Zásilkovna) — в связи с доставкой посылок,
поставщики аналитических и маркетинговых инструментов — для статистики трафика и возможного ремаркетинга.

Эти субъекты имеют свои собственные политики конфиденциальности и cookies, с которыми вы можете ознакомиться на их веб-сайтах.

8. Связь с защитой персональных данных (GDPR)

Информация, полученная через cookies, в некоторых случаях может представлять персональные данные. В таких случаях мы обрабатываем их в соответствии с нашей Политикой конфиденциальности (GDPR), которая подробно регулирует:

объем обрабатываемых персональных данных,
цели и правовые основы обработки,
срок хранения,
ваши права (доступ, исправление, удаление, ограничение, переносимость, возражение),
возможности подачи жалобы в Управление по защите персональных данных.

Мы рекомендуем ознакомиться с этими политиками; они доступны на нашем веб-сайте.

9. Контактные данные для запросов

По вопросам, касающимся cookies или обработки персональных данных, вы можете связаться с нами:

по электронной почте: info@kunstkabinett.cz

по почте на адрес зарегистрированного офиса: Arte Moderno s.r.o., Podolská 103/126, 147 00 Прага 4 – Подоли

10. Обновления политики cookies

Эта политика может время от времени обновляться, особенно в связи с изменениями в законодательстве, технических решениях или услугах, которые мы используем на веб-сайте.

Текущая версия всегда публикуется на нашем веб-сайте.`
    }
  },
  login: {
    title: "Вход в аккаунт",
    subtitle: "Продолжайте исследовать современное искусство. Введите свои данные и войдите.",
    email: "Электронная почта",
    password: "Пароль",
    forgotPassword: "Забыли пароль?",
    noAccount: "Нет аккаунта? Зарегистрироваться",
    submit: "Войти",
    submitting: "Вход…",
    error: "Вход не удался.",
    exploreWorks: "Исследовать произведения",
    howItWorks: "Как это работает",
    welcomeBack: "Добро пожаловать"
  },
  register: {
    title: "Создать аккаунт",
    subtitle: "Зарегистрируйтесь и сохраните корзину, заказы и избранные произведения.",
    name: "Полное имя",
    email: "Электронная почта",
    password: "Пароль",
    password2: "Пароль еще раз",
    passwordMin: "мин. 8 символов",
    passwordVerify: "подтверждение пароля",
    agree: "Я согласен с",
    terms: "условиями",
    privacy: "политикой конфиденциальности",
    submit: "Создать аккаунт",
    submitting: "Создание аккаунта…",
    hasAccount: "Уже есть аккаунт?",
    loginLink: "Войти",
    browseWorks: "Просмотреть произведения",
    alreadyHaveAccount: "У меня уже есть аккаунт",
    createAccount: "Создать аккаунт",
    nameRequired: "Пожалуйста, введите имя.",
    emailRequired: "Пожалуйста, введите электронную почту.",
    passwordMinLength: "Пароль должен содержать не менее 8 символов.",
    passwordMismatch: "Пароли не совпадают.",
    agreeRequired: "Вы должны согласиться с условиями, чтобы создать аккаунт.",
    error: "Регистрация не удалась.",
    notAvailable: "Регистрация недоступна на сервере (404). Установите VITE_REGISTER_PATH."
  },
  resetPassword: {
    resetPassword: "Сброс пароля",
    title: "Сброс пароля",
    subtitle: "Установите новый пароль для вашей учетной записи. Ссылка в электронном письме ограничена по времени.",
    requestSubtitle: "Введите свой e-mail, и мы отправим вам ссылку для сброса пароля. Ссылка действительна 30 минут.",
    email: "Электронная почта",
    emailRequired: "Пожалуйста, введите ваш e-mail.",
    emailSent: "Если этот e-mail существует в системе, вам была отправлена ссылка для сброса пароля.",
    sendEmail: "Отправить ссылку",
    sending: "Отправка…",
    requestError: "Не удалось отправить ссылку для сброса пароля.",
    newPassword: "Новый пароль",
    confirmPassword: "Подтвердите пароль",
    show: "Показать",
    hide: "Скрыть",
    submit: "Установить новый пароль",
    saving: "Сохранение…",
    backToLogin: "Вернуться к входу",
    missingToken: "Отсутствует или недействительный токен сброса в URL.",
    fillBoth: "Пожалуйста, заполните оба поля пароля.",
    passwordMismatch: "Пароли не совпадают.",
    passwordMinLength: "Пароль должен содержать не менее 8 символов.",
    success: "Пароль успешно изменен. Теперь вы можете войти.",
    error: "Не удалось установить новый пароль.",
    notAvailable: "Сброс пароля недоступен.",
    connectionError: "Ошибка соединения. Пожалуйста, попробуйте снова."
  },
  home: {
    badge: "Выбор куратора",
    title: "Сентябрьская коллекция",
    subtitle: "Откройте современные работы молодых художников. Мгновенная оплата, безопасная доставка.",
    ctaProducts: "Смотреть товары",
    ctaBlog: "Читать блог",
    originals: "Оригиналы",
    selectionForYou: "Подборка для вас:",
    all: "Все",
    allArtists: "Все художники",
    discoverArt: "Открыть искусство",
    results: "результатов",
    curated: "курируется",
    sort: "Сортировать:",
    trending: "В тренде",
    loading: "Загрузка…",
    errorLoading: "Не удалось загрузить галерею.",
    noImage: "нет изображения",
    detail: "Детали",
    buy: "Купить",
    artistSpotlight: "Художник в центре внимания",
    openWork: "Открыть работу",
    followArtist: "Следовать за художником",
    exploreWorks: "Исследовать работы",
    artInsights: "Искусство инсайты"
  }
});

const zh = extendDict(en, {
  brand: { name: "Kunstkabinett" },
  nav: { home: "首页", discover: "发现", artists: "艺术家", blog: "博客", about: "关于我们", contact: "联系", login: "登录", account: "我的账户", logout: "退出", cart: "购物车" },
  contact: {
    title: "联系",
    subtitle: "我们随时为您服务。随时联系我们。",
    contactInfo: "联系信息",
    name: "姓名",
    phone: "电话",
    address: "地址",
    location: "位置",
    mapTitle: "地图 - 雅尔塔宫, 布尔诺",
    sendMessage: "给我们发消息",
    formName: "姓名",
    formEmail: "电子邮件",
    formSubject: "主题",
    formMessage: "消息",
    send: "发送",
    sending: "发送中...",
    success: "您的消息已成功发送。谢谢！",
    error: "发送消息失败。请稍后再试。",
    nameRequired: "姓名是必填项",
    emailRequired: "电子邮件是必填项",
    subjectRequired: "主题是必填项",
    messageRequired: "消息是必填项"
  },
  footer: { terms: "条款", privacy: "隐私", support: "支持", cookies: "Cookie政策", cookieSettings: "Cookie设置" },
  account: {
    title: "我的资料",
    myOrders: "我的订单",
    storedDataTitle: "已保存信息",
    stored: "已保存",
    basicInfo: "基本信息",
    name: "全名",
    email: "电子邮件",
    phone: "电话",
    phoneNote: "电话仅用于送货。",
    billingAddress: "账单地址",
    street: "街道和门牌号",
    city: "城市",
    zip: "邮政编码",
    country: "国家",
    shippingAddress: "送货地址",
    sameAsBilling: "与账单地址相同",
    saveForNext: "保存此信息以供下次购买",
    saveProfile: "保存资料",
    save: "保存资料",
    saving: "保存中…",
    clearProfile: "清除资料数据",
    clear: "清除资料数据"
  },
  orders: {
    title: "我的订单",
    loading: "加载中…",
    errorLoading: "无法加载订单。",
    error: "无法加载订单。",
    order: "订单",
    status: "状态",
    total: "总计",
    actions: "操作",
    detail: "详情和付款",
    detailPayment: "详情和付款",
    remove: "删除",
    removing: "删除中…",
    removeTitle: "从列表中删除",
    removeFromList: "从列表中删除",
    confirmRemove: "确定要从列表中删除此订单吗？",
    removeError: "无法删除订单。",
    empty: "您没有订单。",
    noOrders: "您没有订单。"
  },
  products: {
    title: "画廊",
    loading: "加载中…",
    noResults: "无结果",
    noProducts: "无产品。",
    filterByCategory: "按类别筛选",
    filterByArtist: "按艺术家筛选",
    filterByPrice: "按价格筛选",
    priceMin: "最低价格",
    priceMax: "最高价格",
    currency: "货币",
    czk: "CZK",
    eur: "EUR",
    inStock: "有库存",
    outOfStock: "缺货",
    addToCart: "添加到购物车",
    viewDetail: "查看详情",
    unknownAuthor: "未知艺术家",
    noImage: "无图片",
    filters: "筛选",
    artist: "艺术家",
    allArtists: "所有艺术家",
    workTitle: "作品标题",
    searchByTitle: "按标题搜索...",
    priceFrom: "价格从",
    priceTo: "价格到",
    clearFilters: "清除",
    activeFilter: "活动筛选",
    activeFilters: "活动筛选",
    activeFiltersMany: "活动筛选",
    active: "活动："
  },
  checkout: {
    title: "结账",
    empty: "购物车为空。",
    backToCatalog: "返回目录",
    loginRequired: "请",
    loginLink: "登录",
    loginToComplete: "登录以完成订单",
    items: "商品",
    subtotal: "小计",
    discount: "折扣",
    total: "应付总额",
    summary: "总计",
    couponCode: "折扣代码",
    validate: "验证",
    validating: "验证中…",
    verifyCoupon: "验证",
    paymentMethod: "付款方式",
    paymentCurrency: "付款货币",
    paymentCard: "在线卡",
    paymentCod: "现金/货到付款",
    paymentBank: "银行转账",
    shipping: "配送",
    shippingDelivery: "送货",
    shippingPickup: "自提",
    delivery: "配送",
    deliveryMethod: "送货",
    note: "备注（可选）",
    notePlaceholder: "特殊配送要求等",
    placeOrder: "完成订单",
    completeOrder: "完成订单",
    submitting: "提交中…",
    currency: "付款货币",
    currencyCzk: "CZK（克朗）",
    currencyEur: "EUR（欧元）",
    czk: "CZK（捷克克朗）",
    eur: "EUR（欧元）",
    currencyMixError: "无法创建混合货币订单",
    currencyMixErrorMsg: "无法创建EUR订单：某些产品没有EUR价格。请删除没有EUR价格的产品或将货币更改为CZK。",
    productsWithoutEur: "没有EUR价格的产品：",
    currencyMixSolution: "解决方案：从购物车中删除没有EUR价格的产品并创建单独订单，或将货币更改为CZK。",
    createOrderError: "订单创建失败：",
    unknownError: "未知错误",
    author: "艺术家：",
    couponInvalid: "此货币的优惠券无效。",
    couponVerifyError: "验证优惠券时出错。"
  },
  cart: {
    title: "购物车",
    empty: "购物车为空",
    items: "商品：",
    total: "总计：",
    author: "艺术家：",
    unknownAuthor: "未知艺术家",
    remove: "删除",
    continueShopping: "继续购物",
    proceedToCheckout: "前往结账",
    clearCart: "清空购物车"
  },
  orderDetail: {
    back: "← 返回",
    backToList: "← 返回列表",
    status: "状态：",
    orderNumber: "订单 #{id}",
    total: "应付总额",
    quantity: "数量：",
    unitPrice: "单价：",
    paymentMethod: "付款",
    delivery: "配送",
    customerInfo: "配送和联系信息",
    name: "全名",
    email: "电子邮件",
    phone: "电话",
    street: "街道和门牌号",
    city: "城市",
    zip: "邮政编码",
    address: "地址：",
    fillFromProfile: "从资料填充",
    saving: "保存中…",
    save: "保存数据",
    payment: "付款",
    bankTransfer: "银行转账 / QR",
    bankTransferNote: "点击\"银行转账付款\"后，您将被重定向到带有QR码和有效VS的摘要。",
    qrCode: "QR码",
    alreadyPaid: "订单已付款。",
    pendingPayment: "订单等待付款。",
    codNote: "货到付款。",
    loading: "加载中…",
    error: "加载错误。",
    item: "商品",
    author: "艺术家",
    unknownAuthor: "未知艺术家"
  },
  orderPayment: {
    loading: "加载中…",
    errorLoadingPayment: "无法加载付款信息。",
    errorLoadingOrder: "无法加载订单摘要。",
    backToOrder: "← 返回订单",
    back: "← 返回",
    status: "状态：",
    title: "银行转账付款摘要",
    amount: "金额",
    variableSymbol: "VS",
    account: "账户",
    currency: "货币",
    qrPayment: "QR付款",
    statusPendingPayment: "订单状态为pending_payment。收到付款后，将更改为paid。"
  },
  status: {
    draft: "草稿",
    pendingPayment: "等待付款",
    pending_payment: "等待付款",
    paid: "已付款",
    shipped: "已发货",
    canceled: "已取消",
    expired: "已过期",
    sold: "已售出",
    reserved: "已预订"
  },
  common: {
    loading: "加载中…",
    error: "错误",
    save: "保存",
    cancel: "取消",
    delete: "删除",
    edit: "编辑",
    close: "关闭",
    back: "返回",
    next: "下一步",
    previous: "上一步",
    page: "页",
    of: "共",
    yes: "是",
    no: "否",
    ok: "确定",
    search: "搜索",
    filter: "筛选",
    clear: "清除",
    apply: "应用",
    reset: "重置",
    dark: "深色",
    and: "和",
  },
  cookies: {
    title: "Cookie使用",
    description: "本网站使用cookies以确保正常功能、分析流量和个性化内容。您可以选择要允许的cookie类型。",
    necessary: {
      title: "必要（技术）cookies",
      description: "网站和网店基本功能所必需（购物车、登录、页面显示）。没有这些cookies，网站无法正常工作。"
    },
    preferences: {
      title: "偏好cookies",
      description: "记住您的选择（语言、设置）并改善您的用户体验。"
    },
    analytics: {
      title: "分析/统计cookies",
      description: "测量网站流量并创建匿名统计数据以改进内容。"
    },
    marketing: {
      title: "营销cookies",
      description: "用于显示定向广告和衡量营销活动成功。"
    },
    acceptAll: "接受全部",
    rejectOptional: "拒绝可选",
    save: "保存选择"
  },
  legal: {
    terms: {
      title: "条款和条件",
      content: `Arte Moderno s.r.o. 条款和条件

这些条款和条件规定了Arte Moderno s.r.o.与客户通过https://kunstkabinett.cz在线商店购买艺术品时的关系。

1. 介绍性条款

1.1. 在线商店的运营商是Arte Moderno s.r.o.，ID：24678821，注册地址：Podolská 103/126, 147 00 布拉格4 – Podolí，捷克共和国，营业场所/画廊：Dominikánské náměstí 656/2，雅尔塔宫，布尔诺。

1.2. 联系方式：
- 电子邮件：info@kunstkabinett.cz
- 网站：https://kunstkabinett.cz

2. 合同标的

2.1. 合同标的是通过在线商店销售艺术品（绘画、雕塑、图形和其他艺术品）。

2.2. 所有产品均显示描述、价格和可用性。Arte Moderno s.r.o.保留在不事先通知的情况下更改价格和产品可用性的权利。

3. 购买合同的订立

3.1. 购买合同在Arte Moderno s.r.o.确认订单时订立。

3.2. Arte Moderno s.r.o.保留在不说明理由的情况下拒绝订单的权利。

4. 价格和付款

4.1. 产品价格含增值税。

4.2. 付款可通过银行转账、信用卡或货到付款进行。

5. 交付

5.1. Arte Moderno s.r.o.将在约定的期限内确保产品交付。

5.2. 运费在订购时说明。

6. 合同撤销

6.1. 客户有权在收到货物后14天内撤销合同。

6.2. 关于撤销权的信息在单独文件中提供。

7. 投诉

7.1. 客户有权对有缺陷的商品提出投诉。

7.2. 投诉提交至Arte Moderno s.r.o.的联系方式。

8. 最终条款

8.1. 这些条款和条件受捷克共和国法律管辖。

8.2. Arte Moderno s.r.o.保留更改这些条件的权利。当前版本始终在网站上发布。`
    },
    privacy: {
      title: "隐私政策",
      content: `Arte Moderno s.r.o. 隐私政策

1. 数据控制者

数据控制者是：
Arte Moderno s.r.o.，ID：24678821
注册地址：Podolská 103/126, 147 00 布拉格4 – Podolí，捷克共和国
营业场所/画廊：Dominikánské náměstí 656/2，雅尔塔宫，布尔诺
电子邮件：info@kunstkabinett.cz

2. 处理的个人数据范围

我们处理以下个人数据：
- 姓名
- 电子邮件地址
- 电话号码
- 送货地址
- 付款数据（仅用于付款处理）
- 订单数据

3. 处理目的

我们处理个人数据的目的：
- 履行购买合同
- 与客户沟通
- 订单处理
- 付款处理
- 履行法律义务
- 营销活动（仅在同意的情况下）

4. 处理的法律依据

- 合同履行（GDPR第6(1)(b)条）
- 合法利益（GDPR第6(1)(f)条）
- 同意（GDPR第6(1)(a)条）
- 法律义务（GDPR第6(1)(c)条）

5. 保留期限

我们在处理目的所需的期限内保留个人数据，但不超过法律规定的期限。

6. 您的权利

您有权：
- 访问个人数据
- 更正个人数据
- 删除个人数据
- 限制处理
- 数据可携性
- 反对处理
- 撤回处理同意

7. 联系

如有问题，请联系我们：info@kunstkabinett.cz

8. 投诉提交

您有权向个人数据保护办公室（www.uoou.cz）提交投诉。`
    },
    cookies: {
      title: "Cookie政策",
      content: `Arte Moderno s.r.o. – www.kunstkabinett.cz

1. 谁使用cookies

数据控制者是：

Arte Moderno s.r.o.，ID：24678821

注册地址：Podolská 103/126, 147 00 布拉格4 – Podolí，捷克共和国

营业场所/画廊：Dominikánské náměstí 656/2，雅尔塔宫，布尔诺

电子邮件：info@kunstkabinett.cz

此cookie政策适用于https://kunstkabinett.cz在线商店和网站的运营。

2. 什么是cookies

Cookies是在您访问网站时存储在您的设备（计算机、平板电脑、手机）上的小文本文件。它们允许识别您的设备，记住您的一些设置，并帮助我们确保网站的正常功能、测量流量并改进我们的服务。

Cookies不会损害您的设备或软件，在大多数情况下不允许识别特定人员，只允许识别特定设备。

3. 我们使用哪些cookies

在我们的网站上，我们使用以下基本类型的cookies：

3.1 必要（技术）cookies

这些cookies对于网站和网店的基本功能是必需的，例如：

存储购物车内容，
逐步保存订单，
以正确的格式和语言显示页面，
安全登录用户账户（如果可用）。

没有这些cookies，网站和网店无法正常工作。处理基于我们确保网站功能的合法利益。

3.2 偏好cookies

它们帮助记住您的选择（例如，语言、以前的设置）并改善您的用户体验。我们仅在您给予我们同意时使用这些cookies。

3.3 分析/统计cookies

它们用于测量网站流量并创建关于网站使用的匿名统计（例如，哪些页面访问最多，访问者来自哪些来源）。我们使用这些信息来改进内容和用户环境。我们仅在您同意的基础上使用分析cookies。

我们可能使用第三方服务（通常是网络分析工具）。只有对您的直接识别不必要的数据才会传递给这些提供商。

3.4 营销cookies

它们用于显示定向广告、提醒已查看的产品或衡量营销活动的成功。我们仅在您通过cookie栏或浏览器设置给予我们同意时使用此类cookies。

4. 处理的法律依据

对于必要（技术）cookies，法律依据是我们确保网站功能和安全以及提供您感兴趣的服务（订立和履行购买合同）的合法利益。

对于偏好、分析和营销cookies，法律依据是您的同意。您可以随时撤回同意 – 见下文第5条。

5. Cookie设置和撤回同意

在您首次访问我们的网站时，将显示一个信息栏，您可以在其中：

允许所有cookies，
拒绝可选cookies，
或选择您同意的特定类型的cookies。

您可以随时通过调整互联网浏览器设置来更改或撤回对cookie使用的同意。大多数浏览器允许：

禁用cookie存储，
将它们限制为某些类型，
删除已存储的cookies。

您可以在浏览器的帮助中找到具体程序（例如，在"安全和隐私"或"Cookies"部分）。

我们注意到，阻止或删除某些cookies（特别是必要的cookies）可能会限制我们网站和网店的功能，例如，将无法完成订单。

6. Cookie保留期限

Cookie的保留期限根据其类型而有所不同：

会话cookies – 仅在会话期间（网站访问）存储，并在关闭浏览器后删除。

持久cookies – 在您的设备上保留在其设置中指定的期限或直到在浏览器中手动删除。

具体保留期限可能因各个工具和提供商的设置而异。

7. 第三方cookies

我们的网站上也可能使用第三方cookies，特别是：

支付服务提供商（例如，Comgate）– 用于在线支付处理，
运输和物流服务提供商（例如，Zásilkovna）– 与包裹交付相关，
分析和营销工具提供商 – 用于流量统计和可能的再营销。

这些实体有自己的隐私和cookie政策，您可以在其网站上查看。

8. 与个人数据保护（GDPR）的联系

通过cookies获得的信息在某些情况下可能代表个人数据。在这种情况下，我们根据我们的隐私政策（GDPR）处理它们，该政策详细规定了：

处理的个人数据范围，
处理的目的和法律依据，
保留期限，
您的权利（访问、更正、删除、限制、可携性、反对），
向个人数据保护办公室提交投诉的可能性。

我们建议您熟悉这些政策；它们在我们的网站上提供。

9. 查询联系方式

如有关于cookies或个人数据处理的问题，您可以联系我们：

通过电子邮件：info@kunstkabinett.cz

通过邮件发送至注册地址：Arte Moderno s.r.o., Podolská 103/126, 147 00 布拉格4 – Podolí

10. Cookie政策更新

此政策可能会不时更新，特别是与我们在网站上使用的立法、技术解决方案或服务的变化相关。

当前版本始终在我们的网站上发布。`
    }
  },
  login: {
    title: "登录账户",
    subtitle: "继续探索当代艺术。输入您的详细信息并登录。",
    email: "电子邮件",
    password: "密码",
    forgotPassword: "忘记密码？",
    noAccount: "没有账户？注册",
    submit: "登录",
    submitting: "登录中…",
    error: "登录失败。",
    exploreWorks: "探索作品",
    howItWorks: "工作原理",
    welcomeBack: "欢迎回来"
  },
  register: {
    title: "创建账户",
    subtitle: "注册并保存购物车、订单和收藏作品。",
    name: "全名",
    email: "电子邮件",
    password: "密码",
    password2: "再次输入密码",
    passwordMin: "最少8个字符",
    passwordVerify: "确认密码",
    agree: "我同意",
    terms: "条款",
    privacy: "隐私政策",
    submit: "创建账户",
    submitting: "创建账户中…",
    hasAccount: "已有账户？",
    loginLink: "登录",
    browseWorks: "浏览作品",
    alreadyHaveAccount: "我已有账户",
    createAccount: "创建账户",
    nameRequired: "请输入姓名。",
    emailRequired: "请输入电子邮件。",
    passwordMinLength: "密码必须至少8个字符。",
    passwordMismatch: "密码不匹配。",
    agreeRequired: "您必须同意条款才能创建账户。",
    error: "注册失败。",
    notAvailable: "服务器上注册不可用（404）。设置VITE_REGISTER_PATH。"
  },
  resetPassword: {
    resetPassword: "重置密码",
    title: "重置密码",
    subtitle: "为您的账户设置新密码。电子邮件链接有时间限制。",
    requestSubtitle: "输入您的电子邮件，我们将向您发送密码重置链接。链接有效期为30分钟。",
    email: "电子邮件",
    emailRequired: "请输入您的电子邮件。",
    emailSent: "如果此电子邮件在系统中存在，已向您发送密码重置链接。",
    sendEmail: "发送链接",
    sending: "发送中…",
    requestError: "无法发送密码重置链接。",
    newPassword: "新密码",
    confirmPassword: "确认密码",
    show: "显示",
    hide: "隐藏",
    submit: "设置新密码",
    saving: "保存中…",
    backToLogin: "返回登录",
    missingToken: "URL中缺少或无效的重置令牌。",
    fillBoth: "请填写两个密码字段。",
    passwordMismatch: "密码不匹配。",
    passwordMinLength: "密码必须至少8个字符。",
    success: "密码已成功更改。您现在可以登录。",
    error: "无法设置新密码。",
    notAvailable: "密码重置不可用。",
    connectionError: "连接错误。请重试。"
  },
  home: {
    badge: "策展人精选",
    title: "九月精选",
    subtitle: "发现新锐艺术家的当代作品。即时结账，安全配送。",
    ctaProducts: "浏览产品",
    ctaBlog: "阅读博客",
    originals: "原作",
    selectionForYou: "为您推荐：",
    all: "全部",
    allArtists: "所有艺术家",
    discoverArt: "发现艺术",
    results: "结果",
    curated: "精选",
    sort: "排序：",
    trending: "热门",
    loading: "加载中…",
    errorLoading: "无法加载画廊。",
    noImage: "无图片",
    detail: "详情",
    buy: "购买",
    artistSpotlight: "艺术家聚焦",
    openWork: "打开作品",
    followArtist: "关注艺术家",
    exploreWorks: "探索作品",
    artInsights: "艺术见解"
  }
});

const ja = extendDict(en, {
  brand: { name: "Kunstkabinett" },
  nav: { home: "ホーム", discover: "探す", artists: "アーティスト", blog: "ブログ", about: "私たちについて", contact: "お問い合わせ", login: "ログイン", account: "マイアカウント", logout: "ログアウト", cart: "カート" },
  contact: {
    title: "お問い合わせ",
    subtitle: "いつでもお気軽にお問い合わせください。",
    contactInfo: "連絡先情報",
    name: "名前",
    phone: "電話",
    address: "住所",
    location: "場所",
    mapTitle: "地図 - ヤルタ宮殿, ブルノ",
    sendMessage: "メッセージを送信",
    formName: "名前",
    formEmail: "メール",
    formSubject: "件名",
    formMessage: "メッセージ",
    send: "送信",
    sending: "送信中...",
    success: "メッセージが正常に送信されました。ありがとうございます！",
    error: "メッセージの送信に失敗しました。後でもう一度お試しください。",
    nameRequired: "名前は必須です",
    emailRequired: "メールは必須です",
    subjectRequired: "件名は必須です",
    messageRequired: "メッセージは必須です"
  },
  footer: { terms: "利用規約", privacy: "プライバシー", support: "サポート", cookies: "Cookieポリシー", cookieSettings: "Cookie設定" },
  account: {
    title: "マイプロフィール",
    myOrders: "マイ注文",
    storedDataTitle: "保存済み情報",
    stored: "保存済み",
    basicInfo: "基本情報",
    name: "フルネーム",
    email: "メール",
    phone: "電話",
    phoneNote: "電話は配送にのみ使用されます。",
    billingAddress: "請求先住所",
    street: "番地",
    city: "都市",
    zip: "郵便番号",
    country: "国",
    shippingAddress: "配送先住所",
    sameAsBilling: "請求先住所と同じ",
    saveForNext: "次回の購入のためにこの情報を保存",
    saveProfile: "プロフィールを保存",
    save: "プロフィールを保存",
    saving: "保存中…",
    clearProfile: "プロフィールデータをクリア",
    clear: "プロフィールデータをクリア"
  },
  orders: {
    title: "マイ注文",
    loading: "読み込み中…",
    errorLoading: "注文を読み込めませんでした。",
    error: "注文を読み込めませんでした。",
    order: "注文",
    status: "ステータス",
    total: "合計",
    actions: "アクション",
    detail: "詳細と支払い",
    detailPayment: "詳細と支払い",
    remove: "削除",
    removing: "削除中…",
    removeTitle: "リストから削除",
    removeFromList: "リストから削除",
    confirmRemove: "この注文をリストから削除してもよろしいですか？",
    removeError: "注文を削除できませんでした。",
    empty: "注文がありません。",
    noOrders: "注文がありません。"
  },
  products: {
    title: "ギャラリー",
    loading: "読み込み中…",
    noResults: "結果なし",
    noProducts: "商品なし。",
    filterByCategory: "カテゴリーでフィルター",
    filterByArtist: "アーティストでフィルター",
    filterByPrice: "価格でフィルター",
    priceMin: "最低価格",
    priceMax: "最高価格",
    currency: "通貨",
    czk: "CZK",
    eur: "EUR",
    inStock: "在庫あり",
    outOfStock: "在庫切れ",
    addToCart: "カートに追加",
    viewDetail: "詳細を見る",
    unknownAuthor: "不明なアーティスト",
    noImage: "画像なし",
    filters: "フィルター",
    artist: "アーティスト",
    allArtists: "すべてのアーティスト",
    workTitle: "作品タイトル",
    searchByTitle: "タイトルで検索...",
    priceFrom: "価格から",
    priceTo: "価格まで",
    clearFilters: "クリア",
    activeFilter: "アクティブフィルター",
    activeFilters: "アクティブフィルター",
    activeFiltersMany: "アクティブフィルター",
    active: "アクティブ："
  },
  checkout: {
    title: "チェックアウト",
    empty: "カートが空です。",
    backToCatalog: "カタログに戻る",
    loginRequired: "お願い",
    loginLink: "ログイン",
    loginToComplete: "注文を完了するにはログインしてください",
    items: "商品",
    subtotal: "小計",
    discount: "割引",
    total: "支払い合計",
    summary: "合計",
    couponCode: "割引コード",
    validate: "検証",
    validating: "検証中…",
    verifyCoupon: "検証",
    paymentMethod: "支払い方法",
    paymentCurrency: "支払い通貨",
    paymentCard: "オンラインカード",
    paymentCod: "現金/代金引換",
    paymentBank: "銀行振込",
    shipping: "配送",
    shippingDelivery: "配送",
    shippingPickup: "店頭受取",
    delivery: "配送",
    deliveryMethod: "配送",
    note: "メモ（オプション）",
    notePlaceholder: "特別な配送要望など",
    placeOrder: "注文を完了",
    completeOrder: "注文を完了",
    submitting: "送信中…",
    currency: "支払い通貨",
    currencyCzk: "CZK（コルナ）",
    currencyEur: "EUR（ユーロ）",
    czk: "CZK（チェココルナ）",
    eur: "EUR（ユーロ）",
    currencyMixError: "混合通貨で注文を作成できません",
    currencyMixErrorMsg: "EURで注文を作成できません：一部の商品にEUR価格がありません。EUR価格のない商品を削除するか、通貨をCZKに変更してください。",
    productsWithoutEur: "EUR価格のない商品：",
    currencyMixSolution: "解決策：カートからEUR価格のない商品を削除して別の注文を作成するか、通貨をCZKに変更してください。",
    createOrderError: "注文の作成に失敗しました：",
    unknownError: "不明なエラー",
    author: "アーティスト：",
    couponInvalid: "この通貨のクーポンは無効です。",
    couponVerifyError: "クーポンの検証中にエラーが発生しました。"
  },
  cart: {
    title: "カート",
    empty: "カートが空です",
    items: "商品：",
    total: "合計：",
    author: "アーティスト：",
    unknownAuthor: "不明なアーティスト",
    remove: "削除",
    continueShopping: "買い物を続ける",
    proceedToCheckout: "チェックアウトに進む",
    clearCart: "カートを空にする"
  },
  orderDetail: {
    back: "← 戻る",
    backToList: "← リストに戻る",
    status: "ステータス：",
    orderNumber: "注文 #{id}",
    total: "支払い合計",
    quantity: "数量：",
    unitPrice: "単価：",
    paymentMethod: "支払い",
    delivery: "配送",
    customerInfo: "配送および連絡先情報",
    name: "フルネーム",
    email: "メール",
    phone: "電話",
    street: "番地",
    city: "都市",
    zip: "郵便番号",
    address: "住所：",
    fillFromProfile: "プロフィールから入力",
    saving: "保存中…",
    save: "データを保存",
    payment: "支払う",
    bankTransfer: "銀行振込 / QR",
    bankTransferNote: "「振込で支払う」をクリックすると、QRコードと有効なVSを含む概要にリダイレクトされます。",
    qrCode: "QRコード",
    alreadyPaid: "注文は既に支払われています。",
    pendingPayment: "注文は支払い待ちです。",
    codNote: "代金引換。",
    loading: "読み込み中…",
    error: "読み込みエラー。",
    item: "商品",
    author: "アーティスト",
    unknownAuthor: "不明なアーティスト"
  },
  orderPayment: {
    loading: "読み込み中…",
    errorLoadingPayment: "支払い情報を読み込めませんでした。",
    errorLoadingOrder: "注文の概要を読み込めませんでした。",
    backToOrder: "← 注文に戻る",
    back: "← 戻る",
    status: "ステータス：",
    title: "銀行振込支払いの概要",
    amount: "金額",
    variableSymbol: "VS",
    account: "口座",
    currency: "通貨",
    qrPayment: "QR支払い",
    statusPendingPayment: "注文ステータスはpending_paymentです。支払いを受領後、paidに変更されます。"
  },
  status: {
    draft: "下書き",
    pendingPayment: "支払い待ち",
    pending_payment: "支払い待ち",
    paid: "支払済み",
    shipped: "発送済み",
    canceled: "キャンセル済み",
    expired: "期限切れ",
    sold: "販売済み",
    reserved: "予約済み"
  },
  common: {
    loading: "読み込み中…",
    error: "エラー",
    save: "保存",
    cancel: "キャンセル",
    delete: "削除",
    edit: "編集",
    close: "閉じる",
    back: "戻る",
    next: "次へ",
    previous: "前へ",
    page: "ページ",
    of: "の",
    yes: "はい",
    no: "いいえ",
    ok: "OK",
    search: "検索",
    filter: "フィルター",
    clear: "クリア",
    apply: "適用",
    reset: "リセット",
    dark: "ダーク",
    and: "と",
  },
  cookies: {
    title: "Cookieの使用",
    description: "このウェブサイトは、適切な機能を確保し、トラフィックを分析し、コンテンツをパーソナライズするためにCookieを使用します。許可するCookieの種類を選択できます。",
    necessary: {
      title: "必要（技術）Cookie",
      description: "ウェブサイトとオンラインショップの基本機能（カート、ログイン、ページ表示）に必要です。これらのCookieがないと、ウェブサイトは正常に機能しません。"
    },
    preferences: {
      title: "設定Cookie",
      description: "選択（言語、設定）を記憶し、ユーザー体験を向上させます。"
    },
    analytics: {
      title: "分析/統計Cookie",
      description: "ウェブサイトのトラフィックを測定し、コンテンツを改善するための匿名統計を作成します。"
    },
    marketing: {
      title: "マーケティングCookie",
      description: "ターゲット広告の表示やマーケティングキャンペーンの成功を測定するために使用されます。"
    },
    acceptAll: "すべて受け入れる",
    rejectOptional: "オプションを拒否",
    save: "選択を保存"
  },
  legal: {
    terms: {
      title: "利用規約",
      content: `Arte Moderno s.r.o. 利用規約

これらの利用規約は、https://kunstkabinett.czのオンラインストアを通じてアート作品を購入する際のArte Moderno s.r.o.と顧客の関係を規定します。

1. 序文

1.1. オンラインストアの運営者は、Arte Moderno s.r.o.、ID：24678821、本社：Podolská 103/126, 147 00 プラハ4 – Podolí、チェコ共和国、営業所/ギャラリー：Dominikánské náměstí 656/2、ヤルタ宮殿、ブルノです。

1.2. 連絡先：
- メール：info@kunstkabinett.cz
- ウェブサイト：https://kunstkabinett.cz

2. 契約の対象

2.1. 契約の対象は、オンラインストアを通じたアート作品（絵画、彫刻、グラフィック、その他のアートオブジェクト）の販売です。

2.2. すべての製品は、説明、価格、在庫状況とともに表示されます。Arte Moderno s.r.o.は、事前の通知なしに価格と製品の在庫状況を変更する権利を留保します。

3. 購入契約の締結

3.1. 購入契約は、Arte Moderno s.r.o.が注文を確認した時点で締結されます。

3.2. Arte Moderno s.r.o.は、理由を述べることなく注文を拒否する権利を留保します。

4. 価格と支払い

4.1. 製品価格には消費税が含まれています。

4.2. 支払いは、銀行振込、クレジットカード、または代金引換で行うことができます。

5. 配送

5.1. Arte Moderno s.r.o.は、合意された期間内に製品の配送を確保します。

5.2. 送料は注文時に表示されます。

6. 契約の解除

6.1. 顧客は、商品を受け取ってから14日以内に契約を解除する権利があります。

6.2. 解除権に関する情報は、別の文書で提供されます。

7. 苦情

7.1. 顧客は、欠陥のある商品について苦情を申し立てる権利があります。

7.2. 苦情は、Arte Moderno s.r.o.の連絡先に提出されます。

8. 最終条項

8.1. これらの利用規約は、チェコ共和国の法律に準拠します。

8.2. Arte Moderno s.r.o.は、これらの条件を変更する権利を留保します。現在のバージョンは常にウェブサイトに公開されています。`
    },
    privacy: {
      title: "プライバシーポリシー",
      content: `Arte Moderno s.r.o. プライバシーポリシー

1. データ管理者

データ管理者は：
Arte Moderno s.r.o.、ID：24678821
本社：Podolská 103/126, 147 00 プラハ4 – Podolí、チェコ共和国
営業所/ギャラリー：Dominikánské náměstí 656/2、ヤルタ宮殿、ブルノ
メール：info@kunstkabinett.cz

2. 処理される個人データの範囲

以下の個人データを処理します：
- 氏名
- メールアドレス
- 電話番号
- 配送先住所
- 支払いデータ（支払い処理のみ）
- 注文データ

3. 処理の目的

個人データを以下の目的で処理します：
- 購入契約の履行
- 顧客とのコミュニケーション
- 注文処理
- 支払い処理
- 法的義務の履行
- マーケティング活動（同意がある場合のみ）

4. 処理の法的根拠

- 契約の履行（GDPR第6(1)(b)条）
- 正当な利益（GDPR第6(1)(f)条）
- 同意（GDPR第6(1)(a)条）
- 法的義務（GDPR第6(1)(c)条）

5. 保存期間

個人データは、処理の目的に必要な期間保存しますが、法律で定められた期間を超えることはありません。

6. あなたの権利

以下の権利があります：
- 個人データへのアクセス
- 個人データの訂正
- 個人データの削除
- 処理の制限
- データのポータビリティ
- 処理への異議申し立て
- 処理への同意の撤回

7. 連絡先

質問がある場合は、info@kunstkabinett.czまでご連絡ください。

8. 苦情の提出

個人データ保護局（www.uoou.cz）に苦情を提出する権利があります。`
    },
    cookies: {
      title: "Cookieポリシー",
      content: `Arte Moderno s.r.o. – www.kunstkabinett.cz

1. Cookieを使用する者

データ管理者は：

Arte Moderno s.r.o.、ID：24678821

本社：Podolská 103/126, 147 00 プラハ4 – Podolí、チェコ共和国

営業所/ギャラリー：Dominikánské náměstí 656/2、ヤルタ宮殿、ブルノ

メール：info@kunstkabinett.cz

このCookieポリシーは、https://kunstkabinett.czのオンラインストアとウェブサイトの運営に適用されます。

2. Cookieとは

Cookieは、ウェブサイトを訪問する際にデバイス（コンピューター、タブレット、携帯電話）に保存される小さなテキストファイルです。デバイスを認識し、一部の設定を記憶し、ウェブサイトの適切な機能を確保し、トラフィックを測定し、サービスを改善するのに役立ちます。

Cookieはデバイスやソフトウェアに害を与えず、ほとんどの場合、特定の人物を識別することはできず、特定のデバイスのみを識別できます。

3. 使用するCookie

ウェブサイトでは、以下の基本的なタイプのCookieを使用します：

3.1 必要（技術）Cookie

これらのCookieは、ウェブサイトとオンラインショップの基本機能に必要です。例：

ショッピングカートの内容の保存、
注文の段階的な保存、
正しい形式と言語でのページ表示、
ユーザーアカウントへの安全なログイン（利用可能な場合）。

これらのCookieがないと、ウェブサイトとオンラインショップは正常に機能しません。処理は、ウェブサイトの機能を確保するという正当な利益に基づいています。

3.2 設定Cookie

選択（言語、以前の設定など）を記憶し、ユーザー体験を向上させるのに役立ちます。これらのCookieは、同意をいただいた場合のみ使用します。

3.3 分析/統計Cookie

ウェブサイトのトラフィックを測定し、ウェブサイトの使用に関する匿名統計を作成するために使用します（例：最も訪問されたページ、訪問者の出所）。これらの情報を使用して、コンテンツとユーザー環境を改善します。分析Cookieは、同意に基づいてのみ使用します。

第三者のサービス（通常はウェブ分析ツール）を使用する場合があります。これらのプロバイダーには、直接識別に不要なデータのみが渡されます。

3.4 マーケティングCookie

ターゲット広告の表示、閲覧した製品のリマインダー、またはマーケティングキャンペーンの成功を測定するために使用されます。このタイプのCookieは、Cookieバーまたはブラウザ設定を通じて同意をいただいた場合のみ使用します。

4. 処理の法的根拠

必要（技術）Cookieの場合、法的根拠は、ウェブサイトの機能とセキュリティを確保し、関心のあるサービス（購入契約の締結と履行）を提供するという正当な利益です。

設定、分析、マーケティングCookieの場合、法的根拠は同意です。同意はいつでも撤回できます – 以下の第5条を参照してください。

5. Cookie設定と同意の撤回

ウェブサイトへの初回訪問時に、情報バーが表示され、以下を選択できます：

すべてのCookieを許可、
オプションのCookieを拒否、
または同意する特定のタイプのCookieを選択。

インターネットブラウザの設定を調整することで、Cookieの使用への同意をいつでも変更または撤回できます。ほとんどのブラウザでは以下が可能です：

Cookieの保存を無効化、
特定のタイプに制限、
既に保存されたCookieを削除。

具体的な手順は、ブラウザのヘルプ（「セキュリティとプライバシー」または「Cookie」セクションなど）で見つけることができます。

一部のCookie（特に必要なCookie）をブロックまたは削除すると、ウェブサイトとオンラインショップの機能が制限される可能性があることに注意してください。たとえば、注文を完了できなくなります。

6. Cookieの保存期間

Cookieの保存期間は、タイプによって異なります：

セッションCookie – セッション期間中（ウェブサイト訪問）のみ保存され、ブラウザを閉じると削除されます。

永続Cookie – 設定で指定された期間、またはブラウザで手動削除するまで、デバイスに残ります。

具体的な保存期間は、個々のツールとプロバイダーの設定によって異なる場合があります。

7. 第三者Cookie

ウェブサイトでは、第三者Cookieも使用される場合があります。特に：

支払いサービスプロバイダー（例：Comgate）– オンライン支払い処理用、
輸送および物流サービスプロバイダー（例：Zásilkovna）– パッケージ配達に関連、
分析およびマーケティングツールプロバイダー – トラフィック統計とリマーケティング用。

これらのエンティティには独自のプライバシーとCookieポリシーがあり、ウェブサイトで確認できます。

8. 個人データ保護（GDPR）との関連

Cookieを通じて取得された情報は、場合によっては個人データを表す場合があります。そのような場合、プライバシーポリシー（GDPR）に従って処理します。これには以下が詳細に規定されています：

処理される個人データの範囲、
処理の目的と法的根拠、
保存期間、
あなたの権利（アクセス、訂正、削除、制限、ポータビリティ、異議申し立て）、
個人データ保護局への苦情提出の可能性。

これらのポリシーに慣れることをお勧めします。ウェブサイトで利用できます。

9. 問い合わせ先

Cookieまたは個人データの処理に関する質問については、以下までご連絡ください：

メール：info@kunstkabinett.cz

本社住所宛ての郵便：Arte Moderno s.r.o., Podolská 103/126, 147 00 プラハ4 – Podolí

10. Cookieポリシーの更新

このポリシーは、特に法律、技術的ソリューション、またはウェブサイトで使用するサービスの変更に関連して、随時更新される場合があります。

現在のバージョンは常にウェブサイトに公開されています。`
    }
  },
  login: {
    title: "アカウントにログイン",
    subtitle: "コンテンポラリーアートの探索を続けましょう。詳細を入力してログインしてください。",
    email: "メール",
    password: "パスワード",
    forgotPassword: "パスワードをお忘れですか？",
    noAccount: "アカウントをお持ちでないですか？登録",
    submit: "ログイン",
    submitting: "ログイン中…",
    error: "ログインに失敗しました。",
    exploreWorks: "作品を探索",
    howItWorks: "仕組み",
    welcomeBack: "おかえりなさい"
  },
  register: {
    title: "アカウントを作成",
    subtitle: "登録してカート、注文、お気に入りの作品を保存します。",
    name: "フルネーム",
    email: "メール",
    password: "パスワード",
    password2: "パスワード再入力",
    passwordMin: "最低8文字",
    passwordVerify: "パスワード確認",
    agree: "同意します",
    terms: "利用規約",
    privacy: "プライバシーポリシー",
    submit: "アカウントを作成",
    submitting: "作成中…",
    hasAccount: "既にアカウントをお持ちですか？",
    loginLink: "ログイン",
    browseWorks: "作品を閲覧",
    alreadyHaveAccount: "既にアカウントを持っています",
    createAccount: "アカウントを作成",
    nameRequired: "名前を入力してください。",
    emailRequired: "メールを入力してください。",
    passwordMinLength: "パスワードは8文字以上である必要があります。",
    passwordMismatch: "パスワードが一致しません。",
    agreeRequired: "アカウントを作成するには利用規約に同意する必要があります。",
    error: "登録に失敗しました。",
    notAvailable: "サーバーで登録が利用できません（404）。VITE_REGISTER_PATHを設定してください。"
  },
  resetPassword: {
    resetPassword: "パスワードリセット",
    title: "パスワードリセット",
    subtitle: "アカウントの新しいパスワードを設定してください。メールリンクには時間制限があります。",
    requestSubtitle: "メールアドレスを入力すると、パスワードリセットリンクをお送りします。リンクは30分間有効です。",
    email: "メール",
    emailRequired: "メールアドレスを入力してください。",
    emailSent: "このメールアドレスがシステムに存在する場合、パスワードリセットリンクが送信されました。",
    sendEmail: "リンクを送信",
    sending: "送信中…",
    requestError: "パスワードリセットリンクを送信できませんでした。",
    newPassword: "新しいパスワード",
    confirmPassword: "パスワード確認",
    show: "表示",
    hide: "非表示",
    submit: "新しいパスワードを設定",
    saving: "保存中…",
    backToLogin: "ログインに戻る",
    missingToken: "URLにリセットトークンがありません、または無効です。",
    fillBoth: "両方のパスワードフィールドを入力してください。",
    passwordMismatch: "パスワードが一致しません。",
    passwordMinLength: "パスワードは8文字以上である必要があります。",
    success: "パスワードが正常に変更されました。ログインできます。",
    error: "新しいパスワードを設定できませんでした。",
    notAvailable: "パスワードリセットは利用できません。",
    connectionError: "接続エラー。もう一度お試しください。"
  },
  home: {
    badge: "キュレーターズ・ピック",
    title: "9月コレクション",
    subtitle: "新進気鋭アーティストのコンテンポラリー作品を発見。即時チェックアウト、安全な配送。",
    ctaProducts: "商品を見る",
    ctaBlog: "ブログを読む",
    originals: "オリジナル",
    selectionForYou: "あなたへのおすすめ：",
    all: "すべて",
    allArtists: "すべてのアーティスト",
    discoverArt: "アートを発見",
    results: "結果",
    curated: "キュレーション",
    sort: "並び替え：",
    trending: "トレンド",
    loading: "読み込み中…",
    errorLoading: "ギャラリーを読み込めませんでした。",
    noImage: "画像なし",
    detail: "詳細",
    buy: "購入",
    artistSpotlight: "アーティストスポットライト",
    openWork: "作品を開く",
    followArtist: "アーティストをフォロー",
    exploreWorks: "作品を探索",
    artInsights: "アートインサイト"
  }
});

const it = extendDict(en, {
  brand: { name: "Kunstkabinett" },
  nav: { home: "Home", discover: "Scopri", artists: "Artisti", blog: "Blog", about: "Chi siamo", contact: "Contatti", login: "Accedi", account: "Il mio account", logout: "Esci", cart: "Carrello" },
  contact: {
    title: "Contatti",
    subtitle: "Siamo qui per te. Contattaci in qualsiasi momento.",
    contactInfo: "Informazioni di contatto",
    name: "Nome",
    phone: "Telefono",
    address: "Indirizzo",
    location: "Posizione",
    mapTitle: "Mappa - Palazzo Jalta, Brno",
    sendMessage: "Inviaci un messaggio",
    formName: "Nome",
    formEmail: "Email",
    formSubject: "Oggetto",
    formMessage: "Messaggio",
    send: "Invia",
    sending: "Invio in corso...",
    success: "Il tuo messaggio è stato inviato con successo. Grazie!",
    error: "Invio del messaggio fallito. Riprova più tardi.",
    nameRequired: "Il nome è obbligatorio",
    emailRequired: "L'email è obbligatoria",
    subjectRequired: "L'oggetto è obbligatorio",
    messageRequired: "Il messaggio è obbligatorio"
  },
  footer: { terms: "Termini", privacy: "Privacy", support: "Supporto", cookies: "POLITICA DEI COOKIES", cookieSettings: "Impostazioni cookie" },
  account: {
    title: "Il mio profilo",
    myOrders: "I miei ordini",
    storedDataTitle: "Dati salvati",
    stored: "Salvato",
    basicInfo: "Informazioni di base",
    name: "Nome completo",
    email: "E-mail",
    phone: "Telefono",
    phoneNote: "Il telefono viene utilizzato solo per la consegna.",
    billingAddress: "Indirizzo di fatturazione",
    street: "Via e numero",
    city: "Città",
    zip: "CAP",
    country: "Paese",
    shippingAddress: "Indirizzo di spedizione",
    sameAsBilling: "Uguale all'indirizzo di fatturazione",
    saveForNext: "Salva queste informazioni per il prossimo acquisto",
    saveProfile: "Salva profilo",
    save: "Salva profilo",
    saving: "Salvataggio…",
    clearProfile: "Cancella dati del profilo",
    clear: "Cancella dati del profilo"
  },
  orders: {
    title: "I miei ordini",
    loading: "Caricamento…",
    errorLoading: "Impossibile caricare gli ordini.",
    error: "Impossibile caricare gli ordini.",
    order: "Ordine",
    status: "Stato",
    total: "Totale",
    actions: "Azioni",
    detail: "Dettagli e pagamento",
    detailPayment: "Dettagli e pagamento",
    remove: "Rimuovi",
    removing: "Rimozione…",
    removeTitle: "Rimuovi dall'elenco",
    removeFromList: "Rimuovi dall'elenco",
    confirmRemove: "Rimuovere davvero questo ordine dall'elenco?",
    removeError: "Impossibile rimuovere l'ordine.",
    empty: "Non hai ordini.",
    noOrders: "Non hai ordini."
  },
  products: {
    title: "Galleria",
    loading: "Caricamento…",
    noResults: "Nessun risultato",
    noProducts: "Nessun prodotto.",
    filterByCategory: "Filtra per categoria",
    filterByArtist: "Filtra per artista",
    filterByPrice: "Filtra per prezzo",
    priceMin: "Prezzo min.",
    priceMax: "Prezzo max.",
    currency: "Valuta",
    czk: "CZK",
    eur: "EUR",
    inStock: "Disponibile",
    outOfStock: "Esaurito",
    addToCart: "Aggiungi al carrello",
    viewDetail: "Visualizza dettagli",
    unknownAuthor: "Artista sconosciuto",
    noImage: "nessuna immagine",
    filters: "Filtri",
    artist: "Artista",
    allArtists: "Tutti gli artisti",
    workTitle: "Titolo dell'opera",
    searchByTitle: "Cerca per titolo...",
    priceFrom: "Prezzo da",
    priceTo: "Prezzo fino a",
    clearFilters: "Cancella",
    activeFilter: "filtro attivo",
    activeFilters: "filtri attivi",
    activeFiltersMany: "filtri attivi",
    active: "Attivo:"
  },
  checkout: {
    title: "Cassa",
    empty: "Il carrello è vuoto.",
    backToCatalog: "Torna al catalogo",
    loginRequired: "Per favore",
    loginLink: "accedi",
    loginToComplete: "Accedi per completare l'ordine",
    items: "Articoli",
    subtotal: "Subtotale",
    discount: "Sconto",
    total: "Totale da pagare",
    summary: "Riepilogo",
    couponCode: "Codice sconto",
    validate: "Valida",
    validating: "Validazione…",
    verifyCoupon: "Verifica",
    paymentMethod: "Metodo di pagamento",
    paymentCurrency: "Valuta di pagamento",
    paymentCard: "Carta online",
    paymentCod: "Contanti / Contrassegno",
    paymentBank: "Bonifico",
    shipping: "Spedizione",
    shippingDelivery: "Consegna",
    shippingPickup: "Ritiro",
    delivery: "Spedizione",
    deliveryMethod: "Consegna",
    note: "Nota (opzionale)",
    notePlaceholder: "Desideri speciali per la consegna, ecc.",
    placeOrder: "Completa l'ordine",
    completeOrder: "Completa l'ordine",
    submitting: "Invio…",
    currency: "Valuta di pagamento",
    currencyCzk: "CZK (Corona)",
    currencyEur: "EUR (Euro)",
    czk: "CZK (Corona ceca)",
    eur: "EUR (Euro)",
    currencyMixError: "Impossibile creare un ordine con valute miste",
    currencyMixErrorMsg: "Impossibile creare un ordine in EUR: alcuni prodotti non hanno un prezzo in EUR. Rimuovi i prodotti senza prezzo EUR o cambia la valuta in CZK.",
    productsWithoutEur: "Prodotti senza prezzo EUR:",
    currencyMixSolution: "Soluzione: Rimuovi i prodotti senza prezzo EUR dal carrello e crea un ordine separato, o cambia la valuta in CZK.",
    createOrderError: "Creazione ordine fallita:",
    unknownError: "Errore sconosciuto",
    author: "Artista:",
    couponInvalid: "Il coupon non è valido per questa valuta.",
    couponVerifyError: "Errore durante la verifica del coupon."
  },
  cart: {
    title: "Carrello",
    empty: "Il carrello è vuoto",
    items: "Articoli:",
    total: "Totale:",
    author: "Artista:",
    unknownAuthor: "Artista sconosciuto",
    remove: "Rimuovi",
    continueShopping: "Continua lo shopping",
    proceedToCheckout: "Vai alla cassa",
    clearCart: "Svuota il carrello"
  },
  orderDetail: {
    back: "← Indietro",
    backToList: "← Torna alla lista",
    status: "Stato:",
    orderNumber: "Ordine #{id}",
    total: "Totale da pagare",
    quantity: "Qtà:",
    unitPrice: "Prezzo/articolo:",
    paymentMethod: "Pagamento",
    delivery: "Spedizione",
    customerInfo: "Informazioni di consegna e contatto",
    name: "Nome completo",
    email: "E-mail",
    phone: "Telefono",
    street: "Via e numero",
    city: "Città",
    zip: "CAP",
    address: "Indirizzo:",
    fillFromProfile: "Compila dal profilo",
    saving: "Salvataggio…",
    save: "Salva dati",
    payment: "Paga",
    bankTransfer: "Bonifico / QR",
    bankTransferNote: "Dopo aver cliccato \"Paga con bonifico\" verrai reindirizzato a un riepilogo con codice QR e VS valido.",
    qrCode: "Codice QR",
    alreadyPaid: "L'ordine è già stato pagato.",
    pendingPayment: "L'ordine è in attesa di pagamento.",
    codNote: "Pagamento alla consegna.",
    loading: "Caricamento…",
    error: "Errore durante il caricamento.",
    item: "articolo",
    author: "Artista",
    unknownAuthor: "Artista sconosciuto"
  },
  orderPayment: {
    loading: "Caricamento…",
    errorLoadingPayment: "Impossibile caricare le informazioni di pagamento.",
    errorLoadingOrder: "Impossibile caricare il riepilogo dell'ordine.",
    backToOrder: "← Torna all'ordine",
    back: "← Indietro",
    status: "Stato:",
    title: "Riepilogo pagamento bonifico",
    amount: "Importo",
    variableSymbol: "VS",
    account: "Conto",
    currency: "Valuta",
    qrPayment: "Pagamento QR",
    statusPendingPayment: "Lo stato dell'ordine è pending_payment. Dopo la ricezione del pagamento, verrà cambiato in paid."
  },
  status: {
    draft: "Bozza",
    pendingPayment: "In attesa di pagamento",
    pending_payment: "In attesa di pagamento",
    paid: "Pagato",
    shipped: "Spedito",
    canceled: "Annullato",
    expired: "Scaduto",
    sold: "Venduto",
    reserved: "Prenotato"
  },
  common: {
    loading: "Caricamento…",
    error: "Errore",
    save: "Salva",
    cancel: "Annulla",
    delete: "Elimina",
    edit: "Modifica",
    close: "Chiudi",
    back: "Indietro",
    next: "Avanti",
    previous: "Precedente",
    page: "Pagina",
    of: "di",
    yes: "Sì",
    no: "No",
    ok: "OK",
    search: "Cerca",
    filter: "Filtra",
    clear: "Cancella",
    apply: "Applica",
    reset: "Reimposta",
    dark: "Scuro",
    and: "e",
  },
  cookies: {
    title: "Utilizzo dei cookie",
    description: "Questo sito web utilizza i cookie per garantire il corretto funzionamento, analizzare il traffico e personalizzare i contenuti. Puoi scegliere quali tipi di cookie vuoi consentire.",
    necessary: {
      title: "Cookie necessari (tecnici)",
      description: "Richiesti per le funzioni di base del sito web e del negozio online (carrello, accesso, visualizzazione delle pagine). Senza questi cookie, il sito web non può funzionare correttamente."
    },
    preferences: {
      title: "Cookie delle preferenze",
      description: "Memorizzano le tue scelte (lingua, impostazioni) e migliorano il tuo comfort utente."
    },
    analytics: {
      title: "Cookie analitici / statistici",
      description: "Misurano il traffico del sito web e creano statistiche anonime per migliorare i contenuti."
    },
    marketing: {
      title: "Cookie di marketing",
      description: "Utilizzati per visualizzare pubblicità mirate e misurare il successo delle campagne di marketing."
    },
    acceptAll: "Accetta tutto",
    rejectOptional: "Rifiuta opzionali",
    save: "Salva selezione"
  },
  legal: {
    terms: {
      title: "Termini e condizioni",
      content: `Termini e condizioni Arte Moderno s.r.o.

Questi termini e condizioni disciplinano la relazione tra Arte Moderno s.r.o. e i clienti nell'acquisto di opere d'arte tramite il negozio online all'indirizzo https://kunstkabinett.cz.

1. Disposizioni introduttive

1.1. L'operatore del negozio online è Arte Moderno s.r.o., ID: 24678821, con sede legale in Podolská 103/126, 147 00 Praga 4 – Podolí, Repubblica Ceca, locali commerciali / galleria: Dominikánské náměstí 656/2, Palazzo Jalta, Brno.

1.2. Dati di contatto:
- Email: info@kunstkabinett.cz
- Sito web: https://kunstkabinett.cz

2. Oggetto del contratto

2.1. L'oggetto del contratto è la vendita di opere d'arte (dipinti, sculture, grafiche e altri oggetti d'arte) tramite il negozio online.

2.2. Tutti i prodotti sono visualizzati con descrizione, prezzo e disponibilità. Arte Moderno s.r.o. si riserva il diritto di modificare prezzi e disponibilità dei prodotti senza preavviso.

3. Conclusione del contratto di acquisto

3.1. Il contratto di acquisto è concluso al momento della conferma dell'ordine da parte di Arte Moderno s.r.o.

3.2. Arte Moderno s.r.o. si riserva il diritto di rifiutare un ordine senza indicare motivi.

4. Prezzo e pagamento

4.1. I prezzi dei prodotti sono indicati IVA inclusa.

4.2. Il pagamento può essere effettuato tramite bonifico bancario, carta di credito o contrassegno.

5. Consegna

5.1. Arte Moderno s.r.o. garantirà la consegna dei prodotti entro i termini concordati.

5.2. I costi di spedizione sono indicati al momento dell'ordine.

6. Recesso dal contratto

6.1. Il cliente ha il diritto di recedere dal contratto entro 14 giorni dal ricevimento della merce.

6.2. Le informazioni sul diritto di recesso sono fornite in un documento separato.

7. Reclami

7.1. Il cliente ha il diritto di presentare reclamo per merce difettosa.

7.2. I reclami sono presentati ai dati di contatto di Arte Moderno s.r.o.

8. Disposizioni finali

8.1. Questi termini e condizioni sono disciplinati dall'ordinamento giuridico della Repubblica Ceca.

8.2. Arte Moderno s.r.o. si riserva il diritto di modificare queste condizioni. La versione corrente è sempre pubblicata sul sito web.`
    },
    privacy: {
      title: "Informativa sulla privacy",
      content: `Informativa sulla privacy Arte Moderno s.r.o.

1. Titolare del trattamento

Il titolare del trattamento è:
Arte Moderno s.r.o., ID: 24678821
sede legale: Podolská 103/126, 147 00 Praga 4 – Podolí, Repubblica Ceca
locali commerciali / galleria: Dominikánské náměstí 656/2, Palazzo Jalta, Brno
email: info@kunstkabinett.cz

2. Ambito dei dati personali trattati

Trattiamo i seguenti dati personali:
- Nome e cognome
- Indirizzo email
- Numero di telefono
- Indirizzo di consegna
- Dati di pagamento (solo per l'elaborazione del pagamento)
- Dati dell'ordine

3. Finalità del trattamento

Trattiamo i dati personali per le finalità di:
- Adempimento del contratto di acquisto
- Comunicazione con il cliente
- Elaborazione degli ordini
- Elaborazione dei pagamenti
- Adempimento degli obblighi legali
- Attività di marketing (solo con consenso)

4. Base giuridica del trattamento

- Adempimento del contratto (art. 6(1)(b) GDPR)
- Interesse legittimo (art. 6(1)(f) GDPR)
- Consenso (art. 6(1)(a) GDPR)
- Obbligo legale (art. 6(1)(c) GDPR)

5. Periodo di conservazione

Conserviamo i dati personali per il periodo necessario al conseguimento delle finalità del trattamento, ma non oltre il periodo prescritto dalla legge.

6. I tuoi diritti

Hai il diritto:
- Di accesso ai dati personali
- Di rettifica dei dati personali
- Di cancellazione dei dati personali
- Di limitazione del trattamento
- Di portabilità dei dati
- Di opporti al trattamento
- Di revocare il consenso al trattamento

7. Contatto

Per domande, contattaci a: info@kunstkabinett.cz

8. Presentazione di reclamo

Hai il diritto di presentare reclamo all'Autorità per la protezione dei dati personali (www.uoou.cz).`
    },
    cookies: {
      title: "Politica dei cookie",
      content: `Arte Moderno s.r.o. – www.kunstkabinett.cz

1. Chi utilizza i cookie

Il titolare del trattamento è:

Arte Moderno s.r.o., ID: 24678821

sede legale: Podolská 103/126, 147 00 Praga 4 – Podolí, Repubblica Ceca

locali commerciali / galleria: Dominikánské náměstí 656/2, Palazzo Jalta, Brno

email: info@kunstkabinett.cz

Questa politica dei cookie si applica al funzionamento del negozio online e del sito web all'indirizzo https://kunstkabinett.cz.

2. Cosa sono i cookie

I cookie sono piccoli file di testo che vengono salvati sul tuo dispositivo (computer, tablet, telefono cellulare) quando visiti i siti web. Consentono il riconoscimento del tuo dispositivo, ricordano alcune delle tue impostazioni e ci aiutano a garantire il corretto funzionamento del sito web, misurare il traffico e migliorare i nostri servizi.

I cookie non danneggiano il tuo dispositivo o software e nella maggior parte dei casi non consentono l'identificazione di una persona specifica, ma solo di un dispositivo specifico.

3. Quali cookie utilizziamo

Sul nostro sito web utilizziamo questi tipi base di cookie:

3.1 Cookie necessari (tecnici)

Questi cookie sono necessari per le funzioni di base del sito web e del negozio online, ad esempio:

memorizzazione del contenuto del carrello,
salvataggio progressivo dell'ordine,
visualizzazione della pagina nel formato e nella lingua corretti,
accesso sicuro all'account utente (se disponibile).

Senza questi cookie, il sito web e il negozio online non possono funzionare correttamente. Il trattamento si basa sul nostro interesse legittimo a garantire la funzionalità del sito web.

3.2 Cookie delle preferenze

Aiutano a ricordare le tue scelte (ad esempio, lingua, impostazioni precedenti) e migliorano il tuo comfort utente. Utilizziamo questi cookie solo se ci dai il consenso.

3.3 Cookie analitici / statistici

Servono a misurare il traffico del sito web e creare statistiche anonime sull'utilizzo del sito web (ad esempio, quali pagine sono più visitate, da quali fonti provengono i visitatori). Utilizziamo queste informazioni per migliorare i contenuti e l'ambiente utente. Utilizziamo i cookie analitici solo sulla base del tuo consenso.

Possiamo utilizzare servizi di terze parti (tipicamente strumenti di analisi web). A questi fornitori vengono trasmessi solo dati che non sono necessari per la tua identificazione diretta.

3.4 Cookie di marketing

Sono utilizzati per visualizzare pubblicità mirate, ricordare i prodotti visualizzati o misurare il successo delle campagne di marketing. Utilizziamo questo tipo di cookie solo se ci dai il consenso tramite la barra dei cookie o le impostazioni del browser.

4. Base giuridica del trattamento

Per i cookie necessari (tecnici), la base giuridica è il nostro interesse legittimo a garantire la funzionalità e la sicurezza del sito web e fornire servizi di tuo interesse (conclusione e adempimento del contratto di acquisto).

Per i cookie delle preferenze, analitici e di marketing, la base giuridica è il tuo consenso. Puoi revocare il consenso in qualsiasi momento – vedi articolo 5 sotto.

5. Impostazioni dei cookie e revoca del consenso

Al primo accesso al nostro sito web, verrà visualizzata una barra informativa dove puoi:

consentire tutti i cookie,
rifiutare i cookie opzionali,
o scegliere tipi specifici di cookie con cui sei d'accordo.

Puoi modificare o revocare il consenso all'utilizzo dei cookie in qualsiasi momento modificando le impostazioni del tuo browser Internet. La maggior parte dei browser consente di:

disabilitare il salvataggio dei cookie,
limitarli a determinati tipi,
eliminare i cookie già salvati.

Puoi trovare la procedura specifica nell'help del tuo browser (ad esempio, nella sezione "Sicurezza e privacy" o "Cookie").

Notiamo che il blocco o l'eliminazione di alcuni cookie (specialmente quelli necessari) può limitare la funzionalità del nostro sito web e del negozio online, ad esempio, non sarà possibile completare un ordine.

6. Periodo di conservazione dei cookie

Il periodo di conservazione dei cookie varia a seconda del loro tipo:

Cookie di sessione – salvati solo per la durata della sessione (visita del sito web) e eliminati dopo la chiusura del browser.

Cookie persistenti – rimangono sul tuo dispositivo per il periodo indicato nelle loro impostazioni o fino all'eliminazione manuale nel browser.

I periodi di conservazione specifici possono variare a seconda delle impostazioni degli strumenti e dei fornitori individuali.

7. Cookie di terze parti

Sul nostro sito web possono essere utilizzati anche cookie di terze parti, in particolare:

fornitori di servizi di pagamento (ad esempio, Comgate) – per l'elaborazione dei pagamenti online,
fornitori di servizi di trasporto e logistica (ad esempio, Zásilkovna) – in relazione alla consegna dei pacchi,
fornitori di strumenti analitici e di marketing – per statistiche del traffico e possibile remarketing.

Queste entità hanno le proprie politiche sulla privacy e sui cookie, che puoi consultare sui loro siti web.

8. Collegamento con la protezione dei dati personali (GDPR)

Le informazioni ottenute tramite i cookie possono in alcuni casi rappresentare dati personali. In tali casi, le trattiamo in conformità con la nostra Informativa sulla privacy (GDPR), che disciplina in dettaglio:

l'ambito dei dati personali trattati,
le finalità e le basi giuridiche del trattamento,
il periodo di conservazione,
i tuoi diritti (accesso, rettifica, cancellazione, limitazione, portabilità, opposizione),
le possibilità di presentare reclamo all'Autorità per la protezione dei dati personali.

Raccomandiamo di familiarizzare con queste politiche; sono disponibili sul nostro sito web.

9. Dati di contatto per le richieste

Per domande riguardanti i cookie o il trattamento dei dati personali, puoi contattarci:

via email: info@kunstkabinett.cz

via posta all'indirizzo della sede legale: Arte Moderno s.r.o., Podolská 103/126, 147 00 Praga 4 – Podolí

10. Aggiornamenti della politica dei cookie

Questa politica può essere aggiornata di volta in volta, specialmente in relazione a cambiamenti nella legislazione, soluzioni tecniche o servizi che utilizziamo sul sito web.

La versione corrente è sempre pubblicata sul nostro sito web.`
    }
  },
  login: {
    title: "Accedi all'account",
    subtitle: "Continua a esplorare l'arte contemporanea. Inserisci i tuoi dati e accedi.",
    email: "E-mail",
    password: "Password",
    forgotPassword: "Password dimenticata?",
    noAccount: "Non hai un account? Registrati",
    submit: "Accedi",
    submitting: "Accesso in corso…",
    error: "Accesso fallito.",
    exploreWorks: "Esplora opere",
    howItWorks: "Come funziona",
    welcomeBack: "Bentornato"
  },
  register: {
    title: "Crea account",
    subtitle: "Registrati e salva carrello, ordini e opere preferite.",
    name: "Nome completo",
    email: "E-mail",
    password: "Password",
    password2: "Password di nuovo",
    passwordMin: "min. 8 caratteri",
    passwordVerify: "verifica password",
    agree: "Accetto i",
    terms: "termini",
    privacy: "informativa sulla privacy",
    submit: "Crea account",
    submitting: "Creazione account…",
    hasAccount: "Hai già un account?",
    loginLink: "Accedi",
    browseWorks: "Sfoglia opere",
    alreadyHaveAccount: "Ho già un account",
    createAccount: "Crea account",
    nameRequired: "Inserisci il nome.",
    emailRequired: "Inserisci l'e-mail.",
    passwordMinLength: "La password deve contenere almeno 8 caratteri.",
    passwordMismatch: "Le password non corrispondono.",
    agreeRequired: "Devi accettare i termini per creare un account.",
    error: "Registrazione fallita.",
    notAvailable: "La registrazione non è disponibile sul server (404). Imposta VITE_REGISTER_PATH."
  },
  resetPassword: {
    resetPassword: "Reimposta password",
    title: "Reimposta password",
    subtitle: "Imposta una nuova password per il tuo account. Il link email ha un limite di tempo.",
    requestSubtitle: "Inserisci la tua email e ti invieremo un link per reimpostare la password. Il link è valido per 30 minuti.",
    email: "E-mail",
    emailRequired: "Inserisci la tua email.",
    emailSent: "Se questa email esiste nel sistema, ti è stato inviato un link per reimpostare la password.",
    sendEmail: "Invia link",
    sending: "Invio…",
    requestError: "Impossibile inviare il link per reimpostare la password.",
    newPassword: "Nuova password",
    confirmPassword: "Conferma password",
    show: "Mostra",
    hide: "Nascondi",
    submit: "Imposta nuova password",
    saving: "Salvataggio…",
    backToLogin: "Torna al login",
    missingToken: "Token di reset mancante o non valido nell'URL.",
    fillBoth: "Compila entrambi i campi password.",
    passwordMismatch: "Le password non corrispondono.",
    passwordMinLength: "La password deve contenere almeno 8 caratteri.",
    success: "Password modificata con successo. Ora puoi accedere.",
    error: "Impossibile impostare la nuova password.",
    notAvailable: "Reimpostazione password non disponibile.",
    connectionError: "Errore di connessione. Riprova."
  },
  home: {
    badge: "Scelta del curatore",
    title: "La Collezione di Settembre",
    subtitle: "Scopri opere contemporanee di artisti emergenti. Check-out immediato, consegna sicura.",
    ctaProducts: "Sfoglia i prodotti",
    ctaBlog: "Leggi il blog",
    originals: "Originali",
    selectionForYou: "Selezione per te:",
    all: "Tutti",
    allArtists: "Tutti gli artisti",
    discoverArt: "Scopri l'arte",
    results: "risultati",
    curated: "curato",
    sort: "Ordina:",
    trending: "Di tendenza",
    loading: "Caricamento…",
    errorLoading: "Impossibile caricare la galleria.",
    noImage: "nessuna immagine",
    detail: "Dettaglio",
    buy: "Acquista",
    artistSpotlight: "Artista in primo piano",
    openWork: "Apri opera",
    followArtist: "Segui artista",
    exploreWorks: "Esplora opere",
    artInsights: "Approfondimenti sull'arte"
  }
});

const pl = extendDict(en, {
  brand: { name: "Kunstkabinett" },
  nav: { home: "Strona główna", discover: "Odkrywaj", artists: "Artyści", blog: "Blog", about: "O nas", contact: "Kontakt", login: "Zaloguj się", account: "Moje konto", logout: "Wyloguj", cart: "Koszyk" },
  contact: {
    title: "Kontakt",
    subtitle: "Jesteśmy tutaj dla Ciebie. Skontaktuj się z nami w dowolnym momencie.",
    contactInfo: "Informacje kontaktowe",
    name: "Imię",
    phone: "Telefon",
    address: "Adres",
    location: "Lokalizacja",
    mapTitle: "Mapa - Pałac Jalta, Brno",
    sendMessage: "Wyślij nam wiadomość",
    formName: "Imię",
    formEmail: "Email",
    formSubject: "Temat",
    formMessage: "Wiadomość",
    send: "Wyślij",
    sending: "Wysyłanie...",
    success: "Twoja wiadomość została wysłana pomyślnie. Dziękujemy!",
    error: "Nie udało się wysłać wiadomości. Spróbuj ponownie później.",
    nameRequired: "Imię jest wymagane",
    emailRequired: "Email jest wymagany",
    subjectRequired: "Temat jest wymagany",
    messageRequired: "Wiadomość jest wymagana"
  },
  footer: { terms: "Warunki", privacy: "Prywatność", support: "Wsparcie", cookies: "POLITYKA COOKIES", cookieSettings: "Ustawienia cookies" },
  account: {
    title: "Mój profil",
    myOrders: "Moje zamówienia",
    storedDataTitle: "Zapisane dane",
    stored: "Zapisano",
    basicInfo: "Podstawowe informacje",
    name: "Pełne imię",
    email: "E-mail",
    phone: "Telefon",
    phoneNote: "Telefon jest używany tylko do dostawy.",
    billingAddress: "Adres rozliczeniowy",
    street: "Ulica i numer",
    city: "Miasto",
    zip: "Kod pocztowy",
    country: "Kraj",
    shippingAddress: "Adres dostawy",
    sameAsBilling: "Tak samo jak adres rozliczeniowy",
    saveForNext: "Zapisz te informacje na następny zakup",
    saveProfile: "Zapisz profil",
    save: "Zapisz profil",
    saving: "Zapisywanie…",
    clearProfile: "Wyczyść dane profilu",
    clear: "Wyczyść dane profilu"
  },
  orders: {
    title: "Moje zamówienia",
    loading: "Ładowanie…",
    errorLoading: "Nie można załadować zamówień.",
    error: "Nie można załadować zamówień.",
    order: "Zamówienie",
    status: "Status",
    total: "Razem",
    actions: "Akcje",
    detail: "Szczegóły i płatność",
    detailPayment: "Szczegóły i płatność",
    remove: "Usuń",
    removing: "Usuwanie…",
    removeTitle: "Usuń z listy",
    removeFromList: "Usuń z listy",
    confirmRemove: "Czy na pewno usunąć to zamówienie z listy?",
    removeError: "Nie można usunąć zamówienia.",
    empty: "Nie masz zamówień.",
    noOrders: "Nie masz zamówień."
  },
  products: {
    title: "Galeria",
    loading: "Ładowanie…",
    noResults: "Brak wyników",
    noProducts: "Brak produktów.",
    filterByCategory: "Filtruj według kategorii",
    filterByArtist: "Filtruj według artysty",
    filterByPrice: "Filtruj według ceny",
    priceMin: "Min. cena",
    priceMax: "Max. cena",
    currency: "Waluta",
    czk: "CZK",
    eur: "EUR",
    inStock: "W magazynie",
    outOfStock: "Brak w magazynie",
    addToCart: "Dodaj do koszyka",
    viewDetail: "Zobacz szczegóły",
    unknownAuthor: "Nieznany artysta",
    noImage: "brak obrazu",
    filters: "Filtry",
    artist: "Artysta",
    allArtists: "Wszyscy artyści",
    workTitle: "Tytuł dzieła",
    searchByTitle: "Szukaj według tytułu...",
    priceFrom: "Cena od",
    priceTo: "Cena do",
    clearFilters: "Wyczyść",
    activeFilter: "aktywny filtr",
    activeFilters: "aktywne filtry",
    activeFiltersMany: "aktywnych filtrów",
    active: "Aktywne:"
  },
  checkout: {
    title: "Kasa",
    empty: "Koszyk jest pusty.",
    backToCatalog: "Powrót do katalogu",
    loginRequired: "Proszę",
    loginLink: "zaloguj się",
    loginToComplete: "Zaloguj się, aby zakończyć zamówienie",
    items: "Pozycje",
    subtotal: "Suma częściowa",
    discount: "Zniżka",
    total: "Razem do zapłaty",
    summary: "Podsumowanie",
    couponCode: "Kod zniżkowy",
    validate: "Zweryfikuj",
    validating: "Weryfikowanie…",
    verifyCoupon: "Zweryfikuj",
    paymentMethod: "Metoda płatności",
    paymentCurrency: "Waluta płatności",
    paymentCard: "Karta online",
    paymentCod: "Gotówka / Płatność przy odbiorze",
    paymentBank: "Przelew",
    shipping: "Dostawa",
    shippingDelivery: "Dostawa",
    shippingPickup: "Odbiór osobisty",
    delivery: "Dostawa",
    deliveryMethod: "Dostawa",
    note: "Uwaga (opcjonalnie)",
    notePlaceholder: "Specjalne życzenia dotyczące dostawy itp.",
    placeOrder: "Zakończ zamówienie",
    completeOrder: "Zakończ zamówienie",
    submitting: "Wysyłanie…",
    currency: "Waluta płatności",
    currencyCzk: "CZK (Korona)",
    currencyEur: "EUR (Euro)",
    czk: "CZK (Korona czeska)",
    eur: "EUR (Euro)",
    currencyMixError: "Nie można utworzyć zamówienia z mieszanymi walutami",
    currencyMixErrorMsg: "Nie można utworzyć zamówienia w EUR: niektóre produkty nie mają ceny w EUR. Usuń produkty bez ceny EUR lub zmień walutę na CZK.",
    productsWithoutEur: "Produkty bez ceny EUR:",
    currencyMixSolution: "Rozwiązanie: Usuń produkty bez ceny EUR z koszyka i utwórz osobne zamówienie, lub zmień walutę na CZK.",
    createOrderError: "Utworzenie zamówienia nie powiodło się:",
    unknownError: "Nieznany błąd",
    author: "Artysta:",
    couponInvalid: "Kupon jest nieważny dla tej waluty.",
    couponVerifyError: "Błąd podczas weryfikacji kuponu."
  },
  cart: {
    title: "Koszyk",
    empty: "Koszyk jest pusty",
    items: "Pozycje:",
    total: "Razem:",
    author: "Artysta:",
    unknownAuthor: "Nieznany artysta",
    remove: "Usuń",
    continueShopping: "Kontynuuj zakupy",
    proceedToCheckout: "Przejdź do kasy",
    clearCart: "Wyczyść koszyk"
  },
  orderDetail: {
    back: "← Wstecz",
    backToList: "← Powrót do listy",
    status: "Status:",
    orderNumber: "Zamówienie #{id}",
    total: "Razem do zapłaty",
    quantity: "Ilość:",
    unitPrice: "Cena/szt.:",
    paymentMethod: "Płatność",
    delivery: "Dostawa",
    customerInfo: "Informacje o dostawie i kontakcie",
    name: "Pełne imię",
    email: "E-mail",
    phone: "Telefon",
    street: "Ulica i numer",
    city: "Miasto",
    zip: "Kod pocztowy",
    address: "Adres:",
    fillFromProfile: "Wypełnij z profilu",
    saving: "Zapisywanie…",
    save: "Zapisz dane",
    payment: "Zapłać",
    bankTransfer: "Przelew / QR",
    bankTransferNote: "Po kliknięciu \"Zapłać przelewem\" zostaniesz przekierowany do podsumowania z kodem QR i ważnym VS.",
    qrCode: "Kod QR",
    alreadyPaid: "Zamówienie jest już opłacone.",
    pendingPayment: "Zamówienie oczekuje na płatność.",
    codNote: "Płatność przy odbiorze.",
    loading: "Ładowanie…",
    error: "Błąd podczas ładowania.",
    item: "pozycja",
    author: "Artysta",
    unknownAuthor: "Nieznany artysta"
  },
  orderPayment: {
    loading: "Ładowanie…",
    errorLoadingPayment: "Nie można załadować informacji o płatności.",
    errorLoadingOrder: "Nie można załadować podsumowania zamówienia.",
    backToOrder: "← Powrót do zamówienia",
    back: "← Wstecz",
    status: "Status:",
    title: "Podsumowanie płatności przelewem",
    amount: "Kwota",
    variableSymbol: "VS",
    account: "Konto",
    currency: "Waluta",
    qrPayment: "Płatność QR",
    statusPendingPayment: "Status zamówienia to pending_payment. Po otrzymaniu płatności zostanie zmieniony na paid."
  },
  status: {
    draft: "Szkic",
    pendingPayment: "Oczekuje na płatność",
    pending_payment: "Oczekuje na płatność",
    paid: "Opłacone",
    shipped: "Wysłane",
    canceled: "Anulowane",
    expired: "Wygasło",
    sold: "Sprzedane",
    reserved: "Zarezerwowane"
  },
  common: {
    loading: "Ładowanie…",
    error: "Błąd",
    save: "Zapisz",
    cancel: "Anuluj",
    delete: "Usuń",
    edit: "Edytuj",
    close: "Zamknij",
    back: "Wstecz",
    next: "Dalej",
    previous: "Poprzedni",
    page: "Strona",
    of: "z",
    yes: "Tak",
    no: "Nie",
    ok: "OK",
    search: "Szukaj",
    filter: "Filtruj",
    clear: "Wyczyść",
    apply: "Zastosuj",
    reset: "Resetuj",
    dark: "Ciemny",
    and: "i",
  },
  cookies: {
    title: "Używanie plików cookie",
    description: "Ta strona internetowa używa plików cookie, aby zapewnić prawidłowe działanie, analizować ruch i personalizować treści. Możesz wybrać, jakie typy plików cookie chcesz zezwolić.",
    necessary: {
      title: "Niezbędne (techniczne) pliki cookie",
      description: "Wymagane do podstawowych funkcji strony internetowej i sklepu online (koszyk, logowanie, wyświetlanie strony). Bez tych plików cookie strona internetowa nie może działać prawidłowo."
    },
    preferences: {
      title: "Pliki cookie preferencji",
      description: "Zapamiętują Twoje wybory (język, ustawienia) i poprawiają Twój komfort użytkowania."
    },
    analytics: {
      title: "Analityczne / statystyczne pliki cookie",
      description: "Mierzą ruch na stronie internetowej i tworzą anonimowe statystyki w celu poprawy treści."
    },
    marketing: {
      title: "Pliki cookie marketingowe",
      description: "Używane do wyświetlania ukierunkowanych reklam i mierzenia sukcesu kampanii marketingowych."
    },
    acceptAll: "Zaakceptuj wszystkie",
    rejectOptional: "Odrzuć opcjonalne",
    save: "Zapisz wybór"
  },
  legal: {
    terms: {
      title: "Warunki korzystania",
      content: `Warunki korzystania Arte Moderno s.r.o.

Te warunki korzystania regulują relacje między Arte Moderno s.r.o. a klientami przy zakupie dzieł sztuki przez sklep internetowy pod adresem https://kunstkabinett.cz.

1. Postanowienia wprowadzające

1.1. Operatorem sklepu internetowego jest Arte Moderno s.r.o., ID: 24678821, z siedzibą w Podolská 103/126, 147 00 Praga 4 – Podolí, Republika Czeska, lokale handlowe / galeria: Dominikánské náměstí 656/2, Pałac Jalta, Brno.

1.2. Dane kontaktowe:
- E-mail: info@kunstkabinett.cz
- Strona internetowa: https://kunstkabinett.cz

2. Przedmiot umowy

2.1. Przedmiotem umowy jest sprzedaż dzieł sztuki (obrazów, rzeźb, grafik i innych przedmiotów sztuki) przez sklep internetowy.

2.2. Wszystkie produkty są wyświetlane z opisem, ceną i dostępnością. Arte Moderno s.r.o. zastrzega sobie prawo do zmiany cen i dostępności produktów bez uprzedzenia.

3. Zawarcie umowy kupna

3.1. Umowa kupna jest zawierana w momencie potwierdzenia zamówienia przez Arte Moderno s.r.o.

3.2. Arte Moderno s.r.o. zastrzega sobie prawo do odmowy zamówienia bez podania przyczyny.

4. Cena i płatność

4.1. Ceny produktów są podane z VAT.

4.2. Płatność może być dokonana przelewem bankowym, kartą kredytową lub za pobraniem.

5. Dostawa

5.1. Arte Moderno s.r.o. zapewni dostawę produktów w uzgodnionym terminie.

5.2. Koszty wysyłki są podane przy zamówieniu.

6. Odstąpienie od umowy

6.1. Klient ma prawo odstąpić od umowy w ciągu 14 dni od otrzymania towaru.

6.2. Informacje o prawie odstąpienia są podane w osobnym dokumencie.

7. Reklamacje

7.1. Klient ma prawo złożyć reklamację dotyczącą wadliwego towaru.

7.2. Reklamacje są składane na dane kontaktowe Arte Moderno s.r.o.

8. Postanowienia końcowe

8.1. Te warunki korzystania są regulowane przez porządek prawny Republiki Czeskiej.

8.2. Arte Moderno s.r.o. zastrzega sobie prawo do zmiany tych warunków. Aktualna wersja jest zawsze publikowana na stronie internetowej.`
    },
    privacy: {
      title: "Polityka prywatności",
      content: `Polityka prywatności Arte Moderno s.r.o.

1. Administrator danych

Administratorem danych jest:
Arte Moderno s.r.o., ID: 24678821
siedziba: Podolská 103/126, 147 00 Praga 4 – Podolí, Republika Czeska
lokale handlowe / galeria: Dominikánské náměstí 656/2, Pałac Jalta, Brno
e-mail: info@kunstkabinett.cz

2. Zakres przetwarzanych danych osobowych

Przetwarzamy następujące dane osobowe:
- Imię i nazwisko
- Adres e-mail
- Numer telefonu
- Adres dostawy
- Dane płatności (tylko do przetwarzania płatności)
- Dane zamówienia

3. Cele przetwarzania

Przetwarzamy dane osobowe w celu:
- Wykonania umowy kupna
- Komunikacji z klientem
- Przetwarzania zamówień
- Przetwarzania płatności
- Wykonania obowiązków prawnych
- Działań marketingowych (tylko za zgodą)

4. Podstawa prawna przetwarzania

- Wykonanie umowy (art. 6(1)(b) RODO)
- Uzasadniony interes (art. 6(1)(f) RODO)
- Zgoda (art. 6(1)(a) RODO)
- Obowiązek prawny (art. 6(1)(c) RODO)

5. Okres przechowywania

Przechowujemy dane osobowe przez okres niezbędny do realizacji celów przetwarzania, ale nie dłużej niż okres określony przez prawo.

6. Twoje prawa

Masz prawo:
- Do dostępu do danych osobowych
- Do sprostowania danych osobowych
- Do usunięcia danych osobowych
- Do ograniczenia przetwarzania
- Do przenoszenia danych
- Do wniesienia sprzeciwu wobec przetwarzania
- Do cofnięcia zgody na przetwarzanie

7. Kontakt

W przypadku pytań skontaktuj się z nami: info@kunstkabinett.cz

8. Złożenie skargi

Masz prawo złożyć skargę do Urzędu Ochrony Danych Osobowych (www.uoou.cz).`
    },
    cookies: {
      title: "Polityka plików cookie",
      content: `Arte Moderno s.r.o. – www.kunstkabinett.cz

1. Kto używa plików cookie

Administratorem danych jest:

Arte Moderno s.r.o., ID: 24678821

siedziba: Podolská 103/126, 147 00 Praga 4 – Podolí, Republika Czeska

lokale handlowe / galeria: Dominikánské náměstí 656/2, Pałac Jalta, Brno

e-mail: info@kunstkabinett.cz

Ta polityka plików cookie dotyczy działania sklepu internetowego i strony internetowej pod adresem https://kunstkabinett.cz.

2. Czym są pliki cookie

Pliki cookie to małe pliki tekstowe, które są zapisywane na Twoim urządzeniu (komputer, tablet, telefon komórkowy) podczas odwiedzania stron internetowych. Pozwalają na rozpoznanie Twojego urządzenia, zapamiętują niektóre z Twoich ustawień i pomagają nam zapewnić prawidłowe działanie strony internetowej, mierzyć ruch i poprawiać nasze usługi.

Pliki cookie nie szkodzą Twojemu urządzeniu ani oprogramowaniu i w większości przypadków nie pozwalają na identyfikację konkretnej osoby, a jedynie konkretnego urządzenia.

3. Jakich plików cookie używamy

Na naszej stronie internetowej używamy następujących podstawowych typów plików cookie:

3.1 Niezbędne (techniczne) pliki cookie

Te pliki cookie są niezbędne do podstawowych funkcji strony internetowej i sklepu online, na przykład:

przechowywanie zawartości koszyka,
stopniowe zapisywanie zamówienia,
wyświetlanie strony we właściwym formacie i języku,
bezpieczne logowanie do konta użytkownika (jeśli dostępne).

Bez tych plików cookie strona internetowa i sklep online nie mogą działać prawidłowo. Przetwarzanie opiera się na naszym uzasadnionym interesie w zapewnieniu funkcjonalności strony internetowej.

3.2 Pliki cookie preferencji

Pomagają zapamiętać Twoje wybory (np. język, poprzednie ustawienia) i poprawiają Twój komfort użytkowania. Używamy tych plików cookie tylko wtedy, gdy dasz nam zgodę.

3.3 Analityczne / statystyczne pliki cookie

Służą do pomiaru ruchu na stronie internetowej i tworzenia anonimowych statystyk dotyczących korzystania ze strony (np. które strony są najczęściej odwiedzane, z jakich źródeł pochodzą odwiedzający). Używamy tych informacji do poprawy treści i środowiska użytkownika. Używamy plików cookie analitycznych tylko na podstawie Twojej zgody.

Możemy korzystać z usług stron trzecich (zwykle narzędzi analitycznych internetowych). Tym dostawcom przekazywane są tylko takie dane, które nie są niezbędne do Twojej bezpośredniej identyfikacji.

3.4 Pliki cookie marketingowe

Są używane do wyświetlania ukierunkowanych reklam, przypominania o przeglądanych produktach lub mierzenia sukcesu kampanii marketingowych. Używamy tego typu plików cookie tylko wtedy, gdy dasz nam zgodę przez pasek plików cookie lub ustawienia przeglądarki.

4. Podstawa prawna przetwarzania

Dla niezbędnych (technicznych) plików cookie podstawą prawną jest nasz uzasadniony interes w zapewnieniu funkcjonalności i bezpieczeństwa strony internetowej oraz świadczeniu usług, którymi jesteś zainteresowany (zawarcie i wykonanie umowy kupna).

Dla plików cookie preferencji, analitycznych i marketingowych podstawą prawną jest Twoja zgoda. Możesz cofnąć zgodę w dowolnym momencie – patrz artykuł 5 poniżej.

5. Ustawienia plików cookie i cofnięcie zgody

Przy pierwszej wizycie na naszej stronie internetowej zostanie wyświetlony pasek informacyjny, gdzie możesz:

zezwolić na wszystkie pliki cookie,
odrzucić opcjonalne pliki cookie,
lub wybrać konkretne typy plików cookie, na które się zgadzasz.

Możesz zmienić lub cofnąć zgodę na używanie plików cookie w dowolnym momencie, dostosowując ustawienia przeglądarki internetowej. Większość przeglądarek pozwala na:

wyłączenie przechowywania plików cookie,
ograniczenie ich do określonych typów,
usunięcie już zapisanych plików cookie.

Konkretną procedurę znajdziesz w pomocy swojej przeglądarki (np. w sekcji "Bezpieczeństwo i prywatność" lub "Pliki cookie").

Zauważamy, że blokowanie lub usuwanie niektórych plików cookie (szczególnie niezbędnych) może ograniczyć funkcjonalność naszej strony internetowej i sklepu online, np. nie będzie możliwe zakończenie zamówienia.

6. Okres przechowywania plików cookie

Okres przechowywania plików cookie różni się w zależności od ich typu:

Pliki cookie sesji – zapisywane tylko na czas sesji (wizyty na stronie internetowej) i usuwane po zamknięciu przeglądarki.

Trwałe pliki cookie – pozostają na Twoim urządzeniu przez okres określony w ich ustawieniach lub do ręcznego usunięcia w przeglądarce.

Konkretne okresy przechowywania mogą różnić się w zależności od ustawień poszczególnych narzędzi i dostawców.

7. Pliki cookie stron trzecich

Na naszej stronie internetowej mogą być również używane pliki cookie stron trzecich, w szczególności:

dostawcy usług płatniczych (np. Comgate) – do przetwarzania płatności online,
dostawcy usług transportowych i logistycznych (np. Zásilkovna) – w związku z dostawą paczek,
dostawcy narzędzi analitycznych i marketingowych – do statystyk ruchu i ewentualnego remarketingu.

Te podmioty mają własne polityki prywatności i plików cookie, które możesz sprawdzić na ich stronach internetowych.

8. Związek z ochroną danych osobowych (RODO)

Informacje uzyskane przez pliki cookie mogą w niektórych przypadkach stanowić dane osobowe. W takich przypadkach przetwarzamy je zgodnie z naszą Polityką prywatności (RODO), która szczegółowo reguluje:

zakres przetwarzanych danych osobowych,
cele i podstawy prawne przetwarzania,
okres przechowywania,
Twoje prawa (dostęp, sprostowanie, usunięcie, ograniczenie, przenoszenie, sprzeciw),
możliwości złożenia skargi do Urzędu Ochrony Danych Osobowych.

Zachęcamy do zapoznania się z tymi politykami; są dostępne na naszej stronie internetowej.

9. Dane kontaktowe do zapytań

W przypadku pytań dotyczących plików cookie lub przetwarzania danych osobowych możesz skontaktować się z nami:

e-mailem: info@kunstkabinett.cz

pocztą na adres siedziby: Arte Moderno s.r.o., Podolská 103/126, 147 00 Praga 4 – Podolí

10. Aktualizacje polityki plików cookie

Ta polityka może być od czasu do czasu aktualizowana, szczególnie w związku ze zmianami w przepisach, rozwiązaniach technicznych lub usługach, których używamy na stronie internetowej.

Aktualna wersja jest zawsze publikowana na naszej stronie internetowej.`
    }
  },
  login: {
    title: "Zaloguj się do konta",
    subtitle: "Kontynuuj odkrywanie sztuki współczesnej. Wprowadź swoje dane i zaloguj się.",
    email: "E-mail",
    password: "Hasło",
    forgotPassword: "Zapomniałeś hasła?",
    noAccount: "Nie masz konta? Zarejestruj się",
    submit: "Zaloguj się",
    submitting: "Logowanie…",
    error: "Logowanie nie powiodło się.",
    exploreWorks: "Odkrywaj dzieła",
    howItWorks: "Jak to działa",
    welcomeBack: "Witaj z powrotem"
  },
  register: {
    title: "Utwórz konto",
    subtitle: "Zarejestruj się i zapisz koszyk, zamówienia i ulubione dzieła.",
    name: "Pełne imię",
    email: "E-mail",
    password: "Hasło",
    password2: "Hasło ponownie",
    passwordMin: "min. 8 znaków",
    passwordVerify: "potwierdź hasło",
    agree: "Zgadzam się z",
    terms: "warunkami",
    privacy: "polityką prywatności",
    submit: "Utwórz konto",
    submitting: "Tworzenie konta…",
    hasAccount: "Masz już konto?",
    loginLink: "Zaloguj się",
    browseWorks: "Przeglądaj dzieła",
    alreadyHaveAccount: "Mam już konto",
    createAccount: "Utwórz konto",
    nameRequired: "Proszę wprowadzić imię.",
    emailRequired: "Proszę wprowadzić e-mail.",
    passwordMinLength: "Hasło musi mieć co najmniej 8 znaków.",
    passwordMismatch: "Hasła nie pasują do siebie.",
    agreeRequired: "Musisz zaakceptować warunki, aby utworzyć konto.",
    error: "Rejestracja nie powiodła się.",
    notAvailable: "Rejestracja nie jest dostępna na serwerze (404). Ustaw VITE_REGISTER_PATH."
  },
  resetPassword: {
    resetPassword: "Resetowanie hasła",
    title: "Resetowanie hasła",
    subtitle: "Ustaw nowe hasło do swojego konta. Link e-mailowy ma ograniczenie czasowe.",
    requestSubtitle: "Wprowadź swój e-mail, a wyślemy Ci link do resetowania hasła. Link jest ważny przez 30 minut.",
    email: "E-mail",
    emailRequired: "Proszę wprowadzić e-mail.",
    emailSent: "Jeśli ten e-mail istnieje w systemie, został wysłany link do resetowania hasła.",
    sendEmail: "Wyślij link",
    sending: "Wysyłanie…",
    requestError: "Nie udało się wysłać linku do resetowania hasła.",
    newPassword: "Nowe hasło",
    confirmPassword: "Potwierdź hasło",
    show: "Pokaż",
    hide: "Ukryj",
    submit: "Ustaw nowe hasło",
    saving: "Zapisywanie…",
    backToLogin: "Powrót do logowania",
    missingToken: "Brak lub nieprawidłowy token resetowania w URL.",
    fillBoth: "Proszę wypełnić oba pola hasła.",
    passwordMismatch: "Hasła nie pasują do siebie.",
    passwordMinLength: "Hasło musi mieć co najmniej 8 znaków.",
    success: "Hasło zostało pomyślnie zmienione. Możesz się teraz zalogować.",
    error: "Nie udało się ustawić nowego hasła.",
    notAvailable: "Resetowanie hasła nie jest dostępne.",
    connectionError: "Błąd połączenia. Spróbuj ponownie."
  },
  home: {
    badge: "Wybór kuratora",
    title: "Kolekcja wrześniowa",
    subtitle: "Odkryj współczesne prace wschodzących artystów. Natychmiastowa płatność, bezpieczna dostawa.",
    ctaProducts: "Przeglądaj produkty",
    ctaBlog: "Czytaj blog",
    originals: "Oryginały",
    selectionForYou: "Wybór dla Ciebie:",
    all: "Wszystkie",
    allArtists: "Wszyscy artyści",
    discoverArt: "Odkryj sztukę",
    results: "wyników",
    curated: "kuratorowane",
    sort: "Sortuj:",
    trending: "Popularne",
    loading: "Ładowanie…",
    errorLoading: "Nie udało się załadować galerii.",
    noImage: "brak obrazu",
    detail: "Szczegóły",
    buy: "Kup",
    artistSpotlight: "Artysta w centrum uwagi",
    openWork: "Otwórz dzieło",
    followArtist: "Śledź artystę",
    exploreWorks: "Odkryj dzieła",
    artInsights: "Wglądy w sztukę"
  }
});

const dictionaries = { cs, en, fr, de, ru, zh, ja, it, pl };

// ---- Kontext / provider ----------------------------------------------------
const I18nCtx = createContext(null);

function getInitialLang() {
  const saved = typeof window !== "undefined" ? localStorage.getItem("lang") : null;
  if (saved && dictionaries[saved]) return saved;
  const nav = typeof navigator !== "undefined" ? navigator.language || navigator.userLanguage : "cs";
  const short = (nav || "cs").slice(0, 2).toLowerCase();
  return dictionaries[short] ? short : "cs";
}

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try {
      return getInitialLang();
    } catch (e) {
      console.error('Error getting initial language:', e);
      return 'cs';
    }
  });

  useEffect(() => {
    try { localStorage.setItem("lang", lang); } catch {}
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("lang", lang);
    }
  }, [lang]);

  // Zajisti, ze dict je vzdy objekt
  const dict = useMemo(() => {
    try {
      return dictionaries[lang] || dictionaries.cs || {};
    } catch (e) {
      console.error('Error getting dictionary:', e);
      return dictionaries.cs || {};
    }
  }, [lang]);

  // Vytvor t funkci - musi byt vzdy dostupna
  const t = useMemo(() => {
    const fn = (key, params = {}) => {
      try {
        if (!key) return String(key || '');
        if (!dict || typeof dict !== 'object') {
          console.warn('Dictionary not available, returning key:', key);
          return String(key);
        }
        const parts = String(key).split(".");
        let cur = dict;
        for (const p of parts) {
          if (cur && typeof cur === 'object' && Object.prototype.hasOwnProperty.call(cur, p)) {
            cur = cur[p];
          } else {
            return key; // fallback: vrať klíč
          }
        }
        if (typeof cur === "string") {
          return cur.replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? `{${k}}`));
        }
        // Pokud je to array nebo objekt, vrať to tak jak je
        if (Array.isArray(cur) || (typeof cur === "object" && cur !== null)) {
          return cur;
        }
        return key;
      } catch (e) {
        console.error('Translation error:', e, 'key:', key);
        return String(key || '');
      }
    };
    return fn;
  }, [dict]);

  const value = useMemo(() => {
    if (!t) {
      console.error('Translation function not available');
      const fallbackT = (key) => String(key || '');
      return { lang: lang || 'cs', setLang, t: fallbackT };
    }
    return { lang, setLang, t };
  }, [lang, t]);
  
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nCtx);
  if (!ctx) {
    console.error("useI18n must be used within I18nProvider");
    // Fallback: vrať minimální funkci t(), která vrací klíč
    const fallbackT = (key) => String(key);
    return { lang: 'cs', setLang: () => {}, t: fallbackT };
  }
  return ctx;
}
