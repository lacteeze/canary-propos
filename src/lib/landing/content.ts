export type LandingLang = 'en' | 'fr'

export interface LandingListing {
  id: string
  short: string
  rent: string
  rentN: number
  beds: string
  baths: string
  extra: string
  termType: 'long' | 'mid'
  photo: string
  href: string
}

export interface LandingStay {
  short: string
  town: string
  beds: string
  baths: string
  extra: string
  photo: string
  href: string
}

export const HERO_IMAGES = [
  '/landing/jeffrey-arnaud-ntF3nuaj47I-unsplash.jpg',
  '/landing/gurpreet-singh-UsCCVUXv2Qk-unsplash.jpg',
  '/landing/erik-mclean-JYe98fMiiJw-unsplash.jpg',
  '/landing/laura-lefurgey-smith-Fq3WTAAEFHg-unsplash.jpg',
  '/landing/francis-nie-304OB4_Cd9Q-unsplash.jpg',
] as const

export const CARD_PHOTOS = [
  'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=70&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=70&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800&q=70&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=70&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1560184897-ae75f418493e?w=800&q=70&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&q=70&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1560185007-c5ca9d2c014d?w=800&q=70&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800&q=70&auto=format&fit=crop',
] as const

export const STAY_PHOTOS = [
  'https://images.unsplash.com/photo-1554995207-c18c203602cb?w=800&q=70&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1567767292278-a4f21aa2d36e?w=800&q=70&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=800&q=70&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=800&q=70&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&q=70&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=800&q=70&auto=format&fit=crop',
] as const

export const REVIEWS = [
  { name: 'Danielle S', quote: "They've been a tenant manager, handyman, service procurer, advertising agent, financial guru, and most of all, a comfort. They are in a whole other class." },
  { name: 'Jason P', quote: 'It has taken me until the last year or two to find a property management company I could be irrevocably and supremely confident in.' },
  { name: 'Philippe S', quote: 'Canary separated itself during our search due to timely responses, on-time appointments, and professional insight for reliable Airbnb care while traveling.' },
  { name: 'Catherine B', quote: 'Very professional, extensive background checks of prospective tenants, and very easy to reach when I have questions.' },
  { name: 'Josh & Jess', quote: 'Communication has been on point, relieving a lot of out-of-province stress — right up to finding the tenant for our main floor apartment.' },
  { name: 'Leighanne L', quote: "I'm so happy to have entrusted Canary to manage both units in my house: a long-term rental and an Airbnb when I'm away." },
] as const

export const SIGN_IN_LINKS = [
  { label: 'Admin', href: '/login', dot: 'var(--accent)' },
  { label: 'Manager', href: '/login', dot: 'var(--accent)' },
  { label: 'Owner portal', href: '/login', dot: 'var(--yellow)' },
  { label: 'Tenant portal', href: '/login', dot: 'var(--green)' },
  { label: 'Vendor portal', href: '/login', dot: 'var(--border2)' },
] as const

export function getLandingCopy(lang: LandingLang) {
  if (lang === 'fr') {
    return {
      tNavHomes: 'Maisons',
      tNavOwners: 'Propriétaires',
      tNavHow: 'Fonctionnement',
      tNavFaq: 'FAQ',
      tSearchPh: 'Cherchez une maison ou posez une question…',
      tSearchBusy: 'Un instant, nous cherchons…',
      tAnswerFoot: 'Les réponses sont basées sur nos services et annonces actuelles. Encore incertain?',
      tEmailUs: 'Écrivez-nous',
      tSignIn: 'Se connecter',
      tPortalTitle: 'Choisissez votre portail',
      tHeroBadge: 'ST. JOHN\'S · TERRE-NEUVE · FIÈREMENT LOCAL',
      tHero1: 'La location, enfin',
      tHero2: 'bien faite.',
      tHeroSub: 'Les locataires trouvent des maisons vérifiées qu\'ils aimeront vraiment. Les propriétaires nous confient les appels, les réparations et la paperasse — au mois, sans engagement.',
      tHeroCta1: 'Trouvez votre maison',
      tHeroCta2: 'Je possède un logement',
      tStatHomes: 'maisons affichées',
      tStatSupport: 'soutien aux locataires',
      tStatMonthNum: '2300+',
      tStatMonth: 'clients, locataires et invités satisfaits',
      tScroll: 'DÉFILER',
      tWhyKicker: 'POURQUOI CANARY',
      tBigKicker: 'QU\'EST-CE QUI VOUS AMÈNE?',
      tHomesKicker: 'DISPONIBLE MAINTENANT',
      tHomes1: 'Maisons à',
      tHomes2: 'louer',
      tSeeAllHomes: 'Voir toutes les maisons →',
      tHomesIntro: 'Chaque maison est vérifiée par notre équipe et affichée avec des photos exactes.',
      tBed: 'ch.',
      tBath: 'sdb',
      tPark: 'stat.',
      tStaysKicker: 'SÉJOURS COURTE DURÉE',
      tStays1: 'Séjournez',
      tStays2: 'une nuit ou un mois',
      tSeeAllStays: 'Voir tous les séjours →',
      tStaysIntro: 'Des maisons hébergées professionnellement partout à Terre-Neuve — réservez en direct et évitez les frais de plateforme.',
      tBookDirect: 'RÉSERVATION DIRECTE',
      tOwnKicker: 'POUR LES PROPRIÉTAIRES',
      tOwn1: 'Remettez-nous les clés.',
      tOwn2: 'Reprenez vos soirées.',
      tOwnSub: 'Une seule équipe locale pour le marketing, la sélection, la perception des loyers, l\'entretien et les appels à 2 h du matin — au mois, nous méritons votre confiance chaque 30 jours.',
      tOwnCta: 'Parlez-nous de votre propriété →',
      tFeeKicker: 'STRUCTURE DES FRAIS · TVH EN SUS',
      tPlanIncl: 'Chaque forfait comprend',
      tMaintTitle: 'Entretien',
      tMaintBody: 'Assuré par notre équipe interne et des entrepreneurs de confiance, facturé 50 $/heure plus TVH. Votre approbation est requise pour tout travail de plus de 500 $.',
      tTermsTitle: 'Modalités d\'entente',
      tTermsBody: 'Au mois, toujours — un simple préavis écrit d\'un mois si vous décidez d\'arrêter.',
      tFaqKicker: 'QUESTIONS',
      tFaqH2: 'Foire aux questions',
      tFaqSub: 'Introuvable ici? Posez votre question dans la barre de recherche, ou',
      tNlH2: 'Soyez le premier informé.',
      tNlSub: 'Les nouvelles maisons, avant Facebook et Kijiji. Pas de pourriel — désabonnement en tout temps.',
      tNlBtn: 'M\'aviser',
      tNlSent: '✓ Vous êtes inscrit',
      tContact: 'Contact',
      tHoursHead: 'Heures',
      tExplore: 'Explorer',
      tHours1: 'Lundi — vendredi · 9 h — 17 h',
      tHours2: 'Fins de semaine · Fermé',
      tHours3: 'Soutien locataire · 24/7',
      tFooterBlurb: 'De nouveaux standards pour l\'industrie locative à St. John\'s, Terre-Neuve. Fièrement canadien 🇨🇦',
      tLinkHomes: 'Toutes les maisons disponibles',
      tLinkStays: 'Séjours courte durée (Airbnb)',
      tLinkFaq: 'FAQ',
      tLinkPortal: 'Connexion au portail',
      tPanelWait: 'Un instant',
      tPanelAnswer: 'Réponse',
      tPanelNone: 'Aucun résultat exact — essayez ceci',
      tPanelTry: 'Essayez de demander',
      tAsk: 'Demander',
      tSearch: 'Rechercher',
      petFriendly: '🐾 animaux acceptés',
      longTerm: 'LONG TERME',
      midTerm: 'MOYEN TERME',
      sleeps: 'pour ',
      revealText: 'Louer à St. John\'s devrait être simple. Nous vérifions chaque maison, répondons à chaque appel à toute heure, et traitons votre propriété comme la nôtre — c\'est toute l\'idée.',
      marquee: ' LOCATION · GESTION LONG TERME · GESTION AIRBNB · ENTRETIEN · SOUTIEN 24/7 · ST. JOHN\'S · MOUNT PEARL · PARADISE · ',
      bigRows: [
        { num: '01', word: 'Louer', tail: 'une maison que vous aimerez', sub: 'Des annonces vérifiées avec photos exactes — ce que vous voyez est ce que vous louez.', href: '#homes' },
        { num: '02', word: 'Posséder', tail: 'sans le stress', sub: 'Gestion complète à partir de 10 % du loyer. Au mois, sans engagement.', href: '#how' },
        { num: '03', word: 'Séjourner', tail: 'une nuit ou un mois', sub: 'Séjours de courte durée partout à Terre-Neuve, hébergement professionnel.', href: '#stays' },
      ],
      steps: [
        { num: '01', title: 'Nous l\'affichons correctement', body: 'Photographie professionnelle et marketing sur toutes les plateformes qui comptent — Facebook, Instagram, Kijiji et notre site.' },
        { num: '02', title: 'Nous trouvons le bon locataire', body: 'Sélection complète de chaque candidat, préparation du bail, perception du dépôt et coordination de l\'emménagement.' },
        { num: '03', title: 'Nous nous occupons du reste', body: 'Perception des loyers, relevés mensuels, inspections, entretien et soutien 24/7. Vous recevez un rapport; ils ont un excellent propriétaire.' },
      ],
      services: [
        { name: 'Gestion long terme', price: '12 % du loyer mensuel', features: 'Propriétés individuelles\nPerception et rapports\nSoutien 24/7' },
        { name: 'Rabais multi-unités', price: '10 % du loyer mensuel', features: 'Pour plusieurs unités\nou propriétés' },
        { name: 'Courte durée (Airbnb)', price: '25 % des revenus', features: 'Annonce et marketing\nRotations d\'invités\nSoutien 24/7' },
        { name: 'Frais de location', price: '100 % — ou 50 % pour les clients en gestion', features: 'Publicité et visites\nSélection des locataires\nBail et emménagement\nBasé sur un bail de 12 mois' },
      ],
      checklist: [
        'Photographie professionnelle',
        'Marketing en ligne multiplateforme',
        'Sélection rigoureuse des locataires et invités',
        'Préparation des baux et réservations',
        'Perception des loyers et paiements',
        'Relevés mensuels aux propriétaires',
        'Inspections régulières',
        'Soutien 24/7 aux locataires et invités',
        'Gestion des dépôts',
        'Coordination des évictions au besoin',
        'Conformité réglementaire (location et hébergement touristique)',
      ],
      faqs: [
        { q: 'Quelles sont les exigences minimales pour louer?', a: 'Tous les candidats fournissent une pièce d\'identité avec photo, un historique de location, une vérification de crédit, une preuve de revenus suffisants et une vérification d\'antécédents judiciaires. L\'absence d\'historique n\'est pas perçue négativement — mais les documents restent requis.' },
        { q: 'Quel est le montant du dépôt de garantie?', a: 'Les locataires versent 3/4 d\'un mois de loyer en dépôt avant l\'emménagement. S\'il n\'y a aucun dommage causé par le locataire, il est remboursé dans les 10 jours suivant le départ.' },
        { q: 'Combien coûte la gestion immobilière?', a: 'La gestion long terme est de 12 % du loyer mensuel (10 % avec le rabais multi-unités). La gestion Airbnb est de 25 % des revenus. La location coûte 100 % d\'un mois de loyer, réduite à 50 % pour les clients en gestion. Tous les frais sont assujettis à la TVH et le marketing est toujours inclus.' },
        { q: 'Quelle est la durée d\'une entente client?', a: 'Les ententes sont au mois et peuvent être ajustées pour des durées plus courtes ou des situations particulières. Si vous n\'avez plus besoin de nos services, un préavis d\'un mois suffit.' },
        { q: 'Que faire si je dois déménager?', a: 'Les locataires avec bail à durée fixe donnent deux mois de préavis; au mois, un mois de préavis.' },
        { q: 'Et si je veux vendre ma propriété locative?', a: 'Avec un bail à durée fixe, les locataires sont transférés avec la maison. Avec une entente au mois, nous donnons un préavis approprié aux locataires ou aidons à transférer leur location aux nouveaux propriétaires.' },
        { q: 'Comment allez-vous annoncer mon logement?', a: 'Nous utilisons les plateformes les plus actives — Facebook, Instagram, Kijiji et notre site web — et la publicité est incluse dans nos services de location et de gestion.' },
      ],
      suggestions: [
        { label: '« Propriétés 2 chambres à St. John\'s »', q: '2 bedroom properties in St. John\'s', ask: false },
        { label: '« Maisons acceptant les animaux sous 1 500 $ »', q: 'pet friendly homes under $1,500', ask: false },
        { label: '« Combien coûte la gestion immobilière? »', q: 'Combien coûte la gestion immobilière?', ask: true },
        { label: '« Quel est le montant du dépôt de garantie? »', q: 'Quel est le montant du dépôt de garantie?', ask: true },
      ],
      matches: (n: number) => `${n} maison${n === 1 ? '' : 's'} correspondante${n === 1 ? '' : 's'}`,
      countLine: (n: number) =>
        n
          ? `${n} maison${n === 1 ? ' est disponible' : 's sont disponibles'} en ce moment — les nouvelles annonces de notre équipe apparaissent dès leur publication.`
          : 'Les nouvelles annonces de notre équipe apparaissent ici dès leur publication.',
    }
  }

  return {
    tNavHomes: 'Homes',
    tNavOwners: 'Owners',
    tNavHow: 'How it works',
    tNavFaq: 'FAQ',
    tSearchPh: 'Search homes or ask a question…',
    tSearchBusy: 'Looking that up for you…',
    tAnswerFoot: 'Answers are based on our services and current listings. Still unsure?',
    tEmailUs: 'Email us',
    tSignIn: 'Sign in',
    tPortalTitle: 'Choose your portal',
    tHeroBadge: 'ST. JOHN\'S · NEWFOUNDLAND · PROUDLY LOCAL',
    tHero1: 'Renting, finally',
    tHero2: 'done right.',
    tHeroSub: 'Tenants find verified homes they\'ll actually love. Owners hand off the calls, the repairs, and the paperwork — month to month, no lock-in.',
    tHeroCta1: 'Find your home',
    tHeroCta2: 'I own a rental',
    tStatHomes: 'homes listed now',
    tStatSupport: 'tenant support',
    tStatMonthNum: '2300+',
    tStatMonth: 'happy clients, tenants & guests',
    tScroll: 'SCROLL',
    tWhyKicker: 'WHY CANARY',
    tBigKicker: 'WHAT BRINGS YOU HERE?',
    tHomesKicker: 'AVAILABLE NOW',
    tHomes1: 'Homes for',
    tHomes2: 'lease',
    tSeeAllHomes: 'See all homes →',
    tHomesIntro: 'Every home is verified by our team and listed with accurate photos.',
    tBed: 'bed',
    tBath: 'bath',
    tPark: 'parking',
    tStaysKicker: 'SHORT-TERM STAYS',
    tStays1: 'Stay a',
    tStays2: 'night or a month',
    tSeeAllStays: 'See all stays →',
    tStaysIntro: 'Professionally hosted homes across Newfoundland — book direct and skip the platform fees.',
    tBookDirect: 'BOOK DIRECT',
    tOwnKicker: 'FOR PROPERTY OWNERS',
    tOwn1: 'Hand us the keys.',
    tOwn2: 'Take back your evenings.',
    tOwnSub: 'One local team for marketing, screening, rent collection, maintenance, and 2 a.m. phone calls — month to month, we earn your business every 30 days.',
    tOwnCta: 'Tell us about your property →',
    tFeeKicker: 'FEE STRUCTURE · SUBJECT TO HST',
    tPlanIncl: 'Every plan includes',
    tMaintTitle: 'Maintenance',
    tMaintBody: 'Handled by our in-house team and trusted contractors, billed at $50/hour plus HST. We get your sign-off before any job over $500.',
    tTermsTitle: 'Agreement terms',
    tTermsBody: 'Month-to-month, always — just one month\'s written notice if you ever decide to stop.',
    tFaqKicker: 'QUESTIONS',
    tFaqH2: 'Frequently asked',
    tFaqSub: 'Can\'t find it here? Ask the search bar above in plain English, or',
    tNlH2: 'Be first to new listings.',
    tNlSub: 'New homes, before they hit Facebook and Kijiji. No spam — unsubscribe anytime.',
    tNlBtn: 'Notify me',
    tNlSent: '✓ You\'re on the list',
    tContact: 'Contact',
    tHoursHead: 'Hours',
    tExplore: 'Explore',
    tHours1: 'Monday — Friday · 9 am — 5 pm',
    tHours2: 'Weekends · Closed',
    tHours3: 'Tenant support · 24/7',
    tFooterBlurb: 'Creating new rental industry standards in St. John\'s, Newfoundland. Proudly Canadian 🇨🇦',
    tLinkHomes: 'All available homes',
    tLinkStays: 'Short-term stays (Airbnb)',
    tLinkFaq: 'FAQ',
    tLinkPortal: 'Portal sign-in',
    tPanelWait: 'One moment',
    tPanelAnswer: 'Answer',
    tPanelNone: 'No exact matches — try one of these',
    tPanelTry: 'Try asking',
    tAsk: 'Ask',
    tSearch: 'Search',
    petFriendly: '🐾 pet friendly',
    longTerm: 'LONG TERM',
    midTerm: 'MID TERM',
    sleeps: 'sleeps ',
    revealText: 'Renting in St. John\'s should feel effortless. We verify every home, answer every call at any hour, and treat your property like it\'s our own — that\'s the whole idea.',
    marquee: ' LEASING · LONG-TERM MANAGEMENT · AIRBNB MANAGEMENT · MAINTENANCE · 24/7 SUPPORT · ST. JOHN\'S · MOUNT PEARL · PARADISE · ',
    bigRows: [
      { num: '01', word: 'Rent', tail: 'a home you\'ll love', sub: 'Verified listings with accurate photos — what you see is what you rent.', href: '#homes' },
      { num: '02', word: 'Own', tail: 'without the stress', sub: 'Full-service management from 10% of rent. Month to month, no lock-in.', href: '#how' },
      { num: '03', word: 'Stay', tail: 'a night or a month', sub: 'Short-term stays across Newfoundland, professionally hosted.', href: '#stays' },
    ],
    steps: [
      { num: '01', title: 'We list it properly', body: 'Professional photography and marketing across every platform that matters — Facebook, Instagram, Kijiji, and our own site.' },
      { num: '02', title: 'We find the right tenant', body: 'Full screening on every applicant, plus lease or booking preparation, deposit collection, and move-in coordination.' },
      { num: '03', title: 'We handle everything after', body: 'Rent collection, monthly statements, inspections, maintenance, and 24/7 support. You get a report; they get a great landlord.' },
    ],
    services: [
      { name: 'Long-Term Management', price: '12% of monthly rent', features: 'For single properties\nRent collection & reports\n24/7 tenant support' },
      { name: 'Multi-Unit Discount', price: '10% of monthly rent', features: 'When managing multiple\nunits or properties' },
      { name: 'Short-Term (Airbnb)', price: '25% of rental revenue', features: 'Listing & marketing\nGuest turnovers\n24/7 guest support' },
      { name: 'Leasing Fee', price: '100% — or 50% for management clients', features: 'Advertising & showings\nTenant screening\nLease prep & move-in\nBased on a 12-month lease' },
    ],
    checklist: [
      'Professional property photography',
      'Online marketing across multiple platforms',
      'Comprehensive tenant & guest screening',
      'Lease and/or booking preparation',
      'Rent collection and payment processing',
      'Monthly owner statements and reporting',
      'Regular property inspections',
      '24/7 tenant and guest support',
      'Deposit collection and administration',
      'Eviction coordination if required',
      'Compliance with tenancy & tourist accommodation regulations',
    ],
    faqs: [
      { q: 'What are the minimum requirements to rent?', a: 'All applicants provide a valid photo ID, rental history, credit check, proof of sufficient income, and a criminal background check. A lack of rental or credit history is not viewed negatively — but the documentation is still required.' },
      { q: 'How much is the damage deposit?', a: 'Tenants provide 3/4 of one month\'s rent as a damage deposit before moving in. If there\'s no tenant-caused damage, it\'s refunded within 10 days of moving out.' },
      { q: 'What does property management cost?', a: 'Long-term rental management is 12% of monthly rent (10% with our multi-unit discount). Short-term Airbnb management is 25% of rental revenue. Leasing is 100% of one month\'s rent, discounted to 50% for management clients. All fees are subject to HST, and marketing is always included.' },
      { q: 'How long does a client agreement last?', a: 'Client agreements are month-to-month and can be adjusted for shorter terms or unique situations. If you no longer need our services, we simply ask for a month\'s notice.' },
      { q: 'What if I need to move out?', a: 'Tenants on a fixed-term lease give two months\' notice; month-to-month tenants give one month\'s notice.' },
      { q: 'What if I want to sell my rental property?', a: 'With a fixed-term lease, tenants simply transfer with the home. With month-to-month agreements, we provide tenants proper notice or help transfer their tenancy to the new owners.' },
      { q: 'How will you advertise my rental?', a: 'We use the most active platforms — Facebook, Instagram, Kijiji, and our website — and advertising is included with our leasing and management services.' },
    ],
    suggestions: [
      { label: '"2 bedroom properties in St. John\'s"', q: '2 bedroom properties in St. John\'s', ask: false },
      { label: '"Pet friendly homes under $1,500"', q: 'pet friendly homes under $1,500', ask: false },
      { label: '"What does property management cost?"', q: 'What does property management cost?', ask: true },
      { label: '"How much is the damage deposit?"', q: 'How much is the damage deposit?', ask: true },
    ],
    matches: (n: number) => `${n} matching home${n === 1 ? '' : 's'}`,
    countLine: (n: number) =>
      n
        ? `${n} home${n === 1 ? ' is' : 's are'} available right now — new listings from our team appear here the moment they're published.`
        : 'New listings from our team appear here the moment they\'re published.',
  }
}

export function getDefaultStays(): LandingStay[] {
  const copy = getLandingCopy('en')
  return [
    { short: 'Downtown loft', town: "St. John's", beds: '2', baths: '1', extra: `${copy.sleeps}4`, photo: STAY_PHOTOS[0], href: 'https://airbnb.ca/p/canarypm' },
    { short: 'Waterfront suite', town: "St. John's", beds: '1', baths: '1', extra: `${copy.sleeps}2`, photo: STAY_PHOTOS[1], href: 'https://airbnb.ca/p/canarypm' },
    { short: 'Heritage row house', town: 'Mount Pearl', beds: '3', baths: '2', extra: `${copy.sleeps}6`, photo: STAY_PHOTOS[2], href: 'https://airbnb.ca/p/canarypm' },
    { short: 'Garden cottage', town: 'Paradise', beds: '2', baths: '1', extra: `${copy.sleeps}4`, photo: STAY_PHOTOS[3], href: 'https://airbnb.ca/p/canarypm' },
  ]
}

export function answerFaqQuestion(question: string, lang: LandingLang): string | null {
  const copy = getLandingCopy(lang)
  const q = question.trim().toLowerCase()
  if (!q) return null

  const hit = copy.faqs.find((faq) => {
    const fq = faq.q.toLowerCase()
    return fq.includes(q) || q.includes(fq.replace(/\?/g, '').slice(0, 20))
  })
  if (hit) return hit.a

  if (/deposit|dépôt|garantie/i.test(q)) {
    return copy.faqs.find((f) => /deposit|dépôt/i.test(f.q))?.a ?? null
  }
  if (/cost|price|fee|frais|coût|management/i.test(q)) {
    return copy.faqs.find((f) => /cost|frais|coût/i.test(f.q))?.a ?? null
  }
  if (/require|exigence|rent/i.test(q)) {
    return copy.faqs.find((f) => /require|exigence/i.test(f.q))?.a ?? null
  }

  return lang === 'fr'
    ? 'Je n\'ai pas trouvé une réponse exacte — écrivez à info@canarypm.ca ou appelez (709) 200-9626 et nous vous aiderons.'
    : 'I couldn\'t find an exact answer — please email info@canarypm.ca or call (709) 200-9626 and we\'ll help right away.'
}
