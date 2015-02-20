const CHART_COLORS = [
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

class HomeController {
  constructor($stateParams, $scope, $q, $timeout, $injector, $modal, $state, Restangular, Movement,
              CategoriesRepository, AccountsRepository, MovementsRepository,
              Statistics) {
    this.$q = $q;
    this.$injector = $injector;
    this.$modal = $modal;
    this.$state = $state;
    this.Restangular = Restangular;
    this.Movement = Movement;
    this.categories = CategoriesRepository;
    this.accounts = AccountsRepository;
    this.movements = MovementsRepository;
    this.statistics = Statistics;
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

    $scope.$watch('ctrl.movements.all', (movements, oldValue) => {
      if (movements === oldValue) {
        return;
      }
      this.updateFilters();
      this.refreshCharts(true);
      this.filteredMovements = _.filter(movements, this.movementsFilterFunction, this).reverse();
    });

    $scope.$watchCollection('ctrl.filters', (newFilters, oldFilters) => {
      if (newFilters === oldFilters) {
        return;
      }
      this.filteredMovements = _.filter(this.movements.all, this.movementsFilterFunction, this).reverse();
    });

    // initialization
    if (this.movements.all.length > 0) {
      // deferred to allow the rendering of the spaces
      $timeout(() => {
        this.updateFilters();
        this.refreshCharts(false);
        this.filteredMovements = _.filter(this.movements.all, this.movementsFilterFunction, this).reverse();
      });
    }
  }

  updateFilters() {
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
  }

  toggleAllSelection() {
    if (this.selectedItems.length < this.filteredMovements.length) {
      this.selectedItems = [].concat(this.filteredMovements);
    } else {
      this.selectedItems = [];
    }
  }

  movementsFilterFunction(movement) {
    var filters = this.filters;

    if (movement.direction === 'in' && movement.source && movement.source.type === 'bank_account') {
      return false;
    }
    if (movement.direction === 'out' && movement.destination && movement.destination.type === 'bank_account') {
      return false;
    }

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

  deleteSelected(message) {
    message = message || 'Eliminare i movimenti selezionati?';
    swal({
      title: message,
      type: 'warning',
      allowOutsideClick: true,
      showCancelButton: true,
      confirmButtonColor: '#DD6B55',
      confirmButtonText: 'Elimina ' + this.selectedItems.length + ' movimenti',
      cancelButtonText: 'Annulla'
    }, (isConfirm) => {
      if (isConfirm) {
        for (let movement of this.selectedItems) {
          this.movements.remove(movement);
        }
      }
    });
  }

  mergeSelected() {
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
  }

  editMovement(movement) {
    var Restangular = this.Restangular;
    var isNew = !movement._id;
    var modal = this.$modal.open({
      templateUrl: 'components/edit_modal.html',
      controller: 'EditModalController as ctrl',
      size: 'lg',
      windowClass: ['edit-modal'],
      backdrop: 'static',
      resolve: {
        movement: () => {
          // copy the angular movement, mantaining the references to other objects
          // TODO: move this into the Movement model class?
          let copy = null;
          const LINK_FIELDS = [
            'document', 'account', 'category', 'source',
            'sourceMovement', 'destination', 'destinationMovement',
            'originatedFrom'];

          var savedFields = {};
          for (let fieldName of LINK_FIELDS) {
            savedFields[fieldName] = movement[fieldName];
            movement[fieldName] = null;
          }
          if (isNew) {
            copy = angular.copy(movement);
          } else {
            copy = Restangular.copy(movement);
          }
          for (let fieldName of LINK_FIELDS) {
            copy[fieldName] = savedFields[fieldName];
            movement[fieldName] = savedFields[fieldName];
          }
          return copy;
        }
      }
    });

    return modal.result.then((editedMovement) => {
      if (editedMovement.category && editedMovement.category._isNew) {
        return this.categories.add(editedMovement.category).then(function(newCategory) {
          editedMovement.category = newCategory;
          return editedMovement;
        });
      } else {
        return editedMovement;
      }
    }).then((editedMovement) => {
      if (isNew) {
        // argh...
        return this.movements.add(editedMovement).then(() => {
          if (editedMovement.originatedFrom) {
            for (let originalMovement of editedMovement.originatedFrom) {
              this.movements.remove(originalMovement);
            }
          }
        });
      } else {
        return this.movements.save(editedMovement);
      }
    });
  }


  refreshCharts(refreshStats) {
    if (refreshStats) {
      this.statistics.refresh();
    }
    this.buildIncomingBySourceChart();
    this.buildOutgoingByCategoryChart();
    this.buildOutgoingByCategoryByMonthChart();
  }

  /**
   * Creates a chart inside the specified container, removing the one already in the container (if exists)
   *
   * @param containerId
   */
  createChart(containerId) {
    var container = $('#' + containerId);
    if (container.find('canvas').length > 0) {
      container.find('canvas').remove();
    }
    var canvas = $('<canvas id="bySourceChart" width="200" height="200"></canvas>');
    container.append(canvas);
    return new Chart(canvas.get(0).getContext('2d'));
  }

  buildIncomingBySourceChart() {
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
  }

  buildOutgoingByCategoryChart() {
    var movements = _.where(this.movements.all, {direction: 'out'});
    var categories = _.filter(_.uniq(_.pluck(movements, 'category')), function(category) {
      return !category || category._id !== 'casa';
    });

    var data = _.sortBy(_.map(categories, function(category) {
      return {
        value: _.reduce(_.where(movements, {category: category}), function(sum, movement) {
          if (movement.destination && 'bank_account' === movement.destination.type) {
            return sum;
          } else {
            return sum - movement.amount;
          }
        }, 0),
        label: category ? category.name : 'Non assegnata'
      };
    }), 'value').reverse();
    _.each(data, function(dataItem, index) {
      dataItem.color = CHART_COLORS[index % CHART_COLORS.length]
    });

    this.createChart('outgoingByCategoryChartContainer').Doughnut(data, {
      animation: false,
      tooltipTemplate: 'label + " " + (value | number:2) + " €"'
    });
  }

  buildOutgoingByCategoryByMonthChart() {
    var $state = this.$state;
    var stat = this.statistics.outgoingByCategoryByMonth;

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
        categories: _.map(stat.months, function(month) {
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
        formatter: function() {
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
              var month = stat.months[event.point.index];
              var category = stat.categories[this.index];
              if (!month.id) {
                return;
              }
              $state.go('^.month', {month: month.id, cat: category._id});
            }
          }
        },
        series: {
          cursor: 'pointer'
        }
      },
      series: [].concat(stat.categories).reverse()
    });
    $('svg > text:contains("Highcharts.com")').remove();
  }
}
HomeController.$inject = [
  '$stateParams', '$scope', '$q', '$timeout', '$injector', '$modal', '$state', 'Restangular',
  'Movement',
  'CategoriesRepository', 'AccountsRepository', 'MovementsRepository',
  'Statistics'];

export default HomeController;