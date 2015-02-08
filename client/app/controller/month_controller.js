(function($, angular) {

  var MonthController = function($stateParams, $scope, MovementsRepository, Statistics) {
    var ctrl = this;
    this.month = $stateParams.month;
    this.stat = Statistics.outgoingByCategoryByMonth;

    this.movements = MovementsRepository;
    this.filteredMovements = [];
    this.categories = [];
    this.total = 0;

    if (ctrl.movements.all.length > 0) {
      this.initData();
    }

    $scope.$watch('ctrl.movements.all', function(movements, oldValue) {
      if (movements === oldValue) {
        return;
      }
      ctrl.stat.refresh();
      ctrl.initData();
    });
  };
  MonthController.$inject = ['$stateParams', '$scope', 'MovementsRepository', 'Statistics'];

  MonthController.prototype.initData = function() {
    var ctrl = this;

    var monthIndex = _.findIndex(this.stat.months, function(month) {
      return month.id === ctrl.month;
    });
    if (monthIndex === -1) {
      return;
    }

    this.categories = _.filter(_.map(this.stat.categories, function(category) {
      var cat = angular.copy(category);
      cat.monthTotal = category.data[monthIndex];
      return cat;
    }), function(category) {
      return category.monthTotal > 0;
    });

    var categoriesOrder = {};
    this.categories.forEach(function(category, index) {
      categoriesOrder[category._id] = index+1;
    });

    var movements = _.filter(this.movements.all, function(movement) {
      return movement.direction === 'out'
        && movement.date.format('YYYY-MM') === ctrl.month
        && (!movement.destination || 'bank_account' !== movement.destination.type);
    });
    movements.sort(function(movA, movB) {
      var catA = movA.category ? movA.category._id : null;
      var catB = movB.category ? movB.category._id : null;
      if (catA === catB || !categoriesOrder[catA] && !categoriesOrder[catB]) {
        return movB.date.diff(movA.date);
      } else if (!categoriesOrder[catB]) {
        return -1;
      } else if (!categoriesOrder[catA]) {
        return 1;
      } else if (categoriesOrder[catA] > categoriesOrder[catB]) {
        return 1;
      } else {
        return -1;
      }
    });
    this.filteredMovements = movements;

    this.total = _.reduce(this.categories, function(sum, category) {
      return sum + category.monthTotal;
    }, 0);
  };

  angular.module('Desmond').controller('MonthController', MonthController);

})(window.jQuery, window.angular);