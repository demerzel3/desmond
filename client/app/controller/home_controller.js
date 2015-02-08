(function($, angular) {

  var HomeController = function($scope, $q, $injector, $modal, $state, Restangular, FileHasher, RulesContainer, Movement,
                                DocumentsRepository, CategoriesRepository, AccountsRepository, MovementsRepository) {
    this.$q = $q;
    this.$injector = $injector;
    this.$modal = $modal;
    this.$state = $state;
    this.Restangular = Restangular;
    this.FileHasher = FileHasher;
    this.Movement = Movement;
    this.RulesContainer = RulesContainer;
    this.documents = DocumentsRepository;
    this.categories = CategoriesRepository;
    this.accounts = AccountsRepository;
    this.movements = MovementsRepository;
    this.filteredMovements = null;
    this.files = [];
    this.sources = [];
    this.destinations = [];
    this.usedCategories = [];
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
      ctrl.filteredMovements = _.filter(movements, ctrl.movementsFilterFunction, ctrl);
    });

    $scope.$watchCollection('ctrl.filters', function(newFilters, oldFilters) {
      if (newFilters === oldFilters) {
        return;
      }
      ctrl.filteredMovements = _.filter(ctrl.movements.all, ctrl.movementsFilterFunction, ctrl);
    });

    // initialization
    if (this.movements.all.length > 0) {
      ctrl.updateFilters();
      ctrl.refreshCharts();
      ctrl.filteredMovements = _.filter(ctrl.movements.all, ctrl.movementsFilterFunction, ctrl);
    }
  };
  HomeController.$inject = [
    '$scope', '$q', '$injector', '$modal', '$state', 'Restangular', 'FileHasher', 'RulesContainer', 'Movement',
    'DocumentsRepository', 'CategoriesRepository', 'AccountsRepository', 'MovementsRepository'];

  HomeController.prototype.importFiles = function(account, files) {
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

  HomeController.prototype.readFile = function(file, readerName) {
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

  HomeController.prototype.applyAllRules = function(movements) {
    var RulesContainer = this.RulesContainer;
    _.each(movements, function(movement) {
      RulesContainer.applyAll(movement);
    });
  };

  HomeController.prototype.importFile = function(account, file, readerName) {
    var ctrl = this;
    this.readFile(file, readerName).then(function(document) {
      _.each(document.movements, function(movement) {
        movement.account = account;
      });

      ctrl.appendMovements(document);
    });
  };

  HomeController.prototype.replaceMovement = function(movement, file) {
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

  HomeController.prototype.appendMovements = function(document) {
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

  HomeController.prototype.updateFilters = function() {
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

    // extract categories
    var categories = _.pluck(this.movements.all, 'category');
    categories = _.uniq(categories);
    categories = _.filter(categories, function(categories) {
      return !!categories;
    });
    this.usedCategories = _.sortBy(categories, 'name');
  };

  HomeController.prototype.toggleAllSelection = function() {
    if (this.selectedItems.length < this.filteredMovements.length) {
      this.selectedItems = [].concat(this.filteredMovements);
    } else {
      this.selectedItems = [];
    }
  };

  HomeController.prototype.movementsFilterFunction = function(movement) {
    var filters = this.filters;
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
  };

  HomeController.prototype.deleteSelected = function(message) {
    message = message || 'Eliminare i movimenti selezionati?';
    var ctrl = this;
    swal({
      title: message,
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

  HomeController.prototype.mergeSelected = function() {
    // can only be from the same account
    if (_.uniq(_.pluck(this.selectedItems, 'account')).length > 1) {
      sweetAlert('Oops..', 'Non puoi unire movimenti di conti diversi, seleziona solo movimenti dello stesso conto.');
      return;
    }

    // build a new movement from the selected ones
    var amount = _.reduce(this.selectedItems, function(total, movement) {
      return total + movement.amount;
    }, 0);
    if (amount.toFixed(2) === '0.00') {
      return this.deleteSelected('L\'unione degli elementi selezionati dà somma 0, vuoi eliminarli invece di unirli?');
    }

    var Movement = this.Movement;
    var newMovement = new Movement();
    newMovement.date = this.selectedItems[0].date;
    newMovement.executionDate = this.selectedItems[0].executionDate;
    newMovement.amount = amount;
    newMovement.direction = (amount > 0) ? Movement.DIRECTION_IN : Movement.DIRECTION_OUT;
    newMovement.account = this.selectedItems[0].account;
    newMovement.originatedBy = Movement.ORIGINATED_BY_MERGE;
    newMovement.originatedFrom = [].concat(this.selectedItems);
    newMovement.description = _.pluck(this.selectedItems, 'description').join('\n\n');
    newMovement.category = _.reduce(this.selectedItems, function(cat, movement) {
      if (!movement.category) {
        return cat;
      }
      if (_.isUndefined(cat)) {
        return movement.category;
      } else if (cat === movement.category) {
        return cat;
      } else {
        return null;
      }
    }, undefined);
    if (Movement.DIRECTION_IN === newMovement.direction) {
      newMovement.source = _.reduce(this.selectedItems, function(result, movement) {
        if (!movement.source) {
          return result;
        }
        if (_.isUndefined(result)) {
          return movement.source;
        } else if (result === movement.source) {
          return result;
        } else {
          return null;
        }
      }, undefined);
    } else {
      newMovement.destination = _.reduce(this.selectedItems, function(result, movement) {
        if (!movement.destination) {
          return result;
        }
        if (_.isUndefined(result)) {
          return movement.destination;
        } else if (result === movement.destination) {
          return result;
        } else {
          return null;
        }
      }, undefined);
    }

    this.editMovement(newMovement);
  };

  HomeController.prototype.editMovement = function(movement) {
    var Restangular = this.Restangular;
    var isNew = !movement._id;
    var modal = this.$modal.open({
      templateUrl: 'components/edit_modal.html',
      controller: 'EditModalController as ctrl',
      size: 'lg',
      windowClass: ['edit-modal'],
      backdrop: 'static',
      resolve: {
        movement: function() {
          // copy the angular movement, mantaining the references to other objects
          // TODO: move this into the Movement model class?
          var copy = null;
          var LINK_FIELDS = [
            'document', 'account', 'category', 'source',
            'sourceMovement', 'destination', 'destinationMovement',
            'originatedFrom'];

          var savedFields = {};
          _.each(LINK_FIELDS, function (fieldName) {
            savedFields[fieldName] = movement[fieldName];
            movement[fieldName] = null;
          });
          if (isNew) {
            copy = angular.copy(movement);
          } else {
            copy = Restangular.copy(movement);
          }
          _.each(LINK_FIELDS, function (fieldName) {
            copy[fieldName] = savedFields[fieldName];
            movement[fieldName] = savedFields[fieldName];
          });
          return copy;
        }
      }
    });

    var ctrl = this;
    return modal.result.then(function(editedMovement) {
      if (editedMovement.category && editedMovement.category._isNew) {
        return ctrl.categories.add(editedMovement.category).then(function (newCategory) {
          editedMovement.category = newCategory;
          return editedMovement;
        });
      } else {
        return editedMovement;
      }
    }).then(function(editedMovement) {
      if (isNew) {
        // argh...
        return ctrl.movements.add(editedMovement).then(function() {
          if (editedMovement.originatedFrom) {
            editedMovement.originatedFrom.forEach(function(originalMovement) {
              ctrl.movements.remove(originalMovement);
            });
          }
        });
      } else {
        return ctrl.movements.save(editedMovement);
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
  HomeController.prototype.refreshCharts = function() {
    this.buildIncomingBySourceChart();
    this.buildOutgoingByCategoryChart();
    this.buildOutgoingByCategoryByMonthChart();
  };
  /**
   * Creates a chart inside the specified container, removing the one already in the container (if exists)
   *
   * @param containerId
   */
  HomeController.prototype.createChart = function(containerId) {
    var container = $('#'+containerId);
    if (container.find('canvas').length > 0) {
      container.find('canvas').remove();
    }
    var canvas = $('<canvas id="bySourceChart" width="200" height="200"></canvas>');
    container.append(canvas);
    return new Chart(canvas.get(0).getContext('2d'));
  };
  HomeController.prototype.buildIncomingBySourceChart = function() {
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

  HomeController.prototype.buildOutgoingByCategoryChart = function() {
    var movements = _.where(this.movements.all, {direction: 'out'});
    var categories = _.filter(_.uniq(_.pluck(movements, 'category')), function(category) {
      return !category || category._id !== 'casa';
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
        label: category ? category.name : 'Non assegnata'
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

  HomeController.prototype.buildOutgoingByCategoryByMonthChart = function() {
    var $state = this.$state;
    var movements = _.filter(_.where(this.movements.all, {direction: 'out'}), function(movement) {
      return !movement.destination || 'bank_account' !== movement.destination.type;
    });

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
      category.color = CHART_COLORS[(categories.length - index - 1) % CHART_COLORS.length];
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

    $('#outgoingByCategoryByMonthChartContainer').highcharts({
      chart: {
        type: 'column',
        marginTop: 30,
        spacingLeft: 20,
        marginRight: 20,
        style: {
          fontFamily: 'Open Sans',
          fontWeight: 200
        }
      },
      title: false,
      xAxis: {
        categories: _.map(months, function(month) {
          return month.label
        }),
        tickLength: null,
        lineWidth: 0
      },
      yAxis: {
        min: 0,
        title: false,
        labels: {
          style: {
            color: '#cccccc'
          },
          formatter: function() {
            if (this.value > 0) {
              return this.value + ' €';
            }
          }
        },
        stackLabels: {
          enabled: true,
          style: {
            fontWeight: 200,
            fontSize: '16px',
            color: '#333333'
          },
          formatter: function() {
            return this.total.toFixed(2) + ' €';
          }
        },
        gridLineColor: '#eeeeee'
      },
      legend: false,
      tooltip: {
        shadow: false,
        borderColor: '#eeeeee',
        borderWidth: 3,
        formatter: function () {
          if (this.y > 0) {
            return this.series.name + ': ' + this.y.toFixed(2) + ' €<br/>';
          } else {
            return false;
          }
        }
      },
      plotOptions: {
        column: {
          stacking: 'normal',
          dataLabels: {
            enabled: false,
            color: (Highcharts.theme && Highcharts.theme.dataLabelsColor) || 'white',
            style: {
              textShadow: '0 0 3px black'
            }
          },
          events: {
            click: function(event) {
              var month = months[event.point.index];
              var category = categories[this.index];
              console.log('month:', month, 'category:', category);
              $state.go('month', {month: month.id, cat: category._id});
            }
          }
        },
        series: {
          cursor: 'pointer'
        }
      },
      series: categories
    });
    $('svg > text:contains("Highcharts.com")').remove();
  };

  angular.module('Desmond').controller('HomeController', HomeController);

})(window.jQuery, window.angular);