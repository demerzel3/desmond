(function($, angular) {

  var MainController = function($scope, $q, $injector, $modal, FileHasher, RulesContainer,
                                DocumentsRepository, CategoriesRepository, AccountsRepository, MovementsRepository) {
    this.$q = $q;
    this.$injector = $injector;
    this.$modal = $modal;
    this.FileHasher = FileHasher;
    this.RulesContainer = RulesContainer;
    this.documents = DocumentsRepository;
    this.categories = CategoriesRepository;
    this.accounts = AccountsRepository;
    this.movements = MovementsRepository;
    this.filteredMovements = null;
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
    this.selectedItems = [];

    var ctrl = this;
    $scope.$watch('ctrl.movements.all', function(movements, oldValue) {
      if (movements === oldValue) {
        return;
      }
      ctrl.updateFilters();
      ctrl.refreshCharts();
      ctrl.filteredMovements = _.filter(movements, ctrl.movementsFilterFunction);
    });

    $scope.$watchCollection('ctrl.filters', function(newFilters, oldFilters) {
      if (newFilters === oldFilters) {
        return;
      }
      ctrl.filteredMovements = _.filter(ctrl.movements.all, ctrl.movementsFilterFunction);
    });

    // gets executed under the global scope, must be defined in a place where it can access filters independently of "this"
    this.movementsFilterFunction = this.buildMovementsFilterFunction();
  };
  MainController.$inject = [
    '$scope', '$q', '$injector', '$modal', 'FileHasher', 'RulesContainer',
    'DocumentsRepository', 'CategoriesRepository', 'AccountsRepository', 'MovementsRepository'];

  MainController.prototype.importFiles = function(account, files) {
    var ctrl = this;
    //console.log('Importing files for ', account.name);
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
    var $q = this.$q;
    var reader = this.$injector.get(readerName);
    var documents = this.documents;
    return this.FileHasher.hashFile(file).then(function(file) {
      var existingDocument = documents.findByHash(file.hash);
      if (!existingDocument) {
        return file;
      }
      return $q(function(resolve, reject) {
        swal({
          title: 'File già importato',
          html: 'Sembra che tu abbia già importato <strong>' + file.name + '</strong>, eseguire di nuovo l\'importazione potrebbe creare movimenti duplicati.\n'
            + 'Come vuoi procedere?',
          type: "info",
          allowOutsideClick: true,
          showCancelButton: true,
          confirmButtonColor: '#DD6B55',
          confirmButtonText: 'Importa ugualmente',
          cancelButtonText: 'Annulla'
        }, function (isConfirm) {
          if (isConfirm) {
            resolve(file);
          } else {
            reject(new Error('Canceled by user'));
          }
        });
      });
    }).then(function() {
      return reader.read(file);
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

      ctrl.appendMovements(document);
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

      _.each(document.movements, function(mov) {
        mov.account = movement.account;
      });

      ctrl.appendMovements(document).then(function() {
        // on append successful remove the original movement from the list
        ctrl.movements.remove(movement);
      });
    });
  };

  MainController.prototype.appendMovements = function(document) {
    this.applyAllRules(document.movements);

    var modal = this.$modal.open({
      templateUrl: 'components/import_modal.html',
      controller: 'ImportModalController as ctrl',
      size: 'lg',
      windowClass: ['import-modal'],
      resolve: {
        document: function() {
          return document;
        }
      }
    });

    var ctrl = this;
    return modal.result.then(function(movementsToImport) {
      // save document and then movements in it
      return ctrl.documents.add(document).then(function(savedDocument) {
        movementsToImport.forEach(function(movement) {
          movement.document = savedDocument;
        });
        return ctrl.movements.add(movementsToImport);
      });
    });
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

  MainController.prototype.toggleAllSelection = function() {
    if (this.selectedItems.length < this.filteredMovements.length) {
      this.selectedItems = [].concat(this.filteredMovements);
    } else {
      this.selectedItems = [];
    }
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

  MainController.prototype.deleteSelected = function() {
    var ctrl = this;
    swal({
      title: 'Eliminare i movimenti selezionati?',
      type: 'warning',
      allowOutsideClick: true,
      showCancelButton: true,
      confirmButtonColor: '#DD6B55',
      confirmButtonText: 'Elimina '+this.selectedItems.length+' movimenti',
      cancelButtonText: 'Annulla'
    }, function(isConfirm) {
      if (isConfirm) {
        ctrl.selectedItems.forEach(function(movement) {
          ctrl.movements.remove(movement);
        });
      }
    });
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
    return new Chart(canvas.get(0).getContext('2d'));
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

  angular.module('Desmond').controller('MainController', MainController);

})(window.jQuery, window.angular);