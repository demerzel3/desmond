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
    this.unassignedMovementsCount = 0;
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
      this.onMovementsChanged();
    });

    $scope.$watchCollection('ctrl.filters', (newFilters, oldFilters) => {
      if (newFilters === oldFilters) {
        return;
      }
      this.filteredMovements = this.movements.all.filter(this.movementsFilterFunction, this).reverse();
    });

    // initialization
    if (this.movements.all.length > 0) {
      // deferred to allow the rendering of the spaces
      $timeout(() => {
        this.onMovementsChanged();
      });
    }
  }

  onMovementsChanged() {
    this.updateFilters();
    this.refreshCharts(true);
    this.filteredMovements = _.filter(this.movements.all, this.movementsFilterFunction, this).reverse();
    this.unassignedMovementsCount = this.movements.findOutgoingUnassignedCategory().length;
  }

  updateFilters() {
    // extract sources (for filters)
    var sources = _.where(this.movements.all, {direction: 'in'});
    sources = _.pluck(sources, 'source');
    sources = _.uniq(sources);
    sources = sources.filter((source) => !!source);
    this.sources = _.sortBy(sources, 'name');

    // extract destinations (for filters)
    var destinations = _.where(this.movements.all, {direction: 'out'});
    destinations = _.pluck(destinations, 'destination');
    destinations = _.uniq(destinations);
    destinations = destinations.filter((destination) => !!destination);
    this.destinations = _.sortBy(destinations, 'name');

    // extract categories
    var categories = _.pluck(this.movements.all, 'category');
    categories = _.uniq(categories);
    categories = categories.filter((category) => !!category);
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

  refreshCharts(refreshStats) {
    if (refreshStats) {
      this.statistics.refresh();
    }
    //this.buildIncomingBySourceChart();
    //this.buildOutgoingByCategoryChart();
    this.buildOutgoingByCategoryByMonthChart();
    this.buildTotalByMonthChart();
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
    var sources = _.uniq(movements.map((movement) => movement.source));

    var data = _.sortBy(sources.map((source) => {
      return {
        value: _.where(movements, {source: source}).reduce((sum, movement) => {
          if (movement.source && 'bank_account' === movement.source.type) {
            return sum;
          } else {
            return sum + movement.amount;
          }
        }, 0),
        label: source ? source.name : 'Sconosciuta'
      };
    }), 'value').reverse();
    data.forEach((dataItem, index) => {
      dataItem.color = CHART_COLORS[index % CHART_COLORS.length]
    });

    this.createChart('incomingBySourceChartContainer').Doughnut(data, {
      animation: false,
      tooltipTemplate: 'label + " " + (value | number:2) + " €"'
    });
  }

  buildOutgoingByCategoryChart() {
    var movements = _.where(this.movements.all, {direction: 'out'});
    var categories = _.uniq(_.pluck(movements, 'category')).filter((category) => {
      return !category || category._id !== 'casa';
    });

    var data = _.sortBy(categories.map((category) => {
      return {
        value: _.where(movements, {category: category}).reduce((sum, movement) => {
          if (movement.destination && 'bank_account' === movement.destination.type) {
            return sum;
          } else {
            return sum - movement.amount;
          }
        }, 0),
        label: category ? category.name : 'Non assegnata'
      };
    }), 'value').reverse();
    data.forEach((dataItem, index) => {
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
        categories: stat.months.map((month) => month.label),
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

  buildTotalByMonthChart() {
    var stat = this.statistics.totalByMonth;

    $('#totalByMonthChartContainer').highcharts({
      chart: {
        type: 'line',
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
        categories: stat.months.map((month) => month.label),
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
          return this.y.toFixed(2) + ' €<br/>';
        }
      },
      plotOptions: {
      },
      series: [{
        name: 'Totali',
        data: stat.totals
      }]
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