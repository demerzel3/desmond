const COLORS = [
  '#0D8ECF',
  '#48B040',
  '#B0DE09',
  '#FCD202',
  '#FF6600',
  '#CD0D74',
  '#9900FF',
  '#DDDDDD',
  '#DDDDDD',
  '#DDDDDD',
  '#DDDDDD',
  '#DDDDDD',
  '#DDDDDD',
  '#DDDDDD',
  '#DDDDDD'
];

class TotalByMonthStatistic {
  constructor(MovementsRepository, timeSpan) {
    this.movements = MovementsRepository;
    this.months = [];
    this.incoming = [];

    this.totals = [];
    this.timeSpan = timeSpan;
  }

  _getLastDate() {
    if (this.movements.all.length > 0) {
      return this.movements.all[this.movements.all.length - 1].date;
    } else {
      return new Date();
    }
  }

  refresh() {
    let span = this.timeSpan.get(this._getLastDate());
    let date = span.startDate.clone();
    let months = [];
    let totals = [];

    // infer months from timeSpan
    while (date.diff(span.endDate) < 0) {
      months.push(date.format('YYYY-MM'));
      date.add(1, 'month');
    }
    let monthsIndexMap = _.invert(months);
    months = months.map(function(month) {
      return {
        id: month,
        label: moment(month, 'YYYY-MM').format('MMM-YY')
      }
    });
    totals = months.map(() => 0);
    console.log(totals);

    let movements = this.movements.all.filter((movement) => {
      return movement.date.isBefore(span.endDate);
    });

    movements.forEach((movement) => {
      let monthKey = movement.date.format('YYYY-MM');
      let index = monthsIndexMap[monthKey] || 0;

      totals[index] += movement.amount;
    });

    for (let i = 1; i < totals.length; i++) {
      totals[i] = totals[i] + totals[i-1];
    }

    this.months = months;
    this.totals = totals;
  }
}

export default TotalByMonthStatistic;