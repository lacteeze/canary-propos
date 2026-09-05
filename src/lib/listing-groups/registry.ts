import { APARTMENT_TYPES, HOUSE_TYPES } from './match'
import type { ListingGroupDef } from './types'

const POPULATED_LEAD =
  'Canary has {count} {noun} in {place} from {minRent}/month, as of {asOf}.'
const EMPTY_LEAD =
  'No {noun} listed today in {place}. Join the waitlist — Canary manages 150+ units across the Northeast Avalon.'

function cityCrumbs(path: string, label: string): ListingGroupDef['crumbs'] {
  return [
    { label: 'Rentals', path: '' },
    { label, path },
  ]
}

export const LISTING_GROUPS: ListingGroupDef[] = [
  {
    path: '',
    kind: 'index',
    h1: "Homes for rent in St. John's and the Northeast Avalon",
    title: "Rentals in St. John's, NL | Canary Property Management",
    description:
      "Browse verified long-term rentals managed by Canary in St. John's, Paradise, Mount Pearl, and nearby Newfoundland towns. Current homes, honest prices, local team.",
    place: "St. John's and the Northeast Avalon",
    noun: 'homes',
    answerLead: POPULATED_LEAD,
    emptyLead: EMPTY_LEAD,
    body: [
      "Canary Property Management lists the homes we actually manage — houses, duplexes, and apartments across St. John's and the towns around it. What you see here is current inventory, not a feed scraped from other sites.",
      'Most tenants come through us looking for a long-term lease they can view this week. Mid-term furnished homes show up here too when owners want a shorter stay. Short-term stays live on the homepage, not on these pages.',
      'If nothing fits today, use the waitlist. We turn units over year-round and will email you when a match publishes.',
    ],
    faqs: [
      {
        q: "Where does Canary have rentals?",
        a: "Most homes are in St. John's and Paradise. We also manage properties in Mount Pearl, Conception Bay South, Torbay, Portugal Cove–St. Philip's, Clarke's Beach, and Dildo when owners list with us.",
      },
      {
        q: 'Are these listings exclusive to Canary?',
        a: 'Yes. These are units we manage. You apply and book viewings with our leasing team, not a third-party portal.',
      },
      {
        q: 'How often do new rentals appear?',
        a: 'Whenever a unit is ready to show. Inventory turns with lease ends — often late spring and late summer, but we publish year-round.',
      },
    ],
    related: ['st-johns', 'paradise', '2-bedroom', 'pet-friendly'],
    match: { kind: 'all' },
    crumbs: [{ label: 'Rentals', path: '' }],
  },
  {
    path: 'st-johns',
    kind: 'city',
    h1: "Apartments and houses for rent in St. John's, NL",
    title: "St. John's Rentals | Canary PM",
    description:
      "Current houses and apartments for rent in St. John's, Newfoundland. Browse Canary-managed homes by bedroom, neighbourhood, and pet policy.",
    place: "St. John's",
    noun: 'homes',
    answerLead: POPULATED_LEAD,
    emptyLead: EMPTY_LEAD,
    body: [
      "St. John's is where most of our long-term tenants live — walkable downtown streets, the east end near Quidi Vidi, and the west end toward Mundy Pond and the Southside.",
      'Winter driving and hill parking matter here. Ask us about driveway vs street parking and who clears snow before you sign. Heat is usually electric baseboard or oil; the listing will say which, and whether utilities are included.',
      'Downtown and Churchill Square suit people who work or study near the harbour or Memorial. Families often look farther out toward the east end or over the overpass in Paradise.',
    ],
    faqs: [
      {
        q: "What parts of St. John's does Canary lease in?",
        a: "Downtown, the east end, and the west end, plus scattered homes in other city neighbourhoods. Use the neighbourhood pages if you already know the area.",
      },
      {
        q: 'Do you have rentals near Memorial University?',
        a: 'When we do, they usually sit on the downtown or Churchill Square side of town. Check the live list on this page and the 1-bedroom and 2-bedroom hubs.',
      },
      {
        q: 'Is parking included?',
        a: 'Many city homes include a driveway spot; downtown walk-ups sometimes do not. Each card shows the parking count we have on file.',
      },
    ],
    related: ['st-johns/downtown', 'st-johns/2-bedroom', 'pet-friendly', 'houses'],
    match: { kind: 'city', citySlug: 'st-johns' },
    crumbs: cityCrumbs('st-johns', "St. John's"),
  },
  {
    path: 'mount-pearl',
    kind: 'city',
    h1: 'Houses and apartments for rent in Mount Pearl, NL',
    title: 'Mount Pearl Rentals | Canary PM',
    description:
      'Homes for rent in Mount Pearl, Newfoundland. Join the Canary waitlist if nothing is listed today — we manage units across the Northeast Avalon.',
    place: 'Mount Pearl',
    noun: 'homes',
    answerLead: POPULATED_LEAD,
    emptyLead: EMPTY_LEAD,
    body: [
      'Mount Pearl sits between St. John\'s and Paradise — a short drive to the Health Sciences Centre, the Village Mall, and the arterial roads over the overpass.',
      'Tenants usually want a driveway, a quieter street than downtown, and a commute that does not depend on harbour-side parking. Oil and electric heat are both common; confirm who pays before you apply.',
      'We do not always have a Mount Pearl home on the market. This page stays up so you can watch inventory and join the waitlist when you want that town specifically.',
    ],
    faqs: [
      {
        q: 'Does Canary often have Mount Pearl rentals?',
        a: 'Less often than St. John\'s or Paradise. When an owner lists with us, the home appears here immediately.',
      },
      {
        q: 'How long is the commute into St. John\'s?',
        a: 'Typically 15–25 minutes to downtown or the Health Sciences Centre, longer in a winter storm. Most tenants drive.',
      },
      {
        q: 'Are Mount Pearl homes usually houses?',
        a: 'Yes — detached and duplex stock is more common here than walk-up apartments.',
      },
    ],
    related: ['paradise', 'st-johns', 'houses', ''],
    match: { kind: 'city', citySlug: 'mount-pearl' },
    crumbs: cityCrumbs('mount-pearl', 'Mount Pearl'),
  },
  {
    path: 'paradise',
    kind: 'city',
    h1: 'Houses for rent in Paradise, NL',
    title: 'Paradise Rentals | Canary PM',
    description:
      'Family homes and units for rent in Paradise, Newfoundland. Current Canary listings with parking, heat type, and move-in dates.',
    place: 'Paradise',
    noun: 'homes',
    answerLead: POPULATED_LEAD,
    emptyLead: EMPTY_LEAD,
    body: [
      'Paradise is the overpass town tenants pick when they want a driveway, a yard, and a newer house rather than a downtown walk-up.',
      'Commutes into St. John\'s are straightforward on a clear day and slower after snow. Most of our Paradise homes have at least one parking space; several have more.',
      'Expect electric baseboard, oil, or a mix. Ask us which, and whether snow clearing is tenant or landlord work — that detail matters more here than on Water Street.',
    ],
    faqs: [
      {
        q: 'Are Paradise rentals mostly houses?',
        a: 'Yes. The Paradise homes we manage are typically detached or semi-detached, often three bedrooms or more.',
      },
      {
        q: 'Is Paradise good without a car?',
        a: 'Possible but harder. Bus service exists; most tenants drive to work in town.',
      },
      {
        q: 'Do you allow pets in Paradise?',
        a: 'Some homes do, some do not. Filter the pet-friendly hub or read the card chips on this page.',
      },
    ],
    related: ['st-johns', 'houses', '3-bedroom', 'pet-friendly'],
    match: { kind: 'city', citySlug: 'paradise' },
    crumbs: cityCrumbs('paradise', 'Paradise'),
  },
  {
    path: 'conception-bay-south',
    kind: 'city',
    h1: 'Homes for rent in Conception Bay South, NL',
    title: 'Conception Bay South Rentals | Canary PM',
    description:
      'Rentals in Conception Bay South (CBS), Newfoundland. Always-on Canary page — join the waitlist when no homes are listed.',
    place: 'Conception Bay South',
    noun: 'homes',
    answerLead: POPULATED_LEAD,
    emptyLead: EMPTY_LEAD,
    body: [
      'Conception Bay South stretches along the highway from Topsail toward Holyrood. Tenants who work in town trade a longer commute for more house and a view of the bay.',
      'We list CBS homes when an owner we manage has a vacancy. If this page is empty, that is honest — not a broken filter.',
      'Winter driving on the Foxtrap Access and Team Gushue is the real constraint. If you need to be in St. John\'s every day at 8 a.m., factor storm days into the lease decision.',
    ],
    faqs: [
      {
        q: 'Is CBS the same as Conception Bay South?',
        a: 'Yes. Locals say CBS. This page matches both.',
      },
      {
        q: 'How far is CBS from downtown St. John\'s?',
        a: 'Usually 25–40 minutes depending on which part of CBS and the weather.',
      },
      {
        q: 'Should I wait for a CBS listing or look in Paradise?',
        a: 'If commute time matters more than the bay, Paradise and Mount Pearl turn over more often. Use the waitlist if CBS is a hard requirement.',
      },
    ],
    related: ['paradise', 'mount-pearl', 'houses', ''],
    match: { kind: 'city', citySlug: 'conception-bay-south' },
    crumbs: cityCrumbs('conception-bay-south', 'Conception Bay South'),
  },
  {
    path: 'torbay',
    kind: 'city',
    h1: 'Homes for rent in Torbay, NL',
    title: 'Torbay Rentals | Canary PM',
    description:
      'Houses for rent in Torbay, Newfoundland. Canary lists managed homes when they are vacant — join the waitlist to hear first.',
    place: 'Torbay',
    noun: 'homes',
    answerLead: POPULATED_LEAD,
    emptyLead: EMPTY_LEAD,
    body: [
      'Torbay sits on the northeast edge of the metro, past Logy Bay Road and the airport corridor. People move here for quieter streets and a shorter hop to the east end than CBS provides.',
      'Inventory is thin. This page exists so a Torbay search still reaches a real local manager instead of a dead filter.',
      'Expect to need a car. The Outer Ring makes the Health Sciences Centre and Stavanger Drive reachable; downtown is longer in traffic.',
    ],
    faqs: [
      {
        q: 'Do you currently manage homes in Torbay?',
        a: 'When a Torbay owner lists with us, the home appears on this page. If the list is empty, we have no published vacancy there today.',
      },
      {
        q: 'Is Torbay close to the airport?',
        a: 'Yes — closer than downtown or Paradise. Useful if you fly often or work nearby.',
      },
      {
        q: 'What should I do if I need a Torbay rental now?',
        a: 'Join the waitlist on this page and also browse St. John\'s east-end homes, which sit on the same side of town.',
      },
    ],
    related: ['st-johns/east-end', 'st-johns', 'houses', ''],
    match: { kind: 'city', citySlug: 'torbay' },
    crumbs: cityCrumbs('torbay', 'Torbay'),
  },
  {
    path: 'portugal-cove',
    kind: 'city',
    h1: "Homes for rent in Portugal Cove–St. Philip's, NL",
    title: "Portugal Cove–St. Philip's Rentals | Canary PM",
    description:
      "Rentals in Portugal Cove–St. Philip's, Newfoundland. Join Canary's waitlist when no homes are listed.",
    place: "Portugal Cove–St. Philip's",
    noun: 'homes',
    answerLead: POPULATED_LEAD,
    emptyLead: EMPTY_LEAD,
    body: [
      "Portugal Cove–St. Philip's is the Bell Island ferry side of the metro — hills, ocean, and a drive into town that feels farther than the map suggests in winter.",
      'We include St. Philip\'s under this page. If you searched either name, you are in the right place.',
      'Vacancies are uncommon. Use the waitlist; in the meantime Paradise and the St. John\'s west end are the usual substitutes.',
    ],
    faqs: [
      {
        q: "Does this page include St. Philip's?",
        a: "Yes. Portugal Cove and St. Philip's are one municipality. Listings in either name appear here.",
      },
      {
        q: 'Is the ferry useful for tenants?',
        a: 'Only if you travel to Bell Island. Most tenants here commute into St. John\'s by car.',
      },
      {
        q: 'Are these homes furnished?',
        a: 'Usually not. When a unit is furnished we say so on the listing itself.',
      },
    ],
    related: ['paradise', 'st-johns/west-end', 'houses', ''],
    match: { kind: 'city', citySlug: 'portugal-cove' },
    crumbs: cityCrumbs('portugal-cove', "Portugal Cove–St. Philip's"),
  },
  {
    path: 'clarkes-beach',
    kind: 'city',
    h1: "Homes for rent in Clarke's Beach, NL",
    title: "Clarke's Beach Rentals | Canary PM",
    description:
      "Houses and units for rent in Clarke's Beach, Newfoundland. Outer-bay Canary listings when a vacancy is published.",
    place: "Clarke's Beach",
    noun: 'homes',
    answerLead: POPULATED_LEAD,
    emptyLead: EMPTY_LEAD,
    body: [
      "Clarke's Beach is out the bay — past CBS, on the way toward Bay Roberts. These homes suit people who work locally, work remotely, or accept a long winter drive into town.",
      'Do not expect downtown amenities. Do expect more space for the rent, and a quieter street.',
      'We sometimes group Clarke\'s Beach with Dildo on the homepage browse. Here they stay separate so a search for this town lands on this town.',
    ],
    faqs: [
      {
        q: "How far is Clarke's Beach from St. John's?",
        a: 'Plan on about an hour in good weather. Storm days take longer. This is not a daily downtown commute for most people.',
      },
      {
        q: 'Are utilities usually included?',
        a: 'Often no — confirm on the listing. Electric heat on a larger house adds up in February.',
      },
      {
        q: 'Do you also list in Dildo?',
        a: 'Yes, on its own page. The two towns are nearby but not the same search.',
      },
    ],
    related: ['dildo', 'conception-bay-south', 'houses', ''],
    match: { kind: 'city', citySlug: 'clarkes-beach' },
    crumbs: cityCrumbs('clarkes-beach', "Clarke's Beach"),
  },
  {
    path: 'dildo',
    kind: 'city',
    h1: 'Homes for rent in Dildo, NL',
    title: 'Dildo Rentals | Canary PM',
    description:
      'Waterfront and village homes for rent in Dildo, Newfoundland. Current Canary listings when a managed home is vacant.',
    place: 'Dildo',
    noun: 'homes',
    answerLead: POPULATED_LEAD,
    emptyLead: EMPTY_LEAD,
    body: [
      'Dildo is a small Trinity Bay village. The homes we manage there are usually houses, sometimes waterfront, and aimed at people who want the bay more than a short commute.',
      'Internet and parking matter as much as bedroom count. Read the listing — we say when internet is included.',
      'If you need to be in St. John\'s five days a week, look at Paradise or town first. If you want quiet and a view, stay on this page.',
    ],
    faqs: [
      {
        q: 'Is Dildo a practical commute to St. John\'s?',
        a: 'It is a long drive — roughly 90 minutes. Treat it as a local or remote-work home unless you already make that trip.',
      },
      {
        q: 'Are Dildo rentals pet friendly?',
        a: 'Some are. Check the card chips or the pet-friendly hub, which includes outer-bay homes when they allow pets.',
      },
      {
        q: 'Why is Dildo on a St. John\'s property manager\'s site?',
        a: 'We manage homes our owners hold, including outer-bay properties. If it is published here, we are the landlord contact.',
      },
    ],
    related: ['clarkes-beach', 'pet-friendly', 'houses', ''],
    match: { kind: 'city', citySlug: 'dildo' },
    crumbs: cityCrumbs('dildo', 'Dildo'),
  },
  {
    path: 'st-johns/downtown',
    kind: 'neighborhood',
    h1: "Downtown St. John's apartments and houses for rent",
    title: "Downtown St. John's Rentals | Canary PM",
    description:
      "Homes for rent downtown St. John's — Water, Duckworth, Wood, Casey, and nearby streets. Walkable listings managed by Canary.",
    place: "downtown St. John's",
    noun: 'homes',
    answerLead: POPULATED_LEAD,
    emptyLead: EMPTY_LEAD,
    body: [
      'Downtown here means the harbour side of town: Water and Duckworth, the Battery and Signal Hill approaches, Wood Street, Casey, Golf, and the streets that walk to George Street and the Basilica.',
      'You trade parking ease for walkability. Street parking and hills are the winter conversation. Ask who shovels before you book a viewing.',
      'If a St. John\'s listing is not on this page, it did not match our downtown street list and is still on the city page.',
    ],
    faqs: [
      {
        q: 'Which streets count as downtown on this page?',
        a: 'Harbour-side and immediately adjacent streets — Water, Duckworth, Gower, Wood, Casey, Signal Hill, Bonaventure, and similar. East End and West End have their own pages.',
      },
      {
        q: 'Can I live downtown without a car?',
        a: 'Yes more easily than anywhere else we lease. Groceries, work, and nightlife are walkable; winter sidewalks still take planning.',
      },
      {
        q: 'Are downtown units smaller?',
        a: 'Often. One-bedrooms and older houses are more common than new suburban four-beds.',
      },
    ],
    related: ['st-johns', 'st-johns/1-bedroom', 'st-johns/east-end', 'apartments'],
    match: { kind: 'neighborhood', citySlug: 'st-johns', neighborhood: 'downtown' },
    crumbs: [
      { label: 'Rentals', path: '' },
      { label: "St. John's", path: 'st-johns' },
      { label: 'Downtown', path: 'st-johns/downtown' },
    ],
  },
  {
    path: 'st-johns/east-end',
    kind: 'neighborhood',
    h1: "East End St. John's homes for rent",
    title: "East End St. John's Rentals | Canary PM",
    description:
      "East End St. John's rentals — Quidi Vidi, Cavell, Halls, Forest Road side of town. Canary-managed homes when listed.",
    place: "the East End of St. John's",
    noun: 'homes',
    answerLead: POPULATED_LEAD,
    emptyLead: EMPTY_LEAD,
    body: [
      'The east end runs from Quidi Vidi and The Boulevard out toward Logy Bay Road, Virginia, and the streets off Torbay Road inside the city.',
      'Tenants pick it for trails, the lake, and a faster run to the airport than the west end. It is still St. John\'s — not Torbay — unless the listing city says Torbay.',
      'Homes that do not match these streets stay on the St. John\'s page only. We do not force every A1A address into this hub.',
    ],
    faqs: [
      {
        q: 'Is Pleasantville included?',
        a: 'Yes, when the street matches. Military and hospital commutes from this side of town are straightforward.',
      },
      {
        q: 'How is this different from Torbay?',
        a: 'Torbay is its own town past the city line. East End listings are inside St. John\'s.',
      },
      {
        q: 'Are these homes good for families?',
        a: 'Often yes — more driveways and three-bedroom houses than downtown walk-ups.',
      },
    ],
    related: ['st-johns', 'torbay', 'st-johns/3-bedroom', 'houses'],
    match: { kind: 'neighborhood', citySlug: 'st-johns', neighborhood: 'east-end' },
    crumbs: [
      { label: 'Rentals', path: '' },
      { label: "St. John's", path: 'st-johns' },
      { label: 'East End', path: 'st-johns/east-end' },
    ],
  },
  {
    path: 'st-johns/west-end',
    kind: 'neighborhood',
    h1: "West End St. John's homes for rent",
    title: "West End St. John's Rentals | Canary PM",
    description:
      "West End St. John's rentals — Pennywell, Pleasant, Southside, LeMarchant side of town. Current Canary listings.",
    place: "the West End of St. John's",
    noun: 'homes',
    answerLead: POPULATED_LEAD,
    emptyLead: EMPTY_LEAD,
    body: [
      'West End on this site means Pennywell, Pleasant, LeMarchant, Blackmarsh, the Southside, and the streets that drain toward Mundy Pond and the Waterford Valley.',
      'You are closer to the Village, the overpass, and Mount Pearl than to Signal Hill. Parking is usually easier than downtown; hills and snow still apply.',
      'Southlands and other unmatched streets stay on the city page until staff tag a neighbourhood or we add the street.',
    ],
    faqs: [
      {
        q: 'Is the Southside the West End?',
        a: 'We include Southside Road here because tenants searching west-side homes expect it. It is its own pocket — read the listing address.',
      },
      {
        q: 'Easy to reach Paradise from here?',
        a: 'Yes. This is the side of town that connects to the overpass without crossing downtown.',
      },
      {
        q: 'Do west-end homes allow pets?',
        a: 'Mixed. Use the pet-friendly hub if that is non-negotiable.',
      },
    ],
    related: ['st-johns', 'mount-pearl', 'pet-friendly', 'houses'],
    match: { kind: 'neighborhood', citySlug: 'st-johns', neighborhood: 'west-end' },
    crumbs: [
      { label: 'Rentals', path: '' },
      { label: "St. John's", path: 'st-johns' },
      { label: 'West End', path: 'st-johns/west-end' },
    ],
  },
  {
    path: '1-bedroom',
    kind: 'beds',
    h1: "1 bedroom apartments for rent in St. John's and nearby",
    title: "1 Bedroom Rentals | Canary PM",
    description:
      "One-bedroom homes for rent across St. John's, Paradise, and the Northeast Avalon. Current Canary inventory with prices and move-in dates.",
    place: 'the Northeast Avalon',
    noun: 'one-bedroom homes',
    answerLead: POPULATED_LEAD,
    emptyLead: EMPTY_LEAD,
    body: [
      'One-bedrooms in this market are often a floor of a house, a downtown unit, or a smaller Paradise suite — not a high-rise tower.',
      'Price tracks heat and parking more than square footage. A one-bed with utilities included can beat a cheaper POU unit once February power bills arrive.',
      'If you need exactly St. John\'s, use the city plus 1-bedroom page. This hub includes every town we list.',
    ],
    faqs: [
      {
        q: 'Are 1-bedrooms usually downtown?',
        a: 'Many are, but we also list one-beds in Paradise and other towns. This page is metro-wide.',
      },
      {
        q: 'Can two people rent a 1-bedroom?',
        a: 'Usually yes, subject to the lease and occupancy sense for the unit. Ask when you inquire.',
      },
      {
        q: 'Do 1-bedrooms come furnished?',
        a: 'Sometimes, especially mid-term leases. The listing description says so when they do.',
      },
    ],
    related: ['st-johns/1-bedroom', '2-bedroom', 'apartments', 'st-johns'],
    match: { kind: 'beds', min: 1, max: 1 },
    crumbs: [
      { label: 'Rentals', path: '' },
      { label: '1 bedroom', path: '1-bedroom' },
    ],
  },
  {
    path: '2-bedroom',
    kind: 'beds',
    h1: "2 bedroom apartments and houses for rent",
    title: "2 Bedroom Rentals | Canary PM",
    description:
      "Two-bedroom homes for rent in St. John's, Paradise, and nearby Newfoundland towns. Live prices from Canary Property Management.",
    place: 'the Northeast Avalon',
    noun: 'two-bedroom homes',
    answerLead: POPULATED_LEAD,
    emptyLead: EMPTY_LEAD,
    body: [
      'Two bedrooms is the search most couples and small households run in this market. You will see both downtown houses and suburban units on this page.',
      'Compare parking and heat, not just rent. A $200 gap disappears if one home includes a driveway and the other is street-only on a hill.',
      'For St. John\'s-only results, open the St. John\'s 2-bedroom page. Outer-bay two-beds (Dildo, Clarke\'s Beach) appear here when published.',
    ],
    faqs: [
      {
        q: 'Is a 2-bedroom the most common rental you list?',
        a: 'It is one of the two busiest searches, alongside 3-bedroom houses in Paradise and town.',
      },
      {
        q: 'Will a 2-bedroom work for a small family?',
        a: 'Often yes. Check square footage and whether the second room is a real bedroom, not a den.',
      },
      {
        q: 'Do you list 2-bedroom apartments or only houses?',
        a: 'Both, when we have them. Use the apartments and houses hubs to split the type.',
      },
    ],
    related: ['st-johns/2-bedroom', '1-bedroom', '3-bedroom', 'houses'],
    match: { kind: 'beds', min: 2, max: 2 },
    crumbs: [
      { label: 'Rentals', path: '' },
      { label: '2 bedroom', path: '2-bedroom' },
    ],
  },
  {
    path: '3-bedroom',
    kind: 'beds',
    h1: '3 bedroom houses for rent on the Northeast Avalon',
    title: '3 Bedroom Rentals | Canary PM',
    description:
      'Three-bedroom and larger homes for rent in St. John\'s, Paradise, and nearby towns. Family houses managed by Canary.',
    place: 'the Northeast Avalon',
    noun: 'three-bedroom and larger homes',
    answerLead: POPULATED_LEAD,
    emptyLead: EMPTY_LEAD,
    body: [
      'This hub is three bedrooms and up — family houses in Paradise, town, and wherever else we have a vacancy that size.',
      'Expect driveways, higher heat bills, and a longer viewing checklist (yard, storage, school run). We put parking and pet policy on the card so you can scan fast.',
      'Four-bedroom homes are included here. There is no separate 4-bedroom URL.',
    ],
    faqs: [
      {
        q: 'Does 3-bedroom include 4-bedroom homes?',
        a: 'Yes. Anything with three or more bedrooms lands on this page.',
      },
      {
        q: 'Where are most 3-bedroom rentals?',
        a: 'Paradise and residential St. John\'s more than downtown walk-ups.',
      },
      {
        q: 'Are larger homes pet friendly?',
        a: 'More often than downtown one-beds, but not always. Check the pet-friendly hub.',
      },
    ],
    related: ['st-johns/3-bedroom', 'paradise', 'houses', 'pet-friendly'],
    match: { kind: 'beds', min: 3 },
    crumbs: [
      { label: 'Rentals', path: '' },
      { label: '3 bedroom', path: '3-bedroom' },
    ],
  },
  {
    path: 'apartments',
    kind: 'type',
    h1: "Apartments and condos for rent in St. John's, NL",
    title: 'Apartments for Rent | Canary PM',
    description:
      'Apartment and condo rentals managed by Canary in St. John\'s and nearby towns. Current units with rent, beds, and availability.',
    place: 'the Northeast Avalon',
    noun: 'apartments and condos',
    answerLead: POPULATED_LEAD,
    emptyLead: EMPTY_LEAD,
    body: [
      'Apartment on this site means a unit in an apartment building or a condo — not a whole house. Houses, duplexes, and townhouses live on the houses page.',
      'Many St. John\'s “apartments” people search for are actually a floor of a house. Those appear under houses. If you want a purpose-built or condo unit, stay here.',
      'When this list is short, it is because our portfolio is house-heavy, not because the page is broken.',
    ],
    faqs: [
      {
        q: 'Why is a house unit not on this page?',
        a: 'If the property type is house, duplex, or townhouse it goes to Houses. Apartment building and condo go here.',
      },
      {
        q: 'Do apartments include laundry?',
        a: 'It varies. In-unit laundry is called out on the listing when we have it.',
      },
      {
        q: 'Are condos treated as apartments?',
        a: 'Yes for this hub. The listing still shows the real address and building rules.',
      },
    ],
    related: ['houses', 'st-johns', '1-bedroom', '2-bedroom'],
    match: { kind: 'type', types: APARTMENT_TYPES },
    crumbs: [
      { label: 'Rentals', path: '' },
      { label: 'Apartments', path: 'apartments' },
    ],
  },
  {
    path: 'houses',
    kind: 'type',
    h1: "Houses for rent in St. John's, Paradise, and nearby",
    title: 'Houses for Rent | Canary PM',
    description:
      'Houses, duplexes, and townhouses for rent on the Northeast Avalon. Canary-managed homes with parking and current rent.',
    place: 'the Northeast Avalon',
    noun: 'houses',
    answerLead: POPULATED_LEAD,
    emptyLead: EMPTY_LEAD,
    body: [
      'Most Canary vacancies are houses — detached, duplex, or townhouse. That is the local stock, and it is what this page filters to.',
      'You get a front door, usually parking, and more heat to think about. Read whether oil or electric is the system; it changes the monthly number.',
      'Apartment-building and condo units are excluded here on purpose.',
    ],
    faqs: [
      {
        q: 'Does “houses” include duplexes?',
        a: 'Yes. House, duplex, and townhouse all qualify.',
      },
      {
        q: 'Will I have a yard?',
        a: 'Often, not always. The listing photos and description are the source of truth.',
      },
      {
        q: 'Are houses more expensive than apartments?',
        a: 'Usually, because they are larger. Compare rent per bedroom and whether heat is included.',
      },
    ],
    related: ['apartments', 'paradise', '3-bedroom', 'pet-friendly'],
    match: { kind: 'type', types: HOUSE_TYPES },
    crumbs: [
      { label: 'Rentals', path: '' },
      { label: 'Houses', path: 'houses' },
    ],
  },
  {
    path: 'pet-friendly',
    kind: 'amenity',
    h1: "Pet friendly rentals in St. John's and nearby",
    title: 'Pet Friendly Rentals | Canary PM',
    description:
      'Pet-friendly houses and apartments for rent in St. John\'s, Paradise, and nearby towns. Cats, dogs, or pets by approval — listed by Canary.',
    place: 'the Northeast Avalon',
    noun: 'pet-friendly homes',
    answerLead: POPULATED_LEAD,
    emptyLead: EMPTY_LEAD,
    body: [
      'Pet-friendly here means the listing or unit notes allow pets, cats, dogs, or pets by approval. “No pets” homes are excluded.',
      'Approval still matters. A “by approval” home is not a guarantee for every breed or a second dog. Tell us the animal when you inquire.',
      'Newfoundland winters are easier with a driveway and a place to shake off snow. We show parking on every card.',
    ],
    faqs: [
      {
        q: 'Does pet-friendly mean all pets are allowed?',
        a: 'No. It means the home is not a no-pets unit. Restrictions can still apply. We confirm on inquiry.',
      },
      {
        q: 'Do I pay extra for a pet?',
        a: 'Sometimes an additional deposit or clause applies. We will say so before you sign. We do not quote statutory maximums on this page — ask us for the current lease terms.',
      },
      {
        q: 'Can I see only dog-friendly homes?',
        a: 'Cards that say dog-friendly are the closest filter today. Inquire and we will confirm the rule for that address.',
      },
    ],
    related: ['st-johns', 'houses', '2-bedroom', ''],
    match: { kind: 'amenity', amenity: 'pets' },
    crumbs: [
      { label: 'Rentals', path: '' },
      { label: 'Pet friendly', path: 'pet-friendly' },
    ],
  },
  {
    path: 'st-johns/1-bedroom',
    kind: 'city-beds',
    h1: "1 bedroom apartments for rent in St. John's, NL",
    title: "1 Bedroom St. John's Rentals | Canary PM",
    description:
      "One-bedroom homes for rent in St. John's, Newfoundland. Current Canary listings with rent and availability.",
    place: "St. John's",
    noun: 'one-bedroom homes',
    answerLead: POPULATED_LEAD,
    emptyLead: EMPTY_LEAD,
    body: [
      'This is the St. John\'s-only one-bedroom list — downtown floors, side-street houses, and anything else we have in the city with one bedroom.',
      'Paradise and outer-bay one-beds are on the metro 1-bedroom page, not here.',
      'If you work downtown or at Memorial and do not want a daily overpass drive, start here.',
    ],
    faqs: [
      {
        q: 'Why is a Paradise 1-bedroom missing?',
        a: 'This page is city-only. Open the metro 1-bedroom hub for every town.',
      },
      {
        q: 'Are these mostly furnished?',
        a: 'Mid-term one-beds sometimes are. Long-term units are usually unfurnished.',
      },
      {
        q: 'Can I get a 1-bedroom with parking in town?',
        a: 'Yes, on some streets. The card parking count is the first filter; we confirm at viewing.',
      },
    ],
    related: ['1-bedroom', 'st-johns', 'st-johns/downtown', 'st-johns/2-bedroom'],
    match: { kind: 'city-beds', citySlug: 'st-johns', min: 1, max: 1 },
    crumbs: [
      { label: 'Rentals', path: '' },
      { label: "St. John's", path: 'st-johns' },
      { label: '1 bedroom', path: 'st-johns/1-bedroom' },
    ],
  },
  {
    path: 'st-johns/2-bedroom',
    kind: 'city-beds',
    h1: "2 bedroom apartments for rent in St. John's, NL",
    title: "2 Bedroom St. John's Rentals | Canary PM",
    description:
      "Two-bedroom apartments and houses for rent in St. John's, NL. Live inventory from Canary Property Management.",
    place: "St. John's",
    noun: 'two-bedroom homes',
    answerLead: POPULATED_LEAD,
    emptyLead: EMPTY_LEAD,
    body: [
      'The high-intent search: two bedrooms, in the city, from a local manager. This page is only St. John\'s.',
      'Scan rent, parking, and pet chips first. Then open the address page for heat, photos, and a viewing request.',
      'Paradise two-beds are on the metro 2-bedroom page if you will cross the overpass.',
    ],
    faqs: [
      {
        q: 'Is this the page for “2 bedroom apartment St. John\'s”?',
        a: 'Yes. Houses with two bedrooms in the city are included too — local stock is house-heavy.',
      },
      {
        q: 'How current is the list?',
        a: 'It is published inventory as of the date in the first sentence. Leased homes drop off when we unpublish them.',
      },
      {
        q: 'Can I book a viewing from here?',
        a: 'Open the home for a viewing request, or use the waitlist if the list is empty.',
      },
    ],
    related: ['2-bedroom', 'st-johns', 'st-johns/1-bedroom', 'st-johns/downtown'],
    match: { kind: 'city-beds', citySlug: 'st-johns', min: 2, max: 2 },
    crumbs: [
      { label: 'Rentals', path: '' },
      { label: "St. John's", path: 'st-johns' },
      { label: '2 bedroom', path: 'st-johns/2-bedroom' },
    ],
  },
  {
    path: 'st-johns/3-bedroom',
    kind: 'city-beds',
    h1: "3 bedroom houses for rent in St. John's, NL",
    title: "3 Bedroom St. John's Rentals | Canary PM",
    description:
      "Three-bedroom and larger houses for rent in St. John's, Newfoundland. Family homes managed by Canary.",
    place: "St. John's",
    noun: 'three-bedroom and larger homes',
    answerLead: POPULATED_LEAD,
    emptyLead: EMPTY_LEAD,
    body: [
      'Three-or-more bedroom homes inside St. John\'s — east end, west end, and downtown houses that actually have the rooms.',
      'Paradise family houses are excluded here. Use the metro 3-bedroom hub or the Paradise page for those.',
      'If you need a yard and a driveway in the city, this is the short list.',
    ],
    faqs: [
      {
        q: 'Are 4-bedroom St. John\'s homes included?',
        a: 'Yes. Three bedrooms and up.',
      },
      {
        q: 'Downtown 3-bedrooms — do they exist?',
        a: 'Sometimes, usually as older houses rather than new builds. They appear here when published.',
      },
      {
        q: 'Should I also look in Paradise?',
        a: 'If you want newer stock and more parking, yes. If you need to stay in the city, stay on this page.',
      },
    ],
    related: ['3-bedroom', 'st-johns', 'houses', 'st-johns/east-end'],
    match: { kind: 'city-beds', citySlug: 'st-johns', min: 3 },
    crumbs: [
      { label: 'Rentals', path: '' },
      { label: "St. John's", path: 'st-johns' },
      { label: '3 bedroom', path: 'st-johns/3-bedroom' },
    ],
  },
]

const GROUP_BY_PATH = new Map(LISTING_GROUPS.map((group) => [group.path, group]))

export function listingGroupByPath(path: string): ListingGroupDef | undefined {
  return GROUP_BY_PATH.get(path)
}

export function listingGroupPathFromSegments(segments: string[] | undefined): string {
  return (segments ?? []).join('/')
}

export function allListingGroupPaths(): string[] {
  return LISTING_GROUPS.map((group) => group.path)
}
