(function($, angular, Desmond) {

  var MonthController = function($stateParams, $scope, $timeout, MovementsRepository, Statistics) {
    this.$timeout = $timeout;
    this.month = $stateParams.month;
    this.stat = Statistics.outgoingByCategoryByMonth;

    this.movements = MovementsRepository;
    this.filteredMovements = [];
    this.categories = [];
    this.total = 0;

    if (this.movements.all.length > 0) {
      this.initData();
    }

    var ctrl = this;
    $scope.$watch('ctrl.movements.all', function(movements, oldValue) {
      if (movements === oldValue) {
        return;
      }
      ctrl.stat.refresh();
      ctrl.initData();
    });
  };
  MonthController.$inject = ['$stateParams', '$scope', '$timeout', 'MovementsRepository', 'Statistics'];

  MonthController.prototype.initData = function() {
    var ctrl = this;

    this.registerCategoriesStyles(this.stat.categories);

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

    this.$timeout(function() {
      ctrl.updateFunnel();
    });
  };

  MonthController.prototype.registerCategoriesStyles = function(categories) {
    var sheet = (function() {
    	var style = document.createElement("style");
    	// WebKit hack :(
    	style.appendChild(document.createTextNode(""));
    	document.head.appendChild(style);
    	return style.sheet;
    })();
    categories.forEach(function(category, index) {
      var hsl = tinycolor(category.color).toHsl();
      hsl.s = Math.max(hsl.s, hsl.s-0.4);
      hsl.l = 0.95;
      var color = tinycolor(hsl);
      sheet.insertRule('table.table-movements tr[category="'+category._id+'"] {background-color: '+color.toString()+'}', index);
    });
    console.log(sheet);
  };

  MonthController.prototype.updateFunnel = function() {
    var $el = $('#monthView');
    var categories = $el.find('.categories > div');
    var rows = $el.find('tbody > tr').toArray();
    var movements = [].concat(this.filteredMovements);

    var items = _.map(this.categories, function(category, index) {
      var catEl = categories.eq(index);
      var pos = catEl.position();
      var funnelItem = {
        color: category.color,
        left: {
          from: pos.top,
          to: pos.top + catEl.height()
        }
      };

      var catRows = [];
      if (category._id) {
        while (movements.length > 0 && movements[0].category && movements[0].category._id === category._id) {
          catRows.push(rows.shift());
          movements.shift();
        }
      } else {
        while (movements.length > 0 && !movements[0].category) {
          catRows.push(rows.shift());
          movements.shift();
        }
      }

      funnelItem.right = {
        from: $(catRows[0]).position().top + 1
      };
      var rowsHeight = _.reduce(catRows, function(totalHeight, row) {
        return totalHeight + $(row).height();
      }, 0) - 1;
      funnelItem.right.to = funnelItem.right.from + rowsHeight;

      return funnelItem;
    });

    var funnelEl = $el.find('.funnel').empty();
    var size = {width: funnelEl.width(), height: funnelEl.height()};

    var paper = Raphael(funnelEl[0]);
    var paths = _.map(items, function(item) {
      var pathString = 'M'+0+','+item.left.from+'L'+size.width+','+item.right.from
        +'L'+size.width+','+item.right.to+'L'+0+','+item.left.to+'Z';
      var path = paper.path(pathString);
      path.attr({
        fill: item.color,
        stroke: 'transparent'
      });
      return path;
    });

    var updateFunnel = function() {
      var scrollTop = $el.find('.main-box')[0].scrollTop;
      var newSize = {width: size.width, height: funnelEl.height()};
      if (newSize.height !== size.height) {
        paper.setSize(newSize.width, newSize.height);

        // update from
        items.forEach(function(item, index) {
          var catEl = categories.eq(index);
          var pos = catEl.position();
          item.left.from = pos.top;
          item.left.to = pos.top + catEl.height();
        });
      }
      paths.forEach(function(path, index) {
        var item = items[index];
        var pathString = 'M'+0+','+item.left.from+'L'+newSize.width+','+(item.right.from-scrollTop)
          +'L'+newSize.width+','+(item.right.to-scrollTop)+'L'+0+','+item.left.to+'Z';
        path.attr('path', pathString);
      });
    };

    $('.main-box').on('scroll', updateFunnel);
    $(window).resize(updateFunnel);
  };

  Desmond.controller('MonthController', MonthController);

})(window.jQuery, window.angular, window.angular.module('Desmond'));