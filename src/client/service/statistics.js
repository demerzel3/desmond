import OutgoingByCategoryByMonthStatistic from './statistic/outgoing_by_category_by_month_statistic.js';
import TotalByMonthStatistic from './statistic/total_by_month_statistic.js';

const buildMonthsSpanGetter = function(months) {
  return function(now) {
    now = moment(now || new Date());
    return {
      startDate: now.clone().subtract(months-1, 'months').startOf('month'),
      endDate: now.clone().endOf('month')
    }
  };
};

const TIME_SPANS = {
  last6months: {
    name: 'last6months',
    label: 'Ultimi 6 mesi',
    get: buildMonthsSpanGetter(6)
  },
  last8months: {
    name: 'last8months',
    label: 'Ultimi 8 mesi',
    get: buildMonthsSpanGetter(8)
  },
  last12months: {
    name: 'last12months',
    label: 'Ultimi 12 mesi',
    get: buildMonthsSpanGetter(12)
  },
  last18months: {
    name: 'last18months',
    label: 'Ultimi 18 mesi',
    get: buildMonthsSpanGetter(18)
  },
  last24months: {
    name: 'last24months',
    label: 'Ultimi 24 mesi',
    get: buildMonthsSpanGetter(24)
  },
  last36months: {
    name: 'last36months',
    label: 'Ultimi 36 mesi',
    get: buildMonthsSpanGetter(36)
  }
};


class Statistics {
  constructor(AccountsRepository, CategoriesRepository, MovementsRepository) {
    this.accounts = AccountsRepository;
    this.categories = CategoriesRepository;
    this.movements = MovementsRepository;

    this.timeSpans = TIME_SPANS;
    this.outgoingByCategoryByMonth = new OutgoingByCategoryByMonthStatistic(MovementsRepository, TIME_SPANS.last6months);
    this.totalByMonth = new TotalByMonthStatistic(MovementsRepository, TIME_SPANS.last18months);
  }

  refresh() {
    this.outgoingByCategoryByMonth.refresh();
    this.totalByMonth.refresh();
  }
}
Statistics.$inject = ['AccountsRepository', 'CategoriesRepository', 'MovementsRepository'];

export default Statistics;