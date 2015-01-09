(function($, angular) {

  var Component = angular.module('Desmond.Component', []);

  var DesmondMovementsTableController = function() {
    this.selectedItems = [];
    this.selectedItemsMap = {};

    //this.onReplaceMovement = null;
  };

  DesmondMovementsTableController.prototype.deselectItem = function(item) {
    this.selectedItemsMap[item._id] = false;
    var index = _.indexOf(this.selectedItems, item);
    this.selectedItems.splice(index, 1);
  };

  DesmondMovementsTableController.prototype.selectItem = function(item) {
    this.selectedItemsMap[item._id] = true;
    this.selectedItems.push(item);
  };

  DesmondMovementsTableController.prototype.toggleSelection = function(item) {
    if (this.isSelected(item)) {
      this.deselectItem(item);
    } else {
      this.selectItem(item);
    }
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