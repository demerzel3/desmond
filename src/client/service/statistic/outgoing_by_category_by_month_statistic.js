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

class OutgoingByCategoryByMonthStatistic {
  constructor(MovementsRepository, timeSpan) {
    this.movements = MovementsRepository;
    this.categories = [];
    this.months = [];
    this.timeSpan = timeSpan;
  }

  getStartDate() {
    if (this.movements.all.length > 0) {
      return this.movements.all[this.movements.all.length - 1].date;
    } else {
      return new Date();
    }
  }

  refresh() {
    var span = this.timeSpan.get(this.getStartDate());
    var date = span.startDate.clone();
    var months = [];

    // infer months from timeSpan
    while (date.diff(span.endDate) < 0) {
      months.push(date.format('YYYY-MM'));
      date.add(1, 'month');
    }
    var monthsIndexMap = _.invert(months);
    months = months.map(function(month) {
      return {
        id: month,
        label: moment(month, 'YYYY-MM').format('MMM-YY')
      }
    });

    var movements = this.movements.all.filter((movement) => {
      return movement.date.isBetween(span.startDate, span.endDate)
        && movement.direction === 'out'
        && (!movement.destination || 'bank_account' !== movement.destination.type);
    });

    var categories = _.uniq(_.pluck(movements, 'category')).filter((category) => {
      return !category || category._id !== 'casa';
    });
    categories = categories.map(function(category, index) {
      return {
        _id: category ? category._id : null,
        name: category ? category.name : 'Non assegnata',
        data: months.map(() => 0),
        total: _.where(movements, {category: category}).reduce((sum, movement) => sum - movement.amount, 0)
      }
    });
    categories = _.sortBy(categories, 'total');

    categories.forEach(function(category, index) {
      category.color = COLORS[(categories.length - index - 1) % COLORS.length];
      var catMovements = movements.filter((movement) => {
        return (!movement.category && category._id == null)
          || (movement.category && movement.category._id === category._id);
      });
      catMovements.forEach(function(movement) {
        var monthKey = movement.date.format('YYYY-MM');
        var index = monthsIndexMap[monthKey];
        if (!_.isUndefined(index)) {
          category.data[index] += -movement.amount;
        }
      });

      category.mean = category.total / (months.length - 1);
    });

    this.categories = categories.reverse();
    this.months = months;
  }
}

export default OutgoingByCategoryByMonthStatistic;