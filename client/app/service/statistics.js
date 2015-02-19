  var COLORS = [
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

  var buildMonthsSpanGetter = function(months) {
    return function(now) {
      now = moment(now || new Date());
      return {
        startDate: now.clone().subtract(months-1, 'months').startOf('month'),
        endDate: now.clone().endOf('month')
      }
    };
  };

  var TIME_SPANS = {
    last6months: {
      name: 'last6months',
      label: 'Ultimi 6 mesi',
      get: buildMonthsSpanGetter(6)
    },
    last8months: {
      name: 'last8months',
      label: 'Ultimi 8 mesi',
      get: buildMonthsSpanGetter(8)
    }
  };

  var OutgoingByCategoryByMonthStatistic = function(MovementsRepository) {
    this.movements = MovementsRepository;
    this.categories = [];
    this.months = [];
    this.timeSpan = TIME_SPANS.last6months;
  };
  OutgoingByCategoryByMonthStatistic.prototype.getStartDate = function() {
    if (this.movements.all.length > 0) {
      return this.movements.all[this.movements.all.length - 1].date;
    } else {
      return new Date();
    }
  };
  OutgoingByCategoryByMonthStatistic.prototype.refresh = function() {
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

    var movements = _.filter(this.movements.all, function(movement) {
      return movement.date.isBetween(span.startDate, span.endDate, 'day')
        && movement.direction === 'out'
        && (!movement.destination || 'bank_account' !== movement.destination.type);
    });

    var categories = _.filter(_.uniq(_.pluck(movements, 'category')), function(category) {
      return !category || category._id !== 'casa';
    });
    categories = categories.map(function(category, index) {
      return {
        _id: category ? category._id : null,
        name: category ? category.name : 'Non assegnata',
        data: months.map(function() { return 0 }),
        total: _.reduce(_.where(movements, {category: category}), function (sum, movement) {
          return sum - movement.amount;
        }, 0)
      }
    });
    categories = _.sortBy(categories, 'total');

    categories.forEach(function(category, index) {
      category.color = COLORS[(categories.length - index - 1) % COLORS.length];
      var catMovements = _.filter(movements, function(movement) {
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
  };



  var Statistics = function(AccountsRepository, CategoriesRepository, MovementsRepository) {
    this.accounts = AccountsRepository;
    this.categories = CategoriesRepository;
    this.movements = MovementsRepository;

    this.timeSpans = TIME_SPANS;
    this.outgoingByCategoryByMonth = new OutgoingByCategoryByMonthStatistic(MovementsRepository);
  };
  Statistics.$inject = ['AccountsRepository', 'CategoriesRepository', 'MovementsRepository'];

  Statistics.prototype.refresh = function() {
    this.outgoingByCategoryByMonth.refresh();
  };

  export default Statistics;