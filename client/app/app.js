(function($, angular) {

  var MainController = function($scope, $q, $injector, RulesContainer, CategoriesRepository, AccountsRepository, MovementsRepository) {
    this.$q = $q;
    this.$injector = $injector;
    this.RulesContainer = RulesContainer;
    this.categories = CategoriesRepository;
    this.accounts = AccountsRepository;
    this.movements = MovementsRepository;
    this.files = [];
    this.sources = [];
    this.destinations = [];
    this.filters = {
      account: null,
      source: null,
      destination: null,
      category: null,
      direction: null
    };
    this.selectedItems = {};
    this.selectedItems.length = 0;

    var ctrl = this;
    $scope.$watch('ctrl.movements.all', function(movements, oldValue) {
      if (movements === oldValue) {
        return;
      }
      ctrl.updateFilters();
      ctrl.refreshCharts();
    });

    // gets executed under the global scope, must be defined in a place where it can access filters independently of "this"
    this.movementsFilterFunction = this.buildMovementsFilterFunction();
  };
  MainController.$inject = ['$scope', '$q', '$injector', 'RulesContainer', 'CategoriesRepository', 'AccountsRepository', 'MovementsRepository'];

  MainController.prototype.deselectItem = function(item) {
    this.selectedItems[item._id] = false;
    this.selectedItems.length--;
  };

  MainController.prototype.selectItem = function(item) {
    this.selectedItems[item._id] = true;
    this.selectedItems.length++;
  };

  MainController.prototype.toggleSelection = function(item) {
    if (this.isSelected(item)) {
      this.deselectItem(item);
    } else {
      this.selectItem(item);
    }
  };

  MainController.prototype.deselectAll = function() {
    this.selectedItems = {length: 0};
  };

  MainController.prototype.isSelected = function(item) {
    return this.selectedItems[item._id];
  };

  MainController.prototype.getSelectedItems = function() {
    var selection = this.selectedItems;
    return _.filter(this.movements, function(movement) {
      return selection[movement._id];
    });
  };

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
        } else {
          ctrl.importFile(account, file, 'BNLListaMovimentiReader');
        }
      } else if ('iwpower' === account.bank) {
        if (file.type == 'application/pdf') {
        } else {
          ctrl.importFile(account, file, 'IWPowerListaMovimentiReader');
        }
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
      var movementIndex = ctrl.movements.all.indexOf(movement);
      ctrl.movements.all.splice(movementIndex, 1);

      _.each(document.movements, function(mov) {
        mov.account = movement.account;
      });
      ctrl.appendMovements(document.movements);
    });
  };

  MainController.prototype.appendMovements = function(movements) {
    this.applyAllRules(movements);
    this.movements.add(movements);
  };

  MainController.prototype.updateFilters = function() {
    // extract sources (for filters)
    var sources = _.where(this.movements.all, {direction: 'in'});
    sources = _.pluck(sources, 'source');
    sources = _.uniq(sources);
    sources = _.filter(sources, function(source) {
      return !!source;
    });
    this.sources = _.sortBy(sources, 'name');

    // extract destinations (for filters)
    var destinations = _.where(this.movements.all, {direction: 'out'});
    destinations = _.pluck(destinations, 'destination');
    destinations = _.uniq(destinations);
    destinations = _.filter(destinations, function(destination) {
      return !!destination;
    });
    this.destinations = _.sortBy(destinations, 'name');
  };

  MainController.prototype.buildMovementsFilterFunction = function() {
    var filters = this.filters;
    return function(movement, index) {

      if (filters.source) {
        if (movement.direction !== 'in') {
          return false;
        }
        if (filters.source._id && movement.source !== filters.source) {
          return false;
        }
        if (!filters.source._id && movement.source) {
          return false;
        }
      }

      if (filters.destination) {
        if (movement.direction !== 'out') {
          return false;
        }
        if (filters.destination._id && movement.destination !== filters.destination) {
          return false;
        }
        if (!filters.destination._id && movement.destination) {
          return false;
        }
      }

      if (filters.category) {
        if (filters.category._id && movement.category !== filters.category) {
          return false;
        }
        if (!filters.category._id && movement.category) {
          return false;
        }
      }

      if (filters.account && movement.account !== filters.account) {
        return false;
      }

      if (filters.direction && movement.direction !== filters.direction) {
        return false;
      }

      return true;
    }
  };


  var CHART_COLORS = [
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
  MainController.prototype.refreshCharts = function() {
    this.buildIncomingBySourceChart();
    this.buildOutgoingByCategoryChart();
  };
  /**
   * Creates a chart inside the specified container, removing the one already in the container (if exists)
   *
   * @param containerId
   */
  MainController.prototype.createChart = function(containerId) {
    var container = $('#'+containerId);
    if (container.find('canvas').length > 0) {
      container.find('canvas').remove();
    }
    var canvas = $('<canvas id="bySourceChart" width="200" height="200"></canvas>');
    container.append(canvas);
    return new Chart(canvas.get(0).getContext("2d"));
  };
  MainController.prototype.buildIncomingBySourceChart = function() {
    var movements = _.where(this.movements.all, {direction: 'in'});
    var sources = _.uniq(_.map(movements, function(movement) {
      return movement.source;
    }));

    var data = _.sortBy(_.map(sources, function(source) {
      return {
        value: _.reduce(_.where(movements, {source: source}), function(sum, movement) {
          if (movement.source && 'bank_account' === movement.source.type) {
            return sum;
          } else {
            return sum + movement.amount;
          }
        }, 0),
        label: source ? source.name : 'Sconosciuta'
      };
    }), 'value').reverse();
    _.each(data, function(dataItem, index) {
      dataItem.color = CHART_COLORS[index % CHART_COLORS.length]
    });

    this.createChart('incomingBySourceChartContainer').Doughnut(data, {
      animation: false,
      tooltipTemplate: 'label + " " + (value | number:2) + " €"'
    });
  };

  MainController.prototype.buildOutgoingByCategoryChart = function() {
    var movements = _.where(this.movements.all, {direction: 'out'});
    var categories = _.filter(_.uniq(_.pluck(movements, 'category')), function(category) {
      return !!category;
    });

    var data = _.sortBy(_.map(categories, function (category) {
      return {
        value: _.reduce(_.where(movements, {category: category}), function (sum, movement) {
          if (movement.destination && 'bank_account' === movement.destination.type) {
            return sum;
          } else {
            return sum - movement.amount;
          }
        }, 0),
        label: category ? category.name : 'Non impostata'
      };
    }), 'value').reverse();
    _.each(data, function (dataItem, index) {
      dataItem.color = CHART_COLORS[index % CHART_COLORS.length]
    });

    this.createChart('outgoingByCategoryChartContainer').Doughnut(data, {
      animation: false,
      tooltipTemplate: 'label + " " + (value | number:2) + " €"'
    });
  };

  var Desmond = angular.module('Desmond', [
    'ngSanitize', 'restangular', 'angular.layout', 'angularFileUpload', 'nl2br',
    'ui.utils',
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
    //RestangularProvider.setBaseUrl('http://127.0.0.1:8123/desmond');
    RestangularProvider.setBaseUrl('http://192.168.1.200:8123/desmond');
    RestangularProvider.setRestangularFields({id: '_id'});

    // extract data from the list response of restheart
    RestangularProvider.addResponseInterceptor(function(data, operation, what, url, response, deferred) {
      if (operation === "getList") {
        if (data['_embedded'] && data['_embedded']['rh:doc']) {
          return data['_embedded']['rh:doc'];
        } else {
          return [];
        }
      } else if (operation === "post") {
        // sometimes data is an empty string, restheart error?
        if (!_.isObject(data)) {
          data = {};
        }
        if (response.status === 201) {
          var urlChunks = response.headers().location.split('/');
          console.log(urlChunks[urlChunks.length - 1]);
          data._id = urlChunks[urlChunks.length - 1];
        } else {
          console.error(response);
        }
        return data;
      } else {
        return data;
      }
    });
  }]);

  Desmond.controller('MainController', MainController);

  $(function () {
    $('[data-toggle="tooltip"]').tooltip()
  })

})(window.jQuery, window.angular);