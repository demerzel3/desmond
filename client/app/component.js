(function($, angular) {

  var Component = angular.module('Desmond.Component', []);

  var DesmondMovementsTableController = function($scope) {
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
  };
  DesmondMovementsTableController.$inject = ['$scope'];

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

  Component.directive('desmondMovementsTable', function() {
    return {
      restrict: 'E',
      templateUrl: 'components/movements_table.html',
      scope: {
        movements: '=',
        selectedItems: '=?', // can be omitted

        replaceMovementEnabled: '@',
        onReplaceMovement: '&'
      },
      controller: DesmondMovementsTableController,
      controllerAs: 'ctrl',
      bindToController: true,
      compile: function(element, attrs) {
        // set default values to attributes
        if (!attrs.replaceMovementEnabled) {
          attrs.replaceMovementEnabled = 'false';
        }
      }
    }
  });

})(window.jQuery, window.angular);