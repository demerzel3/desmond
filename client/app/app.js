(function($, angular) {

  var MainController = function($scope, $q, $injector, RulesContainer, CategoriesRepository, AccountsRepository) {
    this.$q = $q;
    this.$injector = $injector;
    this.RulesContainer = RulesContainer;
    this.categories = CategoriesRepository;
    this.accounts = AccountsRepository;
    this.files = [];
    this.movements = [];

    var ctrl = this;
    $scope.$watch('ctrl.movements', function(movements, oldValue) {
      if (movements === oldValue) {
        return;
      }
      ctrl.refreshCharts();
    });
  };
  MainController.$inject = ['$scope', '$q', '$injector', 'RulesContainer', 'CategoriesRepository', 'AccountsRepository'];

  MainController.prototype.importFiles = function(account, files) {
    var ctrl = this;
    console.log('Importing files for ', account.name);
    _.each(files, function(file) {
      if ('iwbank' === account.bank) {
        if (file.type == 'application/pdf') {
          ctrl.importFile(account, file, 'IWBankEstrattoContoReader');
        } else {
          ctrl.importFile(account, file, 'IWBankListaMovimentiReader');
        }
      } else if ('bnl' === account.bank) {
        if (file.type == 'application/pdf') {
          ctrl.importFile(account, file, 'BNLEstrattoContoReader');
        } else {
          ctrl.importFile(account, file, 'BNLListaMovimentiReader');
        }
      } else if ('chebanca' === account.bank) {

      }
    });
  };

  MainController.prototype.readFile = function(file, readerName) {
    var reader = this.$injector.get(readerName);
    return reader.read(file).then(function(document) {
      return document;
    });
  };

  MainController.prototype.applyAllRules = function(movements) {
    var RulesContainer = this.RulesContainer;
    _.each(movements, function(movement) {
      RulesContainer.applyAll(movement);
    });
  };

  MainController.prototype.importFile = function(account, file, readerName) {
    var ctrl = this;
    this.readFile(file, readerName).then(function(document) {
      _.each(document.movements, function(movement) {
        movement.account = account;
      });
      ctrl.appendMovements(document.movements);
    });
  };

  MainController.prototype.replaceMovement = function(movement, file) {
    var ctrl = this;
    this.readFile(file, movement.replaceable.reader).then(function(document) {
      if (movement.replaceable.checker) {
        try {
          movement.replaceable.checker(movement, document);
        } catch (e) {
          sweetAlert('Oops..', e.message);
          return;
        }
      }

      // remove the replaced element from the list
      var movementIndex = ctrl.movements.indexOf(movement);
      ctrl.movements.splice(movementIndex, 1);

      _.each(document.movements, function(mov) {
        mov.account = movement.account;
      });
      ctrl.appendMovements(document.movements);
    });
  };

  MainController.prototype.appendMovements = function(movements) {
    this.applyAllRules(movements);
    var newMovements = [];
    _.each(movements, function(movement) {
      if (movement.sourceMovement) {
        newMovements.push(movement.sourceMovement);
      }
      if (movement.destinationMovement) {
        newMovements.push(movement.destinationMovement);
      }
    });
    this.movements = _.sortBy([].concat(this.movements, movements, newMovements), function(movement) {
      return movement.date.toISOString();
    });
  };

  var bySourceChart = null;
  MainController.prototype.refreshCharts = function() {
    if (bySourceChart) {
      //<canvas id="bySourceChart" width="200" height="200"></canvas>
      $('#bySourceChartContainer > canvas').remove();
    }
    $('#bySourceChartContainer').append('<canvas id="bySourceChart" width="200" height="200"></canvas>');
    bySourceChart = new Chart($('#bySourceChartContainer > canvas').get(0).getContext("2d"));

    var movements = _.where(this.movements, {direction: 'in'});
    var sources = _.uniq(_.map(movements, function(movement) {
      return movement.source;
    }));
    //console.log(sources);

    var colors = [
      '#0D8ECF',
      '#48B040',
      '#B0DE09',
      '#FCD202',
      '#FF6600',
      '#CD0D74',
      '#9900FF'
    ];
    var data = _.map(sources, function(source, index) {
      return {
        value: _.reduce(_.where(movements, {source: source}), function(sum, movement) {
          if (movement.source && 'bank_account' === movement.source.type) {
            return sum;
          } else {
            return sum + movement.amount;
          }
        }, 0),
        color: colors[index % colors.length],
        //highlight: "#FF5A5E",
        label: source ? source.name : 'Sconosciuto'
      };
    });
    //console.log(data);

    bySourceChart.Doughnut(data, {
      animation: false,
      tooltipTemplate: 'label + " " + (value | number:2) + " €"'
    });
  };

  var Desmond = angular.module('Desmond', [
    'ngSanitize', 'restangular', 'angular.layout', 'angularFileUpload', 'nl2br',
    'Desmond.Rules', 'Desmond.Reader', 'Desmond.Model'
  ]);

  Desmond.filter('total', function() {
    return function(movements) {
      return _.reduce(movements, function(total, movement) {
        return total + movement.amount;
      }, 0.0);
    }
  });

  // leverage angular $parse to replace the too simplistic templating engine of Charts.js
  Desmond.run(['$parse', function($parse) {
    Chart.helpers.template = function(tpl, data) {
      var getter = $parse(tpl);
      return getter(data);
    };
  }]);

  Desmond.config(['RestangularProvider', function(RestangularProvider) {
    RestangularProvider.setBaseUrl('http://127.0.0.1:8123/desmond');
    RestangularProvider.setRestangularFields({id: '_id'});

    // extract data from the list response of restheart
    RestangularProvider.addResponseInterceptor(function(data, operation, what, url, response, deferred) {
      if (operation === "getList") {
        return data['_embedded']['rh:doc'];
      } else {
        return data;
      }
    });
  }]);

  Desmond.controller('MainController', MainController);

})(window.jQuery, window.angular);