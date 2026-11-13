// Texts of the local seed (scripts/seed.ts): books of the seed accounts, in English and Polish.

export interface SeedChapter {
  title: string;
  // Paragraphs of markdown; the first may be a heading.
  paragraphs: string[];
  notes?: string;
  tags?: string[];
  // "public" chapters get a publication date this many days ago; "hidden" ones never had one.
  publication?: "public" | "hidden";
  publishedDaysAgo?: number;
  createdDaysAgo: number;
  adult?: boolean;
  // Soft-deleted: sits in the bin.
  deleted?: boolean;
}

export interface SeedBook {
  owner: string;
  name: string;
  // Plain text for readers (task 98).
  description: string;
  notes: string;
  tags: string[];
  published: boolean;
  adult?: boolean;
  commentsDisabled?: boolean;
  createdDaysAgo: number;
  chapters: SeedChapter[];
}

export const BOOKS: SeedBook[] = [
  {
    owner: "seed_anna",
    name: "Kroniki Mglistej Doliny",
    description:
      "Latarniczka Ila i dolina, z której mgła nigdy nie schodzi. Opowieść w odcinkach o tym, co mgła zabiera i co oddaje.",
    notes:
      "Plan: pięć rozdziałów, finał w wieży. Sprawdzić imiona strażników i mapę doliny.",
    tags: ["fantasy", "adventure", "novel", "mgła"],
    published: true,
    createdDaysAgo: 40,
    chapters: [
      {
        title: "Rozdział 1. Mgła nad rzeką",
        createdDaysAgo: 38,
        publication: "public",
        publishedDaysAgo: 34,
        notes: "Wprowadzić Ilę i jej latarnię.",
        paragraphs: [
          "Mgła przyszła o świcie, jak co roku w dniu przesilenia. Ila stała na moście i patrzyła, jak biała ściana połyka najpierw młyn, potem wierzby, a w końcu drugi brzeg rzeki.",
          "W dolinie mówiło się, że kto zgubi się we mgle, ten wraca po siedmiu dniach albo wcale. Ila nie wierzyła w opowieści starych przewoźników, ale latarnię zawsze nosiła przy pasie, na wszelki wypadek.",
          "Tego ranka mgła pachniała inaczej: dymem, żelazem i czymś słodkim, czego nie umiała nazwać. Gdzieś w bieli zadźwięczał dzwonek, cichy jak oddech.",
          "*Nie idź*, szepnął głos w jej głowie. Ila zapaliła latarnię i zrobiła pierwszy krok.",
        ],
      },
      {
        title: "Rozdział 2. Strażnik mostu",
        createdDaysAgo: 30,
        publication: "public",
        publishedDaysAgo: 20,
        paragraphs: [
          "Po drugiej stronie mostu nie było młyna. Była brama z czarnego drewna i stary człowiek w płaszczu z rybich łusek.",
          "– Spóźniłaś się – powiedział, jakby czekał na nią od lat. – Latarnie gasną szybciej, niż myślisz.",
          "Ila spojrzała na płomień. Rzeczywiście był mniejszy, choć olej sięgał jeszcze połowy szkła. Strażnik uśmiechnął się smutno i otworzył bramę.",
        ],
      },
      {
        title: "Rozdział 3. Miasto bez cieni",
        createdDaysAgo: 12,
        publication: "public",
        publishedDaysAgo: 2,
        paragraphs: [
          "Miasto za bramą było ciche i jasne, choć nigdzie nie widziała słońca. Ludzie chodzili ulicami bez cieni i nikt nie zwracał na nią uwagi.",
          "Na rynku stała wieża zegarowa bez wskazówek. Pod nią dzieci grały w klasy, rysując kredą znaki, które Ila znała z dziecięcych snów.",
          "– Szukasz drogi powrotnej? – zapytała dziewczynka z kredą w dłoni. – Wszyscy jej szukają. Mało kto pamięta, po co przyszedł.",
        ],
      },
      {
        title: "Rozdział 4. Wieża (szkic)",
        createdDaysAgo: 3,
        publication: "hidden",
        paragraphs: [
          "Schody w wieży liczyły tyle stopni, ile dni Ila spędziła we mgle. Na szczycie czekał zegarmistrz.",
          "TODO: rozmowa z zegarmistrzem, wybór Ili.",
        ],
      },
    ],
  },
  {
    owner: "seed_anna",
    name: "Szkice",
    description: "",
    notes: "Luźne pomysły, nic do publikacji.",
    tags: ["short story"],
    published: false,
    createdDaysAgo: 25,
    chapters: [
      {
        title: "Pomysł: listonosz z Księżyca",
        createdDaysAgo: 25,
        paragraphs: [
          "Listonosz, który doręcza listy na Księżyc, ale tylko te, których nikt nie wysłał.",
          "Może jako opowiadanie świąteczne?",
        ],
      },
      {
        title: "Stary początek",
        createdDaysAgo: 24,
        deleted: true,
        paragraphs: ["Było ciemno i padał deszcz. (Za banalne, do kosza.)"],
      },
    ],
  },
  {
    owner: "seed_ben",
    name: "Signals from Kepler Station",
    description:
      "A relay station on the edge of the system starts receiving signals that arrive before they are sent.",
    notes: "Hard SF, keep the physics honest. Check the light delay numbers.",
    tags: ["sci-fi", "short story", "space"],
    published: true,
    createdDaysAgo: 35,
    chapters: [
      {
        title: "Part One: The Quiet Band",
        createdDaysAgo: 33,
        publication: "public",
        publishedDaysAgo: 29,
        paragraphs: [
          "## Day 412",
          "The signal arrived on the quiet band at 03:12 station time, when only Mara was awake to hear it. Three pulses, a pause, then three again, as regular as a heartbeat.",
          "She logged it, filtered it, and ran it through every decoder the station had. Nothing. It was not a probe, not a relay, and not anything the Consortium had ever launched.",
          "By the time the others woke up, the pulses had changed. They were counting down.",
        ],
      },
      {
        title: "Part Two: Light Delay",
        createdDaysAgo: 22,
        publication: "public",
        publishedDaysAgo: 15,
        paragraphs: [
          "Earth was nineteen light-minutes away, which meant every question took almost forty minutes to answer. Mara had stopped waiting for answers.",
          '"If it\'s counting down," said Okafor, "we have about six days. To what, I couldn\'t tell you."',
          "They spent the first day arguing and the second day building an antenna out of spare docking cable. On the third day, the signal answered back.",
        ],
      },
      {
        title: "Part Three: Handshake",
        createdDaysAgo: 8,
        publication: "public",
        publishedDaysAgo: 5,
        paragraphs: [
          "The reply was not a message. It was a map: a lattice of points that took the station computer nine hours to recognise as the local star field, seen from somewhere else.",
          "Somewhere four hundred years in the past, someone had been looking at the same stars and wondering who else was listening.",
          "Mara pressed **send** before anyone could stop her.",
        ],
      },
    ],
  },
  {
    owner: "seed_ben",
    name: "Drafts",
    description: "",
    notes: "",
    tags: [],
    published: false,
    createdDaysAgo: 10,
    chapters: [
      {
        title: "Untitled heist idea",
        createdDaysAgo: 10,
        paragraphs: [
          "A crew that steals time instead of money. Each job costs them a year of memory.",
        ],
      },
    ],
  },
  {
    owner: "seed_clara",
    name: "Velvet Hours",
    description:
      "Two strangers, one hotel, and a week that neither of them planned. For adult readers.",
    notes: "Adult romance. Marked 18+ on purpose.",
    tags: ["romance", "drama"],
    published: true,
    adult: true,
    createdDaysAgo: 28,
    chapters: [
      {
        title: "Chapter 1: The Late Train",
        createdDaysAgo: 27,
        publication: "public",
        publishedDaysAgo: 24,
        adult: true,
        paragraphs: [
          "The last train out of the city was always half empty, and Elena liked it that way. She liked the hum of the rails and the way the windows turned into mirrors after dark.",
          "He sat down across from her at the third stop, soaked from the rain, and apologised to no one in particular. She noticed his hands first, then his voice.",
          "By the end of the line they had shared a sandwich, an umbrella and a secret neither of them meant to tell.",
        ],
      },
      {
        title: "Chapter 2: Morning After",
        createdDaysAgo: 18,
        publication: "public",
        publishedDaysAgo: 11,
        adult: true,
        paragraphs: [
          "The hotel curtains did not quite meet in the middle, and a thin line of morning light fell across the bed.",
          "Elena lay awake listening to the city wake up below and tried to decide whether last night had been a mistake or the start of something.",
          "When he came back with two coffees and a newspaper he could not read, she decided it did not have to be either.",
        ],
      },
    ],
  },
  {
    owner: "seed_clara",
    name: "The House on Wren Street",
    description:
      "A ghost story in three parts about a house that remembers everyone who lived there.",
    notes: "Ghost story in three parts.",
    tags: ["horror", "paranormal"],
    published: true,
    createdDaysAgo: 20,
    chapters: [
      {
        title: "I. The Lease",
        createdDaysAgo: 19,
        publication: "public",
        publishedDaysAgo: 16,
        paragraphs: [
          "The rent was too low, and everyone in the agency knew why. Nobody said it out loud.",
          "Tom signed anyway. He had a new job, no savings and no patience for ghost stories.",
          "On the first night, he heard someone humming in the kitchen. On the second night, the humming learned his name.",
        ],
      },
      {
        title: "II. The Cellar",
        createdDaysAgo: 9,
        publication: "public",
        publishedDaysAgo: 3,
        paragraphs: [
          "The cellar door had been painted shut, but the paint was fresh, and the brush marks went the wrong way, as if someone had painted it from the inside.",
          "Tom found the key in the sugar jar, where no key should be. It was warm.",
        ],
      },
    ],
  },
  {
    owner: "seed_ewa",
    name: "Wiersze na deszcz",
    description: "Krótkie wiersze na jesienne, deszczowe wieczory.",
    notes: "Cykl jesienny.",
    tags: ["poetry", "deszcz"],
    published: true,
    commentsDisabled: true,
    createdDaysAgo: 22,
    chapters: [
      {
        title: "Kałuże",
        createdDaysAgo: 21,
        publication: "public",
        publishedDaysAgo: 21,
        paragraphs: [
          "W kałużach śpi niebo\nz głową na krawężniku,\nktoś przechodzi obok\ni budzi je butem.",
          "Niebo się nie gniewa.\nZbiera chmury z bruku\ni czeka, aż ulica\nznowu zapomni.",
        ],
      },
      {
        title: "Parasol",
        createdDaysAgo: 14,
        publication: "public",
        publishedDaysAgo: 14,
        paragraphs: [
          "Mam parasol po babci,\nczarny, z jedną złamaną szprychą,\nwięc zawsze trochę moknę\nz lewej strony serca.",
        ],
      },
      {
        title: "Listopad",
        createdDaysAgo: 6,
        publication: "public",
        publishedDaysAgo: 1,
        paragraphs: [
          "Listopad pisze po szybach\npalcem zimnym jak klucz,\nlitery spływają w dół,\nnikt nie zdąży przeczytać.",
        ],
      },
    ],
  },
  {
    owner: "seed_admin",
    name: "Moderation notes",
    description: "",
    notes: "Private notes of the admin account.",
    tags: [],
    published: false,
    createdDaysAgo: 30,
    chapters: [
      {
        title: "Checklist",
        createdDaysAgo: 30,
        paragraphs: [
          "- Check the report queue every morning.\n- Review new forum categories.\n- Answer feedback threads.",
        ],
      },
    ],
  },
];
