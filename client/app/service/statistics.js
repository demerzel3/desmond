(function(Service) {

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
        startDate: now.clone().subtract(months, 'months').startOf('month'),
        endDate: now.clone().endOf('month')
      }
    };
  };

  var timeSpans = {
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
    this.timeSpan = null;
  };
  OutgoingByCategoryByMonthStatistic.prototype.refresh = function() {
    var movements = _.filter(_.where(this.movements.all, {direction: 'out'}), function(movement) {
      return !movement.destination || 'bank_account' !== movement.destination.type;
    });

    // TODO: use timeSpan to infer months
    var months = [/*"2014-01", "2014-02", "2014-03", "2014-04", "2014-05", "2014-06",*/
      "2014-07", "2014-08", "2014-09", "2014-10", "2014-11", "2014-12", "2015-01"];
    var monthsIndexMap = _.invert(months);
    months = months.map(function(month) {
      return {
        id: month,
        label: moment(month, 'YYYY-MM').format('MMM-YY')
      }
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
    });

    this.categories = categories.reverse();
    this.months = months;
  };



  var Statistics = function(AccountsRepository, CategoriesRepository, MovementsRepository) {
    this.accounts = AccountsRepository;
    this.categories = CategoriesRepository;
    this.movements = MovementsRepository;

    this.timeSpans = timeSpans;
    this.outgoingByCategoryByMonth = new OutgoingByCategoryByMonthStatistic(MovementsRepository);
  };
  Statistics.$inject = ['AccountsRepository', 'CategoriesRepository', 'MovementsRepository'];

  Statistics.prototype.refresh = function() {
    this.outgoingByCategoryByMonth.refresh();
  };

  Service.service('Statistics', Statistics);

})(angular.module('Desmond.Service'));