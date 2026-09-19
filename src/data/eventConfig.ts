/**
 * Event configuration. Mirrors the `events` row seeded in SQLite and the
 * branding block returned by GET /api/config. Nothing in the UI should
 * hardcode event copy — read it from here (or from the API response).
 */

export const brand = {
  university: 'Kalasalingam Academy of Research and Education',
  universityShort: 'KALASALINGAM',
  universitySub: 'ACADEMY OF RESEARCH AND EDUCATION',
  deemed: '(Deemed to be University)',
  department: 'Department of Freshman Engineering',
  competition: 'Fresh Coders 2.0',
  competitionUpper: 'FRESH CODERS 2.0',
  tagline: 'CODE • COMPETE • CONQUER',
  motto: 'Knowledge Leads to Freedom',
  quote: 'Code today for a better tomorrow.',
  logos: {
    university: "/ChatGPT_Image_Sep_19,_2026,_01_11_57_PM.png"

  }
} as const;

export const eventConfig = {
  id: 'EV2026',
  name: 'Euphoria 2026',
  subtitle: 'A Techno Management Meet',
  theme: 'Sustainability',
  description:
  'Euphoria 2026 is the annual techno-management meet of Kalasalingam Academy of Research and Education, hosted by the Department of Freshman Engineering.',
  date: '26 September 2026',
  startDate: '2026-09-26',
  endDate: '2026-09-26',
  time: '9:30 AM – 1:00 PM',
  venueBlock: '11th Block',
  venueRooms: 'Room No. 11506 & 11507',
  prizePool: '₹15,000',
  registrationFee: '₹200',
  registrationFeeNote: 'per student',
  eligibility: 'Eligible Students',
  registrationSite: 'euphoria.kalasalingam.ac.in',
  status: 'ACTIVE'
} as const;

export const guidelines = [
'Use a PC or laptop. Mobile devices are not permitted for the examination.',
'Ensure a stable internet connection for the full duration of the test.',
'Do not refresh or navigate away from the page during the test.',
'Once an answer is locked, it cannot be edited without staff approval.',
'Leaving fullscreen or switching tabs is recorded as a monitoring event.',
'Follow all event rules and the instructions given by examination staff.'];


export const contact = {
  email: 'euphoria@klu.ac.in',
  phone: '+91 4563 289 042',
  office: 'Department of Freshman Engineering, 11th Block, KARE Campus'
};