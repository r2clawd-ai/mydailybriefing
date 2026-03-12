/**
 * Mock data for development
 */

export const mockBriefingData = [
  {
    section: 'markets',
    icon: '📈',
    title: 'MARKETS',
    articles: [
      {
        id: '1',
        title: 'S&P 500 Hits New Record High on Tech Rally',
        summary: 'Tech stocks led the market higher today as investors digested positive earnings reports from major companies.',
        imageUrl: 'https://picsum.photos/400/200?random=1',
        source: 'Bloomberg',
        timeAgo: '2h ago',
      },
      {
        id: '2',
        title: 'Fed Signals Patience on Rate Cuts',
        summary: 'Federal Reserve officials indicated they are in no rush to lower interest rates despite recent inflation data.',
        source: 'WSJ',
        timeAgo: '3h ago',
      },
    ],
  },
  {
    section: 'local',
    icon: '📰',
    title: 'SIOUX FALLS LOCAL NEWS',
    articles: [
      {
        id: '3',
        title: 'New Downtown Development Approved',
        summary: 'City Council voted 6-3 to approve a $45M mixed-use project on 10th & Phillips. Construction starts spring 2026.',
        imageUrl: 'https://picsum.photos/400/200?random=2',
        source: 'Sioux Falls Business Journal',
        timeAgo: '1h ago',
      },
      {
        id: '4',
        title: 'Smithfield Foods Expands Operations',
        summary: 'Adding 200 jobs and $30M investment in automation. Hiring starts March with $18.50/hr starting wage.',
        source: 'Argus Leader',
        timeAgo: '4h ago',
      },
    ],
  },
  {
    section: 'sports',
    icon: '🏈',
    title: 'SPORTS',
    articles: [
      {
        id: '5',
        title: 'SF Christian Boys Basketball Hosts Baltic Tonight',
        summary: 'Game starts at 7 PM in the SF Christian Gym. Team is 12-3 on the season.',
        source: 'SF Christian Athletics',
        timeAgo: '30m ago',
      },
      {
        id: '6',
        title: 'Vikings Begin Offseason with Draft Prep',
        summary: 'GM Kwesi Adofo-Mensah hints at targeting offensive line in early rounds of 2026 NFL Draft.',
        imageUrl: 'https://picsum.photos/400/200?random=3',
        source: 'ESPN',
        timeAgo: '5h ago',
      },
    ],
  },
  {
    section: 'weather',
    icon: '☀️',
    title: 'WEATHER',
    articles: [
      {
        id: '7',
        title: 'Cold and Cloudy Today, Warming Trend This Weekend',
        summary: 'High 28°F, Low 18°F. Mostly cloudy with NW winds 10-15 mph. Chance of snow: 20%. Weekend temps climb to 35°F Sunday.',
        source: 'Weather.gov',
        timeAgo: 'Updated 6:00 AM',
      },
    ],
  },
];

export const getRandomImage = (width: number = 400, height: number = 200) => {
  const random = Math.floor(Math.random() * 100);
  return `https://picsum.photos/${width}/${height}?random=${random}`;
};
