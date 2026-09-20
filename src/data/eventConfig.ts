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
  office: 'Department of Freshman Engineering, 11th Block, KARE Campus',
  registrationSite: 'euphoria.kalasalingam.ac.in',
} as const;

/**
 * The people who built and run this platform. These are the humans students
 * and staff should reach out to with issues, questions or feedback.
 */
export const team = [
  {
    name: 'Srinath Vatchavari Venkateshan',
    role: 'Full-stack Developer · 1st Year, Mechanical Engineering',
    intro: 'First-year Mechanical Engineering student and the full-stack developer behind this platform — built the whole site, from exam engine to live proctoring.',
    email: 'vvsrinath0@gmail.com',
    github: 'vvsrinath',
    linkedin: 'https://www.linkedin.com/in/srinath-v-a26b372b7/',
    image: '/srinath-profile.png',
  },
  {
    name: 'Sivasubbramaniyan L',
    role: 'Assistant Professor · CSE Department',
    intro: 'Faculty mentor behind Fresh Coders 2.0 — coordinates the event, guidelines and examination staff.',
    email: 'l.sivasubbrmaniyan@klu.ac.in',
    phone: '+91 63834 34021',
    linkedin: 'https://www.linkedin.com/in/siva-subbramaniyan-24406b335/',
    image: '/siva-profile.png',
  },
] as const;

/**
 * Faculty convenors and coordinators for the event.
 */
export const convenors = [
  {
    name: 'Dr. M. Kalpana',
    role: 'Convenor · Professor & Dean, Freshman Engineering',
    phone: '+91 96898 52038',
  },
  {
    name: 'Mr.L.Sivasubbramaniyan',
    role: 'Faculty Mentor · Developer Mentor of this Site · Assistant Professor, CSE',
    phone: '+91 63834 34021',
    highlight: 'faculty-mentor',
  },
  {
    name: 'Dr. S. Gowthaman',
    role: 'School Level Coordinator · Associate Professor, KARE',
    phone: '+91 94868 38520',
  },
  {
    name: 'Dr. K. Mayandi',
    role: 'Assistant Professor, KARE',
  },
  {
    name: 'Dr. Sheik Abdullah',
    role: 'Faculty Coordinator · Assistant Professor, KARE',
  },
  {
    name: 'Ms. G. Jenitha',
    role: 'Faculty Coordinator · Assistant Professor, KARE',
  },
] as const;

export const staffCoordinators = [] as const;

export const studentCoordinators = [
  {
    name: 'Mr.V.V.Srinath',
    role: 'Full Stack Developer · Student Coordinator',
    email: 'vvsrinath0@gmail.com',
  },
  {
    name: 'Ms. Avula Gowthami',
    role: 'Student Coordinator',
  },
  {
    name: 'Ms. R. Kashniha',
    role: 'Student Coordinator',
  },
  {
    name: 'Mr. B. Ponmuklan',
    role: 'Student Coordinator',
    phone: '+91 63801 12049',
  },
  {
    name: 'Mr. P. Pankaj Kumar Reddy',
    role: 'Student Coordinator',
    phone: '+91 70937 59830',
  },
  {
    name: 'Mr. V. Venkateshan',
    role: 'Student Coordinator',
    phone: '+91 88383 27577',
  },
] as const;