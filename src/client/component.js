(function($, angular) {

  var Component = angular.module('Desmond.Component', []);

  var DesmondMovementsTableController = function($scope, $element, $attrs, $window, $timeout) {
    this.$element = $element;
    this.selectedItems = [];
    this.selectedItemsMap = {};

    var ctrl = this;
    // update selection map on change of selection
    $scope.$watch('ctrl.selectedItems', function(selectedItems, oldSelectedItems) {
      if (selectedItems === oldSelectedItems) {
        return;
      }
      // build a map from the list of selected items
      var map = {};
      _.each(selectedItems, function(selectedItem) {
        map[selectedItem._id] = true;
      });
      ctrl.selectedItemsMap = map;
    });
    // update selection on change of base collection (does not mantain selection of invisible items)
    $scope.$watch('ctrl.movements', function(movements, oldMovements) {
      if (movements === oldMovements) {
        return;
      }
      var newMovementsIds = _.invert(_.pluck(movements, '_id'));
      // this in turn will update the selection map
      ctrl.selectedItems = ctrl.selectedItems.filter(function(movement) {
        return !_.isUndefined(newMovementsIds[movement._id]);
      });
    });

    if (!_.isUndefined($attrs.fixedHeader)) {
      // adapt headers
      var adaptHeader = _.debounce(function () {
        ctrl.adaptHeader();
      }, 100);
      $element.resize(adaptHeader);
      $scope.$on('$destroy', function () {
        $element.removeResize(adaptHeader);
      });
    }
  };
  DesmondMovementsTableController.$inject = ['$scope', '$element', '$attrs', '$window', '$timeout'];

  DesmondMovementsTableController.prototype.deselectItem = function(item) {
    this.selectedItemsMap[item._id] = false;
    var index = _.indexOf(this.selectedItems, item);
    this.selectedItems.splice(index, 1);
  };

  DesmondMovementsTableController.prototype.selectItem = function(item) {
    this.selectedItemsMap[item._id] = true;
    this.selectedItems.push(item);
  };

  DesmondMovementsTableController.prototype.toggleAllSelection = function() {
    if (this.selectedItems.length < this.movements.length) {
      this.selectedItems = [].concat(this.movements);
    } else {
      this.selectedItems = [];
    }
  };

  DesmondMovementsTableController.prototype.toggleSelection = function(item) {
    if (this.isSelected(item)) {
      this.deselectItem(item);
    } else {
      this.selectItem(item);
    }
  };

  DesmondMovementsTableController.prototype.selectAll = function() {
    this.selectedItems = [].concat(this.movements);
  };

  DesmondMovementsTableController.prototype.deselectAll = function() {
    this.selectedItems = [];
    this.selectedItemsMap = {};
  };

  DesmondMovementsTableController.prototype.isSelected = function(item) {
    return this.selectedItemsMap[item._id];
  };

  DesmondMovementsTableController.prototype.adaptHeader = function() {
    var heads = this.$element.find('thead > tr > th');
    var cols = this.$element.find('tbody > tr:first-child > td');
    if (cols.length == 0) {
      return;
    }
    if (heads.length !== cols.length) {
      return;
    }
    _.each(heads, function(head, index) {
      $(head).width(cols.eq(index).width());
    });
  };

  Component.directive('desmondMovementsTable', function() {
    return {
      restrict: 'E',
      templateUrl: 'components/movements_table.html',
      scope: {
        movements: '=',

        selectionEnabled: '@',
        selectedItems: '=?', // can be omitted

        replaceMovementEnabled: '@',
        onReplaceMovement: '&',

        editEnabled: '@',
        onEdit: '&'
      },
      controller: DesmondMovementsTableController,
      controllerAs: 'ctrl',
      bindToController: true,
      compile: function(element, attrs) {
        // set default values to attributes
        if (!attrs.replaceMovementEnabled) {
          attrs.replaceMovementEnabled = 'false';
        }
        if (!attrs.editEnabled) {
          attrs.editEnabled = 'false';
        }
        if (!attrs.selectionEnabled) {
          attrs.selectionEnabled = 'true';
        }
      }
    }
  });



  Component.directive('colorFromImage', function() {
    var colorThief = new ColorThief();

    return {
      restrict: 'A',
      link: function(scope, element, attrs) {
        var img = element.find('img').andSelf().filter('img');
        if (img.length === 0) {
          return;
        }

        img.on('load', function() {
          var color = colorThief.getPalette(img[0], 3)[0];
          var styleName = attrs.colorFromImage || 'color';
          var style = {};
          style[styleName] = 'rgb('+color[0]+','+color[1]+','+color[2]+')';
          element.css(style);
        });
      }
    };
  });



  Component.directive('dragOverScreen', ['$timeout', function($timeout) {
    return {
      restrict: 'A',
      link: function(scope, element, attrs) {
        var leaveTimeout = null;
        var enterCount = 0;
        var leaveCount = 0;
        var dragElement = null;

        document.addEventListener('dragover', function(event) {
          // allow drop!
          event.preventDefault();
        }, false);

        document.addEventListener('dragenter', function(event) {
          dragElement = event.target;
          if (leaveTimeout) {
            $timeout.cancel(leaveTimeout);
            leaveTimeout = null;
          }
          element.addClass('dragover');
          enterCount++;
        }, false);

        document.addEventListener('dragleave', function(event) {
          if (event.target === dragElement) {
            dragElement = null;
            leaveTimeout = $timeout(function () {
              element.removeClass('dragover');
              leaveTimeout = null;
            }, 500);
            leaveCount++;
          }
        }, false);

        document.addEventListener('drop', function(event) {
          element.removeClass('dragover');
          event.preventDefault();
        }, false);
      }
    }
  }]);

})(window.jQuery, window.angular);