import { SOURCES_CHECKED_ON } from '../config/app';
import type { Source } from './schema';

const SEC = 'U.S. Securities and Exchange Commission, Office of Investor Education and Advocacy (Investor.gov)';
const FINRA = 'Financial Industry Regulatory Authority (FINRA)';

/** Every URL below was opened and read on the checkedOn date. */
export const SOURCES: Source[] = [
  {
    id: 'sec-stocks',
    title: 'Stocks – FAQs',
    publisher: SEC,
    url: 'https://www.investor.gov/introduction-investing/investing-basics/investment-products/stocks',
    checkedOn: SOURCES_CHECKED_ON,
  },
  {
    id: 'sec-diversification',
    title: 'Asset Allocation and Diversification',
    publisher: SEC,
    url: 'https://www.investor.gov/introduction-investing/getting-started/asset-allocation',
    checkedOn: SOURCES_CHECKED_ON,
  },
  {
    id: 'sec-order-types',
    title: 'Types of Orders',
    publisher: SEC,
    url: 'https://www.investor.gov/introduction-investing/investing-basics/how-stock-markets-work/types-orders',
    checkedOn: SOURCES_CHECKED_ON,
  },
  {
    id: 'sec-bid-price',
    title: 'Bid Price (glossary)',
    publisher: SEC,
    url: 'https://www.investor.gov/introduction-investing/investing-basics/glossary/bid-price',
    checkedOn: SOURCES_CHECKED_ON,
  },
  {
    id: 'sec-red-flags',
    title: 'Red Flags of Investment Fraud Checklist',
    publisher: SEC,
    url: 'https://www.investor.gov/protect-your-investments/fraud/how-avoid-fraud/red-flags-investment-fraud-checklist',
    checkedOn: SOURCES_CHECKED_ON,
  },
  {
    id: 'sec-social-media-scams',
    title: 'Social Media and Stock Tip Scams – Investor Alert',
    publisher: SEC,
    url: 'https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins/social-media-stock-scams',
    checkedOn: SOURCES_CHECKED_ON,
  },
  {
    id: 'finra-order-types',
    title: 'Order Types',
    publisher: FINRA,
    url: 'https://www.finra.org/investors/investing/investment-products/stocks/order-types',
    checkedOn: SOURCES_CHECKED_ON,
  },
  {
    id: 'finra-stop-orders',
    title: 'Stop Orders: Factors to Consider During Volatile Markets',
    publisher: FINRA,
    url: 'https://www.finra.org/investors/insights/stop-orders-factors-consider-during-volatile-markets',
    checkedOn: SOURCES_CHECKED_ON,
  },
  {
    id: 'finra-frequent-trading',
    title: 'Frequent Intraday Trading: Understanding the Basics',
    publisher: FINRA,
    url: 'https://www.finra.org/investors/insights/frequent-intraday-trading',
    checkedOn: SOURCES_CHECKED_ON,
  },
];

export const sourceById = (id: string) => SOURCES.find((s) => s.id === id);
